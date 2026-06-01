const dataService = require("../../utils/data-service");

Page({
  data: {
    limit: 5,
    trend: {
      items: [],
      summary: ""
    }
  },

  onShow() {
    this.loadTrend();
  },

  async loadTrend() {
    try {
      const trend = await dataService.getTrend(this.data.limit);
      dataService.trackEvent("trend_view", {
        page: "trends",
        properties: {
          limit: this.data.limit,
          recordCount: trend.items.length
        }
      });
      this.setData({
        trend: {
          ...trend,
          items: trend.items.map((item) => ({
            ...item,
            displayDate: item.trainingDate.slice(5)
          }))
        }
      });
    } catch (error) {
      wx.showToast({ title: error.message || "趋势加载失败", icon: "none" });
    }
  },

  changeLimit(event) {
    const limit = Number(event.currentTarget.dataset.limit);
    this.setData({ limit }, () => this.loadTrend());
  }
});
