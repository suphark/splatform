/**
 * [HELPER] ค้นหาหรือสร้างโฟลเดอร์ และคืนค่า Folder Object
 * @param {Folder} parentFolder - โฟลเดอร์แม่
 * @param {string} folderName - ชื่อโฟลเดอร์ที่ต้องการ
 * @returns {Folder} Folder Object
 */
function getOrCreateFolder(parentFolder, folderName) {
  const cleanFolderName = folderName.trim();
  const folders = parentFolder.getFoldersByName(cleanFolderName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(cleanFolderName);
}

/**
 * [REVISED] อัปโหลดไฟล์ลงโฟลเดอร์ย่อย, ลบไฟล์เก่า, และคืนค่าเป็น Folder ID
 * @param {string|null} vendorFolderId - ID ของโฟลเดอร์หลักของ Vendor (ถ้ามี)
 * @param {string} vendorName - ชื่อของ Vendor (สำหรับสร้างโฟลเดอร์หลัก)
 * @param {object} fileData - อ็อบเจกต์ของไฟล์ที่ต้องการอัปโหลด
 * @returns {{folderId: string, uploadedFileIds: object}} ID ของโฟลเดอร์หลักและอ็อบเจกต์ของ Folder ID ที่อัปเดตแล้ว
 */
function uploadAndOrganizeVendorFiles(vendorFolderId, vendorName, fileData) {
  const mainVendorFolderContainer = DriveApp.getFolderById(APP_CONFIG.googleServices.drive.folders.vendorFiles);
 
  const vendorFolder = vendorFolderId 
    ? DriveApp.getFolderById(vendorFolderId)
    : getOrCreateFolder(mainVendorFolderContainer, vendorName);

  const updatedFolderIds = {};

  const folderMapping = {
    'companyProfileFile': '1. เอกสารข้อมูลบริษัท (Company Profile)',
    'idCardFile': '2. บัตรประชาชน (ID Card)',
    'companyCertFile': '3. หนังสือรับรองบริษัท',
    'vatCertFile': '4. ใบทะเบียนภาษีมูลค่าเพิ่ม (ภพ.20)',
    'bookBankFile': '5. สมุดบัญชีธนาคาร (Book Bank)'
  };

  for (const fileKey in fileData) {
    if (Object.hasOwnProperty.call(fileData, fileKey) && folderMapping[fileKey]) {
      const file = fileData[fileKey];
      const subFolderName = folderMapping[fileKey];
     
      const subFolder = getOrCreateFolder(vendorFolder, subFolderName);

      // [NEW] ลบไฟล์เก่าทั้งหมดในโฟลเดอร์ย่อยก่อนอัปโหลดไฟล์ใหม่
      const existingFiles = subFolder.getFiles();
      while (existingFiles.hasNext()) {
        existingFiles.next().setTrashed(true);
      }

      const decoded = Utilities.base64Decode(file.base64);
      const blob = Utilities.newBlob(decoded, file.mimeType, file.fileName);
      subFolder.createFile(blob);

      // --- [CRITICAL FIX] แก้ไขตรรกะการสร้างชื่อ Key ให้ถูกต้อง ---
      // 1. ตัดคำว่า 'File' ที่ไม่ต้องการออกจาก Key เดิม
      const correctedFileKey = fileKey.replace('File', '');
      // 2. สร้างชื่อ Field ที่ถูกต้องจาก Key ที่แก้ไขแล้ว
      const fieldName = correctedFileKey.charAt(0).toUpperCase() + correctedFileKey.slice(1) + 'FolderId';
      // --- จบส่วนแก้ไข ---

      updatedFolderIds[fieldName] = subFolder.getId();
    }
  }

  return {
    folderId: vendorFolder.getId(),
    uploadedFileIds: updatedFolderIds
  };
}