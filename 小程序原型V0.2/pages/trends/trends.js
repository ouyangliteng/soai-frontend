const dataService = require("../../utils/data-service");

Page({
  data: {
    role: "student",
    limit: 5,
    eventTypeIndex: 0,
    eventTypes: [
      { label: "全部赛事", value: "all" },
      { label: "俱乐部训练赛", value: "club" },
      { label: "测评挑战", value: "assessment" }
    ],
    eventTypeLabel: "全部赛事",
    eventStats: {},
    events: [],
    trend: {
      items: [],
      summary: ""
    }
  },

  onShow() {
    const session = dataService.getCurrentSession();
    if (session.role === "coach") {
      this.loadCoachEvents();
      return;
    }
    this.loadTrend();
  },

  async loadCoachEvents() {
    try {
      const dashboard = await dataService.getCoachDashboard();
      const allEvents = this.buildCoachEvents(dashboard.students || [], dashboard.stats || {});
      const selectedType = this.data.eventTypes[this.data.eventTypeIndex].value;
      const events = selectedType === "all" ? allEvents : allEvents.filter((item) => item.type === selectedType);
      dataService.trackEvent("coach_event_view", {
        page: "trends",
        properties: {
          eventType: selectedType,
          eventCount: events.length
        }
      });
      this.setData({
        role: "coach",
        events,
        eventTypeLabel: this.data.eventTypes[this.data.eventTypeIndex].label,
        eventStats: {
          studentCount: dashboard.stats.activeStudentCount || 0,
          readyCount: (dashboard.students || []).filter((student) => student.latestScore >= 80).length,
          pendingReviewCount: dashboard.stats.pendingReviewCount || 0,
          eventCount: allEvents.length
        }
      });
    } catch (error) {
      wx.showToast({ title: error.message || "赛事数据加载失败", icon: "none" });
    }
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
        role: "student",
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
  },

  changeEventType(event) {
    const eventTypeIndex = Number(event.detail.value);
    this.setData({
      eventTypeIndex,
      eventTypeLabel: this.data.eventTypes[eventTypeIndex].label
    }, () => this.loadCoachEvents());
  },

  buildCoachEvents(students, stats) {
    const readyStudents = students.filter((student) => student.latestScore >= 80);
    const watchStudents = students.filter((student) => student.latestScore < 80);
    return [
      {
        id: "event_club_001",
        type: "club",
        title: "SOAI 俱乐部基础训练赛",
        date: "2026-06-15",
        status: "准备中",
        focus: "快步节奏、骑坐稳定、转弯路线",
        studentCount: students.length,
        readyText: readyStudents.length ? `${readyStudents.length} 名学员可进入报名准备` : "暂无学员达到报名准备线",
        actionText: "先由教练复核最近报告，再确认参赛项目。"
      },
      {
        id: "event_assessment_001",
        type: "assessment",
        title: "阶段测评挑战",
        date: "2026-06-29",
        status: "可选择",
        focus: "上身稳定、小腿位置、扶助准确性",
        studentCount: Math.max(1, watchStudents.length),
        readyText: watchStudents.length ? `${watchStudents.length} 名学员建议先完成阶段测评` : "当前学员状态较稳定，可作为巩固测评",
        actionText: "适合作为训练计划生成后的阶段检查。"
      },
      {
        id: "event_club_002",
        type: "club",
        title: "暑期俱乐部公开课赛程",
        date: "2026-07-12",
        status: "规划中",
        focus: "课程展示、报告复盘、家长沟通",
        studentCount: stats.activeStudentCount || students.length,
        readyText: "后续可接入正式赛事选择和报名状态。",
        actionText: "先保留为赛事管理入口，方便后续扩展。"
      }
    ];
  }
});
