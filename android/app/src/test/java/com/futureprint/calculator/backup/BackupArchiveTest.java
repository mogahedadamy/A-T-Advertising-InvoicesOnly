package com.futureprint.calculator.backup;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import org.junit.Test;

/**
 * اختبار حقيقي لمنطق صيغة النسخ الاحتياطية في Java على JVM
 * (BackupArchive لا يعتمد على أي واجهة أندرويد، لذا يعمل هنا دون جهاز).
 *
 * البايتات المرجعية (UNSEALED_HEX / SEALED_HEX) مُنتَجة من تنفيذ TypeScript
 * المطابق في src/lib/backup/codec.ts، فأي انحراف بين اللغتين يُفشل هذا الاختبار.
 */
public class BackupArchiveTest {

    /** مغلّف كما ينتجه التطبيق فعلاً: {header, databaseBase64} */
    private static final String PAYLOAD =
        "{\"header\":{\"format\":\"TA-BACKUP\",\"backupId\":\"fix-1\"},\"databaseBase64\":\"AAECAwQ=\"}";

    private static final byte[] KEY = new byte[32];

    static {
        for (int i = 0; i < KEY.length; i++) KEY[i] = 0x07;
    }

    private static final String KEY_ID = "1346b582d14a23e7";

    private static final String UNSEALED_HEX =
        "5441424b01000000000000000000000000507b22686561646572223a7b22666f726d6174223a2254412d4241434b5550222c2262"
            + "61636b75704964223a226669782d31227d2c226461746162617365426173653634223a22414145434177513d227d";

    private static final String SEALED_HEX =
        "5441424b010100100000000000000000006c3133343662353832643134613233653703fd4d601e97e718a223363f7e5905c1d3a4"
            + "786ff208008891991fd73e2cd7bee2333f3bd56e61ea35c1de8ab54f193c5d3b352caa5500991d5417e8252b7dd07cc28de439e11dd"
            + "d35faea367d86f68ae50a1bdebfd60da04ca2985fccb1e86f46961088caadddd13678948e00000000000000000000000000000000";

    private static byte[] hexToBytes(String hex) {
        int len = hex.length() / 2;
        byte[] out = new byte[len];
        for (int i = 0; i < len; i++) {
            out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xf, 16));
            sb.append(Character.forDigit(b & 0xf, 16));
        }
        return sb.toString();
    }

    private static String envelopeDatabaseBase64(byte[] plaintext) throws Exception {
        String json = new String(plaintext, StandardCharsets.UTF_8);
        int idx = json.indexOf("\"databaseBase64\":\"");
        assertTrue("المغلّف لا يحتوي databaseBase64", idx >= 0);
        int start = idx + "\"databaseBase64\":\"".length();
        int end = json.indexOf('"', start);
        return json.substring(start, end);
    }

    // ── 1. تطابق البايتات مع تنفيذ TypeScript ──────────────────────────────

    @Test
    public void unsealedEncodingMatchesTypeScriptByteForByte() throws Exception {
        byte[] archive = BackupArchive.encode(PAYLOAD.getBytes(StandardCharsets.UTF_8), null);
        assertEquals("النسخة غير المشفّرة يجب أن تطابق تنفيذ TypeScript بايتاً ببايت", UNSEALED_HEX, bytesToHex(archive));
    }

    @Test
    public void headerLayoutIsExactlyAsDocumented() throws Exception {
        byte[] archive = BackupArchive.encode(PAYLOAD.getBytes(StandardCharsets.UTF_8), null);
        BackupArchive.Parsed parsed = BackupArchive.parse(archive);

        assertEquals("TABK", new String(archive, 0, 4, StandardCharsets.UTF_8));
        assertEquals(1, archive[4]); // version
        assertEquals(0, archive[5]); // flags: unsealed
        assertEquals("keyIdLen يجب أن يكون في الإزاحة 6-7", 0, ((archive[6] & 0xff) << 8) | (archive[7] & 0xff));
        assertEquals("البايتان 8-9 محجوزان ويجب أن يكونا صفراً", 0, archive[8]);
        assertEquals(0, archive[9]);

        int payloadLenFromHeader = 0;
        for (int i = 10; i < 18; i++) payloadLenFromHeader = (payloadLenFromHeader << 8) | (archive[i] & 0xff);
        assertEquals("طول البيانات في الترويسة (الإزاحة 10)", PAYLOAD.getBytes(StandardCharsets.UTF_8).length, payloadLenFromHeader);
        assertEquals(18 + payloadLenFromHeader, archive.length);
        assertFalse(parsed.sealed);
        assertEquals("", parsed.keyId);
    }

    // ── 2. قراءة نسخة مشفّرة أنتجها TypeScript ─────────────────────────────

    @Test
    public void readsSealedArchiveProducedByTypeScript() throws Exception {
        byte[] archive = hexToBytes(SEALED_HEX);
        BackupArchive.Parsed parsed = BackupArchive.parse(archive);

        assertTrue("يجب التعرف على النسخة كمشفّرة", parsed.sealed);
        assertEquals(KEY_ID, parsed.keyId);
        assertEquals("طول البيانات = IV(12) + تشفير(80) + وسم(16)", 108, parsed.payload.length);
        assertEquals("المساحة المحجوزة بعد البيانات", 16, archive.length - BackupArchive.PREFIX_LEN - KEY_ID.length() - parsed.payload.length);

        byte[] plaintext = BackupArchive.open(parsed.payload, KEY);
        assertEquals("يجب فك التشفير إلى نفس المغلّف", PAYLOAD, new String(plaintext, StandardCharsets.UTF_8));
        assertEquals("AAECAwQ=", envelopeDatabaseBase64(plaintext));
    }

    // ── 3. الذهاب والإياب داخل Java ────────────────────────────────────────

    @Test
    public void sealedRoundTripWithinJava() throws Exception {
        byte[] archive = BackupArchive.encode(PAYLOAD.getBytes(StandardCharsets.UTF_8), KEY);
        BackupArchive.Parsed parsed = BackupArchive.parse(archive);
        assertTrue(parsed.sealed);
        assertEquals(BackupArchive.deriveKeyId(KEY), parsed.keyId);
        assertArrayEquals(PAYLOAD.getBytes(StandardCharsets.UTF_8), BackupArchive.open(parsed.payload, KEY));
    }

    @Test
    public void sha256AndKeyIdAreStableAndMatchTypeScript() {
        assertEquals(KEY_ID, BackupArchive.deriveKeyId(KEY));
        // SHA-256 لنص معروف (المتجه الأول من تنفيذ TypeScript)
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", BackupArchive.sha256Hex("abc".getBytes(StandardCharsets.UTF_8)));
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            BackupArchive.sha256Hex(new byte[0])
        );
    }

    // ── 4. كشف العبث ───────────────────────────────────────────────────────

    @Test
    public void wrongKeyIsRejected() throws Exception {
        byte[] archive = BackupArchive.encode(PAYLOAD.getBytes(StandardCharsets.UTF_8), KEY);
        BackupArchive.Parsed parsed = BackupArchive.parse(archive);
        byte[] wrongKey = new byte[32];
        for (int i = 0; i < wrongKey.length; i++) wrongKey[i] = 0x11;
        try {
            BackupArchive.open(parsed.payload, wrongKey);
            fail("يجب رفض المفتاح الخاطئ");
        } catch (BackupArchive.SealException expected) {
            assertNotNull(expected.getMessage());
        }
    }

    @Test
    public void tamperedCiphertextIsRejected() throws Exception {
        byte[] archive = BackupArchive.encode(PAYLOAD.getBytes(StandardCharsets.UTF_8), KEY);
        BackupArchive.Parsed parsed = BackupArchive.parse(archive);
        byte[] tampered = parsed.payload.clone();
        tampered[20] ^= 0x40; // اقلب بتاً داخل النص المشفّر
        try {
            BackupArchive.open(tampered, KEY);
            fail("يجب رفض البيانات المعدّلة (AES-GCM authenticated)");
        } catch (BackupArchive.SealException expected) {
            assertNotNull(expected.getMessage());
        }
    }

    // ── 5. رفض الملفات غير الصالحة برموز واضحة ─────────────────────────────

    @Test
    public void rejectsBadMagic() {
        byte[] archive = new byte[64];
        try {
            BackupArchive.parse(archive);
            fail("يجب رفض ملف بدون الترويسة الصحيحة");
        } catch (BackupArchive.FormatException e) {
            assertEquals("BAD_MAGIC", e.code);
        }
    }

    @Test
    public void rejectsTruncatedWithoutLengthReadingBug() throws Exception {
        byte[] archive = BackupArchive.encode(PAYLOAD.getBytes(StandardCharsets.UTF_8), null);
        byte[] truncated = new byte[archive.length - 1];
        System.arraycopy(archive, 0, truncated, 0, truncated.length);
        try {
            BackupArchive.parse(truncated);
            fail("يجب رفض الملف المقطوع");
        } catch (BackupArchive.FormatException e) {
            assertEquals("TRUNCATED", e.code);
        }
    }

    @Test
    public void rejectsUnsupportedVersion() throws Exception {
        byte[] archive = BackupArchive.encode(PAYLOAD.getBytes(StandardCharsets.UTF_8), null);
        archive[4] = 9;
        try {
            BackupArchive.parse(archive);
            fail("يجب رفض إصدار غير مدعوم");
        } catch (BackupArchive.FormatException e) {
            assertEquals("UNSUPPORTED_VERSION", e.code);
        }
    }

    @Test
    public void rejectsAppendedBytes() throws Exception {
        byte[] archive = BackupArchive.encode(PAYLOAD.getBytes(StandardCharsets.UTF_8), null);
        byte[] longer = new byte[archive.length + 4];
        System.arraycopy(archive, 0, longer, 0, archive.length);
        try {
            BackupArchive.parse(longer);
            fail("يجب رفض ملف أُضيفت إليه بايتات");
        } catch (BackupArchive.FormatException e) {
            assertEquals("TRUNCATED", e.code);
        }
    }
}
