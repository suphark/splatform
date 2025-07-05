/**
 * file: PQCriteria.gs
 * [FINAL] เก็บค่าคงที่สำหรับเกณฑ์การให้คะแนน PQ Form ทั้งหมด
 * - อัปเดต pastPerformance ให้ใช้ข้อมูลจาก ProjectOwners
 */

const PQ_CRITERIA = {
    // ==================== ความน่าเชื่อถือ | RELIABILITY ====================
    companyProfile: {
        weight: 0.10,
        getScore: (vendorData) => {
            if (vendorData.WebsiteUrl && vendorData.SocialUrl) return 5;
            if (vendorData.WebsiteUrl || vendorData.SocialUrl) return 3;
            if (vendorData.CompanyProfileFolderId) return 2;
            if (vendorData.CompanyCertFolderId && vendorData.VatCertFolderId && vendorData.BookBankFolderId) return 1;
            return 0;
        }
    },
    companyType: {
        weight: 0.10,
        getScore: (vendorData) => {
            const scoreMap = { 'CT-0002': 5, 'CT-0001': 3, 'CT-0003': 1 };
            return scoreMap[vendorData.CompanyTypeId] || 0;
        }
    },
    operatingDuration: {
        weight: 0.15,
        getScore: (years) => {
            if (years >= 5) return 5;
            if (years >= 3) return 4;
            if (years >= 2) return 3;
            if (years >= 1) return 2;
            if (years >= 0.5) return 1;
            return 0;
        }
    },
    pastPerformance: {
        weight: 0.15,
        getScore: (vendorProjects, allProjectOwners) => { // รับข้อมูล ProjectOwners ทั้งหมดมาด้วย
            if (!vendorProjects || vendorProjects.length === 0) return 0;

            const ownerMap = new Map(allProjectOwners.map(owner => [owner.Id, owner]));
            const projectOwnerIds = new Set(vendorProjects.map(p => p.ProjectOwnerId).filter(Boolean));
            
            let hasLargeCompany = false;
            let hasGeneralCompany = false;
            let hasIndividual = false;

            for (const ownerId of projectOwnerIds) {
                const owner = ownerMap.get(ownerId);
                if (owner) {
                    if (String(owner.IsLargeCompany).toUpperCase() === 'TRUE') {
                        hasLargeCompany = true;
                        break; // เจอแล้วไม่ต้องหาต่อ
                    }
                    if (owner.CompanyTypeId === 'CT-0001' || owner.CompanyTypeId === 'CT-0002') {
                        hasGeneralCompany = true;
                    }
                    if (owner.CompanyTypeId === 'CT-0003') {
                        hasIndividual = true;
                    }
                }
            }

            if (hasLargeCompany) return 5;
            if (hasGeneralCompany) return 3;
            if (hasIndividual) return 1;
            
            // กรณีมีโครงการแต่ไม่ได้ระบุ ProjectOwnerId (เป็น Custom) ให้ถือเป็น 1 คะแนน
            if(vendorProjects.some(p => p.ProjectOwnerCustom && !p.ProjectOwnerId)) return 1;

            return 0;
        }
    },
    // ==================== ด้านการเงิน | FINANCIAL STATUS ====================
    registeredCapital: {
        weight: 0.10,
        getScore: (capital) => {
            if (capital > 50000000) return 5;
            if (capital >= 2000000) return 4;
            if (capital >= 1000000) return 3;
            if (capital >= 500000) return 2;
            if (capital > 0) return 1;
            return 0;
        }
    },
    averageRevenue: {
        weight: 0.15,
        getScore: (avgRevenue) => {
            if (avgRevenue > 300000000) return 5;
            if (avgRevenue >= 200000000) return 4;
            if (avgRevenue >= 25000000) return 3;
            if (avgRevenue >= 5000000) return 2;
            if (avgRevenue >= 1000000) return 1;
            return 0;
        }
    },
    financialReadiness: {
        weight: 0.10,
        getScore: (readinessValue) => {
            if (readinessValue > 200000000) return 5;
            if (readinessValue >= 50000000) return 4;
            if (readinessValue >= 5000000) return 3;
            if (readinessValue >= 1000000) return 2;
            if (readinessValue >= 500000) return 1;
            return 0;
        }
    },
    currentRatio: {
        weight: 0.15,
        getScore: (ratio) => {
            if (ratio > 2.5) return 5;
            if (ratio >= 2) return 4;
            if (ratio >= 1.5) return 3;
            if (ratio >= 1) return 2;
            if (ratio >= 0.5) return 1;
            return 0;
        }
    }
};

function getGrade(overallPercentage) {
    if (overallPercentage >= 90) return 'A';
    if (overallPercentage >= 80) return 'B+';
    if (overallPercentage >= 70) return 'B';
    if (overallPercentage >= 60) return 'C+';
    if (overallPercentage >= 50) return 'C';
    return 'D';
}