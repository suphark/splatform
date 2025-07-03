/**
 * file : mod_vendor_database.gs
 */


/**
 * [NEW] เพิ่ม Vendor ใหม่ลงในชีต และคืนค่า ID ที่สร้างขึ้น
 * @param {object} data - ข้อมูล Vendor ที่จะเพิ่ม (ต้องไม่มีไฟล์)
 * @returns {string} ID ของ Vendor ที่สร้างใหม่
 */
function addNewVendorAndGetId(data) {
    const table = APP_CONFIG.sheetsData.vendors.getTable();
    
    // แปลง Array ของ PackageId เป็น String ก่อนบันทึก
    if (Array.isArray(data.PackageId)) {
        data.PackageId = data.PackageId.join(',');
    }

    table.withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'VDR-' })
         .insertRows([data]);
    
    // ดึงแถวสุดท้ายที่เพิ่งเพิ่มเข้าไปเพื่อเอา ID (วิธีนี้เหมาะกับ Apps Script ที่ส่วนใหญ่ทำงานทีละคน)
    const allVendors = table.clearDataCache().getRows();
    const newVendor = allVendors[allVendors.length - 1];
    
    if (!newVendor) {
        throw new Error("ไม่สามารถดึงข้อมูล Vendor ใหม่หลังการสร้างได้");
    }
    
    return newVendor.Id;
}

/**
 * [NEW] อัปเดตข้อมูล Vendor ตาม Id
 * @param {string} vendorId - Id ของ Vendor ที่จะอัปเดต
 * @param {object} data - ข้อมูลใหม่ (อาจจะมี Field แค่บางส่วน)
 */
function updateVendorById(vendorId, data) {
    // แปลง Array ของ PackageId เป็น String ก่อนบันทึก (กรณีมีการแก้ไข)
    if (data.PackageId && Array.isArray(data.PackageId)) {
        data.PackageId = data.PackageId.join(',');
    }

    APP_CONFIG.sheetsData.vendors.getTable()
        .where(row => row.Id === vendorId)
        .updateRows(row => {
            // อัปเดตข้อมูลในแถวตาม key ที่ส่งมา
            for (const key in data) {
                if (Object.hasOwnProperty.call(data, key)) {
                    row[key] = data[key];
                }
            }
            return row;
        });
}

/**
 * [NEW] ลบข้อมูล Vendor ตาม ID
 * @param {string} vendorId - ID ของ Vendor ที่จะลบ
 */
function deleteVendorById(vendorId) {
    APP_CONFIG.sheetsData.vendors.getTable()
        .where(row => row.Id === vendorId)
        .deleteRows();
}

/**
 * [NEW] ดึงข้อมูล Vendor ทั้งหมดจากชีต
 * @returns {Array<RowObject>}
 */
function getAllVendors() {
    const table = APP_CONFIG.sheetsData.vendors.getTable();
    const vendors = table.getRows();
    table.clearAll(); // เคลียร์ cache หลังใช้งาน
    return vendors;
}

/**
 * [NEW] ค้นหา Vendor รายเดียวตาม ID
 * @param {string} vendorId - ID ของ Vendor ที่ต้องการ
 * @returns {object | null} ข้อมูล Vendor หรือ null ถ้าไม่พบ
 */
function findVendorById(vendorId) {
    const table = APP_CONFIG.sheetsData.vendors.getTable();
    // ใช้ getRows()[0] เพื่อดึงข้อมูลแค่แถวเดียว
    const vendor = table.where(row => row.Id === vendorId).getRows()[0];
    table.clearAll(); // เคลียร์ cache ทุกครั้ง
    return vendor || null;
}

/**
 * [NEW] ตรวจสอบว่าชื่อ Vendor (ไทยหรืออังกฤษ) มีอยู่แล้วในระบบหรือไม่
 * @param {string} nameThai - ชื่อภาษาไทยที่ต้องการตรวจสอบ
 * @param {string} nameEnglish - ชื่อภาษาอังกฤษที่ต้องการตรวจสอบ (อาจเป็นค่าว่าง)
 * @param {string|null} excludeId - ID ของ Vendor ที่จะยกเว้นจากการตรวจสอบ (สำหรับโหมดแก้ไข)
 * @returns {boolean} true ถ้าพบชื่อซ้ำ, false ถ้าไม่พบ
 */
function isVendorNameExists(nameThai, nameEnglish, excludeId = null) {
    const table = APP_CONFIG.sheetsData.vendors.getTable();
    
    // สร้างเงื่อนไขการค้นหา
    let query = table.where(row => {
        // เตรียมข้อมูลสำหรับการเปรียบเทียบ (ทำให้เป็นตัวพิมพ์เล็กและตัดช่องว่าง)
        const existingThai = row.NameThai.trim().toLowerCase();
        const existingEnglish = row.NameEnglish ? row.NameEnglish.trim().toLowerCase() : '';
        const newThai = nameThai.trim().toLowerCase();
        const newEnglish = nameEnglish ? nameEnglish.trim().toLowerCase() : '';

        // ตรวจสอบว่าชื่อไทยตรงกันหรือไม่
        const isThaiMatch = existingThai === newThai;
        // ตรวจสอบว่าชื่ออังกฤษตรงกันหรือไม่ (เฉพาะกรณีที่ทั้งสองฝั่งมีค่า)
        const isEnglishMatch = (existingEnglish && newEnglish) ? (existingEnglish === newEnglish) : false;

        // ถ้าเป็นโหมดแก้ไข (มี excludeId) ให้ยกเว้นแถวของตัวเองออกจากการตรวจสอบ
        if (excludeId) {
            return row.Id !== excludeId && (isThaiMatch || isEnglishMatch);
        }
        
        // ถ้าเป็นโหมดเพิ่มใหม่ ให้ตรวจสอบทั้งหมด
        return isThaiMatch || isEnglishMatch;
    });

    const count = query.count();
    table.clearAll(); // เคลียร์ cache หลังใช้งานเสมอ
    
    // ถ้าพบรายการที่ตรงเงื่อนไขมากกว่า 0 แสดงว่ามีชื่อซ้ำ
    return count > 0;
}




