// mod_vendor_board_database.gs

/**
 * ดึงข้อมูลกรรมการทั้งหมดของ Vendor รายเดียว
 * @param {string} vendorId - ID ของ Vendor
 * @returns {Array<RowObject>}
 */
function getBoardMembersByVendorIdFromDB(vendorId) {
  if (!vendorId) return [];
  const table = APP_CONFIG.sheetsData.vendorBoardMembers.getTable();
  const members = table.where(row => row.VendorId === vendorId).getRows();
  table.clearAll();
  return members;
}

/**
 * [NEW] เพิ่มข้อมูลกรรมการใหม่
 * @param {object} memberData
 */
function addNewBoardMember(memberData) {
    APP_CONFIG.sheetsData.vendorBoardMembers.getTable()
        .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'VBM-' })
        .insertRows([memberData]);
}

/**
 * [NEW] อัปเดตข้อมูลกรรมการตาม ID
 * @param {string} memberId
 * @param {object} data
 */
function updateBoardMemberById(memberId, data) {
    APP_CONFIG.sheetsData.vendorBoardMembers.getTable()
        .where(row => row.Id === memberId)
        .updateRows(row => {
            row.Name = data.Name;
            row.Surname = data.Surname;
            return row;
        });
}

/**
 * [NEW] ลบข้อมูลกรรมการตาม ID
 * @param {string} memberId
 */
function deleteBoardMemberById(memberId) {
    APP_CONFIG.sheetsData.vendorBoardMembers.getTable()
        .where(row => row.Id === memberId)
        .deleteRows();
}