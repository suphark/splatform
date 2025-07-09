/**
 * @file mod/project/controller.js
 */
function getPaginatedProjects_callable(options) {
    try { return getPaginatedProjects(options); } catch (e) { return { success: false, message: e.message }; }
}

function getProjectMasterData_callable() {
    try {
        return {
            success: true,
            projectTypes: getAllProjectTypes(),
            projectOwners: getAllProjectOwners(),
            provinces: getProvinces(),
            statuses: APP_CONFIG.projectStatuses
        };
    } catch(e) {
        return { success: false, message: e.message };
    }
}

function processAddOrEditProject(formData) {
    try {
        const isEditMode = !!formData.Id;
        if (!formData.NameThai) return { success: false, message: 'กรุณากรอกชื่อโครงการ' };
        if (formData.MapUrl && !formData.MapUrl.includes('google.com/maps')) {
            return { success: false, message: 'ลิงก์แผนที่ไม่ถูกต้อง (ต้องเป็นลิงก์จาก Google Maps)' };
        }
        // Convert array of types to comma-separated string
        if (Array.isArray(formData.ProjectTypeId)) {
            formData.ProjectTypeId = formData.ProjectTypeId.join(',');
        }

        if (isEditMode) {
            updateProjectById(formData.Id, formData);
            writeAuditLog('Project: Edit', `ID: ${formData.Id}`);
            return { success: true, message: 'แก้ไขข้อมูลโครงการสำเร็จ!' };
        } else {
            addNewProject(formData);
            writeAuditLog('Project: Create', `Name: ${formData.NameThai}`);
            return { success: true, message: 'เพิ่มโครงการใหม่สำเร็จ!' };
        }
    } catch (e) {
        Logger.log(`Error in processAddOrEditProject: ${e.message}`);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

function processDeleteProject(projectId) {
    try {
        deleteProjectById(projectId);
        writeAuditLog('Project: Delete', `ID: ${projectId}`);
        return { success: true, message: 'ลบโครงการสำเร็จ' };
    } catch(e) {
        Logger.log(`Error deleting project: ${e.message}`);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}