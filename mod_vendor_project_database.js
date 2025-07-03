function getProjectsByVendorIdFromDB(vendorId) {
  if (!vendorId) return [];
  const table = APP_CONFIG.sheetsData.vendorProjects.getTable();
  const projects = table.where(row => row.VendorId === vendorId).getRows();
  table.clearAll();
  return projects.sort((a, b) => b.ProjectYear - a.ProjectYear);
}

function addNewProjectReference(projectData) {
    APP_CONFIG.sheetsData.vendorProjects.getTable()
        .withUniqueId('Id', { strategy: 'increment', padding: 6, prefix: 'VPR-' })
        .insertRows([projectData]);
}

function updateProjectReferenceById(projectId, data) {
    APP_CONFIG.sheetsData.vendorProjects.getTable()
        .where(row => row.Id === projectId)
        .updateRows(row => {
            for (const key in data) {
                if (Object.hasOwnProperty.call(data, key)) {
                    row[key] = data[key];
                }
            }
            return row;
        });
}

function deleteProjectReferenceById(projectId) {
    APP_CONFIG.sheetsData.vendorProjects.getTable()
        .where(row => row.Id === projectId)
        .deleteRows();
}