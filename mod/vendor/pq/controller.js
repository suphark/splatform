/**
 * @file mod/vendor/pq/controller.js
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
 * [UPDATED] บันทึกผลการประเมินทั้งหมดลงในชีต PQForms
 * @param {object} fullPqData - อ็อบเจกต์ข้อมูล PQ ทั้งหมดจาก client
 * @returns {object} ผลลัพธ์การบันทึก
 */
function savePreQualificationResult(fullPqData) {
    try {
        const session = checkUserSession();
        // ดึงข้อมูลสรุปจากอ็อบเจกต์หลัก
        const results = fullPqData.results;
        const vendorData = fullPqData.vendorData;

        const payload = {
            VendorId: vendorData.Id,
            EvaluationDate: new Date(fullPqData.calculated.evaluationDate),
            EvaluatorEmail: session.email,
            TotalScore: results.totalWeightedScore,
            Grade: results.grade,
            ReliabilityScore: results.reliabilityWeightedScore,
            FinancialScore: results.financialWeightedScore,
            // [NEW] เก็บข้อมูลทั้งหมดในรูปแบบ JSON String
            FormDataJson: JSON.stringify(fullPqData) 
        };

        const table = APP_CONFIG.sheetsData.pQForms.getTable();
        
        table.withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'PQF-' })
             .insertRows([payload]);
        
        const newRecord = table.clearDataCache().sortBy('Id', 'desc').first();
        const newId = newRecord ? newRecord.Id : null;
        
        writeAuditLog('PQ Form: Save', `VendorId: ${payload.VendorId}`, `Grade: ${payload.Grade}`);
        
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

/**
 * [NEW & SERVER-CALL] ดึงข้อมูลประวัติการประเมิน PQ ของ Vendor
 * @param {string} vendorId - ID ของ Vendor
 * @returns {object} - ผลลัพธ์พร้อมข้อมูลประวัติ
 */
function getPqHistoryForVendor(vendorId) {
    try {
        if (!vendorId) throw new Error("ไม่พบ Vendor ID");
        const history = APP_CONFIG.sheetsData.pQForms.getTable()
            .where(row => row.VendorId === vendorId)
            .sortBy('EvaluationDate', 'desc')
            .select(['Id', 'EvaluationDate', 'EvaluatorEmail', 'Grade', 'TotalScore'])
            .getRows();
        
        return { success: true, data: history };
    } catch(e) {
        Logger.log(`Error in getPqHistoryForVendor: ${e.message}`);
        return { success: false, message: e.message, data: [] };
    }
}

/**
 * [NEW & SERVER-CALL] ดึงข้อมูล PQ ที่เคยบันทึกไว้จาก ID
 * @param {string} pqFormId - ID ของฟอร์ม PQ ที่บันทึกไว้
 * @returns {object} - ข้อมูลที่ถูก parse จาก JSON
 */
function getSavedPqFormById(pqFormId) {
    try {
        if (!pqFormId) throw new Error("ไม่พบ PQ Form ID");

        const record = APP_CONFIG.sheetsData.pQForms.getTable()
            .where(row => row.Id === pqFormId)
            .first();

        if (!record || !record.FormDataJson) {
            return { success: false, message: "ไม่พบข้อมูลการประเมินที่บันทึกไว้" };
        }

        const parsedData = JSON.parse(record.FormDataJson);
        return { success: true, data: parsedData };

    } catch (e) {
        Logger.log(`Error in getSavedPqFormById: ${e.message}`);
        return { success: false, message: e.message };
    }
}