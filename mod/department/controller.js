/**
 * @file mod/department/controller.js
 * @description Controller สำหรับจัดการข้อมูลฝ่ายและแผนก (Org Units)
 */

/**
 * [SERVER-CALL] ดึงข้อมูลฝ่าย/แผนกแบบลำดับชั้น
 */
function getHierarchicalDepartments(options = {}) {
    const searchTerm = (options.searchTerm || '').toLowerCase().trim();
    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 10;

    try {
        const allDepts = getAllDepartments(); // จาก database.js
        if (!allDepts || allDepts.length === 0) {
            return { success: true, data: [], totalRecords: 0, totalPages: 1, currentPage: 1 };
        }

        let deptsToBuildTreeFrom = allDepts;

        if (searchTerm) {
            const deptLookup = new Map(allDepts.map(d => [d.Id, d]));
            const finalDeptIds = new Set();
            
            const filteredList = allDepts.filter(dept => 
                String(dept.Name || '').toLowerCase().includes(searchTerm) ||
                String(dept.Description || '').toLowerCase().includes(searchTerm)
            );

            filteredList.forEach(dept => {
                let current = dept;
                while (current) {
                    finalDeptIds.add(current.Id);
                    current = current.ParentId ? deptLookup.get(current.ParentId) : null;
                }
            });
            deptsToBuildTreeFrom = allDepts.filter(d => finalDeptIds.has(d.Id));
        }

        const deptLookupForTree = new Map(deptsToBuildTreeFrom.map(d => [d.Id, d]));
        const rootDepts = deptsToBuildTreeFrom.filter(dept => !dept.ParentId || !deptLookupForTree.has(dept.ParentId));

        const totalRecords = rootDepts.length;
        const totalPages = Math.ceil(totalRecords / limit) || 1;
        const offset = (page - 1) * limit;
        const paginatedRoots = rootDepts.slice(offset, offset + limit);

        const buildTree = (roots) => {
            return roots.map(root => {
                const children = deptsToBuildTreeFrom.filter(child => child.ParentId === root.Id);
                return { ...root, children: buildTree(children) };
            });
        };
        const finalTree = buildTree(paginatedRoots);

        return {
            success: true, data: finalTree, totalRecords: totalRecords,
            totalPages: totalPages, currentPage: page
        };
    } catch (e) {
        Logger.log("ERROR in getHierarchicalDepartments: " + e.message);
        return { success: false, message: e.message };
    }
}

/**
 * [SERVER-CALL] [HELPER] ดึงรายชื่อฝ่าย/แผนกทั้งหมดในรูปแบบ List ที่มีลำดับชั้น
 * สำหรับใช้สร้าง Dropdown
 * @returns {Array<{Id: string, DisplayName: string}>}
 */
function getHierarchicalDepartmentsList() {
    try {
        const allDepts = getAllDepartments();
        const deptMap = new Map(allDepts.map(d => [d.Id, { ...d, children: [] }]));

        const tree = [];
        allDepts.forEach(dept => {
            if (dept.ParentId && deptMap.has(dept.ParentId)) {
                deptMap.get(dept.ParentId).children.push(deptMap.get(dept.Id));
            } else {
                tree.push(deptMap.get(dept.Id));
            }
        });

        const flatList = [];
        const generateFlatList = (nodes, level = 0) => {
            nodes.sort((a,b) => a.Name.localeCompare(b.Name)).forEach(node => {
                flatList.push({
                    Id: node.Id,
                    DisplayName: '— '.repeat(level) + node.Name
                });
                if (node.children.length > 0) {
                    generateFlatList(node.children, level + 1);
                }
            });
        };

        generateFlatList(tree);
        return flatList;
    } catch (e) {
        Logger.log("Error in getHierarchicalDepartmentsList: " + e.message);
        return [];
    }
}

/**
 * [SERVER-CALL] ประมวลผลการเพิ่มข้อมูลใหม่
 */
function processAddNewDepartment(formData) {
    try {
        addNewDepartment(formData); // จาก database.js
        writeAuditLog('Department: Create', `Name: ${formData.Name}`);
        return { success: true, message: 'เพิ่มข้อมูลสำเร็จ!' };
    } catch (e) {
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [REVISED] ประมวลผลการแก้ไขข้อมูล
 * เพิ่ม Safeguard ป้องกันการกำหนด Parent ให้กับตัวเอง
 */
function processEditDepartment(formData) {
    try {
        // --- [NEW] Server-side Safeguard ---
        if (formData.Id && formData.ParentId) {
            // 1. ป้องกันการเลือกตัวเองเป็น Parent
            if (formData.Id === formData.ParentId) {
                return { success: false, message: 'ไม่สามารถกำหนดให้ตัวเองเป็นหน่วยงานแม่ได้' };
            }
            
            // 2. ป้องกันการเกิด Loop (เลือกหน่วยงานลูกของตัวเองมาเป็น Parent)
            const allDepts = getAllDepartments();
            let currentParentId = formData.ParentId;
            while (currentParentId) {
                if (currentParentId === formData.Id) {
                    return { success: false, message: 'เกิดข้อผิดพลาด: การกำหนดหน่วยงานแม่นี้จะทำให้โครงสร้างเป็น Loop' };
                }
                const parent = allDepts.find(d => d.Id === currentParentId);
                currentParentId = parent ? parent.ParentId : null;
            }
        }
        // --- End of Safeguard ---

        updateDepartmentById(formData.Id, formData); // จาก database.js
        writeAuditLog('Department: Edit', `ID: ${formData.Id}, Name: ${formData.Name}`);
        return { success: true, message: 'แก้ไขข้อมูลสำเร็จ!' };
    } catch (e) {
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [SERVER-CALL] ประมวลผลการลบข้อมูล
 */
function processDeleteDepartment(deptId) {
    try {
        const hasChildren = getAllDepartments().some(dept => dept.ParentId === deptId);
        if (hasChildren) {
            return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากมีแผนกย่อยอยู่' };
        }
        
        const deptToDelete = findDepartmentById(deptId); // จาก database.js
        deleteDepartmentById(deptId); // จาก database.js
        writeAuditLog('Department: Delete', `ID: ${deptId}, Name: ${deptToDelete.Name}`);
        return { success: true, message: 'ลบข้อมูลสำเร็จ!' };
    } catch (e) {
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}