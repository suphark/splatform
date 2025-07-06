/**
 *  @file mod/user/database.js
 */

function findRoleById(roleId) {
  if (!roleId) return null;
  return APP_CONFIG.sheetsData.roles.getTable().where(row => row.Id === roleId).first();
}

function countTotalRoles() {
return APP_CONFIG.sheetsData.roles.getTable().count();
}

function getAllRoles() {
  return APP_CONFIG.sheetsData.roles.getTable().getRows();
}

function addNewRole(roleData) {
  APP_CONFIG.sheetsData.roles.getTable()
    .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'R-' })
    .insertRows([
      {
        Name: roleData.Name,
        BadgeColor: roleData.BadgeColor,
        Description: roleData.Description || ''
      }
    ]);
}

function updateRoleById(roleId, roleData) {
  APP_CONFIG.sheetsData.roles.getTable().where(row => row.Id === roleId).updateRows(row => {
    row.Name = roleData.Name;
    row.BadgeColor = roleData.BadgeColor;
    row.Description = roleData.Description || '';
    return row; // <-- เพิ่มบรรทัดนี้
  });
}

function deleteRoleById(roleId) {
  APP_CONFIG.sheetsData.roles.getTable().where(row => row.Id === roleId).deleteRows();
}