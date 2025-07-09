/**
 * @file mod/project/list/database.js
 */

/**
 * @file mod/project/database.js
 */
function getProjectsTable() {
    return APP_CONFIG.sheetsData.projects.getTable();
}

function getProvinces() {
    return APP_CONFIG.sheetsData.provinces.getTable().getRows();
}

function getPaginatedProjects(options = {}) {
    try {
        const allProjects = getProjectsTable().getRows();
        const projectTypes = getAllProjectTypes();
        const projectOwners = getAllProjectOwners();
        const provinces = getProvinces();

        const typeMap = new Map(projectTypes.map(t => [t.Id, t.Name]));
        const ownerMap = new Map(projectOwners.map(o => [o.Id, o.NameThai]));
        
        // 1. Join data
        let processedData = allProjects.map(p => {
            const typeIds = p.ProjectTypeId ? String(p.ProjectTypeId).split(',') : [];
            const typeNames = typeIds.map(id => typeMap.get(id.trim()) || id).join(', ');
            return {
                ...p,
                ProjectTypeName: typeNames,
                ProjectOwnerName: ownerMap.get(p.ProjectOwnerId) || '-'
            };
        });

        // 2. Filters
        const filters = [];
        if (options.searchTerm) {
            filters.push({ field: 'NameThai', operator: 'contains', value: options.searchTerm, logic: 'or' });
            filters.push({ field: 'NameEnglish', operator: 'contains', value: options.searchTerm, logic: 'or' });
            filters.push({ field: 'Nickname', operator: 'contains', value: options.searchTerm, logic: 'or' });
        }
        if (options.projectTypeId) {
            filters.push({ field: 'ProjectTypeId', operator: 'contains', value: options.projectTypeId });
        }
        if (options.projectOwnerId) {
            filters.push({ field: 'ProjectOwnerId', operator: 'equals', value: options.projectOwnerId });
        }
        if (options.status) {
            filters.push({ field: 'Status', operator: 'equals', value: options.status });
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