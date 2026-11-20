@echo off
setlocal
chcp 65001 >nul
title بناء ملف APK لتطبيق T.A Advertising Solution

set "BUILD_TYPE=%~1"
if "%BUILD_TYPE%"=="" (
    if defined TA_KEYSTORE_PATH (
        set "BUILD_TYPE=release"
    ) else (
        set "BUILD_TYPE=debug"
    )
)

if /i "%BUILD_TYPE%"=="release" (
    set "GRADLE_TASK=assembleRelease"
    set "APK_REL_PATH=android\app\build\outputs\apk\release\app-release.apk"
    set "APK_UNSIGNED_PATH=android\app\build\outputs\apk\release\app-release-unsigned.apk"
) else (
    set "BUILD_TYPE=debug"
    set "GRADLE_TASK=assembleDebug"
    set "APK_REL_PATH=android\app\build\outputs\apk\debug\app-debug.apk"
    set "APK_UNSIGNED_PATH="
)

echo ========================================================
echo   1. بناء ملفات الواجهة والويب (Vite Build)...
echo ========================================================
cd /d "%~dp0"
call npm run build
if %errorlevel% neq 0 (
    echo [خطأ] فشل بناء ملفات الويب.
    exit /b %errorlevel%
)

echo ========================================================
echo   2. مزامنة ملفات الويب مع مشروع أندرويد (Capacitor Sync)...
echo ========================================================
call npx cap sync android
if %errorlevel% neq 0 (
    echo [خطأ] فشلت مزامنة مشروع أندرويد.
    exit /b %errorlevel%
)

echo ========================================================
echo   3. تجميع ملف APK (%BUILD_TYPE%) بواسطة Gradle...
echo ========================================================
if not defined JAVA_HOME (
    if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
        set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
    )
)
if not defined ANDROID_HOME (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    )
)

cd /d "%~dp0android"
call gradlew.bat %GRADLE_TASK%
if %errorlevel% neq 0 (
    echo [خطأ] فشل تجميع ملف الـ APK.
    exit /b %errorlevel%
)

cd /d "%~dp0"
set "BUILT_APK="
if exist "%~dp0%APK_REL_PATH%" (
    set "BUILT_APK=%~dp0%APK_REL_PATH%"
) else if defined APK_UNSIGNED_PATH (
    if exist "%~dp0%APK_UNSIGNED_PATH%" set "BUILT_APK=%~dp0%APK_UNSIGNED_PATH%"
)

if defined BUILT_APK (
    copy /y "%BUILT_APK%" "%~dp0TA_Advertising_Solution-%BUILD_TYPE%.apk" >nul
    copy /y "%BUILT_APK%" "%~dp0TA_Advertising_Solution.apk" >nul
    echo ========================================================
    echo   [نجاح] تم بناء ملف الـ APK (%BUILD_TYPE%) بنجاح!
    echo   الملف جاهز الآن:
    echo   %~dp0TA_Advertising_Solution-%BUILD_TYPE%.apk
    echo   %~dp0TA_Advertising_Solution.apk
    echo ========================================================
) else (
    echo [تحذير] لم يتم العثور على ملف APK في مسار المخرجات المتوقع.
    exit /b 1
)
endlocal
