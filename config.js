// ==========================================
// Config - Global Settings
// ==========================================

// الرابط الجديد بعد التحديث
var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxhdfCbRwFkLnEmy8ukZ2v8Oh7c8_M8Fm2x_xjiXRUDcWSUt_eM-7yJ0SxeXsx1JUJY-g/exec';

// اسم الفرع (مستخدم في الواجهات)
var BRANCH_NAME = 'فرع الأقصر';

// لضمان الوصول للرابط في كل المتصفحات
window.SCRIPT_URL = SCRIPT_URL;
window.BRANCH_NAME = BRANCH_NAME;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCRIPT_URL: SCRIPT_URL };
}
