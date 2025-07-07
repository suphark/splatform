/**
 * @file mod/department/database.js
 * @description Data access layer สำหรับฝ่ายและแผนก
 */

function getDepartmentsTable() {
    return APP_CONFIG.sheetsData.departments.getTable();
}

function getAllDepartments() {
    const table = getDepartmentsTable();
    const depts = table.sortBy('Name', 'asc').getRows();
    table.clearAll();
    return depts;
}

function findDepartmentById(id) {
    if (!id) return null;
    const table = getDepartmentsTable();
    const dept = table.where(d => d.Id === id).first();
    table.clearAll();
    return dept;
}

function addNewDepartment(data) {
    getDepartmentsTable()
        .withUniqueId('Id', { strategy: 'increment', padding: 4, prefix: 'ORG-' })
        .insertRows([{
            Name: data.Name,
            Description: data.Description || '',
            ParentId: data.ParentId || null,
            CreateDate: new Date(),
            ModifiedDate: new Date()
        }]);
}

function updateDepartmentById(id, data) {
    getDepartmentsTable()
        .where(row => row.Id === id)
        .updateRows(row => {
            row.Name = data.Name;
            row.Description = data.Description || '';
            row.ParentId = data.ParentId || null;
            row.ModifiedDate = new Date();
            return row;
        });
}

function deleteDepartmentById(id) {
    getDepartmentsTable().where(row => row.Id === id).deleteRows();
}