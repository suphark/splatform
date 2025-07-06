/**
 * @file mod/vendor/pq/PQ_Criteria.js
 * @description เก็บค่าคงที่และ Logic การให้คะแนน PQ Form ทั้งหมดในรูปแบบ Structure
 * เพื่อให้ง่ายต่อการนำไปแสดงผลใน Frontend
*/


const PQ_CRITERIA = {
    reliability: {
        title: 'ความน่าเชื่อถือ | RELIABILITY',
        weight: 0.50,
        items: {
            companyProfile: {
                title: 'ข้อมูลบริษัท (Company Profile)',
                weight: 0.10,
                levels: [
                    { score: 5, text: 'มีช่องทางติดต่ออื่นๆ และ เว็บไซต์บริษัท' },
                    { score: 3, text: 'มีช่องทางติดต่ออื่นๆ หรือ เว็บไซด์บริษัท' },
                    { score: 2, text: 'มีเอกสาร Company Profile' },
                    { score: 1, text: 'มีเอกสารสำหรับขึ้นทะเบียนครบถ้วน' },
                    { score: 0, text: 'ไม่มีเลย' }
                ],
                getScore: (vendor) => {
                    if (vendor.WebsiteUrl && vendor.SocialUrl) return 5;
                    if (vendor.WebsiteUrl || vendor.SocialUrl) return 3;
                    if (vendor.CompanyProfileFolderId) return 2;
                    if (vendor.CompanyCertFolderId && vendor.VatCertFolderId && vendor.BookBankFolderId) return 1;
                    return 0;
                }
            },
            companyType: {
                title: 'ประเภทบริษัท',
                weight: 0.10,
                levels: [
                    { score: 5, text: 'บริษัทจดทะเบียนในตลาดหลักทรัพย์' },
                    { score: 3, text: 'บริษัทจดทะเบียนนิติบุคคล' },
                    { score: 1, text: 'บุคคลธรรมดา' }
                ],
                getScore: (vendor) => ({'CT-0002': 5, 'CT-0001': 3, 'CT-0003': 1}[vendor.CompanyTypeId] || 0)
            },
            operatingDuration: {
                title: 'ระยะเวลาดำเนินงาน',
                weight: 0.15,
                levels: [
                    { score: 5, text: 'ระยะเวลาการจดทะเบียน มากกว่า 5 ปี' },
                    { score: 4, text: 'ระยะเวลาการจดทะเบียน ตั้งแต่ 3-5 ปี' },
                    { score: 3, text: 'ระยะเวลาการจดทะเบียน ตั้งแต่ 2-3 ปี' },
                    { score: 2, text: 'ระยะเวลาการจดทะเบียน ตั้งแต่ 1-2 ปี' },
                    { score: 1, text: 'ระยะเวลาการจดทะเบียน ตั้งแต่ 0.5-1 ปี' },
                    { score: 0, text: 'ระยะเวลาการจดทะเบียน ไม่เกิน 0.5 ปี' }
                ],
                getScore: (years) => {
                    if (years >= 5) return 5; if (years >= 3) return 4; if (years >= 2) return 3;
                    if (years >= 1) return 2; if (years >= 0.5) return 1; return 0;
                }
            },
            pastPerformance: {
                title: 'ผลงานที่ผ่านมา',
                weight: 0.15,
                levels: [
                    { score: 5, text: 'มีผลงานอ้างอิงกับบริษัทขนาดใหญ่ (ธุรกิจอสังหาฯ)' },
                    { score: 3, text: 'มีผลงานอ้างอิงกับบริษัท/องค์กรทั่วไป' },
                    { score: 1, text: 'มีผลงานอ้างอิงกับร้านค้า/บุคคลธรรมดา' },
                    { score: 0, text: 'ไม่มี' }
                ],
                getScore: (projects, owners) => {
                    if (!projects || projects.length === 0) return 0;
                    const ownerMap = new Map(owners.map(o => [o.Id, o]));
                    const ownerIds = new Set(projects.map(p => p.ProjectOwnerId).filter(Boolean));
                    let hasLarge = false, hasGeneral = false, hasIndividual = false;
                    for (const id of ownerIds) {
                        const owner = ownerMap.get(id);
                        if (owner) {
                            if (String(owner.IsLargeCompany).toUpperCase() === 'TRUE') hasLarge = true;
                            if (owner.CompanyTypeId === 'CT-0001' || owner.CompanyTypeId === 'CT-0002') hasGeneral = true;
                            if (owner.CompanyTypeId === 'CT-0003') hasIndividual = true;
                        }
                    }
                    if (hasLarge) return 5; if (hasGeneral) return 3; if (hasIndividual) return 1;
                    if(projects.some(p => p.ProjectOwnerCustom && !p.ProjectOwnerId)) return 1;
                    return 0;
                }
            }
        }
    },
    financial: {
        title: 'ด้านการเงิน | FINANCIAL STATUS',
        weight: 0.50,
        items: {
            registeredCapital: {
                title: 'ทุนจดทะเบียน',
                weight: 0.10,
                levels: [
                    { score: 5, text: 'ทุนจดทะเบียนมากกว่า 50 ล้านบาท' },
                    { score: 4, text: 'ทุนจดทะเบียนตั้งแต่ 2 - 50 ล้านบาท' },
                    { score: 3, text: 'ทุนจดทะเบียนตั้งแต่ 1 - 2 ล้านบาท' },
                    { score: 2, text: 'ทุนจดทะเบียนตั้งแต่ 0.5 - 1 ล้านบาท' },
                    { score: 1, text: 'ทุนจดทะเบียนน้อยกว่า 0.5 ล้านบาท' },
                    { score: 0, text: 'ไม่มี เช่น บุคคลธรรมดา' }
                ],
                getScore: (capital) => {
                    if (capital > 50000000) return 5; if (capital >= 2000000) return 4; if (capital >= 1000000) return 3;
                    if (capital >= 500000) return 2; if (capital > 0) return 1; return 0;
                }
            },
            averageRevenue: {
                title: 'รายได้เฉลี่ยย้อนหลัง 3 ปี',
                weight: 0.15,
                levels: [
                    { score: 5, text: 'รายได้เฉลี่ยมากกว่า 300 ล้านบาท' },
                    { score: 4, text: 'รายได้เฉลี่ยตั้งแต่ 200 - 300 ล้านบาท' },
                    { score: 3, text: 'รายได้เฉลี่ยตั้งแต่ 25 - 200 ล้านบาท' },
                    { score: 2, text: 'รายได้เฉลี่ยตั้งแต่ 5 - 25 ล้านบาท' },
                    { score: 1, text: 'รายได้เฉลี่ยตั้งแต่ 1 - 5 ล้านบาท' },
                    { score: 0, text: 'รายได้เฉลี่ยไม่เกิน 1 ล้านบาท' }
                ],
                getScore: (avg) => {
                    if (avg > 300000000) return 5; if (avg >= 200000000) return 4; if (avg >= 25000000) return 3;
                    if (avg >= 5000000) return 2; if (avg >= 1000000) return 1; return 0;
                }
            },
            workingCapital: {
                title: 'เงินทุนหมุนเวียน (สินทรัพย์หมุนเวียน - หนี้สินหมุนเวียน)',
                weight: 0.10,
                levels: [
                    { score: 5, text: 'มากกว่า 200.0 ล้านบาท' }, 
                    { score: 4, text: 'ตั้งแต่ 50.0 - 200.0 ล้านบาท' },
                    { score: 3, text: 'ตั้งแต่ 5.0 - 50.0 ล้านบาท' }, 
                    { score: 2, text: 'ตั้งแต่ 1.0 - 5.0 ล้านบาท' },
                    { score: 1, text: 'ตั้งแต่ 0.5 - 1.0 ล้านบาท' }, 
                    { score: 0, text: 'ไม่เกิน 0.5 ล้านบาท' }
                ],
                getScore: (val) => {
                    if (val > 200000000) return 5; if (val >= 50000000) return 4; if (val >= 5000000) return 3;
                    if (val >= 1000000) return 2; if (val >= 500000) return 1; return 0;
                }
            },
            currentRatio: {
                title: 'Current Ratio',
                weight: 0.15,
                levels: [
                    { score: 5, text: 'มากกว่า 2.5' }, { score: 4, text: 'ตั้งแต่ 2 - 2.5' },
                    { score: 3, text: 'ตั้งแต่ 1.5 - 2' }, { score: 2, text: 'ตั้งแต่ 1 - 1.5' },
                    { score: 1, text: 'ตั้งแต่ 0.5 - 1' }, { score: 0, text: 'ไม่เกิน 0.5' }
                ],
                getScore: (ratio) => {
                    if (ratio > 2.5) return 5; if (ratio >= 2) return 4; if (ratio >= 1.5) return 3;
                    if (ratio >= 1) return 2; if (ratio >= 0.5) return 1; return 0;
                }
            }
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