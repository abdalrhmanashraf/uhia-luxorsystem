// ═══════════════════════════════════════════════════════════════
// SheetHelper.gs — دوال مساعدة للتعامل مع Google Sheets
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

// ─── الحصول على الـ Spreadsheet ─────────────────────────────
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

// ─── الحصول على شيت بالاسم ─────────────────────────────────
function getSheet(sheetName) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('الشيت غير موجود: ' + sheetName);
  return sheet;
}

// ─── إضافة صف جديد في نهاية الشيت ─────────────────────────
function appendRow(sheetName, rowData) {
  var sheet = getSheet(sheetName);
  sheet.appendRow(rowData);
}

// ─── قراءة كل البيانات كـ objects ──────────────────────────
function getAllRows(sheetName) {
  var sheet  = getSheet(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// ─── تحديث خلية واحدة حسب شرط ──────────────────────────────
function updateRowWhere(sheetName, keyCol, keyVal, updates) {
  var sheet   = getSheet(sheetName);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var keyIdx  = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('العمود غير موجود: ' + keyCol);

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][keyIdx]) === String(keyVal)) {
      Object.keys(updates).forEach(function(col) {
        var cIdx = headers.indexOf(col);
        if (cIdx !== -1) {
          sheet.getRange(r + 1, cIdx + 1).setValue(updates[col]);
        }
      });
      return true;
    }
  }
  return false;
}

// ─── البحث عن صف واحد ──────────────────────────────────────
function findRow(sheetName, keyCol, keyVal) {
  var rows = getAllRows(sheetName);
  return rows.find(function(r) { return String(r[keyCol]) === String(keyVal); }) || null;
}

// ─── جلب آخر N صف ──────────────────────────────────────────
function getLastNRows(sheetName, n) {
  var sheet  = getSheet(sheetName);
  var last   = sheet.getLastRow();
  if (last <= 1) return [];
  var start  = Math.max(2, last - n + 1);
  var count  = last - start + 1;
  var ncols  = sheet.getLastColumn();
  var vals   = sheet.getRange(start, 1, count, ncols).getValues();
  var heads  = sheet.getRange(1, 1, 1, ncols).getValues()[0];
  return vals.map(function(row) {
    var obj = {};
    heads.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  }).reverse(); // الأحدث أولاً
}

// ─── قراءة إعداد من شيت Settings ──────────────────────────
function getSetting(key) {
  try {
    var rows = getAllRows(CONFIG.SHEETS.SETTINGS);
    var row  = rows.find(function(r) { return r['key'] === key; });
    return row ? row['value'] : null;
  } catch (e) {
    return null;
  }
}

// ─── تسجيل حدث في AuditLog ─────────────────────────────────
function writeAuditLog(action, entityId, details, actor) {
  try {
    appendRow(CONFIG.SHEETS.AUDIT_LOG, [
      new Date(),
      action,
      entityId || '',
      details  || '',
      actor    || 'system',
    ]);
  } catch (e) {
    // AuditLog لا يجب أن يوقف أي عملية
    Logger.log('AuditLog error: ' + e.message);
  }
}

// ─── حفظ/تحديث KPI_Cache ───────────────────────────────────
function updateKpiCache(kpiData) {
  var sheet   = getSheet(CONFIG.SHEETS.KPI_CACHE);
  var now     = new Date();
  // نحذف كل البيانات القديمة ونكتب السطر الجديد
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
  appendRow(CONFIG.SHEETS.KPI_CACHE, [
    now,
    kpiData.totalComplaints    || 0,
    kpiData.openComplaints     || 0,
    kpiData.resolvedComplaints || 0,
    kpiData.slaBreached        || 0,
    kpiData.avgResolutionHours || 0,
    kpiData.avgSatisfaction    || 0,
    kpiData.totalSurveys       || 0,
    kpiData.slaComplianceRate  || 0,
    JSON.stringify(kpiData.categoryBreakdown || {}),
    JSON.stringify(kpiData.locationBreakdown || {}),
    JSON.stringify(kpiData.wordFrequency      || {}),
    JSON.stringify(kpiData.dailyTrend         || []),
    JSON.stringify(kpiData.surveysAnalytics   || {}),
  ]);
}

// ─── قراءة KPI_Cache ────────────────────────────────────────
function readKpiCache() {
  try {
    var sheet = getSheet(CONFIG.SHEETS.KPI_CACHE);
    var last  = sheet.getLastRow();
    if (last < 2) return null;
    var heads = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var vals  = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
    var obj   = {};
    heads.forEach(function(h, i) { obj[h] = vals[i]; });
    // فك ترميز JSON للحقول المركبة
    ['categoryBreakdown','locationBreakdown','wordFrequency','dailyTrend', 'surveysAnalytics'].forEach(function(f){
      try { obj[f] = JSON.parse(obj[f] || '{}'); } catch(e){ obj[f] = {}; }
    });
    return obj;
  } catch(e) {
    return null;
  }
}

// ─── Rate Limiting: هل تجاوز المستخدم الحد؟ ────────────────
function isRateLimited(nationalId) {
  try {
    var cache = CacheService.getScriptCache();
    var key   = 'rl_' + nationalId;
    var val   = cache.get(key);
    var count = val ? parseInt(val) : 0;
    if (count >= CONFIG.RATE_LIMIT.MAX_PER_HOUR) return true;
    cache.put(key, String(count + 1), CONFIG.RATE_LIMIT.WINDOW_MINUTES * 60);
    return false;
  } catch(e) {
    return false; // في حالة خطأ، نسمح بالطلب
  }
}
