// ═══════════════════════════════════════════════════════════════
// Config.gs — إعدادات المنظومة المركزية
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

var CONFIG = {
  // معرف Google Sheet (استبدله بعد إنشاء الشيت)
  SHEET_ID: 'YOUR_GOOGLE_SHEET_ID_HERE',

  // إعدادات SLA (بالساعات)
  SLA: {
    DEFAULT_HOURS:  48,   // الوقت المسموح للرد على الشكوى العادية
    URGENT_HOURS:   24,   // شكاوى عاجلة (مثلاً طلب مالي غير مشروع)
    WARNING_HOURS:  36,   // وقت التحذير (قبل انتهاء الـ SLA)
  },

  // أسماء الشيتات (لا تغيّرها بعد الإنشاء)
  SHEETS: {
    SETTINGS:    'Settings',
    PROVIDERS:   'Providers',
    QUESTIONS:   'Questions',
    COMPLAINTS:  'Complaints',
    SURVEYS:     'Surveys',
    SLA_LOG:     'SLA_Log',
    AUDIT_LOG:   'AuditLog',
    KPI_CACHE:   'KPI_Cache',
  },

  // مؤشرات تقييم الرضا
  RATING_MAP: {
    'ضعيف جداً': 1,
    'ضعيف':      2,
    'مقبول':     3,
    'جيد':        4,
    'جيد جداً':  5,
  },

  // إعدادات التصنيف التلقائي للشكاوى
  SEVERITY: {
    HIGH_KEYWORDS:   ['مال', 'رشوة', 'دفع', 'إهمال', 'وفاة', 'إصابة'],
    MEDIUM_KEYWORDS: ['انتظار', 'تأخير', 'رفض', 'دواء', 'نقص'],
    // باقي الكلمات = منخفض
  },

  // إعدادات الـ Rate Limiting
  RATE_LIMIT: {
    MAX_PER_HOUR:   5,    // أقصى عدد طلبات لنفس الرقم القومي في ساعة
    WINDOW_MINUTES: 60,
  },

  // معلومات الفرع
  BRANCH: {
    NAME: 'فرع الأقصر',
    CODE: 'LUXOR',
  },

  // إصدار النظام
  VERSION: '2.0.0',
};

// ═══════════════════════════════════════════════════════════════
// دالة مساعدة: تحديد مستوى خطورة الشكوى تلقائياً
// ═══════════════════════════════════════════════════════════════
function classifySeverity(text) {
  if (!text) return 'منخفض';
  var lower = text.toLowerCase();
  for (var i = 0; i < CONFIG.SEVERITY.HIGH_KEYWORDS.length; i++) {
    if (lower.indexOf(CONFIG.SEVERITY.HIGH_KEYWORDS[i]) !== -1) return 'عالٍ';
  }
  for (var j = 0; j < CONFIG.SEVERITY.MEDIUM_KEYWORDS.length; j++) {
    if (lower.indexOf(CONFIG.SEVERITY.MEDIUM_KEYWORDS[j]) !== -1) return 'متوسط';
  }
  return 'منخفض';
}

// ═══════════════════════════════════════════════════════════════
// دالة مساعدة: تحويل درجة التقييم النصية إلى رقم
// ═══════════════════════════════════════════════════════════════
function ratingToNumber(text) {
  return CONFIG.RATING_MAP[text] || 0;
}

// ═══════════════════════════════════════════════════════════════
// دالة مساعدة: توليد ID فريد
// ═══════════════════════════════════════════════════════════════
function generateId(prefix) {
  var now  = new Date();
  var y    = now.getFullYear().toString().slice(2);
  var m    = String(now.getMonth() + 1).padStart(2, '0');
  var d    = String(now.getDate()).padStart(2, '0');
  var rand = Math.floor(Math.random() * 9000 + 1000);
  return (prefix || 'ID') + '-' + y + m + d + '-' + rand;
}

// ═══════════════════════════════════════════════════════════════
// دالة مساعدة: إنشاء response موحد
// ═══════════════════════════════════════════════════════════════
function okResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ success: true }, data)))
    .setMimeType(ContentService.MimeType.JSON);
}

function errResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
