// ==========================================
// Config - Global Settings
// ==========================================

// الرابط الجديد بعد التحديث
var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1phxWo-AUGxmKwMnzS4_KVsFGwmhN6uDJ3KC_DYNubEP7nMKutc_5_GPTmAUaKZiw2g/exec';

// اسم الفرع (مستخدم في الواجهات)
var BRANCH_NAME = 'فرع الأقصر';

// لضمان الوصول للرابط في كل المتصفحات
window.SCRIPT_URL = SCRIPT_URL;
window.BRANCH_NAME = BRANCH_NAME;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCRIPT_URL: SCRIPT_URL };
}
