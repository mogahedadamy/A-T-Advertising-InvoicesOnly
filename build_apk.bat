@echo off
chcp 65001 >nul
title بناء ملف APK لتطبيق T.A Advertising Solution
echo ========================================================
echo   1. بناء ملفات الواجهة والويب (Vite Build)...
echo ========================================================
cd /d "%~dp0"
call npm run build
if %errorlevel% neq 0 (
    echo [خطأ] فشل بناء ملفات الويب.
    pause
    exit /b %errorlevel%
)

echo ========================================================
echo   2. مزامنة ملفات الويب مع مشروع أندرويد (Capacitor Sync)...
echo ========================================================
call npx cap sync android
if %errorlevel% neq 0 (
    echo [خطأ] فشلت مزامنة مشروع أندرويد.
    pause
    exit /b %errorlevel%
)

echo ========================================================
echo   3. تجميع ملف APK بواسطة Gradle و Android Studio JBR...
echo ========================================================
set "JAVA_HOME=C:\Users\HP\.jdks\jbr-21.0.11"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

cd /d "%~dp0android"
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo [خطأ] فشل تجميع ملف الـ APK.
    pause
    exit /b %errorlevel%
)

cd /d "%~dp0"
if exist "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /y "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0TA_Advertising_Solution.apk" >nul
    copy /y "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0TA_Advertising_Solution-v1.4.2.apk" >nul
    copy /y "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0..\TA_Advertising_Solution.apk" >nul
    copy /y "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0..\TA_Advertising_Solution-v1.4.2.apk" >nul
    echo ========================================================
    echo   [نجاح] تم بناء ملف الـ APK بنجاح!
    echo   الملف جاهز الآن:
    echo   %~dp0TA_Advertising_Solution-v1.4.2.apk
    echo   %~dp0..\TA_Advertising_Solution-v1.4.2.apk
    echo   %~dp0..\TA_Advertising_Solution.apk
    echo ========================================================
) else (
    echo [تحذير] لم يتم العثور على ملف app-debug.apk في مسار المخرجات الافتراضي.
)
