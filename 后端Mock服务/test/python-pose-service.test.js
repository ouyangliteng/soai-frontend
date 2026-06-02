const assert = require("assert");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

process.env.SOAI_POSE_PROVIDER = "http";
process.env.SOAI_POSE_MODEL_PROVIDER = "synthetic";
process.env.SOAI_POSE_SERVICE_URL = "http://127.0.0.1:8793";

const { createServer } = require("../src/server");

async function main() {
  const poseService = spawn("python3", [
    path.join(__dirname, "..", "..", "PythonPose服务", "pose_service.py"),
    "--host",
    "127.0.0.1",
    "--port",
    "8793"
  ], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForHealth("http://127.0.0.1:8793/health");
    const providerStatus = await directRequest("http://127.0.0.1:8793/v1/pose/providers");
    assert.ok(providerStatus.providers.some((item) => item.provider === "synthetic" && item.ready));
    assert.ok(providerStatus.providers.some((item) => item.provider === "yolo-pose" && item.missing.includes("YOLO_POSE_MODEL_PATH")));
    assert.ok(providerStatus.providers.some((item) => item.provider === "rtmpose" && item.missing.includes("RTMPOSE_CONFIG_PATH")));

    const detectSample = await directRequest("http://127.0.0.1:8793/v1/pose/detect", {
      taskId: "task_contract",
      videoId: "video_contract",
      provider: "synthetic",
      frames: [{
        frameIndex: 1,
        timestampMs: 0,
        imagePath: "synthetic://contract/1",
        width: 960,
        height: 540
      }]
    });
    assert.strictEqual(detectSample.success, true);
    assert.strictEqual(detectSample.modelStatus.provider, "synthetic");
    assert.ok(detectSample.frames[0].keypoints.leftShoulder);

    const server = createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const profileRes = await request(baseUrl, "GET", "/api/student/profile");
      const uploadToken = await request(baseUrl, "POST", "/api/videos/upload-token", {
        fileName: "python-pose-training.mp4",
        sizeMb: 12,
        durationSec: 12,
        format: "mp4",
        analysisConsent: true,
        caseConsent: false
      });

      await request(baseUrl, "POST", `/api/videos/${uploadToken.videoId}/upload-status`, {
        uploadStatus: "uploaded",
        uploadProgress: 100,
        uploadError: ""
      });

      const taskCreated = await request(baseUrl, "POST", "/api/analysis/tasks", {
        videoId: uploadToken.videoId,
        studentId: profileRes.profile.id
      });

      const task = await request(baseUrl, "GET", `/api/analysis/tasks/${taskCreated.taskId}`);
      assert.strictEqual(task.status, "completed");
      assert.ok(task.reportId);

      const reportRes = await request(baseUrl, "GET", `/api/reports/${task.reportId}`);
      assert.strictEqual(reportRes.report.poseSummary.modelProvider, "synthetic");
      assert.ok(reportRes.report.ruleResults.length >= 5);
      assert.ok(reportRes.report.problemPoints.length >= 1);

      console.log("python pose service integration tests passed");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    poseService.kill("SIGTERM");
  }
}

async function directRequest(targetUrl, body) {
  const response = await httpRequest(targetUrl, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  assert.strictEqual(response.status, 200, `${targetUrl} expected 200, got ${response.status}: ${response.body}`);
  return JSON.parse(response.body);
}

async function waitForHealth(url, attempts = 40) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await httpRequest(url, { method: "GET" });
      if (response.status === 200) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError || new Error("Python Pose Service 未启动。");
}

async function request(baseUrl, method, route, body, expectedStatus = 200) {
  const response = await httpRequest(`${baseUrl}${route}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = JSON.parse(response.body);
  assert.strictEqual(response.status, expectedStatus, `${method} ${route} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

function httpRequest(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers["Content-Length"]) {
      headers["Content-Length"] = Buffer.byteLength(options.body);
    }
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: options.method || "GET",
      headers
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
