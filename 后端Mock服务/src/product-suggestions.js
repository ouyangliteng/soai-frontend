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
      scenario: "适合在快步、转弯、过渡、初级障碍前建立训练安全边界，尤其适用于骑坐平衡仍在稳定阶段的学员。",
      whyRelevant: "本次报告涉及骑坐中心、下肢承重或动态平衡提示，建议把充气护甲检查纳入训练前固定流程。",
      knowledgePoints: [
        "充气护甲用于增加防护边界，不能替代正确骑坐、教练保护、控马能力和场地安全管理。",
        "训练前应确认气瓶状态、连接绳长度、触发位置、尺码贴合度和穿戴是否影响肩背活动。",
        "当出现脚跟上浮、上体失衡、路线偏移或马匹节奏变化时，应先减速复核骑坐，再继续训练。",
        "公开表达应强调风险意识和训练规范，不能承诺完全避免伤害。"
      ],
      nextStep: "下次训练前可让教练复核护甲穿戴和连接绳位置，并把本次报告中的平衡问题转成训练前检查点。",
      ctaLabel: "查看护甲检查要点",
      channel: "tmall",
      caution: "装备建议需结合学员年龄、训练内容和教练判断。"
    });
  }

  if (/节奏|扶助|转弯|视线|训练重点|教练/.test(allText)) {
    suggestions.push({
      id: "product_training_headset",
      productName: "马术教学耳机",
      category: "训练沟通工具",
      scenario: "适合需要即时修正骑坐、路线、节奏和扶助强度的训练场景。",
      whyRelevant: "报告中的骑坐平衡和安全提示需要在训练中反复提醒，教学耳机可以帮助教练把指令更及时地传达给学员。",
      knowledgePoints: [
        "耳机用于提升训练沟通效率，不替代教练观察和现场保护。",
        "适合节奏控制、转弯路线、视线方向、脚跟承重和手部扶助等需要即时提醒的训练重点。",
        "训练后仍建议上传视频复盘，形成“训练中提醒 + 训练后报告”的闭环。"
      ],
      nextStep: "下次训练可让教练把“保持骑坐中心、脚跟向下、手在身前”等重点转成即时口令。",
      ctaLabel: "了解教学耳机",
      channel: "wechat_group",
      caution: "使用时应遵守俱乐部和教练的训练安排。"
    });
  }

  suggestions.push({
    id: "service_ai_training",
    productName: "SOAI AI 训练报告",
    category: "训练后复盘服务",
    scenario: "适合训练后复盘骑坐平衡、姿态稳定、下肢承重和安全风险提示。",
    whyRelevant: "持续上传同类训练视频，系统才能更稳定地观察骑坐中心、脚跟承重、手部扶助和动态平衡趋势。",
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
