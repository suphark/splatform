// =================================================================
//            file: UtilsLib.gs
// =================================================================

// ==================== CRYPTO FUNCTIONS ====================

/**
 * สร้าง Salt แบบสุ่มสำหรับใช้ในการ Hash รหัสผ่าน
 */
function generateSalt(length = 16) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
  return result;
}

/**
 * ทำการ Hash รหัสผ่านด้วยอัลกอริทึม SHA-256
 */
function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt);
  let hexString = '';
  for (let i = 0; i < digest.length; i++) {
    let byte = digest[i];
    if (byte < 0) byte += 256;
    const hex = byte.toString(16);
    hexString += (hex.length === 1 ? '0' : '') + hex;
  }
  return hexString;
}

/**
 * ตรวจสอบรหัสผ่านที่ผู้ใช้กรอกกับ Hash ที่เก็บไว้
 */
function verifyPassword(inputPassword, storedHash, storedSalt) {
  return hashPassword(inputPassword, storedSalt) === storedHash;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * สร้างเลข OTP แบบสุ่ม
 */
function generateOtp(length = 6) {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * [FINAL UPGRADE] ฟังก์ชันกลางสำหรับจัดการข้อมูลแบบแบ่งหน้าจาก Array โดยตรง
 * - อัปเกรด: ปรับปรุง Filter Engine ให้รองรับการกรองแบบผสม (AND/OR) ที่ซับซ้อนได้อย่างถูกต้อง
 * - คงเดิม: การเรียงลำดับข้อมูล (sort) แบบข้อความเป็น case-insensitive
 *
 * @param {object} config - Object สำหรับการตั้งค่า
 * @param {Array<object>} config.dataSource - Array ของข้อมูลดิบที่ต้องการนำมาแบ่งหน้า
 * @param {object} [config.pagination] - การตั้งค่าการแบ่งหน้า { page: number, limit: number }
 * @param {object} [config.sort] - การตั้งค่าการเรียงลำดับ { column: string, direction: 'asc'|'desc' }
 * @param {Array<object>} [config.filters] - Array ของเงื่อนไขการกรอง
 * @returns {object} ผลลัพธ์พร้อมข้อมูลการแบ่งหน้า { data: Array, totalRecords: number, ... }
 */
function getPaginatedData(config) {
    const { dataSource, pagination = {}, sort = {}, filters = [] } = config;
    if (!dataSource) { throw new Error("getPaginatedData: 'dataSource' is required."); }

    let processedData = [...dataSource];

    // --- [ส่วนที่แก้ไข] อัปเกรด Filter Engine ---
    if (filters.length > 0) {
        processedData = processedData.filter(row => {
            // แยกเงื่อนไข 'AND' (ที่ไม่มี logic: 'or')
            const andFilters = filters.filter(f => f.logic !== 'or');
            // แยกเงื่อนไข 'OR' (ที่มี logic: 'or')
            const orFilters = filters.filter(f => f.logic === 'or');

            // 1. ตรวจสอบเงื่อนไข AND ทั้งหมดก่อน
            // ถ้าเงื่อนไข AND ข้อใดข้อหนึ่งเป็นเท็จ ให้ข้ามแถวนี้ไปเลย (return false)
            const andResult = andFilters.every(filter => evaluateFilter(row, filter));
            if (!andResult) {
                return false;
            }

            // 2. ตรวจสอบเงื่อนไข OR (ถ้ามี)
            // ถ้ามีเงื่อนไข OR จะต้องมีอย่างน้อยหนึ่งข้อที่เป็นจริง
            // ถ้าไม่มีเงื่อนไข OR เลย ให้ถือว่าเป็นจริง (true)
            const orResult = orFilters.length > 0 ? orFilters.some(filter => evaluateFilter(row, filter)) : true;
            
            // ผลลัพธ์สุดท้ายคือ AND ต้องเป็นจริงทั้งหมด และ OR ต้องมีจริงอย่างน้อยหนึ่งข้อ (ถ้ามี OR)
            return orResult;
        });
    }
    // --- สิ้นสุดส่วนที่แก้ไข ---

    // ส่วนของการ Sort ยังคงเดิม
    if (sort.column) {
        processedData.sort((a, b) => {
            let valA = a[sort.column];
            let valB = b[sort.column];
            const direction = sort.direction === 'desc' ? -1 : 1;

            if (valA == null) valA = '';
            if (valB == null) valB = '';
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return -1 * direction;
            if (valA > valB) return 1 * direction;
            return 0;
        });
    }

    // ส่วนของการแบ่งหน้ายังคงเหมือนเดิม
    const totalRecords = processedData.length;
    const limit = parseInt(pagination.limit) || 10;
    const page = parseInt(pagination.page) || 1;
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const offset = (page - 1) * limit;

    return { data: processedData.slice(offset, offset + limit), totalRecords, totalPages, currentPage: page, success: true };
}

/**
 * Helper for getPaginatedData to evaluate a single filter condition
 */
function evaluateFilter(row, filter) {
    const rowValue = row[filter.field];
    const filterValue = filter.value;
    if (rowValue === undefined || rowValue === null) return false;
    switch (filter.operator) {
        case 'equals': return String(rowValue).toLowerCase() === String(filterValue).toLowerCase();
        case 'contains': return String(rowValue).toLowerCase().includes(String(filterValue).toLowerCase());
        default: return true;
    }
}




