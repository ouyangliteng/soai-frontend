const dataService = require("../../utils/data-service");

Page({
  data: {
    role: "student",
    limit: 5,
    trend: {
      items: [],
      summary: ""
    },
    stats: {
      recordCount: 0,
      reviewedCount: 0,
      latestScore: 0,
      pendingCount: 0
    }
  },

  onShow() {
    this.loadTrend();
  },

  async loadTrend() {
    try {
      const session = dataService.getCurrentSession();
      const trend = await dataService.getTrend(this.data.limit);
      const items = (trend.items || []).slice().reverse().map((item) => ({
        ...item,
        displayDate: item.reportTimeText || item.trainingDate,
        score: item.summary ? item.summary.overallScore : item.overallScore,
        conclusion: item.summary ? item.summary.oneLineConclusion : "",
        coachReviewText: item.coachReview || "等待教练批复",
        coachStatusText: item.coachReviewStatus === "reviewed" ? "已批复" : "待批复",
        focusText: item.coachFocusItems && item.coachFocusItems.length
          ? item.coachFocusItems.join("、")
          : ((item.nextTrainingFocus || []).slice(0, 2).join("、") || "待教练确认训练重点")
      }));
      dataService.trackEvent("trend_view", {
        page: "trends",
        properties: {
          limit: this.data.limit,
          recordCount: items.length
        }
      });
      this.setData({
        role: session.role === "coach" ? "coach" : "student",
        trend: {
          ...trend,
          items
        },
        stats: buildStats(items)
      });
    } catch (error) {
      wx.showToast({ title: error.message || "趋势加载失败", icon: "none" });
    }
  },

  changeLimit(event) {
    const limit = Number(event.currentTarget.dataset.limit);
    this.setData({ limit }, () => this.loadTrend());
  },

  goReport(event) {
    const reportId = event.currentTarget.dataset.id;
    if (!reportId) return;
    wx.navigateTo({ url: `/pages/report/report?id=${reportId}` });
  }
});

function buildStats(items) {
  return {
    recordCount: items.length,
    reviewedCount: items.filter((item) => item.coachReviewStatus === "reviewed").length,
    latestScore: items[0] ? items[0].score : 0,
    pendingCount: items.filter((item) => item.coachReviewStatus !== "reviewed").length
  };
}
