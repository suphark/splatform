/**
 * @file mod/vendor/controller.js
 */


/**
 * [REVISED] ดึงข้อมูล Vendor แบบแบ่งหน้า พร้อมตรวจสอบความสัมพันธ์
 */
function getPaginatedVendors(options = {}) {
    try {
        // 1. ดึงข้อมูลหลักทั้งหมด (caching จะช่วยลดการโหลดซ้ำ)
        const allVendors = getAllVendors();
        const allStatuses = getAllVendorStatuses();
        const allPackages = getAllPackages();
        const allBoardMembers = getAllBoardMembers();
        const allStaffs = getAllStaffs();

        // --- [NEW] ดึงข้อมูลการประเมินทั้งหมด เรียงจากล่าสุดไปเก่าสุด ---
        const allPqForms = APP_CONFIG.sheetsData.pQForms.getTable().sortBy('EvaluationDate', 'desc').getRows();
        // --- [NEW] สร้าง Map เพื่อเก็บเกรดล่าสุดของแต่ละ Vendor ---
        const latestGradeMap = new Map();
        allPqForms.forEach(form => {
            // เนื่องจากข้อมูลเรียงจากล่าสุดแล้ว รายการแรกที่เจอของแต่ละ Vendor คือรายการล่าสุด
            if (form.VendorId && !latestGradeMap.has(form.VendorId)) {
                latestGradeMap.set(form.VendorId, form.Grade);
            }
        });


        // 2. สร้าง Lookup Tables เพื่อการ Join ข้อมูลที่รวดเร็ว
        const statusMap = new Map(allStatuses.map(s => [s.Id, s]));
        const packageMap = new Map(allPackages.map(p => [p.Id, p]));
        
        // [NEW] สร้าง Map ของนามสกุลพนักงานเพื่อการตรวจสอบที่รวดเร็ว
        const staffSurnameMap = new Map();
        allStaffs.forEach(staff => {
            if (staff.SurnameThai && staff.SurnameThai.trim() !== '') {
                const surname = staff.SurnameThai.trim();
                if (!staffSurnameMap.has(surname)) {
                    staffSurnameMap.set(surname, []);
                }
                staffSurnameMap.get(surname).push(`${staff.NameThai} ${staff.SurnameThai}`);
            }
        });

        // 3. Join ข้อมูลและตรวจสอบความสัมพันธ์
        const joinedVendors = allVendors.map(vendor => {
            const statusInfo = statusMap.get(vendor.StatusId) || { name: 'N/A', color: 'badge-dark' };
            const packageIds = vendor.PackageId ? String(vendor.PackageId).split(',') : [];
            const packageDisplayNames = packageIds.map(id => (packageMap.get(id.trim())?.NameThai || id.trim()));
            const vendorBoardMembers = allBoardMembers.filter(m => m.VendorId === vendor.Id);
            const relationshipMessages = [];
            vendorBoardMembers.forEach(member => {
                if (member.Surname && staffSurnameMap.has(member.Surname.trim())) {
                    const staffList = staffSurnameMap.get(member.Surname.trim()).join(', ');
                    relationshipMessages.push(`กรรมการ '${member.Name} ${member.Surname}' มีนามสกุลตรงกับพนักงาน: ${staffList}`);
                }
            });

            return { 
                ...vendor, 
                StatusName: statusInfo.Name, 
                StatusColor: statusInfo.BadgeColor || 'badge-light', 
                PackageDisplayNames: packageDisplayNames,
                RelationshipInfo: relationshipMessages.join(' \n'), // ใช้ \n สำหรับขึ้นบรรทัดใหม่ใน tooltip
                LatestGrade: latestGradeMap.get(vendor.Id) || '-',
            };
        });

        // 4. กรองและแบ่งหน้า (เหมือนเดิม)
        let filteredDataSource = joinedVendors;
        if (options.searchTerm) { /* ... โค้ดกรอง searchTerm เดิม ... */ }
        if (options.statusId) { /* ... โค้ดกรอง statusId เดิม ... */ }
        if (options.packageId) { /* ... โค้ดกรอง packageId เดิม ... */ }
        
        const config = {
            dataSource: filteredDataSource,
            pagination: options,
            sort: { column: options.sortColumn || 'Id', direction: options.sortDirection || 'desc' },
            filters: [] 
        };
        const result = getPaginatedData(config);

        return {
            success: true,
            vendors: result.data,
            totalRecords: result.totalRecords,
            totalPages: result.totalPages,
            currentPage: result.currentPage
        };
    } catch (e) {
        Logger.log('Error in getPaginatedVendors: ' + e.toString() + "\n" + e.stack);
        return { success: false, message: e.message };
    }
}

/**
 * [REVISED] ปรับปรุงการประมวลผลการเพิ่ม/แก้ไข Vendor ทั้งหมด
 * ให้เรียกใช้ Drive Service ตัวใหม่เพื่อจัดการไฟล์และโฟลเดอร์ย่อย
 */
function processAddOrEditVendor(formData, fileData) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        if (isVendorNameExists(formData.NameThai, formData.NameEnglish, formData.Id)) {
            return { success: false, message: 'ชื่อภาษาไทยหรือภาษาอังกฤษนี้มีอยู่ในระบบแล้ว' };
        }

        const isEditMode = !!formData.Id;
        let vendorFolderId = formData.FolderId || null;

        // --- [CRITICAL CHANGE] จุดเปลี่ยนสำคัญ ---
        // 1. ตรวจสอบว่ามีไฟล์แนบมาหรือไม่ และเรียกใช้ Service ใหม่เพื่ออัปโหลดและจัดระเบียบไฟล์
        if (fileData && Object.keys(fileData).length > 0) {
            const uploadResult = uploadAndOrganizeVendorFiles(vendorFolderId, formData.NameThai, fileData);
            
            // 2. อัปเดต FolderId และ File Ids ที่ได้จากการอัปโหลดกลับเข้าไปใน formData
            vendorFolderId = uploadResult.folderId;
            formData.FolderId = vendorFolderId;
            Object.assign(formData, uploadResult.uploadedFileIds);

        }

        if (isEditMode) {
            // --- โหมดแก้ไข ---
            const oldVendorData = findVendorById(formData.Id);
            if (!oldVendorData) throw new Error("ไม่พบข้อมูล Vendor ที่จะแก้ไข");

            // เปลี่ยนชื่อโฟลเดอร์หลักถ้าชื่อ Vendor ถูกแก้ไข และมี FolderId อยู่แล้ว
            if (oldVendorData.NameThai !== formData.NameThai && vendorFolderId) {
                // ฟังก์ชันนี้ควรจะอยู่ใน drive_storage.js หรือ mod_vendor_drive_service.gs
                renameVendorFolder(vendorFolderId, formData.NameThai); 
            }

            updateVendorById(formData.Id, formData);
            writeAuditLog('Vendor: Edit', `ID: ${formData.Id}, Name: ${formData.NameThai}`);
        } else {
            // --- โหมดเพิ่มใหม่ ---
            // formData มี FolderId และ File Ids จากขั้นตอนข้างบนอยู่แล้ว
            const newVendorId = addNewVendorAndGetId(formData);
            writeAuditLog('Vendor: Create', `ID: ${newVendorId}, Name: ${formData.NameThai}`);
        }

        return { success: true, message: 'บันทึกข้อมูล Vendor สำเร็จ!' };

    } catch (e) {
        Logger.log(`Vendor Processing Error: ${e.toString()}\nStack: ${e.stack}`);
        return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึก: ' + e.message };
    } finally {
        lock.releaseLock();
    }
}


/**
 * [UPDATED] ประมวลผลการลบ Vendor
 */
function processDeleteVendor(vendorId) {
    try {
        // 1. ค้นหาข้อมูล Vendor เพื่อเอา FolderId
        const vendorToDelete = findVendorById(vendorId);

        // 2. ลบข้อมูลในชีต
        deleteVendorById(vendorId);

        // 3. ลบโฟลเดอร์ใน Drive (ถ้ามี FolderId)
        if (vendorToDelete && vendorToDelete.FolderId) {
            deleteVendorFolder(vendorToDelete.FolderId);
        }

        writeAuditLog('Vendor: Delete', `ID: ${vendorId}`);
        return { success: true, message: 'ลบข้อมูล Vendor สำเร็จ' };
    } catch (e) {
        Logger.log('Error in processDeleteVendor: ' + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาดในการลบ: ' + e.message };
    }
}


/**
 * [SERVER-CALL] ดึงข้อมูลรายละเอียดของ Vendor รายเดียวตาม ID
 * @param {string} vendorId - ID ของ Vendor ที่ต้องการ
 * @returns {object} ข้อมูล Vendor หรือ null ถ้าไม่พบ
 */
function getVendorDetailsById(vendorId) {
    try {
        const vendor = APP_CONFIG.sheetsData.vendors.getTable().where(row => row.Id === vendorId).getRows()[0];
        if (!vendor) {
            throw new Error("ไม่พบข้อมูล Vendor ID: " + vendorId);
        }
        // แปลง PackageId ที่เป็น string กลับเป็น array เพื่อให้ง่ายต่อการใช้งานในหน้าเว็บ
        if (vendor.PackageId && typeof vendor.PackageId === 'string') {
            vendor.PackageId = vendor.PackageId.split(',').map(id => id.trim());
        } else if (!vendor.PackageId) {
            vendor.PackageId = []; // ทำให้เป็น array ว่างถ้าไม่มีข้อมูล
        }
        return vendor;
    } catch (e) {
        Logger.log('Error in getVendorDetailsById: ' + e.message);
        // ส่งกลับเป็น null หรือโยน error เพื่อให้ client จัดการ
        return null;
    }
}


/**
 * ฟังก์ชันสำหรับทดสอบการทำงานของ getPaginatedVendors โดยเฉพาะ
 */
function testVendorPagination() {
    try {
        // ทดลองเรียกใช้ฟังก์ชันโดยตรง
        const result = getPaginatedVendors({ page: 1, limit: 5 });

        // แสดงผลลัพธ์ใน Log
        Logger.log(JSON.stringify(result, null, 2));

    } catch (e) {
        Logger.log("Error running test: " + e.toString());
    }
}

// เพิ่มฟังก์ชันใหม่นี้เข้าไปด้วย เพื่อให้ getPaginatedVendors เรียกใช้ได้
function getAllBoardMembers() {
    try {
        return APP_CONFIG.sheetsData.vendorBoardMembers.getTable().getRows();
    } catch(e) {
        Logger.log('Error in getAllBoardMembers: ' + e.message);
        return [];
    }
}

