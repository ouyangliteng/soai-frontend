const dataService = require("../../utils/data-service");

Page({
  data: {
    role: "student",
    coachStudents: [],
    coachStats: {},
    pendingReports: [],
    profile: {},
    completion: 0,
    latestReport: null,
    activeTask: null,
    latestOutline: null,
    trendItems: [],
    trendSummary: ""
  },

  async onShow() {
    try {
      const session = dataService.getCurrentSession();
      if (session.role === "coach") {
        const dashboard = await dataService.getCoachDashboard();
        this.setData({
          role: "coach",
          coachStudents: dashboard.students || [],
          coachStats: dashboard.stats || {},
          pendingReports: dashboard.pendingReports || []
        });
        return;
      }
      const profile = (await dataService.getProfile()) || {};
      const trend = await dataService.getTrend(5, profile.id);
      const activeTask = dataService.getActiveTask();
      const latestReport = await dataService.getLatestReport();
      const outlines = await dataService.getTeachingOutlines(profile.id);
      const latestOutline = outlines.length ? outlines[outlines.length - 1] : null;

      this.setData({
        role: "student",
        profile,
        completion: dataService.getProfileCompletion(profile),
        latestReport,
        latestOutline,
        activeTask: activeTask ? this.formatTask(activeTask) : null,
        trendItems: trend.items,
        trendSummary: trend.summary
      });
    } catch (error) {
      wx.showToast({ title: error.message || "首页数据加载失败", icon: "none" });
    }
  },

  formatTask(task) {
    const statusMap = {
      queued: "排队中",
      uploading: "上传中",
      analyzing: "分析中",
      generating_report: "生成中",
      failed: "失败"
    };
    return {
      ...task,
      statusText: statusMap[task.status] || "进行中"
    };
  },

  goProfile() {
    wx.switchTab({ url: "/pages/profile/profile" });
  },

  goRoleSelect() {
    wx.reLaunch({ url: "/pages/role-select/role-select?mode=coach" });
  },

  goUpload() {
    wx.navigateTo({ url: "/pages/upload/upload" });
  },

  goAnalysis() {
    wx.navigateTo({ url: "/pages/analysis/analysis" });
  },

  goReport() {
    const latest = this.data.latestReport;
    if (!latest) return;
    wx.navigateTo({ url: `/pages/report/report?id=${latest.id}` });
  },

  goFeedback() {
    const latest = this.data.latestReport;
    const query = latest ? `?reportId=${latest.id}` : "";
    wx.navigateTo({ url: `/pages/feedback/feedback${query}` });
  },

  goTrends() {
    wx.switchTab({ url: "/pages/trends/trends" });
  },

  goStudentPlan() {
    const outline = this.data.latestOutline;
    if (!outline) return;
    wx.navigateTo({ url: `/pages/student-plan/student-plan?id=${outline.id}` });
  },

  openCoachStudent(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/coach-student/coach-student?id=${id}` });
  },

  openCoachReport(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/report/report?id=${id}` });
  }
});
