package com.futureprint.calculator.backup;

import android.util.Log;

/**
 * Closes the Capacitor SQLite connection before the database file is replaced.
 *
 * The plugin keeps a cached connection per database name; replacing the .db file
 * underneath an open handle would let the old handle write stale pages back
 * later. We close it through the plugin's public Java API so its internal cache
 * is cleared as well, then the web layer reopens it on next use.
 */
final class AppDatabaseCloser {

    private static final String TAG = "AppDatabaseCloser";

    private AppDatabaseCloser() {}

    static void closeConnection() throws Exception {
        try {
            Class<?> pluginClass = Class.forName("com.getcapacitor.community.database.sqlite.CapacitorSQLitePlugin");
            com.getcapacitor.Bridge bridge = BridgeAccess.getBridge();
            if (bridge == null) {
                Log.w(TAG, "bridge unavailable; cannot close the SQLite connection");
                return;
            }
            com.getcapacitor.PluginHandle handle = bridge.getPlugin("CapacitorSQLite");
            Object plugin = handle == null ? null : handle.getInstance();
            if (plugin == null) {
                Log.i(TAG, "SQLite plugin not instantiated; no connection to close");
                return;
            }
            // implementation.closeConnection(database, readonly)
            java.lang.reflect.Field implField = pluginClass.getDeclaredField("implementation");
            implField.setAccessible(true);
            Object implementation = implField.get(plugin);
            if (implementation == null) {
                Log.i(TAG, "SQLite implementation not ready; no connection to close");
                return;
            }
            java.lang.reflect.Method close = implementation
                .getClass()
                .getMethod("closeConnection", String.class, Boolean.class);
            close.invoke(implementation, BackupArchiveConstants.DB_NAME, Boolean.FALSE);
            Log.i(TAG, "closed SQLite connection for " + BackupArchiveConstants.DB_NAME);
        } catch (ClassNotFoundException e) {
            Log.w(TAG, "SQLite plugin not present; nothing to close");
        } catch (NoSuchFieldException | NoSuchMethodException e) {
            Log.w(TAG, "SQLite plugin internals changed; falling back to file swap", e);
            throw e;
        }
    }
}
