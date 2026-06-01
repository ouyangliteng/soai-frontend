const dataService = require("../../utils/data-service");

Page({
  data: {
    profile: {},
    latestReport: null,
    trend: { items: [], summary: "" },
    reports: [],
    repeatedProblems: [],
    repeatedRisks: []
  },

  async onLoad(options) {
    try {
      const detail = await dataService.getCoachStudentDetail(options.id);
      this.setData(detail);
    } catch (error) {
      wx.showToast({ title: error.message || "学员详情加载失败", icon: "none" });
    }
  },

  openReport(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/report/report?id=${id}` });
  },

  openTeachingOutline(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/teaching-outline/teaching-outline?reportId=${id}` });
  }
});
