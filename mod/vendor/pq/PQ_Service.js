/**
 * @file mod/vendor/pq/PQ_Service.js
*/


function generatePQData(vendorId) {
    try {
        const vendor = findVendorById(vendorId);
        if (!vendor) throw new Error("ไม่พบข้อมูล Vendor");

        const allCompanyTypes = getAllCompanyTypes();
        const companyTypeMap = new Map(allCompanyTypes.map(c => [c.Id, c.Name]));

        vendor.CompanyTypeName = companyTypeMap.get(vendor.CompanyTypeId) || 'ไม่ระบุ';

        const allFinances = getFinanceByVendorId(vendorId);
        const allProjects = getProjectsByVendorId(vendorId);
        const allProjectOwners = getAllProjectOwners();
        const projectOwnerMap = new Map(allProjectOwners.map(o => [o.Id, o.NameThai]));
        const projectsWithNames = allProjects.map(p => ({ ...p, ProjectOwnerName: projectOwnerMap.get(p.ProjectOwnerId) || '' }));
        const evaluationDate = new Date();
        const currentYear = evaluationDate.getFullYear();
        const registeredDate = vendor.RegisteredDate ? new Date(vendor.RegisteredDate) : null;
        const operatingYears = registeredDate ? (evaluationDate.getTime() - registeredDate.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;
        const recentFinances = allFinances.filter(f => f.Year >= currentYear - 5);
        const latestFinance = allFinances.length > 0 ? allFinances[0] : {};
        const relevantRevenueData = recentFinances.slice(0, 3);
        const avgRevenue = relevantRevenueData.reduce((sum, f) => sum + Number(f.Revenue || 0), 0) / (relevantRevenueData.length || 1);
        const workingCapital = Number(latestFinance.CurrentAssets || 0) - Number(latestFinance.CurrentLiabilities || 0);
        const currentRatio = Number(latestFinance.CurrentLiabilities || 0) > 0 ? Number(latestFinance.CurrentAssets || 0) / Number(latestFinance.CurrentLiabilities) : 0;


        // [NEW] ดึงข้อมูลสำหรับตรวจสอบความสัมพันธ์
        const boardMembers = getBoardMembersByVendorId(vendorId);
        const allStaffs = getAllStaffs();
        const allOrgUnits = getAllDepartments();
        const orgUnitMap = new Map(allOrgUnits.map(unit => [unit.Id, unit]));

        // [NEW] สร้าง Map ของนามสกุลพนักงานเพื่อการตรวจสอบที่รวดเร็ว
        const staffSurnameMap = new Map();
        allStaffs.forEach(staff => {
            if (staff.SurnameThai && staff.SurnameThai.trim() !== '') {
                const surname = staff.SurnameThai.trim();
                if (!staffSurnameMap.has(surname)) {
                    staffSurnameMap.set(surname, []);
                }
                staffSurnameMap.get(surname).push(staff);
            }
        });

        // [NEW] ตรวจสอบความสัมพันธ์
        const relationshipResults = [];
        boardMembers.forEach(member => {
            const memberSurname = member.Surname ? member.Surname.trim() : '';
            if (memberSurname && staffSurnameMap.has(memberSurname)) {
                const matchingStaffs = staffSurnameMap.get(memberSurname);
                matchingStaffs.forEach(staff => {
                    // หาชื่อฝ่าย/แผนกของพนักงาน
                    const unit = orgUnitMap.get(staff.OrgUnitId);
                    let orgUnitDisplay = 'ไม่ระบุ';
                    if (unit) {
                        const parent = unit.ParentId ? orgUnitMap.get(unit.ParentId) : null;
                        orgUnitDisplay = parent ? `${parent.Name} / ${unit.Name}` : unit.Name;
                    }
                    
                    relationshipResults.push({
                        boardMemberName: `${member.Name} ${member.Surname}`,
                        staffName: `${staff.NameThai} ${staff.SurnameThai}`,
                        staffDesignation: staff.Designation || '-',
                        staffOrgUnit: orgUnitDisplay
                    });
                });
            }
        });


        const scores = { reliability: {}, financial: {} };
        const relItems = PQ_CRITERIA.reliability.items;
        const finItems = PQ_CRITERIA.financial.items;

        scores.reliability.companyProfile = relItems.companyProfile.getScore(vendor);
        scores.reliability.companyType = relItems.companyType.getScore(vendor);
        scores.reliability.operatingDuration = relItems.operatingDuration.getScore(operatingYears);
        scores.reliability.pastPerformance = relItems.pastPerformance.getScore(allProjects, allProjectOwners);
        scores.financial.registeredCapital = finItems.registeredCapital.getScore(Number(vendor.RegisteredCapital || 0));
        scores.financial.averageRevenue = finItems.averageRevenue.getScore(avgRevenue);
        scores.financial.workingCapital = finItems.workingCapital.getScore(workingCapital);
        scores.financial.currentRatio = finItems.currentRatio.getScore(currentRatio);
        

        // Calculattion

        const weightedScores = { reliability: {}, financial: {} };
        for (const key in relItems) { weightedScores.reliability[key] = (scores.reliability[key] * relItems[key].weight).toFixed(2); }
        for (const key in finItems) { weightedScores.financial[key] = (scores.financial[key] * finItems[key].weight).toFixed(2); }
        
        const reliabilityWeightedScore = Object.values(weightedScores.reliability).reduce((sum, score) => sum + Number(score), 0);
        const financialWeightedScore = Object.values(weightedScores.financial).reduce((sum, score) => sum + Number(score), 0);
        const totalWeightedScore = reliabilityWeightedScore + financialWeightedScore;
        const reliabilityPercentage = (reliabilityWeightedScore / 2.5) * 100;
        const financialPercentage = (financialWeightedScore / 2.5) * 100;
        const overallPercentage = (totalWeightedScore / 5) * 100;
        const reliabilityGrade = getGrade(reliabilityPercentage);
        const financialGrade = getGrade(financialPercentage);

        return {
            success: true,
            data: {
                vendorData: vendor,
                boardMembers: boardMembers,
                relationshipData: relationshipResults,
                financeData: allFinances,
                projectData: projectsWithNames,
                calculated: {
                    evaluationDate: evaluationDate.toISOString(),
                    operatingYears: operatingYears.toFixed(2),
                    latestFinance: latestFinance,
                    avgRevenue: avgRevenue,
                    workingCapital: workingCapital, // <-- [แก้ไข]
                    currentRatio: currentRatio.toFixed(2)
                },
                scores: scores,
                weightedScores: weightedScores,
                results: {
                    reliabilityWeightedScore: reliabilityWeightedScore.toFixed(2),
                    financialWeightedScore: financialWeightedScore.toFixed(2),
                    totalWeightedScore: totalWeightedScore.toFixed(2),
                    reliabilityPercentage: reliabilityPercentage,
                    financialPercentage: financialPercentage,
                    overallPercentage: overallPercentage,
                    reliabilityGrade: reliabilityGrade,
                    financialGrade: financialGrade,     
                    grade: getGrade(overallPercentage)
                }
            }
        };

    } catch (e) {
        Logger.log("Error in generatePQData: " + e.message + "\n" + e.stack);
        return { success: false, message: e.message };
    }
}