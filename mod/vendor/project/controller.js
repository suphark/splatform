/**
 * @file mod/vendor/project/controller.js
*/


function getAllProjectsForSelection() {
    try {
        const projects = APP_CONFIG.sheetsData.projects.getTable().getRows();
        const projectTypes = getAllProjectTypes();
        const projectOwners = getAllProjectOwners();
        
        const typeMap = new Map(projectTypes.map(t => [t.Id, t.Name]));
        const ownerMap = new Map(projectOwners.map(o => [o.Id, o.NameThai]));

        const formattedProjects = projects.map(p => {
            const typeNames = (p.ProjectTypeId ? String(p.ProjectTypeId).split(',') : []).map(id => typeMap.get(id.trim()) || id).join(', ');
            let displayName = `${p.NameThai}${p.NameEnglish ? ' | ' + p.NameEnglish : ''}`;
            const ownerName = ownerMap.get(p.ProjectOwnerId);
            if (ownerName) {
                displayName += ` [ ${ownerName} ]`;
            }
            
            return {
                Id: p.Id,
                DisplayName: displayName,
                ProjectTypeName: typeNames,
                ProjectOwnerName: ownerName || '-',
                ProjectYear: p.ProjectYear || '-'
            };
        });
        return formattedProjects;
    } catch (e) {
        Logger.log(`Error in getAllProjectsForSelection: ${e.message}`);
        return [];
    }
}

function getProjectsByVendorId(vendorId) {
    if (!vendorId) return [];
    try {
        const vendorProjectRefs = APP_CONFIG.sheetsData.vendorProjects.getTable().where(row => row.VendorId === vendorId).getRows();
        if (vendorProjectRefs.length === 0) return [];

        const refMap = new Map(vendorProjectRefs.map(ref => [ref.ProjectId, ref]));
        const referencedProjectIds = Array.from(refMap.keys());
        
        const allMasterProjects = APP_CONFIG.sheetsData.projects.getTable().getRows();
        const projectTypes = getAllProjectTypes();
        const projectOwners = getAllProjectOwners();
        const packages = getAllPackages();

        const typeMap = new Map(projectTypes.map(item => [item.Id, item.Name]));
        const ownerMap = new Map(projectOwners.map(item => [item.Id, item.NameThai]));
        const packageMap = new Map(packages.map(item => [item.Id, item.NameThai]));

        const enrichedProjects = allMasterProjects
            .filter(p => referencedProjectIds.includes(p.Id))
            .map(masterProject => {
                const refData = refMap.get(masterProject.Id);
                const projectTypeNames = (masterProject.ProjectTypeId ? String(masterProject.ProjectTypeId).split(',') : []).map(id => typeMap.get(id.trim()) || id).join(', ');
                const packageNames = (refData.PackageIds ? String(refData.PackageIds).split(',') : []).map(id => packageMap.get(id.trim()) || id).join(', ');
                
                return {
                    Id: refData.Id, 
                    VendorId: refData.VendorId,
                    ProjectId: refData.ProjectId,
                    PackageIds: refData.PackageIds,
                    ContractValue: refData.ContractValue,
                    ProjectDescription: refData.ProjectDescription,
                    PackageNamesDisplay: packageNames,
                    ProjectName: masterProject.NameThai,
                    ProjectYear: masterProject.ProjectYear,
                    ProjectOwnerId: masterProject.ProjectOwnerId, 
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
 * [NEW] ฟังก์ชันสำหรับตรวจสอบว่ามีการอ้างอิงโครงการนี้สำหรับ Vendor นี้แล้วหรือยัง
 * @param {string} vendorId - ID ของ Vendor
 * @param {string} projectId - ID ของโครงการหลัก
 * @param {string|null} excludeId - ID ของแถวอ้างอิง (VPR-...) ที่จะยกเว้น (สำหรับโหมดแก้ไข)
 * @returns {boolean} true ถ้ามีข้อมูลซ้ำ, false ถ้าไม่มี
 */
function isProjectReferenceExists(vendorId, projectId, excludeId = null) {
    const table = APP_CONFIG.sheetsData.vendorProjects.getTable();
    
    const count = table.where(row => {
        const isMatch = (row.VendorId === vendorId && row.ProjectId === projectId);
        if (!isMatch) return false;
        
        // ถ้าเป็นโหมดแก้ไข และเจอ ID ของตัวเอง ก็ไม่นับว่าซ้ำ
        if (excludeId && row.Id === excludeId) {
            return false;
        }
        return true;
    }).count();

    table.clearAll();
    return count > 0;
}

/**
 * [REVISED] แก้ไขฟังก์ชันนี้ให้มีการตรวจสอบข้อมูลซ้ำก่อนบันทึก
 * @param {object} formData ข้อมูลจากฟอร์ม (ProjectId, PackageIds, ContractValue, ...)
 * @returns {object}
 */
function processAddOrEditVendorProject(formData) {
    // --- Validation Step ---
    // formData.Id คือ ID ของแถวอ้างอิง (VPR-...) ซึ่งจะใช้เป็น excludeId
    if (isProjectReferenceExists(formData.VendorId, formData.ProjectId, formData.Id)) {
        return { success: false, message: 'โครงการอ้างอิงนี้ถูกเพิ่มให้ Vendor นี้ไปแล้ว' };
    }
    // --- End Validation ---

    if (Array.isArray(formData.PackageIds)) {
        formData.PackageIds = formData.PackageIds.join(',');
    }

    const action = formData.Id ? 'edit' : 'add';
    return processGenericCrudAction('vendorProject', action, formData);
}

function processDeleteProject(projectId, vendorId) {
    return processGenericCrudAction('vendorProject', 'delete', { id: projectId, parentId: vendorId });
}