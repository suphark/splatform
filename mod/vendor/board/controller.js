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
    return processGenericCrudAction('vendorBoardMember', action, formData);
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