// ═══════════════════════════════════════════════════════════════
// ComplaintHandler.gs — معالج استقبال وحفظ الشكاوى
// UHIA Luxor System v2.0
// ═══════════════════════════════════════════════════════════════

/**
 * المدخلات المتوقعة (payload):
 * {
 *   nationalId, name, phone,
 *   category, providerCode, providerName,
 *   text, audioBase64, images[]
 * }
 * المخرجات: { success, id }
 */
function saveComplaint(payload) {
  // ── 1. التحقق من البيانات الإلزامية ─────────────────────────
  if (!payload.nationalId || !payload.name || !payload.phone) {
    return { success: false, error: 'بيانات ناقصة: nationalId / name / phone' };
  }
  if (!/^\d{14}$/.test(String(payload.nationalId))) {
    return { success: false, error: 'الرقم القومي يجب أن يكون 14 رقماً' };
  }
  if (!/^01[0-9]{9}$/.test(String(payload.phone))) {
    return { success: false, error: 'رقم الهاتف غير صحيح' };
  }
  if (!payload.text && !payload.audioBase64) {
    return { success: false, error: 'يجب تقديم نص الشكوى أو التسجيل الصوتي' };
  }

  // ── 2. Rate Limiting ──────────────────────────────────────────
  if (isRateLimited(payload.nationalId)) {
    return { success: false, error: 'تم تجاوز الحد المسموح. حاول لاحقاً' };
  }

  // ── 3. تصنيف الشكوى تلقائياً ─────────────────────────────────
  var severity = classifySeverity(payload.text || '');
  var slaHours = (severity === 'عالٍ')
    ? CONFIG.SLA.URGENT_HOURS
    : CONFIG.SLA.DEFAULT_HOURS;

  // ── 4. رفع الملفات إلى Google Drive (إن وُجدت) ─────────────
  var audioUrl  = '';
  var imageUrls = [];

  if (payload.audioBase64) {
    try {
      audioUrl = saveFileToDrive(
        payload.audioBase64,
        'audio/webm',
        'audio_' + Date.now() + '.webm'
      );
    } catch (e) {
      Logger.log('Audio upload error: ' + e.message);
    }
  }

  if (payload.images && payload.images.length > 0) {
    payload.images.slice(0, 5).forEach(function(b64, idx) { // حد أقصى 5 صور
      try {
        var url = saveFileToDrive(b64, 'image/jpeg', 'img_' + Date.now() + '_' + idx + '.jpg');
        imageUrls.push(url);
      } catch (e) {
        Logger.log('Image upload error: ' + e.message);
      }
    });
  }

  // ── 5. توليد ID الشكوى ───────────────────────────────────────
  var complaintId = generateId('CMP');
  var now         = new Date();

  // ── 6. حفظ الشكوى في الشيت ──────────────────────────────────
  appendRow(CONFIG.SHEETS.COMPLAINTS, [
    complaintId,                              // A: complaintId
    now,                                      // B: timestamp
    String(payload.nationalId),              // C: nationalId
    payload.name,                            // D: name
    String(payload.phone),                   // E: phone
    payload.category    || '',               // F: category
    payload.providerCode || '',              // G: providerCode
    payload.providerName || '',              // H: providerName
    extractLocation(payload.providerCode),   // I: location
    (payload.text || '').substring(0, 2000), // J: complaintText (حد 2000 حرف)
    audioUrl  ? 'نعم' : 'لا',              // K: hasAudio
    audioUrl,                               // L: audioUrl
    imageUrls.length > 0 ? 'نعم' : 'لا', // M: hasImages
    imageUrls.join(' | '),                  // N: imageUrls
    'جديدة',                               // O: status
    '',                                     // P: assignedTo
    '',                                     // Q: resolutionNote
    '',                                     // R: closedAt
    '',                                     // S: closedBy
    slaHours,                              // T: slaHours
    'في الوقت',                            // U: slaStatus
    'لا',                                  // V: slaBreached
    severity,                              // W: severity
    now,                                   // X: lastUpdated
  ]);

  // ── 7. تسجيل في SLA_Log ──────────────────────────────────────
  appendRow(CONFIG.SHEETS.SLA_LOG, [
    complaintId,
    now,
    slaHours,
    new Date(now.getTime() + slaHours * 3600000), // deadline
    'مفتوح',
    '',
  ]);

  // ── 8. AuditLog ──────────────────────────────────────────────
  writeAuditLog('CREATE_COMPLAINT', complaintId,
    'Category:' + payload.category + ' | Severity:' + severity, 'public_form');

  return { success: true, id: complaintId };
}

// ─── رفع ملف إلى Google Drive ────────────────────────────────
function saveFileToDrive(base64Data, mimeType, filename) {
  var folder = getDriveFolder();
  var decoded = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType,
    filename
  );
  var file = folder.createFile(decoded);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/file/d/' + file.getId() + '/view';
}

// ─── الحصول على مجلد Drive مخصص للمرفقات ─────────────────────
function getDriveFolder() {
  var folderName = 'UHIA-Luxor-Attachments';
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// ─── استخراج الموقع من كود المنفذ ────────────────────────────
function extractLocation(providerCode) {
  if (!providerCode) return '';
  if (providerCode.startsWith('UNIT')) {
    var num = parseInt(providerCode.replace('UNIT', ''));
    if (num >= 1  && num <= 20) return 'إسنا';
    if (num >= 21 && num <= 36) return 'أرمنت';
    if (num >= 37 && num <= 56) return 'الأقصر';
  }
  if (providerCode.startsWith('CARE')) return 'الأقصر';
  if (providerCode.startsWith('CONT')) return 'الأقصر';
  if (providerCode.startsWith('LAB'))  return 'الأقصر';
  return 'الأقصر';
}
