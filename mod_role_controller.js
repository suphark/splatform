/**
* file : mod_role_controller.gs
*/ 


/**
 * ประมวลผลการเพิ่ม Role ใหม่
 */
function processAddNewRole(formObject) {
  try {
    // ตรวจสอบว่าชื่อ Role ซ้ำหรือไม่
    const existingRole =   APP_CONFIG.sheetsData.roles.getTable().where(r => r.Name.toLowerCase() === formObject.Name.toLowerCase()).first();
    if (existingRole) {
      return { success: false, message: 'มีชื่อ Role นี้อยู่แล้วในระบบ' };
    }

    addNewRole(formObject);
    writeAuditLog('Admin: Create Role', formObject.Name);
    const newRole =   APP_CONFIG.sheetsData.roles.getTable().where(r => r.Name === formObject.Name).first(); // ดึงข้อมูลที่เพิ่งสร้างเพื่อส่งกลับ
    return { success: true, message: 'เพิ่ม Role สำเร็จ!', newRole: newRole };
  } catch (e) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
  }
}

/**
 * ประมวลผลการแก้ไข Role
 */
function processEditRole(formObject) {
  try {
    // ตรวจสอบว่าชื่อใหม่ซ้ำกับ Role อื่นหรือไม่
    const existingRole =   APP_CONFIG.sheetsData.roles.getTable().where(r => r.Name.toLowerCase() === formObject.Name.toLowerCase()).first();
    if (existingRole && existingRole.Id !== formObject.Id) {
      return { success: false, message: 'มีชื่อ Role นี้อยู่แล้วในระบบ' };
    }
    
    updateRoleById(formObject.Id, formObject);
    writeAuditLog('Admin: Edit Role', formObject.Name, `ID: ${formObject.Id}`);
    const updatedRole =   APP_CONFIG.sheetsData.roles.getTable().where(r => r.Id === formObject.Id).first();
    return { success: true, message: 'อัปเดต Role สำเร็จ!', updatedRole: updatedRole };
  } catch (e) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
  }
}

/**
 * ประมวลผลการลบ Role
 */
function processDeleteRole(roleId) {
  try {
    // 1. ตรวจสอบว่ามีผู้ใช้คนไหนใช้ Role นี้อยู่หรือไม่
    const userWithRole =  APP_CONFIG.sheetsData.users.getTable().where(u => u.RoleId === roleId).first();
    if (userWithRole) {
      return { success: false, message: `ไม่สามารถลบ Role นี้ได้ เนื่องจากมีการใช้งานโดยผู้ใช้: ${userWithRole.Email}` };
    }

    // 2. [CRITICAL FIX] ค้นหา Role ที่จะลบเพื่อเอาชื่อมาเก็บไว้ก่อน
    const roleToDelete = findRoleById(roleId);
    if (!roleToDelete) {
      return { success: false, message: 'เกิดข้อผิดพลาด: ไม่พบ Role ที่ต้องการลบ' };
    }
    const roleNameToDelete = roleToDelete.Name; // เก็บชื่อไว้ในตัวแปร

    // 3. ทำการลบ Role ออกจากฐานข้อมูล
    deleteRoleById(roleId);

    // 4. [CRITICAL FIX] บันทึก Log โดยใช้ตัวแปรที่เก็บชื่อไว้
    writeAuditLog('Admin: Delete Role', roleNameToDelete);

    return { success: true, message: 'ลบ Role สำเร็จ!' };
  } catch (e) {
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
  }
}