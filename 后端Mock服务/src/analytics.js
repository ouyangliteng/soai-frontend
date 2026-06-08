const { db, saveDb } = require("./data");

const allowedEvents = new Set([
  "profile_view",
  "profile_save_success",
  "video_select",
  "video_validate_failed",
  "video_upload_start",
  "video_upload_success",
  "video_upload_failed",
  "analysis_task_created",
  "analysis_success",
  "analysis_failed",
  "report_view",
  "report_read_complete",
  "trend_view",
  "coach_review_submit",
  "retry_click",
  "feedback_submit"
]);

function trackEvent(payload = {}) {
  const eventName = String(payload.eventName || "");
  if (!allowedEvents.has(eventName)) {
    return {
      error: {
        code: "EVENT_NOT_ALLOWED",
        message: "埋点事件名称不在允许列表中。"
      }
    };
  }

  const event = {
    id: payload.eventId || `event_${Date.now()}_${db.analyticsEvents.length + 1}`,
    eventName,
    userId: payload.userId || db.profile.userId,
    studentId: payload.studentId || db.profile.id,
    page: payload.page || "",
    videoId: payload.videoId || "",
    taskId: payload.taskId || "",
    reportId: payload.reportId || "",
    channel: payload.channel || "",
    properties: payload.properties || {},
    occurredAt: payload.occurredAt || new Date().toISOString()
  };
  db.analyticsEvents.push(event);
  saveDb();
  return { event };
}

function listEvents(filter = {}) {
  return db.analyticsEvents.filter((event) => {
    if (filter.eventName && event.eventName !== filter.eventName) return false;
    if (filter.studentId && event.studentId !== filter.studentId) return false;
    if (filter.reportId && event.reportId !== filter.reportId) return false;
    return true;
  });
}

function submitFeedback(payload = {}) {
  const feedback = {
    id: payload.id || `feedback_${Date.now()}_${db.feedbackItems.length + 1}`,
    source: payload.source || "mini_program",
    role: payload.role || "student",
    studentId: payload.studentId || db.profile.id,
    reportId: payload.reportId || "",
    rating: normalizeRating(payload.rating),
    accuracyRating: normalizeRating(payload.accuracyRating),
    usefulnessRating: normalizeRating(payload.usefulnessRating),
    uploadExperienceRating: normalizeRating(payload.uploadExperienceRating),
    comment: String(payload.comment || ""),
    correctionText: String(payload.correctionText || ""),
    correctedScores: payload.correctedScores && typeof payload.correctedScores === "object" ? payload.correctedScores : {},
    aiLearningConsent: payload.aiLearningConsent !== false,
    relatedFields: Array.isArray(payload.relatedFields) ? payload.relatedFields : [],
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    contact: payload.contact || "",
    createdAt: payload.createdAt || new Date().toISOString()
  };
  db.feedbackItems.push(feedback);
  trackEvent({
    eventName: "feedback_submit",
    studentId: feedback.studentId,
    reportId: feedback.reportId,
    page: "feedback",
    properties: {
      role: feedback.role,
      source: feedback.source,
      rating: feedback.rating
    }
  });
  saveDb();
  return feedback;
}

function getFeedbackSummary() {
  const count = db.feedbackItems.length;
  const averageRating = average(db.feedbackItems.map((item) => item.rating).filter(Boolean));
  const averageAccuracy = average(db.feedbackItems.map((item) => item.accuracyRating).filter(Boolean));
  const averageUsefulness = average(db.feedbackItems.map((item) => item.usefulnessRating).filter(Boolean));
  const tagCounts = {};
  db.feedbackItems.forEach((item) => {
    item.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return {
    count,
    averageRating,
    averageAccuracy,
    averageUsefulness,
    tagCounts,
    latest: db.feedbackItems.slice(-5).reverse()
  };
}

function normalizeRating(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(1, Math.min(5, Math.round(number)));
}

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

module.exports = {
  trackEvent,
  listEvents,
  submitFeedback,
  getFeedbackSummary
};
