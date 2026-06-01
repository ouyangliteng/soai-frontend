const dataService = require("../../utils/data-service");

Page({
  data: {
    task: {},
    statusText: "排队中"
  },

  timer: null,

  onShow() {
    const task = dataService.getActiveTask();
    if (!task) {
      wx.redirectTo({ url: "/pages/upload/upload" });
      return;
    }
    this.setData({
      task,
      statusText: this.getStatusText(task.status)
    });
    this.runAnalysis();
  },

  onUnload() {
    if (this.timer) clearTimeout(this.timer);
  },

  async runAnalysis() {
    try {
      const result = await dataService.advanceAnalysisTask();
      if (!result.task || result.task.status === "failed") return;

      this.setData({
        task: result.task,
        statusText: this.getStatusText(result.task.status)
      });

      if (result.reportId) {
        dataService.trackEvent("analysis_success", {
          page: "analysis",
          taskId: result.task.id,
          reportId: result.reportId
        });
        wx.redirectTo({ url: `/pages/report/report?id=${result.reportId}` });
        return;
      }

      this.timer = setTimeout(() => this.runAnalysis(), 900);
    } catch (error) {
      this.setData({
        task: {
          ...this.data.task,
          status: "failed",
          progressText: error.message || "分析失败，请重试"
        },
        statusText: "分析失败"
      });
      dataService.trackEvent("analysis_failed", {
        page: "analysis",
        taskId: this.data.task.id,
        properties: {
          message: error.message || "分析失败"
        }
      });
    }
  },

  getStatusText(status) {
    const map = {
      queued: "排队中",
      analyzing: "AI 分析中",
      generating_report: "生成报告中",
      completed: "分析完成",
      failed: "分析失败"
    };
    return map[status] || "处理中";
  },

  async retry() {
    dataService.trackEvent("retry_click", {
      page: "analysis",
      taskId: this.data.task.id,
      properties: {
        target: "analysis"
      }
    });
    const task = await dataService.retryAnalysisTask(this.data.task);
    this.setData({ task, statusText: "排队中" });
    this.runAnalysis();
  },

  backHome() {
    wx.switchTab({ url: "/pages/home/home" });
  }
});
