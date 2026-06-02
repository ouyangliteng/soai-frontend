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

async function detectPose(frames, video, task) {
  const provider = process.env.SOAI_POSE_PROVIDER || "synthetic";
  if (provider !== "synthetic") {
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
