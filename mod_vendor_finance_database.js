/**
 * ดึงข้อมูลงบการเงินทั้งหมดของ Vendor รายเดียว
 * @param {string} vendorId - ID ของ Vendor
 * @returns {Array<RowObject>}
 */
function getFinanceByVendorIdFromDB(vendorId) {
  if (!vendorId) return [];
  const table = APP_CONFIG.sheetsData.vendorFinance.getTable();
  const financeData = table.where(row => row.VendorId === vendorId).getRows();
  table.clearAll();
  return financeData.sort((a, b) => b.Year - a.Year);
}

/**
 * [NEW] เพิ่มข้อมูลงบการเงินใหม่
 * @param {object} financeData
 */
function addNewFinanceRecord(financeData) {
    APP_CONFIG.sheetsData.vendorFinance.getTable()
        .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'VFN-' })
        .insertRows([financeData]);
}

/**
 * [NEW] อัปเดตข้อมูลงบการเงินตาม ID
 * @param {string} financeId
 * @param {object} data
 */
function updateFinanceRecordById(financeId, data) {
    APP_CONFIG.sheetsData.vendorFinance.getTable()
        .where(row => row.Id === financeId)
        .updateRows(row => {
            for (const key in data) {
                if (Object.hasOwnProperty.call(data, key)) {
                    row[key] = data[key];
                }
            }
            return row;
        });
}

/**
 * [NEW] ลบข้อมูลงบการเงินตาม ID
 * @param {string} financeId
 */
function deleteFinanceRecordById(financeId) {
    APP_CONFIG.sheetsData.vendorFinance.getTable()
        .where(row => row.Id === financeId)
        .deleteRows();
}

/**
 * [NEW] ตรวจสอบว่ามีข้อมูลงบการเงินของปีที่ระบุสำหรับ Vendor นี้แล้วหรือยัง
 * @param {string} vendorId - ID ของ Vendor
 * @param {number} year - ปีที่ต้องการตรวจสอบ
 * @param {string|null} excludeId - ID ของรายการงบการเงินที่จะยกเว้น (สำหรับโหมดแก้ไข)
 * @returns {boolean} true ถ้ามีข้อมูลปีนี้อยู่แล้ว, false ถ้ายังไม่มี
 */
function isFinanceYearExists(vendorId, year, excludeId = null) {
    const table = APP_CONFIG.sheetsData.vendorFinance.getTable();
    
    let query = table.where(row => row.VendorId === vendorId && Number(row.Year) === Number(year));
    
    // ถ้าเป็นการแก้ไข ให้ยกเว้นรายการของตัวเองออกจากการตรวจสอบ
    if (excludeId) {
        query = query.where(row => row.Id !== excludeId);
    }

    const count = query.count();
    table.clearAll();
    
    return count > 0;
}