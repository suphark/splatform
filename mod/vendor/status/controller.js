/**
 * [SERVER-CALL] ดึงข้อมูล Vendor Status ทั้งหมดเพื่อใช้สร้างตัวเลือก
 * @returns {Array<RowObject>}
 */
function getAllVendorStatuses() {
  try {
    const table = APP_CONFIG.sheetsData.vendorStatuses.getTable();
    const statuses = table.getRows();
    table.clearAll();
    return statuses;
  } catch (e) {
    Logger.log("Error in getAllVendorStatuses: " + e.message);
    return [];
  }
}