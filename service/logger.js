/**
 * svc_logger.gs
 * ทำหน้าที่จัดการการบันทึก Audit Log ทั้งหมด
 */

function writeAuditLog(action, target = '-', details = '-') {
  try {
    const session = checkUserSession();
    const userEmail = session.isLoggedIn ? session.email : 'Anonymous';

    // [IMPROVED] เรียกใช้ getRawSheet() จาก Data Access Layer ของเราโดยตรง
    const logSheet = APP_CONFIG.sheetsData.auditLog.getRawSheet();
    
    logSheet.appendRow([ new Date(), userEmail, action, target, details ]);

  } catch (e) {
    Logger.log(`Failed to write Audit Log: ${e.message}`);
  }
}