/**
 * @file mod/vendor/controller.js
 */


/**
 * [FINAL & STABLE] ดึงข้อมูล Vendor แบบแบ่งหน้า พร้อมการกรอง, ค้นหา, และเรียงลำดับ
 * - กลับมาใช้ Logic การกรองด้วยตัวเองก่อนส่งเข้า Pagination Engine ซึ่งเป็นวิธีที่เสถียรที่สุด
 * และแก้ปัญหาการเรียงลำดับข้อมูล (sort) ได้อย่างถาวร
 */
function getPaginatedVendors(options = {}) {
    try {

        // 1. ดึงข้อมูลดิบและ Join ข้อมูล (เหมือนเดิม)
        const allVendors = getAllVendors();
        const allStatuses = getAllVendorStatuses();
        const allPackages = getAllPackages();

        const statusMap = allStatuses.reduce((map, status) => {
            map[status.Id] = { name: status.Name, color: status.BadgeColor || 'badge-light' };
            return map;
        }, {});

        const packageMap = allPackages.reduce((map, pkg) => {
            map[pkg.Id] = { nameThai: pkg.NameThai, nameEnglish: pkg.NameEnglish || '' };
            return map;
        }, {});

        const joinedVendors = allVendors.map(vendor => {
            const statusInfo = statusMap[vendor.StatusId] || { name: 'N/A', color: 'badge-dark' };
            const packageIds = vendor.PackageId ? String(vendor.PackageId).split(',') : [];
            const packageDisplayNames = packageIds
                .map(id => {
                    const pkg = packageMap[id.trim()];
                    if (pkg) { return `${pkg.nameThai}${pkg.nameEnglish ? ' | ' + pkg.nameEnglish : ''}`; }
                    return id.trim();
                });

            return { ...vendor, StatusName: statusInfo.name, StatusColor: statusInfo.color, PackageDisplayNames: packageDisplayNames };
        });

        // --- 2. [ส่วนที่แก้ไข] กรองข้อมูลด้วยตัวเองก่อนส่งไปแบ่งหน้า (Manual Filtering) ---
        let filteredDataSource = joinedVendors;

        // กรองด้วยคำค้นหา (Search Term) แบบ OR
        if (options.searchTerm) {
            const term = options.searchTerm.toLowerCase();
            filteredDataSource = filteredDataSource.filter(v => {
                const nameThai = (v.NameThai || '').toLowerCase();
                const nameEnglish = (v.NameEnglish || '').toLowerCase();
                return nameThai.includes(term) || nameEnglish.includes(term);
            });
        }

        // กรองด้วยสถานะ (Status)
        if (options.statusId) {
            filteredDataSource = filteredDataSource.filter(v => v.StatusId === options.statusId);
        }

        // กรองด้วยประเภทพัสดุ (Package)
        if (options.packageId) {
            filteredDataSource = filteredDataSource.filter(v => (v.PackageId || '').includes(options.packageId));
        }
        // --- สิ้นสุดส่วนที่แก้ไข ---


        // 3. ส่งข้อมูลที่กรองแล้วไปให้ Pagination Engine จัดการแค่การเรียงลำดับและแบ่งหน้า
        const config = {
            dataSource: filteredDataSource, // << ใช้ข้อมูลที่ผ่านการกรองแล้ว
            pagination: options,
            sort: {
                column: options.sortColumn || 'Id',
                direction: options.sortDirection || 'desc',
            },
            filters: [] // << ส่ง Array ว่างเข้าไปเสมอ
        };

        const result = getPaginatedData(config);

        // 4. ส่งผลลัพธ์กลับ (เหมือนเดิม)
        return {
            vendors: result.data,
            totalRecords: result.totalRecords,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            success: true
        };
    } catch (e) {
        Logger.log('Error in getPaginatedVendors: ' + e.toString());
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



