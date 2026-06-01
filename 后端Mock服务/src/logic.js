const { db, createReportFromTask } = require("./data");

function getTrend(studentId, limit = 5) {
  const reports = db.reports
    .filter((report) => report.studentId === studentId)
    .slice(-Number(limit));

  const items = reports.map((report) => ({
    reportId: report.id,
    trainingDate: report.summary.trainingDate,
    overallScore: report.summary.overallScore,
    postureControl: report.scores.postureControl,
    rhythmControl: report.scores.rhythmControl,
    stability: report.scores.stability,
    riskCount: report.riskPoints.length
  }));

  if (items.length < 2) {
    return {
      limit: Number(limit),
      items,
      trendSummary: "完成 2 次以上训练后生成趋势。"
    };
  }

  const first = items[0].overallScore;
  const last = items[items.length - 1].overallScore;
  const direction = last >= first ? "提升" : "波动";

  return {
    limit: Number(limit),
    items,
    trendSummary: `最近 ${items.length} 次训练中，总评分${direction}，节奏控制保持较好，上身稳定性仍需持续观察。`
  };
}

function completeTask(task) {
  if (task.status === "completed") return task;
  const report = createReportFromTask(task);
  task.status = "completed";
  task.progressText = "报告已生成";
  task.reportId = report.id;
  task.updatedAt = new Date().toISOString();
  return task;
}

function getTaskView(task) {
  return {
    taskId: task.id,
    status: task.status,
    progressText: task.progressText,
    reportId: task.reportId || "",
    retryCount: task.retryCount,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function getReportRiskLevel(report) {
  const levels = report.riskPoints.map((point) => point.riskLevel);
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

function formatCoachReport(report) {
  const riskLevel = getReportRiskLevel(report);
  const lowScore = report.summary.overallScore < 70;
  const priorityScore = (riskLevel === "high" ? 100 : riskLevel === "medium" ? 60 : 20) + (lowScore ? 40 : 0);
  return {
    id: report.id,
    studentId: report.studentId,
    studentName: report.studentSnapshot.name,
    currentLevel: report.studentSnapshot.currentLevel,
    trainingDate: report.summary.trainingDate,
    score: report.summary.overallScore,
    riskLevel,
    conclusion: report.summary.oneLineConclusion,
    status: report.coachReviewStatus,
    priorityScore
  };
}

function getCoachDashboard() {
  const pendingReports = db.reports
    .filter((report) => report.coachReviewStatus !== "reviewed")
    .map(formatCoachReport)
    .sort((a, b) => b.priorityScore - a.priorityScore);
  const highRiskCount = db.reports.filter((report) => getReportRiskLevel(report) !== "low").length;
  const reviewedTodayCount = db.reviews.filter((review) => isToday(review.createdAt)).length;
  const latest = db.reports[db.reports.length - 1];

  return {
    stats: {
      coachId: "coach_001",
      pendingReviewCount: pendingReports.length,
      highRiskCount,
      reviewedTodayCount,
      activeStudentCount: 1,
      secondUploadStudentCount: db.reports.length >= 2 ? 1 : 0
    },
    pendingReports,
    activeStudents: [
      {
        ...db.profile,
        latestReportId: latest ? latest.id : "",
        latestTrainingDate: latest ? latest.summary.trainingDate : "",
        latestScore: latest ? latest.summary.overallScore : 0,
        pendingReviewCount: pendingReports.length,
        trendText: getTrend(db.profile.id, 5).trendSummary
      }
    ]
  };
}

function getCoachStudent(studentId) {
  const reports = db.reports.filter((report) => report.studentId === studentId);
  return {
    profile: db.profile,
    latestReport: reports[reports.length - 1] || null,
    trend: getTrend(studentId, 5),
    reports: reports.slice().reverse(),
    repeatedProblems: collectTopTitles(reports, "problemPoints"),
    repeatedRisks: collectTopTitles(reports, "riskPoints"),
    assignments: db.assignments.filter((assignment) => assignment.studentId === studentId),
    teachingOutlines: db.teachingOutlines.filter((outline) => outline.studentId === studentId)
  };
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

function saveCoachReview(reportId, payload) {
  const report = db.reports.find((item) => item.id === reportId);
  if (!report) return null;

  const review = {
    id: `review_${Date.now()}`,
    reportId,
    coachId: "coach_001",
    coachName: report.studentSnapshot.coachName,
    status: payload.status || "reviewed",
    comment: payload.comment || "",
    trainingFocus: payload.trainingFocus || payload.focusItems || [],
    createdAt: new Date().toISOString()
  };

  report.coachReviewStatus = review.status;
  report.coachReview = review.comment;
  report.coachFocusItems = review.trainingFocus;
  report.coachReviewedAt = review.createdAt;
  db.reviews.push(review);

  if (review.trainingFocus.length > 0) {
    db.assignments.push({
      id: `assignment_${Date.now()}`,
      studentId: report.studentId,
      coachId: review.coachId,
      reportId,
      focusItems: review.trainingFocus,
      comment: payload.assignmentComment || review.comment,
      status: "active",
      createdAt: review.createdAt
    });
  }

  return { report, review };
}

function isToday(value) {
  const input = new Date(value);
  const now = new Date();
  return input.getFullYear() === now.getFullYear() && input.getMonth() === now.getMonth() && input.getDate() === now.getDate();
}

module.exports = {
  getTrend,
  completeTask,
  getTaskView,
  getCoachDashboard,
  getCoachStudent,
  formatCoachReport,
  saveCoachReview
};
