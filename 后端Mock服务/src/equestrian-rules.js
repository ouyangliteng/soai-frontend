const RULE_DEFINITIONS = [
  {
    ruleId: "ffe_vertical_head_pelvis_heel",
    metricName: "头-骨盆-脚跟垂直线",
    readValue: (feature) => feature.headPelvisHeelAlignment,
    target: 0.1,
    warn: 0.16,
    high: 0.24,
    explanation: "头部、骨盆与脚跟的垂直线偏差较明显，可能影响骑坐中心和基础平衡。"
  },
  {
    ruleId: "upper_body_stability",
    metricName: "上身稳定",
    readValue: (feature) => feature.torsoLeanDeg,
    target: 8,
    warn: 14,
    high: 22,
    explanation: "肩-髋连线前后波动较明显，可能影响快步阶段骑坐稳定。"
  },
  {
    ruleId: "ffe_shoulder_hip_heel_alignment",
    metricName: "肩-髋-脚跟对齐",
    readValue: (feature) => feature.shoulderHipHeelAlignment,
    target: 0.09,
    warn: 0.15,
    high: 0.22,
    explanation: "肩、髋、脚跟未能稳定接近同一垂直线，建议优先复核骑手是否在脚上方保持平衡。"
  },
  {
    ruleId: "lower_leg_stability",
    metricName: "小腿自然下垂",
    readValue: (feature) => feature.lowerLegDriftRatio,
    target: 0.08,
    warn: 0.14,
    high: 0.21,
    explanation: "脚踝相对髋部漂移偏大，小腿位置稳定性需要教练复核。"
  },
  {
    ruleId: "knee_softness",
    metricName: "膝部柔软度",
    readValue: (feature) => feature.kneeSoftnessError,
    target: 18,
    warn: 34,
    high: 50,
    explanation: "膝部角度偏离自然柔软区间，可能存在夹持偏紧、腿部僵硬或骑坐放松不足。"
  },
  {
    ruleId: "heel_down",
    metricName: "脚跟下沉",
    readValue: (feature) => feature.heelDownDeficit,
    target: 0.01,
    warn: 0.04,
    high: 0.08,
    explanation: "脚跟与脚尖关系不稳定，脚跟未充分向下承重时会影响下肢缓冲和安全边界。"
  },
  {
    ruleId: "arm_aid",
    metricName: "手臂与扶助",
    readValue: (feature) => feature.armAidError,
    target: 16,
    warn: 32,
    high: 48,
    explanation: "肘部角度、手部位置或手腕延线波动会影响扶助连续性。"
  },
  {
    ruleId: "hands_in_front",
    metricName: "手在身前",
    readValue: (feature) => feature.handsInFrontError,
    target: 0.02,
    warn: 0.06,
    high: 0.11,
    explanation: "双手相对躯干位置不够稳定，可能出现手过高、过散或未能保持身前轻柔联系。"
  },
  {
    ruleId: "dynamic_balance",
    metricName: "动态平衡",
    readValue: (feature) => feature.dynamicBalance,
    target: 0.08,
    warn: 0.14,
    high: 0.22,
    explanation: "连续帧中上身、骨盆或小腿位置波动较明显，说明动态平衡和节奏稳定性需要复核。"
  }
];

function applyEquestrianRules(poseFrames) {
  const usableFrames = poseFrames.filter((frame) => frame.visibilityQuality === "usable");
  const frames = usableFrames.length ? usableFrames : poseFrames;
  const features = enrichDynamicFeatures(frames.map(extractFeatures)).filter((feature) => feature.usable);

  const results = RULE_DEFINITIONS.map((definition) => buildRuleResult(definition, features));
  results.push(buildSymmetryRule(features));
  return results;
}

function buildRuleResult(definition, features) {
  const values = features.map(definition.readValue).filter((value) => Number.isFinite(value));
  const average = avg(values);
  const severity = getSeverity(average, definition);
  const score = scoreFromSeverity(severity, average, definition);
  const evidence = pickEvidenceFrames(features, definition.readValue);
  return {
    ruleResultId: `rule_${definition.ruleId}`,
    ruleId: definition.ruleId,
    metricName: definition.metricName,
    standardFamily: "FFE_Galops_position_observables",
    score,
    severity,
    evidenceFrames: evidence.map((feature) => feature.frameIndex),
    timeRange: formatTimeRange(evidence),
    explanation: definition.explanation,
    coachReviewRequired: severity !== "low",
    measuredValue: Number(average.toFixed(3)),
    targetValue: definition.target
  };
}

function buildSymmetryRule(features) {
  const values = features.map((feature) => Math.abs(feature.leftRightHipKneeDiffRatio)).filter(Number.isFinite);
  const average = avg(values);
  const severity = average > 0.12 ? "high" : average > 0.07 ? "medium" : "low";
  const evidence = features
    .slice()
    .sort((a, b) => Math.abs(b.leftRightHipKneeDiffRatio) - Math.abs(a.leftRightHipKneeDiffRatio))
    .slice(0, 3);
  return {
    ruleResultId: "rule_left_right_symmetry",
    ruleId: "left_right_symmetry",
    metricName: "左右对称性",
    standardFamily: "FFE_Galops_position_observables",
    score: severity === "high" ? 64 : severity === "medium" ? 78 : 90,
    severity,
    evidenceFrames: evidence.map((feature) => feature.frameIndex),
    timeRange: formatTimeRange(evidence),
    explanation: "左右髋点和膝点高度差体现骑坐对称性，差值过大时建议教练结合视频复核。",
    coachReviewRequired: severity !== "low",
    measuredValue: Number(average.toFixed(3)),
    targetValue: 0.07
  };
}

function extractFeatures(frame) {
  const k = frame.keypoints || {};
  const shoulder = midpoint(k.leftShoulder, k.rightShoulder);
  const hip = midpoint(k.leftHip, k.rightHip);
  const knee = midpoint(k.leftKnee, k.rightKnee);
  const ankle = midpoint(k.leftAnkle, k.rightAnkle);
  const heel = midpoint(k.leftHeel, k.rightHeel) || ankle;
  const toe = midpoint(k.leftToe, k.rightToe);
  const wrist = midpoint(k.leftWrist, k.rightWrist);
  const elbow = midpoint(k.leftElbow, k.rightElbow);
  const riderHeight = estimateRiderHeight(k, shoulder, hip, knee, ankle);

  if (!isUsablePoint(k.nose) || !isUsablePoint(shoulder) || !isUsablePoint(hip) || !isUsablePoint(knee)) {
    return {
      frameIndex: frame.frameIndex,
      timestampMs: frame.timestampMs,
      usable: false
    };
  }

  return {
    frameIndex: frame.frameIndex,
    timestampMs: frame.timestampMs,
    usable: true,
    riderHeight,
    torsoLeanDeg: Math.abs(angleDeg(shoulder, hip) - 90),
    headPelvisHeelAlignment: normalizedSpread([k.nose, hip, heel], riderHeight),
    shoulderHipHeelAlignment: normalizedSpread([shoulder, hip, heel], riderHeight),
    lowerLegDriftRatio: safeRatio(Math.abs((heel || ankle).x - hip.x), riderHeight),
    kneeSoftnessError: jointRangeError(avgPairAngles(k.leftHip, k.leftKnee, k.leftAnkle, k.rightHip, k.rightKnee, k.rightAnkle), 98, 138),
    heelDownDeficit: calculateHeelDownDeficit(heel, toe, riderHeight),
    armAidError: buildArmAidError(k, shoulder, elbow, wrist),
    handsInFrontError: buildHandsInFrontError(shoulder, hip, wrist, riderHeight),
    leftRightHipKneeDiffRatio: safeRatio(
      Math.abs(pointY(k.leftHip) - pointY(k.rightHip)) + Math.abs(pointY(k.leftKnee) - pointY(k.rightKnee)) * 0.5,
      riderHeight
    ),
    dynamicBalance: 0
  };
}

function enrichDynamicFeatures(features) {
  const usable = features.filter((feature) => feature.usable);
  const torsoSpread = stddev(usable.map((feature) => feature.torsoLeanDeg)) / 30;
  const lowerLegSpread = stddev(usable.map((feature) => feature.lowerLegDriftRatio));
  const alignmentSpread = stddev(usable.map((feature) => feature.shoulderHipHeelAlignment));
  const dynamicBalance = torsoSpread + lowerLegSpread + alignmentSpread;
  return features.map((feature) => ({
    ...feature,
    dynamicBalance
  }));
}

function buildArmAidError(k, shoulder, elbow, wrist) {
  const elbowAngle = avgPairAngles(k.leftShoulder, k.leftElbow, k.leftWrist, k.rightShoulder, k.rightElbow, k.rightWrist);
  const elbowError = jointRangeError(elbowAngle, 78, 142);
  const wristLineError = Number.isFinite(elbowAngle) ? 0 : 18;
  const handSpread = isUsablePoint(wrist) && isUsablePoint(elbow) ? Math.abs(wrist.y - elbow.y) / 6 : 12;
  const shoulderMissingPenalty = isUsablePoint(shoulder) ? 0 : 10;
  return elbowError + wristLineError + handSpread + shoulderMissingPenalty;
}

function buildHandsInFrontError(shoulder, hip, wrist, riderHeight) {
  if (!isUsablePoint(wrist) || !isUsablePoint(shoulder) || !isUsablePoint(hip)) return 0.12;
  const torsoX = (shoulder.x + hip.x) / 2;
  const expectedForward = riderHeight * 0.05;
  return Math.max(0, safeRatio(Math.abs(wrist.x - torsoX) - expectedForward, riderHeight));
}

function calculateHeelDownDeficit(heel, toe, riderHeight) {
  if (!isUsablePoint(heel) || !isUsablePoint(toe)) return 0.02;
  return Math.max(0, safeRatio(toe.y - heel.y, riderHeight));
}

function estimateRiderHeight(k, shoulder, hip, knee, ankle) {
  const vertical = [
    Math.abs(pointY(k.nose) - pointY(shoulder)),
    Math.abs(pointY(shoulder) - pointY(hip)),
    Math.abs(pointY(hip) - pointY(knee)),
    Math.abs(pointY(knee) - pointY(ankle))
  ].filter((value) => Number.isFinite(value) && value > 0);
  return Math.max(80, vertical.reduce((sum, value) => sum + value, 0));
}

function normalizedSpread(points, denominator) {
  const xs = points.filter(isUsablePoint).map((point) => point.x);
  if (xs.length < 2) return 0;
  return safeRatio(Math.max(...xs) - Math.min(...xs), denominator);
}

function jointRangeError(value, min, max) {
  if (!Number.isFinite(value)) return max - min;
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

function avgPairAngles(a1, b1, c1, a2, b2, c2) {
  return avg([
    angleBetween(a1, b1, c1),
    angleBetween(a2, b2, c2)
  ].filter(Number.isFinite));
}

function getSeverity(value, config) {
  if (value >= config.high) return "high";
  if (value >= config.warn) return "medium";
  return "low";
}

function scoreFromSeverity(severity, value, config) {
  if (severity === "high") return Math.max(58, Math.round(70 - overshootRatio(value, config.high) * 12));
  if (severity === "medium") return Math.max(72, Math.round(84 - overshootRatio(value, config.warn) * 8));
  return Math.min(94, Math.round(90 - overshootRatio(value, config.target) * 4));
}

function overshootRatio(value, target) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, (value - target) / target);
}

function pickEvidenceFrames(features, readValue) {
  return features
    .map((feature) => ({ ...feature, ruleValue: readValue(feature) }))
    .filter((feature) => Number.isFinite(feature.ruleValue))
    .sort((a, b) => b.ruleValue - a.ruleValue)
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
  if (isUsablePoint(a) && isUsablePoint(b)) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      confidence: Math.min(Number(a.confidence || 0), Number(b.confidence || 0))
    };
  }
  return isUsablePoint(a) ? a : (isUsablePoint(b) ? b : null);
}

function angleDeg(a, b) {
  if (!isUsablePoint(a) || !isUsablePoint(b)) return NaN;
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function angleBetween(a, b, c) {
  if (!isUsablePoint(a) || !isUsablePoint(b) || !isUsablePoint(c)) return NaN;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function isUsablePoint(point) {
  return point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

function pointY(point) {
  return isUsablePoint(point) ? Number(point.y) : NaN;
}

function safeRatio(value, denominator) {
  if (!Number.isFinite(value) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return value / denominator;
}

function avg(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function stddev(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) return 0;
  const mean = avg(clean);
  return Math.sqrt(avg(clean.map((value) => Math.pow(value - mean, 2))));
}

module.exports = {
  applyEquestrianRules
};
