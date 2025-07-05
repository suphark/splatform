/**
 * file: mod_vendor_project_controller.gs
 */

// ฟังก์ชันนี้ยังคงเดิม
function getProjectsByVendorId(vendorId) {
    try {
        if (!vendorId) return [];
        const table = APP_CONFIG.sheetsData.vendorProjects.getTable();
        const projects = table.where(row => row.VendorId === vendorId).sortBy('ProjectYear', 'desc').getRows();
        table.clearAll();
        return projects;
    } catch (e) {
        Logger.log(`Error in getProjectsByVendorId: ${e.message}`);
        return [];
    }
}

/**
 * [REFACTORED] ประมวลผลการเพิ่ม/แก้ไขโครงการอ้างอิง
 * @param {object} formData
 * @param {object} fileData
 * @returns {object}
 */
function processAddOrEditProject(formData, fileData) {
    // --- Validation & Data Transformation พิเศษสำหรับ Project ---
    if (!formData.ProjectOwnerId && !formData.ProjectOwnerCustom) {
        return { success: false, message: "กรุณาระบุเจ้าของโครงการ" };
    }
    if (!formData.PackageIds) {
        return { success: false, message: "กรุณาระบุประเภทงานที่ทำ (Pakcage)" };
    }

    if (formData.ProjectOwnerId === 'other') {
        formData.ProjectOwnerId = '';
    } else if (formData.ProjectOwnerId) {
        formData.ProjectOwnerCustom = '';
    }
    if (Array.isArray(formData.PackageIds)) {
        formData.PackageIds = formData.PackageIds.join(',');
    }

    const action = formData.Id ? 'edit' : 'add';
    return processGenericCrudAction('vendorProject', action, formData);
}

/**
 * [REFACTORED] ประมวลผลการลบโครงการ
 * @param {string} projectId
 * @param {string} vendorId
 * @returns {object}
 */
function processDeleteProject(projectId, vendorId) {
    return processGenericCrudAction('vendorProject', 'delete', { id: projectId, parentId: vendorId });
}


// ฟังก์ชันดึงข้อมูลรายการเดียวยังคงมีประโยชน์
function getProjectReferenceById(projectId) {
    try {
        return APP_CONFIG.sheetsData.vendorProjects.getTable().where(row => row.Id === projectId).first();
    } catch(e) {
        Logger.log("Error in getProjectReferenceById: " + e.message);
        return null;
    }
}