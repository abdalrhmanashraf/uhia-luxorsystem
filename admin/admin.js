// ═══════════════════════════════════════════════════════════════
// Premium Admin JS v3.2 (Collaborative)
// UHIA Luxor System
// ═══════════════════════════════════════════════════════════════

var API_URL = window.SCRIPT_URL || '';
var currentUser = null;
var complaintsData = [];
var currentComplaintId = null;

window.addEventListener('load', function() {
  var savedUser = localStorage.getItem('uhia_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showAdminPanel();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminWrap').style.display = 'none';
  }
});

function togglePwd() {
  var input = document.getElementById('pwdInput');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function doLogin() {
  var phone = document.getElementById('phoneInput').value.trim().toLowerCase();
  var pwd = document.getElementById('pwdInput').value.trim();
  var err = document.getElementById('loginError');
  var btnText = document.getElementById('loginBtnText');

  if (!phone || !pwd) return err.innerText = 'الرجاء إدخال رقم الهاتف وكلمة المرور';

  var staticUsers = {
    'ceo': { name: 'المدير التنفيذي', phone: 'ceo', role: 'admin', password: '1972' },
    'rehab': { name: 'أ. رحاب', phone: 'rehab', role: 'admin', password: '1111' },
    'admin': { name: 'مدير النظام', phone: 'admin', role: 'admin', password: '141999' }
  };

  if (staticUsers[phone] && staticUsers[phone].password === pwd) {
    currentUser = staticUsers[phone];
    localStorage.setItem('uhia_user', JSON.stringify(currentUser));
    showAdminPanel();
    return;
  }

  if (!API_URL) return err.innerText = 'خطأ: لم يتم العثور على رابط API.';

  err.innerText = '';
  btnText.innerText = 'جارٍ التحقق...';
  
  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'login', phone: phone, password: pwd }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  })
  .then(res => res.json())
  .then(res => {
    if (res.success) {
      currentUser = res.user;
      localStorage.setItem('uhia_user', JSON.stringify(currentUser));
      showAdminPanel();
    } else {
      err.innerText = res.message || 'بيانات الدخول غير صحيحة';
      btnText.innerText = 'تسجيل الدخول';
    }
  }).catch(error => {
    err.innerText = 'حدث خطأ في الاتصال بالخادم.';
    btnText.innerText = 'تسجيل الدخول';
  });
}

function logout() {
  localStorage.removeItem('uhia_user');
  location.reload();
}

function showAdminPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminWrap').style.display = 'flex';
  document.getElementById('displayUserName').innerText = currentUser.name;
  document.getElementById('displayUserRole').innerText = currentUser.role === 'admin' ? 'مدير نظام' : 'موظف';
  loadData();
}

function loadData() {
  showLoading(true);
  fetch(API_URL + '?action=getAllComplaints')
    .then(res => res.json())
    .then(res => {
      showLoading(false);
      if (res.success) {
        complaintsData = res.data;
        renderTable(complaintsData);
      } else showToast('فشل تحميل البيانات', 'error');
    }).catch(err => {
      showLoading(false);
      showToast('خطأ في الاتصال', 'error');
    });
}

function renderTable(data) {
  var tbody = document.getElementById('adminTableBody');
  var meta = document.getElementById('tableMeta');
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">لا توجد شكاوى لعرضها</td></tr>';
    meta.innerText = 'العدد: 0';
    return;
  }
  
  meta.innerText = 'العدد: ' + data.length + ' تذكرة';
  var html = '';
  
  for (var i = 0; i < data.length; i++) {
    var c = data[i];
    
    var statusClass = 'closed';
    if (c.status === 'جديدة') statusClass = 'new';
    else if (c.status === 'تحت المراجعة') statusClass = 'review';
    else if (c.status === 'تم الحل') statusClass = 'resolved';
    
    // نظام الحجز: إظهار من يقوم بالمراجعة
    var workflowHtml = '';
    if (c.status === 'تحت المراجعة' && c.assignedTo) {
      workflowHtml = `<span class="badge-locked">🔒 قيد المعالجة (${c.assignedTo})</span>`;
    } else if (c.status === 'تم الحل' && c.assignedTo) {
      workflowHtml = `<span style="font-size:0.75rem; color:#10b981;">حلها: ${c.assignedTo}</span>`;
    } else {
      workflowHtml = `<span style="font-size:0.75rem; color:#94a3b8;">متاحة للمعالجة</span>`;
    }

    html += `<tr>
      <td><strong>#${c.id || '-'}</strong><br><small style="color:#94a3b8">${c.date}</small></td>
      <td>${c.name || 'مجهول'}<br><small style="color:#94a3b8">${c.phone || '-'}</small></td>
      <td>${c.facility || '-'}<br><small style="color:#94a3b8">${c.category || '-'}</small></td>
      <td><span class="badge ${statusClass}">${c.status || '-'}</span></td>
      <td>${workflowHtml}</td>
      <td><button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openModal('${c.id}')">متابعة التذكرة ⚙️</button></td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

var searchTimer;
function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 300);
}

function applyFilters() {
  var s = document.getElementById('searchInput').value.toLowerCase();
  var st = document.getElementById('fStatus').value;
  var filtered = complaintsData.filter(c => {
    var matchSearch = !s || (c.name||'').toLowerCase().includes(s) || (c.id||'').toString().includes(s);
    var matchStatus = !st || c.status === st;
    return matchSearch && matchStatus;
  });
  renderTable(filtered);
}

function openModal(id) {
  var c = complaintsData.find(x => String(x.id) === String(id));
  if (!c) return;
  currentComplaintId = id;
  
  // بناء تفاصيل الشكوى
  var detailsHtml = `
    <p>تذكرة رقم: <strong>#${c.id}</strong></p>
    <p>المريض: <strong>${c.name} (${c.phone})</strong></p>
    <p>الجهة المشكو في حقها: <strong>${c.facility}</strong></p>
    <div style="background: rgba(255,255,255,0.05); padding: 10px; margin-top: 10px; border-radius: 5px;">
      <p style="color:var(--text-main); margin-bottom:10px;"><strong>نص الشكوى الأصلية:</strong><br>${c.complaintText || 'لم يُكتب نص'}</p>
      ${c.audio && String(c.audio).startsWith('http') ? `<div style="margin-top:10px;"><strong>تسجيل صوتي:</strong><br><audio controls style="width:100%; height:35px; margin-top:5px;"><source src="${c.audio}"></audio><br><a href="${c.audio}" target="_blank" style="font-size:0.8rem; color:#3b82f6;">تحميل/فتح الصوت 🎵</a></div>` : ''}
      ${c.attachments && String(c.attachments).startsWith('http') ? `<div style="margin-top:10px;"><strong>المرفقات (صور):</strong><br>` + c.attachments.split('\\n').map((url, i) => `<a href="${url}" target="_blank" style="display:inline-block; margin:5px 5px 0 0; background:#3b82f6; color:white; padding:3px 8px; border-radius:4px; font-size:0.8rem; text-decoration:none;">صورة ${i+1} 🖼️</a>`).join('') + `</div>` : ''}
    </div>
  `;
  document.getElementById('complaintDetails').innerHTML = detailsHtml;
  
  // بناء السجل التراكمي (Timeline)
  var timelineHtml = '';
  if (c.notesThread && c.notesThread.length > 0) {
    c.notesThread.forEach(n => {
      timelineHtml += `
        <div class="thread-item">
          <div class="thread-meta"><span>${n.time}</span> ${n.user}</div>
          <div class="thread-text">${n.text}</div>
        </div>
      `;
    });
  } else {
    timelineHtml = '<p style="color:var(--text-muted); font-size:0.85rem;">لا توجد إجراءات مسجلة بعد. كن أول من يضيف تحديثاً.</p>';
  }
  document.getElementById('timelineBox').innerHTML = timelineHtml;
  
  document.getElementById('modalStatus').value = c.status || 'جديدة';
  document.getElementById('modalNote').value = '';
  
  document.getElementById('modalOverlay').style.display = 'flex';
  setTimeout(() => document.getElementById('modalOverlay').classList.add('show'), 10);
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay') && e.target.className !== 'btn-close' && e.target.className !== 'btn-secondary') return;
  document.getElementById('modalOverlay').classList.remove('show');
  setTimeout(() => document.getElementById('modalOverlay').style.display = 'none', 300);
}

function saveUpdate() {
  var newStatus = document.getElementById('modalStatus').value;
  var note = document.getElementById('modalNote').value;
  
  if (!newStatus) return showToast('يجب اختيار حالة!', 'error');
  
  document.getElementById('saveBtn').innerText = 'جارٍ الحفظ...';
  
  var payload = {
    action: 'updateComplaint',
    id: currentComplaintId,
    status: newStatus,
    note: note,
    assigned: currentUser.name
  };
  
  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  })
  .then(res => res.json())
  .then(res => {
    document.getElementById('saveBtn').innerText = '💾 حفظ الإجراءات';
    if (res.success) {
      showToast('تم التحديث بنجاح!');
      closeModal();
      loadData();
    } else {
      showToast('خطأ: ' + res.message, 'error');
    }
  }).catch(err => {
    document.getElementById('saveBtn').innerText = '💾 حفظ الإجراءات';
    showToast('خطأ في الاتصال بالخادم', 'error');
  });
}

function showLoading(show) { document.getElementById('fullLoading').style.display = show ? 'flex' : 'none'; }
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.innerText = msg;
  if (type === 'error') t.classList.add('error');
  else t.classList.remove('error');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function openProfileModal() {
  document.getElementById('profileModal').style.display = 'block';
  document.getElementById('profOldPwd').value = '';
  document.getElementById('profNewPwd').value = '';
  document.getElementById('profNewPhone').value = '';
  document.getElementById('profError').innerText = '';
}

function closeProfileModal() {
  document.getElementById('profileModal').style.display = 'none';
}

function saveProfile() {
  var oldPwd = document.getElementById('profOldPwd').value.trim();
  var newPwd = document.getElementById('profNewPwd').value.trim();
  var newPhone = document.getElementById('profNewPhone').value.trim();
  var err = document.getElementById('profError');
  var btn = document.getElementById('profSaveBtn');

  if (!oldPwd) return err.innerText = 'كلمة المرور الحالية مطلوبة للتأكيد!';
  if (!newPwd && !newPhone) return err.innerText = 'يجب إدخال إما هاتف جديد أو كلمة مرور جديدة للتعديل!';

  var savedUser = JSON.parse(localStorage.getItem('uhia_user') || '{}');
  var currentPhone = savedUser.phone;

  err.innerText = '';
  btn.innerText = 'جارٍ الحفظ...';

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'updateProfile',
      currentPhone: currentPhone,
      oldPassword: oldPwd,
      newPhone: newPhone,
      newPassword: newPwd
    }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  })
  .then(res => res.json())
  .then(res => {
    btn.innerText = 'حفظ التعديلات';
    if (res.success) {
      alert('تم تحديث بياناتك بنجاح! سيتم تسجيل خروجك لتسجيل الدخول بالبيانات الجديدة.');
      closeProfileModal();
      logout();
    } else {
      err.innerText = res.message || 'فشل التحديث، تأكد من كلمة المرور الحالية.';
    }
  }).catch(error => {
    err.innerText = 'خطأ في الاتصال بالسيرفر.';
    btn.innerText = 'حفظ التعديلات';
  });
}
