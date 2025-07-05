/**
 * file: mod_pq_controller.gs
 * Controller สำหรับจัดการ Pre-qualification Form
 */

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
 * @param {object} pqResultData Object ข้อมูลผลลัพธ์ที่ได้จากการประเมิน
 * @returns {object} ผลการบันทึก
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
            FinancialScore: pqResultData.financialScore,
            // สามารถเพิ่ม Field อื่นๆ ที่ต้องการเก็บได้ตามต้องการ
        };

        APP_CONFIG.sheetsData.pQForms.getTable()
            .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'PQF-' })
            .insertRows([payload]);
        
        writeAuditLog('PQ Form: Save', `VendorId: ${payload.VendorId}`, `Grade: ${payload.Grade}`);
        return { success: true, message: "บันทึกผลการประเมินสำเร็จ!" };

    } catch (e) {
        Logger.log("Error saving PQ result: " + e.message);
        return { success: false, message: "เกิดข้อผิดพลาดในการบันทึกผล: " + e.message };
    }
}