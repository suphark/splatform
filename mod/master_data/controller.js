/**
 * @file mod/master_data/controller.js
*/


/**
 * [SERVER-CALL] ดึงข้อมูลประเภทโครงการทั้งหมด
 */
function getAllProjectTypes() {
  try {
    return APP_CONFIG.sheetsData.projectTypes.getTable().getRows();
  } catch (e) { return []; }
}

/**
 * [SERVER-CALL] ดึงข้อมูลเจ้าของโครงการทั้งหมด
 */
function getAllProjectOwners() {
  try {
    return APP_CONFIG.sheetsData.projectOwners.getTable().getRows();
  } catch (e) { return []; }
}

/**
 * [SERVER-CALL] ดึงข้อมูลประเภทบริษัททั้งหมด
 * ฟังก์ชันนี้จะถูกเรียกจากฝั่ง Client-side (JavaScript ในไฟล์ HTML)
 * เพื่อนำข้อมูลประเภทบริษัทไปสร้างเป็นตัวเลือกใน Dropdown
 * @returns {Array<Object>} อาร์เรย์ของอ็อบเจกต์ที่แต่ละอ็อบเจกต์คือข้อมูลบริษัทหนึ่งแถว (เช่น { Id: 'CT-0001', Name: 'นิติบุคคล', ... })
 */
function getAllCompanyTypes() {
  try {
    // 1. เข้าถึงชีต CompanyTypes ผ่าน APP_CONFIG ที่เราตั้งค่าไว้
    // 2. getTable() จะสร้างอ็อบเจกต์สำหรับจัดการข้อมูลในชีตนั้น
    // 3. getRows() จะดึงข้อมูลทั้งหมดในชีตออกมาเป็น Array of Objects
    return APP_CONFIG.sheetsData.companyTypes.getTable().getRows();
  } catch (e) {
    // บันทึก Log ไว้เมื่อเกิดข้อผิดพลาด เพื่อให้ตรวจสอบย้อนหลังได้
    Logger.log(`Error in getAllCompanyTypes: ${e.message}`);
    // คืนค่าเป็น Array ว่างเสมอ เพื่อป้องกันไม่ให้หน้าเว็บพังหากการดึงข้อมูลล้มเหลว
    return [];
  }
}

/**
 * [NEW] เพิ่มฟังก์ชันนี้
 * [SERVER-CALL] ดึงข้อมูลเจ้าของโครงการทั้งหมดสำหรับ Dropdown ในรูปแบบ NameThai | NameEnglish
 * @returns {Array<Object>}
 */
function getAllProjectOwnersForSelection() {
    try {
        const owners = APP_CONFIG.sheetsData.projectOwners.getTable().getRows();
        return owners.map(owner => {
            const displayName = owner.NameEnglish && owner.NameEnglish.trim() !== ''
                              ? `${owner.NameThai} | ${owner.NameEnglish}`
                              : owner.NameThai;
            return {
                Id: owner.Id,
                DisplayName: displayName
            };
        });
    } catch (e) {
        Logger.log('Error in getAllProjectOwnersForSelection: ' + e.message);
        return [];
    }
}