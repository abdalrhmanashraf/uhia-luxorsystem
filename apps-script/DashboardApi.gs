// ═══════════════════════════════════════════════════════════════
// DashboardApi.gs — API endpoints للوحة Dashboard التنفيذية
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

/**
 * يُرجع بيانات الداشبورد الكاملة:
 * - KPIs من KPI_Cache (مع fallback للحساب المباشر)
 * - آخر 10 شكاوى
 * - حالة SLA
 */
function getDashboardData() {
  try {
    // محاولة قراءة KPI_Cache أولاً (أسرع)
    var kpi = readKpiCache();

    // إذا كان الـ Cache فارغاً أو قديماً (أكثر من 60 دقيقة) → نعيد الحساب
    if (!kpi || !kpi.computedAt || isCacheStale(kpi.computedAt, 60)) {
      kpi = computeAllKpis();
    }

    // آخر 10 شكاوى
    var recent = getLastNRows(CONFIG.SHEETS.COMPLAINTS, 10).map(function(c) {
      return {
        id:          c.complaintId,
        name:        c.name,
        category:    c.category,
        provider:    c.providerName,
        location:    c.location,
        status:      c.status,
        slaStatus:   c.slaStatus,
        severity:    c.severity,
        timestamp:   c.timestamp,
        slaBreached: c.slaBreached === 'نعم',
      };
    });

    // حالة SLA
    var slaData = getSlaAlerts();

    return {
      success:    true,
      kpi:        kpi,
      recent:     recent,
      sla:        slaData,
      branchName: CONFIG.BRANCH.NAME,
      version:    CONFIG.VERSION,
      serverTime: new Date(),
    };
  } catch (e) {
    Logger.log('getDashboardData Error: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ─── هل الـ Cache قديم؟ ───────────────────────────────────────
function isCacheStale(computedAt, maxMinutes) {
  try {
    var d    = new Date(computedAt);
    var diff = (new Date() - d) / 60000; // بالدقائق
    return diff > maxMinutes;
  } catch (e) {
    return true;
  }
}

// ─── API: الاتجاه اليومي للـ 30 يوم الماضية ──────────────────
function getDailyTrend() {
  try {
    var complaints = getAllRows(CONFIG.SHEETS.COMPLAINTS);
    var now  = new Date();
    var msDay = 86400000;
    var daily = {};

    // نهيئ الـ 30 يوم بصفر
    for (var d = 0; d < 30; d++) {
      var dt  = new Date(now.getTime() - d * msDay);
      var key = dt.getFullYear() + '-' +
        String(dt.getMonth()+1).padStart(2,'0') + '-' +
        String(dt.getDate()).padStart(2,'0');
      daily[key] = 0;
    }

    complaints.forEach(function(c) {
      if (!c.timestamp) return;
      var dt  = new Date(c.timestamp);
      var diff = (now - dt) / msDay;
      if (diff > 30) return;
      var key = dt.getFullYear() + '-' +
        String(dt.getMonth()+1).padStart(2,'0') + '-' +
        String(dt.getDate()).padStart(2,'0');
      if (daily[key] !== undefined) daily[key]++;
    });

    var result = Object.keys(daily)
      .sort()
      .map(function(k) { return { date: k, count: daily[k] }; });

    return { success: true, trend: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
