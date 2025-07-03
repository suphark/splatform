/**
 * file : mod_user_database.gs
 * แก้ไขให้เรียกใช้ Data Access Layer จาก APP_CONFIG โดยตรง
 */

function findUserByEmail(email) {
  if (!email) return null;
  // ใช้ getTable() จาก APP_CONFIG
  return APP_CONFIG.sheetsData.users.getTable().where(row => row.Email.toLowerCase() === email.toLowerCase()).first();
}

function findUserById(userId) {
  if (!userId) return null;
  // ใช้ getTable() จาก APP_CONFIG
  return APP_CONFIG.sheetsData.users.getTable().where(row => String(row.Id) === String(userId)).first();
}

function updateUserLastLoginTimestamp(userId) {
  // ใช้ getTable() จาก APP_CONFIG
  APP_CONFIG.sheetsData.users.getTable().where(row => row.Id === userId).updateRows(row => {
    row.LastLogin = new Date();
  });
}

// [REVISED] createNewUser
function createNewUser(userData) {
  APP_CONFIG.sheetsData.users.getTable()
    .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'U-' })
    .insertRows([{
      Email: userData.email,
      PasswordHash: userData.passwordHash,
      Salt: userData.salt,
      RoleId: userData.roleId,
      Status: userData.status, // <-- เพิ่ม Status
      LoginOTP: userData.otp, // <-- เพิ่ม OTP
      LoginOTPExpiry: userData.otpExpiry, // <-- เพิ่มวันหมดอายุ OTP
      CreateDate: new Date(),
      LastLogin: '',
    }]);
}

function countTotalUsers() {
  return APP_CONFIG.sheetsData.users.getTable().count();
}

/**
 * [FINAL] ดึงข้อมูลผู้ใช้แบบแบ่งหน้า โดยใช้ Generic Pagination Engine
 * และสามารถเรียงลำดับตาม RoleName ได้
 */
function getPaginatedUsers(options = {}) {
    try {
        // --- 1. ส่วนของการดึงและเตรียมข้อมูล (Data Fetching & Joining) ---
        const usersTable = APP_CONFIG.sheetsData.users.getTable();
        const rolesTable = APP_CONFIG.sheetsData.roles.getTable();
        const allUsers = usersTable.getRows();
        const allRoles = rolesTable.getRows();
        usersTable.clearDataCache().clearBuilder();
        rolesTable.clearDataCache().clearBuilder();

        const rolesMap = allRoles.reduce((map, role) => {
            map[role.Id] = { name: role.Name, color: role.BadgeColor || 'badge-secondary' };
            return map;
        }, {});

        // สร้าง dataSource ที่ผ่านการ JOIN แล้ว
        const joinedUsers = allUsers.map(user => {
            const roleInfo = rolesMap[user.RoleId] || { name: 'N/A' };
            return {
                ...user,
                RoleName: roleInfo.name // เพิ่ม Key 'RoleName' สำหรับการ Sort
            };
        });

        // --- 2. ส่วนของการกำหนดค่าและเรียกใช้ Pagination Engine ---
        const filters = [];
        if (options.searchTerm) {
          filters.push({ field: 'Email', operator: 'contains', value: options.searchTerm });
        }
        if (options.roleId) {
          filters.push({ field: 'RoleId', operator: 'equals', value: options.roleId });
        }
        if (options.status) {
          filters.push({ field: 'Status', operator: 'equals', value: options.status });
        }

        const config = {
            dataSource: joinedUsers,
            pagination: options,
            sort: {
                column: options.sortColumn || 'CreateDate',
                direction: options.sortDirection || 'desc'
            },
            filters: filters
        };

        const result = ProjectUtilsLib.getPaginatedData(config);

        // --- 3. ส่วนของการแปลงข้อมูลเพื่อส่งกลับ (Presenter) ---
        const transformedUsers = result.data.map(user => ({
            Id: user.Id,
            Email: user.Email,
            RoleId: user.RoleId,
            RoleName: user.RoleName,
            RoleColor: (rolesMap[user.RoleId] || {}).color,
            Status: user.Status || 'N/A',
            CreateDate: user.CreateDate ? new Date(user.CreateDate).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-',
            LastLogin: user.LastLogin ? new Date(user.LastLogin).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ยังไม่เคยล็อกอิน',
        }));

        return {
            users: transformedUsers,
            totalRecords: result.totalRecords,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            success: true
        };

    } catch (e) {
        Logger.log('Error in getPaginatedUsers: ' + e.toString());
        return { success: false, message: e.message };
    }
}

function deleteUserById(userId) {
  // ใช้ getTable() จาก APP_CONFIG
  APP_CONFIG.sheetsData.users.getTable().where(row => row.Id === userId).deleteRows();
}

function updateUserById(userId, dataToUpdate) {
  // ใช้ getTable() จาก APP_CONFIG
  APP_CONFIG.sheetsData.users.getTable().where(row => row.Id === userId).updateRows(row => {
    for (const key in dataToUpdate) {
      if (Object.hasOwnProperty.call(dataToUpdate, key)) {
        row[key] = dataToUpdate[key];
      }
    }
    return row; // <-- เพิ่มบรรทัดนี้
  });
}

function getAllUsers() {
    const table = APP_CONFIG.sheetsData.users.getTable();
    const users = table.sortBy('Email', 'asc').getRows();
    table.clearDataCache().clearBuilder();
    return users;
}

/**
 * [NEW] ดึงรายชื่อผู้ใช้ทั้งหมดที่อยู่ใน Role ที่กำหนด
 * @param {string[]} roleNamesArray - Array ของชื่อ Role เช่น ['Admin', 'PRC']
 * @returns {Array<RowObject>}
 */
function getUsersByRoles(roleNamesArray) {
    if (!roleNamesArray || roleNamesArray.length === 0) {
        return [];
    }
    
    // 1. ค้นหา Role ID จากชื่อ Role ที่ระบุ
    const rolesTable = APP_CONFIG.sheetsData.roles.getTable();
    const allowedRoles = rolesTable.where(r => roleNamesArray.includes(r.Name)).getRows();
    rolesTable.clearAll();
    const allowedRoleIds = allowedRoles.map(r => r.Id);

    if (allowedRoleIds.length === 0) {
        return [];
    }

    // 2. ดึง User ที่มี Role ID ตรงกับที่ค้นหาได้
    const usersTable = APP_CONFIG.sheetsData.users.getTable();
    const users = usersTable.where(u => allowedRoleIds.includes(u.RoleId)).sortBy('Email', 'asc').getRows();
    usersTable.clearAll();
    
    return users;
}


