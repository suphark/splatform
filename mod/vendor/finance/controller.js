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
    const year = Number(formData.Year);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year > currentYear || year < currentYear - 10) {
        return { success: false, message: 'ปีที่ระบุไม่ถูกต้องหรืออยู่นอกช่วงที่กำหนด' };
    }

    // ตอนนี้ isFinanceYearExists จะทำงานถูกต้องแล้ว
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
 * [REVISED] แก้ไขตรรกะการตรวจสอบข้อมูลซ้ำให้ถูกต้อง
 * @param {string} vendorId - ID ของ Vendor
 * @param {number} year - ปีที่ต้องการตรวจสอบ
 * @param {string|null} excludeId - ID ของรายการที่กำลังแก้ไข (เพื่อยกเว้นออกจากการตรวจสอบ)
 * @returns {boolean} true ถ้ามีข้อมูลปีนี้อยู่แล้ว, false ถ้ายังไม่มี
 */
function isFinanceYearExists(vendorId, year, excludeId = null) {
    const table = APP_CONFIG.sheetsData.vendorFinance.getTable();
    
    // ใช้ .where() ที่รับฟังก์ชันเข้าไปเพื่อสร้างเงื่อนไขที่ซับซ้อน
    const count = table.where(row => {
        // เงื่อนไขที่ 1: ต้องเป็นของ Vendor เดียวกัน และ ปีเดียวกัน
        const isMatch = (row.VendorId === vendorId && Number(row.Year) === Number(year));
        
        // ถ้าเงื่อนไขแรกไม่ตรง ก็ไม่ใช่ข้อมูลที่เราสนใจ (return false)
        if (!isMatch) {
            return false;
        }
        
        // ถ้าเงื่อนไขแรกตรง ให้ตรวจสอบต่อ
        // ถ้าเราอยู่ในโหมด "แก้ไข" (มี excludeId) และ ID ของแถวที่เจอ คือ ID เดียวกับที่เรากำลังแก้
        // แสดงว่ามันคือ "ตัวมันเอง" ไม่ใช่ "ข้อมูลซ้ำ" (return false เพื่อไม่ให้นับ)
        if (excludeId && row.Id === excludeId) {
            return false;
        }
        
        // ถ้าผ่านเงื่อนไขทั้งหมดมาได้ แสดงว่านี่คือ "ข้อมูลซ้ำ" จริงๆ (return true เพื่อให้นับ)
        return true;
    }).count();

    table.clearAll();
    return count > 0;
}