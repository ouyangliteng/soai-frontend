const assert = require("assert");
const http = require("http");
const { createServer } = require("../src/server");

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await request(baseUrl, "GET", "/health");
    assert.strictEqual(health.ok, true);

    const profileRes = await request(baseUrl, "GET", "/api/student/profile");
    assert.strictEqual(profileRes.profile.name, "王小涵");

    const saveProfileRes = await request(baseUrl, "POST", "/api/student/profile", {
      name: "王小涵",
      age: 14,
      heightCm: 160,
      weightKg: 48,
      ridingYears: 2,
      currentLevel: "初级进阶",
      coachName: "李教练",
      clubName: "SOAI 示例马术俱乐部"
    });
    assert.strictEqual(saveProfileRes.success, true);

    const uploadToken = await request(baseUrl, "POST", "/api/videos/upload-token", {
      fileName: "training.mp4",
      sizeMb: 82.5,
      durationSec: 58,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    });
    assert.ok(uploadToken.videoId);

    const uploadFileJson = await uploadFile(uploadToken.uploadUrl, Buffer.from("fake-video-bytes"));
    assert.strictEqual(uploadFileJson.success, true);
    assert.ok(uploadFileJson.storageUrl);

    const uploadStatus = await request(baseUrl, "POST", `/api/videos/${uploadToken.videoId}/upload-status`, {
      uploadStatus: "uploaded",
      uploadProgress: 100,
      uploadError: ""
    });
    assert.strictEqual(uploadStatus.success, true);

    const taskCreated = await request(baseUrl, "POST", "/api/analysis/tasks", {
      videoId: uploadToken.videoId,
      studentId: profileRes.profile.id
    });
    assert.ok(taskCreated.taskId);

    const task = await request(baseUrl, "GET", `/api/analysis/tasks/${taskCreated.taskId}`);
    assert.strictEqual(task.status, "completed");
    assert.ok(task.reportId);
    assert.ok(task.analysisSummary.frameCount >= 30);
    assert.ok(task.analysisSummary.poseFrameCount >= 30);
    assert.ok(task.analysisSummary.ruleResultCount >= 5);

    const reportRes = await request(baseUrl, "GET", `/api/reports/${task.reportId}`);
    assert.strictEqual(reportRes.report.id, task.reportId);
    assert.ok(reportRes.report.problemPoints.length > 0);
    assert.ok(reportRes.report.nextTrainingFocus.length > 0);
    assert.ok(reportRes.report.limitations.length > 0);
    assert.ok(reportRes.report.poseSummary.usableFrameRate >= 0.7);
    assert.ok(reportRes.report.ruleResults.length >= 5);
    assert.ok(reportRes.report.problemPoints[0].evidence.includes("视频中"));
    assert.ok(reportRes.report.reportTime);
    assert.strictEqual(reportRes.report.videoVisibleToday, true);
    assert.ok(reportRes.report.videoAvailableUntil);

    const aiDraft = await request(baseUrl, "POST", "/api/ai/report-draft", {});
    assert.strictEqual(aiDraft.validation.valid, true);
    assert.ok(aiDraft.report.problemPoints.length > 0);

    const aiValidation = await request(baseUrl, "POST", "/api/ai/report-validate", {
      report: aiDraft.report
    });
    assert.strictEqual(aiValidation.valid, true);

    const coachDraft = await request(baseUrl, "GET", `/api/ai/reports/${task.reportId}/coach-review-draft`);
    assert.strictEqual(coachDraft.mustConfirmByCoach, true);
    assert.ok(coachDraft.reviewDraft.includes("建议"));

    const teachingOutline = await request(baseUrl, "POST", `/api/coach/reports/${task.reportId}/teaching-outline`, {
      coachObservation: "学员胆量可以，但快步时容易急于向前，转弯前需要更多视线提醒。",
      stageGoal: "未来 4 周提升快步节奏稳定和转弯路线意识。",
      weeks: 4,
      constraints: "每周 2 次训练，优先安全和基础稳定。"
    });
    assert.strictEqual(teachingOutline.success, true);
    assert.strictEqual(teachingOutline.outline.mustConfirmByCoach, true);
    assert.strictEqual(teachingOutline.outline.weeklyPlan.length, 4);
    assert.ok(teachingOutline.outline.safetyBoundary.includes("教练"));

    const studentExplanation = await request(baseUrl, "GET", `/api/ai/reports/${task.reportId}/student-explanation`);
    assert.ok(studentExplanation.explanation.includes("教练"));
    assert.ok(studentExplanation.safetyStandard.includes("教练现场判断"));

    const operationContent = await request(baseUrl, "GET", `/api/ai/reports/${task.reportId}/operation-content`);
    assert.ok(operationContent.xiaohongshu.title);
    assert.ok(operationContent.douyin.script.length > 0);

    const productSuggestions = await request(baseUrl, "GET", `/api/reports/${task.reportId}/product-suggestions`);
    assert.ok(productSuggestions.items.length >= 2);
    assert.ok(productSuggestions.items.some((item) => item.productName.includes("护甲")));
    assert.ok(productSuggestions.summary.includes("不构成强制购买建议"));

    const operationsDashboard = await request(baseUrl, "GET", "/api/operations/dashboard");
    assert.ok(operationsDashboard.kpis.length >= 6);
    assert.ok(operationsDashboard.funnel.length >= 6);
    assert.ok(operationsDashboard.channels.some((channel) => channel.name === "小红书"));
    assert.ok(operationsDashboard.contentQueue.length >= 3);
    assert.ok(operationsDashboard.feedbackSummary.count >= 1);
    assert.ok(operationsDashboard.feedbackSummary.latest.length >= 1);
    assert.ok(operationsDashboard.risks.length >= 1);

    const dailyReport = await request(baseUrl, "GET", "/api/operations/daily-report");
    assert.ok(dailyReport.conclusion.includes("内测") || dailyReport.conclusion.includes("链路"));
    assert.ok(["go", "conditional_go"].includes(dailyReport.goStatus));
    assert.strictEqual(dailyReport.reviewQuestions.length, 6);
    assert.ok(dailyReport.nextActions.length >= 1);

    const tracked = await request(baseUrl, "POST", "/api/analytics/events", {
      eventName: "report_view",
      reportId: task.reportId,
      page: "report",
      properties: {
        entry: "analysis_complete"
      }
    });
    assert.strictEqual(tracked.success, true);
    assert.strictEqual(tracked.event.eventName, "report_view");

    const analyticsEvents = await request(baseUrl, "GET", "/api/analytics/events?eventName=report_view");
    assert.ok(analyticsEvents.items.some((event) => event.reportId === task.reportId));

    const feedback = await request(baseUrl, "POST", "/api/feedback", {
      role: "coach",
      reportId: task.reportId,
      rating: 5,
      accuracyRating: 4,
      usefulnessRating: 5,
      comment: "问题点有参考价值，建议补充马匹状态信息。",
      tags: ["报告有参考价值", "需补充视频角度"]
    });
    assert.strictEqual(feedback.success, true);
    assert.strictEqual(feedback.feedback.role, "coach");

    const feedbackSummary = await request(baseUrl, "GET", "/api/feedback/summary");
    assert.ok(feedbackSummary.count >= 1);
    assert.ok(feedbackSummary.averageUsefulness >= 1);

    const trend = await request(baseUrl, "GET", `/api/students/${profileRes.profile.id}/trends?limit=5`);
    assert.ok(trend.items.length >= 2);
    assert.ok(trend.trendSummary.includes("最近"));
    assert.ok(trend.items.some((item) => item.reportId === task.reportId && item.reportTime));

    const dashboardBefore = await request(baseUrl, "GET", "/api/coach/dashboard");
    assert.ok(dashboardBefore.stats.pendingReviewCount >= 1);

    const review = await request(baseUrl, "POST", `/api/coach/reports/${task.reportId}/review`, {
      status: "reviewed",
      comment: "AI 对上身稳定性的判断基本准确，下次加强轻快步节奏。",
      focusItems: ["轻快步节奏", "小腿稳定"],
      assignmentComment: "下次训练前 10 分钟做轻快步节奏稳定练习。",
      annotations: [
        {
          ruleResultId: reportRes.report.ruleResults[0].ruleResultId,
          label: "partially_accurate",
          correctedProblem: "上身稳定需要结合马匹节奏再判断",
          correctedSuggestion: "下次补充侧面固定机位视频。",
          comment: "判断有参考价值，但视频角度仍需复核。"
        }
      ]
    });
    assert.strictEqual(review.success, true);
    assert.strictEqual(review.report.coachReviewStatus, "reviewed");
    assert.strictEqual(review.annotations.length, 1);

    const annotations = await request(baseUrl, "GET", `/api/coach/review-annotations?reportId=${task.reportId}`);
    assert.ok(annotations.items.some((item) => item.label === "partially_accurate"));

    const reviewedTrend = await request(baseUrl, "GET", `/api/students/${profileRes.profile.id}/trends?limit=5`);
    assert.ok(reviewedTrend.items.some((item) => item.reportId === task.reportId && item.coachReviewStatus === "reviewed"));
    assert.ok(reviewedTrend.items.some((item) => item.reportId === task.reportId && item.coachReview));

    const studentDetail = await request(baseUrl, "GET", `/api/coach/students/${profileRes.profile.id}`);
    assert.ok(studentDetail.assignments.length >= 1);
    assert.ok(studentDetail.teachingOutlines.length >= 1);
    assert.ok(studentDetail.repeatedProblems.length >= 1);

    const invalidVideo = await request(baseUrl, "POST", "/api/videos/upload-token", {
      fileName: "training.avi",
      sizeMb: 10,
      durationSec: 30,
      format: "avi",
      analysisConsent: true
    }, 400);
    assert.strictEqual(invalidVideo.code, "VIDEO_FORMAT_UNSUPPORTED");

    const missingConsent = await request(baseUrl, "POST", "/api/videos/upload-token", {
      fileName: "training.mp4",
      sizeMb: 10,
      durationSec: 30,
      format: "mp4"
    }, 400);
    assert.strictEqual(missingConsent.code, "VIDEO_CONSENT_REQUIRED");

    console.log("api mock tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(baseUrl, method, path, body, expectedStatus = 200) {
  const response = await httpRequest(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = JSON.parse(response.body);
  assert.strictEqual(response.status, expectedStatus, `${method} ${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

async function uploadFile(uploadUrl, fileBuffer) {
  const boundary = `soai-test-${Date.now()}`;
  const head = Buffer.from([
    `--${boundary}`,
    "Content-Disposition: form-data; name=\"file\"; filename=\"training.mp4\"",
    "Content-Type: video/mp4",
    "",
    ""
  ].join("\r\n"));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, fileBuffer, tail]);
  const response = await httpRequest(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length
    },
    body
  });
  assert.strictEqual(response.status, 200);
  return JSON.parse(response.body);
}

function httpRequest(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: options.method || "GET",
      headers: options.headers || {}
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
