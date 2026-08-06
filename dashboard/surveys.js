// ════════════════════════════════════════════════════════════
// UHIA Luxor — Surveys Dashboard JS V7.0
// ════════════════════════════════════════════════════════════

var API_URL = window.SCRIPT_URL || '';
var charts  = {};
var COLORS  = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#14b8a6','#f43f5e','#84cc16','#f97316','#a855f7'];
var RADAR_AXES = ['سهولة الحجز','جودة الاستقبال','الكفاءة الطبية','الصيدلية','نظافة المنشأة','سرعة الإجراءات'];
var JOURNEY_STEPS = [
  { label:'سهولة الحجز',     keys:['سهولة حجز','حجز الموعد','الحصول على الخدمة'], icon:'📅' },
  { label:'إجراءات التسجيل', keys:['إجراءات التسجيل','دخول المنشأة','سرعة وبساطة'], icon:'📝' },
  { label:'تعامل الطاقم',    keys:['تعامل معك الفريق','احترام','خصوصية'], icon:'👨‍⚕️' },
  { label:'الخدمة الطبية',   keys:['خطة العلاج','الاستماع','شرح'], icon:'🩺' },
  { label:'الصيدلية',        keys:['صرف الأدوية','صيدلية','دواء'], icon:'💊' },
  { label:'الرضا العام',     keys:['تنصح','توصي'], icon:'⭐' }
];

// ──────────────────────────────────────────────
// Particle Background
// ──────────────────────────────────────────────
(function initParticles() {
  var canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  for (var i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      a: Math.random() * 0.4 + 0.1,
      c: [
        'rgba(59,130,246,', 'rgba(16,185,129,', 'rgba(139,92,246,'
      ][Math.floor(Math.random()*3)]
    });
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(function(p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c + p.a + ')';
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
})();

// ──────────────────────────────────────────────
// Gradient Helper (3D effect)
// ──────────────────────────────────────────────
function getGrad(ctx, c1, c2) {
  var g = ctx.createLinearGradient(0, 0, 0, 400);
  g.addColorStop(0, c1); g.addColorStop(1, c2 || 'transparent');
  return g;
}
function destroyChart(k) { if (charts[k]) { charts[k].destroy(); charts[k] = null; } }

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
window.addEventListener('load', function() {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Cairo', sans-serif";
  Chart.defaults.font.size = 12;
  updateClock(); setInterval(updateClock, 1000);
  loadData();
});

function updateClock() {
  var n = new Date();
  var t = document.getElementById('clockTime');
  var d = document.getElementById('clockDate');
  if (t) t.innerText = n.toLocaleTimeString('ar-EG');
  if (d) d.innerText = n.toLocaleDateString('ar-EG',{weekday:'short',year:'numeric',month:'short',day:'numeric'});
}

function switchSection(id, el) {
  if (event) event.preventDefault();
  document.querySelectorAll('.nav-tabs a').forEach(function(a){a.classList.remove('active')});
  if (el) el.classList.add('active');
  document.querySelectorAll('.content-sections > section').forEach(function(s){s.classList.remove('active-sec')});
  var sec = document.getElementById(id);
  if (sec) sec.classList.add('active-sec');
}

// ──────────────────────────────────────────────
// Load Data
// ──────────────────────────────────────────────
function loadData() {
  if (!API_URL) { alert('رابط API غير موجود في config.js!'); return; }
  document.getElementById('fullLoading').style.display = 'flex';
  fetch(API_URL + '?action=getDashboardData')
    .then(function(r){ return r.json(); })
    .then(function(res){
      document.getElementById('fullLoading').style.display = 'none';
      if (!res.success) { alert('خطأ: ' + (res.error||'غير محدد')); return; }
      if (res.survey) renderAll(res.survey);
    })
    .catch(function(e){
      document.getElementById('fullLoading').style.display = 'none';
      console.error(e);
      alert('تعذّر الاتصال بالخادم. تأكد من رابط API في config.js');
    });
}

// ──────────────────────────────────────────────
// Render All
// ──────────────────────────────────────────────
function renderAll(s) {
  renderKPIs(s);
  renderSectorPie(s);
  renderCategoryDonut(s);
  renderTrend(s);
  renderFacilityRank(s);
  renderQuestionStacked(s);
  renderRadar(s);
  renderHeatmap(s);
  renderPolar(s);
  renderNPS(s);
  renderJourney(s);
  renderLocationBar(s);
  renderScatter(s);
  renderRecentSurveys(s);
  renderTeamMixed(s);
  renderTop3(s);
  renderTeamTable(s);
  renderEmployeeBubble(s);
}

// ── KPIs ──
function renderKPIs(s) {
  animateCount('kpiSurveyTotal', 0, s.surveyCount || 0, '');
  animateCount('kpiSatisfaction', 0, s.avgSatisfaction || 0, '%');
  var nps = s.npsScore || 0;
  document.getElementById('kpiNPS').innerText = (nps > 0 ? '+' : '') + nps;
  animateCount('kpiCovered', 0, s.coveredFacilities || 0, '');
  var satEl = document.getElementById('kpiSatTrend');
  if (satEl) satEl.innerText = s.avgSatisfaction >= 70 ? '▲ مستوى جيد' : s.avgSatisfaction >= 50 ? '◆ مستوى متوسط' : '▼ يحتاج تحسيناً';
}
function animateCount(id, from, to, suffix) {
  var el = document.getElementById(id);
  if (!el) return;
  var start = null, dur = 1200;
  function step(ts) {
    if (!start) start = ts;
    var p = Math.min((ts - start) / dur, 1);
    var ease = 1 - Math.pow(1 - p, 3);
    el.innerText = Math.round(from + (to - from) * ease) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── 1. Sector Pie ──
function renderSectorPie(s) {
  var L = Object.keys(s.sectorSplit || {});
  var V = L.map(function(k){ return s.sectorSplit[k]; });
  destroyChart('sectorPie');
  charts.sectorPie = new Chart(document.getElementById('sectorPieChart'), {
    type: 'pie',
    data: { labels: L, datasets: [{ data: V, backgroundColor: ['#3b82f6','#10b981'], borderWidth: 3, borderColor: '#060b18', hoverOffset: 18 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 20, font: { size: 13, weight: 'bold' } } } } }
  });
  var dom = V[0] > V[1] ? L[0] : L[1];
  var pct = V.length ? Math.round(Math.max.apply(null,V) / V.reduce(function(a,b){return a+b;},0) * 100) : 0;
  setInsight('smartInsightSector', dom + ' يمثل الجزء الأكبر بنسبة ' + pct + '% من إجمالي الاستبيانات.', 'info');
}

// ── 2. Category Donut ──
function renderCategoryDonut(s) {
  var L = (s.categoryStats||[]).map(function(c){return c.label});
  var V = (s.categoryStats||[]).map(function(c){return c.count});
  destroyChart('catDonut');
  charts.catDonut = new Chart(document.getElementById('categoryDonutChart'), {
    type: 'doughnut',
    data: { labels: L, datasets: [{ data: V, backgroundColor: COLORS, borderWidth: 3, borderColor: '#060b18', hoverOffset: 16 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 14 } } } }
  });
  if (L.length) setInsight('smartInsightCat', '"' + L[0] + '" يستأثر بأعلى عدد من الاستبيانات بين أنواع المنشآت.', 'info');
}

// ── 3. Trend Line ──
function renderTrend(s) {
  var K = Object.keys(s.dailyTrend || {}).sort();
  var V = K.map(function(k){return s.dailyTrend[k];});
  destroyChart('surveyTrend');
  var ctx = document.getElementById('surveyTrendChart').getContext('2d');
  charts.surveyTrend = new Chart(ctx, {
    type: 'line',
    data: { labels: K, datasets: [{ label: 'استبيانات يومية', data: V, borderColor: '#8b5cf6', backgroundColor: getGrad(ctx,'rgba(139,92,246,0.35)','rgba(139,92,246,0)'), fill: true, tension: 0.45, borderWidth: 3, pointRadius: 4, pointHoverRadius: 8, pointBackgroundColor: '#8b5cf6' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' } } } }
  });
  if (V.length) {
    var mx = Math.max.apply(null,V), mxD = K[V.indexOf(mx)];
    setInsight('smartInsightTrend', 'بلغ النشاط ذروته في ' + mxD + ' بتسجيل ' + mx + ' استبيانات في يوم واحد.', 'good');
  }
}

// ── 4. Facility Rank (مستشفيات فقط) ──
function renderFacilityRank(s) {
  // فلترة المستشفيات فقط
  var fRank = (s.facilityRanking||[]).filter(function(f){
    return f.label && f.label.indexOf('مستشفى') !== -1;
  }).slice(0,14);
  var L = fRank.map(function(f){return f.label;});
  var V = fRank.map(function(f){return f.satisfaction;});
  var C = V.map(function(v){return v>=70?'rgba(16,185,129,0.85)':v>=50?'rgba(245,158,11,0.85)':'rgba(239,68,68,0.85)';});
  destroyChart('facRank');
  // حساب الارتفاع بناءً على عدد المستشفيات
  var chartH = Math.max(350, fRank.length * 52);
  document.getElementById('facilityRankChart').parentElement.style.height = chartH + 'px';
  charts.facRank = new Chart(document.getElementById('facilityRankChart').getContext('2d'), {
    type: 'bar',
    data: { labels: L, datasets: [{ label: 'نسبة الرضا %', data: V, backgroundColor: C, borderRadius: 8, borderWidth: 0 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { max: 100, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { grid: { display: false }, ticks: { font: { size: 12, weight: 'bold' } } } }, plugins: { legend: { display: false } } }
  });
  if(fRank.length) {
    var low = fRank.reduce(function(a,b){return a.satisfaction<b.satisfaction?a:b;});
    var type = low.satisfaction < 50 ? 'danger' : low.satisfaction < 70 ? 'warn' : 'good';
    setInsight('smartInsightFac', '"' + low.label + '" تُسجّل أدنى نسبة رضا بـ ' + low.satisfaction + '% — وتحتاج متابعة مباشرة.', type);
  }
}

// ── 5. Question Stacked (نص كامل) ──
function renderQuestionStacked(s) {
  var Qs = (s.questionAnalysis||[]).filter(function(q){return q.satisfied_very>0||q.satisfied>0||q.unsatisfied>0;});
  // إظهار النص كاملاً بدون قطع
  var L = Qs.map(function(q){return q.text;});
  destroyChart('questionStacked');
  // ضبط الارتفاع بناءً على عدد الأسئلة
  var chartH = Math.max(400, Qs.length * 65);
  document.getElementById('questionStackedChart').parentElement.style.height = chartH + 'px';
  charts.questionStacked = new Chart(document.getElementById('questionStackedChart'), {
    type: 'bar',
    data: { labels: L, datasets: [
      { label: 'راضٍ جداً', data: Qs.map(function(q){return q.satisfied_very;}), backgroundColor: 'rgba(16,185,129,0.85)', borderRadius: 4 },
      { label: 'راضٍ',     data: Qs.map(function(q){return q.satisfied;}),      backgroundColor: 'rgba(245,158,11,0.85)' },
      { label: 'غير راضٍ', data: Qs.map(function(q){return q.unsatisfied;}),   backgroundColor: 'rgba(239,68,68,0.85)', borderRadius: 4 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      scales: {
        x: { stacked: true, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 }, autoSkip: false, maxRotation: 0 } }
      },
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { title: function(items){ return items[0].label; } } } }
    }
  });
  if (Qs.length) {
    var worst = Qs.reduce(function(a,b){return a.unsatisfied>b.unsatisfied?a:b;});
    setInsight('smartInsightQ', 'السؤال المتعلق بـ "' + worst.text + '" يسجّل أعلى نسبة عدم رضا.', 'warn');
  }
}

// ── 6. Radar Chart ──
function renderRadar(s) {
  var qMap = {};
  (s.questionAnalysis||[]).forEach(function(q){
    var k = q.text;
    var total = (q.satisfied_very||0)+(q.satisfied||0)+(q.unsatisfied||0);
    if (total===0) return;
    var score = ((q.satisfied_very||0)*3+(q.satisfied||0)*2+(q.unsatisfied||0)*1)/total/3*100;
    RADAR_AXES.forEach(function(ax){
      var keywords = {
        'سهولة الحجز':['حجز','موعد','الحصول على الخدمة'],
        'جودة الاستقبال':['التسجيل','دخول المنشأة','سرعة وبساطة'],
        'الكفاءة الطبية':['الفريق الطبي','الطبيب','كفاءة','شرح'],
        'الصيدلية':['دواء','أدوية','صيدلية'],
        'نظافة المنشأة':['نظافة','راحة','غرف'],
        'سرعة الإجراءات':['انتظار','سرعة','تدخل','إجراء']
      };
      var found = (keywords[ax]||[]).some(function(w){return k.indexOf(w)!==-1;});
      if (found) { if (!qMap[ax]) qMap[ax]=[]; qMap[ax].push(score); }
    });
  });
  var vals = RADAR_AXES.map(function(ax){ var arr=qMap[ax]||[]; return arr.length?Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length):50; });
  destroyChart('radar');
  charts.radar = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: { labels: RADAR_AXES, datasets: [{ label: 'مؤشر الجودة', data: vals, backgroundColor: 'rgba(59,130,246,0.2)', borderColor: '#3b82f6', borderWidth: 2.5, pointBackgroundColor: '#3b82f6', pointRadius: 5, pointHoverRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, backdropColor: 'transparent', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.08)' }, angleLines: { color: 'rgba(255,255,255,0.08)' }, pointLabels: { font: { size: 13, weight: 'bold' }, color: '#cbd5e1' } } }, plugins: { legend: { display: false } } }
  });
  var min = Math.min.apply(null,vals), minAx = RADAR_AXES[vals.indexOf(min)];
  var type = min >= 70 ? 'good' : min >= 50 ? 'warn' : 'danger';
  setInsight('smartInsightRadar', 'محور "' + minAx + '" يُسجّل أدنى قيمة في الشبكة بنسبة ' + min + '% — وهو يستحق الأولوية في التحسين.', type);
}

// ── 7. Heatmap (مستشفيات فقط) ──
function renderHeatmap(s) {
  var axes = RADAR_AXES;
  // فلترة المستشفيات فقط
  var facs = (s.facilityRanking||[]).filter(function(f){
    return f.label && f.label.indexOf('مستشفى') !== -1;
  }).slice(0,10);
  if (!facs.length) return;

  var qMap = {};
  (s.questionAnalysis||[]).forEach(function(q){
    var total=(q.satisfied_very||0)+(q.satisfied||0)+(q.unsatisfied||0);
    if(!total) return;
    var score=((q.satisfied_very||0)*3+(q.satisfied||0)*2+(q.unsatisfied||0)*1)/total/3*100;
    axes.forEach(function(ax){
      var keywords={'سهولة الحجز':['حجز','موعد'],'جودة الاستقبال':['التسجيل','دخول'],'الكفاءة الطبية':['الطبيب','طبي'],'الصيدلية':['دواء','صيدلية'],'نظافة المنشأة':['نظافة','غرف'],'سرعة الإجراءات':['انتظار','سرعة']};
      if((keywords[ax]||[]).some(function(w){return q.text.indexOf(w)!==-1;})){if(!qMap[ax])qMap[ax]=[];qMap[ax].push(score);}
    });
  });
  var axVals = {};
  axes.forEach(function(ax){var arr=qMap[ax]||[];axVals[ax]=arr.length?Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length):null;});

  var html='<table class="heatmap-table"><thead><tr><th>المنشأة</th>';
  axes.forEach(function(ax){html+='<th>'+ax+'</th>';});
  html+='</tr></thead><tbody>';
  facs.forEach(function(f){
    html+='<tr><td class="row-label">'+f.label+'</td>';
    axes.forEach(function(ax){
      var base=axVals[ax];
      if(base===null){html+='<td class="hm-0">—</td>';return;}
      var v=Math.round(base+(f.satisfaction-70)*0.4);
      v=Math.max(20,Math.min(100,v));
      var cls=v>=90?'hm-90':v>=80?'hm-80':v>=70?'hm-70':v>=60?'hm-60':v>=50?'hm-50':v>=40?'hm-40':'hm-30';
      html+='<td class="'+cls+'">'+v+'%</td>';
    });
    html+='</tr>';
  });
  html+='</tbody></table>';
  document.getElementById('heatmapWrap').innerHTML=html;

  var minFac=facs.reduce(function(a,b){return a.satisfaction<b.satisfaction?a:b;});
  var type=minFac.satisfaction<50?'danger':minFac.satisfaction<70?'warn':'good';
  setInsight('smartInsightHeatmap','"'+minFac.label+'" يُظهر مربعات حمراء في أغلب المحاور — ويستلزم خطة تحسين شاملة.',type);
}

// ── 8. Polar Area ──
function renderPolar(s) {
  var L=Object.keys(s.locationStats||{});
  var V=L.map(function(k){return s.locationStats[k];});
  var C=COLORS.slice(0,L.length).map(function(c,i){return c;});
  destroyChart('polar');
  charts.polar=new Chart(document.getElementById('polarChart'),{
    type:'polarArea',
    data:{labels:L,datasets:[{data:V,backgroundColor:C.map(function(c){return c.replace(')',',0.7)').replace('rgb','rgba');})||C,borderColor:C,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{padding:18,font:{size:12}}}},scales:{r:{ticks:{backdropColor:'transparent'},grid:{color:'rgba(255,255,255,0.08)'}}}}
  });
  if(L.length){
    var mx=Math.max.apply(null,V),mxL=L[V.indexOf(mx)];
    setInsight('smartInsightPolar','"'+mxL+'" تحتضن الحصة الأكبر من الاستبيانات بواقع '+mx+' استبيان.','info');
  }
}

// ── 9. NPS Gauge ──
function renderNPS(s) {
  var nps=s.npsDist||{yes:0,no:0};
  destroyChart('npsGauge');
  charts.npsGauge=new Chart(document.getElementById('npsGaugeChart'),{
    type:'doughnut',
    data:{labels:['يوصون بالخدمة','لا يوصون'],datasets:[{data:[nps.yes,nps.no],backgroundColor:['rgba(16,185,129,0.85)','rgba(239,68,68,0.65)'],borderWidth:3,borderColor:'#060b18'}]},
    options:{responsive:true,maintainAspectRatio:false,circumference:180,rotation:270,cutout:'72%',plugins:{legend:{position:'bottom',labels:{padding:18,font:{size:12}}}}}
  });
  var total=(nps.yes||0)+(nps.no||0);
  var pct=total?Math.round(nps.yes/total*100):0;
  var type=pct>=70?'good':pct>=50?'warn':'danger';
  setInsight('smartInsightNPS',pct+'% من المنتفعين يوصون بالخدمة '+(pct>=70?'— مستوى ثقة جيد.':pct>=50?'— هامش تحسين متاح.':'— يستوجب مراجعة عاجلة.'),type);
}

// ── 10. Patient Journey Funnel ──
function renderJourney(s) {
  var Qs = s.questionAnalysis||[];
  var journeyData = JOURNEY_STEPS.map(function(step){
    var matched=Qs.filter(function(q){return step.keys.some(function(k){return q.text.indexOf(k)!==-1;});});
    if(!matched.length) return {label:step.label,icon:step.icon,score:0,found:false};
    var total=matched.reduce(function(a,q){return a+(q.satisfied_very||0)+(q.satisfied||0)+(q.unsatisfied||0);},0);
    if(!total) return {label:step.label,icon:step.icon,score:0,found:false};
    var score=matched.reduce(function(a,q){return a+((q.satisfied_very||0)*3+(q.satisfied||0)*2+(q.unsatisfied||0)*1);},0)/total/3*100;
    return {label:step.label,icon:step.icon,score:Math.round(score),found:true};
  });

  var html='';
  journeyData.forEach(function(step){
    var score=step.found?step.score:55;
    var col=score>=70?'linear-gradient(90deg,#10b981,#059669)':score>=50?'linear-gradient(90deg,#f59e0b,#d97706)':'linear-gradient(90deg,#ef4444,#dc2626)';
    var w=Math.max(20,score);
    html+='<div class="funnel-step">';
    html+='<div class="funnel-label">'+step.icon+' '+step.label+'</div>';
    html+='<div class="funnel-bar-wrap"><div class="funnel-bar" style="width:'+w+'%;background:'+col+';">'+
      '<span class="funnel-pct">'+score+'%</span></div></div>';
    html+='<div class="funnel-score" style="color:'+(score>=70?'#34d399':score>=50?'#fbbf24':'#f87171')+'">'+score+'%</div>';
    html+='</div>';
  });
  document.getElementById('funnelWrap').innerHTML=html;

  var worst=journeyData.reduce(function(a,b){return (b.found&&b.score<a.score)?b:a;},{score:100,label:'—',found:true});
  if(worst.found){
    var type=worst.score<50?'danger':'warn';
    setInsight('smartInsightJourney','مرحلة "'+worst.label+'" تُسجّل أدنى مستوى رضا في رحلة المريض بنسبة '+worst.score+'% — تستحق التدخل الفوري.',type);
  }
}

// ── 11. Location Bar ──
function renderLocationBar(s) {
  var L=Object.keys(s.locationStats||{});
  var V=L.map(function(k){return s.locationStats[k];});
  destroyChart('locBar');
  var ctx=document.getElementById('locationBarChart').getContext('2d');
  charts.locBar=new Chart(ctx,{
    type:'bar',
    data:{labels:L,datasets:[{label:'عدد الاستبيانات',data:V,backgroundColor:getGrad(ctx,'rgba(6,182,212,0.9)','rgba(6,182,212,0.15)'),borderRadius:8,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{grid:{color:'rgba(255,255,255,0.04)'}}}}
  });
}

// ── 12. Scatter ──
function renderScatter(s) {
  var data=(s.facilityRanking||[]).map(function(f){return{x:f.count,y:f.satisfaction,label:f.label};});
  destroyChart('scatter');
  charts.scatter=new Chart(document.getElementById('facilityScatterChart'),{
    type:'scatter',
    data:{datasets:[{label:'المنشآت',data:data,backgroundColor:'rgba(139,92,246,0.75)',borderColor:'#a78bfa',borderWidth:1.5,pointRadius:8,pointHoverRadius:12}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{title:{display:true,text:'عدد الاستبيانات'}},y:{title:{display:true,text:'نسبة الرضا %'},max:100,min:0}},
      plugins:{tooltip:{callbacks:{label:function(c){return c.raw.label+' ('+c.raw.x+' استبيان، '+c.raw.y+'%)';}}}}
    }
  });
}

// ── 13. Recent Surveys (مستشفيات فقط) ──
function renderRecentSurveys(s) {
  var tb=document.getElementById('recentSurveysBody');
  // فلترة المستشفيات فقط
  var rows=(s.recentSurveys||[]).filter(function(r){
    return r.facility && r.facility.indexOf('مستشفى') !== -1;
  });
  if(!rows.length){tb.innerHTML='<tr><td colspan="2" style="text-align:center;padding:20px;color:#94a3b8;">لا توجد بيانات لمستشفيات</td></tr>';return;}
  var h='';
  rows.forEach(function(r){
    var col=r.satisfaction>=70?'#34d399':r.satisfaction>=50?'#fbbf24':'#f87171';
    h+='<tr><td>'+r.facility+'</td><td><strong style="color:'+col+';font-size:1.1rem;">'+r.satisfaction+'%</strong></td></tr>';
  });
  tb.innerHTML=h;
}

// ── 14. Team Mixed ──
function renderTeamMixed(s) {
  var L=(s.teamStats||[]).map(function(t){return t.name;});
  var Count=(s.teamStats||[]).map(function(t){return t.count;});
  var Sat=(s.teamStats||[]).map(function(t){return t.satisfaction;});
  destroyChart('teamMixed');
  var ctx=document.getElementById('teamMixedChart').getContext('2d');
  charts.teamMixed=new Chart(ctx,{
    type:'bar',
    data:{labels:L,datasets:[
      {type:'line',label:'نسبة الرضا %',data:Sat,borderColor:'#facc15',backgroundColor:'rgba(250,204,21,0.12)',borderWidth:3,yAxisID:'y1',tension:0.4,fill:true,pointRadius:6,pointBackgroundColor:'#facc15',pointHoverRadius:9},
      {type:'bar',label:'إجمالي الاستبيانات',data:Count,backgroundColor:getGrad(ctx,'rgba(59,130,246,0.85)','rgba(59,130,246,0.2)'),borderRadius:10,yAxisID:'y'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      scales:{x:{grid:{display:false}},y:{display:true,position:'right',title:{display:true,text:'العدد'},grid:{color:'rgba(255,255,255,0.04)'}},y1:{display:true,position:'left',max:100,title:{display:true,text:'الرضا %'},grid:{drawOnChartArea:false}}},
      plugins:{tooltip:{padding:14,titleFont:{size:15},bodyFont:{size:13}}}
    }
  });
  if(L.length){
    var best=s.teamStats.reduce(function(a,b){return b.count>a.count?b:a;});
    setInsight('smartInsightTeam','فريق "'+best.name+'" يتصدر من حيث الإنتاجية بـ '+best.count+' استبيان بنسبة رضا '+best.satisfaction+'%.',best.satisfaction>=70?'good':'warn');
  }
}

// ── 15. Top 3 ──
function renderTop3(s) {
  var c=document.getElementById('top3Container');
  var top3=s.top3Teams||[];
  if(!top3.length){c.innerHTML='<p style="padding:40px;text-align:center;color:#94a3b8;">لا توجد بيانات</p>';return;}
  var em=['🥇','🥈','🥉'],cl=['gold','silver','bronze'];
  c.innerHTML=top3.map(function(t,i){
    // إضافة "فريق أ" قبل اسم الفريق
    var displayName = 'فريق أ ' + t.name;
    return '<div class="medal-card '+cl[i]+'"><span class="medal-emoji">'+em[i]+'</span>'+
      '<div class="medal-name">'+displayName+'</div>'+
      '<div class="medal-count">'+t.count+'</div>'+
      '<div class="medal-label">استبيان • '+t.satisfaction+'% رضا</div></div>';
  }).join('');
}

// ── 16. Team Table ──
function renderTeamTable(s) {
  var tb=document.querySelector('#teamDetailsTable tbody');
  if(!tb) return;
  var stats=s.teamStats||[];
  if(!stats.length){tb.innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8;">لا توجد بيانات</td></tr>';return;}
  tb.innerHTML=stats.map(function(t){
    var col=t.satisfaction>=70?'#34d399':t.satisfaction>=50?'#fbbf24':'#f87171';
    var fac=Object.keys(t.facilities||{}).length;
    // إضافة "فريق أ" قبل اسم الفريق
    var displayName = 'فريق أ ' + t.name;
    return '<tr>'+
      '<td><strong style="font-size:1rem;">'+displayName+'</strong></td>'+
      '<td><span style="background:rgba(59,130,246,0.18);color:#93c5fd;border:1px solid rgba(59,130,246,0.4);padding:5px 14px;border-radius:20px;font-weight:800;">'+t.count+'</span></td>'+
      '<td><strong style="color:'+col+';font-size:1.25rem;text-shadow:0 0 12px '+col+'50;">'+t.satisfaction+'%</strong></td>'+
      '<td style="color:#94a3b8;">'+fac+' منشأة</td>'+
      '</tr>';
  }).join('');
}

// ── 17. Employee Bubble ──
function renderEmployeeBubble(s) {
  var emps=(s.employeeStats||[]).slice(0,20).map(function(e,i){
    return { x: e.count, y: e.satisfaction, r: Math.max(8, Math.min(30, e.count * 0.8)), label: e.team + ' — ' + e.employee };
  });
  destroyChart('empBubble');
  charts.empBubble=new Chart(document.getElementById('employeeBubbleChart'),{
    type:'bubble',
    data:{datasets:[{label:'الموظفون',data:emps,backgroundColor:COLORS.map(function(c){return c.replace('#','rgba(').replace(/(..)(..)(..)$/,function(m,r,g,b){return parseInt(r,16)+','+parseInt(g,16)+','+parseInt(b,16)+',0.7)';});})||'rgba(139,92,246,0.7)',borderColor:'rgba(255,255,255,0.3)',borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{x:{title:{display:true,text:'عدد الاستبيانات',font:{size:13,weight:'bold'}},grid:{color:'rgba(255,255,255,0.04)'}},y:{title:{display:true,text:'نسبة الرضا %',font:{size:13,weight:'bold'}},max:100,min:0,grid:{color:'rgba(255,255,255,0.04)'}}},
      plugins:{tooltip:{callbacks:{label:function(c){return c.raw.label+' | '+c.raw.x+' استبيان، '+c.raw.y+'% رضا';}}},legend:{display:false}}
    }
  });
  if(emps.length){
    var best=emps.reduce(function(a,b){return(b.y>a.y||(b.y===a.y&&b.x>a.x))?b:a;});
    setInsight('smartInsightBubble','"'+best.label+'" يمثل الأداء الأمثل: '+best.x+' استبيان بنسبة رضا '+best.y+'% — نموذج يُحتذى به.',best.y>=70?'good':'info');
  }
}

// ── Smart Insight Setter ──
function setInsight(id, text, type) {
  var el=document.getElementById(id);
  if(!el) return;
  var icon={'good':'✅','warn':'⚠️','danger':'🔴','info':'📌'}[type]||'💡';
  var cls={'good':'insight-good','warn':'insight-warn','danger':'insight-danger','info':'insight-info'}[type]||'insight-info';
  el.className='panel-insight '+cls;
  el.innerHTML='<span>'+icon+'</span><span>'+text+'</span>';
}
