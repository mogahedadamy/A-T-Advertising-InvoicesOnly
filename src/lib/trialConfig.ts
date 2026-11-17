/**
 * trialConfig.ts — إعدادات المهلة التجريبية وقابلية الإلغاء الفوري
 * 
 * الميزة الأساسية:
 * صُممت هذه الإعدادات بنمط Modular Feature Flag ليتسنى لاحقاً
 * إلغاء المهلة وجعل التطبيق دائماً ومرخصاً بالكامل بدون أدنى تعديل
 * على كود الحاسبة أو الفواتير.
 * 
 * لإلغاء المهلة لاحقاً وجعل النسخة دائمة:
 * يكفي تغيير ENABLE_TRIAL_LOCK إلى false!
 */

export const TRIAL_CONFIG = {
  // مفتاح التفعيل: false = نسخة دائمة مدى الحياة بدون أي قفل أو عداد تجريبي (Lifetime Edition)
  ENABLE_TRIAL_LOCK: false,

  // مدة المهلة بالساعات والميلي ثانية (معطلة)
  DURATION_HOURS: 168,
  DURATION_MS: 7 * 24 * 60 * 60 * 1000,

  // مفاتيح التخزين المخصصة لنسخة الفواتير والحاسبة (محدثة لـ 7 أيام لإعادة الضبط التلقائي النظيف)
  STORAGE_KEYS: {
    INSTALLED_AT: "ta_invoicing_7d_installed_at",
    HIGH_WATER_MARK: "ta_invoicing_7d_hwm",
    PERMANENTLY_LOCKED: "ta_invoicing_7d_permanently_locked",
  },
};

