// file: mod_vendor_drive_service.gs

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
 * [NEW & CORRECTED] อัปโหลดและจัดระเบียบไฟล์ Vendor ลงในโฟลเดอร์ย่อยตามประเภท
 * @param {string|null} vendorFolderId - ID ของโฟลเดอร์หลักของ Vendor (ถ้ามี)
 * @param {string} vendorName - ชื่อของ Vendor (สำหรับสร้างโฟลเดอร์หลัก)
 * @param {object} fileData - อ็อบเจกต์ของไฟล์ที่ต้องการอัปโหลด
 * @returns {{folderId: string, uploadedFileIds: object}} ID ของโฟลเดอร์หลักและอ็อบเจกต์ของ File ID ที่อัปโหลดแล้ว
 */
function uploadAndOrganizeVendorFiles(vendorFolderId, vendorName, fileData) {
  const mainVendorFolderContainer = DriveApp.getFolderById(APP_CONFIG.googleServices.drive.folders.vendorFiles);
  
  // 1. ค้นหาหรือสร้างโฟลเดอร์หลักของ Vendor
  const vendorFolder = vendorFolderId 
    ? DriveApp.getFolderById(vendorFolderId)
    : getOrCreateFolder(mainVendorFolderContainer, vendorName);

  const uploadedFileIds = {};

  // 2. กำหนดการจับคู่ระหว่าง ID ของ input กับชื่อโฟลเดอร์ที่จะสร้าง
  const folderMapping = {
    'companyProfileFile': '1. เอกสารข้อมูลบริษัท (Company Profile)',
    'idCardFile': '2. บัตรประชาชน (ID Card)',
    'companyCertFile': '3. หนังสือรับรองบริษัท (Company Registration Certificate)',
    'vatCertFile': '4. ใบทะเบียนภาษีมูลค่าเพิ่ม ภพ.20 (VAT Registration Certificate)',
    'bookBankFile': '5. สมุดบัญชีธนาคาร (Book Bank)'
  };

  // 3. วนลูปไฟล์ที่ส่งมาเพื่ออัปโหลด
  for (const fileKey in fileData) {
    if (Object.hasOwnProperty.call(fileData, fileKey) && folderMapping[fileKey]) {
      const file = fileData[fileKey];
      const subFolderName = folderMapping[fileKey];
      
      // 3.1 ค้นหาหรือสร้างโฟลเดอร์ย่อย
      const subFolder = getOrCreateFolder(vendorFolder, subFolderName);
      
      // 3.2 สร้างไฟล์จากข้อมูล Base64
      const decoded = Utilities.base64Decode(file.base64);
      const blob = Utilities.newBlob(decoded, file.mimeType, file.fileName);
      
      // 3.3 อัปโหลดไฟล์เข้าไปในโฟลเดอร์ย่อย
      const uploadedFile = subFolder.createFile(blob);
      
      // 3.4 เก็บ File ID เพื่อนำไปบันทึกลงชีต
      // สร้าง Key ให้ตรงกับชื่อคอลัมน์ในชีต เช่น companyProfileFile -> CompanyProfileFileId
      const fieldName = fileKey.charAt(0).toUpperCase() + fileKey.slice(1) + 'Id';
      uploadedFileIds[fieldName] = uploadedFile.getId();
    }
  }

  return {
    folderId: vendorFolder.getId(),
    uploadedFileIds: uploadedFileIds
  };
}