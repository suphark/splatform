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
 * [UPGRADED] ฟังก์ชันกลางสำหรับจัดการข้อมูลแบบแบ่งหน้าจาก Array โดยตรง
 * ทำให้สามารถใช้กับข้อมูลที่ซับซ้อน (เช่น ผ่านการ Join) ได้
 *
 * @param {object} config - Object สำหรับการตั้งค่า
 * @param {Array<object>} config.dataSource - Array ของข้อมูลดิบที่ต้องการนำมาแบ่งหน้า
 * @param {object} [config.pagination] - การตั้งค่าการแบ่งหน้า { page: number, limit: number }
 * @param {object} [config.sort] - การตั้งค่าการเรียงลำดับ { column: string, direction: 'asc'|'desc' }
 * @param {Array<object>} [config.filters] - Array ของเงื่อนไขการกรอง
 *
 * @returns {object} ผลลัพธ์พร้อมข้อมูลการแบ่งหน้า { data: Array, totalRecords: number, ... }
 */
function getPaginatedData(config) {
    const { dataSource, pagination = {}, sort = {}, filters = [] } = config;
    if (!dataSource) { throw new Error("getPaginatedData: 'dataSource' is required."); }

    let processedData = [...dataSource];

    if (filters.length > 0) {
        processedData = processedData.filter(row => {
            // Group filters by their logic ('and' is default, 'or' is for specific cases)
            const orFilters = filters.filter(f => f.logic === 'or');
            const andFilters = filters.filter(f => f.logic !== 'or');

            const andResult = andFilters.every(filter => evaluateFilter(row, filter));
            // If there are 'or' filters, at least one must be true, along with all 'and' filters
            const orResult = orFilters.length > 0 ? orFilters.some(filter => evaluateFilter(row, filter)) : true;

            return andResult && orResult;
        });
    }

    if (sort.column) {
        processedData.sort((a, b) => {
            const valA = a[sort.column] || '';
            const valB = b[sort.column] || '';
            const direction = sort.direction === 'desc' ? -1 : 1;

            if (valA < valB) return -1 * direction;
            if (valA > valB) return 1 * direction;
            return 0;
        });
    }

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




