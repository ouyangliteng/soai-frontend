const {
  buildReportInput,
  generateTrainingReport,
  validateTrainingReport
} = require("./ai-agents");

const now = () => new Date().toISOString();

const profile = {
  id: "student_001",
  userId: "wx_user_001",
  name: "王小涵",
  age: 14,
  heightCm: 160,
  weightKg: 48,
  ridingYears: 2,
  currentLevel: "初级进阶",
  coachId: "coach_001",
  coachName: "李教练",
  clubId: "club_001",
  clubName: "SOAI 示例马术俱乐部",
  createdAt: "2026-06-01T10:00:00+08:00",
  updatedAt: "2026-06-01T10:00:00+08:00"
};

const db = {
  profile,
  videos: [],
  tasks: [],
  reports: [],
  reviews: [],
  assignments: [],
  teachingOutlines: [],
  analyticsEvents: [],
  feedbackItems: []
};

function seed() {
  if (db.reports.length > 0) return;
  db.reports.push(
    createReport("report_001", "video_seed_001", "task_seed_001", "2026-05-18", 76, 72, 78, 74, 2, "reviewed"),
    createReport("report_002", "video_seed_002", "task_seed_002", "2026-05-22", 79, 76, 80, 77, 2, "reviewed"),
    createReport("report_003", "video_seed_003", "task_seed_003", "2026-05-26", 81, 78, 83, 79, 1, "reviewed"),
    createReport("report_004", "video_seed_004", "task_seed_004", "2026-05-30", 82, 80, 84, 78, 1, "pending")
  );
}

function createReport(id, videoId, taskId, trainingDate, overallScore, postureControl, rhythmControl, stability, riskCount, coachReviewStatus = "pending") {
  return {
    id,
    studentId: db.profile.id,
    videoId,
    taskId,
    studentSnapshot: { ...db.profile },
    summary: {
      overallScore,
      oneLineConclusion: "本次训练节奏较稳定，转弯阶段身体控制仍需加强。",
      trainingDate,
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
        evidence: "视频中 00:18-00:24 阶段较明显。",
        suggestion: "下次训练重点保持肩、髋、脚跟接近垂直线。"
      }
    ],
    riskPoints: [
      {
        title: "小腿位置稳定性需关注",
        detail: "该表现可能影响扶助准确性，建议教练结合现场情况复核。",
        riskLevel: riskCount > 1 ? "medium" : "low",
        coachReviewRequired: riskCount > 1
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
    trendSummary: "",
    coachReviewStatus,
    coachReview: coachReviewStatus === "reviewed" ? "AI 判断基本准确，下次继续关注轻快步节奏。" : "",
    coachFocusItems: [],
    createdAt: now()
  };
}

function createReportFromTask(task) {
  const latest = db.reports[db.reports.length - 1];
  const video = db.videos.find((item) => item.id === task.videoId);
  const today = new Date();
  const trainingDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const input = buildReportInput({
    profile: db.profile,
    video,
    history: db.reports.slice(-5)
  });
  const aiReport = generateTrainingReport(input);
  const validation = validateTrainingReport(aiReport);
  if (!validation.valid) {
    throw new Error(`AI 报告校验失败：${validation.issues.join("；")}`);
  }
  const report = {
    id: `report_${Date.now()}`,
    studentId: db.profile.id,
    videoId: task.videoId,
    taskId: task.id,
    studentSnapshot: { ...db.profile },
    summary: {
      ...aiReport.summary,
      trainingDate
    },
    scores: aiReport.scores,
    problemPoints: aiReport.problemPoints,
    riskPoints: aiReport.riskPoints,
    improvements: aiReport.improvements,
    nextTrainingFocus: aiReport.nextTrainingFocus,
    trendSummary: aiReport.trendSummary,
    limitations: aiReport.limitations,
    coachReviewStatus: "pending",
    coachReview: "",
    coachFocusItems: [],
    createdAt: now()
  };
  db.reports.push(report);
  return report;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

seed();

module.exports = {
  db,
  createReportFromTask
};
