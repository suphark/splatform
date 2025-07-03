// mod_vendor_contact_database.gs

/**
 * [NEW] เพิ่มข้อมูลผู้ติดต่อใหม่ลงในชีต
 * @param {object} contactData - ข้อมูลผู้ติดต่อที่จะบันทึก
 */
function addNewContact(contactData) {
  APP_CONFIG.sheetsData.vendorContacts.getTable()
    .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'VCT-' })
    .insertRows([contactData]);
}

/**
 * [NEW] อัปเดตข้อมูลผู้ติดต่อตาม ID
 * @param {string} contactId - ID ของผู้ติดต่อ
 * @param {object} data - ข้อมูลใหม่
 */
function updateContactById(contactId, data) {
    APP_CONFIG.sheetsData.vendorContacts.getTable()
        .where(row => row.Id === contactId)
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
 * [NEW] ลบข้อมูลผู้ติดต่อตาม ID
 * @param {string} contactId - ID ของผู้ติดต่อ
 */
function deleteContactById(contactId) {
    APP_CONFIG.sheetsData.vendorContacts.getTable()
        .where(row => row.Id === contactId)
        .deleteRows();
}
