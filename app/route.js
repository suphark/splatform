/**
 * file: app_route.gs
 * ใช้ Map-based routing ทั้ง doGet และ doPost
 */

// ================== GET ROUTE MAP & HANDLERS ==================
const routeMap = {
  'dashboard': handleDashboardPage,
  'login': handleLoginPage,
  'register': handleRegisterPage,
  'profile': handleProfilePage,
  'admin/user/manage': handleManageUsersPage,
  'admin/role/manage': handleManageRolesPage,
  'admin/dashboard': handleAdminDashboardPage,
  'admin/settings': handleAdminSettingsPage,
  'forgot-password': handleForgotPasswordPage,
  'reset-password': handleResetPasswordPage,
  'home': handleHomePage,
  'about': handleAboutPage,
  'debug': handleDebugPage,
  // Package
  'package/manage': handleManagePackagesPage,
  // Vendors
  'vendor/manage': handleManageVendorsPage,
  // Vendor Statuses
  'vendor/pq': handleVendorPQPage,
  


};

function doGet(e) {
  const session = checkUserSession();
  const page = e.parameter.page || (session.isLoggedIn ? 'dashboard' : 'home');

  const requiredRoles = APP_CONFIG.routing.permissions[page];
  if (requiredRoles) {
    if (!session.isLoggedIn) {
      return render(APP_CONFIG.routing.files.login, {
        title: APP_CONFIG.routing.titles.login,
        alert: { type: 'warning', message: 'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ' }
      });
    }
    if (!requiredRoles.includes(session.role)) {
      return render('page/general/access_denied.html', {
        title: APP_CONFIG.routing.titles.accessDenied
      });
    }
  }

  const loginRequiredPages = ['profile', 'dashboard'];
  if (loginRequiredPages.includes(page) && !session.isLoggedIn) {
    return render(APP_CONFIG.routing.files.login, {
      title: APP_CONFIG.routing.titles.login,
      alert: { type: 'warning', message: 'กรุณาเข้าสู่ระบบเพื่อดูหน้านี้' }
    });
  }

  const handler = routeMap[page] || handleNotFoundPage;
  return handler(session, e.parameter);
}

// ================== POST ACTION MAP & HANDLERS ==================
const postActionMap = {
  'login': handleLoginAction,
};

function handleLoginAction(e) {
  const result = processLogin(e.parameter);
  if (result.success) {
    const session = checkUserSession(); // ดึง session ใหม่หลัง login
    return handleDashboardPage(session, {});
  } else {
    const alert = { type: 'danger', message: result.message };
    return handleLoginPage(checkUserSession(), {}, alert);
  }
}

function handleUnknownAction(e) {
  return handleHomePage(checkUserSession(), {});
}

function doPost(e) {
  const action = e.parameter.action;
  const handler = postActionMap[action] || handleUnknownAction;
  return handler(e);
}

// ================== PAGE HANDLERS ==================

function handleDashboardPage(session, params) {
  const dashboardData = getDashboardData(session);
  return render(APP_CONFIG.routing.files.dashboard, {
    title: APP_CONFIG.routing.titles.dashboard,
    email: session.email,
    role: session.role,
    dashboardData: dashboardData
  });
}

function handleLoginPage(session, params, alert = null) {
  if (session.isLoggedIn) {
    // ถ้าล็อกอินอยู่แล้ว ให้สร้าง HTML เพื่อสั่ง Redirect
    const redirectUrl = ScriptApp.getService().getUrl();
    const html = `<script>window.top.location.href = "${redirectUrl}";</script>`;
    return HtmlService.createHtmlOutput(html);
  }

  // ถ้ายังไม่ได้ล็อกอิน ให้แสดงหน้าล็อกอินตามปกติ
  return render(APP_CONFIG.routing.files.login, {
    title: APP_CONFIG.routing.titles.login,
    alert: alert
  });
}

function handleRegisterPage(session, params) {
  return render(APP_CONFIG.routing.files.register, { title: APP_CONFIG.routing.titles.register });
}

function handleProfilePage(session, params) {
  return render(APP_CONFIG.routing.files.profile, {
    title: APP_CONFIG.routing.titles.profile,
    email: session.email,
    role: session.role
  });
}

function handleManageUsersPage(session, params) {
  return render(APP_CONFIG.routing.files['admin/user/manage'], {
    title: APP_CONFIG.routing.titles.manageUsers
  });
}

function handleManageRolesPage(session, params) {
  const allRoles = getAllRoles();
  return render(APP_CONFIG.routing.files['admin/role/manage'], {
    title: APP_CONFIG.routing.titles.manageRoles,
    roles: allRoles
  });
}

function handleAdminDashboardPage(session, params) {
  return render(APP_CONFIG.routing.files['admin/dashboard'], {
    title: APP_CONFIG.routing.titles['admin/dashboard']
  });
}

function handleAdminSettingsPage(session, params) {
  return render(APP_CONFIG.routing.files['admin/settings'], {
    title: APP_CONFIG.routing.titles['admin/settings'],
    currentSettings: getSiteSettings()
  });
}

function handleHomePage(session, params) {
  return render(APP_CONFIG.routing.files.home, { title: APP_CONFIG.routing.titles.home });
}

function handleAboutPage(session, params) {
  return render('page/general/about.html', { title: "About" });
}

function handleDebugPage(session, params) {
  return HtmlService.createTemplateFromFile('page/debug.html').evaluate();
}

function handleNotFoundPage(session, params) {
  return render('page/general/404.html', { title: '404 - ไม่พบหน้า' });
}

function handleForgotPasswordPage(session, params) {
  return render(APP_CONFIG.routing.files['forgot-password'], {
    title: APP_CONFIG.routing.titles['forgot-password']
  });
}

function handleResetPasswordPage(session, params) {
  const token = params.token || null;
  const cache = CacheService.getScriptCache();
  const email = cache.get(token); // ตรวจสอบว่า token ยังใช้ได้และมีใน cache หรือไม่

  return render(APP_CONFIG.routing.files['reset-password'], {
    title: APP_CONFIG.routing.titles['reset-password'],
    isValidToken: !!email, // ส่ง true ถ้า token ใช้งานได้
    token: token
  });
}

function handleManagePackagesPage(session, params) {
  return render(APP_CONFIG.routing.files['package/manage'], {
    title: APP_CONFIG.routing.titles['package/manage']
  });
}

function handleManageVendorsPage(session, params) {
  return render(APP_CONFIG.routing.files['vendor/manage'], {
    title: APP_CONFIG.routing.titles['vendor/manage']
  });
}

function handleVendorPQPage(session, params) {
  const vendorId = params.vendorId;
  if (!vendorId) {
    return handleNotFoundPage(session, params);
  }
  return render('page/vendor/pq_view.html', {
    title: `Pre-Qualification Form for Vendor: ${vendorId}`,
    vendorId: vendorId // ส่ง vendorId ไปให้หน้าเว็บ
  });
}

