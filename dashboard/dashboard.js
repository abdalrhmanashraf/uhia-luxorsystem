// ═══════════════════════════════════════════════════════════════
// UHIA Luxor System — Dashboard JS V5.0
// ═══════════════════════════════════════════════════════════════

var API_URL = window.SCRIPT_URL || '';
var charts = {};
var COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#14b8a6','#f43f5e','#84cc16'];

// ─── Init ───
window.addEventListener('load', function() {
  var savedUser = localStorage.getItem('uhia_user');
  if (savedUser) {
    var user = JSON.parse(savedUser);
    if (user.role === 'admin') { showDashboard(); return; }
  }
  document.getElementById('loginScreen').style.display = 'block';
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Cairo', sans-serif";
});

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashWrap').style.display = 'flex';
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Cairo', sans-serif";
  updateClock(); setInterval(updateClock, 1000);
  loadData();
}

// ─── Login / Logout / Profile ───
function doLogin() {
  var phone = document.getElementById('phoneInput').value.trim();
  var pwd = document.getElementById('pwdInput').value.trim();
  var err = document.getElementById('loginError');
  var btn = document.getElementById('loginBtnText');
  if (!phone || !pwd) { err.innerText = 'الرجاء إدخال البيانات'; return; }
  if (!API_URL) { err.innerText = 'خطأ: رابط API غير موجود'; return; }
  err.innerText = ''; btn.innerText = 'جارٍ التحقق...';
  fetch(API_URL, { method:'POST', body:JSON.stringify({action:'login',phone:phone,password:pwd}), headers:{'Content-Type':'text/plain;charset=utf-8'} })
  .then(function(r){return r.json()}).then(function(res){
    if (res.success && res.user.role === 'admin') { localStorage.setItem('uhia_user',JSON.stringify(res.user)); showDashboard(); }
    else { err.innerText = res.message || 'هذه اللوحة لمدير الفرع فقط'; btn.innerText = 'تسجيل الدخول'; }
  }).catch(function(){ err.innerText = 'خطأ في الاتصال'; btn.innerText = 'تسجيل الدخول'; });
}
function logout() { localStorage.removeItem('uhia_user'); document.getElementById('dashWrap').style.display='none'; document.getElementById('loginScreen').style.display='block'; document.getElementById('pwdInput').value=''; }
function openProfileModal() { document.getElementById('profileModal').style.display='block'; document.getElementById('profOldPwd').value=''; document.getElementById('profNewPwd').value=''; document.getElementById('profNewPhone').value=''; document.getElementById('profError').innerText=''; }
function closeProfileModal() { document.getElementById('profileModal').style.display='none'; }
function saveProfile() {
  var oldPwd=document.getElementById('profOldPwd').value.trim(), newPwd=document.getElementById('profNewPwd').value.trim(), newPhone=document.getElementById('profNewPhone').value.trim();
  var err=document.getElementById('profError'), btn=document.getElementById('profSaveBtn');
  if (!oldPwd) { err.innerText='كلمة المرور الحالية مطلوبة'; return; }
  if (!newPwd && !newPhone) { err.innerText='أدخل هاتف أو كلمة مرور جديدة'; return; }
  var savedUser = JSON.parse(localStorage.getItem('uhia_user')||'{}');
  err.innerText=''; btn.innerText='جارٍ الحفظ...';
  fetch(API_URL, { method:'POST', body:JSON.stringify({action:'updateProfile',currentPhone:savedUser.phone,oldPassword:oldPwd,newPhone:newPhone,newPassword:newPwd}), headers:{'Content-Type':'text/plain;charset=utf-8'} })
  .then(function(r){return r.json()}).then(function(res){ btn.innerText='حفظ التعديلات'; if(res.success){alert('تم التحديث! سيتم تسجيل الخروج.');closeProfileModal();logout();}else{err.innerText=res.message||'فشل التحديث';} })
  .catch(function(){err.innerText='خطأ في الاتصال';btn.innerText='حفظ التعديلات';});
}

// ─── Navigation ───
function switchSection(secId, el) {
  if (event) event.preventDefault();
  document.querySelectorAll('.nav-links a').forEach(function(a){a.classList.remove('active')});
  if (el) el.classList.add('active');
  document.querySelectorAll('.content-sections > section').forEach(function(s){s.classList.remove('active-sec')});
  var sec = document.getElementById(secId);
  if (sec) sec.classList.add('active-sec');
}

function updateClock() {
  var now = new Date();
  document.getElementById('clockTime').innerText = now.toLocaleTimeString('ar-EG');
  document.getElementById('clockDate').innerText = now.toLocaleDateString('ar-EG');
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
    renderComplaintsKPIs(res.kpi);
    renderComplaintsCharts(res.analytics);
    renderRepeated(res.analytics.repeatedPatients);
    renderStaff(res.analytics.topEmployees);
    if (res.survey) renderSurveyDashboard(res.survey);
  })
  .catch(function(e){ document.getElementById('fullLoading').style.display='none'; console.error(e); alert('تعذر الاتصال بالخادم'); });
}

// ─── Complaints KPIs ───
function renderComplaintsKPIs(kpi) {
  document.getElementById('kpiTotal').innerText = kpi.total;
  document.getElementById('kpiOpen').innerText = kpi.open;
  document.getElementById('kpiResolved').innerText = kpi.resolved;
  document.getElementById('kpiSla').innerText = kpi.slaCompliance + '%';
}

// ─── Complaints Charts ───
function renderComplaintsCharts(analytics) {
  var cData = analytics.charts;
  // Facilities Bar
  var facL = (cData.facilities||[]).map(function(f){return f.label});
  var facV = (cData.facilities||[]).map(function(f){return f.value});
  destroyChart('fac');
  charts.fac = new Chart(document.getElementById('facilitiesChart'), {
    type:'bar', data:{labels:facL, datasets:[{label:'عدد الشكاوى',data:facV,backgroundColor:'rgba(59,130,246,0.7)',borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false}
  });
  // Categories Doughnut
  var catL = Object.keys(cData.categories||{});
  var catV = catL.map(function(k){return cData.categories[k]});
  destroyChart('cat');
  charts.cat = new Chart(document.getElementById('categoriesChart'), {
    type:'doughnut', data:{labels:catL, datasets:[{data:catV,backgroundColor:COLORS,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right'}}}
  });
  // Trend Line
  var trL = Object.keys(cData.trend||{}).sort();
  var trV = trL.map(function(k){return cData.trend[k]});
  destroyChart('trend');
  charts.trend = new Chart(document.getElementById('trendChart'), {
    type:'line', data:{labels:trL, datasets:[{label:'الشكاوى اليومية',data:trV,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.1)',fill:true,tension:0.4}]},
    options:{responsive:true,maintainAspectRatio:false}
  });
}
function renderRepeated(patients) {
  var tb = document.getElementById('repeatedBody');
  if (!patients||patients.length===0) { tb.innerHTML='<tr><td colspan="2" style="text-align:center;">النظام مستقر ✅</td></tr>'; return; }
  var h=''; patients.forEach(function(p){ h+='<tr><td><strong>'+p.id+'</strong></td><td><span class="badge-danger">'+p.count+' شكاوى</span></td></tr>'; });
  tb.innerHTML = h;
}
function renderStaff(staff) {
  var tb = document.getElementById('staffBody');
  if (!staff||staff.length===0) { tb.innerHTML='<tr><td colspan="3" style="text-align:center;">لا توجد بيانات</td></tr>'; return; }
  var h=''; var medals=['🥇','🥈','🥉'];
  staff.forEach(function(s,i){ h+='<tr><td>'+(medals[i]||'')+' <strong>'+s.name+'</strong></td><td>'+s.resolvedCount+'</td><td>'+s.avgSpeedHours+'</td></tr>'; });
  tb.innerHTML = h;
}

// ═══════════════════════════════════════
// SURVEY DASHBOARD (V5.0)
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
    type:'pie', data:{labels:secL, datasets:[{data:secV,backgroundColor:['#3b82f6','#10b981'],borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}
  });

  // 2. Category Donut
  var catL = (survey.categoryStats||[]).map(function(c){return c.label});
  var catV = (survey.categoryStats||[]).map(function(c){return c.count});
  destroyChart('catDonut');
  charts.catDonut = new Chart(document.getElementById('categoryDonutChart'), {
    type:'doughnut', data:{labels:catL, datasets:[{data:catV,backgroundColor:COLORS,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false}
  });

  // 3. Survey Trend Line
  var tKeys = Object.keys(survey.dailyTrend||{}).sort();
  var tVals = tKeys.map(function(k){return survey.dailyTrend[k]});
  destroyChart('surveyTrend');
  charts.surveyTrend = new Chart(document.getElementById('surveyTrendChart'), {
    type:'line', data:{labels:tKeys, datasets:[{label:'عدد الاستبيانات',data:tVals,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,0.1)',fill:true,tension:0.4,pointRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false}
  });

  // 4. Facility Rank (Horizontal Bar)
  var fRank = (survey.facilityRanking||[]).slice(0,12);
  var fLabels = fRank.map(function(f){return f.label});
  var fSat = fRank.map(function(f){return f.satisfaction});
  var fColors = fSat.map(function(v){return v>=70?'#10b981':v>=50?'#f59e0b':'#ef4444'});
  destroyChart('facRank');
  charts.facRank = new Chart(document.getElementById('facilityRankChart'), {
    type:'bar', data:{labels:fLabels, datasets:[{label:'نسبة الرضا%',data:fSat,backgroundColor:fColors,borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{max:100}}}
  });

  // 5. Question Stacked Bar
  renderQuestionChart(survey.questionAnalysis||[]);

  // 6. NPS Gauge (Half Doughnut)
  var nps = survey.npsDist || {yes:0,no:0};
  destroyChart('npsGauge');
  charts.npsGauge = new Chart(document.getElementById('npsGaugeChart'), {
    type:'doughnut', data:{
      labels:['نعم (يوصي)','لا'],
      datasets:[{data:[nps.yes,nps.no],backgroundColor:['#10b981','#ef4444'],borderWidth:0}]
    },
    options:{responsive:true,maintainAspectRatio:false,circumference:180,rotation:270,plugins:{legend:{position:'bottom'}}}
  });

  // 7. Facility Scatter
  var scatterData = (survey.facilityRanking||[]).map(function(f){return {x:f.count,y:f.satisfaction,label:f.label}});
  destroyChart('facScatter');
  charts.facScatter = new Chart(document.getElementById('facilityScatterChart'), {
    type:'scatter', data:{datasets:[{label:'المنشآت',data:scatterData,backgroundColor:'#8b5cf6',pointRadius:8,pointHoverRadius:12}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{x:{title:{display:true,text:'عدد الاستبيانات'}},y:{title:{display:true,text:'نسبة الرضا%'},max:100}},
      plugins:{tooltip:{callbacks:{label:function(ctx){return ctx.raw.label+' ('+ctx.raw.x+' استبيان, '+ctx.raw.y+'%)';}}}}}
  });

  // 8. Location Bar
  var locL = Object.keys(survey.locationStats||{});
  var locV = locL.map(function(k){return survey.locationStats[k]});
  destroyChart('locBar');
  charts.locBar = new Chart(document.getElementById('locationBarChart'), {
    type:'bar', data:{labels:locL, datasets:[{label:'عدد العينات',data:locV,backgroundColor:'rgba(6,182,212,0.7)',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false}
  });

  // 9. Recent Surveys Table
  renderRecentSurveys(survey.recentSurveys||[]);

  // 10. Team Bar Chart
  var teamL = (survey.teamStats||[]).map(function(t){return t.name});
  var teamV = (survey.teamStats||[]).map(function(t){return t.count});
  destroyChart('teamBar');
  charts.teamBar = new Chart(document.getElementById('teamBarChart'), {
    type:'bar', data:{labels:teamL, datasets:[{label:'عدد الاستبيانات',data:teamV,backgroundColor:COLORS.slice(0,teamL.length),borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
  });

  // 11. Top 3 Teams Medal Cards
  renderTop3(survey.top3Teams||[]);

  // 12. Team × Facility Matrix
  renderTeamFacilityTable(survey.teamStats||[]);

  // 13. Employee Bar Chart
  var empL = (survey.employeeStats||[]).slice(0,15).map(function(e){return e.team+' — '+e.employee});
  var empV = (survey.employeeStats||[]).slice(0,15).map(function(e){return e.count});
  destroyChart('empBar');
  charts.empBar = new Chart(document.getElementById('employeeBarChart'), {
    type:'bar', data:{labels:empL, datasets:[{label:'عدد الاستبيانات',data:empV,backgroundColor:'rgba(236,72,153,0.7)',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
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
        {label:'راضٍ جداً',data:ratingQs.map(function(q){return q.satisfied_very}),backgroundColor:'#10b981'},
        {label:'راضٍ',data:ratingQs.map(function(q){return q.satisfied}),backgroundColor:'#f59e0b'},
        {label:'غير راضٍ',data:ratingQs.map(function(q){return q.unsatisfied}),backgroundColor:'#ef4444'}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',scales:{x:{stacked:true},y:{stacked:true}},plugins:{legend:{position:'top'}}}
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
    html += '<div class="medal-label">استبيان</div>';
    html += '</div>';
  });
  container.innerHTML = html;
}

// ─── Team × Facility Matrix Table ───
function renderTeamFacilityTable(teamStats) {
  var table = document.getElementById('teamFacilityTable');
  if (!teamStats||teamStats.length===0) { table.innerHTML='<tbody><tr><td>لا توجد بيانات</td></tr></tbody>'; return; }
  
  // Collect all unique facilities
  var allFacs = {};
  teamStats.forEach(function(t){ for(var f in t.facilities) allFacs[f] = true; });
  var facList = Object.keys(allFacs);
  
  // Build header
  var hHtml = '<thead><tr><th>الفريق</th><th>الإجمالي</th>';
  facList.forEach(function(f){ hHtml += '<th style="font-size:0.75rem;">'+f+'</th>'; });
  hHtml += '</tr></thead>';
  
  // Build body
  var bHtml = '<tbody>';
  teamStats.forEach(function(t) {
    bHtml += '<tr><td><strong>'+t.name+'</strong></td><td><span class="badge" style="background:#3b82f6;">'+t.count+'</span></td>';
    facList.forEach(function(f) {
      var cnt = t.facilities[f] || 0;
      var bg = cnt > 0 ? 'rgba(16,185,129,0.2)' : 'transparent';
      bHtml += '<td style="background:'+bg+';text-align:center;">'+(cnt||'-')+'</td>';
    });
    bHtml += '</tr>';
  });
  bHtml += '</tbody>';
  table.innerHTML = hHtml + bHtml;
}

// ─── Recent Surveys Table ───
function renderRecentSurveys(surveys) {
  var tb = document.getElementById('recentSurveysBody');
  if (!surveys||surveys.length===0) { tb.innerHTML='<tr><td colspan="6" style="text-align:center;">لا توجد استبيانات</td></tr>'; return; }
  var h = '';
  surveys.forEach(function(s) {
    var color = s.satisfaction >= 70 ? '#10b981' : (s.satisfaction >= 50 ? '#f59e0b' : '#ef4444');
    h += '<tr>';
    h += '<td>'+s.date+'</td>';
    h += '<td>'+s.team+'</td>';
    h += '<td>'+s.employee+'</td>';
    h += '<td>'+s.facility+'</td>';
    h += '<td>'+s.location+'</td>';
    h += '<td><strong style="color:'+color+'">'+s.satisfaction+'%</strong></td>';
    h += '</tr>';
  });
  tb.innerHTML = h;
}

// ─── Utility ───
function destroyChart(key) { if(charts[key]){charts[key].destroy();charts[key]=null;} }
