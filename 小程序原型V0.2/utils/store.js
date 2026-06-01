const PROFILE_KEY = "soai_student_profile";
const REPORTS_KEY = "soai_training_reports";
const TASK_KEY = "soai_active_analysis_task";
const ASSIGNMENTS_KEY = "soai_training_assignments";
const TEACHING_OUTLINES_KEY = "soai_teaching_outlines";

const seedProfile = {
  id: "student_demo",
  name: "王小涵",
  age: 14,
  heightCm: 160,
  weightKg: 48,
  ridingYears: 2,
  currentLevel: "初级进阶",
  coachName: "李教练",
  clubName: "SOAI 示例马术俱乐部"
};

const seedReports = [
  createReport("report_001", "2026-05-18", 76, 72, 78, 74, 2),
  createReport("report_002", "2026-05-22", 79, 76, 80, 77, 2),
  createReport("report_003", "2026-05-26", 81, 78, 83, 79, 1),
  createReport("report_004", "2026-05-30", 82, 80, 84, 78, 1)
];

function createReport(id, trainingDate, overallScore, postureControl, rhythmControl, stability, riskCount) {
  return {
    id,
    trainingDate,
    studentSnapshot: seedProfile,
    summary: {
      overallScore,
      oneLineConclusion: "本次训练节奏较稳定，转弯阶段身体控制仍需加强。",
      confidenceLevel: "medium"
    },
    scores: {
      postureControl,
      rhythmControl,
      stability,
      aidAccuracy: Math.max(68, stability - 2),
      safetyAwareness: riskCount > 1 ? 78 : 84
    },
    problemPoints: [
      {
        title: "快步阶段上身略前倾",
        detail: "视频中可见上身重心略向前，可能影响骑坐稳定性。",
        severity: "medium",
        suggestion: "保持肩、髋、脚跟接近垂直线，减少身体主动前压。"
      }
    ],
    riskPoints: [
      {
        title: "小腿位置稳定性需关注",
        detail: "该表现可能影响扶助准确性，建议教练结合现场情况复核。",
        riskLevel: riskCount > 1 ? "medium" : "low"
      }
    ],
    improvements: [
      "节奏控制比上次更连续。",
      "转弯前视线方向更明确。"
    ],
    nextTrainingFocus: [
      "保持上身稳定，减少快步阶段前倾。",
      "练习小腿位置稳定性。",
      "转弯前提前看向行进方向。"
    ],
    coachReviewStatus: id === "report_004" ? "pending" : "reviewed",
    coachReview: id === "report_004" ? "" : "AI 判断基本准确，下次继续关注轻快步节奏。"
  };
}

function ensureSeedData() {
  if (!wx.getStorageSync(PROFILE_KEY)) {
    wx.setStorageSync(PROFILE_KEY, seedProfile);
  }
  if (!wx.getStorageSync(REPORTS_KEY)) {
    wx.setStorageSync(REPORTS_KEY, seedReports);
  }
  if (!wx.getStorageSync(ASSIGNMENTS_KEY)) {
    wx.setStorageSync(ASSIGNMENTS_KEY, []);
  }
  if (!wx.getStorageSync(TEACHING_OUTLINES_KEY)) {
    wx.setStorageSync(TEACHING_OUTLINES_KEY, []);
  }
}

function getProfile() {
  return wx.getStorageSync(PROFILE_KEY) || null;
}

function saveProfile(profile) {
  wx.setStorageSync(PROFILE_KEY, {
    ...profile,
    updatedAt: new Date().toISOString()
  });
}

function getReports() {
  return wx.getStorageSync(REPORTS_KEY) || [];
}

function getLatestReport() {
  const reports = getReports();
  return reports[reports.length - 1] || null;
}

function getReport(id) {
  return getReports().find((report) => report.id === id) || getLatestReport();
}

function saveCoachReview(reportId, comment, focusItems = []) {
  const reports = getReports();
  const nextReports = reports.map((report) => {
    if (report.id !== reportId) return report;
    return {
      ...report,
      coachReviewStatus: "reviewed",
      coachReview: comment,
      coachFocusItems: focusItems.length ? focusItems : report.nextTrainingFocus,
      coachReviewedAt: new Date().toISOString()
    };
  });
  wx.setStorageSync(REPORTS_KEY, nextReports);
  const reviewedReport = nextReports.find((report) => report.id === reportId);
  saveAssignment(reviewedReport, comment, focusItems);
  return reviewedReport;
}

function saveAssignment(report, comment, focusItems) {
  if (!report) return;
  const assignments = wx.getStorageSync(ASSIGNMENTS_KEY) || [];
  const nextAssignment = {
    id: `assignment_${Date.now()}`,
    studentId: report.studentSnapshot.id,
    coachName: report.studentSnapshot.coachName,
    reportId: report.id,
    focusItems: focusItems.length ? focusItems : report.nextTrainingFocus,
    comment,
    status: "active",
    createdAt: new Date().toISOString()
  };
  wx.setStorageSync(ASSIGNMENTS_KEY, assignments.concat(nextAssignment));
}

function getAssignments() {
  return wx.getStorageSync(ASSIGNMENTS_KEY) || [];
}

function generateTeachingOutline(reportId, payload = {}) {
  const report = getReport(reportId);
  if (!report) return null;
  const weeks = clampWeeks(payload.weeks || 4);
  const focusItems = report.coachFocusItems && report.coachFocusItems.length ? report.coachFocusItems : report.nextTrainingFocus.slice(0, 3);
  const outline = {
    id: `outline_${Date.now()}`,
    reportId: report.id,
    studentId: report.studentSnapshot.id,
    title: `${weeks} 周阶段性教学任务大纲`,
    coachObservation: payload.coachObservation || "教练尚未补充学员认知，建议生成后由教练结合现场情况修订。",
    stageGoal: payload.stageGoal || `未来 ${weeks} 周优先提升${focusItems.slice(0, 2).join("、")}。`,
    constraints: payload.constraints || "以安全和基础稳定性为优先，每次训练只抓 1 到 2 个重点。",
    aiBasis: [
      `本次主要问题：${report.problemPoints[0].title}`,
      `风险关注：${report.riskPoints[0] ? report.riskPoints[0].title : "本次未标记中高风险点"}`,
      `趋势依据：${getTrend(5).summary}`
    ],
    safetyBoundary: "AI 只生成教学辅助大纲，不替代教练现场判断。涉及风险动作、马匹状态和训练强度时，必须由教练确认后执行。",
    weeklyPlan: Array.from({ length: weeks }).map((_, index) => buildWeeklyPlanItem(index, focusItems, report)),
    reviewChecklist: [
      "本周训练目标是否被学员理解。",
      "视频报告中的问题点是否在现场复核成立。",
      "风险点是否已转成训练前检查和训练中提醒。",
      "下次上传视频是否能覆盖同类动作，便于趋势对比。"
    ],
    nextUploadRequirement: "建议下次上传 30 到 90 秒同类训练片段，保持相近拍摄角度，便于 AI 和教练对比趋势。",
    mustConfirmByCoach: true,
    createdAt: new Date().toISOString()
  };
  const outlines = getTeachingOutlines();
  wx.setStorageSync(TEACHING_OUTLINES_KEY, outlines.concat(outline));
  return outline;
}

function getTeachingOutlines() {
  return wx.getStorageSync(TEACHING_OUTLINES_KEY) || [];
}

function addReportFromTask(task) {
  const reports = getReports();
  const latest = getLatestReport();
  const nextScore = Math.min(95, latest ? latest.summary.overallScore + 2 : 78);
  const today = new Date();
  const trainingDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const report = createReport(`report_${Date.now()}`, trainingDate, nextScore, nextScore - 2, nextScore + 1, nextScore - 3, 1);
  report.videoName = task.videoName;
  wx.setStorageSync(REPORTS_KEY, reports.concat(report));
  return report;
}

function getTrend(limit = 5) {
  const reports = getReports().slice(-limit);
  if (reports.length < 2) {
    return {
      items: reports,
      summary: "完成 2 次以上训练后生成趋势。"
    };
  }

  const first = reports[0].summary.overallScore;
  const last = reports[reports.length - 1].summary.overallScore;
  const direction = last >= first ? "提升" : "波动";

  return {
    items: reports,
    summary: `最近 ${reports.length} 次训练中，总评分${direction}，节奏控制保持较好，上身稳定性仍需持续观察。`
  };
}

function getCoachDashboard() {
  const reports = getReports();
  const pendingReports = reports
    .filter((report) => report.coachReviewStatus !== "reviewed")
    .map(formatCoachReport)
    .sort((a, b) => b.priorityScore - a.priorityScore);
  const reviewedTodayCount = reports.filter((report) => report.coachReviewedAt && isToday(report.coachReviewedAt)).length;
  const highRiskCount = reports.filter((report) => getReportRiskLevel(report) !== "low").length;
  const latestReport = getLatestReport();

  return {
    stats: {
      pendingReviewCount: pendingReports.length,
      highRiskCount,
      reviewedTodayCount,
      activeStudentCount: 1,
      secondUploadStudentCount: reports.length >= 2 ? 1 : 0
    },
    pendingReports,
    students: [
      {
        ...seedProfile,
        latestReportId: latestReport ? latestReport.id : "",
        latestTrainingDate: latestReport ? latestReport.trainingDate : "",
        latestScore: latestReport ? latestReport.summary.overallScore : 0,
        trendText: getTrend(5).summary,
        pendingReviewCount: pendingReports.length
      }
    ]
  };
}

function getCoachStudentDetail(studentId) {
  const profile = getProfile();
  const reports = getReports();
  const repeatedProblems = collectTopTitles(reports, "problemPoints");
  const repeatedRisks = collectTopTitles(reports, "riskPoints");

  return {
    profile: profile && profile.id === studentId ? profile : seedProfile,
    latestReport: getLatestReport(),
    trend: getTrend(5),
    reports: reports.slice().reverse(),
    assignments: getAssignments(),
    teachingOutlines: getTeachingOutlines().filter((outline) => outline.studentId === (profile && profile.id)),
    repeatedProblems,
    repeatedRisks
  };
}

function buildWeeklyPlanItem(index, focusItems, report) {
  const themes = [
    "建立安全边界和动作基线",
    "强化节奏与骑坐稳定",
    "转化为路线和扶助任务",
    "阶段复盘与下一阶段目标"
  ];
  const problemTitle = report.problemPoints[0].title;
  const riskTitle = report.riskPoints[0] ? report.riskPoints[0].title : "基础安全意识";
  const focus = focusItems[index % focusItems.length] || focusItems[0] || problemTitle;
  return {
    week: index + 1,
    theme: themes[Math.min(index, themes.length - 1)],
    coachTasks: [
      `训练前确认本周主目标：${focus}`,
      `结合现场情况复核“${problemTitle}”是否仍然出现`,
      `将“${riskTitle}”转成训练中的短口令提醒`
    ],
    studentTasks: [
      "训练前复述本周 1 个动作重点。",
      "训练中只关注教练确认的核心提醒，不同时追求过多动作变化。"
    ],
    aiReviewFocus: [
      focus,
      problemTitle,
      riskTitle
    ],
    homework: [
      "课后查看本周报告解读。",
      "记录 1 条自己最能理解的动作提醒。"
    ],
    acceptance: [
      "教练确认本周重点完成情况。",
      "下次视频中同类问题出现频率降低或稳定性提高。"
    ]
  };
}

function formatCoachReport(report) {
  const riskLevel = getReportRiskLevel(report);
  const lowScore = report.summary.overallScore < 70;
  const priorityScore = (riskLevel === "high" ? 100 : riskLevel === "medium" ? 60 : 20) + (lowScore ? 40 : 0);
  return {
    id: report.id,
    studentName: report.studentSnapshot.name,
    currentLevel: report.studentSnapshot.currentLevel,
    trainingDate: report.trainingDate,
    score: report.summary.overallScore,
    riskLevel,
    conclusion: report.summary.oneLineConclusion,
    status: report.coachReviewStatus,
    priorityScore
  };
}

function getReportRiskLevel(report) {
  const levels = report.riskPoints.map((point) => point.riskLevel);
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

function collectTopTitles(reports, key) {
  const counts = {};
  reports.forEach((report) => {
    report[key].forEach((item) => {
      counts[item.title] = (counts[item.title] || 0) + 1;
    });
  });
  return Object.keys(counts)
    .map((title) => ({ title, count: counts[title] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function isToday(value) {
  const input = new Date(value);
  const now = new Date();
  return input.getFullYear() === now.getFullYear() && input.getMonth() === now.getMonth() && input.getDate() === now.getDate();
}

function getActiveTask() {
  return wx.getStorageSync(TASK_KEY) || null;
}

function saveActiveTask(task) {
  wx.setStorageSync(TASK_KEY, task);
}

function clearActiveTask() {
  wx.removeStorageSync(TASK_KEY);
}

function getProfileCompletion(profile) {
  if (!profile) return 0;
  const fields = ["name", "age", "heightCm", "weightKg", "ridingYears", "currentLevel", "coachName", "clubName"];
  const complete = fields.filter((field) => profile[field] !== undefined && profile[field] !== "").length;
  return Math.round((complete / fields.length) * 100);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function clampWeeks(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 4;
  return Math.max(2, Math.min(8, Math.round(numberValue)));
}

module.exports = {
  ensureSeedData,
  getProfile,
  saveProfile,
  getReports,
  getLatestReport,
  getReport,
  saveCoachReview,
  getAssignments,
  generateTeachingOutline,
  getTeachingOutlines,
  addReportFromTask,
  getTrend,
  getCoachDashboard,
  getCoachStudentDetail,
  getActiveTask,
  saveActiveTask,
  clearActiveTask,
  getProfileCompletion
};
