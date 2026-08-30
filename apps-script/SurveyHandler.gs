// ═══════════════════════════════════════════════════════════════
// SurveyHandler.gs — معالج استقبال وحفظ الاستبيانات
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

/**
 * المدخلات المتوقعة (payload):
 * {
 *   nationalId, name, phone,
 *   category, providerCode, providerName,
 *   answers: { Q_COM_01, Q_COM_02, ... }
 * }
 */
function saveSurvey(payload) {
  // ── 1. التحقق من البيانات ────────────────────────────────────
  if (!payload.nationalId || !payload.name || !payload.phone) {
    return { success: false, error: 'بيانات ناقصة' };
  }
  if (!payload.answers || typeof payload.answers !== 'object') {
    return { success: false, error: 'لا توجد إجابات' };
  }

  // ── 2. Rate Limiting ──────────────────────────────────────────
  if (isRateLimited(payload.nationalId)) {
    return { success: false, error: 'تم تجاوز الحد المسموح. حاول لاحقاً' };
  }

  // ── 3. حساب متوسط درجة الرضا ─────────────────────────────────
  var ratingCodes = ['Q_COM_01','Q_COM_04','Q_COM_05',
                     'Q_UNIT_01','Q_UNIT_03',
                     'Q_CARE_01','Q_CARE_02','Q_CARE_04',
                     'Q_CONT_01','Q_CONT_02',
                     'Q_LAB_01','Q_LAB_02'];
  var total = 0, count = 0;
  var ans = payload.answers || {};
  ratingCodes.forEach(function(code) {
    if (ans[code]) {
      var num = ratingToNumber(ans[code]);
      if (num > 0) { total += num; count++; }
    }
  });
  var avgScore = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

  // ── 4. توليد ID الاستبيان ────────────────────────────────────
  var surveyId = generateId('SRV');
  var now      = new Date();

  // ── 5. ترتيب الإجابات حسب الأعمدة المحددة ───────────────────
  var ALL_Q = [
    'Q_COM_01','Q_COM_02','Q_COM_03','Q_COM_03B',
    'Q_COM_04','Q_COM_05','Q_COM_99',
    'Q_UNIT_01','Q_UNIT_02','Q_UNIT_03','Q_UNIT_04',
    'Q_CARE_01','Q_CARE_02','Q_CARE_03','Q_CARE_04','Q_CARE_05',
    'Q_CONT_01','Q_CONT_02','Q_CONT_03','Q_CONT_04',
    'Q_LAB_01','Q_LAB_02','Q_LAB_03','Q_LAB_04',
  ];

  var row = [
    surveyId,                           // A: surveyId
    now,                                // B: timestamp
    String(payload.nationalId),        // C: nationalId
    payload.name,                      // D: name
    String(payload.phone),             // E: phone
    payload.category     || '',        // F: category
    payload.providerCode || '',        // G: providerCode
    payload.providerName || '',        // H: providerName
    extractLocation(payload.providerCode), // I: location
  ];

  // إضافة إجابات الأسئلة بالترتيب
  ALL_Q.forEach(function(qCode) {
    row.push(ans[qCode] !== undefined && ans[qCode] !== null ? String(ans[qCode]) : '');
  });

  row.push(avgScore); // آخر عمود: avgScore

  // ── 6. الحفظ في الشيت ───────────────────────────────────────
  appendRow(CONFIG.SHEETS.SURVEYS, row);

  // ── 7. AuditLog ──────────────────────────────────────────────
  writeAuditLog('CREATE_SURVEY', surveyId,
    'Category:' + payload.category + ' | AvgScore:' + avgScore, 'public_form');

  return { success: true, id: surveyId, avgScore: avgScore };
}
