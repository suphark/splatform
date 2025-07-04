/**
* file: app_session.gs
*/

/**
 * ตรวจสอบสถานะ Session ของผู้ใช้ปัจจุบัน
 * @returns {Object} { isLoggedIn: true/false, username: '...' }
 */
function checkUserSession() {
  const properties = PropertiesService.getUserProperties();

    // If not logged in, return an empty session object
  if (!properties.getProperty('isLoggedIn')) {
    return { isLoggedIn: false};
  }

  const email = properties.getProperty('email');
  const role = properties.getProperty('role');
  if (email) {
    // ดึงข้อมูล ProfilePicId มาด้วย
    const user = findUserByEmail(email);
    return {
      isLoggedIn: true,
      email: email, 
      role: role,
      profilePicId: user ? user.ProfilePicId : null // <-- NEW
    };
  }
  return { isLoggedIn: false };
}


function createSession(user) {
  const properties = PropertiesService.getUserProperties();
  properties.setProperty('isLoggedIn', 'true');
  properties.setProperty('email', user.Email);

  const getRole = findRoleById(user.RoleId);
  
  if (getRole) {
    properties.setProperty('role', getRole.Name);
  }
}

function clearSession() {
  // PropertiesService.getUserProperties().deleteAllProperties();
  PropertiesService.getUserProperties().deleteProperty('email');
  PropertiesService.getUserProperties().deleteProperty('role');
}


