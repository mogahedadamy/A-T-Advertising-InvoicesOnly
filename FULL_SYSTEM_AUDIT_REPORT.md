# تقرير الفحص الهندسي الشامل والتدقيق المعماري للنظام (Full System Audit Report)

**المشروع:** نظام إدارة الفواتير — TA Advertising Invoicing (`A-T-Advertising-InvoicesOnly`)  
**الإصدار الموثّق:** `1.3.2-INVOICE` (`versionCode: 35`)  
**المعرّف الحزمي:** `com.taadvertising.invoicing`  
**تاريخ التدقيق:** 2026-11-11  

---

## الملخص التنفيذي

كشف التدقيق الشامل عن وجود سلسلة مترابطة من الأعطال الحرجة (Critical) والعالية (High) كانت تسبّب مباشرةً ما يلي في نسخة Android:
1. فشل تهيئة قاعدة البيانات المشفّرة SQLCipher عند إقلاع التطبيق بسبب استدعاء أوامر `PRAGMA` عبر `db.execute()` بدل `db.query()`.
2. سقوط طبقة التخزين إلى الذاكرة المؤقتة (RAM) فقط بعد فشل التهيئة، مما أدّى إلى **ظهور شاشة الترحيب وطلب الاسم في كل مرة يُفتح فيها التطبيق** و**عدم حفظ البيانات بعد الإغلاق**.
3. إسقاط الفواتير المحفوظة بصمت عند إعادة تشغيل التطبيق بسبب إزالة التكرار (Deduplication) في `loadFromStorage` باستخدام الرقم التسلسلي الافتراضي `"001"` بدل المعرّف الفريد `inv.id`.
4. خطأ المعاملات المتداخلة (`"Already in transaction"`) أثناء توليد الأرقام التسلسلية وإضافة المشاريع والمصروفات والمدفوعات واستعادة النسخ الاحتياطية على Android.
5. بقاء قالب الفاتورة وشارة النافذة يعرضان الترقيم القديم `#001` بدل الرقم المرجعي المؤرّخ (`INV-DDMMYYYY-NNN` / `PINV-DDMMYYYY-NNN`) قبل وبعد الحفظ في بعض الواجهات.

تم إصلاح الأعطال الحرجة والعالية والمتبقية (بما في ذلك البنود المتوسطة وتقسيم حزمة البناء) والتحقق منها بالبناء والاختبارات بنسبة نجاح 100% (`22` ملف اختبار، `239` اختباراً).

---

## 1. سجل المشكلات المكتشفة والإصلاحات المطبّقة

### [CRITICAL-01] فشل تشغيل أوامر `PRAGMA` عبر `db.execute()` على Android SQLCipher
- **المشكلة:** تعذّر الحفظ وظهور خطأ `SQLiteDatabase.query or rawQuery methods only` أو تعطل تهيئة القاعدة بصمت عند تشغيل التطبيق على الهاتف.
- **السبب الجذري:** مكتبة SQLite/SQLCipher على Android ترفض الأوامر التي تُرجِع صفوفاً أو نتائج (مثل `PRAGMA journal_mode=WAL;`, `PRAGMA foreign_keys=ON;`, `PRAGMA synchronous=NORMAL;`, `PRAGMA optimize;`, `PRAGMA wal_checkpoint(PASSIVE);`) عند تمريرها إلى `db.execute()`.
- **الترابط والتأثير المتسلسل:**
  - فشل `PRAGMA` داخل `src/lib/database/index.ts` يوقف إكمال تهيئة قاعدة البيانات.
  - عند فشل تهيئة القاعدة، تنحدر طبقة `src/lib/sqliteStorage.ts` إلى العمل بالذاكرة المتطايرة فقط، فينسى التطبيق أن المستخدم أتمّ شاشة الترحيب (`future_print_onboarded`) وتضيع كل الفواتير والبيانات بمجرد إغلاق التطبيق أو قتله من الذاكرة.
- **الحل المطبّق:**
  - تحويل أوامر `PRAGMA` في `src/lib/database/index.ts` (الأسطر 50–64) و`src/lib/repositories/MaintenanceRepository.ts` (الأسطر 129–142) إلى `db.query(...)` داخل كتل `try/catch` مستقلة.
- **الحالة:** ✅ تم الإصلاح والتحقق منه عبر اختبارات `integrity.test.ts` و`androidSqliteContract.test.ts`.

---

### [CRITICAL-02] تعارض المعاملات المتداخلة (`Already in transaction`) عند الحفظ والاستعادة
- **المشكلة:** فشل عمليات إنشاء المشاريع، التحويلات المالية، تسوية المصروفات، مدفوعات العملاء والموردين، واستعادة النسخ الاحتياطية على Android.
- **السبب الجذري:** استدعاء `db.run(sql, vals)` داخل معاملات مفتوحة بـ `beginTransaction()` بدون تمرير المعامل الثالث `transaction = false`، مما يجعل `@capacitor-community/sqlite` يحاول فتح معاملة جديدة داخل معاملة نشطة.
- **الترابط والتأثير المتسلسل:**
  - فشل `allocateDocumentNumber` في `src/lib/database/sequences.ts` يؤدي إلى كسر توليد الأرقام المرجعية وحفظ الفواتير والمشاريع والمدفوعات المرتبطة بها.
- **الحل المطبّق:**
  - تمرير `false` كمعامل ثالث (`transaction = false`) في جميع استدعاءات `db.run(...)` داخل المعاملات في:
    - `src/lib/database/sequences.ts`
    - `src/lib/repositories/ExpenseRepository.ts`
    - `src/lib/repositories/PaymentRepository.ts`
    - `src/lib/backup/restoreService.ts`
  - تقييد `ensureColumnIndexes(db)` في `src/lib/database/migrations/index.ts` (الأسطر 91–97) بالشرط `if (outcome.from >= V2_VERSION)`.
- **الحالة:** ✅ تم الإصلاح والتحقق منه في حزمة اختبارات قاعدة البيانات والنسخ الاحتياطي (`14` ملفات، `162` اختباراً).

---

### [CRITICAL-03] ضياع الفواتير بصمت عند إعادة التشغيل بسبب إزالة التكرار بالرقم التسلسلي `#001`
- **المشكلة:** حتى بعد حفظ الفواتير بنجاح، عند إغلاق التطبيق وإعادة فتحه تختفي الفواتير الجديدة أو تبقى فاتورة واحدة فقط من كل نوع!
- **السبب الجذري:** الدالة `loadFromStorage` في `src/lib/billing/store.ts` (الأسطر 78–91) كانت تبني خريطة إزالة التكرار بالمفتاح `${inv.meta?.type || "sales"}-${inv.meta?.serial || inv.id}`. ولأن كل فاتورة مبيعات أو مشتريات جديدة تحمل القيمة الافتراضية `meta.serial = "001"`، فإن كل فاتورة جديدة كانت تطمس الفاتورة السابقة في الذاكرة عند الإقلاع. نفس الخلل وُجد في `src/components/invoices/useUnifiedInvoices.ts` (الأسطر 89–101) حيث استخدم `${rec.kind}-${rec.serial}`.
- **الترابط والتأثير المتسلسل:**
  - القاعدة تحتوي الفواتير فعلاً، لكن واجهة الفواتير والأرشيف تسقطها أثناء التحميل الأولي وتُظهر آخر فاتورة فقط، ما يوحي للمستخدم بفقدان البيانات تماماً.
- **الحل المطبّق:**
  - توحيد مفتاح إزالة التكرار ليكون المعرّف الفريد `inv.id` في `src/lib/billing/store.ts` وتخطي السجلات الملغاة (`inv.cancelledAt`).
  - تغيير مفتاح إزالة التكرار في `src/components/invoices/useUnifiedInvoices.ts` إلى `${rec.kind}-${rec.id}`.
  - إضافة اختبار عقد محاكٍ لإعادة التشغيل البارد في `src/lib/database/androidSqliteContract.test.ts` يتحقق من بقاء فواتير متعددة تشترك في `serial = "001"`.
- **الحالة:** ✅ تم الإصلاح والتحقق منه.

---

### [HIGH-01] سباق الإقلاع وظهور شاشة الترحيب في كل فتحة للتطبيق
- **المشكلة:** شاشة الترحيب (`UserProfileDialog`) تظهر عند كل تشغيل للتطبيق ولا تغلق تلقائياً إذا اكتمل تحميل التخزين متأخراً.
- **السبب الجذري المترابط:**
  1. مهلة `Promise.race` في `src/main.tsx` (الأسطر 114–118) كانت `1500ms` فقط، وهي أقصر من زمن تهيئة SQLCipher + الترحيلات + التحميل المسبق على بعض أجهزة Android، فكان React يبدأ العرض والذاكرة فارغة بعد.
  2. المكون `src/components/layout/PageShell.tsx` (الأسطر 26–30) كان يستدعي `if (!isOnboarded) setShowOnboarding(true);` فقط، ولم يغلق الحوار أبداً عندما تتحول `isOnboarded` إلى `true` بعد إتمام التحميل.
  3. غياب نسخة احتياطية سريعة لمفاتيح الملف الشخصي (`future_print_user_name`, `future_print_onboarded`) في `@capacitor/preferences` عند حدوث تأخر أو خطأ عابر في SQLite.
- **الحل المطبّق:**
  - إضافة ميزة Fail-safe في `src/lib/sqliteStorage.ts` لنسخ `PROFILE_FAILSAFE_KEYS` (`"future_print_user_name"`, `"future_print_onboarded"`) إلى `@capacitor/preferences` واستردادها أثناء `preloadEntityCaches`.
  - تعديل `PageShell.tsx` لاستخدام `setShowOnboarding(!isOnboarded);` لضمان الإغلاق التلقائي بمجرد تهيئة الحالة.
  - رفع مهلة الإقلاع في `src/main.tsx` من `1500ms` إلى `4000ms`.
  - مزامنة علم المصادقة البيومترية `NATIVE_FLAG` (`"future_calc_biometric_native_enabled"`) في `src/lib/biometricAuth.ts` مع `sqliteStorage` (`getStoredSync`, `setStoredItem`, `removeStoredItem`) بجانب `localStorage`.
- **الحالة:** ✅ تم الإصلاح والتحقق منه.

---

### [HIGH-02] استمرار عرض `#001` بدل الرقم المرجعي المؤرّخ في القوالب ونوافذ التحرير
- **المشكلة:** واجهة الفاتورة وبطاقة المعاينة والقالب المطبوع كانت ما تزال تعرض `#001` بدل `INV-DDMMYYYY-NNN` / `PINV-DDMMYYYY-NNN`.
- **السبب الجذري:**
  - `src/components/billing/CustomInvoiceDialog.tsx`: لم يكن يزامن `savedReference` مع `invoiceToEdit.reference` داخل `useEffect` ولا يمرّر `reference` داخل `buildCurrentInvoice()`، وكانت شارة الرأس تعرض `#{serial}`.
  - `src/components/billing/StandardInvoiceDocument.tsx` (الأسطر 221–228): عند المعاينة قبل الحفظ كانت تعود افتراضياً إلى `#${meta.serial}` (`#001`) حتى لفواتير المبيعات والمشتريات.
  - `src/components/billing/BillingPreviewModal.tsx` (السطر 36)، و`src/components/billing/BillingArchiveTable.tsx` (الأسطر 204–207)، و`src/components/invoices/InvoiceRecordCard.tsx` (الأسطر 57–59) كانت تفرض علامة `#` أو تقرأ `meta.serial` قبل `invoice.reference`.
- **الحل المطبّق:**
  - مزامنة `savedReference` وتمريره في `CustomInvoiceDialog.tsx` وتحديث الشارة لعرض `savedReference` أو نمط `INV-DDMMYYYY-...` / `PINV-DDMMYYYY-...`، وتحديث الوصف الفرعي من `A4 / A5` إلى `A4`.
  - عرض `"يُولَّد عند الحفظ"` / `"Assigned on save"` في `StandardInvoiceDocument.tsx` لفواتير المبيعات والمشتريات قبل التوليد الرسمي (مع الإبقاء على `#serial` لفواتير `proforma` وفق نطاق PRD §5.3.8 الذي يجعل `scopeForInvoiceType("proforma") === null`).
  - إعطاء الأولوية لـ `invoice.reference` في `BillingPreviewModal.tsx` وإزالة `#` المكررة أمام البادئات `^(INV|PINV|PRJ|RCV|PAY)-` في `BillingArchiveTable.tsx` و`InvoiceRecordCard.tsx`.
- **الحالة:** ✅ تم الإصلاح والتحقق منه.

---

## 2. إصلاح الملاحظات المتبقية (المتوسطة والمنخفضة)

### [MEDIUM-01] عمليات الحفظ "أطلق وانسَ" (Fire-and-Forget Async) في المتاجر
- **المشكلة:** كانت دوال في `src/lib/customersStore.ts` و`src/lib/billing/store.ts` (`deleteCustomInvoice`) و`src/lib/proforma/store.ts` و`src/lib/invoicesStore.ts` و`src/lib/ordersStore.ts` تحدّث الذاكرة أولاً ثم تستدعي SQLite دون انتظار أو إشعار للمستخدم عند الفشل.
- **الحل المطبّق:**
  - تحويل `addCustomer`, `updateCustomer`, `deleteCustomer` (`src/lib/customersStore.ts`) و`deleteCustomInvoice` (`src/lib/billing/store.ts`) و`saveProformaInvoice`, `deleteProformaInvoice`, `convertProformaToOperatingInvoice` (`src/lib/proforma/store.ts`) إلى دوال `async/await` تحفظ في SQLite أولاً قبل نشر الحالة في الواجهة على Android، وتحديث المستدعين في `CustomersPage.tsx` و`ProjectFormDialog.tsx` و`BillingArchiveTable.tsx` و`ProformaDialog.tsx` لعرض إشعار خطأ صريح عند التعذر.
  - إضافة التراجع الفوري (Rollback) وإشعار الخطأ `toast.error` عند فشل الكتابة في `src/lib/invoicesStore.ts` و`src/lib/ordersStore.ts` مع الحفاظ على التوافق التزامني لاختبارات التسوية (`settlement.test.ts`).
- **الحالة:** ✅ تم الإصلاح والتحقق منه.

### [MEDIUM-02] إعادة مزامنة حالات الصفحات المحلية بعد استعادة نسخة احتياطية
- **المشكلة:** الصفحات المعتمدة على `useState` محلي لم تكن تعيد الجلب تلقائياً عند بث الحدث `native-storage-ready` من `reloadAllStoresFromDatabase` في `src/lib/backup/restoreService.ts`.
- **الحل المطبّق:** إضافة مستمع للحدث `native-storage-ready` داخل `useEffect` في `SuppliersPage.tsx` و`FinancePage.tsx` و`ExpensesPage.tsx` و`ProjectsPage.tsx` لتحديث قوائمها من SQLite فور اكتمال الاستعادة أو إعادة التهيئة.
- **الحالة:** ✅ تم الإصلاح والتحقق منه.

### [MEDIUM-03] فشل `3` حالات اختبار في `src/lib/pdfExport.test.ts`
- **المشكلة:** كانت `3` اختبارات في `src/lib/pdfExport.test.ts` تبحث عن الفئات القديمة المحذوفة `.proforma-footer-wrap` و`.proforma-contact-icon` في `INVOICE_STANDALONE_CSS`.
- **الحل المطبّق:** تحديث الاختبارات الثلاثة في `src/lib/pdfExport.test.ts` لتتحقق من الفئات والأبعاد الفعلية المعتمدة في `INVOICE_STANDALONE_CSS` و`StandardInvoiceDocument` (`.proforma-sheet, .standard-invoice-sheet`, `.grid-cols-12`, `.col-span-5`, `.col-span-2`, `.w-\[66px\]`, `.h-\[66px\]`, `-webkit-text-size-adjust: 100%`, `--invoice-accent: #0D4A39`).
- **الحالة:** ✅ تم الإصلاح والتحقق منه (`11/11` اختبار ناجح).

### [INFO-01] قفل الفترة التجريبية (`ENABLE_TRIAL_LOCK = true`)
- **الوصف:** ملف `src/lib/trialConfig.ts` يفعّل `ENABLE_TRIAL_LOCK = true` لنسخة الـ 48 ساعة التجريبية. أُبقي مفعّلاً عمداً كما هو لنسخة التجربة الحالية؛ يُعدَّل إلى `false` فقط عند طلب إنتاج النسخة التجارية الكاملة.

### [LOW-01] تقسيم حزمة البناء وبقايا التوافق (`/orders`)
- **المشكلة والوضع الفعلي:** كان ملف الحزمة المجمّع `dist/assets/index-*.js` يتجاوز `2.47 MB` ككتلة واحدة، بينما المسار `/orders` في `src/routes/orders.tsx` ما يزال مساراً نشطاً لعرض أرشيف الفواتير (`MobileHistoryPage`) ويستخدمه `BottomNav.tsx` و`AppSidebar.tsx` و`ModuleGrid.tsx` ويغطيه اختبار `app-routing.test.tsx` (لذلك يجب الإبقاء عليه).
- **الحل المطبّق:** إضافة `build.rollupOptions.output.manualChunks` في `vite.config.ts` لفصل حزم `vendor-pdf` (`544.48 kB`) و`vendor-tanstack` (`106.96 kB`) و`vendor-ui` (`129.46 kB`) و`vendor` (`665.32 kB`) وتقليص الحزمة الرئيسية إلى `1,229.88 kB` (`gzip: 622.65 kB`).
- **الحالة:** ✅ تم التحسين والتحقق منه.

---

## 3. نتائج البناء والتحقق وإصدار الـ APK المحدّث

| الفحص / البناء | الأمر / الأداة | النتيجة الفعلية المرصودة |
| :--- | :--- | :--- |
| فحص الأنواع وبناء الويب | `tsc --noEmit && vite build` | ✅ نجح (`built in 14.82s`) |
| مزامنة Capacitor Android | `npx cap sync android` | ✅ نجح (`Sync finished in 0.874s` مع 5 إضافات أصلية) |
| الاختبارات الآلية | `vitest run --run` | ✅ نجح بالكامل: `22` ملفاً من `22`، و`239` اختباراً ناجحاً من `239` (`0` فشل) |
| بناء APK Android | `.\gradlew.bat assembleDebug --no-daemon` | ✅ نجح (`BUILD SUCCESSFUL in 15s`) |

### بيانات ملف الـ APK المحدّث:
- **المسار الرئيسي في جذر المشروع:** `E:\ANDROID STUDIO\A-T-Advertising-InvoicesOnly\TA_Advertising_Invoicing_v1.3.2.apk`
- **مسار مخرجات Gradle:** `E:\ANDROID STUDIO\A-T-Advertising-InvoicesOnly\android\app\build\outputs\apk\debug\app-debug.apk`
- **الحجم:** `34,009,434` بايت
- **الإصدار (`versionName`):** `1.3.2-INVOICE`
- **رقم البناء (`versionCode`):** `35`
- **معرّف التطبيق (`applicationId`):** `com.taadvertising.invoicing`

