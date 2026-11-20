package com.futureprint.calculator.backup;

/**
 * Static handle to the Capacitor bridge so components that do not extend
 * Plugin (the WorkManager worker, the engine) can reach the SQLite plugin.
 * Set by the BackupPlugin on load and refreshed by MainActivity.
 */
public final class BridgeAccess {

    private static volatile com.getcapacitor.Bridge bridge;

    private BridgeAccess() {}

    public static void set(com.getcapacitor.Bridge value) {
        bridge = value;
    }

    public static void clear() {
        bridge = null;
    }

    public static com.getcapacitor.Bridge getBridge() {
        return bridge;
    }
}
