// ═══════════════════════════════════════════════════════════════
// SlaMonitor.gs — مراقبة SLA وإرسال التنبيهات التلقائية
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

/**
 * يُشغَّل تلقائياً كل ساعة عبر Time-Driven Trigger
 * يفحص الشكاوى المفتوحة ويُحدِّث حالة SLA
 */
function runSlaMonitor() {
  try {
    var sheet   = getSheet(CONFIG.SHEETS.COMPLAINTS);
    var data    = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    var headers = data[0];
    var now     = new Date();

    // مؤشرات الأعمدة
    var colId        = headers.indexOf('complaintId');
    var colTime      = headers.indexOf('timestamp');
    var colStatus    = headers.indexOf('status');
    var colSlaHours  = headers.indexOf('slaHours');
    var colSlaStatus = headers.indexOf('slaStatus');
    var colBreached  = headers.indexOf('slaBreached');
    var colUpdated   = headers.indexOf('lastUpdated');

    var alertList = []; // قائمة المتأخرة للإشعار

    for (var r = 1; r < data.length; r++) {
      var status = String(data[r][colStatus]);
      // الشكاوى المغلقة لا تحتاج فحص
      if (status === 'مغلقة' || status === 'تم الحل') continue;

      var createdAt = new Date(data[r][colTime]);
      var slaHrs    = parseFloat(data[r][colSlaHours]) || CONFIG.SLA.DEFAULT_HOURS;
      var deadline  = new Date(createdAt.getTime() + slaHrs * 3600000);
      var diffHours = (now - createdAt) / 3600000;

      var newSlaStatus, newBreached;

      if (now > deadline) {
        newSlaStatus = 'متأخرة';
        newBreached  = 'نعم';
        alertList.push({
          id:        data[r][colId],
          hours:     Math.round(diffHours),
          deadline:  deadline,
        });
      } else if (diffHours >= CONFIG.SLA.WARNING_HOURS) {
        newSlaStatus = 'تحذير';
        newBreached  = 'لا';
      } else {
        newSlaStatus = 'في الوقت';
        newBreached  = 'لا';
      }

      // تحديث الصف إذا تغيّرت الحالة
      if (String(data[r][colSlaStatus]) !== newSlaStatus ||
          String(data[r][colBreached])  !== newBreached) {
        sheet.getRange(r + 1, colSlaStatus + 1).setValue(newSlaStatus);
        sheet.getRange(r + 1, colBreached  + 1).setValue(newBreached);
        sheet.getRange(r + 1, colUpdated   + 1).setValue(now);
      }
    }

    // ── إرسال إشعار بريد للمتأخرات (إن وجدت) ───────────────────
    if (alertList.length > 0) {
      sendSlaAlert(alertList);
    }

    // ── تحديث KPI Cache ──────────────────────────────────────────
    refreshKpiCache();

    Logger.log('SLA Monitor: فحص ' + (data.length - 1) + ' شكوى | متأخرة: ' + alertList.length);
  } catch (e) {
    Logger.log('SlaMonitor Error: ' + e.message);
  }
}

// ─── إرسال بريد تنبيه SLA ────────────────────────────────────
function sendSlaAlert(alertList) {
  try {
    var email = getSetting('alert_email') || 'admin@example.com';
    var body  = 'تنبيه SLA — ' + CONFIG.BRANCH.NAME + '\n\n';
    body += 'الشكاوى التالية تجاوزت وقت الاستجابة المحدد:\n\n';
    alertList.forEach(function(item) {
      body += '• ' + item.id + ' — منذ ' + item.hours + ' ساعة\n';
    });
    body += '\nيرجى المعالجة الفورية.\nNظام UHIA Luxor';

    MailApp.sendEmail({
      to:      email,
      subject: '⚠️ تنبيه SLA: ' + alertList.length + ' شكوى متأخرة — ' + CONFIG.BRANCH.NAME,
      body:    body,
    });
  } catch (e) {
    Logger.log('Email error: ' + e.message);
  }
}

// ─── الحصول على ملخص SLA للداشبورد ──────────────────────────
function getSlaAlerts() {
  try {
    var rows = getAllRows(CONFIG.SHEETS.COMPLAINTS);
    var now  = new Date();
    var breached = [], warning = [], ok = [];

    rows.forEach(function(r) {
      if (r.status === 'مغلقة' || r.status === 'تم الحل') return;
      var obj = {
        id:          r.complaintId,
        name:        r.name,
        provider:    r.providerName,
        category:    r.category,
        status:      r.status,
        slaStatus:   r.slaStatus,
        timestamp:   r.timestamp,
        slaBreached: r.slaBreached === 'نعم',
      };
      if (r.slaStatus === 'متأخرة')   breached.push(obj);
      else if (r.slaStatus === 'تحذير') warning.push(obj);
      else                              ok.push(obj);
    });

    return {
      success:       true,
      breachedCount: breached.length,
      warningCount:  warning.length,
      okCount:       ok.length,
      breached:      breached.slice(0, 20),
      warning:       warning.slice(0, 20),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── إنشاء Trigger تلقائي كل ساعة ───────────────────────────
function setupSlaMonitorTrigger() {
  // احذف القديم أولاً
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runSlaMonitor') {
      ScriptApp.deleteTrigger(t);
    }
  });
  // أنشئ trigger جديد كل ساعة
  ScriptApp.newTrigger('runSlaMonitor')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('SLA Monitor Trigger created ✓');
}
