/**
 * file: PQ_Service.gs
 * [FIXED] แก้ไข Path ในการเรียกใช้เกณฑ์และน้ำหนักจาก PQ_CRITERIA ให้ถูกต้อง
 */
function generatePQData(vendorId) {
    try {
        // --- 1. ดึงข้อมูล (ส่วนนี้ถูกต้องแล้ว) ---
        const vendor = findVendorById(vendorId);
        if (!vendor) throw new Error("ไม่พบข้อมูล Vendor");

        const allFinances = getFinanceByVendorId(vendorId);
        const allProjects = getProjectsByVendorId(vendorId);
        const allProjectOwners = getAllProjectOwners();
        const projectOwnerMap = new Map(allProjectOwners.map(o => [o.Id, o.Name]));

        const projectsWithNames = allProjects.map(p => ({
            ...p,
            ProjectOwnerName: projectOwnerMap.get(p.ProjectOwnerId) || ''
        }));

        // --- 2. คำนวณค่าพื้นฐาน (ส่วนนี้ถูกต้องแล้ว) ---
        const evaluationDate = new Date();
        const currentYear = evaluationDate.getFullYear();
        const registeredDate = vendor.RegisteredDate ? new Date(vendor.RegisteredDate) : null;
        const operatingYears = registeredDate ? (evaluationDate.getTime() - registeredDate.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;
        
        const recentFinances = allFinances.filter(f => f.Year >= currentYear - 5);
        const latestFinance = allFinances.length > 0 ? allFinances[0] : {};
        const relevantRevenueData = recentFinances.slice(0, 3);
        const avgRevenue = relevantRevenueData.reduce((sum, f) => sum + Number(f.Revenue || 0), 0) / (relevantRevenueData.length || 1);
        const financialReadiness = Number(latestFinance.CurrentAssets || 0) - Number(latestFinance.TotalLiabilities || 0);
        const currentRatio = Number(latestFinance.CurrentLiabilities || 0) > 0 ? Number(latestFinance.CurrentAssets || 0) / Number(latestFinance.CurrentLiabilities) : 0;

        // --- 3. ประมวลผลคะแนนแต่ละหัวข้อ (แก้ไข path) ---
        const scores = { reliability: {}, financial: {} };
        const relItems = PQ_CRITERIA.reliability.items;
        const finItems = PQ_CRITERIA.financial.items;

        scores.reliability.companyProfile = relItems.companyProfile.getScore(vendor);
        scores.reliability.companyType = relItems.companyType.getScore(vendor);
        scores.reliability.operatingDuration = relItems.operatingDuration.getScore(operatingYears);
        scores.reliability.pastPerformance = relItems.pastPerformance.getScore(allProjects, allProjectOwners);

        scores.financial.registeredCapital = finItems.registeredCapital.getScore(Number(vendor.RegisteredCapital || 0));
        scores.financial.averageRevenue = finItems.averageRevenue.getScore(avgRevenue);
        scores.financial.financialReadiness = finItems.financialReadiness.getScore(financialReadiness);
        scores.financial.currentRatio = finItems.currentRatio.getScore(currentRatio);
        
        // --- 4. คำนวณคะแนนรวมและเกรด (แก้ไข path) ---
        const reliabilityWeightedScore = 
            (scores.reliability.companyProfile * relItems.companyProfile.weight) +
            (scores.reliability.companyType * relItems.companyType.weight) +
            (scores.reliability.operatingDuration * relItems.operatingDuration.weight) +
            (scores.reliability.pastPerformance * relItems.pastPerformance.weight);

        const financialWeightedScore = 
            (scores.financial.registeredCapital * finItems.registeredCapital.weight) +
            (scores.financial.averageRevenue * finItems.averageRevenue.weight) +
            (scores.financial.financialReadiness * finItems.financialReadiness.weight) +
            (scores.financial.currentRatio * finItems.currentRatio.weight);

        const totalWeightedScore = reliabilityWeightedScore + financialWeightedScore;
        const reliabilityPercentage = (reliabilityWeightedScore / 2.5) * 100;
        const financialPercentage = (financialWeightedScore / 2.5) * 100;
        const overallPercentage = (totalWeightedScore / 5) * 100;
        
        // --- 5. สร้าง Object ผลลัพธ์สำหรับส่งกลับ (เหมือนเดิม) ---
        return {
            success: true,
            data: {
                vendorData: vendor,
                boardMembers: getBoardMembersByVendorId(vendorId),
                financeData: allFinances,
                projectData: projectsWithNames,
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