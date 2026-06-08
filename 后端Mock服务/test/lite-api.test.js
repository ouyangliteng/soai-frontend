const assert = require("assert");
const http = require("http");
const { createServer } = require("../src/server");

async function main() {
  process.env.SOAI_LITE_DAILY_UPLOAD_LIMIT = "3";
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

    const firstVideo = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "repeat-training.mp4",
      sizeMb: 20,
      durationSec: 20,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers);
    assert.ok(firstVideo.videoId);

    const firstTask = await request(baseUrl, "POST", "/api/lite/v1/analysis/tasks", {
      videoId: firstVideo.videoId
    }, headers);
    const firstTaskDone = await request(baseUrl, "GET", `/api/lite/v1/analysis/tasks/${firstTask.taskId}`, null, headers);
    assert.strictEqual(firstTaskDone.status, "completed");
    assert.ok(firstTaskDone.reportId);

    const repeatedVideo = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "repeat-training.mp4",
      sizeMb: 20,
      durationSec: 20,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers);
    const repeatedTask = await request(baseUrl, "POST", "/api/lite/v1/analysis/tasks", {
      videoId: repeatedVideo.videoId
    }, headers);
    assert.strictEqual(repeatedTask.status, "completed");
    assert.strictEqual(repeatedTask.reportId, firstTaskDone.reportId);

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
      sizeMb: 20,
      durationSec: 20,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers);
    assert.ok(uniqueVideo.videoId);
    assert.strictEqual(uniqueVideo.quota.remaining, 0);

    const quotaAfter = await request(baseUrl, "GET", "/api/lite/v1/upload/quota", null, headers);
    assert.strictEqual(quotaAfter.used, 3);
    assert.strictEqual(quotaAfter.remaining, 0);

    const overLimit = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "training-over-limit.mp4",
      sizeMb: 20,
      durationSec: 20,
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
