/**
 * file: mod/vendor/board/controller.js
 */

// ฟังก์ชันนี้ยังคงเดิม
function getBoardMembersByVendorId(vendorId) {
    try {
        if (!vendorId) return [];
        const table = APP_CONFIG.sheetsData.vendorBoardMembers.getTable();
        const members = table.where(row => row.VendorId === vendorId).getRows();
        table.clearAll();
        return members;
    } catch (e) {
        Logger.log(`Error in getBoardMembersByVendorId: ${e.message}`);
        return [];
    }
}

/**
 * [REFACTORED] ประมวลผลการเพิ่มหรือแก้ไขกรรมการผ่าน Generic Service
 * @param {object} formData
 * @returns {object}
 */
function processAddOrEditBoardMember(formData) {
    const action = formData.Id ? 'edit' : 'add';
    const crudResult = processGenericCrudAction('vendorBoardMember', action, formData);

    // [NEW] ตรวจสอบความสัมพันธ์หลังจากบันทึกข้อมูลสำเร็จ
    if (crudResult.success) {
        const relationshipWarning = checkBoardMemberRelationship(formData.Surname);
        // เพิ่มข้อมูลการแจ้งเตือนกลับไปยัง Client
        crudResult.relationshipWarning = relationshipWarning;
    }
    
    return crudResult;
}

/**
 * [REFACTORED] ประมวลผลการลบกรรมการผ่าน Generic Service
 * @param {string} memberId
 * @param {string} vendorId
 * @returns {object}
 */
function processDeleteBoardMember(memberId, vendorId) {
    return processGenericCrudAction('vendorBoardMember', 'delete', { id: memberId, parentId: vendorId });
}

/**
 * [SERVER-CALL] [HELPER] ตรวจสอบความสัมพันธ์ของนามสกุลกรรมการกับพนักงาน
 * @param {string} surname - นามสกุลของกรรมการที่ต้องการตรวจสอบ
 * @returns {string|null} ข้อความแจ้งเตือน หรือ null หากไม่พบ
 */
function checkBoardMemberRelationship(surname) {
    if (!surname || surname.trim() === '') {
        return null;
    }
    const cleanSurname = surname.trim();
    const staffs = getAllStaffs(); // ดึงข้อมูลพนักงานทั้งหมด
    const matchingStaffs = staffs.filter(staff => staff.SurnameThai && staff.SurnameThai.trim() === cleanSurname);

    if (matchingStaffs.length > 0) {
        const staffNames = matchingStaffs.map(s => `${s.NameThai} ${s.SurnameThai}`).join(', ');
        return `ตรวจพบความสัมพันธ์ (นามสกุลตรงกัน) กับพนักงาน: ${staffNames}`;
    }
    return null;
}

