/**
 * file : mod_user_controller.gs
 * ประมวลผลคำสั่งที่เกี่ยวกับ User, มีความรับผิดชอบน้อยลง, เรียกใช้ Service แทน
 */

// =================================================================
//  AUTHENTICATION & SESSION
// =================================================================


// =================================================================
//  LOGIN
// =================================================================
/**
 * [CORRECTED] ประมวลผลการ Login ขั้นที่ 1: ตรวจสอบ Password และส่ง OTP
 */
function processLogin(credentials) {
    try {
        const user = findUserByEmail(credentials.email);

        if (!user) {
            return { success: false, message: 'ไม่พบอีเมลนี้ในระบบ' };
        }

        // --- ตรวจสอบสถานะ ---
        if (user.Status === 'Pending') {
            // ส่ง OTP สำหรับการลงทะเบียนไปให้ใหม่
            const otp = ProjectUtilsLib.generateOtp();
            const expiryDate = new Date(new Date().getTime() + 10 * 60 * 1000);
            updateUserById(user.Id, { LoginOTP: otp, LoginOTPExpiry: expiryDate });
            sendRegistrationOtpEmail(user.Email, otp);
            // ส่ง response พิเศษให้ frontend รู้ว่าต้องไปหน้ายืนยัน OTP การลงทะเบียน
            return { success: true, registration_otp_required: true, email: user.Email, message: 'บัญชีของคุณยังไม่ได้ยืนยันตัวตน เราได้ส่ง OTP ใหม่ไปที่อีเมลแล้ว' };
        }

        if (user.Status !== 'Active') {
            return { success: false, message: `บัญชีของคุณอยู่ในสถานะ ${user.Status} ไม่สามารถเข้าสู่ระบบได้` };
        }
        // --- จบการตรวจสอบสถานะ ---

        if (!ProjectUtilsLib.verifyPassword(credentials.password, user.PasswordHash, user.Salt)) {
            return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
        }

        // สร้างและส่ง 2FA OTP สำหรับ Login (เหมือนเดิม)
        const otp = ProjectUtilsLib.generateOtp();
        const expiryDate = new Date(new Date().getTime() + 10 * 60 * 1000);
        updateUserById(user.Id, { LoginOTP: otp, LoginOTPExpiry: expiryDate });
        sendLoginOtpEmail(user.Email, otp);
        
        // ส่ง response ให้ frontend รู้ว่าต้องไปหน้ายืนยัน OTP การ Login
        return { success: true, login_otp_required: true, email: user.Email };

    } catch (e) {
        Logger.log('Login Error: ' + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [FINAL REVISION] ตรวจสอบ OTP และคืนค่า URL สำหรับ Redirect
 */
function verifyLoginOtp(data) {
    try {
        const user = findUserByEmail(data.email);
        if (!user || !user.LoginOTP) return { success: false, message: 'เกิดข้อผิดพลาด: ไม่พบข้อมูล OTP' };

        const now = new Date();
        const expiry = new Date(user.LoginOTPExpiry);

        if (now > expiry) return { success: false, message: 'รหัส OTP หมดอายุแล้ว' };
        if (String(user.LoginOTP) !== String(data.otp)) return { success: false, message: 'รหัส OTP ไม่ถูกต้อง' };
        
        // OTP ถูกต้อง, ทำทุกอย่างเหมือนเดิม
        updateUserById(user.Id, { LoginOTP: '', LoginOTPExpiry: '' });
        updateUserLastLoginTimestamp(user.Id);
        createSession(user);
        writeAuditLog('Login 2FA', user.Email, 'Success');

        // [CHANGE] สร้าง URL และส่งกลับไปในรูปแบบ JSON
        const redirectUrl = ScriptApp.getService().getUrl() + "?page=dashboard";
        return { success: true, redirectUrl: redirectUrl };

    } catch (e) {
        Logger.log('Verify OTP Error: ' + e.message);
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

/**
 * [NEW] ขอ OTP ใหม่อีกครั้ง
 */
function resendLoginOtp(email) {
    try {
        // [FIXED] เรียกใช้ findUserByEmail
        const user = findUserByEmail(email);
        if (!user) {
            return { success: false, message: 'ไม่พบอีเมลนี้ในระบบ' };
        }

        const otp = ProjectUtilsLib.generateOtp();
        const expiryDate = new Date(new Date().getTime() + 10 * 60 * 1000);

        // [FIXED] เรียกใช้ updateUserById เพื่อบันทึก OTP ใหม่
        updateUserById(user.Id, {
            LoginOTP: otp,
            LoginOTPExpiry: expiryDate
        });

        sendLoginOtpEmail(user.Email, otp);
        return { success: true, message: 'ส่ง OTP ใหม่สำเร็จแล้ว' };

    } catch (e) {
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.message };
    }
}

// =================================================================
//  LOGOUT
// =================================================================

function processLogout() {
  try {
    writeAuditLog('Logout');
    clearSession();
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}


// =================================================================
//  USER REGISTRATION
// =================================================================

/**
 * [REVISED] ประมวลผลการลงทะเบียน โดยจะสร้างผู้ใช้สถานะ 'Pending' ทันที
 * หรือส่ง OTP ซ้ำหากผู้ใช้เคยลงทะเบียนแต่ยังไม่ยืนยัน
 */
function processRegistration(formObject) {
  try {
    // --- 1. ตรวจสอบ Input พื้นฐาน ---
    if (!formObject.email || !formObject.password || !formObject.confirmPassword) {
      return { success: false, message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' };
    }
    if (APP_CONFIG.security.register.email.endWith) {
      if (!formObject.email.toLowerCase().endsWith(APP_CONFIG.security.register.email.endWith)) {
        return { success: false, message: `กรุณาใช้อีเมลของบริษัทฯ (${APP_CONFIG.security.register.email.endWith}) เท่านั้น` };
      }
    }
    if (formObject.password !== formObject.confirmPassword) {
      return { success: false, message: 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน' };
    }
    if (formObject.password.length < APP_CONFIG.security.minPasswordLength) {
      return { success: false, message: `รหัสผ่านต้องมีความยาวอย่างน้อย ${APP_CONFIG.security.minPasswordLength} ตัวอักษร` };
    }

    // --- 2. ตรวจสอบผู้ใช้ที่มีอยู่ ---
    const existingUser = findUserByEmail(formObject.email);
    if (existingUser && existingUser.Status === 'Active') {
      return { success: false, message: 'อีเมลนี้มีผู้ใช้งานในระบบแล้ว' };
    }

    // --- 3. สร้างข้อมูลจำเป็น ---
    const otp = ProjectUtilsLib.generateOtp();
    const otpExpiry = new Date(new Date().getTime() + 10 * 60 * 1000); // 10 นาที
    const salt = ProjectUtilsLib.generateSalt();
    const passwordHash = ProjectUtilsLib.hashPassword(formObject.password, salt);

    if (existingUser && existingUser.Status === 'Pending') {
      // --- กรณี: ผู้ใช้ Pending กลับมาลงทะเบียนซ้ำ ---
      // อัปเดต OTP และรหัสผ่านใหม่ (เผื่อผู้ใช้ลืมรหัสที่เคยกรอก)
      updateUserById(existingUser.Id, {
        PasswordHash: passwordHash,
        Salt: salt,
        LoginOTP: otp,
        LoginOTPExpiry: otpExpiry
      });
    } else {
      // --- กรณี: ผู้ใช้ใหม่ ---
      createNewUser({
        email: formObject.email,
        passwordHash: passwordHash,
        salt: salt,
        roleId: 'R-000008', // Guest
        status: 'Pending',
        otp: otp,
        otpExpiry: otpExpiry
      });
    }

    // --- 4. ส่งอีเมล OTP ---
    const siteConfig = getLiveSiteConfig();
    const subject = `[${siteConfig.appName}] รหัสยืนยันการสมัครสมาชิก`;
    const body = `
        <p>สวัสดีครับ</p>
        <p>รหัสยืนยันการสมัครสมาชิก (OTP) ของคุณคือ:</p>
        <h2 style="text-align:center; letter-spacing: 5px;">${otp}</h2>
        <p>รหัสนี้จะหมดอายุในอีก 10 นาที</p>
        <p>หากคุณไม่ได้เป็นผู้ทำรายการนี้ กรุณาอย่าเปิดเผยรหัสนี้ให้ผู้อื่นทราบ</p>
        <br>
        <p>ขอแสดงความนับถือ<br>ทีมงาน ${siteConfig.appName}</p>
    `;
    MailApp.sendEmail({
        to: formObject.email,
        subject: subject,
        htmlBody: body
    });

    return { success: true, message: 'ระบบได้ส่งรหัสยืนยัน 6 หลักไปที่อีเมลของคุณแล้ว' };
  } catch (error) {
    Logger.log("Error in processRegistration: " + error);
    return { success: false, message: 'เกิดข้อผิดพลาดในระบบ: ' + error.message };
  }
}

// [RENAMED & REVISED] verifyOtpAndCreateUser -> verifyRegistrationOtp
function verifyRegistrationOtp(formObject) {
  try {
    const { email, otp } = formObject;
    
    const user = findUserByEmail(email);
    if (!user || user.Status !== 'Pending') {
      return { success: false, message: 'คำขอยืนยันไม่ถูกต้อง' };
    }

    if (String(user.LoginOTP) !== String(otp)) {
      return { success: false, message: 'รหัสยืนยันไม่ถูกต้อง' };
    }

    const now = new Date();
    const expiry = new Date(user.LoginOTPExpiry);
    if (now > expiry) {
      return { success: false, message: 'รหัส OTP หมดอายุแล้ว กรุณาลงทะเบียนใหม่อีกครั้งเพื่อรับรหัสใหม่' };
    }

    // ยืนยันสำเร็จ: อัปเดตสถานะผู้ใช้
    updateUserById(user.Id, {
      Status: 'Active',
      LoginOTP: '', // ล้างค่า OTP ทิ้ง
      LoginOTPExpiry: '' // ล้างค่าวันหมดอายุ
    });
    
    writeAuditLog('Register User Success', user.Email);
    
    return { success: true, message: 'ลงทะเบียนสำเร็จ!' };
  } catch (error) {
    Logger.log("Error in verifyRegistrationOtp: " + error);
    return { success: false, message: 'เกิดข้อผิดพลาดในระบบ: ' + error.message };
  }
}

function getDashboardData(session) {
  const dashboardData = { userRole: session.role };
  const allowedRolesForPackage = APP_CONFIG.routing.permissions['package/manage'] || [];
  
  if (session.role === APP_CONFIG.security.roles.ADMIN) {
    dashboardData.totalUsers = countTotalUsers();
    dashboardData.totalRoles = countTotalRoles();
  }

  if (session.role === APP_CONFIG.security.roles.MODERATOR) {
    dashboardData.pendingArticles = 5;
    dashboardData.publishedArticles = 23;
  }

  if (allowedRolesForPackage.includes(session.role)) {
    dashboardData.totalPackages = countTotalPackages();
  }
    
  return dashboardData;
}

function processAddNewUser(formObject) {
  try {
    if (!formObject.email || !formObject.password || !formObject.roleId) {
      return { success: false, message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' };
    }
    if (findUserByEmail(formObject.email)) {
      return { success: false, message: 'อีเมลนี้มีผู้ใช้งานในระบบแล้ว' };
    }
    const salt = ProjectUtilsLib.generateSalt();
    const passwordHash = ProjectUtilsLib.hashPassword(formObject.password, salt);
    const newUserPayload = {
      email: formObject.email,
      passwordHash: passwordHash,
      salt: salt,
      roleId: formObject.roleId
    };
    createNewUser(newUserPayload);
    writeAuditLog('Admin: Create User', formObject.email, `Role ID: ${formObject.roleId}`);
    const createdUser = findUserByEmail(formObject.email);
    const roleInfo = getAllRoles().find(r => r.Id === createdUser.RoleId);
    const displayUser = {
      Id: createdUser.Id,
      Email: createdUser.Email,
      RoleId: createdUser.RoleId,
      RoleName: roleInfo.Name,
      RoleColor: roleInfo.BadgeColor || 'badge-secondary',
      CreateDate: new Date(createdUser.CreateDate).toLocaleString('th-TH'),
      LastLogin: 'ยังไม่เคยล็อกอิน',
    };
    return { success: true, message: 'เพิ่มผู้ใช้สำเร็จ!', newUser: displayUser };
  } catch (error) {
    Logger.log('Add User Error: ' + error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้: ' + error.message };
  }
}

function processDeleteUser(userId) {
  try {
    const session = checkUserSession();
    const userToDelete = findUserById(userId); // ควรสร้าง findUserById ใน Model
    if (userToDelete && userToDelete.Email === session.email) {
      return { success: false, message: 'คุณไม่สามารถลบบัญชีของตัวเองได้' };
    }
    deleteUserById(userId);
    writeAuditLog('Admin: Delete User', userToDelete.Email);
    return { success: true, message: 'ลบผู้ใช้สำเร็จ' };
  } catch (error) {
    Logger.log("Delete User Error: " + error);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + error.message };
  }
}

function processEditUser(formObject) {
  try {
    const { userId, email, roleId, password } = formObject;
    const existingUser = findUserByEmail(email);
    if (existingUser && existingUser.Id !== userId) {
      return { success: false, message: 'อีเมลนี้ถูกใช้โดยบัญชีอื่นแล้ว' };
    }
    const dataToUpdate = { Email: email, RoleId: roleId };
    if (password && password.length > 0) {
      dataToUpdate.Salt = ProjectUtilsLib.generateSalt();
      dataToUpdate.PasswordHash = ProjectUtilsLib.hashPassword(password, dataToUpdate.Salt);
    }
    updateUserById(userId, dataToUpdate);
    writeAuditLog('Admin: Edit User', formObject.email, `Role ID: ${formObject.roleId}`);
    const updatedUser = findUserByEmail(email);
    const roleInfo = getAllRoles().find(r => r.Id === updatedUser.RoleId);
    const displayUser = {
      Id: updatedUser.Id,
      Email: updatedUser.Email,
      RoleId: updatedUser.RoleId,
      RoleName: roleInfo ? roleInfo.Name : 'N/A',
      RoleColor: roleInfo ? roleInfo.BadgeColor : 'badge-secondary',
      CreateDate: new Date(updatedUser.CreateDate).toLocaleString('th-TH'),
      LastLogin: updatedUser.LastLogin ? new Date(updatedUser.LastLogin).toLocaleString('th-TH') : 'ยังไม่เคยล็อกอิน'
    };
    return { success: true, message: 'อัปเดตข้อมูลผู้ใช้สำเร็จ!', updatedUser: displayUser };
  } catch (error) {
    Logger.log('Edit User Error: ' + error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดต: ' + error.message };
  }
}


function fetchPaginatedUsers(options) {
  try {
    const session = checkUserSession();
    if (!session.isLoggedIn || session.role !== 'Admin') {
      throw new Error('คุณไม่มีสิทธิ์ดำเนินการนี้');
    }
    return getPaginatedUsers(options);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function processProfilePictureUpload(fileData) {
  try {
    const session = checkUserSession();
    if (!session.isLoggedIn) {
      return { success: false, message: 'Session หมดอายุ กรุณาล็อกอินใหม่' };
    }
    
    const user = findUserByEmail(session.email);
    // เรียกใช้ Service
    const newFileId = uploadUserProfileImage(fileData, user);
    // เรียกใช้ Model
    updateUserById(user.Id, { ProfilePicId: newFileId });

    const newImageUrl = 'https://drive.google.com/thumbnail?id=' + newFileId;
    return { success: true, message: 'อัปโหลดรูปโปรไฟล์สำเร็จ!', imageUrl: newImageUrl };

  } catch (e) {
    Logger.log('Profile Picture Upload Error: ' + e);
    return { success: false, message: e.message };
  }
}

// =================================================================
//  PASSWORD MANAGEMENT
// =================================================================

function processChangePassword(formObject) {
  try {
    const session = checkUserSession();
    if (!session.isLoggedIn) {
      return { success: false, message: 'Session หมดอายุ กรุณาล็อกอินใหม่อีกครั้ง' };
    }
    const user = findUserByEmail(session.email);
    if (!ProjectUtilsLib.verifyPassword(formObject.currentPassword, user.PasswordHash, user.Salt)) {
      return { success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง!' };
    }
    if (formObject.newPassword.length < 6) {
      return { success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' };
    }
    if (formObject.newPassword !== formObject.confirmNewPassword) {
      return { success: false, message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' };
    }
    if (ProjectUtilsLib.verifyPassword(formObject.newPassword, user.PasswordHash, user.Salt)) {
        return { success: false, message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' };
    }
    const newSalt = ProjectUtilsLib.generateSalt();
    const newPasswordHash = ProjectUtilsLib.hashPassword(formObject.newPassword, newSalt);
    updateUserById(user.Id, {
      PasswordHash: newPasswordHash,
      Salt: newSalt
    });
    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว' };
  } catch (error) {
    Logger.log("Change Password Error: " + error);
    return { success: false, message: 'เกิดข้อผิดพลาดในระบบ: ' + error.message };
  }
}

/**
 * [NEW] ประมวลผลคำขอลืมรหัสผ่าน
 */
function processPasswordResetRequest(email) {
    try {
        const user = findUserByEmail(email);
        
        if (user) {
            const token = Utilities.getUuid();
            const cache = CacheService.getScriptCache();
            cache.put(token, user.Email, 3600); 

            const resetLink = `${ScriptApp.getService().getUrl()}?page=reset-password&token=${token}`;
            
            // [FIXED] เรียกใช้ getLiveSiteConfig() ที่นี่
            const siteConfig = getLiveSiteConfig();

            const emailTemplate = HtmlService.createTemplateFromFile('template_email_reset.html');
            emailTemplate.resetLink = resetLink;
            emailTemplate.appName = siteConfig.appName; // ใช้ค่าจาก siteConfig
            const emailBody = emailTemplate.evaluate().getContent();

            MailApp.sendEmail({
                to: user.Email,
                subject: `คำขอรีเซ็ตรหัสผ่านสำหรับ ${siteConfig.appName}`, // ใช้ค่าจาก siteConfig
                htmlBody: emailBody
            });
        }
        
        return { success: true, message: 'หากอีเมลของคุณมีอยู่ในระบบ คุณจะได้รับลิงก์สำหรับรีเซ็ตรหัสผ่านในไม่ช้า' };

    } catch (e) {
        Logger.log('Password Reset Request Error: ' + e.toString());
        return { success: false, message: 'เกิดข้อผิดพลาดในระบบ' };
    }
}

/**
 * [NEW] ประมวลผลการตั้งรหัสผ่านใหม่
 */
function processPasswordReset(formData) {
    try {
        const { token, newPassword, confirmPassword } = formData;

        if (!newPassword || newPassword.length < 6) {
            return { success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' };
        }
        if (newPassword !== confirmPassword) {
            return { success: false, message: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' };
        }

        const cache = CacheService.getScriptCache();
        const email = cache.get(token);

        if (!email) {
            return { success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว' };
        }
        
        const user = findUserByEmail(email);
        if (!user) {
            return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
        }
        
        // อัปเดตรหัสผ่าน
        const newSalt = ProjectUtilsLib.generateSalt();
        const newPasswordHash = ProjectUtilsLib.hashPassword(newPassword, newSalt);
        updateUserById(user.Id, {
            PasswordHash: newPasswordHash,
            Salt: newSalt
        });
        
        // [สำคัญ] ลบ token ทิ้งทันทีหลังใช้งานเสร็จ
        cache.remove(token);

        writeAuditLog('Password Reset', user.Email, 'Success');
        return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว!' };

    } catch (e) {
        Logger.log('Password Reset Error: ' + e.toString());
        return { success: false, message: 'เกิดข้อผิดพลาดในระบบ: ' + e.message };
    }
}


