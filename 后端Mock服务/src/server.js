const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");
const { db, ensureStudentProfile, getStudentProfile, saveDb } = require("./data");
const {
  completeTask,
  getTaskView,
  getTrend,
  getCoachDashboard,
  getCoachStudent,
  formatCoachReport,
  saveCoachReview,
  cleanupExpiredVideos
} = require("./logic");
const {
  buildReportInput,
  generateTrainingReport,
  validateTrainingReport,
  draftCoachReview,
  generateTeachingOutline,
  generateStudentExplanation,
  generateOperationContent
} = require("./ai-agents");
const { getOperationsDashboard, getOperationsDailyReport } = require("./operations");
const { getProductSuggestions } = require("./product-suggestions");
const { createUploadTarget, saveUploadedVideo, getStorageFilePath } = require("./storage");
const {
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
} = require("./admin");
const {
  trackEvent,
  listEvents,
  submitFeedback,
  getFeedbackSummary
} = require("./analytics");

const PORT = Number(process.env.PORT || 8787);

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      cleanupExpiredVideos();
      if (req.method === "OPTIONS") return send(res, 204, {});
      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, {
          ok: true,
          success: true,
          service: "soai-api",
          data: {
            status: "ok",
            storageProvider: process.env.SOAI_STORAGE_PROVIDER || "local",
            poseProvider: process.env.SOAI_POSE_PROVIDER || "synthetic"
          }
        });
      }

      if (url.pathname.startsWith("/api/lite/v1/")) {
        return handleLiteRequest(req, res, url);
      }

      const mockUploadMatch = url.pathname.match(/^\/mock-upload\/([^/]+)$/);
      if (req.method === "POST" && mockUploadMatch) {
        const video = db.videos.find((item) => item.id === mockUploadMatch[1]);
        if (!video) return sendError(res, 404, "VIDEO_NOT_FOUND", "未找到视频记录。");
        await saveUploadedVideo(video, req);
        saveDb();
        return send(res, 200, { success: true, videoId: video.id, storageUrl: video.storageUrl });
      }

      const storageMatch = url.pathname.match(/^\/storage\/(.+)$/);
      if (req.method === "GET" && storageMatch) {
        return sendStorageFile(res, storageMatch[1]);
      }

      if (req.method === "GET" && url.pathname === "/api/student/profile") {
        return send(res, 200, { profile: db.profile });
      }

      if (req.method === "POST" && url.pathname === "/api/student/profile") {
        const payload = await readJson(req);
        Object.assign(db.profile, payload, { id: db.profile.id, updatedAt: new Date().toISOString() });
        db.reports.forEach((report) => {
          report.studentId = db.profile.id;
          report.studentSnapshot = {
            ...report.studentSnapshot,
            ...db.profile
          };
        });
        saveDb();
        return send(res, 200, { success: true, profileId: db.profile.id, profile: db.profile });
      }

      if (req.method === "POST" && url.pathname === "/api/videos/upload-token") {
        const payload = await readJson(req);
        const validation = validateVideo(payload);
        if (validation) return send(res, 400, validation);

        const video = {
          id: `video_${Date.now()}`,
          studentId: db.profile.id,
          coachId: db.profile.coachId,
          fileName: payload.fileName,
          fileUrl: "",
          storageProvider: "",
          storageKey: "",
          storagePath: "",
          storageUrl: "",
          durationSec: payload.durationSec,
          sizeMb: payload.sizeMb,
          format: payload.format,
          videoSignature: buildVideoSignature(db.profile.id, payload),
          cameraAngle: payload.cameraAngle || "left",
          uploadStatus: "selected",
          uploadProgress: 0,
          uploadError: "",
          analysisConsent: Boolean(payload.analysisConsent),
          caseConsent: Boolean(payload.caseConsent),
          consentAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        Object.assign(video, createUploadTarget(video, req));
        db.videos.push(video);
        saveDb();
        return send(res, 200, {
          videoId: video.id,
          uploadUrl: video.uploadUrl,
          uploadMethod: video.uploadMethod,
          uploadFormData: video.uploadFormData || {},
          storageProvider: video.storageProvider,
          storageKey: video.storageKey,
          storageUrl: video.storageUrl,
          maxSizeMb: 150,
          expiresInSec: 900
        });
      }

      const uploadStatusMatch = url.pathname.match(/^\/api\/videos\/([^/]+)\/upload-status$/);
      if (req.method === "POST" && uploadStatusMatch) {
        const video = db.videos.find((item) => item.id === uploadStatusMatch[1]);
        if (!video) return sendError(res, 404, "VIDEO_NOT_FOUND", "未找到视频记录。");
        const payload = await readJson(req);
        Object.assign(video, payload);
        saveDb();
        return send(res, 200, { success: true, video });
      }

      if (req.method === "POST" && url.pathname === "/api/analysis/tasks") {
        const payload = await readJson(req);
        const video = db.videos.find((item) => item.id === payload.videoId);
        if (!video) return sendError(res, 404, "VIDEO_NOT_FOUND", "未找到视频记录。");

        const task = {
          id: `task_${Date.now()}`,
          studentId: payload.studentId,
          videoId: payload.videoId,
          status: "queued",
          progress: 5,
          progressText: "训练视频已上传，等待 AI 分析",
          retryCount: 0,
          errorCode: "",
          errorMessage: "",
          reportId: "",
          frames: [],
          poseDetections: [],
          ruleResults: [],
          logs: [{
            stage: "queued",
            level: "info",
            message: "分析任务已创建。",
            at: new Date().toISOString()
          }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.tasks.push(task);
        saveDb();
        return send(res, 200, { taskId: task.id, status: task.status });
      }

      const taskMatch = url.pathname.match(/^\/api\/analysis\/tasks\/([^/]+)$/);
      if (req.method === "GET" && taskMatch) {
        const task = db.tasks.find((item) => item.id === taskMatch[1]);
        if (!task) return sendError(res, 404, "TASK_NOT_FOUND", "未找到分析任务。");
        await completeTask(task);
        return send(res, 200, getTaskView(task));
      }

      const retryMatch = url.pathname.match(/^\/api\/analysis\/tasks\/([^/]+)\/retry$/);
      if (req.method === "POST" && retryMatch) {
        const oldTask = db.tasks.find((item) => item.id === retryMatch[1]);
        if (!oldTask) return sendError(res, 404, "TASK_NOT_FOUND", "未找到分析任务。");

        const task = {
          ...oldTask,
          id: `task_${Date.now()}`,
          status: "queued",
          progress: 5,
          progressText: "重新进入分析队列",
          retryCount: oldTask.retryCount + 1,
          reportId: "",
          frames: [],
          poseDetections: [],
          ruleResults: [],
          logs: [{
            stage: "queued",
            level: "info",
            message: "重试任务已创建。",
            at: new Date().toISOString()
          }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.tasks.push(task);
        saveDb();
        return send(res, 200, { taskId: task.id, status: task.status });
      }

      const reportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
      if (req.method === "GET" && reportMatch) {
        const report = db.reports.find((item) => item.id === reportMatch[1]);
        if (!report) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
        return send(res, 200, { report });
      }

      const trendMatch = url.pathname.match(/^\/api\/students\/([^/]+)\/trends$/);
      if (req.method === "GET" && trendMatch) {
        return send(res, 200, getTrend(trendMatch[1], url.searchParams.get("limit") || 5));
      }

      const coachReviewMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/coach-review$/);
      if (req.method === "POST" && coachReviewMatch) {
        const result = saveCoachReview(coachReviewMatch[1], await readJson(req));
        if (!result) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
        return send(res, 200, { success: true, review: result.review, report: result.report, annotations: result.annotations });
      }

      if (req.method === "GET" && url.pathname === "/api/coach/dashboard") {
        return send(res, 200, getCoachDashboard());
      }

      if (req.method === "GET" && url.pathname === "/api/coach/reports") {
        const status = url.searchParams.get("status");
        const reports = db.reports
          .filter((report) => !status || report.coachReviewStatus === status)
          .map(formatCoachReport);
        return send(res, 200, { items: reports });
      }

      if (req.method === "GET" && url.pathname === "/api/coach/students") {
        return send(res, 200, { items: getCoachDashboard().activeStudents });
      }

      const coachStudentMatch = url.pathname.match(/^\/api\/coach\/students\/([^/]+)$/);
      if (req.method === "GET" && coachStudentMatch) {
        return send(res, 200, getCoachStudent(coachStudentMatch[1]));
      }

      const coachReviewSubmitMatch = url.pathname.match(/^\/api\/coach\/reports\/([^/]+)\/review$/);
      if (req.method === "POST" && coachReviewSubmitMatch) {
        const result = saveCoachReview(coachReviewSubmitMatch[1], await readJson(req));
        if (!result) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
        return send(res, 200, { success: true, review: result.review, report: result.report, annotations: result.annotations });
      }

      if (req.method === "GET" && url.pathname === "/api/coach/review-annotations") {
        return send(res, 200, {
          items: db.reviewAnnotations.filter((item) => {
            const reportId = url.searchParams.get("reportId");
            if (reportId && item.reportId !== reportId) return false;
            return true;
          })
        });
      }

      const teachingOutlineMatch = url.pathname.match(/^\/api\/coach\/reports\/([^/]+)\/teaching-outline$/);
      if (req.method === "POST" && teachingOutlineMatch) {
        const report = db.reports.find((item) => item.id === teachingOutlineMatch[1]);
        if (!report) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
        const payload = await readJson(req);
        const outline = generateTeachingOutline(report, getTrend(report.studentId, 5), payload);
        db.teachingOutlines.push(outline);
        saveDb();
        return send(res, 200, { success: true, outline });
      }

      if (req.method === "POST" && url.pathname === "/api/ai/report-draft") {
        const payload = await readJson(req);
        const input = payload.studentProfile
          ? payload
          : buildReportInput({
              profile: db.profile,
              video: db.videos[db.videos.length - 1],
              history: db.reports.slice(-5)
            });
        const report = generateTrainingReport(input);
        const validation = validateTrainingReport(report);
        return send(res, 200, { report, validation });
      }

      if (req.method === "POST" && url.pathname === "/api/ai/report-validate") {
        const payload = await readJson(req);
        return send(res, 200, validateTrainingReport(payload.report || payload));
      }

      const coachDraftMatch = url.pathname.match(/^\/api\/ai\/reports\/([^/]+)\/coach-review-draft$/);
      if (req.method === "GET" && coachDraftMatch) {
        const report = db.reports.find((item) => item.id === coachDraftMatch[1]);
        if (!report) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
        return send(res, 200, draftCoachReview(report));
      }

      const studentExplanationMatch = url.pathname.match(/^\/api\/ai\/reports\/([^/]+)\/student-explanation$/);
      if (req.method === "GET" && studentExplanationMatch) {
        const report = db.reports.find((item) => item.id === studentExplanationMatch[1]);
        if (!report) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
        return send(res, 200, generateStudentExplanation(report));
      }

      const operationContentMatch = url.pathname.match(/^\/api\/ai\/reports\/([^/]+)\/operation-content$/);
      if (req.method === "GET" && operationContentMatch) {
        const report = db.reports.find((item) => item.id === operationContentMatch[1]);
        if (!report) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
        return send(res, 200, generateOperationContent(report));
      }

      const productSuggestionMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/product-suggestions$/);
      if (req.method === "GET" && productSuggestionMatch) {
        const report = db.reports.find((item) => item.id === productSuggestionMatch[1]);
        if (!report) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
        return send(res, 200, getProductSuggestions(report));
      }

      if (req.method === "GET" && url.pathname === "/api/operations/dashboard") {
        return send(res, 200, getOperationsDashboard());
      }

      if (req.method === "GET" && url.pathname === "/api/operations/daily-report") {
        return send(res, 200, getOperationsDailyReport());
      }

      if (req.method === "POST" && url.pathname === "/api/analytics/events") {
        const result = trackEvent(await readJson(req));
        if (result.error) return send(res, 400, result.error);
        return send(res, 200, { success: true, event: result.event });
      }

      if (req.method === "GET" && url.pathname === "/api/analytics/events") {
        return send(res, 200, {
          items: listEvents({
            eventName: url.searchParams.get("eventName"),
            studentId: url.searchParams.get("studentId"),
            reportId: url.searchParams.get("reportId")
          })
        });
      }

      if (req.method === "POST" && url.pathname === "/api/feedback") {
        return send(res, 200, { success: true, feedback: submitFeedback(await readJson(req)) });
      }

      if (req.method === "GET" && url.pathname === "/api/feedback/summary") {
        return send(res, 200, getFeedbackSummary());
      }

      if (url.pathname.startsWith("/api/admin/")) {
        const authError = validateAdminAuth(req);
        if (authError) return sendError(res, 401, authError.code, authError.message);

        if (req.method === "GET" && url.pathname === "/api/admin/overview") {
          return send(res, 200, getAdminOverview());
        }

        if (req.method === "GET" && url.pathname === "/api/admin/videos") {
          return send(res, 200, { items: listVideos() });
        }

        if (req.method === "GET" && url.pathname === "/api/admin/users") {
          return send(res, 200, listUsers());
        }

        if (req.method === "GET" && url.pathname === "/api/admin/courses") {
          return send(res, 200, { items: listCourses() });
        }

        if (req.method === "POST" && url.pathname === "/api/admin/courses") {
          const result = createCourse(await readJson(req));
          if (result.error) return send(res, 400, result.error);
          return send(res, 200, { success: true, course: result.course });
        }

        const courseMatch = url.pathname.match(/^\/api\/admin\/courses\/([^/]+)$/);
        if (req.method === "POST" && courseMatch) {
          const course = updateCourse(courseMatch[1], await readJson(req));
          if (!course) return sendError(res, 404, "COURSE_NOT_FOUND", "未找到课程。");
          return send(res, 200, { success: true, course });
        }

        if (req.method === "GET" && url.pathname === "/api/admin/content") {
          return send(res, 200, { items: listContent() });
        }

        if (req.method === "POST" && url.pathname === "/api/admin/content") {
          const result = createContent(await readJson(req));
          if (result.error) return send(res, 400, result.error);
          return send(res, 200, { success: true, content: result.content });
        }

        if (req.method === "GET" && url.pathname === "/api/admin/products") {
          return send(res, 200, { items: listProducts() });
        }

        if (req.method === "POST" && url.pathname === "/api/admin/products") {
          const result = createProduct(await readJson(req));
          if (result.error) return send(res, 400, result.error);
          return send(res, 200, { success: true, product: result.product });
        }

        if (req.method === "GET" && url.pathname === "/api/admin/oss/status") {
          return send(res, 200, getOssStatus());
        }

        if (req.method === "POST" && url.pathname === "/api/admin/settings") {
          return send(res, 200, { success: true, settings: updateSettings(await readJson(req)) });
        }
      }

      return sendError(res, 404, "NOT_FOUND", "接口不存在。");
    } catch (error) {
      return sendError(res, 500, "INTERNAL_ERROR", error.message);
    }
  });
}

async function handleLiteRequest(req, res, url) {
  const path = url.pathname.replace(/^\/api\/lite\/v1/, "") || "/";

  const storageMatch = path.match(/^\/storage\/(.+)$/);
  if (req.method === "GET" && storageMatch) {
    return sendStorageFile(res, storageMatch[1]);
  }

  if (req.method === "POST" && path === "/auth/wx-login") {
    const payload = await readJson(req);
    const anonymousId = sanitizeIdentity(payload.anonymousId || payload.code || `${Date.now()}`);
    const studentId = `student_lite_${shortHash(anonymousId)}`;
    const profile = ensureStudentProfile(studentId, {
      userId: `lite_${anonymousId}`,
      name: payload.name || "内测学员",
      avatarUrl: payload.avatarUrl || ""
    });
    return send(res, 200, {
      token: `lite_${studentId}`,
      profile,
      expiresInSec: 30 * 24 * 60 * 60
    });
  }

  const identity = getLiteIdentity(req);
  if (!identity.studentId) {
    return sendError(res, 401, "LITE_UNAUTHORIZED", "请先登录后再使用学员端。");
  }
  const profile = ensureStudentProfile(identity.studentId);

  if (req.method === "GET" && path === "/student/profile") {
    return send(res, 200, { profile });
  }

  if (req.method === "POST" && path === "/student/profile") {
    const payload = await readJson(req);
    const updated = ensureStudentProfile(identity.studentId, payload);
    db.reports
      .filter((report) => report.studentId === identity.studentId)
      .forEach((report) => {
        report.studentSnapshot = {
          ...report.studentSnapshot,
          id: report.studentSnapshot.id,
          ...updated
        };
      });
    saveDb();
    return send(res, 200, { success: true, profileId: updated.id, profile: updated });
  }

  if (req.method === "GET" && path === "/upload/quota") {
    return send(res, 200, getDailyUploadQuota(identity.studentId));
  }

  if (req.method === "POST" && path === "/videos/upload-token") {
    const quota = getDailyUploadQuota(identity.studentId);
    if (quota.remaining <= 0) {
      return send(res, 429, {
        code: "DAILY_UPLOAD_LIMIT_REACHED",
        message: `今天已达到 ${quota.limit} 次训练视频分析上限，请明天再上传。`,
        quota
      });
    }

    const payload = await readJson(req);
    const validation = validateVideo(payload);
    if (validation) return send(res, 400, validation);

    const video = {
      id: `video_${Date.now()}`,
      studentId: identity.studentId,
      coachId: profile.coachId || "",
      fileName: payload.fileName,
      fileUrl: "",
      storageProvider: "",
      storageKey: "",
      storagePath: "",
      storageUrl: "",
      durationSec: payload.durationSec,
      sizeMb: payload.sizeMb,
      format: payload.format,
      videoSignature: buildVideoSignature(identity.studentId, payload),
      cameraAngle: payload.cameraAngle || "left",
      uploadStatus: "selected",
      uploadProgress: 0,
      uploadError: "",
      analysisConsent: Boolean(payload.analysisConsent),
      caseConsent: Boolean(payload.caseConsent),
      consentAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    Object.assign(video, createUploadTarget(video, req));
    db.videos.push(video);
    saveDb();
    return send(res, 200, {
      videoId: video.id,
      uploadUrl: video.uploadUrl,
      uploadMethod: video.uploadMethod,
      uploadFormData: video.uploadFormData || {},
      storageProvider: video.storageProvider,
      storageKey: video.storageKey,
      storageUrl: video.storageUrl,
      maxSizeMb: Number(process.env.SOAI_MAX_UPLOAD_MB || 150),
      expiresInSec: 900,
      quota: getDailyUploadQuota(identity.studentId)
    });
  }

  const uploadStatusMatch = path.match(/^\/videos\/([^/]+)\/upload-status$/);
  if (req.method === "POST" && uploadStatusMatch) {
    const video = db.videos.find((item) => item.id === uploadStatusMatch[1] && item.studentId === identity.studentId);
    if (!video) return sendError(res, 404, "VIDEO_NOT_FOUND", "未找到视频记录。");
    const payload = await readJson(req);
    Object.assign(video, payload);
    saveDb();
    return send(res, 200, { success: true, video });
  }

  if (req.method === "POST" && path === "/analysis/tasks") {
    const payload = await readJson(req);
    const video = db.videos.find((item) => item.id === payload.videoId && item.studentId === identity.studentId);
    if (!video) return sendError(res, 404, "VIDEO_NOT_FOUND", "未找到视频记录。");

    const existingReport = findExistingReportForVideo(identity.studentId, video);
    if (existingReport) {
      const task = {
        id: `task_${Date.now()}`,
        studentId: identity.studentId,
        videoId: payload.videoId,
        status: "completed",
        progress: 100,
        progressText: "已识别为同一训练视频，直接复用原分析报告。",
        retryCount: 0,
        errorCode: "",
        errorMessage: "",
        reportId: existingReport.id,
        frames: [],
        poseDetections: [],
        ruleResults: [],
        logs: [{
          stage: "deduplicated",
          level: "info",
          message: `复用报告 ${existingReport.id}，未重复分析同一视频。`,
          at: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.tasks.push(task);
      saveDb();
      return send(res, 200, {
        taskId: task.id,
        status: task.status,
        reportId: task.reportId,
        progressText: task.progressText,
        createdAt: task.createdAt
      });
    }

    const task = {
      id: `task_${Date.now()}`,
      studentId: identity.studentId,
      videoId: payload.videoId,
      status: "queued",
      progress: 5,
      progressText: "训练视频已上传，等待 AI 分析",
      retryCount: 0,
      errorCode: "",
      errorMessage: "",
      reportId: "",
      frames: [],
      poseDetections: [],
      ruleResults: [],
      logs: [{
        stage: "queued",
        level: "info",
        message: "分析任务已创建。",
        at: new Date().toISOString()
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.tasks.push(task);
    saveDb();
    return send(res, 200, { taskId: task.id, status: task.status });
  }

  const taskMatch = path.match(/^\/analysis\/tasks\/([^/]+)$/);
  if (req.method === "GET" && taskMatch) {
    const task = db.tasks.find((item) => item.id === taskMatch[1] && item.studentId === identity.studentId);
    if (!task) return sendError(res, 404, "TASK_NOT_FOUND", "未找到分析任务。");
    await completeTask(task);
    return send(res, 200, getTaskView(task));
  }

  const reportMatch = path.match(/^\/reports\/([^/]+)$/);
  if (req.method === "GET" && reportMatch) {
    const report = db.reports.find((item) => item.id === reportMatch[1] && item.studentId === identity.studentId);
    if (!report) return sendError(res, 404, "REPORT_NOT_FOUND", "未找到报告。");
    return send(res, 200, { report });
  }

  if (req.method === "GET" && path === "/reports") {
    return send(res, 200, getTrend(identity.studentId, url.searchParams.get("limit") || 10));
  }

  if (req.method === "GET" && path === "/students/me/trends") {
    return send(res, 200, getTrend(identity.studentId, url.searchParams.get("limit") || 10));
  }

  return sendError(res, 404, "LITE_NOT_FOUND", "学员端接口不存在。");
}

function getLiteIdentity(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token.startsWith("lite_student_lite_")) {
    return { studentId: token.slice("lite_".length), token };
  }
  const headerStudentId = req.headers["x-soai-lite-student-id"];
  if (headerStudentId) return { studentId: String(headerStudentId), token };
  return { studentId: "", token };
}

function getDailyUploadQuota(studentId) {
  const limit = Number(process.env.SOAI_LITE_DAILY_UPLOAD_LIMIT || 3);
  const dateKey = chinaDateKey(new Date());
  const used = db.videos.filter((video) => (
    video.studentId === studentId &&
    chinaDateKey(new Date(video.createdAt)) === dateKey
  )).length;
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    date: dateKey
  };
}

function chinaDateKey(date) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sanitizeIdentity(value) {
  return String(value || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anonymous";
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}

function buildVideoSignature(studentId, payload) {
  const fileName = String(payload.fileName || payload.filename || "").trim().toLowerCase();
  const sizeMb = Number(payload.sizeMb || 0).toFixed(1);
  const durationSec = Math.round(Number(payload.durationSec || 0));
  const format = String(payload.format || "").trim().toLowerCase();
  return shortHash([studentId, fileName, sizeMb, durationSec, format].join("|"));
}

function findExistingReportForVideo(studentId, video) {
  const signature = video.videoSignature || buildVideoSignature(studentId, video);
  if (!signature) return null;
  return db.reports
    .filter((report) => report.studentId === studentId && report.videoSignature === signature)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
}

function validateVideo(payload) {
  if (!payload.analysisConsent) {
    return { code: "VIDEO_CONSENT_REQUIRED", message: "请先确认视频仅用于本次训练分析和教练复核。" };
  }
  if (!["mp4", "mov"].includes(String(payload.format || "").toLowerCase())) {
    return { code: "VIDEO_FORMAT_UNSUPPORTED", message: "暂不支持该视频格式，请上传 mp4 或 mov。" };
  }
  if (Number(payload.sizeMb) > 150) {
    return { code: "VIDEO_TOO_LARGE", message: "视频文件过大，请压缩或选择 150 MB 以内片段。" };
  }
  if (Number(payload.durationSec) < 10) {
    return { code: "VIDEO_TOO_SHORT", message: "视频片段过短，请上传至少 10 秒训练视频。" };
  }
  if (Number(payload.durationSec) > 60) {
    return { code: "VIDEO_TOO_LONG", message: "视频过长，请截取 60 秒以内关键训练片段。" };
  }
  return null;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("请求 JSON 格式不正确。"));
      }
    });
  });
}

function sendError(res, status, code, message) {
  return send(res, status, { code, message });
}

function send(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  if (status === 204) return res.end();
  res.end(JSON.stringify(payload));
}

function validateAdminAuth(req) {
  const expected = process.env.SOAI_ADMIN_TOKEN || "soai-admin-dev";
  if (!expected) return null;
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token === expected) return null;
  return {
    code: "ADMIN_UNAUTHORIZED",
    message: "后台访问未授权，请在请求头 Authorization 中携带后台 token。"
  };
}

function sendStorageFile(res, storageKey) {
  const filePath = getStorageFilePath(storageKey);
  if (!filePath || !require("fs").existsSync(filePath)) {
    return sendError(res, 404, "FILE_NOT_FOUND", "视频文件已过期或不存在。");
  }
  const ext = filePath.split(".").pop().toLowerCase();
  const contentType = ext === "mov" ? "video/quicktime" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "video/mp4";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600"
  });
  require("fs").createReadStream(filePath).pipe(res);
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`SOAI mock API listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer
};
