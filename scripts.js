// ================================================================
// UHIA Luxor System v5.0 — Frontend Logic (Optimized)
// ================================================================

var APP = {
  step: 1,
  employeeName: '',
  sector: '',
  category: '',
  providerCode: '',
  providerName: '',
  location: '',
  surveyAnswers: {}
};

var SCRIPT_URL = (typeof CONFIG !== 'undefined' && CONFIG.scriptUrl) ? CONFIG.scriptUrl : '';

var STEP_PCT   = { '1':20, '2':40, '3':60, '4':80, '5':100, 'ok':100 };
var STEP_LABEL = {
  '1': 'اختيار الموظف',
  '2': 'تحديد القطاع',
  '3': 'نوع المنشأة',
  '4': 'اختيار المنشأة',
  '5': 'الاستبيان',
  'ok': 'تم بنجاح ✅'
};

// ─── Init ───
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  var empSelect = document.getElementById('employeeSelect');
  EMPLOYEES.forEach(function(emp) {
    var opt = document.createElement('option');
    opt.value = emp;
    opt.textContent = emp;
    empSelect.appendChild(opt);
  });
  renderSectors();
}

// ─── Navigation ───
function goStep(n) {
  document.querySelectorAll('.step').forEach(function(s) { s.classList.remove('active'); });
  var targetId = (n === 'ok') ? 'stepOk' : (n === 5 ? 'step5survey' : 'step' + n);
  var el = document.getElementById(targetId);
  if (el) el.classList.add('active');

  var pct = STEP_PCT[String(n)] || 20;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressGlow').style.width = pct + '%';
  document.getElementById('stepLabel').textContent = STEP_LABEL[String(n)] || '';
  document.getElementById('stepBadge').textContent =
    (n === 'ok') ? '✅' : n + ' / 5';

  window.scrollTo({ top: 0, behavior: 'smooth' });
  APP.step = n;
}

// ─── Step 1: Employee ───
function goStep2() {
  var emp = document.getElementById('employeeSelect').value;
  var errEl = document.getElementById('err-employee');
  var selEl = document.getElementById('employeeSelect');

  if (!emp) {
    selEl.classList.add('error');
    errEl.textContent = 'الرجاء اختيار اسمك أولاً';
    selEl.focus();
    return;
  }
  selEl.classList.remove('error');
  errEl.textContent = '';
  APP.employeeName = emp;
  goStep(2);
}

// ─── Step 2: Sector ───
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
    goStep(3);
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
    goStep(4);
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
    '<div class="sib-row"><span class="sib-label">الموظف</span><span class="sib-val">' + APP.employeeName + '</span></div>' +
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

  goStep(5);
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
  var allQs    = sharedQs.concat(specQs);

  var missing = false;
  var firstMissingEl = null;
  allQs.forEach(function(q) {
    var v = APP.surveyAnswers[q.code];
    var wrap = document.getElementById('qwrap_' + q.code);
    if (!v) {
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

  var payload = {
    action:       'saveSurvey',
    employeeName: APP.employeeName,
    sector:       APP.sector,
    category:     APP.category,
    providerCode: APP.providerCode,
    providerName: APP.providerName,
    location:     APP.location,
    answers:      APP.surveyAnswers
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
      alert('❌ حدث خطأ أثناء الإرسال، حاول مرة أخرى');
      btn.disabled = false;
    }
  })
  .catch(function() {
    document.getElementById('loadingOverlay').style.display = 'none';
    alert('❌ تعذر الاتصال بالخادم');
    btn.disabled = false;
  });
}

// ─── Reset ───
function resetApp() {
  APP.employeeName  = '';
  APP.sector        = '';
  APP.category      = '';
  APP.providerCode  = '';
  APP.providerName  = '';
  APP.location      = '';
  APP.surveyAnswers = {};

  document.getElementById('employeeSelect').value = '';
  document.getElementById('providerSelect').innerHTML = '<option value="">— اختر المنشأة —</option>';
  document.getElementById('actionBtns').style.display = 'none';

  var btn = document.getElementById('surveyBtn');
  if (btn) btn.disabled = false;

  goStep(1);
}
