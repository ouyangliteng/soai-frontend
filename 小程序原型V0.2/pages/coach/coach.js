const dataService = require("../../utils/data-service");

Page({
  data: {
    stats: {},
    pendingReports: [],
    students: []
  },

  async onShow() {
    try {
      const dashboard = await dataService.getCoachDashboard();
      this.setData(dashboard);
    } catch (error) {
      wx.showToast({ title: error.message || "教练工作台加载失败", icon: "none" });
    }
  },

  openReport(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/report/report?id=${id}` });
  },

  openStudent(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/coach-student/coach-student?id=${id}` });
  }
});
