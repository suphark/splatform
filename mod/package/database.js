/**
 * @file mod/package/controller.js
 */


/**
 * [REVISED] ดึงข้อมูล Package ทั้งหมดจากชีต โดยเรียกใช้ Utility ใหม่
 * @returns {Array<RowObject>}
 */
function getAllPackages() {
    const table = APP_CONFIG.sheetsData.packages.getTable();
    const packages = table.getRows();
    table.clearDataCache().clearBuilder();
    return packages;
}

/**
 * เพิ่ม Package ใหม่ลงในชีต (ยังคงใช้ SheetQuery เพราะทำงานได้ดี)
 * @param {object} data - ข้อมูล Package ที่จะเพิ่ม
 */
function addNewPackage(data) {
    APP_CONFIG.sheetsData.packages.getTable()
        .withUniqueId('Id', { strategy: 'increment', padding: 4, prefix: 'PKG-' })
        .insertRows([{
            NameThai: data.NameThai,
            NameEnglish: data.NameEnglish,
            FolderName: data.FolderName || '',
            FullFolderName: data.FullFolderName || '', // [ADD THIS]
            Description: data.Description || '',
            Owner: data.Owner,
            ParentId: data.ParentId || null,
            CreateDate: new Date(),
            ModifiedDate: new Date()
        }]);
}

/**
 * อัปเดตข้อมูล Package ตาม Id (ยังคงใช้ SheetQuery)
 * @param {string} packageId - Id ของ Package ที่จะอัปเดต
 * @param {object} data - ข้อมูลใหม่
 */
function updatePackageById(packageId, data) {
    APP_CONFIG.sheetsData.packages.getTable()
        .where(row => row.Id === packageId)
        .updateRows(row => {
            row.NameThai = data.NameThai;
            row.NameEnglish = data.NameEnglish;
            row.FolderName = data.FolderName || '';
            row.FullFolderName = data.FullFolderName || ''; // [ADD THIS]
            row.Description = data.Description || '';
            row.Owner = data.Owner;
            row.ParentId = data.ParentId || null;
            row.ModifiedDate = new Date();
            return row;
        });
}

/**
 * ลบ Package ตาม Id (ยังคงใช้ SheetQuery)
 * @param {string} packageId - Id ของ Package ที่จะลบ
 */
function deletePackageById(packageId) {
    APP_CONFIG.sheetsData.packages.getTable()
        .where(row => row.Id === packageId)
        .deleteRows();
}

/**
 * นับจำนวน Package ทั้งหมด (ยังคงใช้ SheetQuery)
 * @returns {number}
 */
function countTotalPackages() {
    const table = APP_CONFIG.sheetsData.packages.getTable();
    const count = table.count();
    table.clearDataCache().clearBuilder();
    return count;
}