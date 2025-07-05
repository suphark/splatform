/**
 * file: PQ_Service.gs
 * [FINAL] บริการสำหรับคำนวณและสร้างข้อมูล Pre-qualification Form
 * - อัปเดตการคำนวณ averageRevenue และการส่งข้อมูลให้ pastPerformance
 */

function generatePQData(vendorId) {
    try {
        // --- 1. ดึงข้อมูลที่จำเป็นทั้งหมด ---
        const vendor = findVendorById(vendorId);
        if (!vendor) throw new Error("ไม่พบข้อมูล Vendor");

        const allFinances = getFinanceByVendorId(vendorId); // ปีล่าสุดจะอยู่บนสุด
        const allProjects = getProjectsByVendorId(vendorId); // getProjectsByVendorId
        const allProjectOwners = getAllProjectOwners();
        const projectOwnerMap = new Map(allProjectOwners.map(o => [o.Id, o.Name]));

        const projectsWithNames = allProjects.map(p => ({
            ...p,
            ProjectOwnerName: projectOwnerMap.get(p.ProjectOwnerId) || ''
        }));

        // --- 2. คำนวณค่าพื้นฐาน ---
        const evaluationDate = new Date();
        const currentYear = evaluationDate.getFullYear();
        const registeredDate = vendor.RegisteredDate ? new Date(vendor.RegisteredDate) : null;
        const operatingYears = registeredDate ? (evaluationDate.getTime() - registeredDate.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;
        
        // --- [ส่วนที่แก้ไข] การคำนวณทางการเงิน ---
        // 2.1 กรองข้อมูลงบการเงินที่ใช้ได้ (ไม่เกิน 5 ปี)
        const recentFinances = allFinances.filter(f => f.Year >= currentYear - 5);
        
        // 2.2 หาข้อมูลงบการเงินปีล่าสุด
        const latestFinance = allFinances.length > 0 ? allFinances[0] : {};
        
        // 2.3 คำนวณรายได้เฉลี่ยจากข้อมูลงบการเงินย้อนหลัง 3 ปีล่าสุด (ที่ผ่านการกรองแล้ว)
        const relevantRevenueData = recentFinances.slice(0, 3);
        const avgRevenue = relevantRevenueData.reduce((sum, f) => sum + Number(f.Revenue || 0), 0) / (relevantRevenueData.length || 1);
        
        // 2.4 คำนวณค่าอื่นๆ จากงบปีล่าสุด
        const financialReadiness = Number(latestFinance.CurrentAssets || 0) - Number(latestFinance.CurrentLiabilities || 0);
    
        const currentRatio = Number(latestFinance.CurrentLiabilities || 0) > 0 ? Number(latestFinance.CurrentAssets || 0) / Number(latestFinance.CurrentLiabilities) : 0;
        // --- จบส่วนที่แก้ไข ---

        // --- 3. ประมวลผลคะแนนแต่ละหัวข้อ ---
        const scores = { reliability: {}, financial: {} };
        
        scores.reliability.companyProfile = PQ_CRITERIA.companyProfile.getScore(vendor);
        scores.reliability.companyType = PQ_CRITERIA.companyType.getScore(vendor);
        scores.reliability.operatingDuration = PQ_CRITERIA.operatingDuration.getScore(operatingYears);
        scores.reliability.pastPerformance = PQ_CRITERIA.pastPerformance.getScore(allProjects, allProjectOwners); // ส่งข้อมูลที่จำเป็นไปให้ครบ

        scores.financial.registeredCapital = PQ_CRITERIA.registeredCapital.getScore(Number(vendor.RegisteredCapital || 0));
        scores.financial.averageRevenue = PQ_CRITERIA.averageRevenue.getScore(avgRevenue);
        scores.financial.financialReadiness = PQ_CRITERIA.financialReadiness.getScore(financialReadiness);
        scores.financial.currentRatio = PQ_CRITERIA.currentRatio.getScore(currentRatio);
        
        // --- 4. คำนวณคะแนนรวมและเกรด (เหมือนเดิม) ---
        const reliabilityWeightedScore = 
            (scores.reliability.companyProfile * PQ_CRITERIA.companyProfile.weight) +
            (scores.reliability.companyType * PQ_CRITERIA.companyType.weight) +
            (scores.reliability.operatingDuration * PQ_CRITERIA.operatingDuration.weight) +
            (scores.reliability.pastPerformance * PQ_CRITERIA.pastPerformance.weight);

        const financialWeightedScore = 
            (scores.financial.registeredCapital * PQ_CRITERIA.registeredCapital.weight) +
            (scores.financial.averageRevenue * PQ_CRITERIA.averageRevenue.weight) +
            (scores.financial.financialReadiness * PQ_CRITERIA.financialReadiness.weight) +
            (scores.financial.currentRatio * PQ_CRITERIA.currentRatio.weight);

        const totalWeightedScore = reliabilityWeightedScore + financialWeightedScore;
        const reliabilityPercentage = (reliabilityWeightedScore / 2.5) * 100;
        const financialPercentage = (financialWeightedScore / 2.5) * 100;
        const overallPercentage = (totalWeightedScore / 5) * 100;
        
        // --- 5. สร้าง Object ผลลัพธ์สำหรับส่งกลับ ---
        return {
            success: true,
            data: {
                vendorData: vendor,
                boardMembers: getBoardMembersByVendorId(vendorId), // ดึงข้อมูลกรรมการมาด้วย
                financeData: allFinances, // ส่งข้อมูลการเงินทั้งหมดไปแสดง
                projectData: projectsWithNames, // ส่งข้อมูลโครงการทั้งหมดไปแสดง
                calculated: {
                    evaluationDate: evaluationDate.toISOString(),
                    operatingYears: operatingYears.toFixed(2),
                    latestFinance: latestFinance,
                    avgRevenue: avgRevenue,
                    financialReadiness: financialReadiness,
                    currentRatio: currentRatio.toFixed(2)
                },
                scores: scores,
                results: {
                    reliabilityWeightedScore: reliabilityWeightedScore.toFixed(2),
                    financialWeightedScore: financialWeightedScore.toFixed(2),
                    totalWeightedScore: totalWeightedScore.toFixed(2),
                    reliabilityPercentage: reliabilityPercentage,
                    financialPercentage: financialPercentage,
                    overallPercentage: overallPercentage,
                    grade: getGrade(overallPercentage)
                }
            }
        };

    } catch (e) {
        Logger.log("Error in generatePQData: " + e.message + "\n" + e.stack);
        return { success: false, message: e.message };
    }
}