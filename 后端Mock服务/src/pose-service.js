const KEYPOINT_NAMES = [
  "nose",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle"
];

const OPTIONAL_TRACK_KEYPOINT_NAMES = [
  "leftHeel",
  "rightHeel",
  "leftToe",
  "rightToe"
];

async function detectPose(frames, video, task) {
  const provider = process.env.SOAI_POSE_PROVIDER || "synthetic";
  if (provider === "http" || provider === "python" || provider === "auto") {
    try {
      return await detectPoseByHttp(frames, video, task, provider);
    } catch (error) {
      const allowSyntheticFallback = process.env.SOAI_POSE_ALLOW_SYNTHETIC_FALLBACK === "true";
      task.logs.push({
        stage: "detecting_pose",
        level: provider === "auto" && allowSyntheticFallback ? "warn" : "error",
        message: `Python Pose Service 调用失败：${error.message}${provider === "auto" && allowSyntheticFallback ? "，已回退到本地模拟关键点。" : ""}`,
        at: new Date().toISOString()
      });
      if (provider !== "auto" || !allowSyntheticFallback) throw error;
    }
  } else if (provider !== "synthetic") {
    task.logs.push({
      stage: "detecting_pose",
      level: "warn",
      message: `姿态识别服务 ${provider} 尚未配置，已使用 SOAI 标准关键点模拟适配器。`,
      at: new Date().toISOString()
    });
  }

  return frames.map((frame, index) => {
    const phase = index / Math.max(1, frames.length - 1);
    const keypoints = buildRiderPose(phase, frame.width, frame.height);
    const poseConfidence = average(KEYPOINT_NAMES.map((name) => keypoints[name].confidence));
    return {
      frameIndex: frame.frameIndex,
      timestampMs: frame.timestampMs,
      keypoints,
      poseConfidence,
      visibilityQuality: poseConfidence >= 0.72 ? "usable" : "low",
      provider
    };
  });
}

async function detectPoseByHttp(frames, video, task, providerMode) {
  const baseUrl = (process.env.SOAI_POSE_SERVICE_URL || "http://127.0.0.1:8793").replace(/\/$/, "");
  const modelProvider = process.env.SOAI_POSE_MODEL_PROVIDER || "synthetic";
  const payload = {
    taskId: task.id,
    videoId: video.id,
    provider: modelProvider,
    video: {
      id: video.id,
      fileName: video.fileName,
      durationSec: video.durationSec,
      storageProvider: video.storageProvider,
      storageKey: video.storageKey
    },
    frames: frames.map((frame) => ({
      frameIndex: frame.frameIndex,
      timestampMs: frame.timestampMs,
      imagePath: frame.imagePath,
      imageUrl: frame.imageUrl,
      width: frame.width,
      height: frame.height,
      extractedBy: frame.extractedBy
    }))
  };
  const response = await postJson(`${baseUrl}/v1/pose/detect`, payload, Number(process.env.SOAI_POSE_SERVICE_TIMEOUT_MS || 30000));
  if (!response.success || !Array.isArray(response.frames)) {
    throw new Error(response.message || "姿态服务返回格式不正确。");
  }
  const normalized = response.frames.map((frame) => normalizePoseFrame(frame, response.provider || modelProvider));
  task.logs.push({
    stage: "detecting_pose",
    level: "info",
    message: `Python Pose Service 已返回 ${normalized.length} 帧关键点，provider=${response.provider || modelProvider}，mode=${providerMode}。`,
    at: new Date().toISOString()
  });
  return normalized;
}

function normalizePoseFrame(frame, fallbackProvider) {
  const keypoints = {};
  KEYPOINT_NAMES.forEach((name) => {
    const pointValue = frame.keypoints && frame.keypoints[name] ? frame.keypoints[name] : {};
    keypoints[name] = {
      x: Number(pointValue.x || 0),
      y: Number(pointValue.y || 0),
      confidence: Number(pointValue.confidence || 0)
    };
  });
  OPTIONAL_TRACK_KEYPOINT_NAMES.forEach((name) => {
    if (!frame.keypoints || !frame.keypoints[name]) return;
    keypoints[name] = {
      x: Number(frame.keypoints[name].x || 0),
      y: Number(frame.keypoints[name].y || 0),
      confidence: Number(frame.keypoints[name].confidence || 0)
    };
  });
  const poseConfidence = Number.isFinite(Number(frame.poseConfidence))
    ? Number(frame.poseConfidence)
    : average(KEYPOINT_NAMES.map((name) => keypoints[name].confidence));
  return {
    frameIndex: Number(frame.frameIndex || 0),
    timestampMs: Number(frame.timestampMs || 0),
    keypoints,
    poseConfidence,
    visibilityQuality: frame.visibilityQuality || (poseConfidence >= 0.72 ? "usable" : "low"),
    provider: frame.provider || fallbackProvider,
    modelName: frame.modelName || ""
  };
}

function postJson(targetUrl, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const body = JSON.stringify(payload);
    const transport = url.protocol === "https:" ? require("https") : require("http");
    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json;
        try {
          json = text ? JSON.parse(text) : {};
        } catch (error) {
          return reject(new Error(`姿态服务 JSON 解析失败：${error.message}`));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(json.message || json.code || `姿态服务 HTTP ${res.statusCode}`));
        }
        resolve(json);
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error(`姿态服务请求超时 ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function buildRiderPose(phase, width, height) {
  const sway = Math.sin(phase * Math.PI * 4);
  const turn = phase > 0.58 ? 18 : 0;
  const torsoLean = 30 + sway * 10;
  const ankleDrift = 28 + Math.cos(phase * Math.PI * 6) * 20;
  const baseX = width * 0.52;
  const baseY = height * 0.28;

  return {
    nose: point(baseX + turn, baseY - 42, 0.82),
    leftShoulder: point(baseX - 28 + torsoLean, baseY + 18, 0.86),
    rightShoulder: point(baseX + 28 + torsoLean, baseY + 20, 0.84),
    leftElbow: point(baseX - 50, baseY + 95, 0.78),
    rightElbow: point(baseX + 2, baseY + 95, 0.8),
    leftWrist: point(baseX - 88, baseY + 146, 0.76),
    rightWrist: point(baseX - 24, baseY + 145, 0.78),
    leftHip: point(baseX - 22, baseY + 178, 0.86),
    rightHip: point(baseX + 28, baseY + 178, 0.85),
    leftKnee: point(baseX - 44, baseY + 278, 0.75),
    rightKnee: point(baseX + 26, baseY + 282, 0.76),
    leftAnkle: point(baseX - 52 - ankleDrift, baseY + 402, 0.7),
    rightAnkle: point(baseX + 24 - ankleDrift * 0.4, baseY + 404, 0.72)
  };
}

function point(x, y, confidence) {
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    confidence: Number(confidence.toFixed(2))
  };
}

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

module.exports = {
  KEYPOINT_NAMES,
  detectPose
};
