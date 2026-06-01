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

  const scores = {
    postureControl: clamp(baseScore - 2),
    rhythmControl: clamp(baseScore + 1),
    stability: clamp(baseScore - 3),
    aidAccuracy: clamp(baseScore - 4),
    safetyAwareness: clamp(baseScore)
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
        title: "快步阶段上身略前倾",
        detail: "从视频可见，快步阶段上身重心略向前，可能影响骑坐稳定性。",
        severity: "medium",
        evidence: movement ? `视频中 ${movement.timeRange} 阶段较明显。` : "视频片段中可见该问题。",
        suggestion: "下次训练中注意保持肩、髋、脚跟接近垂直线。"
      }
    ],
    riskPoints: [
      {
        title: "小腿位置稳定性需关注",
        detail: "该表现可能影响扶助准确性，建议教练结合现场情况复核。",
        riskLevel: "medium",
        evidence: risk ? `视频中 ${risk.timeRange} 阶段较明显。` : "视频角度有限，建议教练复核。",
        coachReviewRequired: true
      }
    ],
    improvements: history.length
      ? ["相比上次，节奏控制更连续。", "转弯前视线方向更明确。"]
      : ["首次报告已建立训练基线，后续可通过趋势观察进步。"],
    nextTrainingFocus: [
      "保持上身稳定，减少快步阶段前倾。",
      "练习小腿位置稳定性。",
      "转弯前提前看向行进方向。"
    ],
    trendSummary: buildTrendSummary(history, overallScore),
    limitations: [
      "本次视频角度有限，部分腿部动作判断需教练复核。"
    ]
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

function generateStudentExplanation(report) {
  return {
    reportId: report.id,
    title: "本次训练报告解读",
    explanation: `这次报告的重点不是分数本身，而是${report.problemPoints[0].title}。下次训练可以先关注：${report.nextTrainingFocus.slice(0, 2).join("、")}。风险提示需要结合教练现场判断。`,
    nextAction: "下次训练后继续上传同类视频，系统会生成趋势变化。"
  };
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

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

module.exports = {
  buildReportInput,
  generateTrainingReport,
  validateTrainingReport,
  draftCoachReview,
  generateStudentExplanation,
  generateOperationContent
};

