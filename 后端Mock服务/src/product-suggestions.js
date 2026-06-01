function getProductSuggestions(report) {
  const suggestions = [];
  const riskText = collectText(report.riskPoints);
  const problemText = collectText(report.problemPoints);
  const focusText = collectText(report.nextTrainingFocus);
  const allText = `${riskText} ${problemText} ${focusText}`;

  if (riskText || /风险|稳定|小腿|骑坐|前倾/.test(allText)) {
    suggestions.push({
      id: "product_air_vest",
      productName: "马术充气护甲",
      category: "安全装备知识",
      scenario: "适合在训练前建立风险意识，尤其是快步、转弯、过渡等基础训练场景。",
      whyRelevant: "本次报告包含稳定性或风险提示，建议把装备检查和训练前安全确认作为固定流程。",
      knowledgePoints: [
        "护甲不能替代正确骑姿、教练保护和场地安全管理。",
        "训练前应检查气瓶、连接绳、尺码贴合度和穿戴位置。",
        "公开内容中只能表达风险意识提升，不能承诺完全避免伤害。"
      ],
      nextStep: "需要了解护甲型号和穿戴方式时，可咨询教练或天猫旗舰店客服。",
      ctaLabel: "了解护甲知识",
      channel: "tmall",
      caution: "装备建议需结合学员年龄、训练内容和教练判断。"
    });
  }

  if (/节奏|扶助|转弯|视线|训练重点|教练/.test(allText)) {
    suggestions.push({
      id: "product_training_headset",
      productName: "马术教学耳机",
      category: "训练沟通工具",
      scenario: "适合训练中需要及时听到教练节奏、路线和扶助提醒的场景。",
      whyRelevant: "报告中的下次训练重点需要在训练中反复提醒，教学耳机可以帮助教练把指令更及时地传达给学员。",
      knowledgePoints: [
        "耳机用于提升训练沟通效率，不替代教练观察和现场保护。",
        "适合节奏控制、转弯路线、视线方向等需要即时提醒的训练重点。",
        "训练后仍建议上传视频复盘，形成“训练中提醒 + 训练后报告”的闭环。"
      ],
      nextStep: "下次训练可让教练把报告中的 1 到 2 个重点转成即时口令。",
      ctaLabel: "了解教学耳机",
      channel: "wechat_group",
      caution: "使用时应遵守俱乐部和教练的训练安排。"
    });
  }

  suggestions.push({
    id: "service_ai_training",
    productName: "SOAI AI 训练报告",
    category: "训练后复盘服务",
    scenario: "适合每次训练后记录问题点、风险点、进步和下次训练重点。",
    whyRelevant: "持续上传同类训练视频，系统才能生成更有参考价值的历史趋势。",
    knowledgePoints: [
      "至少完成 2 次上传后，趋势判断才更有意义。",
      "报告应由教练复核后再作为训练重点执行。",
      "同一角度、同一训练内容的视频更利于观察变化。"
    ],
    nextStep: "下次训练后继续上传同类视频，观察最近 5 次趋势。",
    ctaLabel: "继续上传训练",
    channel: "mini_program",
    caution: "AI 报告仅作教学辅助，不替代教练现场判断。"
  });

  return {
    reportId: report.id,
    title: "训练装备与服务建议",
    summary: "以下内容基于本次报告的训练场景生成，用于安全意识、训练沟通和复盘服务说明，不构成强制购买建议。",
    items: suggestions.slice(0, 3)
  };
}

function collectText(value) {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return [item.title, item.detail, item.suggestion, item.riskLevel].filter(Boolean).join(" ");
      })
      .join(" ");
  }
  return String(value);
}

module.exports = {
  getProductSuggestions
};
