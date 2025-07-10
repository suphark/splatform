/**
 * @file mod/project/owner/database.js
 */


function getProjectOwnersTable() {
    return APP_CONFIG.sheetsData.projectOwners.getTable();
}

/**
 * @param {object} options - Pagination, filter, and sort options.
 * @returns {object} Paginated data object.
 */
function getPaginatedProjectOwners(options = {}) {
    try {
        const allOwners = getProjectOwnersTable().getRows();
        const companyTypes = getAllCompanyTypes(); // From master_data/controller
        const typeMap = new Map(companyTypes.map(t => [t.Id, t.Name]));

        // 1. Join ข้อมูลประเภทบริษัท
        let processedData = allOwners.map(owner => ({
            ...owner,
            CompanyTypeName: typeMap.get(owner.CompanyTypeId) || '-'
        }));

        // 2. สร้างเงื่อนไขการกรอง
        const filters = [];
        if (options.searchTerm) {
            filters.push({
                field: 'NameThai', operator: 'contains', value: options.searchTerm, logic: 'or'
            });
            filters.push({
                field: 'NameEnglish', operator: 'contains', value: options.searchTerm, logic: 'or'
            });
            filters.push({
                field: 'Nickname', operator: 'contains', value: options.searchTerm, logic: 'or'
            });
        }
        if (options.companyTypeId) {
            filters.push({
                field: 'CompanyTypeId', operator: 'equals', value: options.companyTypeId
            });
        }
        if (options.isLargeCompany) {
            filters.push({
                field: 'IsLargeCompany', operator: 'equals', value: options.isLargeCompany
            });
        }

        // 3. เรียกใช้ฟังก์ชันแบ่งหน้ากลาง
        const config = {
            dataSource: processedData,
            pagination: options,
            sort: {
                column: options.sortColumn || 'Id',
                direction: options.sortDirection || 'asc'
            },
            filters: filters
        };

        return getPaginatedData(config);

    } catch (e) {
        Logger.log(`Error in getPaginatedProjectOwners: ${e.message}\n${e.stack}`);
        return { success: false, message: e.message, data: [] };
    }
}

function findProjectOwnerById(id) {
    if (!id) return null;
    return getProjectOwnersTable().where(row => row.Id === id).first();
}

function addNewProjectOwner(data) {
    getProjectOwnersTable()
        .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'PJO-' })
        .insertRows([data]);
}

function updateProjectOwnerById(id, data) {
    getProjectOwnersTable()
        .where(row => row.Id === id)
        .updateRows(row => ({ ...row, ...data }));
}

function deleteProjectOwnerById(id) {
    // Optional: check for dependencies in VendorProjects before deleting
    getProjectOwnersTable().where(row => row.Id === id).deleteRows();
}