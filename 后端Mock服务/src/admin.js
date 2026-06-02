const { db, saveDb } = require("./data");
const { getOperationsDashboard } = require("./operations");
const { getFeedbackSummary } = require("./analytics");

function getAdminOverview() {
  const operations = getOperationsDashboard();
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    storage: getOssStatus(),
    counts: {
      videos: db.videos.length,
      reports: db.reports.length,
      pendingReports: db.reports.filter((item) => item.coachReviewStatus === "pending").length,
      courses: db.courses.length,
      publishedCourses: db.courses.filter((item) => item.status === "published").length,
      products: db.products.length,
      contentItems: db.adminContent.length,
      feedbackItems: db.feedbackItems.length
    },
    kpis: operations.kpis,
    recentVideos: listVideos().slice(0, 6),
    pendingReports: db.reports
      .filter((item) => item.coachReviewStatus === "pending")
      .slice(-6)
      .reverse()
      .map(formatReport),
    feedbackSummary: getFeedbackSummary()
  };
}

function listVideos() {
  return db.videos
    .slice()
    .reverse()
    .map(formatVideo);
}

function listCourses() {
  return db.courses
    .slice()
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    .map((item) => ({ ...item }));
}

function createCourse(payload) {
  const course = {
    id: `course_${Date.now()}`,
    title: String(payload.title || "").trim(),
    category: String(payload.category || "AI 教学").trim(),
    status: normalizeStatus(payload.status, ["draft", "published", "archived"], "draft"),
    videoId: String(payload.videoId || "").trim(),
    coverUrl: String(payload.coverUrl || "").trim(),
    description: String(payload.description || "").trim(),
    sort: Number(payload.sort || db.courses.length * 10 + 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!course.title) return { error: { code: "COURSE_TITLE_REQUIRED", message: "课程标题不能为空。" } };
  db.courses.push(course);
  saveDb();
  return { course };
}

function updateCourse(courseId, payload) {
  const course = db.courses.find((item) => item.id === courseId);
  if (!course) return null;
  ["title", "category", "videoId", "coverUrl", "description"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) course[key] = String(payload[key] || "").trim();
  });
  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    course.status = normalizeStatus(payload.status, ["draft", "published", "archived"], course.status);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "sort")) course.sort = Number(payload.sort || 0);
  course.updatedAt = new Date().toISOString();
  saveDb();
  return course;
}

function listContent() {
  return db.adminContent.slice().reverse().map((item) => ({ ...item }));
}

function createContent(payload) {
  const content = {
    id: `content_${Date.now()}`,
    channel: String(payload.channel || "小红书").trim(),
    title: String(payload.title || "").trim(),
    status: normalizeStatus(payload.status, ["draft", "reviewing", "scheduled", "published"], "draft"),
    owner: String(payload.owner || "运营").trim(),
    publishAt: String(payload.publishAt || "").trim(),
    boundary: String(payload.boundary || "发布前确认授权和 AI 表述边界。").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!content.title) return { error: { code: "CONTENT_TITLE_REQUIRED", message: "内容标题不能为空。" } };
  db.adminContent.push(content);
  saveDb();
  return { content };
}

function listProducts() {
  return db.products.slice().map((item) => ({ ...item }));
}

function createProduct(payload) {
  const product = {
    id: `product_${Date.now()}`,
    name: String(payload.name || "").trim(),
    category: String(payload.category || "产品").trim(),
    status: normalizeStatus(payload.status, ["planning", "active", "paused"], "planning"),
    channel: String(payload.channel || "小程序/天猫旗舰店").trim(),
    description: String(payload.description || "").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!product.name) return { error: { code: "PRODUCT_NAME_REQUIRED", message: "产品名称不能为空。" } };
  db.products.push(product);
  saveDb();
  return { product };
}

function updateSettings(payload) {
  db.adminSettings = {
    ...db.adminSettings,
    homepageHeroTitle: String(payload.homepageHeroTitle || db.adminSettings.homepageHeroTitle || "").trim(),
    homepageHeroSubtitle: String(payload.homepageHeroSubtitle || db.adminSettings.homepageHeroSubtitle || "").trim(),
    ossBucket: String(payload.ossBucket || db.adminSettings.ossBucket || "").trim(),
    ossRegion: String(payload.ossRegion || db.adminSettings.ossRegion || "").trim(),
    ossEndpoint: String(payload.ossEndpoint || db.adminSettings.ossEndpoint || "").trim(),
    videoProvider: String(payload.videoProvider || db.adminSettings.videoProvider || "local").trim(),
    updatedAt: new Date().toISOString()
  };
  saveDb();
  return db.adminSettings;
}

function getOssStatus() {
  const envConfig = {
    bucket: process.env.ALIYUN_OSS_BUCKET || db.adminSettings.ossBucket || "",
    region: process.env.ALIYUN_OSS_REGION || db.adminSettings.ossRegion || "",
    endpoint: process.env.ALIYUN_OSS_ENDPOINT || db.adminSettings.ossEndpoint || "",
    accessKeyConfigured: Boolean(process.env.ALIYUN_ACCESS_KEY_ID),
    secretConfigured: Boolean(process.env.ALIYUN_ACCESS_KEY_SECRET),
    roleArnConfigured: Boolean(process.env.ALIYUN_RAM_ROLE_ARN)
  };
  const missing = [];
  if (!envConfig.bucket) missing.push("ALIYUN_OSS_BUCKET");
  if (!envConfig.region && !envConfig.endpoint) missing.push("ALIYUN_OSS_REGION 或 ALIYUN_OSS_ENDPOINT");
  if (!envConfig.accessKeyConfigured) missing.push("ALIYUN_ACCESS_KEY_ID");
  if (!envConfig.secretConfigured) missing.push("ALIYUN_ACCESS_KEY_SECRET");
  return {
    provider: "aliyun-oss",
    ready: missing.length === 0,
    missing,
    bucket: envConfig.bucket,
    region: envConfig.region,
    endpoint: envConfig.endpoint,
    accessKeyConfigured: envConfig.accessKeyConfigured,
    secretConfigured: envConfig.secretConfigured,
    roleArnConfigured: envConfig.roleArnConfigured,
    recommendation: "MVP 可先登记视频资料；正式上传建议使用 RAM 子账号 + 服务端签名直传 OSS。"
  };
}

function listUsers() {
  const students = new Map();
  students.set(db.profile.id, {
    id: db.profile.id,
    name: db.profile.name,
    role: "student",
    coachName: db.profile.coachName,
    clubName: db.profile.clubName,
    reportCount: 0,
    latestReportAt: "",
    createdAt: db.profile.createdAt,
    updatedAt: db.profile.updatedAt
  });
  db.reports.forEach((report) => {
    const current = students.get(report.studentId) || {
      id: report.studentId,
      name: report.studentSnapshot ? report.studentSnapshot.name : report.studentId,
      role: "student",
      coachName: report.studentSnapshot ? report.studentSnapshot.coachName : "",
      clubName: report.studentSnapshot ? report.studentSnapshot.clubName : "",
      reportCount: 0,
      latestReportAt: "",
      createdAt: report.createdAt,
      updatedAt: report.createdAt
    };
    current.reportCount += 1;
    current.latestReportAt = report.createdAt || report.reportTime || current.latestReportAt;
    students.set(report.studentId, current);
  });
  return { items: Array.from(students.values()) };
}

function formatVideo(video) {
  const report = db.reports.find((item) => item.videoId === video.id);
  return {
    id: video.id,
    fileName: video.fileName,
    studentId: video.studentId,
    coachId: video.coachId,
    durationSec: video.durationSec,
    sizeMb: video.sizeMb,
    format: video.format,
    cameraAngle: video.cameraAngle,
    uploadStatus: video.uploadStatus,
    uploadProgress: video.uploadProgress,
    storageProvider: video.storageProvider,
    storageKey: video.storageKey,
    storageUrl: video.storageUrl,
    analysisConsent: video.analysisConsent,
    caseConsent: video.caseConsent,
    reportId: report ? report.id : "",
    createdAt: video.createdAt,
    uploadedAt: video.uploadedAt || ""
  };
}

function formatReport(report) {
  return {
    id: report.id,
    studentId: report.studentId,
    studentName: report.studentSnapshot ? report.studentSnapshot.name : "",
    overallScore: report.summary ? report.summary.overallScore : 0,
    conclusion: report.summary ? report.summary.oneLineConclusion : "",
    coachReviewStatus: report.coachReviewStatus,
    reportTime: report.reportTime || report.createdAt
  };
}

function normalizeStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

module.exports = {
  getAdminOverview,
  listVideos,
  listCourses,
  createCourse,
  updateCourse,
  listContent,
  createContent,
  listProducts,
  createProduct,
  updateSettings,
  getOssStatus,
  listUsers
};
