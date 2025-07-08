// mod/staff/controller.js
/**
 * @file mod/staff/controller.js
 * @description ประมวลผลคำสั่งที่เกี่ยวกับข้อมูลพนักงาน
 */


/**
 * [SERVER-CALL] [REVISED] ดึงข้อมูลพนักงานแบบแบ่งหน้า
 * แก้ไข Logic การกรองทั้งหมดให้ทำงานอย่างถูกต้อง โดยกรองข้อมูลจาก Array โดยตรงก่อนส่งไปแบ่งหน้า
 */
function getPaginatedStaffs(options = {}) {
    try {
        const allStaffsRaw = getAllStaffs();
        const allOrgUnits = getAllDepartments(); 
        const orgUnitMap = new Map(allOrgUnits.map(unit => [unit.Id, unit]));

        let filteredStaffs = [...allStaffsRaw]; // ทำงานกับข้อมูลที่คัดลอกมา (Shallow Copy)

        // --- 1. กรองข้อมูลตามเงื่อนไขทั้งหมด ---

        // 1.1 กรองตามฝ่าย/แผนก (และหน่วยงานย่อยทั้งหมด)
        if (options.orgUnitId) {
            const selectedUnitId = options.orgUnitId;
            const applicableUnitIds = new Set([selectedUnitId]);
            
            const findChildrenRecursive = (parentId) => {
                allOrgUnits.forEach(unit => {
                    if (unit.ParentId === parentId) {
                        applicableUnitIds.add(unit.Id);
                        findChildrenRecursive(unit.Id); // ค้นหาหน่วยงานย่อยต่อไป
                    }
                });
            };
            findChildrenRecursive(selectedUnitId);

            filteredStaffs = filteredStaffs.filter(staff => applicableUnitIds.has(staff.OrgUnitId));
        }
        
        // 1.2 กรองตามสถานะ
        if (options.status) {
            filteredStaffs = filteredStaffs.filter(staff => staff.Status === options.status);
        }

        // 1.3 กรองตามคำค้นหา
        if (options.searchTerm) {
            const term = options.searchTerm.toLowerCase();
            filteredStaffs = filteredStaffs.filter(s =>
                String(s.NameThai || '').toLowerCase().includes(term) ||
                String(s.SurnameThai || '').toLowerCase().includes(term) ||
                String(s.NicknameThai || '').toLowerCase().includes(term) ||
                String(s.Email || '').toLowerCase().includes(term)
            );
        }

        // --- 2. นำข้อมูลที่กรองแล้วมา Join เพื่อแสดงผล ---
        const joinedAndFilteredStaffs = filteredStaffs.map(staff => {
            const unit = orgUnitMap.get(staff.OrgUnitId);
            let departmentName = '-';
            let sectionName = '';

            if (unit) {
                if (unit.ParentId && orgUnitMap.has(unit.ParentId)) {
                    const parentDept = orgUnitMap.get(unit.ParentId);
                    departmentName = parentDept.Name;
                    sectionName = unit.Name;
                } else {
                    departmentName = unit.Name;
                }
            }
            
            return {
                ...staff,
                DepartmentName: departmentName,
                SectionName: sectionName,
                SupervisorName: allStaffsRaw.find(s => s.Id === staff.SupervisorId)?.NameThai || '-',
            };
        });
        
        // --- 3. ส่งข้อมูลที่กรองและ Join เรียบร้อยแล้วไปให้ฟังก์ชันกลางทำแค่ Sort และ Paginate ---
        const config = {
            dataSource: joinedAndFilteredStaffs,
            pagination: options,
            sort: { column: options.sortColumn || 'CreateDate', direction: options.sortDirection || 'desc' },
            filters: [], // <<<<<<< สำคัญ: ส่งอาร์เรย์ว่างไป เพราะเรากรองเองแล้ว
        };
        
        const result = getPaginatedData(config); // เรียกใช้ฟังก์ชันกลางจาก UtilsLib.js

        return {
            success: true,
            data: result.data,
            totalRecords: result.totalRecords,
            totalPages: result.totalPages,
            currentPage: result.currentPage
        };

    } catch (e) {
        Logger.log(`Error in getPaginatedStaffs: ${e.message}\n${e.stack}`);
        return { success: false, message: e.message };
    }
}

/**
 * [SERVER-CALL] ประมวลผลการเพิ่มหรือแก้ไขข้อมูลพนักงาน
 */
function processAddOrEditStaff(formData, fileData) {
  try {
    const isEditMode = !!formData.Id;
    let profileImageURL = formData.ProfileImageURL || '';

    // 1. Upload new profile picture if provided
    if (fileData && fileData.base64) {
      const folderId = APP_CONFIG.googleServices.drive.folders.staffProfilePictures;
      profileImageURL = uploadStaffProfileImage(fileData, formData.Id || 'new_staff', folderId, formData.ProfileImageURL);
    }

    formData.ProfileImageURL = profileImageURL;

    // 2. Add or Update data in the sheet
    if (isEditMode) {
      updateStaffById(formData.Id, formData);
      writeAuditLog('Staff: Edit', `ID: ${formData.Id}, Name: ${formData.NameThai}`);
    } else {
      addNewStaff(formData);
      writeAuditLog('Staff: Create', `Name: ${formData.NameThai}`);
    }

    return { success: true, message: 'บันทึกข้อมูลพนักงานสำเร็จ!' };
  } catch (e) {
    Logger.log(`Error in processAddOrEditStaff: ${e.message}`);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
  }
}

/**
 * [SERVER-CALL] ประมวลผลการลบข้อมูลพนักงาน
 */
function processDeleteStaff(staffId) {
  try {
    // Optional: Check if staff is a supervisor to others
    const subordinates = sheetQuery(APP_CONFIG.googleServices.sheets.databases.main)
      .from('Staffs')
      .where(row => row.SupervisorId === staffId)
      .count();
      
    if (subordinates > 0) {
      return { success: false, message: 'ไม่สามารถลบพนักงานคนนี้ได้ เนื่องจากเป็นหัวหน้าของพนักงานอื่น' };
    }

    const staffToDelete = findStaffById(staffId);
    if (staffToDelete && staffToDelete.ProfileImageURL) {
      try {
        const fileId = staffToDelete.ProfileImageURL.match(/id=([^&]+)/)[1];
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (e) {
        Logger.log(`Could not delete staff profile picture for staff ID ${staffId}. Error: ${e.message}`);
      }
    }

    deleteStaffById(staffId);
    writeAuditLog('Staff: Delete', `ID: ${staffId}`);
    return { success: true, message: 'ลบข้อมูลพนักงานสำเร็จ' };
  } catch (e) {
    Logger.log(`Error in processDeleteStaff: ${e.message}`);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
  }
}

/**
 * [SERVER-CALL] ดึงข้อมูลพนักงานทั้งหมดสำหรับ Dropdown (เลือกหัวหน้า)
 */
function getAllStaffsForSelection() {
  try {
    const staffs = getAllStaffs();
    return staffs.map(s => ({
      Id: s.Id,
      DisplayName: `${s.NameThai} ${s.SurnameThai} (${s.NicknameThai || ''})`
    }));
  } catch (e) {
    return [];
  }
}

/**
 * [SERVER-CALL] ดึงข้อมูลฝ่ายและแผนกทั้งหมด
 */
function getAllDepartments() {
  try { return APP_CONFIG.sheetsData.departments.getTable().getRows(); } catch (e) { return []; }
}

function getAllSections() {
  try { return APP_CONFIG.sheetsData.sections.getTable().getRows(); } catch (e) { return []; }
}