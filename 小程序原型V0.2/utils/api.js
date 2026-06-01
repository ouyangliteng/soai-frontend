const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

function getBaseUrl() {
  return wx.getStorageSync("soai_api_base_url") || DEFAULT_BASE_URL;
}

function setBaseUrl(baseUrl) {
  wx.setStorageSync("soai_api_base_url", baseUrl);
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBaseUrl()}${path}`,
      method: options.method || "GET",
      data: options.data || undefined,
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(res.data || { message: "请求失败" });
      },
      fail: reject
    });
  });
}

function getProfile() {
  return request("/api/student/profile");
}

function saveProfile(profile) {
  return request("/api/student/profile", {
    method: "POST",
    data: profile
  });
}

function createUploadToken(video) {
  return request("/api/videos/upload-token", {
    method: "POST",
    data: video
  });
}

function updateUploadStatus(videoId, status) {
  return request(`/api/videos/${videoId}/upload-status`, {
    method: "POST",
    data: status
  });
}

function createAnalysisTask(payload) {
  return request("/api/analysis/tasks", {
    method: "POST",
    data: payload
  });
}

function getAnalysisTask(taskId) {
  return request(`/api/analysis/tasks/${taskId}`);
}

function retryAnalysisTask(taskId) {
  return request(`/api/analysis/tasks/${taskId}/retry`, {
    method: "POST"
  });
}

function getReport(reportId) {
  return request(`/api/reports/${reportId}`);
}

function getTrend(studentId, limit = 5) {
  return request(`/api/students/${studentId}/trends?limit=${limit}`);
}

function getCoachDashboard() {
  return request("/api/coach/dashboard");
}

function getCoachReports(status = "pending") {
  return request(`/api/coach/reports?status=${status}`);
}

function getCoachStudents() {
  return request("/api/coach/students");
}

function getCoachStudent(studentId) {
  return request(`/api/coach/students/${studentId}`);
}

function submitCoachReview(reportId, payload) {
  return request(`/api/coach/reports/${reportId}/review`, {
    method: "POST",
    data: payload
  });
}

function getCoachReviewDraft(reportId) {
  return request(`/api/ai/reports/${reportId}/coach-review-draft`);
}

function getStudentExplanation(reportId) {
  return request(`/api/ai/reports/${reportId}/student-explanation`);
}

function getOperationContent(reportId) {
  return request(`/api/ai/reports/${reportId}/operation-content`);
}

function trackEvent(payload) {
  return request("/api/analytics/events", {
    method: "POST",
    data: payload
  });
}

function submitFeedback(payload) {
  return request("/api/feedback", {
    method: "POST",
    data: payload
  });
}

module.exports = {
  getBaseUrl,
  setBaseUrl,
  request,
  getProfile,
  saveProfile,
  createUploadToken,
  updateUploadStatus,
  createAnalysisTask,
  getAnalysisTask,
  retryAnalysisTask,
  getReport,
  getTrend,
  getCoachDashboard,
  getCoachReports,
  getCoachStudents,
  getCoachStudent,
  submitCoachReview,
  getCoachReviewDraft,
  getStudentExplanation,
  getOperationContent,
  trackEvent,
  submitFeedback
};
