package com.futureprint.calculator.backup;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * The .tabk container: a self-describing, optionally AES-256-GCM sealed envelope.
 *
 * Layout (must stay in sync with src/lib/backup/codec.ts):
 * <pre>
 *   "TABK"        4 bytes   magic
 *   version       1 byte    format version (1)
 *   flags         1 byte    bit0 = payload sealed
 *   reserved      2 bytes   zero
 *   keyIdLen      2 bytes   big-endian
 *   payloadLen    8 bytes   big-endian
 *   keyId         keyIdLen  ASCII (empty when unsealed)
 *   payload       payloadLen
 *   tagSlot       16 bytes  reserved when sealed, absent otherwise
 * </pre>
 * Sealed payloads are iv(12) || ciphertext || gcmTag(16).
 */
public final class BackupArchive {

    public static final String MAGIC = "TABK";
    public static final String FOLDER_NAME = "InvoiceBackups";
    public static final int FORMAT_VERSION = 1;
    public static final int PREFIX_LEN = 18;
    public static final int GCM_TAG_LEN = 16;
    public static final int GCM_IV_LEN = 12;
    public static final int SEALED_FLAG = 0x01;
    public static final int KEY_LEN = 32;

    private static final SecureRandom RANDOM = new SecureRandom();

    private BackupArchive() {}

    public static final class FormatException extends Exception {

        public final String code;

        public FormatException(String code, String message) {
            super(message);
            this.code = code;
        }
    }

    public static final class Parsed {

        public int version;
        public boolean sealed;
        public String keyId;
        public byte[] payload;
        public int totalLength;
    }

    /** Thrown when AES-GCM authentication fails (wrong key or tampered bytes). */
    public static final class SealException extends Exception {

        public SealException(String message) {
            super(message);
        }
    }

    public static byte[] seal(byte[] plaintext, byte[] key) throws GeneralSecurityException {
        byte[] iv = new byte[GCM_IV_LEN];
        RANDOM.nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
        byte[] body = cipher.doFinal(plaintext);
        byte[] out = new byte[iv.length + body.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(body, 0, out, iv.length, body.length);
        return out;
    }

    public static byte[] open(byte[] sealed, byte[] key) throws SealException {
        if (sealed.length < GCM_IV_LEN + GCM_TAG_LEN) throw new SealException("بيانات النسخة المشفّرة أقصر من المتوقع.");
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(128, sealed, 0, GCM_IV_LEN);
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), spec);
            return cipher.doFinal(sealed, GCM_IV_LEN, sealed.length - GCM_IV_LEN);
        } catch (GeneralSecurityException e) {
            throw new SealException("فشل فك التشفير: المفتاح غير مطابق أو الملف معدّل.");
        }
    }

    /** SHA-256 hex, matching the TypeScript implementation. */
    public static String sha256Hex(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xf, 16));
                sb.append(Character.forDigit(b & 0xf, 16));
            }
            return sb.toString();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** Non-secret identifier derived from the key; lets us tell which key sealed a file. */
    public static String deriveKeyId(byte[] key) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update("ta-backup-keyid:".getBytes(StandardCharsets.UTF_8));
            byte[] hash = digest.digest(key);
            StringBuilder sb = new StringBuilder(16);
            for (int i = 0; i < 8; i++) {
                sb.append(Character.forDigit((hash[i] >> 4) & 0xf, 16));
                sb.append(Character.forDigit(hash[i] & 0xf, 16));
            }
            return sb.toString();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public static byte[] encode(byte[] plaintext, byte[] key) throws GeneralSecurityException {
        boolean sealed = key != null;
        byte[] payload = sealed ? seal(plaintext, key) : plaintext;
        String keyId = sealed ? deriveKeyId(key) : "";
        byte[] keyIdBytes = keyId.getBytes(StandardCharsets.UTF_8);

        ByteArrayOutputStream out = new ByteArrayOutputStream(payload.length + PREFIX_LEN + keyIdBytes.length + GCM_TAG_LEN);
        out.write(MAGIC.getBytes(StandardCharsets.UTF_8), 0, 4);
        out.write(FORMAT_VERSION);
        out.write(sealed ? SEALED_FLAG : 0);
        // keyIdLen follows flags; the two reserved bytes come after it.
        out.write((keyIdBytes.length >> 8) & 0xff);
        out.write(keyIdBytes.length & 0xff);
        out.write(0);
        out.write(0);
        for (int shift = 56; shift >= 0; shift -= 8) {
            out.write((int) (((long) payload.length >> shift) & 0xff));
        }
        out.write(keyIdBytes, 0, keyIdBytes.length);
        out.write(payload, 0, payload.length);
        if (sealed) {
            out.write(new byte[GCM_TAG_LEN], 0, GCM_TAG_LEN);
        }
        return out.toByteArray();
    }

    /** Parses and length-validates the container without decrypting. */
    public static Parsed parse(byte[] bytes) throws FormatException {
        if (bytes == null || bytes.length < PREFIX_LEN) {
            throw new FormatException("TRUNCATED", "الملف أصغر من ترويسة النسخة (ملف غير مكتمل).");
        }
        String magic = new String(bytes, 0, 4, StandardCharsets.UTF_8);
        if (!MAGIC.equals(magic)) {
            throw new FormatException("BAD_MAGIC", "الملف ليس نسخة احتياطية من هذا التطبيق.");
        }
        int version = bytes[4] & 0xff;
        if (version != FORMAT_VERSION) {
            throw new FormatException("UNSUPPORTED_VERSION", "إصدار صيغة النسخة (" + version + ") غير مدعوم.");
        }
        boolean sealed = (bytes[5] & SEALED_FLAG) != 0;
        int keyIdLen = ((bytes[6] & 0xff) << 8) | (bytes[7] & 0xff);
        if (keyIdLen > 128) {
            throw new FormatException("BAD_LENGTHS", "ترويسة النسخة تحتوي على طول مفتاح غير صالح.");
        }
        long payloadLen = 0;
        for (int i = 10; i < 18; i++) {
            payloadLen = (payloadLen << 8) | (bytes[i] & 0xff);
        }
        if (payloadLen < 0 || payloadLen > Integer.MAX_VALUE - 1024) {
            throw new FormatException("BAD_LENGTHS", "حجم البيانات داخل النسخة أكبر من قدرة الجهاز.");
        }
        long expected = (long) PREFIX_LEN + keyIdLen + payloadLen + (sealed ? GCM_TAG_LEN : 0);
        if (bytes.length != (int) expected) {
            throw new FormatException(
                "TRUNCATED",
                "حجم الملف (" + bytes.length + " بايت) لا يطابق الترويسة (" + expected + " بايت) — النسخة غير مكتملة."
            );
        }
        Parsed parsed = new Parsed();
        parsed.version = version;
        parsed.sealed = sealed;
        parsed.keyId = new String(bytes, PREFIX_LEN, keyIdLen, StandardCharsets.UTF_8);
        int payloadStart = PREFIX_LEN + keyIdLen;
        parsed.payload = new byte[(int) payloadLen];
        System.arraycopy(bytes, payloadStart, parsed.payload, 0, (int) payloadLen);
        parsed.totalLength = bytes.length;
        return parsed;
    }

    public static boolean looksLikeArchive(byte[] head) {
        return head != null && head.length >= 4 && MAGIC.equals(new String(head, 0, 4, StandardCharsets.UTF_8));
    }
}
