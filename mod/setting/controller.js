/**
 *   @file mod/setting/controller.js
 * ประมวลผลคำสั่งที่เกี่ยวข้องกับการตั้งค่าเว็บไซต์
 */

function processUpdateSettings(settingsData) {
    try {
        const session = checkUserSession();
        if (!session.isLoggedIn || session.role !== 'Admin') {
            throw new Error('คุณไม่มีสิทธิ์ดำเนินการนี้');
        }

        updateSettings(settingsData);
        writeAuditLog('Admin: Update Settings');
        return { success: true, message: 'บันทึกการตั้งค่าสำเร็จ!' };

    } catch (e) {
        Logger.log('Update Settings Error: ' + e.toString());
        return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึก: ' + e.message };
    }
}