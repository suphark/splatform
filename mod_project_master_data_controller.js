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