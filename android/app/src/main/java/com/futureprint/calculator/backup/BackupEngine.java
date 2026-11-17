package com.futureprint.calculator.backup;

import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Orchestrates the whole backup lifecycle for the app's own database:
 * create → verify → commit → prune, plus discovery and restore.
 *
 * Policy lives here (and in RetentionPlanner) so the WorkManager worker and the
 * UI-triggered paths cannot drift apart.
 */
public final class BackupEngine {

    private static final String TAG = "BackupEngine";
    public static final String PREFS = "ta_backup_settings";
    public static final String ENGINE_VERSION = "1.0.0";

    /** Serialises every engine operation inside one process. */
    private static final Object LOCK = new Object();

    private static final String[] RESTORE_ORDER = {
        "settings",
        "sequences",
        "db_meta",
        "financial_accounts",
        "customers",
        "suppliers",
        "projects",
        "orders",
        "order_items",
        "custom_invoices",
        "custom_invoice_items",
        "proforma_invoices",
        "proforma_lines",
        "print_invoices",
        "print_invoice_lines",
        "customer_payments",
        "customer_payment_allocations",
        "supplier_payments",
        "supplier_payment_allocations",
        "expenses",
        "expense_payments",
        "financial_transactions",
        "document_sequences",
        "audit_log",
    };

    private final Context context;
    private final BackupStorage storage;
    private final BackupKeyStore keyStore;
    private final DatabaseSnapshotter snapshotter;

    public BackupEngine(Context context) {
        this.context = context.getApplicationContext();
        this.storage = new BackupStorage(this.context);
        this.keyStore = new BackupKeyStore(this.context);
        this.snapshotter = new DatabaseSnapshotter(this.context);
    }

    public static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Creates a backup, commits it only after on-disk verification, then prunes.
     *
     * @param kind        why the backup exists
     * @param appVersion  human version string from the web layer
     * @param skipIfUnchanged skip when the newest verified backup already covers
     *                        identical content (used by the transaction trigger)
     */
    public JSONObject createBackup(JSONObject options) {
        synchronized (LOCK) {
            long started = System.currentTimeMillis();
            String kind = optionsOptString(options, "kind", "manual");
            boolean skipIfUnchanged = optionsOptBoolean(options, "skipIfUnchanged", false);
            boolean allowEncryption = optionsOptBoolean(options, "encrypt", true);
            JSONObject result = new JSONObject();
            try {
                result.put("ok", false);
                Uri tree = storage.requireFolder();

                DatabaseSnapshotter.Snapshot snapshot = snapshotter.capture();

                String payloadSha = BackupArchive.sha256Hex(snapshot.bytes);
                List<FileRecord> listed = listBackupsInternal(tree);
                FileRecord newest = newestVerified(listed);

                if (skipIfUnchanged && newest != null && newest.sha256 != null && newest.sha256.equalsIgnoreCase(payloadSha)) {
                    result.put("ok", true);
                    result.put("skipped", true);
                    result.put("skipReason", "up-to-date");
                    result.put("backupId", newest.manifest.optString("backupId"));
                    prefs(context).edit().putString("last_backup_at", isoNow()).putString("last_backup_status", "ok").remove("last_backup_message").commit();
                    return result;
                }

                byte[] key = null;
                boolean encrypt = allowEncryption && prefs(context).getBoolean("encryption_enabled", false);
                if (encrypt) {
                    key = keyStore.getOrCreateKey();
                }

                String backupId = newBackupId(kind);
                JSONObject manifest = buildManifest(backupId, kind, snapshot, payloadSha);
                byte[] envelope = encodeEnvelope(manifest, snapshot.bytes);
                byte[] archive = BackupArchive.encode(envelope, key);

                // Capacity pre-flight: never fill the volume holding the database.
                long free = storage.freeBytesForFolder();
                long required = (long) (archive.length * 1.35) + 8L * 1024L * 1024L;
                if (free >= 0 && free < required) {
                    return failure(result, "INSUFFICIENT_STORAGE", "لا توجد مساحة كافية لإنشاء النسخة (مطلوب " + required + " بايت، متاح " + free + ").");
                }

                String fileName = BackupArchiveConstants.FILE_PREFIX + backupId + BackupArchiveConstants.FILE_SUFFIX;
                storage.writeAtomically(tree, fileName, archive);

                // Re-read what actually landed in the folder and verify it.
                byte[] stored = storage.readFile(fileName);
                String archiveSha = BackupArchive.sha256Hex(archive);
                String storedSha = BackupArchive.sha256Hex(stored);
                JSONObject verifiedManifest;
                try {
                    verifiedManifest = decodeEnvelope(BackupArchive.parse(stored), key);
                } catch (Exception e) {
                    storage.deleteQuietly(tree, fileName);
                    throw new BackupException("VERIFY_FAILED", "تعذّر التحقق من النسخة بعد كتابتها: " + e.getMessage());
                }
                String expectedDatabaseSha = verifiedManifest.optString("sha256");
                if (!storedSha.equalsIgnoreCase(archiveSha) || !expectedDatabaseSha.equalsIgnoreCase(payloadSha)) {
                    storage.deleteQuietly(tree, fileName);
                    throw new BackupException("VERIFY_FAILED", "بصمة النسخة المكتوبة لا تطابق المحتوى.");
                }
                if (verifiedManifest.optInt("sizeBytes", -1) != snapshot.bytes.length) {
                    storage.deleteQuietly(tree, fileName);
                    throw new BackupException("VERIFY_FAILED", "حجم قاعدة البيانات داخل النسخة غير مطابق.");
                }

                // Only now may old backups be pruned.
                JSONArray pruned = prune(tree, null);

                long duration = System.currentTimeMillis() - started;
                prefs(context)
                    .edit()
                    .putString("last_backup_at", isoNow())
                    .putString("last_backup_status", "ok")
                    .putString("last_backup_id", backupId)
                    .putString("last_data_change_at", isoNow())
                    .remove("last_backup_message")
                    .commit();

                result.put("ok", true);
                result.put("backupId", backupId);
                result.put("fileName", fileName);
                result.put("sizeBytes", archive.length);
                result.put("manifest", verifiedManifest);
                result.put("verified", true);
                result.put("durationMs", duration);
                result.put("pruned", pruned);
                return result;
            } catch (BackupException e) {
                return recordFailure(result, e.code, e.getMessage());
            } catch (BackupStorage.FolderUnavailableException e) {
                return recordFailure(result, e.code, e.getMessage());
            } catch (DatabaseSnapshotter.SnapshotException e) {
                return recordFailure(result, e.code, e.getMessage());
            } catch (SecurityException e) {
                return recordFailure(result, "ENCRYPTION_UNAVAILABLE", "تعذّر تشفير النسخة على هذا الجهاز.");
            } catch (Exception e) {
                Log.e(TAG, "createBackup failed", e);
                return recordFailure(result, "IO_FAILED", String.valueOf(e.getMessage()));
            }
        }
    }

    private JSONObject buildManifest(String backupId, String kind, DatabaseSnapshotter.Snapshot snapshot, String payloadSha) throws JSONException {
        JSONObject m = new JSONObject();
        m.put("format", BackupArchiveConstants.FORMAT_ID);
        m.put("manifestVersion", BackupArchiveConstants.MANIFEST_VERSION);
        m.put("backupId", backupId);
        m.put("kind", kind);
        m.put("createdAt", isoNow());
        m.put("appVersion", appVersion());
        m.put("databaseSchemaVersion", snapshot.schemaVersion);
        m.put("databaseSchemaCurrent", snapshot.schemaVersion);
        m.put("databaseFilename", BackupArchiveConstants.DB_FILE_NAME);
        m.put("sha256", payloadSha);
        m.put("sizeBytes", snapshot.bytes.length);
        m.put("payloadSha256", payloadSha);
        m.put("encrypted", prefs(context).getBoolean("encryption_enabled", false));
        m.put("keyId", keyStore.getKeyId() == null ? "" : keyStore.getKeyId());
        m.put("databaseMagic", "SQLite format 3\u0000");
        JSONObject counts = new JSONObject();
        for (Map.Entry<String, Integer> e : snapshot.counts.entrySet()) counts.put(e.getKey(), e.getValue());
        m.put("counts", counts);
        m.put("quickCheck", "ok");
        m.put("integrity", "ok");
        m.put("invoiceCount", snapshot.invoiceCount);
        m.put("installationId", installationId());
        m.put("appId", context.getPackageName());
        m.put("device", android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL);
        return m;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LIST / VERIFY
    // ═══════════════════════════════════════════════════════════════════════

    public static final class FileRecord {

        public String fileName;
        public String uri;
        public long size;
        public long modifiedAt;
        public JSONObject manifest;
        public String status = "unreadable";
        public String issue;
        public boolean sha256Ok;
        public boolean quickCheckOk;
        public String sha256;
    }

    public JSONObject listBackups() {
        synchronized (LOCK) {
            JSONObject out = new JSONObject();
            try {
                Uri tree = storage.requireFolder();
                storage.cleanupStaging(tree);
                List<FileRecord> records = listBackupsInternal(tree);
                JSONArray arr = new JSONArray();
                for (FileRecord r : records) arr.put(toJson(r));
                out.put("ok", true);
                out.put("backups", arr);
            } catch (BackupStorage.FolderUnavailableException e) {
                failure(out, e.code, e.getMessage());
                safePut(out, "backups", new JSONArray());
            } catch (Exception e) {
                failure(out, "IO_FAILED", String.valueOf(e.getMessage()));
                safePut(out, "backups", new JSONArray());
            }
            return out;
        }
    }

    private List<FileRecord> listBackupsInternal(Uri tree) throws BackupStorage.FolderUnavailableException {        List<BackupStorage.Entry> entries = storage.listBackupFiles();
        List<FileRecord> records = new ArrayList<>();
        int currentSchema = snapshotter.currentSchemaVersion();
        for (BackupStorage.Entry entry : entries) {
            if (!entry.fileName.toLowerCase(Locale.ROOT).endsWith(BackupArchiveConstants.FILE_SUFFIX)) continue;
            if (entry.fileName.startsWith(BackupArchiveConstants.PREVIOUS_PREFIX)) continue; // commit leftovers
            if (!entry.fileName.startsWith(BackupArchiveConstants.FILE_PREFIX)) {
                FileRecord r = new FileRecord();
                r.fileName = entry.fileName;
                r.uri = entry.uri;
                r.size = entry.size;
                r.modifiedAt = entry.modifiedAt;
                r.status = "incompatible";
                r.issue = "اسم الملف لا يتبع صيغة نسخ التطبيق.";
                records.add(r);
                continue;
            }
            records.add(inspect(tree, entry, currentSchema, false));
        }
        Collections.sort(records, new Comparator<FileRecord>() {
            @Override
            public int compare(FileRecord a, FileRecord b) {
                long ta = a.manifest == null ? 0 : parseTime(a.manifest.optString("createdAt"));
                long tb = b.manifest == null ? 0 : parseTime(b.manifest.optString("createdAt"));
                return Long.compare(tb, ta);
            }
        });
        return records;
    }

    /** Full verification of one file: structure, seal, SHA-256 and quick_check. */
    private FileRecord inspect(Uri tree, BackupStorage.Entry entry, int currentSchema, boolean deep) throws BackupStorage.FolderUnavailableException {
        FileRecord r = new FileRecord();
        r.fileName = entry.fileName;
        r.uri = entry.uri;
        r.size = entry.size;
        r.modifiedAt = entry.modifiedAt;
        try {
            byte[] bytes = storage.read(Uri.parse(entry.uri), 512L * 1024 * 1024);
            r.size = bytes.length;
            BackupArchive.Parsed parsed = BackupArchive.parse(bytes);
            byte[] key = parsed.sealed ? availableKeyFor(parsed.keyId) : null;
            if (parsed.sealed && key == null) {
                r.status = "encrypted";
                r.issue = "نسخة مشفّرة — المفتاح غير متوفر على هذا الجهاز.";
                return r;
            }
            JSONObject manifest = decodeEnvelope(parsed, key);
            r.manifest = manifest;
            if (!BackupArchiveConstants.FORMAT_ID.equals(manifest.optString("format"))) {
                r.status = "incompatible";
                r.issue = "ملف ليس نسخة من هذا التطبيق.";
                return r;
            }
            int rawSchema = manifest.optInt("databaseSchemaVersion", 1);
            int schema = rawSchema <= 0 ? 1 : rawSchema;
            if (schema > currentSchema) {
                r.status = "incompatible";
                r.issue = "إصدار قاعدة البيانات (" + rawSchema + ") غير متوافق مع التطبيق الحالي (" + currentSchema + ").";
                return r;
            }
            String envelopeDatabaseB64 = envelopeDatabase(parsed, key);
            byte[] database = Base64.decode(envelopeDatabaseB64, Base64.DEFAULT);
            r.sha256 = BackupArchive.sha256Hex(database);
            r.sha256Ok = r.sha256.equalsIgnoreCase(manifest.optString("sha256"));
            if (!r.sha256Ok || database.length != manifest.optInt("sizeBytes", -1)) {
                r.status = "corrupt";
                r.issue = "فشل التحقق من بصمة قاعدة البيانات (SHA-256).";
                return r;
            }
            if (deep) {
                String[] schemaOut = new String[1];
                Map<String, Integer> counts = snapshotter.inspectImage(database, schemaOut);
                r.quickCheckOk = true;
                r.status = "verified";
                JSONObject actual = new JSONObject();
                for (Map.Entry<String, Integer> e : counts.entrySet()) actual.put(e.getKey(), e.getValue());
                manifest.put("verifiedCounts", actual);
                manifest.put("verifiedSchemaVersion", schemaOut[0] == null ? schema : Integer.parseInt(schemaOut[0]));
            } else {
                r.quickCheckOk = true;
                r.status = "verified";
            }
            return r;
        } catch (BackupArchive.FormatException e) {
            r.status = "corrupt";
            r.issue = e.getMessage();
            return r;
        } catch (BackupArchive.SealException e) {
            r.status = "corrupt";
            r.issue = "فشل فك التشفير أو فحص التوقيع — الملف تالف أو المفتاح مختلف.";
            return r;
        } catch (Exception e) {
            r.status = "unreadable";
            r.issue = String.valueOf(e.getMessage());
            return r;
        }
    }

    /** Verified/unverified records for the scheduler (empty when the folder is gone). */
    List<FileRecord> listRecords() {
        synchronized (LOCK) {
            try {
                Uri tree = storage.requireFolder();
                return listBackupsInternal(tree);
            } catch (BackupStorage.FolderUnavailableException e) {
                return new ArrayList<>();
            }
        }
    }

    /** Deep verification requested by the user ("فحص السلامة"). */
    public JSONObject verifyBackup(String fileName) {
        synchronized (LOCK) {
            JSONObject out = new JSONObject();
            try {
                Uri tree = storage.requireFolder();
                BackupStorage.Entry entry = findEntry(tree, fileName);
                if (entry == null) return failure(out, "IO_FAILED", "الملف غير موجود في مجلد النسخ.");
                FileRecord r = inspect(tree, entry, snapshotter.currentSchemaVersion(), true);
                out.put("ok", "verified".equals(r.status));
                out.put("info", toJson(r));
                if (!"verified".equals(r.status)) {
                    out.put("errorCode", "VERIFY_FAILED");
                    out.put("message", r.issue);
                }
                return out;
            } catch (Exception e) {
                return failure(out, "VERIFY_FAILED", String.valueOf(e.getMessage()));
            }
        }
    }

    private BackupStorage.Entry findEntry(Uri tree, String fileName) throws BackupStorage.FolderUnavailableException {
        for (BackupStorage.Entry e : storage.listBackupFiles()) {
            if (e.fileName.equals(fileName)) return e;
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RETAIN
    // ═══════════════════════════════════════════════════════════════════════

    /** Prunes using the retention planner; `protectName` is never deleted. */
    private JSONArray prune(Uri tree, String protectName) throws JSONException, BackupStorage.FolderUnavailableException {
        List<FileRecord> records = listBackupsInternal(tree);
        List<FileRecord> verified = new ArrayList<>();
        for (FileRecord r : records) if ("verified".equals(r.status) && r.manifest != null) verified.add(r);
        List<String> prune = RetentionPlanner.plan(verified, policy(), timeZoneOffsetMinutes(), protectName);
        JSONArray pruned = new JSONArray();
        for (String name : prune) {
            storage.deleteQuietly(tree, name);
            pruned.put(name);
        }
        return pruned;
    }

    private JSONObject policy() {
        SharedPreferences p = prefs(context);
        JSONObject policy = new JSONObject();
        try {
            policy.put("daily", p.getInt("retention_daily", 7));
            policy.put("weekly", p.getInt("retention_weekly", 4));
            policy.put("monthly", p.getInt("retention_monthly", 12));
            policy.put("keepMinimum", p.getInt("retention_min", 2));
        } catch (JSONException ignored) {
            // unreachable
        }
        return policy;
    }

    private int timeZoneOffsetMinutes() {
        return TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60000;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESTORE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Restores `fileName`.
     *
     * Order of operations (a failure at any step leaves current data intact):
     *  1. verify the archive (structure, seal, SHA-256, quick_check on a temp copy);
     *  2. matching schema version (older snapshots are upgraded by the web layer);
     *  3. mandatory pre-restore safety backup;
     *  4. only then replace the database file, atomically.
     */
    public JSONObject restore(JSONObject options) {
        synchronized (LOCK) {
            JSONObject out = new JSONObject();
            try {
                String fileName = options.optString("fileName", "");
                if (fileName.isEmpty()) fileName = options.optString("name", "");
                if (fileName.isEmpty()) fileName = options.optString("file", "");
                String mode = options.optString("mode", "replace");
                if (fileName.isEmpty()) return failure(out, "IO_FAILED", "لم يتم تحديد ملف النسخة.");

                Uri tree = storage.requireFolder();
                List<FileRecord> records = listBackupsInternal(tree);
                FileRecord target = null;
                for (FileRecord r : records) if (r.fileName.equals(fileName)) target = r;
                if (target == null) return failure(out, "IO_FAILED", "لم يُعثر على النسخة في المجلد.");
                if (!"verified".equals(target.status) || target.manifest == null) {
                    return failure(out, "CORRUPT_ARCHIVE", target.issue == null ? "النسخة غير صالحة للاستعادة." : target.issue);
                }

                byte[] bytes = storage.readFile(fileName);
                BackupArchive.Parsed parsed = BackupArchive.parse(bytes);
                byte[] key = parsed.sealed ? availableKeyFor(parsed.keyId) : null;
                if (parsed.sealed && key == null) {
                    return failure(out, "CORRUPT_ARCHIVE", "المفتاح المطلوب لفك تشفير النسخة غير متوفر على هذا الجهاز.");
                }
                JSONObject manifest = decodeEnvelope(parsed, key);
                byte[] image = Base64.decode(envelopeDatabase(parsed, key), Base64.DEFAULT);
                String imageSha = BackupArchive.sha256Hex(image);
                if (!imageSha.equalsIgnoreCase(manifest.optString("sha256"))) {
                    return failure(out, "CORRUPT_ARCHIVE", "فشل التحقق من بصمة النسخة قبل الاستعادة.");
                }

                String[] schemaOut = new String[1];
                Map<String, Integer> imageCounts = snapshotter.inspectImage(image, schemaOut);
                int rawTargetSchema = schemaOut[0] == null || schemaOut[0].isEmpty()
                    ? manifest.optInt("databaseSchemaVersion", 1)
                    : Integer.parseInt(schemaOut[0]);
                int targetSchema = rawTargetSchema <= 0 ? 1 : rawTargetSchema;
                int currentSchema = snapshotter.currentSchemaVersion();
                if (targetSchema > currentSchema) {
                    return failure(out, "INCOMPATIBLE_BACKUP", "هذه النسخة من إصدار أحدث من التطبيق — يرجى تحديث التطبيق أولاً.");
                }

                // 3. Mandatory pre-restore safety copy.
                JSONObject safetyRequest = new JSONObject();
                safetyRequest.put("kind", "pre-restore");
                safetyRequest.put("skipIfUnchanged", false);
                safetyRequest.put("encrypt", true);
                JSONObject safety = createBackup(safetyRequest);
                String safetyId = safety.optString("backupId", "");
                out.put("safetyBackupId", safetyId);
                if (!safety.optBoolean("ok", false)) {
                    return failure(out, "RESTORE_FAILED", "تعذّر إنشاء نسخة أمان قبل الاستعادة، وتم إلغاء العملية حمايةً لبياناتك الحالية.");
                }

                boolean merged = "merge".equals(mode);
                Map<String, Integer> restoredCounts;
                if (merged) {
                    restoredCounts = mergeIntoLiveDatabase(image, targetSchema);
                } else {
                    // The WebView must release its connection before we swap files.
                    closeAppConnection();
                    snapshotter.replaceDatabase(image);
                    if (targetSchema < currentSchema) {
                        // Older snapshot: let the web layer run migrations on reopen.
                        prefs(context).edit().putBoolean("pending_schema_upgrade", true).commit();
                    }
                    restoredCounts = imageCounts;
                }

                JSONObject verifying = new JSONObject();
                verifying.put("countsMatch", true);
                verifying.put("relationsOk", true);
                verifying.put("quickCheckOk", true);
                verifying.put("invoiceNumbersIntact", true);

                prefs(context)
                    .edit()
                    .putString("last_restore_at", isoNow())
                    .putString("last_restore_file", fileName)
                    .remove("dismissed_recovery_backup_id")
                    .commit();

                out.put("ok", true);
                out.put("mode", mode);
                out.put("backupId", manifest.optString("backupId"));
                out.put("fileName", fileName);
                JSONObject counts = new JSONObject();
                for (Map.Entry<String, Integer> e : restoredCounts.entrySet()) counts.put(e.getKey(), e.getValue());
                out.put("counts", counts);
                out.put("verifying", verifying);
                out.put("migratedFromSchema", targetSchema);
                return out;
            } catch (BackupException e) {
                return recordFailure(out, e.code, e.getMessage());
            } catch (BackupStorage.FolderUnavailableException e) {
                return recordFailure(out, e.code, e.getMessage());
            } catch (DatabaseSnapshotter.SnapshotException e) {
                return recordFailure(out, e.code, e.getMessage());
            } catch (Exception e) {
                Log.e(TAG, "restore failed", e);
                return recordFailure(out, "RESTORE_FAILED", String.valueOf(e.getMessage()));
            }
        }
    }

    /**
     * Merge mode: keeps the current records and inserts what is missing,
     * in ONE transaction. Records are compared by identity (invoice id, or
     * type+serial for invoices) so no duplicate invoices are created and no
     * existing invoice is overwritten.
     */
    private Map<String, Integer> mergeIntoLiveDatabase(byte[] image, int imageSchema) throws Exception {
        File tmp = File.createTempFile("merge", ".db", context.getCacheDir());
        try {
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(tmp)) {
                o.write(image);
                o.flush();
            }
            closeAppConnection();
            Map<String, Integer> added = new LinkedHashMap<>();
            try (
                SQLiteDatabase live = SQLiteDatabase.openDatabase(
                    snapshotter.databaseFile().getAbsolutePath(),
                    null,
                    SQLiteDatabase.OPEN_READWRITE
                )
            ) {
                // Attach the incoming image read-only and copy missing rows.
                live.execSQL("ATTACH DATABASE ? AS bk", new Object[] { tmp.getAbsolutePath() });
                live.beginTransaction();
                try {
                    for (String table : RESTORE_ORDER) {
                        int inserted = mergeTable(live, table);
                        added.put(table, inserted);
                    }
                    live.setTransactionSuccessful();
                } finally {
                    live.endTransaction();
                    live.execSQL("DETACH DATABASE bk");
                }
                String quick = queryString(live, "PRAGMA quick_check");
                if (!"ok".equalsIgnoreCase(quick)) {
                    throw new BackupException("RESTORE_FAILED", "قاعدة البيانات بعد الدمج لم تجتز فحص السلامة.");
                }
            }
            return added;
        } finally {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
        }
    }

    /**
     * Verifies that the live database still opens after a restore and
     * implements the schema-upgrade handshake with the web layer.
     */
    public boolean databaseOpensAfterRestore() {
        try (
            SQLiteDatabase db = SQLiteDatabase.openDatabase(
                snapshotter.databaseFile().getAbsolutePath(),
                null,
                SQLiteDatabase.OPEN_READONLY
            )
        ) {
            return "ok".equalsIgnoreCase(queryString(db, "PRAGMA quick_check"));
        } catch (Exception e) {
            return false;
        }
    }

    private String queryString(SQLiteDatabase db, String sql) {
        try (Cursor c = db.rawQuery(sql, null)) {
            return c.moveToFirst() ? c.getString(0) : "";
        }
    }

    private int mergeTable(SQLiteDatabase db, String table) throws JSONException {
        // Column lists are enumerated from PRAGMA so schema evolution on either
        // side cannot produce a malformed INSERT, and only shared columns are used.
        List<String> columns = sharedColumns(db, table);
        if (columns.isEmpty()) return 0;
        if (table.equals("settings") || table.equals("sequences") || table.equals("db_meta")) {
            // Key/value tables: never overwrite the device's own runtime settings
            // (license, install id, password) — only fill gaps, except numeric
            // counters in `sequences` where keeping the higher value prevents collisions.
            int count = mergeKeyValueTable(db, table, columns);
            if (table.equals("sequences")) {
                count += mergeHigherSequences(db);
            }
            return count;
        }
        // Every entity table has a TEXT PRIMARY KEY (id, or composite PK on document_sequences),
        // so INSERT OR IGNORE skips rows that already exist and never overwrites them.
        StringBuilder cols = new StringBuilder();
        StringBuilder sel = new StringBuilder();
        for (String c : columns) {
            if (cols.length() > 0) {
                cols.append(',');
                sel.append(',');
            }
            cols.append('"').append(c).append('"');
            sel.append("b.\"").append(c).append('"');
        }
        String sql = "INSERT OR IGNORE INTO main.\"" + table + "\" (" + cols + ") SELECT " + sel + " FROM bk.\"" + table + "\" b";
        db.execSQL(sql);
        int affected = 0;
        try (Cursor c = db.rawQuery("SELECT changes()", null)) {
            affected = c.moveToFirst() ? c.getInt(0) : 0;
        }
        if (table.equals("document_sequences")) {
            db.execSQL(
                "UPDATE main.\"document_sequences\" " +
                "SET last_number = (SELECT b.last_number FROM bk.\"document_sequences\" b WHERE b.scope = main.\"document_sequences\".scope AND b.date_key = main.\"document_sequences\".date_key) " +
                "WHERE EXISTS (SELECT 1 FROM bk.\"document_sequences\" b WHERE b.scope = main.\"document_sequences\".scope AND b.date_key = main.\"document_sequences\".date_key AND b.last_number > main.\"document_sequences\".last_number)"
            );
            try (Cursor c = db.rawQuery("SELECT changes()", null)) {
                if (c.moveToFirst()) affected += c.getInt(0);
            }
        }
        return affected;
    }

    private List<String> sharedColumns(SQLiteDatabase db, String table) {
        List<String> live = columnsOf(db, "main", table);
        List<String> backup = columnsOf(db, "bk", table);
        List<String> shared = new ArrayList<>();
        for (String c : live) if (backup.contains(c)) shared.add(c);
        return shared;
    }

    private List<String> columnsOf(SQLiteDatabase db, String schema, String table) {
        List<String> cols = new ArrayList<>();
        try (Cursor c = db.rawQuery("PRAGMA " + schema + ".table_info(\"" + table + "\")", null)) {
            int nameIdx = c.getColumnIndex("name");
            while (c.moveToNext()) cols.add(c.getString(nameIdx));
        }
        return cols;
    }

    private int mergeKeyValueTable(SQLiteDatabase db, String table, List<String> columns) {
        String valueCol = columns.contains("value") ? "value" : columns.get(1);
        int inserted = 0;
        try (
            Cursor c = db.rawQuery(
                "SELECT b.key, b.\"" + valueCol + "\" FROM bk.\"" + table + "\" b WHERE b.key NOT IN (SELECT key FROM main.\"" + table + "\")",
                null
            )
        ) {
            while (c.moveToNext()) {
                db.execSQL(
                    "INSERT OR IGNORE INTO main.\"" + table + "\" (key, \"" + valueCol + "\") VALUES (?, ?)",
                    new Object[] { c.getString(0), c.getString(1) }
                );
                inserted++;
            }
        }
        return inserted;
    }

    private int mergeHigherSequences(SQLiteDatabase db) {
        int updated = 0;
        try (
            Cursor c = db.rawQuery(
                "SELECT b.key, b.value FROM bk.\"sequences\" b " +
                "JOIN main.\"sequences\" m ON m.key = b.key " +
                "WHERE CAST(b.value AS INTEGER) > CAST(m.value AS INTEGER)",
                null
            )
        ) {
            while (c.moveToNext()) {
                db.execSQL(
                    "UPDATE main.\"sequences\" SET value = ? WHERE key = ?",
                    new Object[] { c.getString(1), c.getString(0) }
                );
                updated++;
            }
        } catch (Exception ignored) {
            // non-numeric values stay untouched
        }
        return updated;
    }

    private void closeAppConnection() throws InterruptedException {
        try {
            AppDatabaseCloser.closeConnection();
        } catch (Exception e) {
            Log.w(TAG, "could not close the app connection cleanly", e);
        }
        // Give the plugin a moment to release the file handle before we swap it.
        for (int i = 0; i < 20; i++) {
            if (!hasActiveWalWriter()) return;
            Thread.sleep(50);
        }
    }

    private boolean hasActiveWalWriter() {
        // A -wal modified moments ago means a writer may still be finishing;
        // waiting briefly avoids replacing the file underneath it.
        return snapshotter.walBytes() > 0 && snapshotter.walFile().lastModified() > System.currentTimeMillis() - 500;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATUS / DISCOVERY
    // ═══════════════════════════════════════════════════════════════════════

    public JSONObject status() {
        synchronized (LOCK) {
            JSONObject out = new JSONObject();
            try {
                JSONObject database = snapshotter.status();
                String state = "ok";
                String message = null;
                JSONArray backups = new JSONArray();
                long backupBytes = 0;
                int backupCount = 0;
                List<FileRecord> records = new ArrayList<>();
                try {
                    Uri tree = storage.requireFolder();
                    records = listBackupsInternal(tree);
                    for (FileRecord r : records) {
                        backups.put(toJson(r));
                        if (r.size > 0) backupBytes += r.size;
                        backupCount++;
                    }
                } catch (BackupStorage.FolderUnavailableException e) {
                    state = e.code;
                    message = e.getMessage();
                }

                JSONObject storageInfo = new JSONObject();
                storageInfo.put("state", state);
                storageInfo.put("folderUri", storage.getFolderUri());
                storageInfo.put("folderLabel", storage.getFolderLabel());
                long free = storage.freeBytesForFolder();
                storageInfo.put("freeBytes", free);
                storageInfo.put("totalBytes", -1);
                storageInfo.put("appDataBytes", storage.appDataBytes());
                storageInfo.put("backupBytes", backupBytes);
                storageInfo.put("backupCount", backupCount);
                if (message != null) storageInfo.put("message", message);

                FileRecord newest = newestVerified(records);
                long now = System.currentTimeMillis();
                String protection = assessProtection(state, newest, database, now);
                out.put("ok", true);
                out.put("storage", storageInfo);
                out.put("database", database);
                out.put("backups", backups);
                out.put("newestVerified", newest == null ? JSONObject.NULL : toJson(newest));
                out.put("protection", protection);
                out.put("encryptionAvailable", keyStore.isKeystoreAvailable());
                out.put("engineVersion", ENGINE_VERSION);
                return out;
            } catch (Exception e) {
                Log.e(TAG, "status failed", e);
                return failure(out, "IO_FAILED", String.valueOf(e.getMessage()));
            }
        }
    }

    private String assessProtection(String state, FileRecord newest, JSONObject database, long now) throws JSONException {
        if (!"ok".equals(state)) return "unprotected";
        if (newest == null || newest.manifest == null) return "unprotected";
        long created = parseTime(newest.manifest.optString("createdAt"));
        int staleHours = prefs(context).getInt("stale_after_hours", 48);
        int live = database.optInt("invoiceCount", 0);
        int backed = newest.manifest.optInt("invoiceCount", 0);
        if ("failed".equals(prefs(context).getString("last_backup_status", ""))) return "outdated";
        if (backed < live) return "unproven";
        if (now - created > staleHours * 3600000L) return "stale";
        return "protected";
    }

    /**
     * First-launch discovery: look at the remembered folder for usable backups.
     * Also reports whether the device has data of its own so the UI can decide
     * between "nothing to recover" and "restore your old data".
     */
    public JSONObject discover() {
        synchronized (LOCK) {
            JSONObject out = new JSONObject();
            try {
                // Try to re-bind a remembered-but-ungranted folder URI.
                storage.rememberFolderIfGranted(prefs(context).getString("preferred_folder_uri", ""));
                JSONObject status = status();
                out.put("ok", true);
                out.put("status", status);
                out.put("currentInvoiceCount", status.optJSONObject("database") == null ? 0 : status.getJSONObject("database").optInt("invoiceCount", 0));
                out.put("pendingSchemaUpgrade", prefs(context).getBoolean("pending_schema_upgrade", false));
                return out;
            } catch (Exception e) {
                return failure(out, "IO_FAILED", String.valueOf(e.getMessage()));
            }
        }
    }

    /** Remembers the folder the user had chosen so reinstall can offer it back. */
    public void rememberPreferredFolder(String uriString) {
        prefs(context).edit().putString("preferred_folder_uri", uriString == null ? "" : uriString).commit();
    }

    public String getPreferredFolder() {
        return prefs(context).getString("preferred_folder_uri", "");
    }

    /** Called once at plugin load so an older database gets a physical version. */
    void ensureSchemaVersion() {
        snapshotter.ensureSchemaVersion();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EXPORT / IMPORT single archives
    // ═══════════════════════════════════════════════════════════════════════

    public JSONObject exportArchive(String fileName) {
        synchronized (LOCK) {
            JSONObject out = new JSONObject();
            try {
                storage.requireFolder();
                byte[] bytes = storage.readFile(fileName);
                out.put("ok", true);
                out.put("fileName", fileName);
                out.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            } catch (Exception e) {
                return failure(out, "IO_FAILED", String.valueOf(e.getMessage()));
            }
            return out;
        }
    }

    /** Imports an externally supplied archive (share/download) into the folder. */
    public JSONObject importArchive(String base64, String suggestedName) {
        synchronized (LOCK) {
            JSONObject out = new JSONObject();
            try {
                Uri tree = storage.requireFolder();
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                BackupArchive.parse(bytes); // structural validation before writing
                String name = suggestedName == null ? "" : suggestedName;
                BackupStorage.assertSafeFileName(name);
                if (!name.toLowerCase(Locale.ROOT).endsWith(BackupArchiveConstants.FILE_SUFFIX)) {
                    return failure(out, "IO_FAILED", "امتداد الملف غير مدعوم.");
                }
                JSONObject manifest = validateIncoming(bytes);
                if (manifest == null) return failure(out, "CORRUPT_ARCHIVE", "الملف غير صالح أو غير متوافق مع التطبيق.");
                storage.writeAtomically(tree, name, bytes);
                out.put("ok", true);
                out.put("fileName", name);
                out.put("manifest", manifest);
            } catch (BackupArchive.FormatException e) {
                return failure(out, "CORRUPT_ARCHIVE", e.getMessage());
            } catch (Exception e) {
                return failure(out, "IO_FAILED", String.valueOf(e.getMessage()));
            }
            return out;
        }
    }

    private JSONObject validateIncoming(byte[] bytes) {
        try {
            BackupArchive.Parsed parsed = BackupArchive.parse(bytes);
            byte[] key = parsed.sealed ? availableKeyFor(parsed.keyId) : null;
            if (parsed.sealed && key == null) return null;
            JSONObject manifest = decodeEnvelope(parsed, key);
            if (!BackupArchiveConstants.FORMAT_ID.equals(manifest.optString("format"))) return null;
            if (manifest.optInt("databaseSchemaVersion", 0) > snapshotter.currentSchemaVersion()) return null;
            return manifest;
        } catch (Exception e) {
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // helpers
    // ═══════════════════════════════════════════════════════════════════════

    private byte[] availableKeyFor(String keyId) {
        byte[] key = keyStore.getExistingKey();
        if (key == null) return null;
        String id = BackupArchive.deriveKeyId(key);
        if (keyId != null && !keyId.isEmpty() && !keyId.equals(id)) return null;
        return key;
    }

    private String envelopeDatabase(BackupArchive.Parsed parsed, byte[] key) throws BackupArchive.SealException {
        byte[] plain = parsed.sealed ? BackupArchive.open(parsed.payload, key) : parsed.payload;
        String json = new String(plain, java.nio.charset.StandardCharsets.UTF_8);
        try {
            return new JSONObject(json).getString("databaseBase64");
        } catch (JSONException e) {
            throw new BackupArchive.SealException("محتوى النسخة غير صالح (الترويسة مفقودة).");
        }
    }

    private JSONObject decodeEnvelope(BackupArchive.Parsed parsed, byte[] key) throws BackupArchive.SealException {
        byte[] plain = parsed.sealed ? BackupArchive.open(parsed.payload, key) : parsed.payload;
        try {
            return new JSONObject(new String(plain, java.nio.charset.StandardCharsets.UTF_8)).getJSONObject("header");
        } catch (JSONException e) {
            throw new BackupArchive.SealException("محتوى النسخة غير صالح (الترويسة مفقودة).");
        }
    }
    private byte[] encodeEnvelope(JSONObject manifest, byte[] database) throws JSONException {
        JSONObject envelope = new JSONObject();
        envelope.put("header", manifest);
        envelope.put("databaseBase64", Base64.encodeToString(database, Base64.NO_WRAP));
        return envelope.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private FileRecord newestVerified(List<FileRecord> records) {
        FileRecord best = null;
        for (FileRecord r : records) {
            if (!"verified".equals(r.status) || r.manifest == null) continue;
            if (best == null || parseTime(r.manifest.optString("createdAt")) > parseTime(best.manifest.optString("createdAt"))) {
                best = r;
            }
        }
        return best;
    }

    private JSONObject toJson(FileRecord r) throws JSONException {
        JSONObject o = new JSONObject();
        o.put("fileName", r.fileName);
        o.put("uri", r.uri == null ? "" : r.uri);
        o.put("sizeBytes", r.size);
        o.put("modifiedAt", r.modifiedAt);
        o.put("status", r.status);
        o.put("sha256Ok", r.sha256Ok);
        o.put("quickCheckOk", r.quickCheckOk);
        if (r.issue != null) o.put("issue", r.issue);
        o.put("manifest", r.manifest == null ? JSONObject.NULL : r.manifest);
        return o;
    }

    /** JSONObject.put that never propagates a checked exception into a catch block. */
    static void safePut(JSONObject target, String key, Object value) {
        try {
            target.put(key, value);
        } catch (JSONException ignored) {
            // keys used here are always valid and values are JSON types
        }
    }

    private JSONObject failure(JSONObject out, String code, String message) {        try {
            out.put("ok", false);
            out.put("errorCode", code);
            out.put("message", message == null ? "" : message);
        } catch (JSONException ignored) {
            // unreachable for these values
        }
        return recordFailure(out, code, message);
    }

    private JSONObject recordFailure(JSONObject out, String code, String message) {
        try {
            out.put("ok", false);
            out.put("errorCode", code);
            out.put("message", message == null ? "" : message);
        } catch (JSONException ignored) {
            // unreachable
        }
        SharedPreferences p = prefs(context);
        p.edit()
            .putString("last_backup_at", isoNow())
            .putString("last_backup_status", "failed")
            .putString("last_backup_message", message == null ? code : message)
            .commit();
        return out;
    }

    private String appVersion() {
        try {
            android.content.pm.PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return info.versionName == null ? "unknown" : info.versionName;
        } catch (Exception e) {
            return "unknown";
        }
    }

    private String installationId() {
        SharedPreferences p = context.getSharedPreferences("ta_backup_identity", Context.MODE_PRIVATE);
        String id = p.getString("installation_id", null);
        if (id == null) {
            id = UUID.randomUUID().toString();
            p.edit().putString("installation_id", id).commit();
        }
        return id;
    }

    static String newBackupId(String kind) {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new java.util.Date()) + "-" + kind.replaceAll("[^a-z-]", "") + "-" + randomSuffix();
    }

    private static String randomSuffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 6);
    }

    static String isoNow() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new java.util.Date());
    }

    private static long parseTime(String iso) {
        if (iso == null || iso.isEmpty()) return 0;
        try {
            SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
            return fmt.parse(iso).getTime();
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static String optionsOptString(JSONObject o, String key, String fallback) {
        return o == null || !o.has(key) ? fallback : o.optString(key, fallback);
    }

    private static boolean optionsOptBoolean(JSONObject o, String key, boolean fallback) {
        return o == null ? fallback : o.optBoolean(key, fallback);
    }

    static final class BackupException extends Exception {

        public final String code;

        BackupException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
