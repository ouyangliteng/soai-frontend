function applyEquestrianRules(poseFrames) {
  const usableFrames = poseFrames.filter((frame) => frame.visibilityQuality === "usable");
  const frames = usableFrames.length ? usableFrames : poseFrames;
  const features = frames.map(extractFeatures);

  return [
    buildRuleResult("upper_body_stability", "上身稳定", features, (feature) => feature.torsoLeanDeg, {
      target: 8,
      warn: 14,
      high: 22,
      explanation: "肩-髋连线前后波动较明显，可能影响快步阶段骑坐稳定。"
    }),
    buildRuleResult("lower_leg_stability", "小腿位置", features, (feature) => feature.lowerLegDrift, {
      target: 30,
      warn: 54,
      high: 76,
      explanation: "踝点相对髋点漂移偏大，小腿位置稳定性需要教练复核。"
    }),
    buildRuleResult("knee_grip", "膝盖与骑坐", features, (feature) => feature.kneeAngleDeg, {
      target: 112,
      warn: 95,
      high: 82,
      inverse: true,
      explanation: "膝角偏小，可能存在膝部夹持偏紧或骑坐放松不足。"
    }),
    buildRuleResult("arm_aid", "手臂与扶助", features, (feature) => feature.elbowAngleDeg, {
      target: 115,
      warn: 88,
      high: 70,
      inverse: true,
      explanation: "肘部角度和手部高度波动会影响扶助连续性。"
    }),
    buildSymmetryRule(features)
  ];
}

function buildRuleResult(ruleId, metricName, features, readValue, config) {
  const values = features.map(readValue).filter((value) => Number.isFinite(value));
  const average = avg(values);
  const severity = getSeverity(average, config);
  const score = severity === "high" ? 62 : severity === "medium" ? 76 : 88;
  const evidence = pickEvidenceFrames(features, values, config);
  return {
    ruleResultId: `rule_${ruleId}`,
    ruleId,
    metricName,
    score,
    severity,
    evidenceFrames: evidence.map((feature) => feature.frameIndex),
    timeRange: formatTimeRange(evidence),
    explanation: config.explanation,
    coachReviewRequired: severity !== "low",
    measuredValue: Number(average.toFixed(1)),
    targetValue: config.target
  };
}

function buildSymmetryRule(features) {
  const values = features.map((feature) => Math.abs(feature.leftRightHipDiff)).filter(Number.isFinite);
  const average = avg(values);
  const severity = average > 26 ? "high" : average > 14 ? "medium" : "low";
  const evidence = features
    .slice()
    .sort((a, b) => Math.abs(b.leftRightHipDiff) - Math.abs(a.leftRightHipDiff))
    .slice(0, 3);
  return {
    ruleResultId: "rule_left_right_symmetry",
    ruleId: "left_right_symmetry",
    metricName: "左右对称性",
    score: severity === "high" ? 64 : severity === "medium" ? 78 : 90,
    severity,
    evidenceFrames: evidence.map((feature) => feature.frameIndex),
    timeRange: formatTimeRange(evidence),
    explanation: "左右髋点和膝点高度差体现骑坐对称性，差值过大时建议教练结合视频复核。",
    coachReviewRequired: severity !== "low",
    measuredValue: Number(average.toFixed(1)),
    targetValue: 14
  };
}

function extractFeatures(frame) {
  const k = frame.keypoints;
  const shoulder = midpoint(k.leftShoulder, k.rightShoulder);
  const hip = midpoint(k.leftHip, k.rightHip);
  const ankle = midpoint(k.leftAnkle, k.rightAnkle);
  return {
    frameIndex: frame.frameIndex,
    timestampMs: frame.timestampMs,
    torsoLeanDeg: Math.abs(angleDeg(shoulder, hip) - 90),
    lowerLegDrift: Math.abs(ankle.x - hip.x),
    kneeAngleDeg: angleBetween(k.leftHip, k.leftKnee, k.leftAnkle),
    elbowAngleDeg: angleBetween(k.leftShoulder, k.leftElbow, k.leftWrist),
    leftRightHipDiff: (k.leftHip.y - k.rightHip.y) + (k.leftKnee.y - k.rightKnee.y) * 0.5
  };
}

function getSeverity(value, config) {
  if (config.inverse) {
    if (value <= config.high) return "high";
    if (value <= config.warn) return "medium";
    return "low";
  }
  if (value >= config.high) return "high";
  if (value >= config.warn) return "medium";
  return "low";
}

function pickEvidenceFrames(features, values, config) {
  return features
    .map((feature, index) => ({ ...feature, ruleValue: values[index] }))
    .filter((feature) => Number.isFinite(feature.ruleValue))
    .sort((a, b) => config.inverse ? a.ruleValue - b.ruleValue : b.ruleValue - a.ruleValue)
    .slice(0, 3);
}

function formatTimeRange(features) {
  if (!features.length) return "00:00-00:00";
  const sorted = features.slice().sort((a, b) => a.timestampMs - b.timestampMs);
  return `${formatTime(sorted[0].timestampMs)}-${formatTime(sorted[sorted.length - 1].timestampMs)}`;
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function angleDeg(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function angleBetween(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

module.exports = {
  applyEquestrianRules
};
