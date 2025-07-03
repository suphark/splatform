/**
 * [SERVER-CALL] ดึงข้อมูลงบการเงินทั้งหมดของ Vendor รายเดียว
 */
function getFinanceByVendorId(vendorId) {
  try {
    return getFinanceByVendorIdFromDB(vendorId);
  } catch (e) {
    Logger.log(`Error in getFinanceByVendorId: ${e.message}`);
    return [];
  }
}

/**
 * [NEW SERVER-CALL] ประมวลผลการเพิ่มหรือแก้ไขข้อมูลงบการเงิน
 */
function processAddOrEditFinanceRecord(formData, fileData) {
    try {
        // --- [NEW] Validation Step ---
        if (!formData.VendorId || !formData.Year) {
            throw new Error("ข้อมูลไม่ครบถ้วน (ต้องการ VendorId และ Year)");
        }

        const year = Number(formData.Year);
        // get currentYear then plus with 543 to convert to Thai year format
        const currentYear = new Date().getFullYear() + 543;

        // 1. ตรวจสอบว่าเป็นตัวเลขหรือไม่
        if (isNaN(year)) {
            return { success: false, message: 'ปีที่ระบุไม่ถูกต้อง' };
        }

        // 2. ตรวจสอบว่าปีไม่เกินปีปัจจุบัน
        if (year > currentYear) {
            return { success: false, message: `ไม่สามารถบันทึกข้อมูลปีในอนาคตได้ (ปีปัจจุบัน: ${currentYear})` };
        }

        // 3. ตรวจสอบว่าปีไม่เก่าเกิน 10 ปี
        if (year < currentYear - 10) {
            return { success: false, message: `ไม่สามารถบันทึกข้อมูลที่เก่าเกิน 10 ปีได้ (ต่ำสุด: ${currentYear - 10})` };
        }

        // 4. ตรวจสอบว่าปีซ้ำหรือไม่
        if (isFinanceYearExists(formData.VendorId, year, formData.Id)) {
            return { success: false, message: `มีข้อมูลงบการเงินของปี ${year} อยู่ในระบบแล้ว` };
        }
        // --- End Validation Step ---

        
        // 1. อัปโหลดไฟล์งบการเงิน (ถ้ามี)
        if (fileData && fileData.financialStatementFile) {
            const vendor = findVendorById(formData.VendorId);
            if (!vendor || !vendor.FolderId) {
                throw new Error("ไม่พบโฟลเดอร์สำหรับ Vendor นี้ กรุณาแนบไฟล์ในหน้าข้อมูลหลักก่อน");
            }
            // เรียกใช้ฟังก์ชันอัปโหลดไฟล์ที่มีอยู่ แต่ส่งไปแค่ไฟล์เดียว
            const result = uploadVendorFiles(vendor.FolderId, vendor.NameThai, { 
                FinancialStatementFile: fileData.financialStatementFile 
            });
            // นำ File ID ที่ได้กลับมาใส่ใน formData
            formData.FinancialStatementFileId = result.uploadedFileIds.FinancialStatementFile;
        }

        // 2. บันทึกข้อมูลลงชีต
        const isEditMode = !!formData.Id;
        if (isEditMode) {
            updateFinanceRecordById(formData.Id, formData);
        } else {
            addNewFinanceRecord(formData);
        }
        
        const updatedFinanceData = getFinanceByVendorIdFromDB(formData.VendorId);
        return { success: true, message: 'บันทึกข้อมูลงบการเงินสำเร็จ!', financeData: updatedFinanceData };

    } catch (e) {
        Logger.log("Error in processAddOrEditFinanceRecord: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}


/**
 * [NEW SERVER-CALL] ประมวลผลการลบข้อมูลงบการเงิน
 */
function processDeleteFinanceRecord(financeId, vendorId) {
    try {
        // ในอนาคตอาจเพิ่มการลบไฟล์ใน Drive ที่นี่
        deleteFinanceRecordById(financeId);
        const updatedFinanceData = getFinanceByVendorIdFromDB(vendorId);
        return { success: true, message: 'ลบข้อมูลงบการเงินสำเร็จ!', financeData: updatedFinanceData };
    } catch (e) {
        Logger.log("Error in processDeleteFinanceRecord: " + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [NEW SERVER-CALL] ดึงข้อมูลงบการเงินรายการเดียวตาม ID
 * @param {string} financeId - ID ของรายการงบการเงิน
 * @returns {object | null}
 */
function getFinanceRecordById(financeId) {
  try {
    const table = APP_CONFIG.sheetsData.vendorFinance.getTable();
    const record = table.where(row => row.Id === financeId).getRows()[0];
    table.clearAll();
    return record || null;
  } catch(e) {
    Logger.log("Error in getFinanceRecordById: " + e.message);
    return null;
  }
}







