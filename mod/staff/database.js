// mod/staff/database.js
/**
 * @file mod/staff/database.js
 * @description Data access layer for Staffs feature.
 */

/**
 * ดึงข้อมูลพนักงานทั้งหมด
 * @returns {Array<Object>}
 */
function getAllStaffs() {
  return APP_CONFIG.sheetsData.staffs.getTable().getRows();
}

/**
 * ค้นหาพนักงานด้วย ID
 * @param {string} staffId
 * @returns {Object|null}
 */
function findStaffById(staffId) {
  if (!staffId) return null;
  return APP_CONFIG.sheetsData.staffs.getTable().where(row => row.Id === staffId).first();
}

/**
 * เพิ่มพนักงานใหม่
 * @param {object} data ข้อมูลพนักงาน
 */
function addNewStaff(data) {
  data.CreateDate = new Date();
  data.ModifiedDate = new Date();
  APP_CONFIG.sheetsData.staffs.getTable()
    .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'STF-' })
    .insertRows([data]);
}

/**
 * อัปเดตข้อมูลพนักงานด้วย ID
 * @param {string} staffId
 * @param {object} data ข้อมูลที่จะอัปเดต
 */
function updateStaffById(staffId, data) {
  data.ModifiedDate = new Date();
  APP_CONFIG.sheetsData.staffs.getTable()
    .where(row => row.Id === staffId)
    .updateRows(row => ({ ...row, ...data }));
}

/**
 * ลบข้อมูลพนักงานด้วย ID
 * @param {string} staffId
 */
function deleteStaffById(staffId) {
  APP_CONFIG.sheetsData.staffs.getTable()
    .where(row => row.Id === staffId)
    .deleteRows();
}

/**
 * อัปโหลดหรือเปลี่ยนรูปโปรไฟล์พนักงาน
 * @param {object} fileData - ข้อมูลไฟล์ base64
 * @param {string} staffId - ID พนักงาน
 * @param {string} folderId - ID ของโฟลเดอร์ใน Drive
 * @param {string|null} oldImageUrl - URL รูปเก่าที่จะลบ
 * @returns {string} URL ของรูปใหม่
 */
function uploadStaffProfileImage(fileData, staffId, folderId, oldImageUrl) {
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData.base64), fileData.mimeType, fileData.fileName);
    const fileName = `staff_${staffId}_${new Date().getTime()}`;
    blob.setName(fileName);

    // Delete old file if it exists
    if (oldImageUrl) {
      try {
        const oldFileId = oldImageUrl.match(/id=([^&]+)/)[1];
        if (oldFileId) DriveApp.getFileById(oldFileId).setTrashed(true);
      } catch (e) {
        Logger.log(`Could not trash old profile pic: ${e.message}`);
      }
    }

    const folder = DriveApp.getFolderById(folderId);
    const newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // คืนค่าเป็น URL ที่ใช้แสดง thumbnail ได้ทันที
    return `https://drive.google.com/thumbnail?id=${newFile.getId()}`;
  } catch (e) {
    Logger.log(`Staff Image Upload Error: ${e.toString()}`);
    throw new Error('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
  }
}