/**
 * @file mod/vendor/project/controller.js
*/


/**
 * [SERVER-CALL] [NEW] ดึงข้อมูลโครงการทั้งหมดสำหรับทำ Dropdown
 */
function getAllProjectsForSelection() {
    try {
        const projects = APP_CONFIG.sheetsData.projects.getTable().getRows();
        const projectTypes = getAllProjectTypes();
        const projectOwners = getAllProjectOwners();
        
        const typeMap = new Map(projectTypes.map(t => [t.Id, t.Name]));
        const ownerMap = new Map(projectOwners.map(o => [o.Id, o.NameThai]));

        // Join ข้อมูลที่จำเป็นสำหรับการแสดงผล
        const formattedProjects = projects.map(p => {
            const typeIds = p.ProjectTypeId ? String(p.ProjectTypeId).split(',') : [];
            const typeNames = typeIds.map(id => typeMap.get(id.trim()) || id).join(', ');

            return {
                Id: p.Id,
                DisplayName: `${p.NameThai}${p.NameEnglish ? ' | ' + p.NameEnglish : ''}`,
                ProjectTypeName: typeNames,
                ProjectOwnerName: ownerMap.get(p.ProjectOwnerId) || '-',
                ProjectYear: p.ProjectYear || '-'
            };
        });
        return formattedProjects;
    } catch (e) {
        Logger.log(`Error in getAllProjectsForSelection: ${e.message}`);
        return [];
    }
}

/**
 * [REVISED] แก้ไขฟังก์ชัน getProjectsByVendorId ใหม่ทั้งหมด
 * ให้ทำการ Join ข้อมูลจาก 'Projects' หลัก มาแสดงในรายการอ้างอิงของ Vendor
 */
function getProjectsByVendorId(vendorId) {
    if (!vendorId) return [];
    try {
        // 1. ดึงข้อมูลอ้างอิงทั้งหมดของ Vendor คนนี้ (จะได้แค่ ProjectId)
        const vendorProjectRefs = APP_CONFIG.sheetsData.vendorProjects.getTable()
            .where(row => row.VendorId === vendorId)
            .getRows();

        if (vendorProjectRefs.length === 0) return [];

        const refMap = new Map(vendorProjectRefs.map(ref => [ref.ProjectId, ref]));
        const referencedProjectIds = Array.from(refMap.keys());

        // 3. ดึงข้อมูล Master ทั้งหมดที่จำเป็น
        const allMasterProjects = APP_CONFIG.sheetsData.projects.getTable().getRows();
        const projectTypes = getAllProjectTypes();
        const projectOwners = getAllProjectOwners();
        const packages = getAllPackages();

        // 4. สร้าง Map สำหรับการ Join ชื่อ
        const typeMap = new Map(projectTypes.map(item => [item.Id, item.Name]));
        const ownerMap = new Map(projectOwners.map(item => [item.Id, item.NameThai]));
        const packageMap = new Map(packages.map(item => [item.Id, item.NameThai]));

        // 5. กรองเฉพาะโครงการหลักที่มีการอ้างอิงถึง และทำการ Join ข้อมูลทั้งหมด
        const enrichedProjects = allMasterProjects
            .filter(p => referencedProjectIds.includes(p.Id))
            .map(masterProject => {
                const refData = refMap.get(masterProject.Id);
                const projectTypeNames = masterProject.ProjectTypeId ? String(masterProject.ProjectTypeId).split(',').map(id => typeMap.get(id.trim()) || id).join(', ') : '-';
                const packageNames = refData.PackageIds ? String(refData.PackageIds).split(',').map(id => packageMap.get(id.trim()) || id).join(', ') : '-';
                
                return {
                    // ข้อมูลจาก VendorProjects (ตารางอ้างอิง)
                    Id: refData.Id, 
                    VendorId: refData.VendorId,
                    ProjectId: refData.ProjectId,
                    PackageIds: refData.PackageIds,
                    ContractValue: refData.ContractValue,
                    ProjectDescription: refData.ProjectDescription,
                    PackageNamesDisplay: packageNames,
                    
                    // ข้อมูลจาก Projects (ตารางหลัก)
                    ProjectName: masterProject.NameThai,
                    ProjectYear: masterProject.ProjectYear,
                    
                    // [FIXED] เพิ่ม ProjectOwnerId กลับเข้าไปเพื่อให้ PQ คำนวณคะแนนได้
                    ProjectOwnerId: masterProject.ProjectOwnerId, 

                    // ข้อมูลที่ Join มา
                    ProjectTypeName: projectTypeNames,
                    ProjectOwnerName: ownerMap.get(masterProject.ProjectOwnerId) || '-',
                };
            });

        return enrichedProjects.sort((a,b) => (b.ProjectYear || 0) - (a.ProjectYear || 0));

    } catch (e) {
        Logger.log(`Error in getProjectsByVendorId: ${e.message}`);
        return [];
    }
}

/**
 * [REVISED] แก้ไขฟังก์ชันนี้ให้ทำงานกับฟอร์มใหม่
 * @param {object} formData ข้อมูลจากฟอร์ม (ProjectId, PackageIds, ContractValue, ...)
 * @returns {object}
 */
function processAddOrEditVendorProject(formData) {
    if (Array.isArray(formData.PackageIds)) {
        formData.PackageIds = formData.PackageIds.join(',');
    }
    
    formData.Id = formData.projectId_ref; // ใช้ ID จากฟอร์ม hidden (VPR-...)
    delete formData.projectId_ref;

    const action = formData.Id ? 'edit' : 'add';
    return processGenericCrudAction('vendorProject', action, formData);
}

/**
 * [REFACTORED] ประมวลผลการลบโครงการ
 * @param {string} projectId - ที่จริงแล้วคือ ID ของแถว VendorProject (VPR-...)
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