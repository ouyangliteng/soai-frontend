const dataService = require("../../utils/data-service");

const feedItems = [
  {
    id: "event_202606",
    type: "赛事",
    source: "SOAI 赛事观察",
    title: "俱乐部基础训练赛进入报名准备期",
    summary: "本周建议教练优先复核学员最近一次训练报告，把节奏、骑坐稳定和转弯路线转成参赛准备清单。",
    tags: ["基础训练赛", "报名准备", "训练复盘"],
    timeText: "刚刚",
    stats: {
      repost: 18,
      comment: 9,
      like: 86
    }
  },
  {
    id: "news_safety",
    type: "业内新闻",
    source: "马术安全快讯",
    title: "青少年训练安全装备检查成为课前固定流程",
    summary: "行业讨论重点从单次装备购买，转向课前检查、教练提醒和课后视频复盘的闭环服务。",
    tags: ["安全装备", "青少年训练", "服务闭环"],
    timeText: "12 分钟前",
    stats: {
      repost: 24,
      comment: 15,
      like: 124
    }
  },
  {
    id: "news_training",
    type: "业内新闻",
    source: "SOAI 教学观察",
    title: "AI 视频分析开始进入马术教学辅助场景",
    summary: "更适合先做姿态识别、问题点归纳和教练复核辅助，不替代教练现场判断，是训练服务数字化的第一步。",
    tags: ["AI 教学", "姿态识别", "教练复核"],
    timeText: "36 分钟前",
    stats: {
      repost: 31,
      comment: 22,
      like: 168
    }
  },
  {
    id: "event_july",
    type: "赛事",
    source: "SOAI 赛事日历",
    title: "暑期公开课赛程可按学员等级分组",
    summary: "建议按基础快步、初级进阶、初级路线三个层级设计展示任务，便于家长看见阶段性训练成果。",
    tags: ["暑期公开课", "等级分组", "家长沟通"],
    timeText: "1 小时前",
    stats: {
      repost: 12,
      comment: 7,
      like: 73
    }
  }
];

const normalizedFeedItems = feedItems.map((item) => ({
  ...item,
  sourceInitial: item.source.slice(0, 1)
}));

Page({
  data: {
    role: "student",
    feedItems: normalizedFeedItems,
    filter: "all",
    filterTabs: [
      { key: "all", label: "全部" },
      { key: "event", label: "赛事" },
      { key: "news", label: "业内新闻" }
    ],
    visibleFeed: normalizedFeedItems
  },

  onShow() {
    const session = dataService.getCurrentSession();
    this.setData({
      role: session.role === "coach" ? "coach" : "student"
    });
    dataService.trackEvent("home_feed_view", {
      page: "coach",
      properties: {
        role: session.role || "student",
        filter: this.data.filter,
        feedCount: this.data.visibleFeed.length
      }
    });
  },

  changeFilter(event) {
    const filter = event.currentTarget.dataset.filter;
    const visibleFeed = filter === "all"
      ? this.data.feedItems
      : this.data.feedItems.filter((item) => filter === "event" ? item.type === "赛事" : item.type === "业内新闻");
    this.setData({ filter, visibleFeed });
  },

  refreshFeed() {
    wx.showToast({ title: "已刷新首页信息流", icon: "none" });
    dataService.trackEvent("home_feed_refresh", {
      page: "coach",
      properties: {
        role: this.data.role
      }
    });
  },

  goTraining() {
    wx.switchTab({ url: "/pages/home/home" });
  },

  goEvents() {
    wx.switchTab({ url: "/pages/trends/trends" });
  }
});
