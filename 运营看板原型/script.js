const API_URL = "http://127.0.0.1:8787/api/operations/dashboard";
const DAILY_REPORT_URL = "http://127.0.0.1:8787/api/operations/daily-report";
let currentDailyReport = null;

const fallbackData = {
  generatedAt: new Date().toISOString(),
  phase: "V0.2 内测 / V0.3 教练端准备",
  kpis: [
    { label: "新增报名", value: 18, unit: "人", target: 20, status: "good" },
    { label: "视频上传成功率", value: 92, unit: "%", target: 90, status: "good" },
    { label: "AI分析成功率", value: 88, unit: "%", target: 85, status: "good" },
    { label: "报告打开率", value: 96, unit: "%", target: 95, status: "good" },
    { label: "教练复核率", value: 50, unit: "%", target: 60, status: "watch" },
    { label: "二次上传人数", value: 7, unit: "人", target: 6, status: "good" }
  ],
  funnel: [
    { label: "内容曝光", value: 12800 },
    { label: "微信群", value: 420 },
    { label: "内测申请", value: 86 },
    { label: "视频上传", value: 24 },
    { label: "报告查看", value: 23 },
    { label: "教练复核", value: 12 },
    { label: "二次上传", value: 7 },
    { label: "产品咨询", value: 5 }
  ],
  channels: [
    { name: "小红书", role: "种草与训练复盘", exposure: 6200, leads: 36, nextAction: "发布 AI 报告案例", status: "active" },
    { name: "抖音", role: "短视频传播", exposure: 4800, leads: 22, nextAction: "剪 30 秒报告生成过程", status: "active" },
    { name: "微信视频号", role: "私域信任", exposure: 1800, leads: 18, nextAction: "教练讲解复核逻辑", status: "active" },
    { name: "微信群", role: "内测承接", exposure: 420, leads: 28, nextAction: "提醒二次上传", status: "watch" },
    { name: "天猫旗舰店", role: "硬件销售承接", exposure: 260, leads: 5, nextAction: "补充护甲风险意识内容", status: "watch" }
  ],
  contentQueue: [
    { channel: "小红书", title: "上传一段马术训练视频，AI 报告能看出什么？", status: "待审核", owner: "内容运营", boundary: "需确认案例授权" },
    { channel: "抖音", title: "30 秒看懂 AI 马术训练报告", status: "脚本完成", owner: "短视频运营", boundary: "避免夸大 AI 准确性" },
    { channel: "微信群", title: "二次上传提醒与报告反馈收集", status: "今日发送", owner: "社群运营", boundary: "提醒 AI 仅作教学辅助" }
  ],
  feedbackSummary: {
    count: 8,
    averageRating: 4.5,
    averageAccuracy: 4.2,
    averageUsefulness: 4.6,
    tagCounts: {
      "建议可执行": 4,
      "问题准确": 3,
      "视频角度不足": 2,
      "想继续上传": 2,
      "想咨询装备": 1
    },
    latest: [
      {
        role: "coach",
        rating: 5,
        comment: "问题点有参考价值，建议继续补充视频角度说明。",
        tags: ["问题准确", "视频角度不足"]
      },
      {
        role: "student",
        rating: 4,
        comment: "能看懂下次重点，希望训练建议再具体一点。",
        tags: ["建议具体", "想继续上传"]
      }
    ]
  },
  risks: [
    { level: "medium", title: "AI 表达风险", detail: "所有公开内容需避免“替代教练”“绝对准确”等表述。", owner: "内容运营" },
    { level: "high", title: "视频授权", detail: "训练视频用于案例发布前必须获得学员或家长授权。", owner: "运营负责人" },
    { level: "medium", title: "上传失败", detail: "上传失败用户需要私域跟进，避免首轮内测流失。", owner: "产品/客服" }
  ],
  dailySeries: [
    { date: "05-26", uploads: 2, reports: 2, reviews: 1 },
    { date: "05-27", uploads: 3, reports: 3, reviews: 2 },
    { date: "05-28", uploads: 4, reports: 4, reviews: 3 },
    { date: "05-29", uploads: 3, reports: 3, reviews: 2 },
    { date: "05-30", uploads: 5, reports: 5, reviews: 3 },
    { date: "05-31", uploads: 4, reports: 4, reviews: 4 },
    { date: "06-01", uploads: 3, reports: 3, reviews: 2 }
  ],
  dailyReport: {
    date: new Date().toISOString().slice(0, 10),
    phase: "V0.2 内测 / V0.3 教练端准备",
    conclusion: "主链路可继续内测，需关注教练复核率和二次上传提醒。",
    goStatus: "conditional_go",
    metrics: {
      newSignups: 18,
      uploadSuccessRate: 92,
      analysisSuccessRate: 88,
      reportOpenRate: 96,
      coachReviewRate: 50,
      secondUploadCount: 7,
      feedbackCount: 8,
      averageUsefulness: 4.6
    },
    reviewQuestions: [
      { question: "今天有没有用户卡在上传前？", answer: "未见明显集中卡点" },
      { question: "今天有没有视频上传失败后无法恢复？", answer: "失败风险可控" },
      { question: "今天 AI 报告是否明显不相关？", answer: "教练反馈整体可参考" },
      { question: "今天教练是否认可报告主要问题点？", answer: "需要提醒教练完成待复核报告" },
      { question: "今天学员是否能理解下次训练重点？", answer: "训练价值反馈较好" },
      { question: "今天是否有人完成第二次上传？", answer: "已有二次上传信号" }
    ],
    topFeedbackTags: [
      { tag: "建议可执行", count: 4 },
      { tag: "问题准确", count: 3 },
      { tag: "视频角度不足", count: 2 }
    ],
    risks: [
      { title: "视频授权", detail: "训练视频用于案例发布前必须获得学员或家长授权。", level: "high" }
    ],
    nextActions: [
      "运营提醒教练完成待复核报告，优先处理含风险点报告。",
      "微信群发布二次上传提醒，强调趋势需要至少 2 次训练数据。",
      "发布前逐条确认高风险项，尤其是视频授权和公开案例边界。"
    ]
  }
};

document.getElementById("refreshBtn").addEventListener("click", loadDashboard);
document.getElementById("copyDailyReport").addEventListener("click", copyDailyReport);
loadDashboard();

async function loadDashboard() {
  const source = document.getElementById("dataSource");
  source.textContent = "连接中";
  try {
    const [dashboardRes, dailyReportRes] = await Promise.all([
      fetch(API_URL),
      fetch(DAILY_REPORT_URL)
    ]);
    if (!dashboardRes.ok || !dailyReportRes.ok) throw new Error("API unavailable");
    const data = await dashboardRes.json();
    data.dailyReport = await dailyReportRes.json();
    source.textContent = "Mock API";
    render(data);
  } catch (error) {
    source.textContent = "本地兜底数据";
    render(fallbackData);
  }
}

function render(data) {
  renderKpis(data.kpis);
  renderDailyReport(data.dailyReport);
  renderFunnel(data.funnel);
  renderDailySeries(data.dailySeries);
  renderChannels(data.channels);
  renderFeedbackSummary(data.feedbackSummary);
  renderContentQueue(data.contentQueue);
  renderRisks(data.risks);
}

function renderDailyReport(report = fallbackData.dailyReport) {
  currentDailyReport = report;
  const metrics = report.metrics || {};
  document.getElementById("dailyReport").innerHTML = `
    <div class="daily-summary">
      <span class="status-pill ${report.goStatus === "go" ? "" : "watch"}">${report.goStatus === "go" ? "Go" : "Conditional Go"}</span>
      <strong>${report.conclusion}</strong>
      <small>${report.date} · ${report.phase}</small>
    </div>
    <div class="daily-layout">
      <article>
        <h3>核心指标</h3>
        <div class="metric-list">
          ${renderMetric("新增报名", metrics.newSignups, "人")}
          ${renderMetric("上传成功率", metrics.uploadSuccessRate, "%")}
          ${renderMetric("AI 分析成功率", metrics.analysisSuccessRate, "%")}
          ${renderMetric("报告打开率", metrics.reportOpenRate, "%")}
          ${renderMetric("教练复核率", metrics.coachReviewRate, "%")}
          ${renderMetric("二次上传", metrics.secondUploadCount, "人")}
          ${renderMetric("反馈数量", metrics.feedbackCount, "条")}
          ${renderMetric("训练价值", formatScore(metrics.averageUsefulness), "/ 5")}
        </div>
      </article>
      <article>
        <h3>每日 6 问</h3>
        <div class="qa-list">
          ${(report.reviewQuestions || []).map((item) => `<p><b>${item.question}</b><span>${item.answer}</span></p>`).join("")}
        </div>
      </article>
      <article>
        <h3>明日动作</h3>
        <ol class="action-list">
          ${(report.nextActions || []).map((item) => `<li>${item}</li>`).join("")}
        </ol>
      </article>
    </div>
  `;
}

function renderMetric(label, value, unit) {
  return `<p><span>${label}</span><b>${value || 0}${unit}</b></p>`;
}

function renderKpis(kpis) {
  document.getElementById("overview").innerHTML = kpis
    .map(
      (item) => `
        <article class="kpi-card">
          <div class="kpi-label">${item.label}</div>
          <div class="kpi-value">${item.value}<small>${item.unit}</small></div>
          <div class="kpi-target">目标 ${item.target}${item.unit}</div>
          <span class="kpi-status ${item.status === "watch" ? "watch" : ""}">${item.status === "watch" ? "需关注" : "达标"}</span>
        </article>
      `
    )
    .join("");
}

function renderFunnel(funnel) {
  const max = Math.max(...funnel.map((item) => item.value));
  document.getElementById("funnelChart").innerHTML = funnel
    .map(
      (item) => `
        <div class="funnel-row">
          <span class="funnel-label">${item.label}</span>
          <span class="funnel-track"><i class="funnel-bar" style="width:${Math.max(5, (item.value / max) * 100)}%"></i></span>
          <span class="funnel-value">${formatNumber(item.value)}</span>
        </div>
      `
    )
    .join("");
}

function renderDailySeries(items) {
  const max = Math.max(...items.flatMap((item) => [item.uploads, item.reports, item.reviews]));
  document.getElementById("dailySeries").innerHTML = items
    .map(
      (item) => `
        <div class="bar-group">
          <div class="bar-stack">
            <i title="上传" style="height:${height(item.uploads, max)}%"></i>
            <i title="报告" style="height:${height(item.reports, max)}%"></i>
            <i title="复核" style="height:${height(item.reviews, max)}%"></i>
          </div>
          <span class="bar-date">${item.date}</span>
        </div>
      `
    )
    .join("");
}

function renderChannels(channels) {
  document.getElementById("channelRows").innerHTML = channels
    .map(
      (item) => `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td>${item.role}</td>
          <td>${formatNumber(item.exposure)}</td>
          <td>${item.leads}</td>
          <td>${item.nextAction}</td>
          <td><span class="status-pill ${item.status === "watch" ? "watch" : ""}">${item.status === "watch" ? "跟进" : "正常"}</span></td>
        </tr>
      `
    )
    .join("");
}

function renderContentQueue(items) {
  document.getElementById("contentQueue").innerHTML = items
    .map(
      (item) => `
        <article class="queue-card">
          <header><b>${item.channel}</b><span class="status-pill ${item.status.includes("待") ? "watch" : ""}">${item.status}</span></header>
          <p>${item.title}</p>
          <p>负责人：${item.owner} · 边界：${item.boundary}</p>
        </article>
      `
    )
    .join("");
}

function renderFeedbackSummary(summary = {}) {
  const tags = Object.entries(summary.tagCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const latest = summary.latest || [];

  document.getElementById("feedbackSummary").innerHTML = `
    <div class="feedback-scoreboard">
      <article>
        <span>反馈数量</span>
        <strong>${summary.count || 0}</strong>
        <small>条</small>
      </article>
      <article>
        <span>总体评分</span>
        <strong>${formatScore(summary.averageRating)}</strong>
        <small>/ 5</small>
      </article>
      <article>
        <span>准确性</span>
        <strong>${formatScore(summary.averageAccuracy)}</strong>
        <small>/ 5</small>
      </article>
      <article>
        <span>训练价值</span>
        <strong>${formatScore(summary.averageUsefulness)}</strong>
        <small>/ 5</small>
      </article>
    </div>
    <div class="feedback-detail">
      <div>
        <h3>高频标签</h3>
        <div class="tag-cloud">
          ${tags.map(([tag, count]) => `<span>${tag}<b>${count}</b></span>`).join("") || "<p>暂无标签</p>"}
        </div>
      </div>
      <div>
        <h3>最近反馈</h3>
        <div class="feedback-list">
          ${latest.map(renderFeedbackItem).join("") || "<p>暂无反馈</p>"}
        </div>
      </div>
    </div>
  `;
}

function renderFeedbackItem(item) {
  const role = item.role === "coach" ? "教练" : "学员";
  const tags = (item.tags || []).slice(0, 3).join(" / ");
  return `
    <article class="feedback-item">
      <header><b>${role}</b><span>${item.rating || "-"} 分</span></header>
      <p>${item.comment || "未填写文字反馈"}</p>
      <small>${tags || "未选择标签"}</small>
    </article>
  `;
}

function copyDailyReport() {
  const report = currentDailyReport || fallbackData.dailyReport;
  const text = buildDailyReportText(report);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showCopiedState).catch(() => fallbackCopy(text));
    return;
  }
  fallbackCopy(text);
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (copied) {
    showCopiedState();
    return;
  }
  showManualCopy(text);
}

function showCopiedState() {
  document.getElementById("copyDailyReport").textContent = "已复制";
  setTimeout(() => {
    document.getElementById("copyDailyReport").textContent = "复制日报";
  }, 1200);
}

function showManualCopy(text) {
  let manual = document.getElementById("manualDailyReportCopy");
  if (!manual) {
    manual = document.createElement("textarea");
    manual.id = "manualDailyReportCopy";
    manual.className = "manual-copy";
    manual.setAttribute("readonly", "");
    document.getElementById("dailyReport").appendChild(manual);
  }
  manual.value = text;
  manual.focus();
  manual.select();
  document.getElementById("copyDailyReport").textContent = "手动复制";
}

function buildDailyReportText(report) {
  const metrics = report.metrics || {};
  return [
    "SOAI V0.2 内测日报",
    `日期：${report.date}`,
    `阶段：${report.phase}`,
    "",
    "一、今日结论",
    report.conclusion,
    "",
    "二、核心指标",
    `- 新增报名：${metrics.newSignups} 人`,
    `- 上传成功率：${metrics.uploadSuccessRate}%`,
    `- AI 分析成功率：${metrics.analysisSuccessRate}%`,
    `- 报告打开率：${metrics.reportOpenRate}%`,
    `- 教练复核率：${metrics.coachReviewRate}%`,
    `- 二次上传人数：${metrics.secondUploadCount} 人`,
    `- 反馈数量：${metrics.feedbackCount} 条`,
    `- 训练价值评分：${formatScore(metrics.averageUsefulness)} / 5`,
    "",
    "三、每日 6 问",
    ...(report.reviewQuestions || []).map((item, index) => `${index + 1}. ${item.question} ${item.answer}`),
    "",
    "四、高频反馈",
    ...((report.topFeedbackTags || []).map((item) => `- ${item.tag}：${item.count} 次`)),
    "",
    "五、风险提醒",
    ...((report.risks || []).map((item) => `- ${item.title}：${item.detail}`)),
    "",
    "六、明日动作",
    ...((report.nextActions || []).map((item, index) => `${index + 1}. ${item}`))
  ].join("\n");
}

function renderRisks(items) {
  document.getElementById("riskList").innerHTML = items
    .map(
      (item) => `
        <article class="risk-card ${item.level === "high" ? "high" : ""}">
          <header><b>${item.title}</b><span class="status-pill ${item.level === "high" ? "" : "watch"}">${item.level === "high" ? "高" : "中"}</span></header>
          <p>${item.detail}</p>
          <p>负责人：${item.owner}</p>
        </article>
      `
    )
    .join("");
}

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN");
}

function formatScore(value) {
  const number = Number(value || 0);
  return number ? number.toFixed(1) : "0.0";
}

function height(value, max) {
  return Math.max(10, Math.round((value / max) * 100));
}
