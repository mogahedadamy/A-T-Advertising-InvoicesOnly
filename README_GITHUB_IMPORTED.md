# مستودع مستورد من GitHub (نسخة التحديثات المعتمدة)
## A-T-Advertising-InvoicesOnly-GitHub-Imported

- **المصدر (Origin)**: `https://github.com/n8nautomation-jojo/A-T-Advertising-InvoicesOnly.git`
- **تاريخ الاستيراد**: 17 نوفمبر 2026
- **آخر التزام (Head Commit)**: `a315f28b744106a23f5e3c487c91a46665924500` (Merge PR #1)
- **الفرع المعتمد**: `master`

---

### التحديثات والتحسينات المضمنة في هذه النسخة:
1. **تضمين خطوط تجوال محلياً (Offline Bundled Fonts)**:
   - تم دمج عائلة خطوط Tajawal بجميع أوزانها (Light, Regular, Medium, Bold, ExtraBold, Black) بصيغة TTF داخل `public/fonts/` بترخيص SIL Open Font License 1.1.
   - إزالة الاعتماد الخارجي على شبكة الإنترنت (Google Fonts CDN)، مما يضمن تصدير فوري وموثوق للفواتير حتى في وضع عدم الاتصال (Offline Mode).
2. **استقرار طباعة الحروف العربية**:
   - تثبيت `font-synthesis: none` وتفعيل ربط الحروف (`font-variant-ligatures: normal`) ومنع تقطيع النصوص العربية.
3. **تثبيت الباركود عالي الجودة والضغط المتوازن**:
   - إعادة تضمين رمز QR المستخرج من Adobe Illustrator مباشرة كطبقة PNG غير مضغوطة (`NONE`) فوق المستند.
   - تطبيق ضغط `FAST` لتدفق الـ PDF لتحقيق حجم خفيف ومتوازن.
4. **تطابق الهوية البرمجية لضمان التحديث المباشر**:
   - معرف التطبيق: `com.taadvertising.invoicing`
   - رمز الإصدار: `versionCode 38` (2.0.0-LIFETIME)
   - نفس مفاتيح التوقيع وقاعدة بيانات SQLite لضمان تثبيت التحديث مباشرة فوق النسخة السابقة دون فقدان أي بيانات مسجلة.

---

### حزمة التثبيت الناتجة (APK):
- **المسار الكامل**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **الحجم**: 34.78 ميغابايت
