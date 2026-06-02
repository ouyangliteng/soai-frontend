const bannedPhrases = [
  "AI 已经准确判断",
  "完全安全",
  "一定能提升",
  "无需教练",
  "你动作错误严重",
  "马上纠正否则危险"
];

function buildReportInput({ profile, video, history }) {
  return {
    studentProfile: profile,
    videoAnalysis: {
      durationSec: video ? video.durationSec : 68,
      cameraAngleQuality: "medium",
      detectedMovements: [
        {
          timeRange: "00:18-00:24",
          finding: "快步阶段上身略前倾",
          confidence: "medium"
        },
        {
          timeRange: "00:42-00:50",
          finding: "转弯前视线方向较明确",
          confidence: "medium"
        }
      ],
      detectedRisks: [
        {
          timeRange: "00:30-00:38",
          finding: "膝部夹持偏紧，小腿位置不够稳定",
          confidence: "medium"
        }
      ]
    },
    poseSummary: null,
    ruleResults: [],
    history: {
      lastReports: history.map((report) => ({
        trainingDate: report.summary.trainingDate,
        overallScore: report.summary.overallScore,
        postureControl: report.scores.postureControl,
        rhythmControl: report.scores.rhythmControl,
        stability: report.scores.stability,
        riskCount: report.riskPoints.length
      }))
    }
  };
}

function generateTrainingReport(input) {
  const history = input.history && input.history.lastReports ? input.history.lastReports : [];
  const latest = history[history.length - 1];
  const baseScore = latest ? Math.min(95, latest.overallScore + 2) : 80;
  const cameraQuality = input.videoAnalysis.cameraAngleQuality;
  const confidenceLevel = cameraQuality === "high" ? "high" : "medium";
  const movement = input.videoAnalysis.detectedMovements[0];
  const risk = input.videoAnalysis.detectedRisks[0];
  const ruleResults = input.ruleResults && input.ruleResults.length ? input.ruleResults : [];
  const ruleScoreMap = Object.fromEntries(ruleResults.map((item) => [item.ruleId, item.score]));
  const mainProblem = pickRule(ruleResults, ["upper_body_stability", "lower_leg_stability", "arm_aid"]) || null;
  const mainRisk = pickRule(ruleResults, ["lower_leg_stability", "knee_grip", "left_right_symmetry"]) || null;

  const scores = {
    postureControl: clamp(ruleScoreMap.upper_body_stability || baseScore - 2),
    rhythmControl: clamp(baseScore + 1),
    stability: clamp(ruleScoreMap.lower_leg_stability || baseScore - 3),
    aidAccuracy: clamp(ruleScoreMap.arm_aid || baseScore - 4),
    safetyAwareness: clamp(ruleScoreMap.knee_grip || baseScore)
  };
  const overallScore = Math.round(
    scores.postureControl * 0.25 +
      scores.rhythmControl * 0.2 +
      scores.stability * 0.25 +
      scores.aidAccuracy * 0.15 +
      scores.safetyAwareness * 0.15
  );

  return {
    summary: {
      overallScore,
      oneLineConclusion: "本次训练节奏较稳定，转弯阶段身体控制仍需加强。",
      confidenceLevel,
      coachReviewRecommended: true
    },
    scores,
    problemPoints: [
      {
        ruleResultId: mainProblem ? mainProblem.ruleResultId : "",
        title: mainProblem ? `${mainProblem.metricName}需关注` : "快步阶段上身略前倾",
        detail: mainProblem ? mainProblem.explanation : "从视频可见，快步阶段上身重心略向前，可能影响骑坐稳定性。",
        severity: mainProblem ? severityToReport(mainProblem.severity) : "medium",
        evidence: mainProblem ? `视频中 ${mainProblem.timeRange} 阶段较明显。` : movement ? `视频中 ${movement.timeRange} 阶段较明显。` : "视频片段中可见该问题。",
        suggestion: buildSuggestion(mainProblem ? mainProblem.ruleId : "upper_body_stability")
      }
    ],
    riskPoints: [
      {
        ruleResultId: mainRisk ? mainRisk.ruleResultId : "",
        title: mainRisk ? `${mainRisk.metricName}风险需复核` : "小腿位置稳定性需关注",
        detail: mainRisk ? mainRisk.explanation : "该表现可能影响扶助准确性，建议教练结合现场情况复核。",
        riskLevel: mainRisk && mainRisk.severity === "high" ? "high" : "medium",
        evidence: mainRisk ? `视频中 ${mainRisk.timeRange} 阶段较明显。` : risk ? `视频中 ${risk.timeRange} 阶段较明显。` : "视频角度有限，建议教练复核。",
        coachReviewRequired: true
      }
    ],
    improvements: history.length
      ? ["相比上次，节奏控制更连续。", "转弯前视线方向更明确。"]
      : ["首次报告已建立训练基线，后续可通过趋势观察进步。"],
    nextTrainingFocus: [
      buildSuggestion("upper_body_stability"),
      buildSuggestion("lower_leg_stability"),
      buildSuggestion("arm_aid")
    ],
    trendSummary: buildTrendSummary(history, overallScore),
    limitations: [
      input.poseSummary && input.poseSummary.usableFrameRate < 0.7
        ? "本次可用姿态帧不足 70%，部分判断需教练重点复核。"
        : "本次视频角度和遮挡仍会影响腿部与手部细节判断，需教练结合现场情况复核。"
    ],
    poseSummary: input.poseSummary || null,
    ruleResults
  };
}

function validateTrainingReport(report) {
  const issues = [];
  if (!report || typeof report !== "object") issues.push("报告必须是对象。");
  if (!report.summary || typeof report.summary.overallScore !== "number") issues.push("缺少总体评分。");
  if (!Array.isArray(report.problemPoints) || report.problemPoints.length < 1) issues.push("至少需要 1 条问题点。");
  if (!Array.isArray(report.riskPoints)) issues.push("风险点必须是数组。");
  if (!Array.isArray(report.improvements) || report.improvements.length < 1) issues.push("至少需要 1 条本次进步。");
  if (!Array.isArray(report.nextTrainingFocus) || report.nextTrainingFocus.length < 3 || report.nextTrainingFocus.length > 5) {
    issues.push("下次训练重点需要控制在 3 到 5 条。");
  }
  if (!Array.isArray(report.limitations) || report.limitations.length < 1) issues.push("需要包含局限性说明。");

  const text = JSON.stringify(report);
  bannedPhrases.forEach((phrase) => {
    if (text.includes(phrase)) issues.push(`包含禁用表达：${phrase}`);
  });

  return {
    valid: issues.length === 0,
    issues
  };
}

function draftCoachReview(report) {
  const focusItems = report.coachFocusItems && report.coachFocusItems.length ? report.coachFocusItems : report.nextTrainingFocus.slice(0, 3);
  return {
    reportId: report.id,
    reviewDraft: `AI 对“${report.problemPoints[0].title}”的观察有参考价值，建议结合现场情况复核。下次训练可优先关注${focusItems.join("、")}。`,
    focusItems,
    riskReminder: report.riskPoints.length ? "报告包含风险点，建议教练确认后再同步给学员。" : "本次未出现明显中高风险点，可作为常规复盘参考。",
    mustConfirmByCoach: true
  };
}

function generateTeachingOutline(report, trend, payload = {}) {
  const weeks = clampWeeks(payload.weeks || 4);
  const focusItems = report.coachFocusItems && report.coachFocusItems.length ? report.coachFocusItems : report.nextTrainingFocus.slice(0, 3);
  const coachObservation = payload.coachObservation || "教练尚未补充学员认知，建议生成后由教练结合现场情况修订。";
  const stageGoal = payload.stageGoal || `未来 ${weeks} 周优先提升${focusItems.slice(0, 2).join("、")}。`;
  const constraints = payload.constraints || "以安全和基础稳定性为优先，每次训练只抓 1 到 2 个重点。";

  return {
    id: `outline_${Date.now()}`,
    reportId: report.id,
    studentId: report.studentId,
    title: `${weeks} 周阶段性教学任务大纲`,
    coachObservation,
    stageGoal,
    constraints,
    aiBasis: [
      `本次主要问题：${report.problemPoints[0].title}`,
      `风险关注：${report.riskPoints[0] ? report.riskPoints[0].title : "本次未标记中高风险点"}`,
      trend && (trend.trendSummary || trend.summary) ? `趋势依据：${trend.trendSummary || trend.summary}` : `下次训练重点：${focusItems.join("、")}`
    ],
    safetyBoundary: "AI 只生成教学辅助大纲，不替代教练现场判断。涉及风险动作、马匹状态和训练强度时，必须由教练确认后执行。",
    weeklyPlan: buildWeeklyPlan(weeks, focusItems, report),
    reviewChecklist: [
      "本周训练目标是否被学员理解。",
      "视频报告中的问题点是否在现场复核成立。",
      "风险点是否已转成训练前检查和训练中提醒。",
      "下次上传视频是否能覆盖同类动作，便于趋势对比。"
    ],
    nextUploadRequirement: "建议下次上传 30 到 90 秒同类训练片段，保持相近拍摄角度，便于 AI 和教练对比趋势。",
    mustConfirmByCoach: true,
    createdAt: new Date().toISOString()
  };
}

function generateStudentExplanation(report) {
  return {
    reportId: report.id,
    title: "本次训练报告解读",
    explanation: `这次报告的重点不是分数本身，而是${report.problemPoints[0].title}。下次训练可以先关注：${report.nextTrainingFocus.slice(0, 2).join("、")}。风险提示需要结合教练现场判断。`,
    nextAction: "下次训练后继续上传同类视频，系统会生成趋势变化。"
  };
}

function buildWeeklyPlan(weeks, focusItems, report) {
  const themes = [
    "建立安全边界和动作基线",
    "强化节奏与骑坐稳定",
    "转化为路线和扶助任务",
    "阶段复盘与下一阶段目标"
  ];
  const problemTitle = report.problemPoints[0].title;
  const riskTitle = report.riskPoints[0] ? report.riskPoints[0].title : "基础安全意识";

  return Array.from({ length: weeks }).map((_, index) => {
    const focus = focusItems[index % focusItems.length] || focusItems[0] || problemTitle;
    return {
      week: index + 1,
      theme: themes[Math.min(index, themes.length - 1)],
      coachTasks: [
        `训练前确认本周主目标：${focus}`,
        `结合现场情况复核“${problemTitle}”是否仍然出现`,
        `将“${riskTitle}”转成训练中的短口令提醒`
      ],
      studentTasks: [
        "训练前复述本周 1 个动作重点。",
        "训练中只关注教练确认的核心提醒，不同时追求过多动作变化。"
      ],
      aiReviewFocus: [
        focus,
        problemTitle,
        riskTitle
      ],
      homework: [
        "课后查看本周报告解读。",
        "记录 1 条自己最能理解的动作提醒。"
      ],
      acceptance: [
        "教练确认本周重点完成情况。",
        "下次视频中同类问题出现频率降低或稳定性提高。"
      ]
    };
  });
}

function generateOperationContent(report) {
  const anonymousName = "一位初级进阶学员";
  return {
    reportId: report.id,
    xiaohongshu: {
      title: "上传一段马术训练视频，AI 报告能看出什么？",
      body: `${anonymousName}上传了一段快步训练视频。报告没有只给分数，而是拆成问题点、风险点、本次进步和下次训练重点。本次重点是${report.problemPoints[0].title}，风险点需要教练结合现场判断。AI 不替代教练，但可以让训练复盘更清楚。`,
      tags: ["#马术", "#马术训练", "#AI训练报告", "#骑马学习", "#马术教练"]
    },
    douyin: {
      title: "30 秒看懂 AI 马术训练报告",
      script: [
        "0-3 秒：展示训练视频片段。",
        "3-8 秒：展示 AI 分析中。",
        `8-16 秒：展示问题点：${report.problemPoints[0].title}。`,
        "16-24 秒：展示教练复核意见。",
        "24-30 秒：展示下次训练重点。"
      ]
    },
    wechatGroup: {
      message: `本次案例重点：${report.problemPoints[0].title}。请注意，AI 报告仅作训练复盘辅助，风险点仍需教练结合现场判断。`
    }
  };
}

function buildTrendSummary(history, currentScore) {
  if (!history.length) return "首次报告已建立训练基线，完成 2 次以上训练后生成趋势。";
  const first = history[0].overallScore;
  const direction = currentScore >= first ? "提升" : "波动";
  return `最近 ${history.length + 1} 次训练中，总评分${direction}，节奏控制保持较好，上身稳定性仍需持续观察。`;
}

function pickRule(ruleResults, preferredRuleIds) {
  const byPreference = preferredRuleIds
    .map((ruleId) => ruleResults.find((item) => item.ruleId === ruleId && item.severity !== "low"))
    .find(Boolean);
  if (byPreference) return byPreference;
  return ruleResults.slice().sort((a, b) => a.score - b.score)[0] || null;
}

function severityToReport(severity) {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function buildSuggestion(ruleId) {
  const map = {
    upper_body_stability: "保持上身稳定，减少快步阶段前倾，优先确认肩、髋、脚跟接近垂直线。",
    lower_leg_stability: "练习小腿位置稳定性，避免脚踝相对髋部过度前后漂移。",
    knee_grip: "放松膝部夹持，优先保持骑坐深度和腿部自然贴靠。",
    arm_aid: "保持手臂和前臂扶助连续，避免手部高度和肘角大幅波动。",
    left_right_symmetry: "通过轻快步节奏练习观察左右骑坐对称性。"
  };
  return map[ruleId] || "下次训练中只抓 1 到 2 个重点，并由教练现场确认。";
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function clampWeeks(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 4;
  return Math.max(2, Math.min(8, Math.round(numberValue)));
}

module.exports = {
  buildReportInput,
  generateTrainingReport,
  validateTrainingReport,
  draftCoachReview,
  generateTeachingOutline,
  generateStudentExplanation,
  generateOperationContent
};
