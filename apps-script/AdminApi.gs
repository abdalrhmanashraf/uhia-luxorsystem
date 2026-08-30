// ═══════════════════════════════════════════════════════════════
// AdminApi.gs — API endpoints للوحة متابعة الشكاوى (فريق الإدارة)
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

// كلمة المرور الثابتة (تُحفظ في PropertiesService بعد النشر)
var ADMIN_PASSWORD_KEY = 'ADMIN_PASSWORD';

// ─── التحقق من كلمة المرور الإدارية ──────────────────────────
function verifyAdminToken(token) {
  if (!token) return false;
  var stored = PropertiesService.getScriptProperties().getProperty(ADMIN_PASSWORD_KEY);
  if (!stored) {
    // إذا لم تُحدَّد بعد، نقبل كلمة المرور الافتراضية: UHIA-LUXOR-2026
    stored = 'UHIA-LUXOR-2026';
  }
  return token === stored;
}

// ─── API: تسجيل الدخول ───────────────────────────────────────
function adminLogin(password) {
  if (verifyAdminToken(password)) {
    return { success: true, message: 'تم تسجيل الدخول بنجاح' };
  }
  return { success: false, error: 'كلمة المرور غير صحيحة' };
}

// ─── API: جلب قائمة الشكاوى مع الفلترة ──────────────────────
/**
 * filters: {
 *   status, category, location, severity,
 *   dateFrom, dateTo, search,
 *   page (1-based), pageSize (default 20)
 * }
 */
function getComplaints(token, filters) {
  if (!verifyAdminToken(token)) {
    return { success: false, error: 'غير مصرح' };
  }

  try {
    filters = filters || {};
    var pageSize = parseInt(filters.pageSize) || 20;
    var page     = Math.max(1, parseInt(filters.page) || 1);

    var rows = getAllRows(CONFIG.SHEETS.COMPLAINTS);

    // ── تطبيق الفلاتر ─────────────────────────────────────────
    var filtered = rows.filter(function(c) {
      if (filters.status   && c.status   !== filters.status)   return false;
      if (filters.category && c.category !== filters.category) return false;
      if (filters.location && c.location !== filters.location) return false;
      if (filters.severity && c.severity !== filters.severity) return false;
      if (filters.dateFrom && new Date(c.timestamp) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo   && new Date(c.timestamp) > new Date(filters.dateTo))   return false;
      if (filters.search) {
        var q = String(filters.search).toLowerCase();
        var hay = (c.complaintId + c.name + c.nationalId + c.providerName + c.complaintText).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    // ── ترتيب: المتأخرة أولاً ثم الجديدة ─────────────────────
    filtered.sort(function(a, b) {
      var prioA = getPriority(a);
      var prioB = getPriority(b);
      if (prioA !== prioB) return prioA - prioB;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // ── Pagination ─────────────────────────────────────────────
    var totalCount = filtered.length;
    var start      = (page - 1) * pageSize;
    var paged      = filtered.slice(start, start + pageSize).map(cleanComplaintForAdmin);

    return {
      success:    true,
      total:      totalCount,
      page:       page,
      pageSize:   pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      items:      paged,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── API: تحديث حالة شكوى ────────────────────────────────────
/**
 * update: {
 *   complaintId, status, resolutionNote, assignedTo
 * }
 */
function updateComplaintStatus(token, update) {
  if (!verifyAdminToken(token)) {
    return { success: false, error: 'غير مصرح' };
  }
  if (!update || !update.complaintId) {
    return { success: false, error: 'complaintId مطلوب' };
  }

  var validStatuses = ['جديدة', 'تحت المراجعة', 'تم الحل', 'مغلقة'];
  if (update.status && validStatuses.indexOf(update.status) === -1) {
    return { success: false, error: 'حالة غير صحيحة' };
  }

  try {
    var now     = new Date();
    var updates = { lastUpdated: now };

    if (update.status)         updates.status         = update.status;
    if (update.resolutionNote) updates.resolutionNote = update.resolutionNote;
    if (update.assignedTo)     updates.assignedTo     = update.assignedTo;

    // إذا تم الإغلاق، نسجل وقته
    if (update.status === 'مغلقة' || update.status === 'تم الحل') {
      updates.closedAt = now;
      updates.closedBy = update.assignedTo || 'فريق المتابعة';
      // تحديث SLA Log
      updateRowWhere(CONFIG.SHEETS.SLA_LOG, 'complaintId', update.complaintId, {
        closedAt: now,
        status:   'مغلق',
      });
    }

    var found = updateRowWhere(
      CONFIG.SHEETS.COMPLAINTS, 'complaintId', update.complaintId, updates
    );

    if (!found) return { success: false, error: 'الشكوى غير موجودة' };

    // تسجيل في AuditLog
    writeAuditLog(
      'UPDATE_STATUS',
      update.complaintId,
      'Status:' + (update.status || '') + ' | Note:' + (update.resolutionNote || ''),
      update.assignedTo || 'admin'
    );

    // تحديث KPI Cache في الخلفية
    try { refreshKpiCache(); } catch(e){}

    return { success: true, message: 'تم التحديث بنجاح' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── API: جلب تفاصيل شكوى واحدة ─────────────────────────────
function getComplaintDetail(token, complaintId) {
  if (!verifyAdminToken(token)) return { success: false, error: 'غير مصرح' };
  try {
    var row = findRow(CONFIG.SHEETS.COMPLAINTS, 'complaintId', complaintId);
    if (!row) return { success: false, error: 'غير موجود' };

    // سجل التعديلات
    var audit = getAllRows(CONFIG.SHEETS.AUDIT_LOG).filter(function(a) {
      return a.entityId === complaintId;
    });

    return { success: true, complaint: cleanComplaintForAdmin(row), auditLog: audit };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── API: تعيين كلمة مرور جديدة ──────────────────────────────
function setAdminPassword(currentToken, newPassword) {
  if (!verifyAdminToken(currentToken)) {
    return { success: false, error: 'غير مصرح' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  }
  PropertiesService.getScriptProperties().setProperty(ADMIN_PASSWORD_KEY, newPassword);
  writeAuditLog('CHANGE_PASSWORD', 'system', 'Admin password changed', 'admin');
  return { success: true, message: 'تم تغيير كلمة المرور' };
}

// ─── Helpers ──────────────────────────────────────────────────
function getPriority(c) {
  if (c.slaBreached === 'نعم') return 1;
  if (c.slaStatus   === 'تحذير') return 2;
  if (c.status      === 'جديدة') return 3;
  if (c.status      === 'تحت المراجعة') return 4;
  return 5;
}

function cleanComplaintForAdmin(c) {
  return {
    id:             c.complaintId,
    timestamp:      c.timestamp,
    nationalId:     c.nationalId,
    name:           c.name,
    phone:          c.phone,
    category:       c.category,
    providerCode:   c.providerCode,
    providerName:   c.providerName,
    location:       c.location,
    text:           c.complaintText,
    hasAudio:       c.hasAudio === 'نعم',
    audioUrl:       c.audioUrl || '',
    hasImages:      c.hasImages === 'نعم',
    imageUrls:      (c.imageUrls || '').split(' | ').filter(Boolean),
    status:         c.status,
    assignedTo:     c.assignedTo || '',
    resolutionNote: c.resolutionNote || '',
    closedAt:       c.closedAt || '',
    closedBy:       c.closedBy || '',
    slaHours:       c.slaHours || '',
    slaStatus:      c.slaStatus || '',
    slaBreached:    c.slaBreached === 'نعم',
    severity:       c.severity || '',
    lastUpdated:    c.lastUpdated || '',
  };
}
