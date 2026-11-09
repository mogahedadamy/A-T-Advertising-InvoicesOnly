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
  // مفتاح التفعيل: true = مفعلة لمدة 48 ساعة، false = نسخة دائمة بدون أي قفل
  ENABLE_TRIAL_LOCK: true,

  // مدة المهلة بالساعات والميلي ثانية (48 ساعة = 172,800,000 مللي ثانية)
  DURATION_HOURS: 48,
  DURATION_MS: 48 * 60 * 60 * 1000,

  // مفاتيح التخزين المخصصة لنسخة الفواتير والحاسبة
  STORAGE_KEYS: {
    INSTALLED_AT: "ta_invoicing_48h_installed_at",
    HIGH_WATER_MARK: "ta_invoicing_48h_hwm",
    PERMANENTLY_LOCKED: "ta_invoicing_48h_permanently_locked",
  },
};

