# Production ProGuard Rules — T.A Advertising Invoicing System

# 1. Capacitor Core & Plugins
-keep public class * extends com.getcapacitor.Plugin
-keep public class * extends com.getcapacitor.BridgeActivity
-keepclassmembers class * extends com.getcapacitor.Plugin {
    public *;
}
-keep class com.getcapacitor.** { *; }

# 2. WebKit JavaScript Interfaces
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 3. SQLite & SQLCipher Native Persistence
-keep class com.getcapacitor.community.database.sqlite.** { *; }
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.** { *; }

# 4. Biometric Authentication & Preferences
-keep class com.capacitorjs.plugins.preferences.** { *; }
-keep class com.aparajita.capacitor.biometricauth.** { *; }

# 5. Native Backup Engine & WorkManager Workers
-keep class com.futureprint.calculator.backup.** { *; }
-keep class androidx.work.** { *; }

# 6. Preserve Line Numbers & Attributes for Crash Telemetry
-keepattributes SourceFile,LineNumberTable,*Annotation*
-keepattributes EnclosingMethod,InnerClasses,Signature
