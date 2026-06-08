const {
  buildReportInput,
  generateTrainingReport,
  validateTrainingReport
} = require("./ai-agents");
const fs = require("fs");
const path = require("path");

const now = () => new Date().toISOString();
const STORAGE_ROOT = process.env.SOAI_STORAGE_ROOT || path.join(__dirname, "..", "storage");
const DB_FILE = process.env.SOAI_DB_FILE || path.join(STORAGE_ROOT, "db", "soai-db.json");
const PERSISTENCE_ENABLED = process.env.SOAI_PERSISTENCE_DISABLED !== "1" && (
  process.env.NODE_ENV === "production" || Boolean(process.env.SOAI_DB_FILE)
);

const profile = {
  id: "student_001",
  userId: "wx_user_001",
  name: "王小涵",
  avatarUrl: "",
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
  profiles: {
    [profile.id]: profile
  },
  videos: [],
  tasks: [],
  reports: [],
  poseDetections: [],
  ruleResults: [],
  reviews: [],
  reviewAnnotations: [],
  assignments: [],
  teachingOutlines: [],
  analyticsEvents: [],
  feedbackItems: [],
  courses: [],
  products: [],
  adminContent: [],
  adminSettings: {
    homepageHeroTitle: "SOAI 马术 AI 教学辅助系统",
    homepageHeroSubtitle: "上传训练视频，获得结构化训练报告与教练复核建议。",
    ossBucket: process.env.ALIYUN_OSS_BUCKET || "",
    ossRegion: process.env.ALIYUN_OSS_REGION || "",
    ossEndpoint: process.env.ALIYUN_OSS_ENDPOINT || "",
    videoProvider: process.env.SOAI_VIDEO_PROVIDER || "local",
    updatedAt: now()
  }
};

function seed() {
  if (db.reports.length > 0) return;
  db.reports.push(
    createReport("report_001", "video_seed_001", "task_seed_001", "2026-05-18", 76, 72, 78, 74, 2, "reviewed"),
    createReport("report_002", "video_seed_002", "task_seed_002", "2026-05-22", 79, 76, 80, 77, 2, "reviewed"),
    createReport("report_003", "video_seed_003", "task_seed_003", "2026-05-26", 81, 78, 83, 79, 1, "reviewed"),
    createReport("report_004", "video_seed_004", "task_seed_004", "2026-05-30", 82, 80, 84, 78, 1, "pending")
  );
  db.courses.push(
    {
      id: "course_001",
      title: "基础骑乘姿态训练",
      category: "AI 教学",
      status: "published",
      videoId: "video_seed_001",
      coverUrl: "",
      description: "面向初级进阶学员的姿态稳定与节奏训练。",
      sort: 10,
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: "course_002",
      title: "马术充气护甲使用说明",
      category: "产品教学",
      status: "draft",
      videoId: "",
      coverUrl: "",
      description: "护甲穿戴、触发边界和安全提醒。",
      sort: 20,
      createdAt: now(),
      updatedAt: now()
    }
  );
  db.products.push(
    {
      id: "product_001",
      name: "SOAI 马术充气护甲",
      category: "安全防护",
      status: "active",
      channel: "天猫旗舰店",
      description: "面向训练和日常骑乘的安全防护产品。",
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: "product_002",
      name: "SOAI 马术教学耳机",
      category: "教学通信",
      status: "planning",
      channel: "微信群/小程序",
      description: "面向教练现场指导和学员实时反馈的教学辅助设备。",
      createdAt: now(),
      updatedAt: now()
    }
  );
  db.adminContent.push(
    {
      id: "content_001",
      channel: "小红书",
      title: "上传一段马术训练视频，AI 报告能看出什么？",
      status: "reviewing",
      owner: "内容运营",
      publishAt: "",
      boundary: "需确认案例授权，避免夸大 AI 准确性。",
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: "content_002",
      channel: "微信群",
      title: "二次上传提醒与报告反馈收集",
      status: "scheduled",
      owner: "社群运营",
      publishAt: "",
      boundary: "提醒 AI 仅作教学辅助，最终以教练现场判断为准。",
      createdAt: now(),
      updatedAt: now()
    }
  );
}

function loadDb() {
  if (!PERSISTENCE_ENABLED || !fs.existsSync(DB_FILE)) return;
  try {
    const saved = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    Object.keys(db).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(saved, key)) {
        db[key] = saved[key];
      }
    });
  } catch (error) {
    console.warn(`SOAI DB 持久化文件读取失败，将使用种子数据：${error.message}`);
  }
}

function saveDb() {
  if (!PERSISTENCE_ENABLED) return;
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify({
    version: 1,
    savedAt: now(),
    profile: db.profile,
    profiles: db.profiles,
    videos: db.videos,
    tasks: db.tasks,
    reports: db.reports,
    poseDetections: db.poseDetections,
    ruleResults: db.ruleResults,
    reviews: db.reviews,
    reviewAnnotations: db.reviewAnnotations,
    assignments: db.assignments,
    teachingOutlines: db.teachingOutlines,
    analyticsEvents: db.analyticsEvents,
    feedbackItems: db.feedbackItems,
    courses: db.courses,
    products: db.products,
    adminContent: db.adminContent,
    adminSettings: db.adminSettings
  }, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}

function ensureStudentProfile(studentId, patch = {}) {
  if (!db.profiles) db.profiles = {};
  if (!db.profiles[studentId]) {
    db.profiles[studentId] = {
      ...profile,
      id: studentId,
      userId: patch.userId || `wx_${studentId}`,
      name: patch.name || "内测学员",
      avatarUrl: patch.avatarUrl || "",
      phone: patch.phone || "",
      coachId: patch.coachId || "",
      coachName: patch.coachName || "",
      clubId: patch.clubId || "",
      clubName: patch.clubName || "",
      createdAt: now(),
      updatedAt: now()
    };
  } else {
    Object.assign(db.profiles[studentId], patch, {
      id: studentId,
      updatedAt: now()
    });
  }
  return db.profiles[studentId];
}

function getStudentProfile(studentId) {
  if (db.profiles && db.profiles[studentId]) return db.profiles[studentId];
  if (studentId === db.profile.id) return db.profile;
  return ensureStudentProfile(studentId);
}

function createReport(id, videoId, taskId, trainingDate, overallScore, postureControl, rhythmControl, stability, riskCount, coachReviewStatus = "pending") {
  const createdAt = now();
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
    reportTime: createdAt,
    videoAvailableUntil: "",
    videoVisibleToday: false,
    createdAt
  };
}

function createReportFromTask(task) {
  const video = db.videos.find((item) => item.id === task.videoId);
  const reportProfile = getStudentProfile(video ? video.studentId : task.studentId);
  const history = db.reports.filter((report) => report.studentId === reportProfile.id).slice(-5);
  const reportCreatedAt = new Date();
  const today = reportCreatedAt;
  const trainingDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const videoAvailableUntil = getNextDayIso(reportCreatedAt);
  const input = buildReportInput({
    profile: reportProfile,
    video,
    history
  });
  const aiReport = generateTrainingReport(input);
  const validation = validateTrainingReport(aiReport);
  if (!validation.valid) {
    throw new Error(`AI 报告校验失败：${validation.issues.join("；")}`);
  }
  const report = {
    id: `report_${Date.now()}`,
    studentId: reportProfile.id,
    videoId: task.videoId,
    taskId: task.id,
    studentSnapshot: { ...reportProfile },
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
    videoPath: video ? video.storageUrl || video.fileUrl : "",
    videoStorageUrl: video ? video.storageUrl || video.fileUrl : "",
    videoDurationSec: video ? video.durationSec : 0,
    videoSizeMb: video ? video.sizeMb : 0,
    videoUploadStatus: video ? video.uploadStatus : "",
    videoAvailableUntil,
    videoVisibleToday: true,
    videoExcerptStartSec: 0,
    videoExcerptDurationSec: 10,
    videoExcerptEndSec: video ? Math.min(10, video.durationSec || 10) : 10,
    coachReviewStatus: "pending",
    coachReview: "",
    coachFocusItems: [],
    reportTime: reportCreatedAt.toISOString(),
    createdAt: reportCreatedAt.toISOString()
  };
  db.reports.push(report);
  saveDb();
  return report;
}

function createReportFromAnalysis({ task, video, aiReport, poseSummary, frames, poseFrames, ruleResults }) {
  const reportProfile = getStudentProfile(video ? video.studentId : task.studentId);
  const reportCreatedAt = new Date();
  const today = reportCreatedAt;
  const trainingDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const videoAvailableUntil = getNextDayIso(reportCreatedAt);
  const report = {
    id: `report_${Date.now()}`,
    studentId: reportProfile.id,
    videoId: task.videoId,
    taskId: task.id,
    studentSnapshot: { ...reportProfile },
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
    poseSummary,
    ruleResults,
    frameSummary: {
      frameCount: frames.length,
      firstFrameAtMs: frames[0] ? frames[0].timestampMs : 0,
      lastFrameAtMs: frames[frames.length - 1] ? frames[frames.length - 1].timestampMs : 0
    },
    videoPath: video ? video.storageUrl || video.fileUrl : "",
    videoStorageUrl: video ? video.storageUrl || video.fileUrl : "",
    videoDurationSec: video ? video.durationSec : 0,
    videoSizeMb: video ? video.sizeMb : 0,
    videoUploadStatus: video ? video.uploadStatus : "",
    videoAvailableUntil,
    videoVisibleToday: true,
    videoExcerptStartSec: 0,
    videoExcerptDurationSec: 10,
    videoExcerptEndSec: video ? Math.min(10, video.durationSec || 10) : 10,
    coachReviewStatus: "pending",
    coachReview: "",
    coachFocusItems: [],
    reportTime: reportCreatedAt.toISOString(),
    createdAt: reportCreatedAt.toISOString()
  };
  db.poseDetections.push({
    id: `pose_${task.id}`,
    taskId: task.id,
    videoId: task.videoId,
    reportId: report.id,
    frames: poseFrames,
    summary: poseSummary,
    createdAt: now()
  });
  db.ruleResults.push({
    id: `rules_${task.id}`,
    taskId: task.id,
    videoId: task.videoId,
    reportId: report.id,
    items: ruleResults,
    createdAt: now()
  });
  db.reports.push(report);
  saveDb();
  return report;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getNextDayIso(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

seed();
loadDb();

module.exports = {
  db,
  ensureStudentProfile,
  getStudentProfile,
  createReportFromTask,
  createReportFromAnalysis,
  saveDb
};
