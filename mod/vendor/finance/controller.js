/**
 * file: mod/vendor/finance/controller.js
 */

// ฟังก์ชันนี้ยังคงเดิม
function getFinanceByVendorId(vendorId) {
    try {
        if (!vendorId) return [];
        const table = APP_CONFIG.sheetsData.vendorFinance.getTable();
        // เพิ่มการเรียงลำดับ ปี มากไปน้อย ที่นี่เลย
        const financeData = table.where(row => row.VendorId === vendorId).sortBy('Year', 'desc').getRows();
        table.clearAll();
        return financeData;
    } catch (e) {
        Logger.log(`Error in getFinanceByVendorId: ${e.message}`);
        return [];
    }
}

/**
 * [REFACTORED] ประมวลผลการเพิ่มหรือแก้ไขข้อมูลงบการเงิน
 * @param {object} formData - ข้อมูลจากฟอร์ม
 * @param {object} fileData - ข้อมูลไฟล์ (ตอนนี้ยังไม่ได้ใช้ใน Generic Service แต่ใส่ไว้เผื่ออนาคต)
 * @returns {object}
 */
function processAddOrEditFinanceRecord(formData, fileData) {
    // --- Validation พิเศษสำหรับ Finance ---
    const year = Number(formData.Year);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year > currentYear || year < currentYear - 10) {
        return { success: false, message: 'ปีที่ระบุไม่ถูกต้องหรืออยู่นอกช่วงที่กำหนด' };
    }

    if (isFinanceYearExists(formData.VendorId, year, formData.Id)) {
        return { success: false, message: `มีข้อมูลงบการเงินของปี ${year} อยู่ในระบบแล้ว` };
    }

    const action = formData.Id ? 'edit' : 'add';
    return processGenericCrudAction('vendorFinance', action, formData);
}


/**
 * [REFACTORED] ประมวลผลการลบข้อมูลงบการเงิน
 * @param {string} financeId
 * @param {string} vendorId
 * @returns {object}
 */
function processDeleteFinanceRecord(financeId, vendorId) {
    return processGenericCrudAction('vendorFinance', 'delete', { id: financeId, parentId: vendorId });
}

// ฟังก์ชันดึงข้อมูลรายการเดียวยังคงมีประโยชน์
function getFinanceRecordById(financeId) {
    try {
        return APP_CONFIG.sheetsData.vendorFinance.getTable().where(row => row.Id === financeId).first();
    } catch(e) {
        Logger.log("Error in getFinanceRecordById: " + e.message);
        return null;
    }
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