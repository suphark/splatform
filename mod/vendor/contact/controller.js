/**
 * [SERVER-CALL] ดึงข้อมูลผู้ติดต่อทั้งหมดของ Vendor รายเดียว
 * @param {string} vendorId - ID ของ Vendor
 * @returns {Array<RowObject>} รายชื่อผู้ติดต่อ
 */
function getContactsByVendorId(vendorId) {
  if (!vendorId) return [];
  try {
    const table = APP_CONFIG.sheetsData.vendorContacts.getTable();
    const contacts = table.where(row => row.VendorId === vendorId).getRows();
    table.clearAll();
    return contacts;
  } catch (e) {
    Logger.log(`Error in getContactsByVendorId: ${e.message}`);
    return [];
  }
}

/**
 * [REFACTORED] ประมวลผลการเพิ่มหรือแก้ไขผู้ติดต่อผ่าน Generic Service
 * @param {object} formData - ข้อมูลจากฟอร์ม
 * @returns {object} ผลลัพธ์
 */
function processAddOrEditContact(formData) {
    const action = formData.Id ? 'edit' : 'add';
    return processGenericCrudAction('vendorContact', action, formData);
}

/**
 * [REFACTORED] ประมวลผลการลบผู้ติดต่อผ่าน Generic Service
 * @param {string} contactId - ID ผู้ติดต่อ
 * @param {string} vendorId - ID ของ Vendor (Parent)
 * @returns {object} ผลลัพธ์
 */
function processDeleteContact(contactId, vendorId) {
    return processGenericCrudAction('vendorContact', 'delete', { id: contactId, parentId: vendorId });
}


