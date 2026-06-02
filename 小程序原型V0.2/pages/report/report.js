const dataService = require("../../utils/data-service");

Page({
  data: {
    role: "student",
    report: null,
    coachComment: "",
    coachFocusText: "",
    displayCoachFocusItems: [],
    teachingOutline: null,
    outlinePreviewWeeks: [],
    studentExplanation: null,
    productSuggestions: null,
    poseAnalytics: null,
    draftLoading: false,
    readCompleteTracked: false
  },

  readTimer: null,

  async onLoad(options) {
    try {
      const session = dataService.getCurrentSession();
      const report = await dataService.getReport(options.id);
      const teachingOutline = await loadReportTeachingOutline(report);
      this.setData({
        role: session.role === "coach" ? "coach" : "student",
        report,
        teachingOutline,
        outlinePreviewWeeks: buildOutlinePreviewWeeks(teachingOutline),
        displayCoachFocusItems: buildDisplayCoachFocusItems(report),
        poseAnalytics: buildPoseAnalytics(report),
        coachComment: report && report.coachReview ? report.coachReview : "",
        coachFocusText: report && report.coachFocusItems ? report.coachFocusItems.join("、") : ""
      });
      dataService.trackEvent("report_view", {
        page: "report",
        reportId: report.id
      });
      this.loadStudentExplanation(report.id);
      this.loadProductSuggestions(report.id);
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

  async loadProductSuggestions(reportId) {
    try {
      const productSuggestions = await dataService.getProductSuggestions(reportId);
      this.setData({ productSuggestions });
    } catch (error) {
      this.setData({ productSuggestions: null });
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
    if (this.data.role !== "coach") return;
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
      const teachingOutline = await loadReportTeachingOutline(nextReport);
      dataService.trackEvent("coach_review_submit", {
        page: "report",
        reportId: report.id,
        properties: {
          focusCount: focusItems.length
        }
      });
      this.setData({
        report: nextReport,
        teachingOutline,
        outlinePreviewWeeks: buildOutlinePreviewWeeks(teachingOutline),
        displayCoachFocusItems: buildDisplayCoachFocusItems(nextReport),
        poseAnalytics: buildPoseAnalytics(nextReport)
      });
      wx.showToast({ title: "已提交", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "提交失败", icon: "none" });
    }
  },

  async generateCoachDraft() {
    const { report } = this.data;
    if (this.data.role !== "coach") return;
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
  },

  goTeachingOutline() {
    if (!this.data.report) return;
    wx.navigateTo({ url: `/pages/teaching-outline/teaching-outline?reportId=${this.data.report.id}` });
  },

  goStudentPlan() {
    const { teachingOutline } = this.data;
    if (!teachingOutline) return;
    wx.navigateTo({ url: `/pages/student-plan/student-plan?id=${teachingOutline.id}` });
  }
});

async function loadReportTeachingOutline(report) {
  if (!report || !report.studentSnapshot) return null;
  const outlines = await dataService.getTeachingOutlines(report.studentSnapshot.id);
  return outlines.find((outline) => outline.reportId === report.id) || outlines[outlines.length - 1] || null;
}

function buildDisplayCoachFocusItems(report) {
  if (!report) return [];
  if (report.coachFocusItems && report.coachFocusItems.length) return report.coachFocusItems;
  return report.nextTrainingFocus || [];
}

function buildOutlinePreviewWeeks(outline) {
  if (!outline || !outline.weeklyPlan) return [];
  return outline.weeklyPlan.map((week) => ({
    week: week.week,
    theme: week.theme,
    studentTaskText: week.studentTasks && week.studentTasks.length ? week.studentTasks[0] : "",
    coachTaskText: week.coachTasks && week.coachTasks.length ? week.coachTasks[0] : ""
  }));
}

function buildPoseAnalytics(report) {
  if (!report || !report.scores) return null;
  const scores = report.scores;
  const durationSec = clamp(Number(report.videoDurationSec || 38), 10, 60);
  const currentSec = clamp(Math.round(durationSec * 0.32), 3, durationSec);
  const totalFrames = durationSec * 10;
  const currentFrame = Math.min(totalFrames, Math.max(1, currentSec * 10 + 8));
  const head = clamp(Math.round((100 - scores.safetyAwareness) / 2.6), 0, 12);
  const upperBody = clamp(Math.round((100 - scores.postureControl) / 14), 0, 8);
  const upperArm = clamp(Math.round(100 - scores.aidAccuracy), 0, 50);
  const forearm = clamp(40 + Math.round((100 - scores.rhythmControl) * 0.85), 40, 90);
  const lowerLeg = clamp(Math.round((100 - scores.stability) / 6), 0, 12);
  const knee = clamp(Math.round((100 - scores.stability) / 5), 0, 15);

  return {
    frames: {
      current: currentFrame,
      total: totalFrames
    },
    videoTimeText: `${formatTime(currentSec)} / ${formatTime(durationSec)}`,
    confidence: `${clamp(Math.round((scores.postureControl + scores.rhythmControl + scores.stability) / 3 + 10), 70, 98)}%`,
    tracking: report.riskPoints && report.riskPoints.length > 1 ? "Attention" : "Stable",
    view: "Left",
    angles: {
      head,
      upperBody,
      upperArm,
      forearm,
      lowerLeg,
      knee
    },
    metrics: {
      overall: report.summary.overallScore,
      balance: scores.rhythmControl,
      alignment: scores.postureControl,
      symmetry: scores.aidAccuracy,
      stability: scores.stability
    }
  };
}

function formatTime(seconds) {
  return `0:${String(seconds).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
