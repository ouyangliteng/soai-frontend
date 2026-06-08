const assert = require("assert");
const http = require("http");

process.env.SOAI_POSE_PROVIDER = "http";
process.env.SOAI_POSE_MODEL_PROVIDER = "yolo-pose";
process.env.SOAI_POSE_SERVICE_TIMEOUT_MS = "500";
process.env.SOAI_REQUIRE_REAL_POSE = "true";

const { createServer } = require("../src/server");

async function main() {
  const fakePoseService = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/v1/pose/detect") {
      const payload = await readJson(req);
      const frames = payload.frames || [];
      return sendJson(res, 200, {
        success: true,
        provider: "yolo-pose",
        frameCount: frames.length,
        poseFrameCount: frames.length,
        averageConfidence: 0.86,
        modelStatus: {
          provider: "yolo-pose",
          ready: true,
          loadable: true,
          cached: true,
          missing: []
        },
        frames: frames.map((frame, index) => ({
          frameIndex: frame.frameIndex,
          timestampMs: frame.timestampMs,
          keypoints: buildYoloLikeKeypoints(index, frame.width || 960, frame.height || 540),
          poseConfidence: 0.86,
          visibilityQuality: "usable",
          provider: "yolo-pose",
          modelName: "yolo11n-pose.pt"
        }))
      });
    }
    return sendJson(res, 404, { code: "NOT_FOUND" });
  });

  await new Promise((resolve) => fakePoseService.listen(0, "127.0.0.1", resolve));
  const fakePosePort = fakePoseService.address().port;
  process.env.SOAI_POSE_SERVICE_URL = `http://127.0.0.1:${fakePosePort}`;

  const apiServer = createServer();
  await new Promise((resolve) => apiServer.listen(0, resolve));
  const { port } = apiServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const profileRes = await request(baseUrl, "GET", "/api/student/profile");
    const uploadToken = await request(baseUrl, "POST", "/api/videos/upload-token", {
      fileName: "real-yolo-provider-check.mp4",
      sizeMb: 18,
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
    assert.strictEqual(reportRes.report.poseSummary.modelProvider, "yolo-pose");
    assert.strictEqual(reportRes.report.poseTrack.quality, "detected");
    assert.ok(reportRes.report.poseSummary.averageConfidence >= 0.8);
    assert.ok(reportRes.report.ruleResults.length >= 5);
    assert.ok(reportRes.report.problemPoints.length >= 1);
    assert.ok(reportRes.report.ruleResults.every((item) => Number.isFinite(item.measuredValue)));

    console.log("yolo provider report integration tests passed");
  } finally {
    await new Promise((resolve) => apiServer.close(resolve));
    await new Promise((resolve) => fakePoseService.close(resolve));
  }
}

function buildYoloLikeKeypoints(index, width, height) {
  const phase = index / 47;
  const drift = Math.sin(phase * Math.PI * 4) * 12;
  const baseX = width * 0.52;
  const baseY = height * 0.28;
  return {
    nose: point(baseX + drift, baseY - 42, 0.9),
    leftShoulder: point(baseX + 10 + drift, baseY + 18, 0.88),
    rightShoulder: point(baseX + 64 + drift, baseY + 20, 0.87),
    leftElbow: point(baseX - 50, baseY + 96, 0.84),
    rightElbow: point(baseX + 2, baseY + 96, 0.84),
    leftWrist: point(baseX - 88, baseY + 146, 0.82),
    rightWrist: point(baseX - 24, baseY + 145, 0.82),
    leftHip: point(baseX - 22, baseY + 178, 0.89),
    rightHip: point(baseX + 28, baseY + 178, 0.88),
    leftKnee: point(baseX - 44, baseY + 278, 0.84),
    rightKnee: point(baseX + 26, baseY + 282, 0.84),
    leftAnkle: point(baseX - 92 - drift, baseY + 402, 0.81),
    rightAnkle: point(baseX + 4 - drift * 0.5, baseY + 404, 0.81)
  };
}

function point(x, y, confidence) {
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    confidence
  };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
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
    const payload = options.body || "";
    const headers = { ...(options.headers || {}) };
    if (payload && !headers["Content-Length"]) {
      headers["Content-Length"] = Buffer.byteLength(payload);
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
    if (payload) req.write(payload);
    req.end();
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
