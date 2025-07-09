/**
 * @file mod/vendor/GenericCrudService.js
 * @description บริการกลางสำหรับจัดการ CRUD ของข้อมูลย่อยที่มีความคล้ายคลึงกัน เช่น ผู้ติดต่อ, กรรมการ, การเงิน, โครงการ เพื่อให้โค้ดมีความยืดหยุ่นและง่ายต่อการขยาย
*/


/**
 * =================================================================
 * CRUD CONFIGURATION MAP
 * =================================================================
 * "สูตร" สำหรับการจัดการข้อมูลแต่ละประเภท
 * - sheetKey: Key ของชีตใน APP_CONFIG.sheetsData
 * - idPrefix: Prefix สำหรับสร้าง ID ใหม่
 * - requiredFields: Fields ที่จำเป็นต้องมีข้อมูล
 * - getAfterAction: ฟังก์ชันสำหรับดึงข้อมูลล่าสุดหลังการดำเนินการ
 * - entityName: ชื่อเรียกข้อมูล (สำหรับแสดงในข้อความแจ้งเตือน)
 */
const CRUD_CONFIG = {
    // ---- Vendor Sub-modules ----
    vendorContact: {
        sheetKey: 'vendorContacts',
        idPrefix: 'VCT-',
        requiredFields: ['VendorId', 'Name'],
        getAfterAction: (vendorId) => getContactsByVendorId(vendorId),
        entityName: 'ผู้ติดต่อ'
    },
    vendorBoardMember: {
        sheetKey: 'vendorBoardMembers',
        idPrefix: 'VBM-',
        requiredFields: ['VendorId', 'Name', 'Surname'],
        getAfterAction: (vendorId) => getBoardMembersByVendorId(vendorId),
        entityName: 'กรรมการ'
    },
    vendorFinance: {
        sheetKey: 'vendorFinance',
        idPrefix: 'VFN-',
        requiredFields: ['VendorId', 'Year'],
        getAfterAction: (vendorId) => getFinanceByVendorId(vendorId),
        entityName: 'ข้อมูลงบการเงิน'
    },
    vendorProject: {
        sheetKey: 'vendorProjects',
        idPrefix: 'VPR-',
        requiredFields: ['VendorId', 'ProjectName', 'ProjectTypeId'],
        getAfterAction: (vendorId) => getProjectsByVendorId(vendorId),
        entityName: 'โครงการอ้างอิง'
    }
    // เพิ่มโมดูลใหม่ๆ ที่นี่ในอนาคต เช่น OrderHistory, Evaluations
};


/**
 * [SERVER-CALL] ฟังก์ชันกลางอัจฉริยะสำหรับจัดการ CRUD
 *
 * @param {string} entityType - ประเภทของข้อมูล (key ใน CRUD_CONFIG เช่น 'vendorContact')
 * @param {string} action - การดำเนินการ ('add', 'edit', 'delete')
 * @param {object} payload - ข้อมูลที่ส่งมาจาก Client
 * - สำหรับ 'add'/'edit': คือ formData
 * - สำหรับ 'delete': คือ { id: '...', parentId: '...' }
 * @returns {object} ผลลัพธ์การทำงาน { success: boolean, message: string, data: any }
 */
function processGenericCrudAction(entityType, action, payload) {
    try {
        const config = CRUD_CONFIG[entityType];
        if (!config) {
            throw new Error(`ไม่พบการตั้งค่าสำหรับ entity: ${entityType}`);
        }

        const table = APP_CONFIG.sheetsData[config.sheetKey].getTable();

        switch (action) {
            case 'add':
            case 'edit':
                // --- VALIDATION ---
                for (const field of config.requiredFields) {
                    if (!payload[field]) {
                        throw new Error(`ข้อมูลไม่ครบถ้วน: กรุณากรอกข้อมูล ${field}`);
                    }
                }
                
                // --- [SPECIAL FIX] บังคับให้เบอร์โทรเป็นข้อความ ---
                if (payload.PhoneNumber) {
                     payload.PhoneNumber = "'" + String(payload.PhoneNumber);
                }

                // --- INSERT or UPDATE ---
                if (action === 'add') {
                    table.withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: config.idPrefix }).insertRows([payload]);
                } else {
                    table.where(row => row.Id === payload.Id).updateRows(row => ({ ...row, ...payload }));
                }
                break;

            case 'delete':
                if (!payload.id) {
                    throw new Error("ไม่พบ ID สำหรับการลบ");
                }
                table.where(row => row.Id === payload.id).deleteRows();
                break;

            default:
                throw new Error(`การดำเนินการ "${action}" ไม่ถูกต้อง`);
        }
        
        // --- ดึงข้อมูลล่าสุดและส่งกลับ ---
        const parentId = action === 'delete' ? payload.parentId : payload.VendorId;
        const updatedData = config.getAfterAction(parentId);
        
        const successMessage = (action === 'add') ? `เพิ่ม${config.entityName}สำเร็จ!` :
                               (action === 'edit') ? `แก้ไข${config.entityName}สำเร็จ!` :
                               `ลบ${config.entityName}สำเร็จ!`;

        return { success: true, message: successMessage, data: updatedData };

    } catch (e) {
        Logger.log(`Generic CRUD Error (${entityType} | ${action}): ${e.message}`);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}