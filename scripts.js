// ================================================================
// UHIA Luxor System v5.0 — Frontend Logic (Optimized)
// ================================================================

var APP = {
  step: 1,
  teamName: '',
  employeeNumber: '',
  sector: '',
  category: '',
  providerCode: '',
  providerName: '',
  location: '',
  surveyAnswers: {}
};

// SCRIPT_URL يتم تعريفه في ملف config.js

var STEP_PCT   = { '1':16, '2':33, '3':50, '4':66, '5':83, '6':100, 'ok':100 };
var STEP_LABEL = {
  '1': 'الفريق',
  '2': 'رقم الموظف',
  '3': 'القطاع',
  '4': 'نوع المنشأة',
  '5': 'اختيار المنشأة',
  '6': 'الاستبيان',
  'ok': 'تم بنجاح ✅'
};

// ─── Init ───
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  var teamSelect = document.getElementById('teamSelect');
  TEAMS.forEach(function(team) {
    var opt = document.createElement('option');
    opt.value = team;
    opt.textContent = team;
    teamSelect.appendChild(opt);
  });
  renderSectors();
}

// ─── Navigation ───
function goStep(n) {
  document.querySelectorAll('.step').forEach(function(s) { s.classList.remove('active'); });
  var targetId = (n === 'ok') ? 'stepOk' : (n === 6 ? 'step6survey' : 'step' + n);
  var el = document.getElementById(targetId);
  if (el) el.classList.add('active');

  var pct = STEP_PCT[String(n)] || 16;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressGlow').style.width = pct + '%';
  document.getElementById('stepLabel').textContent = STEP_LABEL[String(n)] || '';
  document.getElementById('stepBadge').textContent =
    (n === 'ok') ? '✅' : n + ' / 6';

  window.scrollTo({ top: 0, behavior: 'smooth' });
  APP.step = n;
}

// ─── Step 1 & 2: Team and Employee ───
function goStep2() {
  var team = document.getElementById('teamSelect').value;
  var errEl = document.getElementById('err-team');
  var selEl = document.getElementById('teamSelect');

  if (!team) {
    selEl.classList.add('error');
    errEl.textContent = 'الرجاء اختيار الفريق أولاً';
    selEl.focus();
    return;
  }
  selEl.classList.remove('error');
  errEl.textContent = '';
  APP.teamName = team;

  // Dynamic Employee Loading
  var empSelect = document.getElementById('employeeSelect');
  empSelect.innerHTML = '<option value="">— اختر الموظف —</option>';
  if (team === 'عبد الرحمن') {
    empSelect.innerHTML += '<option value="جمال">1 - جمال</option>';
    empSelect.innerHTML += '<option value="فتون">2 - فتون</option>';
    empSelect.innerHTML += '<option value="عبدالرحمن">3 - عبدالرحمن</option>';
    empSelect.innerHTML += '<option value="احمد">4 - احمد</option>';
    empSelect.innerHTML += '<option value="هشام">5 - هشام</option>';
  } else {
    empSelect.innerHTML += '<option value="1">موظف رقم 1</option>';
    empSelect.innerHTML += '<option value="2">موظف رقم 2</option>';
    empSelect.innerHTML += '<option value="3">موظف رقم 3</option>';
  }

  goStep(2);
}

function goStep3() {
  var empNo = document.getElementById('employeeSelect').value;
  var errEl = document.getElementById('err-employee');
  var selEl = document.getElementById('employeeSelect');

  if (!empNo) {
    selEl.classList.add('error');
    errEl.textContent = 'الرجاء اختيار رقم الموظف';
    selEl.focus();
    return;
  }
  selEl.classList.remove('error');
  errEl.textContent = '';
  APP.employeeNumber = empNo;
  goStep(3);
}

// ─── Step 3: Sector ───
function renderSectors() {
  var grid = document.getElementById('sectorGrid');
  grid.innerHTML = '';
  Object.keys(STATIC_DATA.sectors).forEach(function(sec) {
    var meta = (typeof SECTOR_META !== 'undefined' && SECTOR_META[sec]) || { icon: '🏥' };
    var d = document.createElement('div');
    d.className = 'selection-card';
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.innerHTML =
      '<span class="icon">' + meta.icon + '</span>' +
      '<span class="title">' + sec + '</span>';
    d.onclick = function() { selectSector(sec, d); };
    d.onkeydown = function(e) { if (e.key === 'Enter') selectSector(sec, d); };
    grid.appendChild(d);
  });
}

function selectSector(sec, el) {
  document.querySelectorAll('#sectorGrid .selection-card').forEach(function(c) { c.classList.remove('selected'); });
  el.classList.add('selected');
  APP.sector = sec;
  setTimeout(function() {
    renderCategories(sec);
    goStep(4);
  }, 200);
}

// ─── Step 3: Category ───
function renderCategories(sec) {
  var grid = document.getElementById('categoryGrid');
  grid.innerHTML = '';
  (STATIC_DATA.sectors[sec] || []).forEach(function(cat) {
    var meta = (typeof CATEGORY_META !== 'undefined' && CATEGORY_META[cat]) || { icon: '📁' };
    var d = document.createElement('div');
    d.className = 'selection-card';
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.innerHTML =
      '<span class="icon">' + meta.icon + '</span>' +
      '<span class="title">' + cat + '</span>';
    d.onclick = function() { selectCategory(cat, d); };
    d.onkeydown = function(e) { if (e.key === 'Enter') selectCategory(cat, d); };
    grid.appendChild(d);
  });
}

function selectCategory(cat, el) {
  document.querySelectorAll('#categoryGrid .selection-card').forEach(function(c) { c.classList.remove('selected'); });
  el.classList.add('selected');
  APP.category = cat;
  setTimeout(function() {
    renderProviders(STATIC_DATA.providers[cat] || []);
    goStep(5);
  }, 200);
}

// ─── Step 4: Provider ───
function renderProviders(list) {
  var sel = document.getElementById('providerSelect');
  sel.innerHTML = '<option value="">— اختر المنشأة —</option>';
  list.forEach(function(p) {
    var o = document.createElement('option');
    o.value = p.code;
    o.textContent = p.name + (p.location ? ' (' + p.location + ')' : '');
    o.dataset.name = p.name;
    o.dataset.loc  = p.location || '';
    sel.appendChild(o);
  });
  document.getElementById('actionBtns').style.display = 'none';
}

function providerChanged() {
  var sel = document.getElementById('providerSelect');
  var opt = sel.options[sel.selectedIndex];
  if (sel.value) {
    APP.providerCode = sel.value;
    APP.providerName = opt.dataset.name;
    APP.location     = opt.dataset.loc;
    document.getElementById('actionBtns').style.display = 'block';
  } else {
    document.getElementById('actionBtns').style.display = 'none';
  }
}

// ─── Step 5: Survey Questions ───
function goSurvey() {
  APP.surveyAnswers = {};
  var container = document.getElementById('surveyQuestions');
  container.innerHTML = '';

  var sharedQs = STATIC_DATA.questions.shared || [];
  var specQs   = (STATIC_DATA.questions.specific || {})[APP.category] || [];

  // Info Box
  var infoBox = document.createElement('div');
  infoBox.className = 'survey-info-box';
  infoBox.innerHTML =
    '<div class="sib-row"><span class="sib-label">الفريق</span><span class="sib-val">' + APP.teamName + '</span></div>' +
    '<div class="sib-row"><span class="sib-label">موظف رقم</span><span class="sib-val">' + APP.employeeNumber + '</span></div>' +
    '<div class="sib-row"><span class="sib-label">القطاع</span><span class="sib-val">' + APP.sector + '</span></div>' +
    '<div class="sib-row"><span class="sib-label">التصنيف</span><span class="sib-val">' + APP.category + '</span></div>' +
    '<div class="sib-row"><span class="sib-label">المنشأة</span><span class="sib-val">' + APP.providerName + '</span></div>';
  container.appendChild(infoBox);

  // Shared Questions
  container.appendChild(buildSectionTitle('📋 الأسئلة العامة الموحدة'));
  sharedQs.forEach(function(q) { container.appendChild(buildQuestion(q)); });

  // Specific Questions
  if (specQs.length > 0) {
    container.appendChild(buildSectionTitle('🎯 أسئلة متخصصة — ' + APP.category));
    specQs.forEach(function(q) { container.appendChild(buildQuestion(q)); });
  }

  // Final Questions
  var finalQs = STATIC_DATA.questions.final || [];
  if (finalQs.length > 0) {
    container.appendChild(buildSectionTitle('🌟 التقييم العام'));
    finalQs.forEach(function(q) { container.appendChild(buildQuestion(q)); });
  }

  // ═══ إظهار أبرز الملاحظات السابقة ═══
  var notesBox = document.getElementById('notesHighlightSection');
  if (notesBox) notesBox.style.display = 'block';

  // Handle Stats Board
  var statsBoard = document.getElementById('statsBoard');
  var cardTotal = document.getElementById('cardStatTotal');
  var cardSample = document.getElementById('cardStatSample');
  var statDone = document.getElementById('statDone');
  
  statsBoard.style.display = 'grid'; 
  statDone.innerHTML = '<span class="spinner-small"></span>';

  if (typeof HOSPITAL_TARGETS !== 'undefined' && HOSPITAL_TARGETS[APP.providerName] && HOSPITAL_TARGETS[APP.providerName].breakdown && HOSPITAL_TARGETS[APP.providerName].breakdown[APP.category]) {
    var targetData = HOSPITAL_TARGETS[APP.providerName];
    document.getElementById('statTotal').textContent = targetData.total_monthly.toLocaleString('en-US');
    document.getElementById('statSample').textContent = targetData.breakdown[APP.category].toLocaleString('en-US');
    cardTotal.style.display = 'flex';
    cardSample.style.display = 'flex';
    statsBoard.style.gridTemplateColumns = 'repeat(3, 1fr)';
  } else {
    cardTotal.style.display = 'none';
    cardSample.style.display = 'none';
    statsBoard.style.gridTemplateColumns = '1fr';
  }

  var countPayload = { action: 'getCounts', providerName: APP.providerName, category: APP.category };
  fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(countPayload)
  })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    if(res && res.success) {
      statDone.textContent = res.count.toLocaleString('en-US');
    } else {
      statDone.textContent = 'خطأ';
    }
  })
  .catch(function(e) { statDone.textContent = 'تعذر'; });

  goStep(6);
}

function buildSectionTitle(text) {
  var div = document.createElement('div');
  div.className = 'section-title';
  div.textContent = text;
  return div;
}

function buildQuestion(q) {
  var w = document.createElement('div');
  w.className = 'q-block';
  w.id = 'qwrap_' + q.code;

  var html = '<div class="q-text">' + q.text + ' <span class="q-req">*</span></div>';
  if (q.hint) {
    html += '<div class="q-hint">💡 ' + q.hint + '</div>';
  }

  if (q.type === 'rating3') {
    var icons   = ['😊', '🙂', '😞'];
    var classes = ['opt-great', 'opt-good', 'opt-bad'];
    html += '<div class="rating3-wrap">';
    q.options.forEach(function(o, i) {
      html += '<div class="rating3-btn ' + classes[i] + '" onclick="selR(\'' + q.code + '\',this,\'' + o + '\')" role="button" tabindex="0">' +
        '<span class="r3-icon">' + icons[i] + '</span>' +
        '<span class="r3-label">' + o + '</span>' +
        '</div>';
    });
    html += '</div>';
  } else if (q.type === 'yesno') {
    html += '<div class="yesno-wrap">' +
      '<div class="yesno-btn yes" onclick="selR(\'' + q.code + '\',this,\'نعم\')" role="button" tabindex="0">✅ نعم</div>' +
      '<div class="yesno-btn no"  onclick="selR(\'' + q.code + '\',this,\'لا\')" role="button" tabindex="0">❌ لا</div>' +
      '</div>';
  } else if (q.type === 'textarea') {
    html += '<textarea class="q-textarea" placeholder="' + q.text + '" oninput="APP.surveyAnswers[\'' + q.code + '\'] = this.value;"></textarea>';
  }

  w.innerHTML = html;
  return w;
}

// ─── Answer Selection ───
function selR(qcode, el, val) {
  var wrap = document.getElementById('qwrap_' + qcode);
  if (wrap) wrap.style.borderColor = '';
  var parent = el.parentElement;
  Array.from(parent.children).forEach(function(c) { c.classList.remove('sel'); });
  el.classList.add('sel');
  APP.surveyAnswers[qcode] = val;

  // Haptic feedback on mobile (if available)
  if (navigator.vibrate) navigator.vibrate(15);
}

// ─── Submit ───
function submitSurvey() {
  var sharedQs = STATIC_DATA.questions.shared || [];
  var specQs   = (STATIC_DATA.questions.specific || {})[APP.category] || [];
  var finalQs  = STATIC_DATA.questions.final || [];
  var allQs    = sharedQs.concat(specQs).concat(finalQs);

  var missing = false;
  var firstMissingEl = null;
  allQs.forEach(function(q) {
    var v = APP.surveyAnswers[q.code];
    var wrap = document.getElementById('qwrap_' + q.code);
    if (!v && q.type !== 'textarea') { // Textarea (notes) is optional
      if (wrap) wrap.style.borderColor = '#F43F5E';
      if (!firstMissingEl) firstMissingEl = wrap;
      missing = true;
    } else {
      if (wrap) wrap.style.borderColor = '';
    }
  });

  if (missing) {
    alert('⚠️ الرجاء الإجابة على جميع الأسئلة المطلوبة');
    if (firstMissingEl) firstMissingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  var btn = document.getElementById('surveyBtn');
  btn.disabled = true;
  document.getElementById('loadingOverlay').style.display = 'flex';

  var payloadAnswers = {};
  allQs.forEach(function(q) {
    if (APP.surveyAnswers[q.code]) {
      payloadAnswers[q.text] = APP.surveyAnswers[q.code];
    }
  });

  var payload = {
    action:       'saveSurvey',
    teamName:     APP.teamName,
    employeeNumber: APP.employeeNumber,
    sector:       APP.sector,
    category:     APP.category,
    providerCode: APP.providerCode,
    providerName: APP.providerName,
    location:     APP.location,
    answers:      payloadAnswers
  };

  fetch(SCRIPT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(payload)
  })
  .then(function(r) { return r.json(); })
  .then(function(res) {
    document.getElementById('loadingOverlay').style.display = 'none';
    if (res && res.success) {
      goStep('ok');
    } else {
      alert('❌ حدث خطأ أثناء الإرسال: ' + (res.error || res.message || JSON.stringify(res)));
      btn.disabled = false;
    }
  })
  .catch(function(err) {
    document.getElementById('loadingOverlay').style.display = 'none';
    alert('❌ تعذر الاتصال بالخادم: ' + err.message);
    btn.disabled = false;
  });
}

// ─── Reset ───
function resetApp() {
  APP.teamName      = '';
  APP.employeeNumber= '';
  APP.sector        = '';
  APP.category      = '';
  APP.providerCode  = '';
  APP.providerName  = '';
  APP.location      = '';
  APP.surveyAnswers = {};

  document.getElementById('teamSelect').value = '';
  document.getElementById('employeeSelect').value = '';
  document.getElementById('providerSelect').innerHTML = '<option value="">— اختر المنشأة —</option>';
  document.getElementById('actionBtns').style.display = 'none';

  var btn = document.getElementById('surveyBtn');
  if (btn) btn.disabled = false;

  goStep(1);
}
