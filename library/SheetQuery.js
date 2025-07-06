/**
 * @file library/SheetQuery.js
 * @description A powerful and flexible library for querying and manipulating Google Sheets data. 
 */

// =================================================================
// Description: The most complete and robust version, combining all user-added
// features with all bug fixes, especially for Date object handling.
// =================================================================

/**
 * ฟังก์ชันเริ่มต้นสำหรับสร้าง SheetQueryBuilder instance ใหม่
 */
function sheetQuery(spreadsheetSource) {
  return new SheetQueryBuilder(spreadsheetSource);
}

/**
 * @typedef {Object.<string, any> & {__meta: {row: number, cols: number}}} RowObject
 */
class SheetQueryBuilder {

  // #region CONSTRUCTOR
  constructor(spreadsheetSource) {
    let spreadsheetObject;
    if (typeof spreadsheetSource === 'string') {
      try {
        spreadsheetObject = SpreadsheetApp.openById(spreadsheetSource);
      } catch (e) {
        throw new Error(`SheetQuery: ไม่สามารถเปิด Spreadsheet จาก ID ที่ระบุได้ "${spreadsheetSource}".`);
      }
    } else if (spreadsheetSource && typeof spreadsheetSource.getName === 'function') {
      spreadsheetObject = spreadsheetSource;
    } else {
      spreadsheetObject = SpreadsheetApp.getActiveSpreadsheet();
    }
    this.spreadsheet = spreadsheetObject;
    this.clearAll();
  }
  // #endregion

  // #region PRIVATE HELPERS
  _loadHeadings() {
    if (this._headings) return;
    const sheet = this.getSheet();
    if (!sheet) { this._headings = []; this._headingMap = new Map(); return; }
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) { this._headings = []; this._headingMap = new Map(); return; }
    const headerRowValues = sheet.getRange(this.headingRow, 1, 1, lastCol).getValues()[0];
    this._headings = headerRowValues.map(h => String(h || '').trim()).filter(Boolean);
    this._headingMap = new Map(this._headings.map((h, i) => [h, i]));
  }

  _loadSheetData() {
    if (this._sheetData) return;
    const sheet = this.getSheet();
    if (!sheet) { this._sheetData = []; return; }
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const startRow = this.headingRow + 1;
    const numRows = lastRow - this.headingRow;
    this._sheetData = (numRows > 0 && lastCol > 0) ? sheet.getRange(startRow, 1, numRows, lastCol).getValues() : [];
  }
  
  _getProcessedRawData() {
    if (!this._rowObjects) {
      this._loadSheetData();
      this._loadHeadings();
      this._rowObjects = this._sheetData.map((values, i) => ({
        values: values,
        meta: { row: this.headingRow + i + 1, cols: this._headings.length }
      }));
    }
    if (!this.whereFn) return [...this._rowObjects];
    const headings = this._headings, headingMap = this._headingMap;
    return this._rowObjects.filter(rawRow => {
      const tempObj = { __meta: rawRow.meta };
      headings.forEach(h => { tempObj[h] = rawRow.values[headingMap.get(h)]; });
      return this.whereFn(tempObj);
    });
  }

  _processWriteValue(value) {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (typeof value === 'string' && isoDateRegex.test(value)) {
        try { return new Date(value); } catch (e) { return value; }
    }
    return value;
  }

  _getMaxNumericValueInColumn(columnName, prefix) {
    this.getHeadings();
    if (!this._headingMap.has(columnName)) return 0;
    const colIndex = this._headingMap.get(columnName);
    this._loadSheetData();
    const idColumnValues = this._sheetData.map(row => [row[colIndex]]);
    let maxId = 0;
    for (const row of idColumnValues) {
      const numericPart = parseInt(String(row[0] || '').replace(prefix, ''), 10);
      if (!isNaN(numericPart) && numericPart > maxId) maxId = numericPart;
    }
    return maxId;
  }
  // #endregion

  // #region BUILDER METHODS
  from(sheetName, headingRow = 1) { this.sheetName = sheetName; this.headingRow = headingRow; this.clearAll(); return this; }

  select(columnNames) { this._selectColumns = Array.isArray(columnNames) ? columnNames : [columnNames]; return this; }

  where(fn) { this.whereFn = fn; return this; }

  sortBy(columnName, direction = 'asc') { if (!columnName) throw new Error('A column name must be provided.'); const dir = String(direction).toLowerCase(); if (dir !== 'asc' && dir !== 'desc') throw new Error("Direction must be 'asc' or 'desc'."); this._sortConfig.push({ column: columnName, direction: dir }); return this; }
  
  offset(n) { const count = parseInt(n, 10); if (isNaN(count) || count < 0) throw new Error('Offset must be a non-negative number.'); this._offsetCount = count; return this; }
  
  limit(n) { const count = parseInt(n, 10); if (isNaN(count) || count <= 0) throw new Error('Limit must be a positive number.'); this._limitCount = count; return this; }
  
  withUniqueId(columnName, options = {}) { if (!columnName) throw new Error('A column name must be provided.'); this._idConfig = { generate: true, columnName: String(columnName).trim(), strategy: options.strategy || 'increment', prefix: options.prefix || '', padding: options.padding || 0 }; return this; }
  
  groupBy(columnNameOrNames) { this._groupByColumns = Array.isArray(columnNameOrNames) ? columnNameOrNames : [columnNameOrNames]; return this; }
  // #endregion

  // #region GETTER & AGGREGATION METHODS
  getSheet() { if (!this.sheetName) throw new Error('No sheet selected.'); if (!this._sheet) { this._sheet = this.spreadsheet.getSheetByName(this.sheetName); if (!this._sheet) throw new Error(`Sheet "${this.sheetName}" not found.`); } return this._sheet; }
  
  getHeadings() { this._loadHeadings(); return this._headings; }
  
  count() { return this._getProcessedRawData().length; }

  getRows() {
    let processedData = this._getProcessedRawData();
    if (this._sortConfig.length > 0) {
      const headingMap = this._headingMap;
      processedData.sort((a, b) => {
        for (const config of this._sortConfig) {
          const colIndex = headingMap.get(config.column);
          const valA = a.values[colIndex], valB = b.values[colIndex];
          if (valA == null && valB != null) return config.direction === 'asc' ? -1 : 1;
          if (valA != null && valB == null) return config.direction === 'asc' ? 1 : -1;
          if (valA == null && valB == null) return 0;
          if (valA < valB) return config.direction === 'asc' ? -1 : 1;
          if (valA > valB) return config.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    if (this._offsetCount > 0) processedData = processedData.slice(this._offsetCount);
    if (this._limitCount !== null) processedData = processedData.slice(0, this._limitCount);
    const finalRowObjects = processedData.map(rawRow => {
      const headings = this._headings;
      const columnsToBuild = this._selectColumns.length > 0 ? this._selectColumns : headings;
      const obj = { __meta: rawRow.meta };
      for (const heading of columnsToBuild) {
        if (this._headingMap.has(heading)) {
          const colIndex = this._headingMap.get(heading);
          let value = rawRow.values[colIndex];
          if (value instanceof Date) { value = value.toISOString(); }
          obj[heading] = value;
        }
      }
      return obj;
    });
    return finalRowObjects;
  }

  first() { this.limit(1); const rows = this.getRows(); this.clearBuilder(); return rows.length > 0 ? rows[0] : null; }
  sum(columnName) { const rows = this.getRows(); if (this._groupByColumns.length > 0) { const groups = {}; rows.forEach(row => { const key = this._groupByColumns.map(col => row[col]).join('||'); if (!groups[key]) { groups[key] = {}; this._groupByColumns.forEach(col => { groups[key][col] = row[col]; }); groups[key][`${columnName}_sum`] = 0; } groups[key][`${columnName}_sum`] += Number(row[columnName]) || 0; }); this.clearBuilder(); return Object.values(groups); } else { const total = rows.reduce((sum, row) => sum + (Number(row[columnName]) || 0), 0); this.clearBuilder(); return total; } }
  avg(columnName) { const rows = this.getRows(); if (this._groupByColumns.length > 0) { const groups = {}; rows.forEach(row => { const key = this._groupByColumns.map(col => row[col]).join('||'); if (!groups[key]) { groups[key] = {}; this._groupByColumns.forEach(col => { groups[key][col] = row[col]; }); groups[key].__sum = 0; groups[key].__count = 0; } groups[key].__sum += Number(row[columnName]) || 0; groups[key].__count++; }); const results = Object.values(groups).map(group => { group[`${columnName}_avg`] = group.__count > 0 ? group.__sum / group.__count : 0; delete group.__sum; delete group.__count; return group; }); this.clearBuilder(); return results; } else { if (rows.length === 0) return 0; const total = rows.reduce((sum, row) => sum + (Number(row[columnName]) || 0), 0); this.clearBuilder(); return total / rows.length; } }
  max(columnName) { const rows = this.getRows(); if (this._groupByColumns.length > 0) { const groups = {}; rows.forEach(row => { const key = this._groupByColumns.map(col => row[col]).join('||'); if (!groups[key]) { groups[key] = {}; this._groupByColumns.forEach(col => { groups[key][col] = row[col]; }); groups[key][`${columnName}_max`] = -Infinity; } const value = Number(row[columnName]); if (!isNaN(value) && value > groups[key][`${columnName}_max`]) { groups[key][`${columnName}_max`] = value; } }); this.clearBuilder(); return Object.values(groups); } else { const maxVal = rows.reduce((max, row) => { const value = Number(row[columnName]); return !isNaN(value) && value > max ? value : max; }, -Infinity); this.clearBuilder(); return maxVal; } }
  min(columnName) { const rows = this.getRows(); if (this._groupByColumns.length > 0) { const groups = {}; rows.forEach(row => { const key = this._groupByColumns.map(col => row[col]).join('||'); if (!groups[key]) { groups[key] = {}; this._groupByColumns.forEach(col => { groups[key][col] = row[col]; }); groups[key][`${columnName}_min`] = Infinity; } const value = Number(row[columnName]); if (!isNaN(value) && value < groups[key][`${columnName}_min`]) { groups[key][`${columnName}_min`] = value; } }); this.clearBuilder(); return Object.values(groups); } else { const minVal = rows.reduce((min, row) => { const value = Number(row[columnName]); return !isNaN(value) && value < min ? value : min; }, Infinity); this.clearBuilder(); return minVal; } }
  // #endregion

  // #region DATA MANIPULATION
  insertRows(newRows) {
    if (!Array.isArray(newRows) || newRows.length === 0) return this;
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = this.getSheet();
        this.getHeadings();
        let headings = [...this._headings];
        if (this._idConfig.generate) {
            const { columnName, strategy, prefix, padding } = this._idConfig;
            if (!this._headingMap.has(columnName)) {
                headings.push(columnName);
                sheet.getRange(this.headingRow, headings.length).setValue(columnName);
                this.clearDataCache()._loadHeadings();
            }
            let nextId = (strategy === 'increment') ? this._getMaxNumericValueInColumn(columnName, prefix) + 1 : 1;
            newRows.forEach(row => { if (row) { row[columnName] = (strategy === 'uuid') ? prefix + Utilities.getUuid() : prefix + String(nextId++).padStart(padding, '0'); } });
        }
        const valuesToInsert = newRows.filter(row => row).map(row =>
            headings.map(h => {
                const value = (row[h] === undefined || row[h] === null) ? '' : row[h];
                return this._processWriteValue(value);
            })
        );
        if (valuesToInsert.length > 0) { sheet.getRange(sheet.getLastRow() + 1, 1, valuesToInsert.length, headings.length).setValues(valuesToInsert); }
    } finally {
        lock.releaseLock();
    }
    this.clearAll(); return this;
  }

  updateRows(updateFn) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = this.getSheet();
        this._loadHeadings();
        const rowsToUpdate = this.getRows();
        if (rowsToUpdate.length === 0) { this.clearAll(); return this; }
        this._loadSheetData();
        const allValues = [this._headings, ...this._sheetData];
        const localHeadingMap = new Map(this._headingMap);
        for (const currentRowObject of rowsToUpdate) {
            const rowIndex = currentRowObject.__meta.row - this.headingRow;
            if (rowIndex < 0 || rowIndex >= allValues.length) continue;
            const updatedRowObject = updateFn(currentRowObject) || currentRowObject;
            for (const heading in updatedRowObject) {
                if (localHeadingMap.has(heading)) {
                    const colIndex = localHeadingMap.get(heading);
                    const valueToWrite = this._processWriteValue(updatedRowObject[heading]);
                    allValues[rowIndex][colIndex] = valueToWrite ?? '';
                }
            }
        }
        sheet.getRange(this.headingRow, 1, allValues.length, this._headings.length).setValues(allValues);
    } finally {
        lock.releaseLock();
    }
    this.clearAll(); return this;
 }

 upsert(findCriteria, dataToUpdateOrInsert) {
    if (typeof findCriteria !== 'object' || findCriteria === null || Object.keys(findCriteria).length === 0) {
        throw new Error('SheetQuery: findCriteria must be a non-empty object for upsert().');
    }
    const whereFn = (row) => Object.keys(findCriteria).every(key => row[key] == findCriteria[key]);
    const existingRow = this.where(whereFn).first();
    if (existingRow) {
        this.where(whereFn).updateRows(oldRow => ({ ...oldRow, ...dataToUpdateOrInsert }));
    } else {
        this.insertRows([{ ...findCriteria, ...dataToUpdateOrInsert }]);
    }
    return this;
 }

  deleteRows() {
     const rowsToDelete = this.getRows();
     if (rowsToDelete.length === 0) { this.clearAll(); return this; }
     const sheet = this.getSheet();
     const rowNumbers = rowsToDelete.map(row => row.__meta.row).sort((a, b) => b - a);
     rowNumbers.forEach(rowNum => sheet.deleteRow(rowNum));
     this.clearAll(); return this;
  }
  // #endregion

  // #region CACHE & STATE MANAGEMENT
  clearDataCache() { this._sheet = null; this._headings = null; this._headingMap = null; this._sheetData = null; this._rowObjects = null; SpreadsheetApp.flush(); return this; }
  clearBuilder() { this.whereFn = null; this._selectColumns = []; this._sortConfig = []; this._limitCount = null; this._offsetCount = 0; this._groupByColumns = []; this._idConfig = { generate: false, columnName: '', strategy: 'increment', prefix: '', padding: 0 }; return this; }
  clearAll() { this.clearDataCache(); this.clearBuilder(); return this; }
  // #endregion
}