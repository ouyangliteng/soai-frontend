const api = require("./api");
const store = require("./store");

const DATA_MODE_KEY = "soai_data_mode";

function getMode() {
  return wx.getStorageSync(DATA_MODE_KEY) || "local";
}

function setMode(mode) {
  wx.setStorageSync(DATA_MODE_KEY, mode === "api" ? "api" : "local");
}

function isApiMode() {
  return getMode() === "api";
}

function getProfileCompletion(profile) {
  return store.getProfileCompletion(profile);
}

async function getProfile() {
  if (!isApiMode()) return store.getProfile();
  const res = await api.getProfile();
  return res.profile;
}

async function saveProfile(profile) {
  if (!isApiMode()) {
    store.saveProfile(profile);
    return { success: true, profile };
  }
  return api.saveProfile(profile);
}

async function getLatestReport() {
  if (!isApiMode()) return store.getLatestReport();
  const dashboard = await api.getCoachDashboard();
  const latestReportId = dashboard.activeStudents && dashboard.activeStudents[0] ? dashboard.activeStudents[0].latestReportId : "";
  if (!latestReportId) return null;
  const res = await api.getReport(latestReportId);
  return normalizeReport(res.report);
}

async function getReport(reportId) {
  if (!isApiMode()) return store.getReport(reportId);
  const res = await api.getReport(reportId);
  return normalizeReport(res.report);
}

async function getTrend(limit = 5, studentId) {
  if (!isApiMode()) return normalizeTrend(store.getTrend(limit));
  const profile = studentId ? { id: studentId } : await getProfile();
  const res = await api.getTrend(profile.id, limit);
  return normalizeTrend(res);
}

function getActiveTask() {
  return store.getActiveTask();
}

function clearActiveTask() {
  store.clearActiveTask();
}

async function createUploadAndAnalysisTask(video) {
  if (!isApiMode()) {
    const task = {
      id: `task_${Date.now()}`,
      status: "queued",
      progress: 0,
      progressText: "训练视频已上传，等待 AI 分析",
      videoName: video.name,
      analysisConsent: Boolean(video.analysisConsent),
      caseConsent: Boolean(video.caseConsent),
      createdAt: new Date().toISOString()
    };
    store.saveActiveTask(task);
    return task;
  }

  const profile = await getProfile();
  const uploadToken = await api.createUploadToken({
    fileName: video.name,
    sizeMb: video.sizeMb,
    durationSec: video.durationSec,
    format: video.format,
    analysisConsent: Boolean(video.analysisConsent),
    caseConsent: Boolean(video.caseConsent)
  });
  await api.updateUploadStatus(uploadToken.videoId, {
    uploadStatus: "uploaded",
    uploadProgress: 100,
    uploadError: ""
  });
  const taskRes = await api.createAnalysisTask({
    videoId: uploadToken.videoId,
    studentId: profile.id
  });
  const task = {
    id: taskRes.taskId,
    status: taskRes.status,
    progress: 0,
    progressText: "训练视频已上传，等待 AI 分析",
    videoName: video.name,
    createdAt: new Date().toISOString()
  };
  store.saveActiveTask(task);
  return task;
}

async function advanceAnalysisTask() {
  const currentTask = store.getActiveTask();
  if (!currentTask) return { task: null, reportId: "" };

  if (!isApiMode()) {
    const progress = Math.min(100, (currentTask.progress || 0) + 25);
    const task = {
      ...currentTask,
      progress,
      status: progress < 50 ? "analyzing" : progress < 100 ? "generating_report" : "completed",
      progressText: progress < 50 ? "AI 正在分析骑乘姿态" : progress < 100 ? "正在生成训练报告" : "报告已生成"
    };
    store.saveActiveTask(task);
    if (progress >= 100) {
      const report = store.addReportFromTask(task);
      store.clearActiveTask();
      return { task, reportId: report.id };
    }
    return { task, reportId: "" };
  }

  const taskRes = await api.getAnalysisTask(currentTask.id);
  const task = {
    ...currentTask,
    id: taskRes.taskId,
    status: taskRes.status,
    progress: taskRes.status === "completed" ? 100 : 50,
    progressText: taskRes.progressText,
    reportId: taskRes.reportId
  };
  if (taskRes.status === "completed") {
    store.clearActiveTask();
    return { task, reportId: taskRes.reportId };
  }
  store.saveActiveTask(task);
  return { task, reportId: "" };
}

async function retryAnalysisTask(task) {
  if (!isApiMode()) {
    const nextTask = {
      ...task,
      status: "queued",
      progress: 0,
      progressText: "重新进入分析队列"
    };
    store.saveActiveTask(nextTask);
    return nextTask;
  }

  const res = await api.retryAnalysisTask(task.id);
  const nextTask = {
    ...task,
    id: res.taskId,
    status: res.status,
    progress: 0,
    progressText: "重新进入分析队列"
  };
  store.saveActiveTask(nextTask);
  return nextTask;
}

async function getCoachDashboard() {
  if (!isApiMode()) return store.getCoachDashboard();
  const dashboard = await api.getCoachDashboard();
  return {
    stats: dashboard.stats,
    pendingReports: dashboard.pendingReports,
    students: dashboard.activeStudents || dashboard.students || []
  };
}

async function getCoachStudentDetail(studentId) {
  if (!isApiMode()) return normalizeCoachStudent(store.getCoachStudentDetail(studentId));
  const detail = await api.getCoachStudent(studentId);
  return normalizeCoachStudent(detail);
}

async function saveCoachReview(reportId, comment, focusItems = []) {
  if (!isApiMode()) return store.saveCoachReview(reportId, comment, focusItems);
  const res = await api.submitCoachReview(reportId, {
    status: "reviewed",
    comment,
    focusItems,
    assignmentComment: comment
  });
  return normalizeReport(res.report);
}

async function getCoachReviewDraft(reportId) {
  if (isApiMode()) return api.getCoachReviewDraft(reportId);
  const report = store.getReport(reportId);
  const focusItems = report.coachFocusItems && report.coachFocusItems.length ? report.coachFocusItems : report.nextTrainingFocus.slice(0, 3);
  return {
    reportId,
    reviewDraft: `AI 对“${report.problemPoints[0].title}”的观察有参考价值，建议结合现场情况复核。下次训练可优先关注${focusItems.join("、")}。`,
    focusItems,
    riskReminder: report.riskPoints.length ? "报告包含风险点，建议教练确认后再同步给学员。" : "本次未出现明显中高风险点，可作为常规复盘参考。",
    mustConfirmByCoach: true
  };
}

async function getStudentExplanation(reportId) {
  if (isApiMode()) return api.getStudentExplanation(reportId);
  const report = store.getReport(reportId);
  return {
    reportId,
    title: "本次训练报告解读",
    explanation: `这次报告的重点不是分数本身，而是${report.problemPoints[0].title}。下次训练可以先关注：${report.nextTrainingFocus.slice(0, 2).join("、")}。风险提示需要结合教练现场判断。`,
    nextAction: "下次训练后继续上传同类视频，系统会生成趋势变化。"
  };
}

async function trackEvent(eventName, payload = {}) {
  if (!isApiMode()) return { success: true };
  try {
    return await api.trackEvent({
      eventName,
      ...payload,
      occurredAt: new Date().toISOString()
    });
  } catch (error) {
    return { success: false, error };
  }
}

async function submitFeedback(payload = {}) {
  if (!isApiMode()) return { success: true };
  try {
    return await api.submitFeedback(payload);
  } catch (error) {
    return { success: false, error };
  }
}

function normalizeReport(report) {
  if (!report) return null;
  return {
    ...report,
    trainingDate: report.trainingDate || (report.summary ? report.summary.trainingDate : "")
  };
}

function normalizeTrend(trend) {
  const items = (trend.items || []).map((item) => {
    if (item.summary) return item;
    return {
      id: item.reportId,
      trainingDate: item.trainingDate,
      summary: {
        overallScore: item.overallScore
      },
      scores: {
        postureControl: item.postureControl,
        rhythmControl: item.rhythmControl,
        stability: item.stability
      },
      riskPoints: new Array(item.riskCount || 0).fill({ riskLevel: "medium" })
    };
  });
  return {
    items,
    summary: trend.summary || trend.trendSummary || ""
  };
}

function normalizeCoachStudent(detail) {
  return {
    ...detail,
    latestReport: normalizeReport(detail.latestReport),
    trend: normalizeTrend(detail.trend || { items: [], summary: "" }),
    reports: (detail.reports || []).map(normalizeReport)
  };
}

module.exports = {
  getMode,
  setMode,
  isApiMode,
  getProfileCompletion,
  getProfile,
  saveProfile,
  getLatestReport,
  getReport,
  getTrend,
  getActiveTask,
  clearActiveTask,
  createUploadAndAnalysisTask,
  advanceAnalysisTask,
  retryAnalysisTask,
  getCoachDashboard,
  getCoachStudentDetail,
  saveCoachReview,
  getCoachReviewDraft,
  getStudentExplanation,
  trackEvent,
  submitFeedback
};
