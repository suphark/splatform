/**
 * @file mod/project/owner/controller.js
 */


function getPaginatedProjectOwners_callable(options) {
    try {
        return getPaginatedProjectOwners(options);
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function processAddOrEditProjectOwner(formData) {
    try {
        const isEditMode = !!formData.Id;
        
        if (!formData.NameThai) {
            return { success: false, message: 'กรุณากรอกชื่อ (ไทย)' };
        }

        if (isEditMode) {
            updateProjectOwnerById(formData.Id, formData);
            writeAuditLog('Project Owner: Edit', `ID: ${formData.Id}, Name: ${formData.NameThai}`);
            // [REVISED] ค้นหาข้อมูลที่อัปเดตแล้วส่งกลับไป
            const updatedOwner = findProjectOwnerById(formData.Id);
            return { success: true, message: 'แก้ไขข้อมูลเจ้าของโครงการสำเร็จ!', data: updatedOwner };
        } else {
            addNewProjectOwner(formData);
            writeAuditLog('Project Owner: Create', `Name: ${formData.NameThai}`);
            // [REVISED] ค้นหาข้อมูลล่าสุดที่เพิ่งสร้าง แล้วส่งกลับไป
            const newOwner = getProjectOwnersTable().sortBy('Id', 'desc').first();
            return { success: true, message: 'เพิ่มข้อมูลเจ้าของโครงการสำเร็จ!', data: newOwner };
        }
    } catch (e) {
        Logger.log(`Error in processAddOrEditProjectOwner: ${e.message}`);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

function processDeleteProjectOwner(ownerId) {
    try {
        const ownerToDelete = findProjectOwnerById(ownerId);
        if (!ownerToDelete) {
             return { success: false, message: 'ไม่พบข้อมูลที่ต้องการลบ' };
        }
        
        deleteProjectOwnerById(ownerId);
        writeAuditLog('Project Owner: Delete', `ID: ${ownerId}, Name: ${ownerToDelete.NameThai}`);
        return { success: true, message: 'ลบข้อมูลสำเร็จ!' };
    } catch (e) {
        Logger.log(`Error in processDeleteProjectOwner: ${e.message}`);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}