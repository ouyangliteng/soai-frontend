const dataService = require("../../utils/data-service");

Page({
  data: {
    report: null,
    coachComment: "",
    coachFocusText: "",
    studentExplanation: null,
    draftLoading: false,
    readCompleteTracked: false
  },

  readTimer: null,

  async onLoad(options) {
    try {
      const report = await dataService.getReport(options.id);
      this.setData({
        report,
        coachComment: report && report.coachReview ? report.coachReview : "",
        coachFocusText: report && report.coachFocusItems ? report.coachFocusItems.join("、") : ""
      });
      dataService.trackEvent("report_view", {
        page: "report",
        reportId: report.id
      });
      this.loadStudentExplanation(report.id);
      this.readTimer = setTimeout(() => this.trackReadComplete("timer"), 30000);
    } catch (error) {
      wx.showToast({ title: error.message || "报告加载失败", icon: "none" });
    }
  },

  onUnload() {
    if (this.readTimer) clearTimeout(this.readTimer);
  },

  onReachBottom() {
    this.trackReadComplete("scroll_bottom");
  },

  async loadStudentExplanation(reportId) {
    try {
      const studentExplanation = await dataService.getStudentExplanation(reportId);
      this.setData({ studentExplanation });
    } catch (error) {
      this.setData({ studentExplanation: null });
    }
  },

  onCoachComment(event) {
    this.setData({
      coachComment: event.detail.value
    });
  },

  onCoachFocus(event) {
    this.setData({
      coachFocusText: event.detail.value
    });
  },

  async saveReview() {
    const { report, coachComment, coachFocusText } = this.data;
    if (!coachComment) {
      wx.showToast({ title: "请输入复核意见", icon: "none" });
      return;
    }

    const focusItems = coachFocusText
      .split(/[,，、\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      const nextReport = await dataService.saveCoachReview(report.id, coachComment, focusItems);
      dataService.trackEvent("coach_review_submit", {
        page: "report",
        reportId: report.id,
        properties: {
          focusCount: focusItems.length
        }
      });
      this.setData({ report: nextReport });
      wx.showToast({ title: "已提交", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    }
  },

  async generateCoachDraft() {
    const { report } = this.data;
    if (!report) return;

    this.setData({ draftLoading: true });
    try {
      const draft = await dataService.getCoachReviewDraft(report.id);
      this.setData({
        coachComment: draft.reviewDraft,
        coachFocusText: draft.focusItems.join("、"),
        draftLoading: false
      });
      wx.showToast({ title: "已生成草稿", icon: "none" });
    } catch (error) {
      this.setData({ draftLoading: false });
      wx.showToast({ title: error.message || "草稿生成失败", icon: "none" });
    }
  },

  trackReadComplete(trigger) {
    const { report, readCompleteTracked } = this.data;
    if (!report || readCompleteTracked) return;
    this.setData({ readCompleteTracked: true });
    dataService.trackEvent("report_read_complete", {
      page: "report",
      reportId: report.id,
      properties: {
        trigger
      }
    });
  },

  goFeedback() {
    if (!this.data.report) return;
    wx.navigateTo({ url: `/pages/feedback/feedback?reportId=${this.data.report.id}` });
  }
});
