// ═══════════════════════════════════════════════════════════════
// Code.gs — الراوتر الرئيسي (نقطة الدخول الوحيدة)
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

/**
 * doPost — معالجة جميع طلبات POST
 * الهيكل المتوقع:
 * { "action": "actionName", "payload": {...}, "token": "..." }
 */
function doPost(e) {
  var result;
  try {
    // ── تحليل الطلب ──────────────────────────────────────────
    var raw  = e.postData ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action  = String(body.action  || '');
    var payload = body.payload || {};
    var token   = String(body.token   || '');

    Logger.log('doPost action: ' + action);

    // ── توجيه الطلب حسب الـ action ────────────────────────────
    switch (action) {

      // ── نموذج العام (Public) ─────────────────────────────────
      case 'saveComplaint':
        result = saveComplaint(payload);
        break;

      case 'saveSurvey':
        result = saveSurvey(payload);
        break;

      // ── الداشبورد التنفيذي ───────────────────────────────────
      case 'getDashboardData':
        result = getDashboardData();
        break;

      case 'getDailyTrend':
        result = getDailyTrend();
        break;

      case 'getSlaAlerts':
        result = getSlaAlerts();
        break;

      // ── لوحة الإدارة (تتطلب token) ───────────────────────────
      case 'adminLogin':
        result = adminLogin(payload.password);
        break;

      case 'getComplaints':
        result = getComplaints(token, payload.filters || {});
        break;

      case 'updateComplaintStatus':
        result = updateComplaintStatus(token, payload);
        break;

      case 'getComplaintDetail':
        result = getComplaintDetail(token, payload.complaintId);
        break;

      case 'setAdminPassword':
        result = setAdminPassword(token, payload.newPassword);
        break;

      // ── إعداد أولي للنظام (يُشغَّل مرة واحدة) ───────────────
      case 'setupSheets':
        result = setupSheets();
        break;

      default:
        result = { success: false, error: 'action غير معروف: ' + action };
    }

  } catch (err) {
    Logger.log('doPost Critical Error: ' + err.message + '\n' + err.stack);
    result = { success: false, error: 'خطأ داخلي في الخادم' };
  }

  return buildResponse(result);
}

/**
 * doGet — معالجة طلبات GET (للتحقق من النشر والـ Health Check)
 */
function doGet(e) {
  var action = (e.parameter && e.parameter.action) ? e.parameter.action : 'health';

  if (action === 'health') {
    return buildResponse({
      success:    true,
      status:     'ok',
      system:     'UHIA Luxor System',
      version:    CONFIG.VERSION,
      branch:     CONFIG.BRANCH.NAME,
      serverTime: new Date().toISOString(),
    });
  }

  return buildResponse({ success: false, error: 'GET action غير مدعوم: ' + action });
}

// ─── بناء الـ Response الموحد ─────────────────────────────────
function buildResponse(data) {
  var json = JSON.stringify(data, null, 0);
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════
// SetupSheets.gs — إنشاء هيكل Google Sheets الكامل (مرة واحدة)
// ═══════════════════════════════════════════════════════════════
function setupSheets() {
  try {
    var ss = getSpreadsheet();

    // تعريف هيكل كل شيت
    var sheetsConfig = [
      {
        name: CONFIG.SHEETS.SETTINGS,
        headers: ['key', 'value', 'description'],
        seedData: [
          ['alert_email',    'admin@example.com', 'بريد التنبيهات'],
          ['sla_hours',      '48',                'ساعات SLA الافتراضية'],
          ['branch_name',    CONFIG.BRANCH.NAME,  'اسم الفرع'],
          ['system_version', CONFIG.VERSION,      'إصدار النظام'],
        ],
      },
      {
        name: CONFIG.SHEETS.PROVIDERS,
        headers: ['code','name','category','location','active'],
      },
      {
        name: CONFIG.SHEETS.QUESTIONS,
        headers: ['code','type','text','category','required','options','dependOn','dependVal'],
      },
      {
        name: CONFIG.SHEETS.COMPLAINTS,
        headers: [
          'complaintId','timestamp','nationalId','name','phone',
          'category','providerCode','providerName','location',
          'complaintText','hasAudio','audioUrl','hasImages','imageUrls',
          'status','assignedTo','resolutionNote','closedAt','closedBy',
          'slaHours','slaStatus','slaBreached','severity','lastUpdated',
        ],
      },
      {
        name: CONFIG.SHEETS.SURVEYS,
        headers: [
          'surveyId','timestamp','nationalId','name','phone',
          'category','providerCode','providerName','location',
          'Q_COM_01','Q_COM_02','Q_COM_03','Q_COM_03B',
          'Q_COM_04','Q_COM_05','Q_COM_99',
          'Q_UNIT_01','Q_UNIT_02','Q_UNIT_03','Q_UNIT_04',
          'Q_CARE_01','Q_CARE_02','Q_CARE_03','Q_CARE_04','Q_CARE_05',
          'Q_CONT_01','Q_CONT_02','Q_CONT_03','Q_CONT_04',
          'Q_LAB_01','Q_LAB_02','Q_LAB_03','Q_LAB_04',
          'avgScore',
        ],
      },
      {
        name: CONFIG.SHEETS.SLA_LOG,
        headers: ['complaintId','createdAt','slaHours','deadline','status','closedAt'],
      },
      {
        name: CONFIG.SHEETS.AUDIT_LOG,
        headers: ['timestamp','action','entityId','details','actor'],
      },
      {
        name: CONFIG.SHEETS.KPI_CACHE,
        headers: [
          'computedAt','totalComplaints','openComplaints','resolvedComplaints',
          'slaBreached','avgResolutionHours','avgSatisfaction','totalSurveys',
          'slaComplianceRate','categoryBreakdown','locationBreakdown',
          'wordFrequency','dailyTrend',
        ],
      },
    ];

    var created = [], existing = [];

    sheetsConfig.forEach(function(sc) {
      var sheet = ss.getSheetByName(sc.name);
      if (!sheet) {
        sheet = ss.insertSheet(sc.name);
        created.push(sc.name);
      } else {
        existing.push(sc.name);
      }

      // كتابة الـ headers
      var firstRow = sheet.getRange(1, 1, 1, sc.headers.length);
      firstRow.setValues([sc.headers]);
      firstRow.setFontWeight('bold');
      firstRow.setBackground('#1a73e8');
      firstRow.setFontColor('#ffffff');
      sheet.setFrozenRows(1);

      // كتابة البيانات الأولية (seed)
      if (sc.seedData && sheet.getLastRow() < 2) {
        sc.seedData.forEach(function(r) { sheet.appendRow(r); });
      }
    });

    // حذف الشيت الافتراضي "Sheet1" إن وُجد
    var defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

    writeAuditLog('SETUP_SHEETS', 'system',
      'Created: ' + created.join(',') + ' | Existing: ' + existing.join(','),
      'admin');

    return {
      success:  true,
      created:  created,
      existing: existing,
      message:  'تم إنشاء الشيتات بنجاح ✓',
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── تهيئة كاملة للمنظومة (يُشغَّل مرة واحدة بعد النشر) ───
function initializeSystem() {
  Logger.log('=== بدء تهيئة المنظومة ===');
  var sheetsResult = setupSheets();
  Logger.log('Sheets: ' + JSON.stringify(sheetsResult));
  setupSlaMonitorTrigger();
  setupKpiRefreshTrigger();
  Logger.log('=== اكتملت التهيئة بنجاح ===');
}
