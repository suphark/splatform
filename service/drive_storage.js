/**
 * @file service/drive_storage.js
 * ให้บริการฟังก์ชันเฉพาะทางที่เกี่ยวกับการจัดการไฟล์ใน Google Drive
 */

function uploadUserProfileImage(fileData, user) {
  try {
    const [mimeType, base64Data] = fileData.split(',');
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType);
    
    const fileName = `profile_${user.Id}_${new Date().getTime()}`;
    blob.setName(fileName);

    if (user.ProfilePicId) {
      try {
        DriveApp.getFileById(user.ProfilePicId).setTrashed(true);
      } catch (e) {
        Logger.log(`Could not delete old profile picture ${user.ProfilePicId}: ${e.message}`);
      }
    }

    // เรียกใช้ Folder ID จาก APP_CONFIG
    const folder = DriveApp.getFolderById(APP_CONFIG.googleServices.drive.folders.profilePictures);
    const newFile = folder.createFile(blob);
    
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return newFile.getId();

  } catch (e) {
    Logger.log(`Drive Storage Service Error: ${e.toString()}`);
    throw new Error(`เกิดข้อผิดพลาดในการอัปโหลดไฟล์: ${e.message}`);
  }
}

/**
 * [UPDATED] อัปโหลดไฟล์สำหรับ Vendor โดยใช้ Folder ID
 * @param {string | null} folderId - ID ของโฟลเดอร์ (ถ้าเป็น null คือการสร้างใหม่)
 * @param {string} vendorName - ชื่อของ Vendor เพื่อใช้สร้างโฟลเดอร์ใหม่
 * @param {object} fileData - Object ของไฟล์
 * @returns {{folderId: string, uploadedFileIds: object}}
 */
function uploadVendorFiles(folderId, vendorName, fileData) {
    const rootFolder = DriveApp.getFolderById(APP_CONFIG.googleServices.drive.folders.vendorFiles);
    let vendorFolder;

    if (folderId) {
        try {
            vendorFolder = DriveApp.getFolderById(folderId);
        } catch (e) {
            // กรณีหา Folder ID ไม่เจอ (อาจถูกลบด้วยมือ) ให้สร้างใหม่
            Logger.log(`Folder with ID ${folderId} not found. Creating a new one.`);
            vendorFolder = rootFolder.createFolder(vendorName);
        }
    } else {
        // สร้างโฟลเดอร์ใหม่เมื่อเป็น Vendor ใหม่
        vendorFolder = rootFolder.createFolder(vendorName);
    }

    const newFolderId = vendorFolder.getId();
    const uploadedFileIds = {};

    for (const fieldName in fileData) {
        if (Object.hasOwnProperty.call(fileData, fieldName)) {
            const file = fileData[fieldName];
            if (file && file.base64) {
                const blob = Utilities.newBlob(Utilities.base64Decode(file.base64), file.mimeType, file.fileName);
                const newFile = vendorFolder.createFile(blob);
                uploadedFileIds[fieldName] = newFile.getId();
            }
        }
    }
    
    return { folderId: newFolderId, uploadedFileIds: uploadedFileIds };
}

// เพิ่มฟังก์ชันนับจำนวน Vendor เพื่อช่วยสร้าง ID ชั่วคราว
function countTotalVendors() {
    return APP_CONFIG.sheetsData.vendors.getTable().count();
}

/**
 * [UPDATED] เปลี่ยนชื่อโฟลเดอร์ของ Vendor ตาม Folder ID
 * @param {string} folderId - ID ของโฟลเดอร์ที่จะเปลี่ยนชื่อ
 * @param {string} newName - ชื่อใหม่
 */
function renameVendorFolder(folderId, newName) {
    try {
        if (folderId) {
            const folder = DriveApp.getFolderById(folderId);
            folder.setName(newName);
            Logger.log(`Renamed folder ID ${folderId} to "${newName}"`);
        }
    } catch (e) {
        Logger.log(`Could not rename folder with ID ${folderId}. Error: ${e.message}`);
    }
}

/**
 * [UPDATED] ลบโฟลเดอร์ของ Vendor ตาม Folder ID
 * @param {string} folderId - ID ของโฟลเดอร์ที่จะลบ
 */
function deleteVendorFolder(folderId) {
    try {
        if (folderId) {
            const folder = DriveApp.getFolderById(folderId);
            folder.setTrashed(true);
            return true;
        }
    } catch (e) {
        Logger.log(`Could not delete folder with ID ${folderId}. Error: ${e.message}`);
    }
    return false;
}






