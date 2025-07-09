/**
 * @file mod/vendor/project/controller.js
*/


/**
 * [UPDATE] แก้ไข getProjectsByVendorId ให้ดึงข้อมูลชื่อจากชีตที่เกี่ยวข้องมาด้วย
 */
function getProjectsByVendorId(vendorId) {
    if (!vendorId) return [];
    try {
        // 1. ดึงข้อมูลดิบทั้งหมดที่จำเป็น
        const projects = APP_CONFIG.sheetsData.vendorProjects.getTable().where(row => row.VendorId === vendorId).sortBy('ProjectYear', 'desc').getRows();
        const projectTypes = getAllProjectTypes();
        const projectOwners = getAllProjectOwners();
        const packages = getAllPackages();

        // 2. สร้าง Map เพื่อให้ค้นหาชื่อได้รวดเร็ว
        const typeMap = new Map(projectTypes.map(item => [item.Id, item.Name]));
        const ownerMap = new Map(projectOwners.map(item => [item.Id, item.NameThai]));
        const packageMap = new Map(packages.map(item => [item.Id, item.NameThai]));

        // 3. วนลูปเพื่อเพิ่มข้อมูล "ชื่อ" เข้าไปในแต่ละโปรเจกต์
        const enrichedProjects = projects.map(p => {
            const packageIds = p.PackageIds ? String(p.PackageIds).split(',') : [];
            const packageNames = packageIds.map(id => packageMap.get(id.trim()) || id.trim()).join(', ');

            return {
                ...p, // คงข้อมูลเดิมทั้งหมดไว้สำหรับฟอร์มแก้ไข
                ProjectTypeName: typeMap.get(p.ProjectTypeId) || '-',
                ProjectOwnerName: ownerMap.get(p.ProjectOwnerId) || p.ProjectOwnerCustom || '-',
                PackageNamesDisplay: packageNames || '-',
            };
        });
        
        return enrichedProjects;

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