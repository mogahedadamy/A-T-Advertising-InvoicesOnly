package com.futureprint.calculator.backup;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import org.json.JSONObject;

/**
 * Retention policy — Java port of src/lib/backup/retention.ts.
 *
 * Same invariants:
 *  1. Only daily / weekly / monthly backups are prunable.
 *  2. Manual, transaction, pre-update and pre-restore copies are never pruned.
 *  3. Only VERIFIED backups are candidates; unreadable files are left alone
 *     (one may still be recoverable by a future build).
 *  4. The newest `keepMinimum` files are always kept.
 *  5. The file being written right now (protectName) is never pruned.
 *
 * Buckets use the device's local calendar (offset is passed in from the caller),
 * matching the TypeScript implementation so both agree on period boundaries.
 */
final class RetentionPlanner {

    private RetentionPlanner() {}

    static List<String> plan(List<BackupEngine.FileRecord> verified, JSONObject policy, int offsetMinutes, String protectName) {
        int dailyLimit = policy.optInt("daily", 7);
        int weeklyLimit = policy.optInt("weekly", 4);
        int monthlyLimit = policy.optInt("monthly", 12);
        int keepMinimum = policy.optInt("keepMinimum", 2);

        List<BackupEngine.FileRecord> sorted = new ArrayList<>();
        for (BackupEngine.FileRecord r : verified) if (r.manifest != null) sorted.add(r);
        Collections.sort(sorted, new Comparator<BackupEngine.FileRecord>() {
            @Override
            public int compare(BackupEngine.FileRecord a, BackupEngine.FileRecord b) {
                return Long.compare(createdAt(b), createdAt(a)); // newest first
            }
        });

        Map<String, List<BackupEngine.FileRecord>> daily = new LinkedHashMap<>();
        Map<String, List<BackupEngine.FileRecord>> weekly = new LinkedHashMap<>();
        Map<String, List<BackupEngine.FileRecord>> monthly = new LinkedHashMap<>();

        for (BackupEngine.FileRecord r : sorted) {
            String kind = r.manifest.optString("kind", "");
            String iso = r.manifest.optString("createdAt", "");
            if ("daily".equals(kind) || "manual".equals(kind) || "transaction".equals(kind)) {
                add(daily, dailyKey(iso, offsetMinutes), r);
            } else if ("weekly".equals(kind)) {
                add(weekly, weeklyKey(iso, offsetMinutes), r);
            } else if ("monthly".equals(kind)) {
                add(monthly, monthlyKey(iso, offsetMinutes), r);
            }
        }

        List<String> candidates = new ArrayList<>();
        collectExpired(daily, dailyLimit, candidates);
        collectExpired(weekly, weeklyLimit, candidates);
        collectExpired(monthly, monthlyLimit, candidates);

        List<String> protectedNames = new ArrayList<>();
        for (int i = 0; i < Math.min(keepMinimum, sorted.size()); i++) {
            protectedNames.add(sorted.get(i).fileName);
        }
        if (protectName != null) protectedNames.add(protectName);

        final Map<String, Long> createdIndex = new LinkedHashMap<>();
        for (BackupEngine.FileRecord r : sorted) createdIndex.put(r.fileName, createdAt(r));

        List<String> prune = new ArrayList<>();
        for (String name : candidates) {
            if (protectedNames.contains(name) || prune.contains(name)) continue;
            prune.add(name);
        }
        // Oldest first: an interruption leaves the newest files behind.
        Collections.sort(prune, new Comparator<String>() {
            @Override
            public int compare(String a, String b) {
                Long ta = createdIndex.get(a);
                Long tb = createdIndex.get(b);
                return Long.compare(ta == null ? 0 : ta, tb == null ? 0 : tb);
            }
        });
        return prune;
    }

    private static void collectExpired(
        Map<String, List<BackupEngine.FileRecord>> buckets,
        int limit,
        List<String> out
    ) {
        List<String> keys = new ArrayList<>(buckets.keySet());
        Collections.sort(keys, Collections.<String>reverseOrder()); // newest period first
        for (int i = 0; i < keys.size(); i++) {
            if (i < limit) continue;
            for (BackupEngine.FileRecord r : buckets.get(keys.get(i))) out.add(r.fileName);
        }
    }

    private static void add(Map<String, List<BackupEngine.FileRecord>> map, String key, BackupEngine.FileRecord r) {
        List<BackupEngine.FileRecord> list = map.get(key);
        if (list == null) {
            list = new ArrayList<>();
            map.put(key, list);
        }
        list.add(r);
    }

    private static long createdAt(BackupEngine.FileRecord r) {
        return r.manifest == null ? 0 : parseIso(r.manifest.optString("createdAt", ""));
    }

    private static long parseIso(String iso) {
        if (iso == null || iso.isEmpty()) return 0;
        try {
            SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
            return fmt.parse(iso).getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    private static Calendar localCalendar(String iso, int offsetMinutes) {
        Calendar cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.US);
        cal.setFirstDayOfWeek(Calendar.MONDAY);
        cal.setMinimalDaysInFirstWeek(4);
        cal.setTimeInMillis(parseIso(iso) - offsetMinutes * 60000L);
        return cal;
    }

    static String dailyKey(String iso, int offsetMinutes) {
        Calendar c = localCalendar(iso, offsetMinutes);
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static String monthlyKey(String iso, int offsetMinutes) {
        Calendar c = localCalendar(iso, offsetMinutes);
        return String.format(Locale.US, "%04d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1);
    }

    /** ISO week key (Monday-based, week 1 contains Jan 4) — "2026-W46". */
    static String weeklyKey(String iso, int offsetMinutes) {
        Calendar c = localCalendar(iso, offsetMinutes);
        // Match the TypeScript ISO-week computation: the ISO year of the week.
        int weekYear = c.get(Calendar.YEAR);
        int week = c.get(Calendar.WEEK_OF_YEAR);
        int month = c.get(Calendar.MONTH) + 1;
        if (month == 1 && week >= 52) weekYear = weekYear - 1;
        if (month == 12 && week == 1) weekYear = weekYear + 1;
        return String.format(Locale.US, "%04d-W%02d", weekYear, week);
    }

    /** True when no verified backup of `kind` exists yet for the current period. */
    static boolean shouldCreate(String kind, long nowMs, List<BackupEngine.FileRecord> records, int offsetMinutes) {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        String currentIso = fmt.format(new Date(nowMs));
        String currentKey = keyOf(kind, currentIso, offsetMinutes);
        for (BackupEngine.FileRecord r : records) {
            if (r.manifest == null) continue;
            if (!"verified".equals(r.status)) continue;
            if (!kind.equals(r.manifest.optString("kind", ""))) continue;
            String key = keyOf(kind, r.manifest.optString("createdAt", ""), offsetMinutes);
            if (currentKey.equals(key)) return false;
        }
        return true;
    }

    private static String keyOf(String kind, String iso, int offsetMinutes) {
        if ("daily".equals(kind)) return dailyKey(iso, offsetMinutes);
        if ("weekly".equals(kind)) return weeklyKey(iso, offsetMinutes);
        return monthlyKey(iso, offsetMinutes);
    }
}
