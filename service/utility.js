/**
 *  @file service/utility.js
 */


/**
 * [NEW] ส่งอีเมล OTP สำหรับการเข้าสู่ระบบ
 */
function sendLoginOtpEmail(recipient, otp) {
    const siteConfig = getLiveSiteConfig();
    const subject = `[${siteConfig.appName}] รหัสยืนยันการเข้าสู่ระบบสำหรับ`;
    const body = `
        <p>สวัสดีครับ</p>
        <p>รหัสยืนยันการเข้าสู่ระบบ (OTP) ของคุณคือ:</p>
        <h2 style="text-align:center; letter-spacing: 5px;">${otp}</h2>
        <p>รหัสนี้จะหมดอายุในอีก 10 นาที</p>
        <p>หากคุณไม่ได้เป็นผู้ทำรายการนี้ กรุณาอย่าเปิดเผยรหัสนี้ให้ผู้อื่นทราบ</p>
        <br>
        <p>ขอแสดงความนับถือ<br>ทีมงาน ${siteConfig.appName}</p>
    `;
    MailApp.sendEmail({
        to: recipient,
        subject: subject,
        htmlBody: body
    });
}


/**
 * [NEW] ส่งอีเมล OTP สำหรับการยืนยันการลงทะเบียน
 * @param {string} recipient - อีเมลผู้รับ
 * @param {string} otp - รหัส OTP ที่จะส่ง
 */
function sendRegistrationOtpEmail(recipient, otp) {
    const siteConfig = getLiveSiteConfig();
    const subject = `[${siteConfig.appName}] รหัสยืนยันการสมัครสมาชิกของคุณ`;
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
        to: recipient,
        subject: subject,
        htmlBody: body
    });
}



