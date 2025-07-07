// mod/staff/controller.js
/**
 * @file mod/staff/controller.js
 * @description ประมวลผลคำสั่งที่เกี่ยวกับข้อมูลพนักงาน
 */


/**
 * [SERVER-CALL] [REVISED] ดึงข้อมูลพนักงานแบบแบ่งหน้า
 */
function getPaginatedStaffs(options = {}) {
  try {
    const allStaffs = getAllStaffs();
    const allOrgUnits = getAllDepartments(); // ใช้ฟังก์ชันจาก department/database.js

    // สร้าง Map สำหรับค้นหาชื่อหน่วยงาน และ Map สำหรับหา Parent
    const orgUnitMap = new Map(allOrgUnits.map(unit => [unit.Id, unit]));

    // Join data for display
    const joinedStaffs = allStaffs.map(staff => {
      const unit = orgUnitMap.get(staff.OrgUnitId);
      let departmentName = '-';
      let sectionName = '';

      if (unit) {
        if (unit.ParentId && orgUnitMap.has(unit.ParentId)) {
          // This is a Section
          const parentDept = orgUnitMap.get(unit.ParentId);
          departmentName = parentDept.Name;
          sectionName = unit.Name;
        } else {
          // This is a Department
          departmentName = unit.Name;
        }
      }
      
      return {
        ...staff,
        DepartmentName: departmentName,
        SectionName: sectionName,
        SupervisorName: allStaffs.find(s => s.Id === staff.SupervisorId)?.NameThai || '-',
      };
    });

    // Filtering logic
    const filters = [];
    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      filters.push(
        { field: 'NameThai', operator: 'contains', value: term, logic: 'or' },
        { field: 'SurnameThai', operator: 'contains', value: term, logic: 'or' },
        { field: 'NicknameThai', operator: 'contains', value: term, logic: 'or' },
        { field: 'Email', operator: 'contains', value: term, logic: 'or' }
      );
    }
    // [REVISED] Filter by a single OrgUnitId
    if (options.orgUnitId) {
        // Find all children of the selected unit
        const selectedUnitId = options.orgUnitId;
        const childIds = new Set([selectedUnitId]);
        const findChildrenRecursive = (parentId) => {
            allOrgUnits.forEach(unit => {
                if(unit.ParentId === parentId) {
                    childIds.add(unit.Id);
                    findChildrenRecursive(unit.Id);
                }
            });
        };
        findChildrenRecursive(selectedUnitId);

        filters.push({
            field: 'OrgUnitId',
            operator: (rowValue) => childIds.has(rowValue) // Custom filter function
        });
    }
    if (options.status) {
      filters.push({ field: 'Status', operator: 'equals', value: options.status });
    }

    // Custom operator for the filter engine
    const customOperators = {
        'equals': (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
        'contains': (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase())
    };

    const config = {
      dataSource: joinedStaffs,
      pagination: options,
      sort: { column: options.sortColumn || 'CreateDate', direction: options.sortDirection || 'desc' },
      filters: filters,
      customOperators: customOperators
    };
    
    const result = getPaginatedData(config);

    return {
      success: true, data: result.data, totalRecords: result.totalRecords,
      totalPages: result.totalPages, currentPage: result.currentPage
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