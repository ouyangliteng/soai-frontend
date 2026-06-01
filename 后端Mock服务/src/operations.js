const { db } = require("./data");
const { getCoachDashboard } = require("./logic");
const { generateOperationContent } = require("./ai-agents");
const { getFeedbackSummary } = require("./analytics");

function getOperationsDashboard() {
  const reports = db.reports;
  const videos = db.videos;
  const tasks = db.tasks;
  const coach = getCoachDashboard();
  const latestReport = reports[reports.length - 1];
  const operationContent = latestReport ? generateOperationContent(latestReport) : null;
  const feedbackSummary = normalizeFeedbackSummary(getFeedbackSummary());

  const uploadSuccessRate = videos.length ? rate(videos.filter((video) => video.uploadStatus === "uploaded").length, videos.length) : 92;
  const analysisSuccessRate = tasks.length ? rate(tasks.filter((task) => task.status === "completed").length, tasks.length) : 88;
  const reportOpenRate = 96;
  const coachReviewRate = reports.length ? rate(reports.filter((report) => report.coachReviewStatus === "reviewed").length, reports.length) : 0;
  const secondUploadCount = reports.length >= 2 ? 1 : 0;

  return {
    generatedAt: new Date().toISOString(),
    phase: "V0.2 内测 / V0.3 教练端准备",
    kpis: [
      { key: "newSignups", label: "新增报名", value: 18, unit: "人", target: 20, status: "good" },
      { key: "uploadSuccessRate", label: "视频上传成功率", value: uploadSuccessRate, unit: "%", target: 90, status: uploadSuccessRate >= 90 ? "good" : "watch" },
      { key: "analysisSuccessRate", label: "AI分析成功率", value: analysisSuccessRate, unit: "%", target: 85, status: analysisSuccessRate >= 85 ? "good" : "watch" },
      { key: "reportOpenRate", label: "报告打开率", value: reportOpenRate, unit: "%", target: 95, status: "good" },
      { key: "coachReviewRate", label: "教练复核率", value: coachReviewRate, unit: "%", target: 60, status: coachReviewRate >= 60 ? "good" : "watch" },
      { key: "secondUploadCount", label: "二次上传人数", value: secondUploadCount, unit: "人", target: 6, status: secondUploadCount >= 6 ? "good" : "watch" }
    ],
    funnel: [
      { label: "内容曝光", value: 12800 },
      { label: "微信群", value: 420 },
      { label: "内测申请", value: 86 },
      { label: "视频上传", value: Math.max(24, videos.length + 24) },
      { label: "报告查看", value: Math.max(23, reports.length + 22) },
      { label: "教练复核", value: Math.max(12, db.reviews.length + 12) },
      { label: "二次上传", value: Math.max(7, secondUploadCount) },
      { label: "产品咨询", value: 5 }
    ],
    channels: [
      { name: "小红书", role: "种草与训练复盘", exposure: 6200, leads: 36, nextAction: "发布 AI 报告案例", status: "active" },
      { name: "抖音", role: "短视频传播", exposure: 4800, leads: 22, nextAction: "剪 30 秒报告生成过程", status: "active" },
      { name: "微信视频号", role: "私域信任", exposure: 1800, leads: 18, nextAction: "教练讲解复核逻辑", status: "active" },
      { name: "微信群", role: "内测承接", exposure: 420, leads: 28, nextAction: "提醒二次上传", status: "watch" },
      { name: "天猫旗舰店", role: "硬件销售承接", exposure: 260, leads: 5, nextAction: "补充护甲风险意识内容", status: "watch" }
    ],
    contentQueue: buildContentQueue(operationContent),
    feedbackSummary,
    risks: [
      { level: "medium", title: "AI 表达风险", detail: "所有公开内容需避免“替代教练”“绝对准确”等表述。", owner: "内容运营" },
      { level: "high", title: "视频授权", detail: "训练视频用于案例发布前必须获得学员或家长授权。", owner: "运营负责人" },
      { level: "medium", title: "上传失败", detail: "上传失败用户需要私域跟进，避免首轮内测流失。", owner: "产品/客服" }
    ],
    coachStats: coach.stats,
    dailySeries: [
      { date: "05-26", uploads: 2, reports: 2, reviews: 1 },
      { date: "05-27", uploads: 3, reports: 3, reviews: 2 },
      { date: "05-28", uploads: 4, reports: 4, reviews: 3 },
      { date: "05-29", uploads: 3, reports: 3, reviews: 2 },
      { date: "05-30", uploads: 5, reports: 5, reviews: 3 },
      { date: "05-31", uploads: 4, reports: 4, reviews: 4 },
      { date: "06-01", uploads: Math.max(2, videos.length), reports: Math.max(2, reports.length), reviews: Math.max(1, db.reviews.length) }
    ]
  };
}

function getOperationsDailyReport() {
  const dashboard = getOperationsDashboard();
  const kpiMap = Object.fromEntries(dashboard.kpis.map((item) => [item.key, item]));
  const watchKpis = dashboard.kpis.filter((item) => item.status === "watch");
  const highRisks = dashboard.risks.filter((item) => item.level === "high");
  const feedback = dashboard.feedbackSummary;
  const coachReviewRate = kpiMap.coachReviewRate ? kpiMap.coachReviewRate.value : 0;
  const uploadSuccessRate = kpiMap.uploadSuccessRate ? kpiMap.uploadSuccessRate.value : 0;
  const analysisSuccessRate = kpiMap.analysisSuccessRate ? kpiMap.analysisSuccessRate.value : 0;
  const secondUploadCount = kpiMap.secondUploadCount ? kpiMap.secondUploadCount.value : 0;

  return {
    date: dashboard.generatedAt.slice(0, 10),
    phase: dashboard.phase,
    conclusion: buildDailyConclusion({ uploadSuccessRate, analysisSuccessRate, coachReviewRate, feedback, watchKpis }),
    goStatus: watchKpis.length > 0 || highRisks.length > 0 ? "conditional_go" : "go",
    metrics: {
      newSignups: kpiMap.newSignups ? kpiMap.newSignups.value : 0,
      uploadSuccessRate,
      analysisSuccessRate,
      reportOpenRate: kpiMap.reportOpenRate ? kpiMap.reportOpenRate.value : 0,
      coachReviewRate,
      secondUploadCount,
      feedbackCount: feedback.count,
      averageUsefulness: feedback.averageUsefulness
    },
    reviewQuestions: [
      buildQuestion("今天有没有用户卡在上传前？", uploadSuccessRate >= 90 ? "未见明显集中卡点" : "需要排查上传前校验和网络提示"),
      buildQuestion("今天有没有视频上传失败后无法恢复？", uploadSuccessRate >= 90 ? "失败风险可控" : "需要运营逐一跟进失败用户"),
      buildQuestion("今天 AI 报告是否明显不相关？", feedback.averageAccuracy >= 4 ? "教练反馈整体可参考" : "需要抽样复核报告准确性"),
      buildQuestion("今天教练是否认可报告主要问题点？", coachReviewRate >= 60 ? "复核参与度达标" : "需要提醒教练完成待复核报告"),
      buildQuestion("今天学员是否能理解下次训练重点？", feedback.averageUsefulness >= 4 ? "训练价值反馈较好" : "需要优化报告语言和训练建议"),
      buildQuestion("今天是否有人完成第二次上传？", secondUploadCount > 0 ? "已有二次上传信号" : "需要微信群提醒二次上传")
    ],
    topFeedbackTags: Object.entries(feedback.tagCounts || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count })),
    risks: dashboard.risks,
    nextActions: buildNextActions({ uploadSuccessRate, analysisSuccessRate, coachReviewRate, feedback, secondUploadCount, highRisks })
  };
}

function buildDailyConclusion({ uploadSuccessRate, analysisSuccessRate, coachReviewRate, feedback, watchKpis }) {
  if (uploadSuccessRate < 90 || analysisSuccessRate < 85) {
    return "主链路仍需优先排查，暂不建议扩大内测规模。";
  }
  if (coachReviewRate < 60) {
    return "学员端链路基本可用，但教练复核参与度不足，需运营提醒。";
  }
  if (feedback.averageUsefulness && feedback.averageUsefulness < 4) {
    return "链路可用，但报告训练价值反馈不足，需要优化报告表达。";
  }
  if (watchKpis.length > 0) {
    return "主链路可继续内测，需关注未达标指标。";
  }
  return "今日主链路表现稳定，可以继续推进当前内测节奏。";
}

function buildQuestion(question, answer) {
  return { question, answer };
}

function buildNextActions({ uploadSuccessRate, analysisSuccessRate, coachReviewRate, feedback, secondUploadCount, highRisks }) {
  const actions = [];
  if (uploadSuccessRate < 90) actions.push("产品/研发排查上传失败原因，运营跟进失败用户重新上传。");
  if (analysisSuccessRate < 85) actions.push("AI 服务侧抽查失败任务，确认是否为视频质量或任务超时。");
  if (coachReviewRate < 60) actions.push("运营提醒教练完成待复核报告，优先处理含风险点报告。");
  if (secondUploadCount <= 0) actions.push("微信群发布二次上传提醒，强调趋势需要至少 2 次训练数据。");
  if (feedback.averageUsefulness && feedback.averageUsefulness < 4) actions.push("产品优化报告语言，让下次训练重点更具体。");
  if (highRisks.length > 0) actions.push("发布前逐条确认高风险项，尤其是视频授权和公开案例边界。");
  if (!actions.length) actions.push("继续按当前内测节奏推进，沉淀 3 到 5 个可复核训练案例。");
  return actions;
}

function normalizeFeedbackSummary(summary) {
  if (summary.count > 0) return summary;
  return {
    count: 8,
    averageRating: 4.5,
    averageAccuracy: 4.2,
    averageUsefulness: 4.6,
    tagCounts: {
      "建议可执行": 4,
      "问题准确": 3,
      "视频角度不足": 2,
      "想继续上传": 2,
      "想咨询装备": 1
    },
    latest: [
      {
        id: "feedback_seed_001",
        role: "coach",
        rating: 5,
        usefulnessRating: 5,
        comment: "问题点有参考价值，建议继续补充视频角度说明。",
        tags: ["问题准确", "视频角度不足"],
        createdAt: new Date().toISOString()
      },
      {
        id: "feedback_seed_002",
        role: "student",
        rating: 4,
        usefulnessRating: 5,
        comment: "能看懂下次重点，希望训练建议再具体一点。",
        tags: ["建议具体", "想继续上传"],
        createdAt: new Date().toISOString()
      }
    ]
  };
}

function buildContentQueue(operationContent) {
  return [
    {
      channel: "小红书",
      title: operationContent ? operationContent.xiaohongshu.title : "上传一段马术训练视频，AI 报告能看出什么？",
      status: "待审核",
      owner: "内容运营",
      boundary: "需确认案例授权"
    },
    {
      channel: "抖音",
      title: operationContent ? operationContent.douyin.title : "30 秒看懂 AI 马术训练报告",
      status: "脚本完成",
      owner: "短视频运营",
      boundary: "避免夸大 AI 准确性"
    },
    {
      channel: "微信群",
      title: "二次上传提醒与报告反馈收集",
      status: "今日发送",
      owner: "社群运营",
      boundary: "提醒 AI 仅作教学辅助"
    }
  ];
}

function rate(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

module.exports = {
  getOperationsDashboard,
  getOperationsDailyReport
};
