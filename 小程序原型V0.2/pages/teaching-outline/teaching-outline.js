const dataService = require("../../utils/data-service");

Page({
  data: {
    reportId: "",
    report: null,
    coachObservation: "",
    stageGoal: "",
    constraints: "",
    weeks: 4,
    outline: null,
    loading: false
  },

  async onLoad(options) {
    const reportId = options.reportId || options.id || "";
    if (!reportId) {
      wx.showToast({ title: "缺少报告 ID", icon: "none" });
      return;
    }

    try {
      const report = await dataService.getReport(reportId);
      const defaultGoal = `未来 4 周提升${report.nextTrainingFocus.slice(0, 2).join("、")}。`;
      this.setData({
        reportId,
        report,
        stageGoal: defaultGoal,
        constraints: "每周 2 次训练，优先安全和基础稳定，每次只抓 1 到 2 个重点。"
      });
    } catch (error) {
      wx.showToast({ title: error.message || "报告加载失败", icon: "none" });
    }
  },

  onCoachObservation(event) {
    this.setData({ coachObservation: event.detail.value });
  },

  onStageGoal(event) {
    this.setData({ stageGoal: event.detail.value });
  },

  onConstraints(event) {
    this.setData({ constraints: event.detail.value });
  },

  onWeeks(event) {
    this.setData({ weeks: Number(event.detail.value) });
  },

  async generateOutline() {
    const { reportId, coachObservation, stageGoal, constraints, weeks } = this.data;
    if (!coachObservation.trim()) {
      wx.showToast({ title: "请先填写教练对学员的认知", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    try {
      const outline = await dataService.generateTeachingOutline(reportId, {
        coachObservation,
        stageGoal,
        constraints,
        weeks
      });
      dataService.trackEvent("teaching_outline_generate", {
        page: "teaching-outline",
        reportId,
        properties: {
          weeks,
          hasCoachObservation: true
        }
      });
      this.setData({ outline, loading: false });
      wx.showToast({ title: "已生成大纲", icon: "success" });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "生成失败", icon: "none" });
    }
  }
});
