// ═══════════════════════════════════════════════════════════════
// AnalyticsEngine.gs — محرك حساب KPIs وتحليل النصوص
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

// كلمات يجب تجاهلها في تحليل النصوص (Stop Words)
var STOP_WORDS = [
  'في','من','إلى','على','عن','مع','هو','هي','هم','هن','أنا','نحن',
  'كان','كانت','يكون','تكون','لا','لم','لن','قد','وقد','أو','و','ثم',
  'حتى','إذا','إن','أن','بأن','هذا','هذه','ذلك','تلك','التي','الذي',
  'الذين','اللاتي','ما','مما','عند','بعد','قبل','وقت','يوم','أيام',
  'جداً','جدا','كل','بعض','أي','غير','بدون','دون','لكن','لكنه',
  'الهيئة','التأمين','الصحي','الشامل','فرع','الأقصر','المنفذ',
  'الوحدة','المستشفى','المركز',
];

// ─── الدالة الرئيسية: حساب كل KPIs ──────────────────────────
function computeAllKpis() {
  try {
    var complaints = getAllRows(CONFIG.SHEETS.COMPLAINTS);
    var surveys    = getAllRows(CONFIG.SHEETS.SURVEYS);
    var now        = new Date();
    var msDay      = 86400000;

    // ── إحصائيات الشكاوى ──────────────────────────────────────
    var total        = complaints.length;
    var open         = 0, resolved = 0, closed = 0, underReview = 0;
    var breached     = 0;
    var totalResHrs  = 0, resCount = 0;
    var catBreakdown = {}, locBreakdown = {};
    var severityCount= { 'عالٍ':0, 'متوسط':0, 'منخفض':0 };
    var allTexts     = [];
    var daily        = {}; // { 'YYYY-MM-DD': count }

    complaints.forEach(function(c) {
      // حالة الشكوى
      switch (c.status) {
        case 'جديدة':          open++;        break;
        case 'تحت المراجعة':  underReview++; break;
        case 'تم الحل':        resolved++;    break;
        case 'مغلقة':          closed++;      break;
      }

      // SLA
      if (c.slaBreached === 'نعم') breached++;

      // وقت الإغلاق
      if ((c.status === 'مغلقة' || c.status === 'تم الحل') && c.closedAt && c.timestamp) {
        var diffHrs = (new Date(c.closedAt) - new Date(c.timestamp)) / 3600000;
        if (diffHrs > 0) { totalResHrs += diffHrs; resCount++; }
      }

      // توزيع الفئات
      var cat = c.category || 'غير محدد';
      catBreakdown[cat] = (catBreakdown[cat] || 0) + 1;

      // توزيع المناطق
      var loc = c.location || 'غير محدد';
      locBreakdown[loc] = (locBreakdown[loc] || 0) + 1;

      // خطورة الشكوى
      var sev = c.severity || 'منخفض';
      severityCount[sev] = (severityCount[sev] || 0) + 1;

      // نصوص الشكاوى للتحليل
      if (c.complaintText) allTexts.push(c.complaintText);

      // اتجاه يومي (آخر 30 يوم)
      if (c.timestamp) {
        var d = new Date(c.timestamp);
        var diff = (now - d) / msDay;
        if (diff <= 30) {
          var key = d.getFullYear() + '-' +
            String(d.getMonth()+1).padStart(2,'0') + '-' +
            String(d.getDate()).padStart(2,'0');
          daily[key] = (daily[key] || 0) + 1;
        }
      }
    });

    // ── إحصائيات الاستبيانات ──────────────────────────────────
    var totalSurveys = surveys.length;
    var avgSat       = 0;
    
    // مقاييس تفصيلية للاستبيانات
    var surveyCatScores = { COM: {sum:0, count:0}, UNIT: {sum:0, count:0}, CARE: {sum:0, count:0}, CONT: {sum:0, count:0}, LAB: {sum:0, count:0} };
    var providerScores  = {};
    var npsCount        = { promoters: 0, passives: 0, detractors: 0 };
    var surveyDaily     = {};

    if (totalSurveys > 0) {
      var sumScores = 0;
      surveys.forEach(function(s) {
        var score = parseFloat(s.avgScore) || 0;
        sumScores += score;
        
        // NPS
        if (score >= 4.5) npsCount.promoters++;
        else if (score >= 3.5) npsCount.passives++;
        else npsCount.detractors++;

        // Provider Rankings
        var pName = s.providerName || 'غير محدد';
        if (!providerScores[pName]) providerScores[pName] = { sum: 0, count: 0 };
        providerScores[pName].sum += score;
        providerScores[pName].count++;

        // Category Averages (by summing the columns)
        // COM: 9..15 (7 questions)
        for(var i=9; i<=15; i++) { var v = parseFloat(s['Q_COM_'+(i<10?'0'+i:i)] || s[Object.keys(s)[i]]); if(v){ surveyCatScores.COM.sum += v; surveyCatScores.COM.count++; } }
        // Wait, looping by index on the object might be brittle if keys are out of order.
        // It's safer to just check keys starting with Q_COM, Q_UNIT, etc.
        for (var key in s) {
          var val = parseFloat(s[key]);
          if (!isNaN(val)) {
            if (key.indexOf('Q_COM_') === 0) { surveyCatScores.COM.sum += val; surveyCatScores.COM.count++; }
            else if (key.indexOf('Q_UNIT_') === 0) { surveyCatScores.UNIT.sum += val; surveyCatScores.UNIT.count++; }
            else if (key.indexOf('Q_CARE_') === 0) { surveyCatScores.CARE.sum += val; surveyCatScores.CARE.count++; }
            else if (key.indexOf('Q_CONT_') === 0) { surveyCatScores.CONT.sum += val; surveyCatScores.CONT.count++; }
            else if (key.indexOf('Q_LAB_') === 0) { surveyCatScores.LAB.sum += val; surveyCatScores.LAB.count++; }
          }
        }

        // Daily Trend
        if (s.timestamp) {
          var d = new Date(s.timestamp);
          var diff = (now - d) / msDay;
          if (diff <= 30) {
            var dateKey = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            if (!surveyDaily[dateKey]) surveyDaily[dateKey] = { sum: 0, count: 0 };
            surveyDaily[dateKey].sum += score;
            surveyDaily[dateKey].count++;
          }
        }
      });
      avgSat = Math.round((sumScores / totalSurveys) * 10) / 10;
    }

    // تجهيز مخرجات الاستبيانات التفصيلية
    var radarData = [
      surveyCatScores.COM.count ? (surveyCatScores.COM.sum / surveyCatScores.COM.count).toFixed(1) : 0,
      surveyCatScores.UNIT.count ? (surveyCatScores.UNIT.sum / surveyCatScores.UNIT.count).toFixed(1) : 0,
      surveyCatScores.CARE.count ? (surveyCatScores.CARE.sum / surveyCatScores.CARE.count).toFixed(1) : 0,
      surveyCatScores.CONT.count ? (surveyCatScores.CONT.sum / surveyCatScores.CONT.count).toFixed(1) : 0,
      surveyCatScores.LAB.count ? (surveyCatScores.LAB.sum / surveyCatScores.LAB.count).toFixed(1) : 0
    ];

    var provArr = [];
    for (var p in providerScores) {
      if (providerScores[p].count >= 3) { // نعرض فقط المنشآت التي لديها 3 استبيانات فأكثر لضمان الدقة
        provArr.push({ name: p, score: parseFloat((providerScores[p].sum / providerScores[p].count).toFixed(1)), count: providerScores[p].count });
      }
    }
    // إذا لم يكن هناك منشآت لديها 3 استبيانات، نعرض الكل
    if (provArr.length === 0) {
      for (var p in providerScores) {
        provArr.push({ name: p, score: parseFloat((providerScores[p].sum / providerScores[p].count).toFixed(1)), count: providerScores[p].count });
      }
    }
    provArr.sort(function(a, b) { return b.score - a.score; });
    var topProviders = provArr.slice(0, 5);
    var bottomProviders = provArr.slice(-5).reverse();

    var surveyDailyArr = [];
    for (var k in surveyDaily) {
      surveyDailyArr.push({ date: k, score: parseFloat((surveyDaily[k].sum / surveyDaily[k].count).toFixed(1)) });
    }
    surveyDailyArr.sort(function(a, b) { return a.date.localeCompare(b.date); });

    // ── حساب SLA Compliance ───────────────────────────────────
    var slaRate = total > 0
      ? Math.round(((total - breached) / total) * 100)
      : 100;

    // ── متوسط وقت الإغلاق ─────────────────────────────────────
    var avgResHrs = resCount > 0
      ? Math.round((totalResHrs / resCount) * 10) / 10
      : 0;

    // ── تحليل الكلمات ─────────────────────────────────────────
    var wordFreq = analyzeWordFrequency(allTexts);

    // ── بناء الاتجاه اليومي (آخر 30 يوم مرتبة) ───────────────
    var dailyArr = [];
    for (var k in daily) {
      dailyArr.push({ date: k, count: daily[k] });
    }
    dailyArr.sort(function(a, b) { return a.date.localeCompare(b.date); });

    var kpiData = {
      computedAt:         new Date(),
      totalComplaints:    total,
      openComplaints:     open + underReview,
      resolvedComplaints: resolved + closed,
      slaBreached:        breached,
      avgResolutionHours: avgResHrs,
      avgSatisfaction:    avgSat,
      totalSurveys:       totalSurveys,
      slaComplianceRate:  slaRate,
      categoryBreakdown:  catBreakdown,
      locationBreakdown:  locBreakdown,
      severityBreakdown:  severityCount,
      wordFrequency:      wordFreq,
      dailyTrend:         dailyArr,
      
      // تفاصيل الاستبيانات الجديدة
      surveysAnalytics: {
        nps:             npsCount,
        radarData:       radarData,
        topProviders:    topProviders,
        bottomProviders: bottomProviders,
        dailyTrend:      surveyDailyArr
      },

      // إضافية
      newCount:           open,
      underReviewCount:   underReview,
      resolvedCount:      resolved,
      closedCount:        closed,
    };

    // حفظ في KPI_Cache
    updateKpiCache(kpiData);
    return kpiData;

  } catch (e) {
    Logger.log('AnalyticsEngine Error: ' + e.message);
    return null;
  }
}

// ─── تحليل تكرار الكلمات في نصوص الشكاوى ────────────────────
function analyzeWordFrequency(texts) {
  var freq = {};
  texts.forEach(function(text) {
    if (!text) return;
    // تنظيف النص من الأرقام والرموز
    var cleaned = String(text)
      .replace(/[\u0660-\u0669\u06F0-\u06F90-9]/g, '')
      .replace(/[^\u0600-\u06FF\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    var words = cleaned.split(' ');
    words.forEach(function(w) {
      w = w.trim();
      if (w.length < 3) return;              // تجاهل الكلمات القصيرة جداً
      if (STOP_WORDS.indexOf(w) !== -1) return; // تجاهل كلمات الوقف
      freq[w] = (freq[w] || 0) + 1;
    });
  });

  // ترتيب تنازلي وإرجاع أعلى 50 كلمة
  var sorted = Object.keys(freq)
    .map(function(w) { return { word: w, count: freq[w] }; })
    .sort(function(a, b) { return b.count - a.count; })
    .slice(0, 50);

  return sorted;
}

// ─── تحديث KPI Cache يدوياً (يُستدعى من SlaMonitor أيضاً) ──
function refreshKpiCache() {
  computeAllKpis();
}

// ─── Trigger لتحديث KPIs كل 30 دقيقة ────────────────────────
function setupKpiRefreshTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'refreshKpiCache') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('refreshKpiCache')
    .timeBased()
    .everyMinutes(30)
    .create();
  Logger.log('KPI Refresh Trigger created ✓');
}
