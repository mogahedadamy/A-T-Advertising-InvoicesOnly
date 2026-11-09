@echo off
title فتح مشروع تطبيق فيوتشر في Android Studio
echo ========================================================
echo   جاري فتح مشروع تطبيق فيوتشر للطباعة في Android Studio...
echo ========================================================
set "CAPACITOR_ANDROID_STUDIO_PATH=C:\Program Files\Android\Android Studio\bin\studio64.exe"
start "" "C:\Program Files\Android\Android Studio\bin\studio64.exe" "%~dp0android"
echo تم إطلاق Android Studio بنجاح!
