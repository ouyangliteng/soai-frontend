const PROFILE_KEY = "soai_student_profile";
const REPORTS_KEY = "soai_training_reports";
const TASK_KEY = "soai_active_analysis_task";
const ASSIGNMENTS_KEY = "soai_training_assignments";

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
    repeatedProblems,
    repeatedRisks
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

module.exports = {
  ensureSeedData,
  getProfile,
  saveProfile,
  getReports,
  getLatestReport,
  getReport,
  saveCoachReview,
  getAssignments,
  addReportFromTask,
  getTrend,
  getCoachDashboard,
  getCoachStudentDetail,
  getActiveTask,
  saveActiveTask,
  clearActiveTask,
  getProfileCompletion
};
