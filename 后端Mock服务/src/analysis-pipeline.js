const { extractFrames } = require("./video-processing");
const { detectPose } = require("./pose-service");
const { applyEquestrianRules } = require("./equestrian-rules");
const {
  buildReportInput,
  generateTrainingReport,
  validateTrainingReport
} = require("./ai-agents");

async function runAnalysisPipeline({ db, task, video, createReport }) {
  try {
    setStage(task, "extracting_frames", 20, "正在抽取训练视频关键帧");
    const frames = extractFrames(video, task);
    task.frames = frames;

    setStage(task, "detecting_pose", 45, "正在识别骑手人体关键点");
    const poseFrames = await detectPose(frames, video, task);
    task.poseDetections = poseFrames;

    setStage(task, "applying_rules", 68, "正在应用马术动作规则引擎");
    const ruleResults = applyEquestrianRules(poseFrames);
    task.ruleResults = ruleResults;

    setStage(task, "generating_report", 86, "正在根据姿态证据生成训练报告");
    const poseSummary = buildPoseSummary(frames, poseFrames);
    const reportInput = buildReportInput({
      profile: db.profile,
      video,
      history: db.reports.slice(-5)
    });
    reportInput.poseSummary = poseSummary;
    reportInput.ruleResults = ruleResults;
    reportInput.videoAnalysis.detectedMovements = ruleResults
      .filter((item) => ["upper_body_stability", "arm_aid", "left_right_symmetry"].includes(item.ruleId))
      .map(toDetectedFinding);
    reportInput.videoAnalysis.detectedRisks = ruleResults
      .filter((item) => item.coachReviewRequired)
      .map(toDetectedFinding);

    const aiReport = generateTrainingReport(reportInput);
    const validation = validateTrainingReport(aiReport);
    if (!validation.valid) {
      throw new Error(`AI 报告校验失败：${validation.issues.join("；")}`);
    }

    const report = createReport({
      task,
      video,
      aiReport,
      poseSummary,
      frames,
      poseFrames,
      ruleResults
    });
    task.reportId = report.id;
    task.status = "waiting_coach_review";
    task.progress = 96;
    task.progressText = "报告已生成，等待教练复核";
    task.updatedAt = new Date().toISOString();

    task.status = "completed";
    task.progress = 100;
    task.progressText = "报告已生成";
    task.updatedAt = new Date().toISOString();
    return task;
  } catch (error) {
    task.status = "failed";
    task.progressText = "分析失败，请重试";
    task.errorCode = "ANALYSIS_PIPELINE_FAILED";
    task.errorMessage = error.message;
    task.logs.push({
      stage: task.status,
      level: "error",
      message: error.message,
      at: new Date().toISOString()
    });
    task.updatedAt = new Date().toISOString();
    return task;
  }
}

function buildPoseSummary(frames, poseFrames) {
  const usable = poseFrames.filter((frame) => frame.visibilityQuality === "usable");
  const averageConfidence = average(poseFrames.map((frame) => frame.poseConfidence));
  return {
    frameCount: frames.length,
    poseFrameCount: poseFrames.length,
    usableFrameCount: usable.length,
    usableFrameRate: Number((usable.length / Math.max(1, poseFrames.length)).toFixed(2)),
    averageConfidence,
    modelProvider: poseFrames[0] ? poseFrames[0].provider : "none"
  };
}

function toDetectedFinding(rule) {
  return {
    ruleResultId: rule.ruleResultId,
    timeRange: rule.timeRange,
    finding: rule.explanation,
    confidence: rule.score >= 84 ? "high" : rule.score >= 72 ? "medium" : "low"
  };
}

function setStage(task, status, progress, progressText) {
  task.status = status;
  task.progress = progress;
  task.progressText = progressText;
  task.updatedAt = new Date().toISOString();
  task.logs.push({
    stage: status,
    level: "info",
    message: progressText,
    at: task.updatedAt
  });
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(2));
}

module.exports = {
  runAnalysisPipeline
};
