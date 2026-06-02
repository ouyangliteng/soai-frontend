const fs = require("fs");
const { db, createReportFromAnalysis, saveDb } = require("./data");
const { runAnalysisPipeline } = require("./analysis-pipeline");

function cleanupExpiredVideos(referenceDate = new Date()) {
  let changed = false;
  db.reports.forEach((report) => {
    if (!report.videoAvailableUntil) return;
    if (new Date(report.videoAvailableUntil).getTime() > referenceDate.getTime()) {
      report.videoVisibleToday = true;
      return;
    }
    if (report.videoVisibleToday || report.videoPath || report.videoStorageUrl) {
      report.videoVisibleToday = false;
      report.videoPath = "";
      report.videoStorageUrl = "";
      changed = true;
    }
  });

  db.videos.forEach((video) => {
    const relatedReport = db.reports.find((report) => report.videoId === video.id);
    if (!relatedReport || !relatedReport.videoAvailableUntil) return;
    if (new Date(relatedReport.videoAvailableUntil).getTime() > referenceDate.getTime()) return;
    if (video.storagePath && fs.existsSync(video.storagePath)) {
      fs.unlinkSync(video.storagePath);
      changed = true;
    }
    if (video.storageUrl || video.storagePath) {
      video.storageUrl = "";
      video.storagePath = "";
      video.uploadStatus = "expired";
      changed = true;
    }
  });

  if (changed) saveDb();
}

function getTrend(studentId, limit = 5) {
  cleanupExpiredVideos();
  const reports = db.reports
    .filter((report) => report.studentId === studentId)
    .slice(-Number(limit));

  const items = reports.map((report) => ({
    id: report.id,
    reportId: report.id,
    trainingDate: report.summary.trainingDate,
    reportTime: report.reportTime || report.createdAt,
    createdAt: report.createdAt,
    overallScore: report.summary.overallScore,
    summary: report.summary,
    scores: report.scores,
    problemPoints: report.problemPoints,
    riskPoints: report.riskPoints,
    improvements: report.improvements,
    nextTrainingFocus: report.nextTrainingFocus,
    coachReviewStatus: report.coachReviewStatus,
    coachReview: report.coachReview,
    coachFocusItems: report.coachFocusItems || [],
    studentSnapshot: report.studentSnapshot,
    videoVisibleToday: Boolean(report.videoVisibleToday && report.videoPath),
    videoAvailableUntil: report.videoAvailableUntil || "",
    videoPath: report.videoVisibleToday ? report.videoPath : "",
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

async function completeTask(task) {
  cleanupExpiredVideos();
  if (task.status === "completed") return task;
  const video = db.videos.find((item) => item.id === task.videoId);
  if (!video) {
    task.status = "failed";
    task.progressText = "未找到视频记录";
    task.errorCode = "VIDEO_NOT_FOUND";
    task.updatedAt = new Date().toISOString();
    saveDb();
    return task;
  }
  await runAnalysisPipeline({
    db,
    task,
    video,
    createReport: createReportFromAnalysis
  });
  saveDb();
  return task;
}

function getTaskView(task) {
  return {
    taskId: task.id,
    status: task.status,
    progress: task.progress || 0,
    progressText: task.progressText,
    reportId: task.reportId || "",
    retryCount: task.retryCount,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    currentStage: task.status,
    analysisSummary: {
      frameCount: task.frames ? task.frames.length : 0,
      poseFrameCount: task.poseDetections ? task.poseDetections.length : 0,
      ruleResultCount: task.ruleResults ? task.ruleResults.length : 0
    },
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

  const annotations = normalizeAnnotations(payload.annotations || payload.ruleAnnotations || [], review, report);
  db.reviewAnnotations.push(...annotations);

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

  saveDb();
  return { report, review, annotations };
}

function normalizeAnnotations(items, review, report) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: `annotation_${Date.now()}_${index + 1}`,
    reviewId: review.id,
    reportId: report.id,
    ruleResultId: item.ruleResultId || item.problemPointId || "",
    coachId: review.coachId,
    label: normalizeAnnotationLabel(item.label),
    correctedProblem: item.correctedProblem || "",
    correctedSuggestion: item.correctedSuggestion || "",
    comment: item.comment || "",
    syncToStudent: item.syncToStudent !== false,
    createdAt: review.createdAt
  }));
}

function normalizeAnnotationLabel(label) {
  const allowed = new Set(["accurate", "partially_accurate", "inaccurate", "bad_angle", "needs_onsite_review"]);
  return allowed.has(label) ? label : "needs_onsite_review";
}

function isToday(value) {
  const input = new Date(value);
  const now = new Date();
  return input.getFullYear() === now.getFullYear() && input.getMonth() === now.getMonth() && input.getDate() === now.getDate();
}

module.exports = {
  cleanupExpiredVideos,
  getTrend,
  completeTask,
  getTaskView,
  getCoachDashboard,
  getCoachStudent,
  formatCoachReport,
  saveCoachReview
};
