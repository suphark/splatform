// file: mod_package_controller.gs


/**
 * [SERVER-CALL] ดึงรายชื่อ Owner ที่ไม่ซ้ำกันจากชีต Packages
 * เพื่อใช้สร้าง Filter Dropdown
 * @returns {Array<string>}
 */
function getDistinctPackageOwners() {
    const allPackages = getAllPackages();
    const owners = allPackages.map(p => p.Owner).filter(Boolean); // ดึง Owner ทั้งหมดและตัดค่าว่างออก
    return [...new Set(owners)].sort(); // คืนค่าที่ไม่ซ้ำกันและเรียงตามตัวอักษร
}

/**
 * [FINAL UPGRADE] แก้ไข Logic การ Filter ให้ถูกต้อง สามารถกรองและค้นหาพร้อมกันได้
 * และยังคงแสดงผล Parent ของทุกรายการที่ค้นเจอ
 */
function getHierarchicalPackages(options = {}) {
    const searchTerm = (options.searchTerm || '').toLowerCase().trim();
    const ownerEmail = options.ownerEmail || '';
    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 10;

    try {
        const allPackages = getAllPackages();
        if (!allPackages || allPackages.length === 0) {
            return { success: true, data: [], totalRecords: 0, totalPages: 1, currentPage: 1 };
        }

        // --- เริ่ม Logic การกรองและค้นหาที่ถูกต้อง ---

        // 1. กรองข้อมูลเบื้องต้นตามเงื่อนไขทั้งหมด (ยังไม่หา Parent)
        let filteredList = allPackages;

        if (ownerEmail) {
            filteredList = filteredList.filter(pkg => pkg.Owner === ownerEmail);
        }

        if (searchTerm) {
            filteredList = filteredList.filter(pkg => {
                const nameThai = String(pkg.NameThai || '').toLowerCase();
                const nameEnglish = String(pkg.NameEnglish || '').toLowerCase();
                const description = String(pkg.Description || '').toLowerCase();
                return nameThai.includes(searchTerm) || 
                       nameEnglish.includes(searchTerm) || 
                       description.includes(searchTerm);
            });
        }
        
        // 2. ถ้ามีการกรองเกิดขึ้น ให้หารายการแม่ของผลลัพธ์ทั้งหมด
        let packagesToBuildTreeFrom = allPackages;
        if (ownerEmail || searchTerm) {
            const packageLookup = new Map(allPackages.map(p => [p.Id, p]));
            const finalPackageIds = new Set();

            filteredList.forEach(pkg => {
                let current = pkg;
                while (current) {
                    finalPackageIds.add(current.Id);
                    current = current.ParentId ? packageLookup.get(current.ParentId) : null;
                }
            });
            packagesToBuildTreeFrom = allPackages.filter(p => finalPackageIds.has(p.Id));
        }
        
        // --- จบ Logic การกรองและค้นหา ---

        // 3. สร้าง Tree และแบ่งหน้าจากข้อมูลชุดสุดท้าย (เหมือนเดิม)
        const packageLookupForTree = new Map(packagesToBuildTreeFrom.map(p => [p.Id, p]));
        const rootPackages = packagesToBuildTreeFrom.filter(pkg => !pkg.ParentId || String(pkg.ParentId).trim() === '' || !packageLookupForTree.has(pkg.ParentId));
        
        const totalRecords = rootPackages.length;
        const totalPages = Math.ceil(totalRecords / limit) || 1;
        const offset = (page - 1) * limit;
        const paginatedRoots = rootPackages.slice(offset, offset + limit);

        const buildTree = (roots) => {
            return roots.map(root => {
                const children = packagesToBuildTreeFrom.filter(child => child.ParentId === root.Id);
                return { ...root, children: buildTree(children) };
            });
        };
        const finalTree = buildTree(paginatedRoots);

        return {
            success: true,
            data: finalTree,
            totalRecords: totalRecords,
            totalPages: totalPages,
            currentPage: page
        };

    } catch (e) {
        Logger.log("ERROR in getHierarchicalPackages: " + e.message + " Stack: " + e.stack);
        return { success: false, message: e.message };
    }
}


/**
 * [REVISED] ประมวลผลการเพิ่ม Package ใหม่
 */
function processAddNewPackage(formData) {
    try {
        // const session = checkUserSession(); <-- ไม่ต้องใช้แล้ว
        // formData.Owner = session.email; // <-- [REMOVE THIS LINE] ลบบรรทัดนี้ออก
        
        const allPackages = getAllPackages();
        formData.FullFolderName = _calculateFullFolderName(formData, allPackages);

        addNewPackage(formData);
        writeAuditLog('Package: Create', `Name: ${formData.NameThai}, Owner: ${formData.Owner}`);
        return { success: true, message: 'เพิ่มประเภทพัสดุสำเร็จ!' };
    } catch (e) {
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [REVISED] ประมวลผลการแก้ไข Package และ return object ที่อัปเดตแล้วกลับไป
 */
function processEditPackage(formData) {
    try {
        const allPackages = getAllPackages();

        formData.FullFolderName = _calculateFullFolderName(formData, allPackages); // [ADD THIS]

        updatePackageById(formData.Id, formData);
        writeAuditLog('Package: Edit', `ID: ${formData.Id}, Name: ${formData.NameThai}`);
        return { success: true, message: 'แก้ไขประเภทพัสดุสำเร็จ!' };
    } catch (e) {
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [SERVER-CALL] ประมวลผลการลบ Package
 */
function processDeletePackage(packageId) {
    try {
        // ตรวจสอบว่ามี Package ลูกหรือไม่
        const allPackages = getAllPackages();
        const hasChildren = allPackages.some(pkg => pkg.ParentId === packageId);
        if (hasChildren) {
            return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากมีประเภทย่อยอยู่' };
        }
        
        const pkgToDelete = allPackages.find(p => p.Id === packageId);
        deletePackageById(packageId);
        writeAuditLog('Package: Delete', `ID: ${packageId}, Name: ${pkgToDelete.NameThai}`);
        return { success: true, message: 'ลบประเภทพัสดุสำเร็จ!' };
    } catch (e) {
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [HELPER] คำนวณ FullFolderName จากข้อมูล Parent
 */
function _calculateFullFolderName(formData, allPackages) {
    if (!formData.ParentId) {
        return formData.FolderName; // ถ้าเป็น Level 1, FullFolderName คือชื่อตัวเอง
    }
    
    const parent = allPackages.find(p => p.Id === formData.ParentId);
    if (!parent || !parent.FullFolderName) {
        return formData.FolderName; // ถ้าหา parent ไม่เจอ หรือ parent ไม่มี path
    }

    return `${parent.FullFolderName}_${formData.FolderName}`;
}

/**
 * [SERVER-CALL] ดึงข้อมูล Package ทั้งหมดเพื่อใช้ในการสร้างตัวเลือกในฟอร์ม
 * @returns {Array<{Id: string, NameThai: string}>} ข้อมูล Package ที่มีเฉพาะ Id และ NameThai
 */
function getAllPackagesForSelection() {
  try {
    const allPackages = getAllPackages(); // ใช้ฟังก์ชันเดิมที่เรามีอยู่
    return allPackages.map(pkg => {
      const displayText = pkg.NameEnglish
        ? `${pkg.NameThai} | ${pkg.NameEnglish}`
        : pkg.NameThai;
      return {
        Id: pkg.Id,
        DisplayName: displayText // เปลี่ยนจาก NameThai เป็น DisplayName
      };
    });
  } catch (e) {
    // ในกรณีที่เกิดข้อผิดพลาด ให้โยน error ออกไปเพื่อให้ฝั่ง Client รับรู้
    throw new Error('ไม่สามารถดึงข้อมูลประเภทพัสดุได้: ' + e.message);
  }
}





