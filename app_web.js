/**
* file: app_web.gs
*/

function render(filePath, data = {}) {
  const pageTemplate = HtmlService.createTemplateFromFile(filePath);
  const layoutTemplate = HtmlService.createTemplateFromFile('template_layout.html');
  data.baseUrl = ScriptApp.getService().getUrl();

  // [FIXED] เปลี่ยนจากการเรียกใช้ค่าคงที่ มาเรียกใช้ฟังก์ชันแทน
  data.siteConfig = getLiveSiteConfig(); 

  pageTemplate.data = data;
  layoutTemplate.data = data;
  layoutTemplate.pageContent = pageTemplate.evaluate().getContent();
  return layoutTemplate.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename, data) {
  const template = HtmlService.createTemplateFromFile(filename);
  template.data = data;
  return template.evaluate().getContent();
}


