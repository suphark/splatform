/**
 *  @file mod/setting/database.js
 */



function getSiteSettings(forceRefresh = false) {
  const SETTINGS_CACHE_KEY = 'site_settings_cache';
  const SETTINGS_CACHE_DURATION = 300;
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cachedSettings = cache.get(SETTINGS_CACHE_KEY);
    if (cachedSettings) {
      return JSON.parse(cachedSettings);
    }
  }
  const settingsRows = APP_CONFIG.sheetsData.settings.getTable().getRows();
  const settingsObject = settingsRows.reduce((obj, row) => {
    if (row.SettingKey) {
      obj[row.SettingKey] = row.SettingValue;
    }
    return obj;
  }, {});
  cache.put(SETTINGS_CACHE_KEY, JSON.stringify(settingsObject), SETTINGS_CACHE_DURATION);
  return settingsObject;
}


function updateSettings(newSettings) {
  const settingsTable = APP_CONFIG.sheetsData.settings.getTable();

  for (const key in newSettings) {
    if (Object.hasOwnProperty.call(newSettings, key)) {
      settingsTable
        .where(row => row.SettingKey === key)
        .updateRows(row => {
          row.SettingValue = newSettings[key];
          return row; // คืนค่า row ที่อัปเดตแล้ว
        });
    }
  }
  getSiteSettings(true); // บังคับให้โหลด cache ใหม่
}


/**
 * [NEW] สร้าง Object สำหรับ Site Config แบบสดๆ โดยรวมค่าจาก Settings ในชีต
 * กับค่าเริ่มต้นใน APP_CONFIG เข้าด้วยกัน
 * @returns {{appName: string, footerText: string}}
 */
function getLiveSiteConfig() {
    const dynamicSettings = getSiteSettings(); 
    
    const siteConfig = {
        appName: dynamicSettings.appName || APP_CONFIG.site.defaultAppName,
        footerText: dynamicSettings.footerText || APP_CONFIG.site.defaultFooterText
    };

    return siteConfig;
}