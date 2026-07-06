const assert = require("assert");
const http = require("http");
const { createServer } = require("../src/server");

process.env.SOAI_POSE_PROVIDER = "synthetic";
process.env.SOAI_REQUIRE_REAL_POSE = "true";
process.env.SOAI_MAX_VIDEO_DURATION_SEC = "15";

async function main() {
  process.env.SOAI_LITE_INVITE_CODES = "SOAI2026";
  process.env.SOAI_WECHAT_LOGIN_ALLOW_MOCK = "true";
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const login = await request(baseUrl, "POST", "/api/lite/v1/auth/wx-login", {
      code: "wx-test-real-pose-required",
      anonymousId: "real-pose-required"
    });
    const headers = { Authorization: `Bearer ${login.token}` };
    const invite = await request(baseUrl, "POST", "/api/lite/v1/invite/verify", {
      inviteCode: "SOAI2026"
    }, headers);
    assert.strictEqual(invite.success, true);

    const video = await request(baseUrl, "POST", "/api/lite/v1/videos/upload-token", {
      fileName: "real-pose-required.mp4",
      sizeMb: 12,
      durationSec: 12,
      format: "mp4",
      analysisConsent: true,
      caseConsent: false
    }, headers);

    await requestRaw(video.uploadUrl, "POST", Buffer.from("fake-video-bytes"), {
      ...headers,
      "Content-Type": "video/mp4"
    });

    const taskCreated = await request(baseUrl, "POST", "/api/lite/v1/analysis/tasks", {
      videoId: video.videoId
    }, headers);

    const task = await request(baseUrl, "GET", `/api/lite/v1/analysis/tasks/${taskCreated.taskId}`, null, headers);
    assert.strictEqual(task.status, "failed");
    assert.strictEqual(task.errorCode, "ANALYSIS_PIPELINE_FAILED");
    assert.ok(task.errorMessage.includes("真实姿态识别"));
    assert.ok(task.errorMessage.includes("ffmpeg"), task.errorMessage);

    const quotaAfterFailure = await request(baseUrl, "GET", "/api/lite/v1/upload/quota", null, headers);
    assert.strictEqual(quotaAfterFailure.used, 0);
    assert.strictEqual(quotaAfterFailure.remaining, 999);
    assert.strictEqual(quotaAfterFailure.unlimited, true);

    console.log("real pose required tests passed");
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
        const bodyJson = text ? JSON.parse(text) : {};
        if (res.statusCode >= 400 && !options.allowError) {
          reject(new Error(bodyJson.message || `HTTP ${res.statusCode}`));
        } else {
          resolve(options.allowError ? { statusCode: res.statusCode, body: bodyJson } : bodyJson);
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
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
