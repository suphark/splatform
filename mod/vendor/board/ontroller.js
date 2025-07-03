/**
 * [SERVER-CALL] ดึงข้อมูลกรรมการทั้งหมดของ Vendor รายเดียว
 * @param {string} vendorId - ID ของ Vendor
 * @returns {Array<RowObject>}
 */
function getBoardMembersByVendorId(vendorId) {
  try {
    return getBoardMembersByVendorIdFromDB(vendorId);
  } catch (e) {
    Logger.log(`Error in getBoardMembersByVendorId: ${e.message}`);
    return [];
  }
}

/**
 * [NEW SERVER-CALL] ประมวลผลการเพิ่มหรือแก้ไขกรรมการ
 * @param {object} formData
 * @returns {object}
 */
function processAddOrEditBoardMember(formData) {
    try {
        if (!formData.VendorId || !formData.Name || !formData.Surname) {
            throw new Error("ข้อมูลไม่ครบถ้วน");
        }
        
        const isEditMode = !!formData.Id;
        if (isEditMode) {
            updateBoardMemberById(formData.Id, formData);
        } else {
            addNewBoardMember(formData);
        }
        
        const updatedMembers = getBoardMembersByVendorId(formData.VendorId);
        return { success: true, message: 'บันทึกข้อมูลกรรมการสำเร็จ!', members: updatedMembers };

    } catch (e) {
        Logger.log("Error in processAddOrEditBoardMember: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [NEW SERVER-CALL] ประมวลผลการลบกรรมการ
 * @param {string} memberId
 * @param {string} vendorId
 * @returns {object}
 */
function processDeleteBoardMember(memberId, vendorId) {
    try {
        deleteBoardMemberById(memberId);
        const updatedMembers = getBoardMembersByVendorId(vendorId);
        return { success: true, message: 'ลบข้อมูลกรรมการสำเร็จ!', members: updatedMembers };
    } catch (e) {
        Logger.log("Error in processDeleteBoardMember: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}