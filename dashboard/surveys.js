// ═══════════════════════════════════════════════════════════════
// UHIA Luxor System — Surveys Standalone Dashboard JS V6.0
// ═══════════════════════════════════════════════════════════════

var API_URL = window.SCRIPT_URL || '';
var charts = {};
var COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#14b8a6','#f43f5e','#84cc16'];

// ─── 3D Gradient Helper ───
function getGradient(ctx, colorStart, colorEnd) {
  if (!ctx) return colorStart;
  var g = ctx.createLinearGradient(0, 0, 0, 400);
  g.addColorStop(0, colorStart);
  g.addColorStop(1, colorEnd || 'transparent');
  return g;
}

// ─── Init ───
window.addEventListener('load', function() {
  Chart.defaults.color = '#cbd5e1';
  Chart.defaults.font.family = "'Cairo', sans-serif";
  Chart.defaults.font.size = 13;
  updateClock(); setInterval(updateClock, 1000);
  loadData();
});

// ─── Navigation ───
function switchSection(secId, el) {
  if (event) event.preventDefault();
  document.querySelectorAll('.nav-tabs a').forEach(function(a){a.classList.remove('active')});
  if (el) el.classList.add('active');
  document.querySelectorAll('.content-sections > section').forEach(function(s){s.classList.remove('active-sec')});
  var sec = document.getElementById(secId);
  if (sec) sec.classList.add('active-sec');
}

function updateClock() {
  var now = new Date();
  var timeEl = document.getElementById('clockTime');
  var dateEl = document.getElementById('clockDate');
  if (timeEl) timeEl.innerText = now.toLocaleTimeString('ar-EG');
  if (dateEl) dateEl.innerText = now.toLocaleDateString('ar-EG');
}

// ─── Load Data ───
function loadData() {
  if (!API_URL) { alert('رابط API غير موجود!'); return; }
  document.getElementById('fullLoading').style.display = 'flex';
  
  fetch(API_URL + '?action=getDashboardData')
  .then(function(r){return r.json()})
  .then(function(res){
    document.getElementById('fullLoading').style.display = 'none';
    if (!res.success) { alert('خطأ: ' + (res.error||'')); return; }
    if (res.survey) renderSurveyDashboard(res.survey);
  })
  .catch(function(e){ 
    document.getElementById('fullLoading').style.display='none'; 
    console.error(e); 
    alert('تعذر الاتصال بالخادم'); 
  });
}

// ═══════════════════════════════════════
// SURVEY DASHBOARD (V6.0)
// ═══════════════════════════════════════
function renderSurveyDashboard(survey) {
  // KPIs
  document.getElementById('kpiSurveyTotal').innerText = survey.surveyCount || 0;
  document.getElementById('kpiSatisfaction').innerText = survey.avgSatisfaction + '%';
  document.getElementById('kpiNPS').innerText = (survey.npsScore > 0 ? '+' : '') + survey.npsScore;
  document.getElementById('kpiCovered').innerText = survey.coveredFacilities || 0;

  // 1. Sector Pie
  var secL = Object.keys(survey.sectorSplit||{});
  var secV = secL.map(function(k){return survey.sectorSplit[k]});
  destroyChart('sectorPie');
  charts.sectorPie = new Chart(document.getElementById('sectorPieChart'), {
    type:'pie', data:{labels:secL, datasets:[{data:secV,backgroundColor:['#3b82f6','#10b981'],borderWidth:2,borderColor:'#0a0f1c',hoverOffset:10}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}
  });

  // 2. Category Donut
  var catL = (survey.categoryStats||[]).map(function(c){return c.label});
  var catV = (survey.categoryStats||[]).map(function(c){return c.count});
  destroyChart('catDonut');
  charts.catDonut = new Chart(document.getElementById('categoryDonutChart'), {
    type:'doughnut', data:{labels:catL, datasets:[{data:catV,backgroundColor:COLORS,borderWidth:2,borderColor:'#0a0f1c',hoverOffset:10}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'70%'}
  });

  // 3. Survey Trend Line
  var tKeys = Object.keys(survey.dailyTrend||{}).sort();
  var tVals = tKeys.map(function(k){return survey.dailyTrend[k]});
  destroyChart('surveyTrend');
  var ctxSTrend = document.getElementById('surveyTrendChart').getContext('2d');
  charts.surveyTrend = new Chart(ctxSTrend, {
    type:'line', data:{labels:tKeys, datasets:[{label:'عدد الاستبيانات',data:tVals,borderColor:'#8b5cf6',backgroundColor:getGradient(ctxSTrend,'rgba(139,92,246,0.4)','rgba(139,92,246,0)'),fill:true,tension:0.4,borderWidth:3,pointRadius:4,pointHoverRadius:7}]},
    options:{responsive:true,maintainAspectRatio:false}
  });

  // 4. Facility Rank (Horizontal Bar)
  var fRank = (survey.facilityRanking||[]).slice(0,12);
  var fLabels = fRank.map(function(f){return f.label});
  var fSat = fRank.map(function(f){return f.satisfaction});
  var fColors = fSat.map(function(v){return v>=70?'#10b981':v>=50?'#f59e0b':'#ef4444'});
  destroyChart('facRank');
  var ctxFRank = document.getElementById('facilityRankChart').getContext('2d');
  charts.facRank = new Chart(ctxFRank, {
    type:'bar', data:{labels:fLabels, datasets:[{label:'نسبة الرضا%',data:fSat,backgroundColor:fColors,borderRadius:6,borderWidth:1,borderColor:'rgba(0,0,0,0.2)'}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{max:100,grid:{color:'rgba(255,255,255,0.05)'}},y:{grid:{display:false}}}}
  });

  // 5. Question Stacked Bar
  renderQuestionChart(survey.questionAnalysis||[]);

  // 6. NPS Gauge (Half Doughnut)
  var nps = survey.npsDist || {yes:0,no:0};
  destroyChart('npsGauge');
  charts.npsGauge = new Chart(document.getElementById('npsGaugeChart'), {
    type:'doughnut', data:{
      labels:['نعم (يوصي)','لا'],
      datasets:[{data:[nps.yes,nps.no],backgroundColor:['#10b981','#ef4444'],borderWidth:2,borderColor:'#0a0f1c'}]
    },
    options:{responsive:true,maintainAspectRatio:false,circumference:180,rotation:270,cutout:'75%',plugins:{legend:{position:'bottom'}}}
  });

  // 7. Facility Scatter
  var scatterData = (survey.facilityRanking||[]).map(function(f){return {x:f.count,y:f.satisfaction,label:f.label}});
  destroyChart('facScatter');
  charts.facScatter = new Chart(document.getElementById('facilityScatterChart'), {
    type:'scatter', data:{datasets:[{label:'المنشآت',data:scatterData,backgroundColor:'rgba(139,92,246,0.8)',borderColor:'#fff',borderWidth:2,pointRadius:8,pointHoverRadius:12}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{title:{display:true,text:'عدد الاستبيانات'}},y:{title:{display:true,text:'نسبة الرضا%'},max:100}},
      plugins:{tooltip:{callbacks:{label:function(ctx){return ctx.raw.label+' ('+ctx.raw.x+' استبيان, '+ctx.raw.y+'%)';}}}}}
  });

  // 8. Location Bar
  var locL = Object.keys(survey.locationStats||{});
  var locV = locL.map(function(k){return survey.locationStats[k]});
  destroyChart('locBar');
  var ctxLoc = document.getElementById('locationBarChart').getContext('2d');
  charts.locBar = new Chart(ctxLoc, {
    type:'bar', data:{labels:locL, datasets:[{label:'عدد العينات',data:locV,backgroundColor:getGradient(ctxLoc,'rgba(6,182,212,0.9)','rgba(6,182,212,0.2)'),borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false}
  });

  // 9. Recent Surveys Table
  renderRecentSurveys(survey.recentSurveys||[]);

  // 10. Team Mixed Chart (Bar + Line)
  var teamL = (survey.teamStats||[]).map(function(t){return t.name});
  var teamCount = (survey.teamStats||[]).map(function(t){return t.count});
  var teamSat = (survey.teamStats||[]).map(function(t){return t.satisfaction});
  destroyChart('teamMixed');
  var ctxMixed = document.getElementById('teamMixedChart').getContext('2d');
  charts.teamMixed = new Chart(ctxMixed, {
    type: 'bar',
    data: {
      labels: teamL,
      datasets: [
        {
          type: 'line',
          label: 'نسبة الرضا %',
          data: teamSat,
          borderColor: '#facc15',
          backgroundColor: 'rgba(250,204,21,0.2)',
          borderWidth: 4,
          yAxisID: 'y1',
          tension: 0.4,
          fill: true,
          pointRadius: 6,
          pointHoverRadius: 9,
          pointBackgroundColor: '#0a0f1c'
        },
        {
          type: 'bar',
          label: 'إجمالي الاستبيانات',
          data: teamCount,
          backgroundColor: getGradient(ctxMixed, 'rgba(59,130,246,0.9)', 'rgba(59,130,246,0.2)'),
          borderRadius: 8,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: { padding: 15, titleFont: {size:16}, bodyFont: {size:14} } },
      scales: {
        x: { grid: { display: false } },
        y: { type: 'linear', display: true, position: 'right', title: {display:true, text:'العدد (أعمدة)'}, grid: {color:'rgba(255,255,255,0.05)'} },
        y1: { type: 'linear', display: true, position: 'left', max: 100, title: {display:true, text:'الرضا % (خط)'}, grid: {drawOnChartArea: false} }
      }
    }
  });

  // 11. Top 3 Teams Medal Cards
  renderTop3(survey.top3Teams||[]);

  // 12. Team Details Table
  renderTeamDetailsTable(survey.teamStats||[]);

  // 13. Employee Bar Chart
  var empL = (survey.employeeStats||[]).slice(0,15).map(function(e){return e.team+' — '+e.employee});
  var empV = (survey.employeeStats||[]).slice(0,15).map(function(e){return e.count});
  destroyChart('empBar');
  var ctxEmp = document.getElementById('employeeBarChart').getContext('2d');
  charts.empBar = new Chart(ctxEmp, {
    type:'bar', data:{labels:empL, datasets:[{label:'عدد الاستبيانات',data:empV,backgroundColor:getGradient(ctxEmp,'rgba(236,72,153,0.9)','rgba(236,72,153,0.2)'),borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}}}}
  });
}

// ─── Question Stacked Bar ───
function renderQuestionChart(questions) {
  var ratingQs = questions.filter(function(q){return q.satisfied_very>0||q.satisfied>0||q.unsatisfied>0});
  var labels = ratingQs.map(function(q){ var t=q.text; return t.length>35 ? t.substring(0,35)+'...' : t; });
  destroyChart('questionStacked');
  charts.questionStacked = new Chart(document.getElementById('questionStackedChart'), {
    type:'bar', data:{
      labels:labels,
      datasets:[
        {label:'راضٍ جداً',data:ratingQs.map(function(q){return q.satisfied_very}),backgroundColor:'#10b981',borderRadius:{topLeft:4,bottomLeft:4}},
        {label:'راضٍ',data:ratingQs.map(function(q){return q.satisfied}),backgroundColor:'#f59e0b'},
        {label:'غير راضٍ',data:ratingQs.map(function(q){return q.unsatisfied}),backgroundColor:'#ef4444',borderRadius:{topRight:4,bottomRight:4}}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',scales:{x:{stacked:true,grid:{color:'rgba(255,255,255,0.05)'}},y:{stacked:true,grid:{display:false}}},plugins:{legend:{position:'top'}}}
  });
}

// ─── Top 3 Medal Cards ───
function renderTop3(top3) {
  var container = document.getElementById('top3Container');
  if (!top3||top3.length===0) { container.innerHTML='<p style="text-align:center;color:#94a3b8;padding:40px;">لا توجد بيانات بعد</p>'; return; }
  var medalEmoji = ['🥇','🥈','🥉'];
  var medalClass = ['gold','silver','bronze'];
  var html = '';
  top3.forEach(function(t, i) {
    html += '<div class="medal-card '+medalClass[i]+'">';
    html += '<span class="medal-emoji">'+medalEmoji[i]+'</span>';
    html += '<div class="medal-name">'+t.name+'</div>';
    html += '<div class="medal-count">'+t.count+'</div>';
    html += '<div class="medal-label">استبيان ('+t.satisfaction+'% رضا)</div>';
    html += '</div>';
  });
  container.innerHTML = html;
}

// ─── Team Details Table ───
function renderTeamDetailsTable(teamStats) {
  var tbody = document.querySelector('#teamDetailsTable tbody');
  if (!tbody) return;
  if (!teamStats||teamStats.length===0) { tbody.innerHTML='<tr><td colspan="4" style="text-align:center;">لا توجد بيانات</td></tr>'; return; }
  
  var html = '';
  teamStats.forEach(function(t) {
    var color = t.satisfaction >= 70 ? '#10b981' : (t.satisfaction >= 50 ? '#facc15' : '#ef4444');
    var facCount = Object.keys(t.facilities||{}).length;
    html += '<tr>';
    html += '<td style="font-size:1.15rem;"><strong>'+t.name+'</strong></td>';
    html += '<td><span class="badge" style="background:rgba(59,130,246,0.2);color:#93c5fd;border:1px solid rgba(59,130,246,0.5);font-size:1rem;padding:6px 15px;">'+t.count+'</span></td>';
    html += '<td><strong style="color:'+color+';font-size:1.3rem;text-shadow:0 0 10px '+color+'40;">'+t.satisfaction+'%</strong></td>';
    html += '<td style="font-size:1.1rem;color:#cbd5e1;">'+facCount+' منشآت</td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

// ─── Recent Surveys Table ───
function renderRecentSurveys(surveys) {
  var tb = document.getElementById('recentSurveysBody');
  if (!surveys||surveys.length===0) { tb.innerHTML='<tr><td colspan="2" style="text-align:center;">لا توجد استبيانات</td></tr>'; return; }
  var h = '';
  surveys.forEach(function(s) {
    var color = s.satisfaction >= 70 ? '#10b981' : (s.satisfaction >= 50 ? '#f59e0b' : '#ef4444');
    h += '<tr>';
    h += '<td>'+s.facility+'</td>';
    h += '<td><strong style="color:'+color+'">'+s.satisfaction+'%</strong></td>';
    h += '</tr>';
  });
  tb.innerHTML = h;
}

// ─── Utility ───
function destroyChart(key) { if(charts[key]){charts[key].destroy();charts[key]=null;} }
