/**
 * file : mod_vendor_controller.gs
 */


/**
 * [UPDATED] ดึงข้อมูล Vendor แบบแบ่งหน้า พร้อมการกรอง, ค้นหา, และเรียงลำดับ
 */
function getPaginatedVendors(options = {}) {
    try {
        const allVendors = getAllVendors();
        const allStatuses = getAllVendorStatuses();

        const statusMap = allStatuses.reduce((map, status) => {
            map[status.Id] = { name: status.Name, color: status.BadgeColor || 'badge-light' };
            return map;
        }, {});

        const joinedVendors = allVendors.map(vendor => {
            const statusInfo = statusMap[vendor.StatusId] || { name: 'N/A', color: 'badge-dark' };
            return {
                ...vendor,
                StatusName: statusInfo.name,
                StatusColor: statusInfo.color
            };
        });

        // --- [NEW] สร้างเงื่อนไขการกรองจาก options ---
        const filters = [];
        if (options.searchTerm) {
            // ค้นหาจากทั้งชื่อไทยและอังกฤษ
            filters.push({ field: 'NameThai', operator: 'contains', value: options.searchTerm });
            filters.push({ field: 'NameEnglish', operator: 'contains', value: options.searchTerm, logic: 'or' });
        }
        if (options.statusId) {
            filters.push({ field: 'StatusId', operator: 'equals', value: options.statusId });
        }
        if (options.packageId) {
            // ค้นหา PackageId ในข้อความที่คั่นด้วย comma
            filters.push({ field: 'PackageId', operator: 'contains', value: options.packageId });
        }

        const config = {
            dataSource: joinedVendors,
            pagination: options,
            sort: { column: options.sortColumn || 'Id', direction: 'asc' },
            filters: filters // <-- ส่งเงื่อนไขการกรองเข้าไป
        };

        const result = getPaginatedData(config);

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
 * [UPDATED] ประมวลผลการเพิ่มหรือแก้ไข Vendor พร้อมการแก้ไข Bug FolderId
 */
function processAddOrEditVendor(formData, fileData) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
        // --- Validation Step ---
        if (isVendorNameExists(formData.NameThai, formData.NameEnglish, formData.Id)) {
            return { success: false, message: 'ชื่อภาษาไทยหรือภาษาอังกฤษนี้มีอยู่ในระบบแล้ว' };
        }

        const isEditMode = !!formData.Id;

        if (isEditMode) {
            // --- โหมดแก้ไข ---
            const oldVendorData = findVendorById(formData.Id);
            if (!oldVendorData) throw new Error("ไม่พบข้อมูล Vendor ที่จะแก้ไข");

            let currentFolderId = oldVendorData.FolderId;

            // 1. อัปโหลดไฟล์ (ถ้ามี)
            if (fileData && Object.keys(fileData).length > 0) {
                const result = uploadVendorFiles(currentFolderId, formData.NameThai, fileData);

                // [CRITICAL FIX] อัปเดต FolderId ที่ได้มาใหม่ และเพิ่ม File Ids เข้าไปในข้อมูลที่จะบันทึก
                currentFolderId = result.folderId;
                formData.FolderId = currentFolderId;
                Object.assign(formData, result.uploadedFileIds);
            }

            // 2. เปลี่ยนชื่อโฟลเดอร์ถ้าชื่อไม่ตรงกัน
            if (oldVendorData.NameThai !== formData.NameThai && currentFolderId) {
                renameVendorFolder(currentFolderId, formData.NameThai);
            }

            // 3. อัปเดตข้อมูลในชีต
            updateVendorById(formData.Id, formData);
            writeAuditLog('Vendor: Edit', `ID: ${formData.Id}, Name: ${formData.NameThai}`);

        } else {
            let folderId = null;
            const fileUploadResult = uploadVendorFiles(null, formData.NameThai, fileData);
            folderId = fileUploadResult.folderId;
            formData.FolderId = folderId;
            Object.assign(formData, fileUploadResult.uploadedFileIds);
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
            vendor.PackageId = vendor.PackageId.split(',');
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



