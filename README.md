# T.A Advertising Solution — نظام حاسبة وإدارة الفواتير التجارية

نظام رقمي تجاري متكامل للمطابع ووكالات الدعاية والإعلان لحساب تكاليف ومقاسات الرولات، إصدار عروض الأسعار، إدارة فواتير المبيعات والمشتريات الرسمية (A5)، وتتبع سجل الطلبات وتوليد وطباعة ملفات PDF بجودة فائقة.

---

## 🚀 التقنيات المستخدمة (Tech Stack)

* **الواجهة الأمامية**: React 18, TypeScript, Vite
* **إدارة المسارات والصفحات**: TanStack Router
* **إدارة الحالة والبيانات**: TanStack Query (React Query)
* **التصميم والتنسيق**: Tailwind CSS v4, Lucide React Icons, Radix UI
* **تصدير الفواتير والطباعة**: html2pdf.js, jsPDF, html2canvas, DOMPurify
* **تطبيق الهواتف الذكية**: Capacitor 7 (Android Native Platform)
* **الأمان والخصوصية**: Capacitor Biometric Auth (بصمة الإصبع ورمز الحماية)

---

## 📁 هيكلية المشروع (Project Architecture)

```text
A-T-Advertising/
├── src/
│   ├── assets/                # الشعارات والأختام والصور المشفرة Base64
│   ├── components/            # مكونات الواجهة (الحاسبة، الفواتير، السجل، التصميم)
│   │   ├── billing/           # محرك إصدار الفواتير المخصصة والطباعة الذكية
│   │   ├── calculator/        # حاسبة تسعير وتوزيع الرولات المتطورة
│   │   ├── common/            # المكونات المشتركة وشاشة البداية الملكية
│   │   ├── invoices/          # قوالب الفواتير الرسمية A5 والموحدة
│   │   ├── layout/            # القائمة الجانبية والشريط العلوي
│   │   └── proforma/          # عروض الأسعار والمطالبات الأولية
│   ├── hooks/                 # الخطافات المخصصة (الثيم، الحالة)
│   ├── lib/                   # دوال الحسابات، قواعد البيانات المحلية، التشفير
│   ├── routes/                # مسارات التطبيق المعرفة عبر TanStack Router
│   ├── styles.css             # تخصيصات وهوية T.A الزمردية والأوبسيديان
│   └── main.tsx               # نقطة انطلاق التطبيق
├── android/                   # مشروع أندرويد ستوديو الأصلي و Gradle
├── public/                    # الأصول الثابتة والشعارات
├── capacitor.config.ts        # إعدادات تطبيق أندرويد كاباسيتور
├── vite.config.ts             # إعدادات التجميع السريع Vite
└── package.json               # التبعيات والأوامر البرمجية
```

---

## 🛠️ أوامر التشغيل والبناء (Development & Build)

### 1. تثبيت التبعيات (Dependencies)
```bash
npm install
```

### 2. تشغيل السيرفر المحلي للتطوير (Local Dev Server)
```bash
npm run dev
```

### 3. فحص الأنواع وبناء ملفات الإنتاج (Production Web Build)
```bash
npm run build
```

### 4. مزامنة كود الواجهة مع تطبيق الأندرويد (Capacitor Sync)
```bash
npm run cap:build
# أو
npx cap sync android
```

### 5. تجميع حزمة تطبيق الأندرويد (Build APK)
```bash
cd android
./gradlew assembleDebug
# على نظام ويندوز:
.\gradlew.bat assembleDebug
```
ملف الـ APK الناتج سيكون في المسار:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🌐 دليل رفع الكود على GitHub باستخدام الـ PAT (Personal Access Token)

### الخطوة 1: تهيئة Git محلياً (إذا لم تكن مهيأة)
```bash
git init
git add .
git commit -m "feat: initial commit - T.A Advertising Solution v1.5.3"
git branch -M main
```

### الخطوة 2: استخراج رمز الوصول الشخصي (GitHub PAT)
1. افتح حسابك على [GitHub Settings > Developer Settings](https://github.com/settings/tokens).
2. اختر **Personal access tokens** -> **Tokens (classic)**.
3. اضغط على **Generate new token (classic)**.
4. سمِّ الرمز مثلاً `Antigravity-Remote-Agent`، وحدد مدة الصلاحية، وفعّل صلاحية **`repo`** بالكامل.
5. انسخ الرمز المولد فوراً (مثال: `ghp_xxxxxxxxxxxxxxxxxxxxxx`).

### الخطوة 3: ربط المستودع ورفع الكود (Remote Add & Push)
استبدل `<USERNAME>` باسم حسابك و `<REPO_NAME>` باسم المستودع:

```bash
git remote add origin https://github.com/<USERNAME>/<REPO_NAME>.git
git push -u origin main
```
*عند المطالبة باسم المستخدم وكلمة المرور في التيرمينال:*
* **Username**: اكتب اسم مستخدم GitHub الخاص بك.
* **Password**: الصق رمز الـ **PAT** الذي قمت بنسخه (وليس كلمة سر الحساب العادية).

> **أو بصيغة مباشرة تتضمن الـ PAT (دون الحاجة لإدخال بيانات):**
> ```bash
> git remote set-url origin https://<YOUR_PAT>@github.com/<USERNAME>/<REPO_NAME>.git
> git push -u origin main
> ```

---

## 🤖 متابعة التطوير عبر وكيل Antigravity عن بُعد (Remote Agent)

عند الانتقال إلى بيئة **Antigravity Remote Agent**:

1. **استنساخ المستودع عن بعد**:
   ```bash
   git clone https://<YOUR_PAT>@github.com/<USERNAME>/<REPO_NAME>.git
   cd <REPO_NAME>
   ```
2. **تثبيت الحزم وبدء العمل الفوري**:
   ```bash
   npm install
   npm run dev
   ```
3. عند استخراج التعديلات ورفعها مجدداً:
   ```bash
   git add .
   git commit -m "update: feature improvements"
   git push origin main
   ```

