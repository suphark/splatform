function getProjectsByVendorId(vendorId) {
  try {
    return getProjectsByVendorIdFromDB(vendorId);
  } catch (e) {
    Logger.log(`Error in getProjectsByVendorId: ${e.message}`);
    return [];
  }
}

/**
 * [UPDATED] ประมวลผลการเพิ่ม/แก้ไขโครงการอ้างอิง พร้อมแก้ไขการบันทึก Project Owner
 */
function processAddOrEditProject(formData, fileData) {
    try {
        // --- Validation ---
        if (!formData.VendorId || !formData.ProjectName || !formData.ProjectYear || !formData.ProjectTypeId) {
            throw new Error("ข้อมูลไม่ครบถ้วน (ชื่อโครงการ, ปี, และประเภทโครงการ)");
        }
        // ตรวจสอบว่าต้องมี Project Owner อย่างน้อยหนึ่งอย่าง
        if (!formData.ProjectOwnerId && !formData.ProjectOwnerCustom) {
             throw new Error("กรุณาระบุเจ้าของโครงการ");
        }

        // --- [CRITICAL FIX] จัดการข้อมูล Project Owner ---
        // กรณีที่ 1: ผู้ใช้เลือก "อื่นๆ" จาก Dropdown
        if (formData.ProjectOwnerId === 'other') {
            // เราจะใช้ค่าจากช่อง Custom ดังนั้นให้ล้างค่า ID ทิ้งไป
            formData.ProjectOwnerId = '';
        } 
        // กรณีที่ 2: ผู้ใช้เลือกเจ้าของโครงการจาก Dropdown
        else if (formData.ProjectOwnerId) { 
            // เราจะใช้ค่าจาก ID ดังนั้นให้ล้างค่า Custom ทิ้งไป (ป้องกันข้อมูลขยะ)
            formData.ProjectOwnerCustom = '';
        }
        // --- จบส่วนแก้ไข ---

        if (Array.isArray(formData.PackageIds)) {
            formData.PackageIds = formData.PackageIds.join(',');
        }
        
        if (fileData && fileData.projectFile) {
            const vendor = findVendorById(formData.VendorId);
            if (!vendor || !vendor.FolderId) {
                throw new Error("ไม่พบโฟลเดอร์สำหรับ Vendor นี้ กรุณาแนบไฟล์ในหน้าข้อมูลหลักก่อน");
            }
            const result = uploadVendorFiles(vendor.FolderId, vendor.NameThai, { ProjectFile: fileData.projectFile });
            formData.ProjectFileId = result.uploadedFileIds.ProjectFile;
        }

        const isEditMode = !!formData.Id;
        if (isEditMode) {
            updateProjectReferenceById(formData.Id, formData);
        } else {
            addNewProjectReference(formData);
        }
        
        const updatedProjects = getProjectsByVendorIdFromDB(formData.VendorId);
        return { success: true, message: 'บันทึกข้อมูลโครงการอ้างอิงสำเร็จ!', projects: updatedProjects };

    } catch (e) {
        Logger.log("Error in processAddOrEditProject: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

function processDeleteProject(projectId, vendorId) {
    try {
        deleteProjectReferenceById(projectId);
        const updatedProjects = getProjectsByVendorIdFromDB(vendorId);
        return { success: true, message: 'ลบข้อมูลโครงการสำเร็จ!', projects: updatedProjects };
    } catch (e) {
        Logger.log("Error in processDeleteProject: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [NEW SERVER-CALL] ดึงข้อมูลโครงการอ้างอิงรายการเดียวตาม ID
 * @param {string} projectId - ID ของโครงการ
 * @returns {object | null}
 */
function getProjectReferenceById(projectId) {
  try {
    const table = APP_CONFIG.sheetsData.vendorProjects.getTable();
    const project = table.where(row => row.Id === projectId).getRows()[0];
    table.clearAll();
    return project || null;
  } catch(e) {
    Logger.log("Error in getProjectReferenceById: " + e.message);
    return null;
  }
}


