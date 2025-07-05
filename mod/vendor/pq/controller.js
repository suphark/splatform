
/**
 * [SERVER-CALL] ดึงข้อมูลทั้งหมดที่จำเป็นสำหรับสร้างฟอร์ม PQ
 * @param {string} vendorId ID ของ Vendor ที่จะประเมิน
 * @returns {object} ผลลัพธ์ข้อมูลและการคำนวณคะแนนทั้งหมด
 */
function getPreQualificationData(vendorId) {
    if (!vendorId) {
        return { success: false, message: "ไม่พบ Vendor ID" };
    }
    // เรียกใช้ Service หลักในการคำนวณ
    return generatePQData(vendorId);
}

/**
 * [SERVER-CALL] บันทึกผลการประเมินลงในชีต PQForms
 * [UPDATE] เพิ่มการคืนค่า ID ที่สร้างใหม่กลับไปให้ Client
 */
function savePreQualificationResult(pqResultData) {
    try {
        const session = checkUserSession();
        const payload = {
            VendorId: pqResultData.vendorId,
            EvaluationDate: new Date(pqResultData.evaluationDate),
            EvaluatorEmail: session.email,
            TotalScore: pqResultData.totalScore,
            Grade: pqResultData.grade,
            ReliabilityScore: pqResultData.reliabilityScore,
            FinancialScore: pqResultData.financialScore
        };

        const table = APP_CONFIG.sheetsData.pQForms.getTable();
        
        table.withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'PQF-' })
             .insertRows([payload]);
        
        // ดึง ID ของแถวที่เพิ่งสร้างล่าสุด
        const newRecord = table.clearDataCache().sortBy('Id', 'desc').first();
        const newId = newRecord ? newRecord.Id : null;
        
        writeAuditLog('PQ Form: Save', `VendorId: ${payload.VendorId}`, `Grade: ${payload.Grade}`);
        
        // ส่ง ID ใหม่กลับไปด้วย
        return { success: true, message: "บันทึกผลการประเมินสำเร็จ!", newId: newId };

    } catch (e) {
        Logger.log("Error saving PQ result: " + e.message);
        return { success: false, message: "เกิดข้อผิดพลาดในการบันทึกผล: " + e.message };
    }
}

/**
 * [SERVER-CALL] ดึงข้อมูลเกณฑ์การให้คะแนนทั้งหมด
 * @returns {object} Object ของ PQ_CRITERIA
 */
function getPQCriteriaForClient() {
  return PQ_CRITERIA;
}