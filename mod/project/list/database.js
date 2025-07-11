/**
 * @file mod/project/list/database.js
 */


function getProjectsTable() {
    return APP_CONFIG.sheetsData.projects.getTable();
}

function getProvinces() {
    return APP_CONFIG.sheetsData.provinces.getTable().getRows();
}

// [NEW & FIXED] แก้ไขฟังก์ชันสำหรับดึงข้อมูลจากชีต ProjectStatuses
function getProjectStatusTable() {
    // Key 'projectStatuses' ถูกสร้างขึ้นโดยอัตโนมัติจากชื่อชีต 'ProjectStatuses' ใน config
    return APP_CONFIG.sheetsData.projectStatuses.getTable(); 
}

function getAllProjectStatuses() {
    return getProjectStatusTable().getRows();
}


function getPaginatedProjects(options = {}) {
    try {
        const allProjects = getProjectsTable().getRows();
        const projectTypes = getAllProjectTypes();
        const projectOwners = getAllProjectOwners();
        const projectStatuses = getAllProjectStatuses(); // ดึงข้อมูลสถานะ
        const provinces = getProvinces();

        const typeMap = new Map(projectTypes.map(t => [t.Id, t.Name]));
        const ownerMap = new Map(projectOwners.map(o => [o.Id, o.NameThai]));
        // [NEW] สร้าง Map สำหรับสถานะ โดยเก็บทั้ง Object เพื่อเอาสีไปด้วย
        const statusMap = new Map(projectStatuses.map(s => [s.Id, s])); 
        
        // 1. Join data
        let processedData = allProjects.map(p => {
            const typeIds = p.ProjectTypeId ? String(p.ProjectTypeId).split(',') : [];
            const typeNames = typeIds.map(id => typeMap.get(id.trim()) || id).join(', ');
            const statusInfo = statusMap.get(p.StatusId); // ใช้ StatusId ในการ join

            return {
                ...p,
                ProjectTypeName: typeNames,
                ProjectOwnerName: ownerMap.get(p.ProjectOwnerId) || '-',
                StatusName: statusInfo ? statusInfo.Name : p.StatusId,
                StatusBadgeColor: statusInfo ? statusInfo.BadgeColor : 'badge-secondary' 
            };
        });

        // 2. Filters
        const filters = [];
        if (options.searchTerm) {
            filters.push({ field: 'NameThai', operator: 'contains', value: options.searchTerm, logic: 'or' });
            filters.push({ field: 'NameEnglish', operator: 'contains', value: options.searchTerm, logic: 'or' });
            filters.push({ field: 'Nickname', operator: 'contains', value: options.searchTerm, logic: 'or' });
            filters.push({ field: 'Remark', operator: 'contains', value: options.searchTerm, logic: 'or' }); // [NEW] ค้นหาใน Remark
        }
        if (options.projectTypeId) {
            filters.push({ field: 'ProjectTypeId', operator: 'contains', value: options.projectTypeId });
        }
        if (options.projectOwnerId) {
            filters.push({ field: 'ProjectOwnerId', operator: 'equals', value: options.projectOwnerId });
        }
        if (options.status) {
            filters.push({ field: 'StatusId', operator: 'equals', value: options.status }); // [FIXED] กรองจาก StatusId
        }
        if (options.province) {
            filters.push({ field: 'Province', operator: 'equals', value: options.province });
        }

        // 3. Paginate
        const config = {
            dataSource: processedData,
            pagination: options,
            sort: { column: options.sortColumn || 'Id', direction: options.sortDirection || 'desc' },
            filters: filters
        };
        return getPaginatedData(config);
    } catch (e) {
        Logger.log(`Error in getPaginatedProjects: ${e.message}\n${e.stack}`);
        return { success: false, message: e.message, data: [] };
    }
}

/**
 * [NEW] ค้นหาโครงการด้วย ID
 * @param {string} id - ID ของโครงการ
 * @returns {object|null} ข้อมูลโครงการ หรือ null ถ้าไม่พบ
 */
function findProjectById(id) {
    if (!id) return null;
    const table = getProjectsTable();
    const project = table.where(p => p.Id === id).first();
    table.clearAll(); // เคลียร์ Builder และ Cache หลังใช้งาน
    return project;
}

function addNewProject(data) {
    getProjectsTable()
        .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'PRJ-' })
        .insertRows([data]);
}

function updateProjectById(id, data) {
    data.ModifiedDate = new Date();
    getProjectsTable().where(row => row.Id === id).updateRows(row => ({ ...row, ...data }));
}

function deleteProjectById(id) {
    getProjectsTable().where(row => row.Id === id).deleteRows();
}

