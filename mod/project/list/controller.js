/**
 * @file mod/project/list/controller.js
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
            statuses: getAllProjectStatuses() // [FIXED] ดึงข้อมูลสถานะจากฟังก์ชันใหม่
        };
    } catch(e) {
        return { success: false, message: e.message };
    }
}

// [REVISED] แก้ไขฟังก์ชันนี้ให้ return ข้อมูลของรายการที่สร้างใหม่กลับไปด้วย
function processAddOrEditProject(formData) {
    try {
        const isEditMode = !!formData.Id;
        if (!formData.NameThai) return { success: false, message: 'กรุณากรอกชื่อโครงการ' };
        if (formData.MapUrl && !formData.MapUrl.includes('maps.google.com')) {
            return { success: false, message: 'ลิงก์แผนที่ไม่ถูกต้อง (ต้องเป็นลิงก์จาก Google Maps)' };
        }
        if (Array.isArray(formData.ProjectTypeId)) {
            formData.ProjectTypeId = formData.ProjectTypeId.join(',');
        }

        if (isEditMode) {
            updateProjectById(formData.Id, formData);
            writeAuditLog('Project: Edit', `ID: ${formData.Id}`);
            const updatedProject = findProjectById(formData.Id); // ดึงข้อมูลที่อัปเดตแล้ว
            return { success: true, message: 'แก้ไขข้อมูลโครงการสำเร็จ!', data: updatedProject };
        } else {
            addNewProject(formData);
            writeAuditLog('Project: Create', `Name: ${formData.NameThai}`);
            // --- ส่วนที่เพิ่มเข้ามา ---
            // 1. หลังจากเพิ่มข้อมูลแล้ว ให้ไปดึงข้อมูลแถวล่าสุดที่เพิ่งสร้าง
            const newProject = getProjectsTable().sortBy('Id', 'desc').first();
            // 2. ส่งข้อมูลของโครงการใหม่กลับไปด้วยใน property 'data'
            return { success: true, message: 'เพิ่มโครงการใหม่สำเร็จ!', data: newProject };
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