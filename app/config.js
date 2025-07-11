/**
 * @file app/config.js
 * เป็นไฟล์ศูนย์กลางสำหรับเก็บค่าคงที่และการตั้งค่าทั้งหมดของแอปพลิเคชัน
 * โดยจัดกลุ่มตามประเภทของบริการและใช้ Generator Pattern เพื่อความยืดหยุ่นสูงสุด
 */

// ================== ส่วนที่ 1: กำหนดค่าพื้นฐานที่ไม่มี Dependency ==================

// 1.1 นิยามของชีตต่างๆ และฐานข้อมูลที่สังกัด
const SHEET_DEFINITIONS = [
  { name: "Users", db: "main" },
  { name: "Roles", db: "main" },
  { name: "Settings", db: "main" },
  { name: "AuditLog", db: "main" },
  { name: "Packages", db: "main" },
  { name: "Vendors", db: "main" },
  { name: "VendorStatuses", db: "main" },
  { name: "VendorContacts", db: "main" },
  { name: "VendorBoardMembers", db: "main" },
  { name: "VendorFinance", db: "main" },
  { name: "VendorProjects", db: "main" },
  { name: "ProjectTypes", db: "main" },
  { name: "ProjectOwners", db: "main" },
  { name: "CompanyTypes", db: "main" },
  { name: "PQForms", db: "main" },
  { name: "PQCriteria", db: "main" },
  { name: "Staffs", db: "main" },
  { name: "Departments", db: "main" },
  { name: "Projects", db: "main" },
  { name: "Provinces", db: "main" },
  { name: "ProjectStatuses", db: "main" },
  { name: "PostQForms", db: "main" },
];

// 1.2 การตั้งค่า ID ของบริการต่างๆ
const GOOGLE_SERVICES = {
  sheets: {
    databases: {
      main: '1OD2QufJFp4oc3o-Yv_qlwNHxOTwUZLqwIGg1ehrm-Mw',
    }
  },
  drive: {
    folders: {
      profilePictures: '1_S_Ur0ziImSrG1uKIkWVofUqzEDEZqfL',
      vendorFiles: '1DFxzYj8XYOmjvkFsOu3lvt0rD3Hd0JK_',
      staffProfilePictures: '11_OM30lzntI2MVy6y98_FhhWkdRXN82V',
    }
  }
};


// 1.3 การตั้งค่าเส้นทางและหน้าเว็บ
const ROUTING_CONFIG = {
  files: {
    'admin/dashboard': 'page/admin/dashboard',
    'admin/settings': 'page/admin/settings',
    'admin/user/manage': 'page/admin/user_manage',
    'admin/role/manage': 'page/admin/role_manage',
    'admin/staff/manage': 'page/admin/staff_manage',
    'admin/department/manage': 'page/admin/department_manage',
    'admin/project/owner/manage': 'page/admin/project/owner/manage',
    'project/manage': 'page/project/manage',
    'dashboard': 'page/dashboard',
    'home': 'page/home',
    // ====== User ======
    'login': 'page/user/login',
    'register': 'page/user/register',
    'profile': 'page/user/profile',
    'forgot-password': 'page/user/forgot_password',
    'reset-password': 'page/user/reset_password',
    // ====== Package ======
    'package/manage': 'page/package/manage',
    // ====== Vendor ======
    'vendor/manage': 'page/vendor/manage/index.html',
    'vendor/pq': 'page/vendor/pq_view',
    'vendor/history': 'page/vendor/history',
    // ====== PostQ ======
    'postq/manage': 'page/postq/manage',
  },
  permissions: {
    'admin/dashboard': ['Admin'],
    'admin/settings': ['Admin'],
    'admin/user/manage': ['Admin'],
    'admin/role/manage': ['Admin'],
    'admin/staff/manage': ['Admin'],
    'admin/department/manage': ['Admin'],
    'admin/project/owner/manage': ['Admin'],
    'project/manage': ['Admin', 'PRC', 'CC_PRC', 'Member', 'Moderator'],
    'package/manage': ['Admin', 'PRC', 'CC_PRC'],
    'vendor/manage': ['Admin', 'PRC', 'CC_PRC'],
    'vendor/pq': ['Admin', 'PRC', 'CC_PRC'],
    'vendor/history': ['Admin', 'PRC', 'CC_PRC'],
    'postq/manage': ['Admin', 'PRC', 'CC_PRC'], 
  },
  titles: {
    'admin/dashboard': "แผงควบคุมผู้ดูแลระบบ",
    'admin/settings': 'ตั้งค่าเว็บไซต์',
    'admin/user/manage': 'จัดการสิทธิ์ผู้ใช้',
    'admin/role/manage': 'จัดการ Role และสิทธิ์',
    'admin/staff/manage': 'จัดการข้อมูลพนักงาน',
    'admin/department/manage': 'จัดการฝ่ายและแผนก',
    'admin/project/owner/manage': "จัดการข้อมูลเจ้าของโครงการ",
    'project/manage': "ข้อมูลโครงการ (Projects)",
    'dashboard': "แดชบอร์ด",
    'home': "Home",
    'login': "Login",
    'register': "Create a new account",
    'profile': "โปรไฟล์ของฉัน",
    'forgot-password': "ลืมรหัสผ่าน",
    'reset-password': "ตั้งรหัสผ่านใหม่",
    'accessDenied': "ไม่มีสิทธิ์เข้าถึง",
    // ====== Package ======
    'package/manage': "จัดการประเภทพัสดุ",
    // ====== Vendor ======
    'vendor/manage': "จัดการข้อมูลคู่ค้า (Vendor)",
    'vendor/pq': "แบบประเมินคู่ค้า",
    'vendor/history': "ประวัติการประเมินคู่ค้า",
    // ====== PostQ ======
    'postq/manage': "ระบบประเมินหลังรับงาน (Post-Qualification)",
  }
};

// 1.4 การตั้งค่าเริ่มต้นของเว็บไซต์
const SITE_DEFAULTS = {
  defaultAppName: "SUPHARK",
  defaultFooterText: "&copy; 2025 Suphark. All rights reserved.",
};

const SECURITY_CONFIG = {
  minPasswordLength: 6,
  roles: {
    ADMIN: 'Admin',
    PRC: 'PRC',
    CC: 'CC',
    CC_PRC: 'CC_PRC',
    MODERATOR: 'Moderator',
    MEMBER: 'Member',
    GUEST: 'Guest',
    BANNED: 'Banned',

  },
  packageOwnerRoles: ['Admin', 'PRC', 'CC_PRC'],
  register: {
    email: {
      endWith: '', // ใส่ @ และตามด้วย domain name หรือถ้าไม่ต้องการให้มีการเช็ค ก็ใส่ ''
    }
  }
};


// ================== ส่วนที่ 2: สร้างส่วนที่มี Dependency ==================

// 2.1 Generator Function ที่รับค่าที่จำเป็นเข้าไปตรงๆ (Dependency Injection)
function buildSheetsData(sheetDefs, databases) {
  const dataLayer = {};
  sheetDefs.forEach(def => {
    const dbId = databases[def.db];
    if (!dbId) {
      throw new Error(`Database key "${def.db}" not found`);
    }
    const key = def.name.charAt(0).toLowerCase() + def.name.slice(1);
    dataLayer[key] = {
      name: def.name,
      getTable: () => sheetQuery(dbId).from(def.name),
      getRawSheet: () => SpreadsheetApp.openById(dbId).getSheetByName(def.name)
    };
  });
  return dataLayer;
}

// 2.2 เรียกใช้ Generator โดยส่งค่าที่จำเป็นเข้าไป
const SHEETS_DATA = buildSheetsData(SHEET_DEFINITIONS, GOOGLE_SERVICES.sheets.databases);


// ================== ส่วนที่ 3: ประกอบร่างเป็น APP_CONFIG สุดท้าย ==================

const APP_CONFIG = {
  googleServices: GOOGLE_SERVICES,
  site: SITE_DEFAULTS,
  security: SECURITY_CONFIG,
  sheetsData: SHEETS_DATA,
  routing: ROUTING_CONFIG
};

