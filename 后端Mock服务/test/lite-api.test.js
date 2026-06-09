const assert = require("assert");
const http = require("http");
const { createServer } = require("../src/server");

async function main() {
  process.env.SOAI_LITE_DAILY_UPLOAD_LIMIT = "3";
  process.env.SOAI_LITE_INVITE_CODES = "SOAI2026";
  process.env.SOAI_LITE_INVITE_MAX_USERS = "20";
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const login = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "wx-test-code",
      anonymousId: "lite-user-a"
    });
    assert.ok(login.token);
    assert.ok(login.profile.id.startsWith("student_lite_"));

    const headers = { Authorization: `Bearer ${login.token}` };
    const initialQuota = await request(baseUrl, "GET", "/api/lite/v1/upload/quota", null, headers);
    assert.strictEqual(initialQuota.limit, 3);
    assert.strictEqual(initialQuota.remaining, 3);

    const missingInvite = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "blocked-before-invite.mp4",
      sizeMb: 20,
      durationSec: 12,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers, { allowError: true });
    assert.strictEqual(missingInvite.statusCode, 403);
    assert.strictEqual(missingInvite.body.code, "INVITE_REQUIRED");

    const invalidInvite = await request(baseUrl, "POST", "/api/lite/v1/invite/verify", {
      inviteCode: "WRONG"
    }, headers, { allowError: true });
    assert.strictEqual(invalidInvite.statusCode, 403);
    assert.strictEqual(invalidInvite.body.code, "INVITE_CODE_INVALID");

    const invite = await request(baseUrl, "POST", "/api/lite/v1/invite/verify", {
      inviteCode: "soai2026"
    }, headers);
    assert.strictEqual(invite.success, true);
    assert.strictEqual(invite.inviteAccess.verified, true);

    const tooLongVideo = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "too-long-training.mp4",
      sizeMb: 20,
      durationSec: 16,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers, { allowError: true });
    assert.strictEqual(tooLongVideo.statusCode, 400);
    assert.strictEqual(tooLongVideo.body.code, "VIDEO_TOO_LONG");

    const firstVideo = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "repeat-training.mp4",
      sizeMb: 20,
      durationSec: 12,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers);
    assert.ok(firstVideo.videoId);
    assert.ok(firstVideo.uploadUrl.includes("/api/lite/v1/mock-upload/"));
    const uploadResult = await requestRaw(firstVideo.uploadUrl, "POST", Buffer.from("fake-video-bytes"), {
      "Content-Type": "video/mp4"
    });
    assert.strictEqual(uploadResult.statusCode, 200);

    const firstTask = await request(baseUrl, "POST", "/api/lite/v1/analysis/tasks", {
      videoId: firstVideo.videoId
    }, headers);
    const firstTaskDone = await request(baseUrl, "GET", `/api/lite/v1/analysis/tasks/${firstTask.taskId}`, null, headers);
    assert.strictEqual(firstTaskDone.status, "completed");
    assert.ok(firstTaskDone.reportId);

    const firstReport = await request(baseUrl, "GET", `/api/lite/v1/reports/${firstTaskDone.reportId}`, null, headers);
    assert.ok(firstReport.report.poseTrack);
    assert.strictEqual(firstReport.report.poseTrack.coordinateSystem, "normalized");
    assert.ok(firstReport.report.poseTrack.frames.length > 0);
    assert.ok(firstReport.report.poseTrack.frames[0].points.head);
    assert.ok(firstReport.report.poseTrack.frames[0].points.leftToe);
    assert.strictEqual(firstReport.report.poseTrack.frames[0].points.leftToe.derived, true);

    const repeatedVideo = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "training-from-album-different-name.mp4",
      sizeMb: 20,
      durationSec: 12,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers);
    assert.strictEqual(repeatedVideo.reused, true);
    assert.strictEqual(repeatedVideo.reportId, firstTaskDone.reportId);
    assert.strictEqual(repeatedVideo.uploadMethod, "SKIP");

    const reportFeedback = await request(baseUrl, "POST", `/api/lite/v1/reports/${firstTaskDone.reportId}/feedback`, {
      role: "coach",
      accuracyRating: 3,
      usefulnessRating: 5,
      correctionText: "小腿位置判断偏紧，现场观察更稳定。",
      comment: "建议把该视频作为角度偏差修正样本。",
      tags: ["角度数据偏差", "教练已确认"],
      aiLearningConsent: true
    }, headers);
    assert.strictEqual(reportFeedback.success, true);
    assert.strictEqual(reportFeedback.feedback.reportId, firstTaskDone.reportId);
    assert.strictEqual(reportFeedback.feedback.correctionText.includes("小腿位置"), true);

    const uniqueVideo = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "training-unique.mp4",
      sizeMb: 21,
      durationSec: 13,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers);
    assert.ok(uniqueVideo.videoId);
    assert.strictEqual(uniqueVideo.quota.remaining, 1);

    const secondUniqueVideo = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "training-second-unique.mp4",
      sizeMb: 22,
      durationSec: 14,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers);
    assert.ok(secondUniqueVideo.videoId);
    assert.strictEqual(secondUniqueVideo.quota.remaining, 0);

    const quotaAfter = await request(baseUrl, "GET", "/api/lite/v1/upload/quota", null, headers);
    assert.strictEqual(quotaAfter.used, 3);
    assert.strictEqual(quotaAfter.remaining, 0);

    const overLimit = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "training-over-limit.mp4",
      sizeMb: 23,
      durationSec: 15,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers, { allowError: true });
    assert.strictEqual(overLimit.statusCode, 429);
    assert.strictEqual(overLimit.body.code, "DAILY_UPLOAD_LIMIT_REACHED");

    console.log("lite api tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function request(baseUrl, method, path, body, headers = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${path}`);
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const parsed = text ? JSON.parse(text) : {};
        if (res.statusCode >= 400 && !options.allowError) {
          reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
          return;
        }
        if (options.allowError) {
          resolve({ statusCode: res.statusCode, body: parsed });
          return;
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function requestRaw(targetUrl, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(body || "");
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        "Content-Length": payload.length,
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ statusCode: res.statusCode, body: text ? JSON.parse(text) : {} });
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
