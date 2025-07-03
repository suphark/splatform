// mod_vendor_contact_controller.gs


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
 * [SERVER-CALL] ประมวลผลการเพิ่มผู้ติดต่อใหม่
 * @param {object} formData - ข้อมูลผู้ติดต่อจากฟอร์ม
 * @returns {object} ผลลัพธ์ { success: boolean, message: string, newContact: object }
 */
function processAddNewContact(formData) {
    try {
        if (!formData.VendorId || !formData.Name) {
            throw new Error("ข้อมูลไม่ครบถ้วน (ต้องการ VendorId และ Name)");
        }
        addNewContact(formData);
        
        // หลังจากเพิ่มแล้ว ดึงข้อมูลทั้งหมดของ Vendor นั้นกลับไปเพื่ออัปเดตตาราง
        const updatedContacts = getContactsByVendorId(formData.VendorId);

        return { success: true, message: 'เพิ่มผู้ติดต่อสำเร็จ!', contacts: updatedContacts };
    } catch (e) {
        Logger.log("Error in processAddNewContact: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [NEW SERVER-CALL] ดึงข้อมูลผู้ติดต่อรายเดียวตาม ID
 * @param {string} contactId - ID ของผู้ติดต่อ
 * @returns {object | null}
 */
function getContactById(contactId) {
    try {
        return APP_CONFIG.sheetsData.vendorContacts.getTable().where(row => row.Id === contactId).getRows()[0] || null;
    } catch (e) {
        return null;
    }
}

/**
 * [UPDATED] เปลี่ยนชื่อและปรับปรุงให้รองรับทั้งการเพิ่มและแก้ไข
 */
function processAddOrEditContact(formData) {
    try {
        if (!formData.VendorId || !formData.Name) {
            throw new Error("ข้อมูลไม่ครบถ้วน (ต้องการ VendorId และ Name)");
        }
        
        // --- [CRITICAL FIX] บังคับให้เบอร์โทรศัพท์เป็นข้อความ ---
        // การเติม ' ข้างหน้าจะทำให้ Google Sheets เก็บข้อมูลเป็น Text และไม่ตัดเลข 0 ออก
        if (formData.PhoneNumber) {
            formData.PhoneNumber = "'" + String(formData.PhoneNumber);
        }
        // --- จบส่วนแก้ไข ---

        const isEditMode = !!formData.Id;

        if (isEditMode) {
            updateContactById(formData.Id, formData);
        } else {
            addNewContact(formData);
        }
        
        const updatedContacts = getContactsByVendorId(formData.VendorId);
        const message = isEditMode ? 'แก้ไขผู้ติดต่อสำเร็จ!' : 'เพิ่มผู้ติดต่อสำเร็จ!';
        return { success: true, message: message, contacts: updatedContacts };

    } catch (e) {
        Logger.log("Error in processAddOrEditContact: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [NEW SERVER-CALL] ประมวลผลการลบผู้ติดต่อ
 * @param {string} contactId - ID ผู้ติดต่อที่จะลบ
 * @param {string} vendorId - ID ของ Vendor เจ้าของ
 * @returns {object}
 */
function processDeleteContact(contactId, vendorId) {
    try {
        deleteContactById(contactId);
        const updatedContacts = getContactsByVendorId(vendorId);
        return { success: true, message: 'ลบผู้ติดต่อสำเร็จ!', contacts: updatedContacts };
    } catch (e) {
        Logger.log("Error in processDeleteContact: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}






