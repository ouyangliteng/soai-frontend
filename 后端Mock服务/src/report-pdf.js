const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 1800;
const PAGE_MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const ACCENT = "#22f0c8";
const TEXT = "#1f2933";
const MUTED = "#6b7280";
const LINE = "#d9e2ec";

function resolveFontPath() {
  const candidates = [
    process.env.SOAI_REPORT_PDF_FONT,
    path.join(__dirname, "../assets/fonts/SourceHanSansSC-Regular.otf"),
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansSC-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttf",
    "/Users/ouyangliteng/Library/Fonts/Source_Han_Sans_SC_Regular.otf",
    "/Users/ouyangliteng/Library/Fonts/NotoSansSC-VariableFont_wght.ttf",
    "/System/Library/Fonts/Supplemental/NISC18030.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc"
  ].filter(Boolean);
  return candidates.find((filePath) => fs.existsSync(filePath)) || "";
}

function normalizeItems(items) {
  return Array.isArray(items)
    ? items.map((item) => {
      if (typeof item === "string") return item;
      return item.detail || item.title || String(item);
    }).filter(Boolean)
    : [];
}

function getTrainingDate(report) {
  return report.summary?.trainingDate || report.trainingDate || String(report.createdAt || "").slice(0, 10) || "";
}

function getOverallScore(report) {
  return report.summary?.overallScore ?? report.overallScore ?? 0;
}

function getScoreRows(report) {
  const scores = report.scores || {};
  return [
    ["姿态控制", scores.postureControl ?? 0],
    ["节奏控制", scores.rhythmControl ?? 0],
    ["稳定性", scores.stability ?? 0],
    ["辅助精度", scores.aidAccuracy ?? 0],
    ["安全意识", scores.safetyAwareness ?? 0]
  ];
}

function getAngleRows(report) {
  const ruleMeta = {
    ffe_vertical_head_pelvis_heel: ["头髋脚跟", "垂直线"],
    ffe_shoulder_hip_heel_alignment: ["肩髋脚跟", "垂直线"],
    upper_body_stability: ["上身稳定", "肩髋垂直"],
    lower_leg_stability: ["小腿位置", "踝髋对齐"],
    knee_softness: ["膝部柔软", "自然弯曲"],
    heel_down: ["脚跟下沉", "脚跟承重"],
    arm_aid: ["手臂扶助", "前臂水平"],
    hands_in_front: ["手在身前", "轻柔联系"]
  };
  return (report.ruleResults || []).slice(0, 8).map((rule) => {
    const meta = ruleMeta[rule.ruleId] || [rule.metricName || "关键角度", `目标≤${rule.targetValue ?? ""}`];
    return {
      joint: meta[0],
      normal: meta[1],
      angle: Math.round(rule.measuredValue ?? 0),
      score: Math.round(rule.score ?? 0)
    };
  });
}

function drawSectionTitle(doc, title) {
  ensureSpace(doc, 42);
  doc.save()
    .rect(PAGE_MARGIN, doc.y + 4, 5, 20)
    .fill(ACCENT)
    .restore();
  doc.fillColor(TEXT).fontSize(18).text(title, PAGE_MARGIN + 16, doc.y, {
    width: CONTENT_WIDTH - 16
  });
  doc.moveDown(0.7);
}

function drawScoreBar(doc, name, value) {
  const y = doc.y;
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  doc.fillColor(TEXT).fontSize(12).text(name, PAGE_MARGIN, y + 1, { width: 78 });
  doc.save().roundedRect(PAGE_MARGIN + 88, y + 5, 300, 8, 4).fill("#edf2f7").restore();
  doc.save().roundedRect(PAGE_MARGIN + 88, y + 5, safeValue * 3, 8, 4).fill(ACCENT).restore();
  doc.fillColor(TEXT).fontSize(12).text(String(Math.round(safeValue)), PAGE_MARGIN + 408, y, { width: 44, align: "right" });
  doc.y = y + 25;
}

function drawAngleCard(doc, angle, index) {
  const colWidth = (CONTENT_WIDTH - 14) / 2;
  const col = index % 2;
  const x = PAGE_MARGIN + col * (colWidth + 14);
  const rowY = doc._soaiAngleRowY ?? doc.y;
  const y = rowY;
  doc.save().roundedRect(x, y, colWidth, 56, 6).stroke(LINE).restore();
  doc.fillColor(MUTED).fontSize(11).text(angle.joint, x + 14, y + 12, { width: colWidth - 28 });
  doc.fillColor(angle.score < 75 ? "#d97706" : ACCENT).fontSize(22).text(`${angle.angle}°`, x + 14, y + 30, { width: 64 });
  doc.fillColor(MUTED).fontSize(11).text(angle.normal, x + 88, y + 32, { width: colWidth - 102 });
  if (col === 0) {
    doc._soaiAngleRowY = rowY;
  } else {
    delete doc._soaiAngleRowY;
    doc.y = rowY + 70;
  }
}

function drawList(doc, title, items, color = TEXT) {
  if (!items.length) return;
  drawSectionTitle(doc, title);
  doc.fillColor(color).fontSize(12);
  items.forEach((item, index) => {
    ensureSpace(doc, 48);
    doc.text(`${index + 1}. ${item}`, PAGE_MARGIN, doc.y, {
      width: CONTENT_WIDTH,
      lineGap: 4
    });
    doc.moveDown(0.5);
  });
  doc.moveDown(0.4);
}

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > doc.page.height - PAGE_MARGIN) doc.y = doc.page.height - PAGE_MARGIN;
}

function renderLiteReportPdf(report) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      margin: PAGE_MARGIN,
      info: {
        Title: "SOAI-EQ 马术姿态完整报告",
        Author: "SOAI-EQ"
      }
    });
    const fontPath = resolveFontPath();
    if (fontPath) {
      try {
        doc.font(fontPath);
      } catch {
        doc.font("Helvetica");
      }
    }

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fillColor(TEXT).fontSize(25).text("SOAI-EQ 马术姿态完整报告", PAGE_MARGIN, 50, {
      width: CONTENT_WIDTH
    });
    doc.fillColor(MUTED).fontSize(12).text(getTrainingDate(report), PAGE_MARGIN, 86);

    doc.save().roundedRect(PAGE_MARGIN, 112, CONTENT_WIDTH, 102, 8).stroke(LINE).restore();
    doc.fillColor(ACCENT).fontSize(56).text(String(getOverallScore(report)), PAGE_MARGIN + 24, 136, { width: 108 });
    doc.fillColor(TEXT).fontSize(20).text("分", PAGE_MARGIN + 134, 160, { width: 40 });
    doc.fillColor(MUTED).fontSize(12).text(
      `追踪 ${report.poseSummary?.frameCount ?? 0} 帧\n置信度 ${Math.round((report.poseSummary?.averageConfidence ?? 0) * 100)}%`,
      PAGE_MARGIN + 250,
      146,
      { width: 170, lineGap: 8 }
    );

    doc.y = 252;
    drawSectionTitle(doc, "5 维评分");
    getScoreRows(report).forEach(([name, value]) => drawScoreBar(doc, name, value));

    doc.moveDown(0.8);
    drawSectionTitle(doc, "关键角度");
    const angles = getAngleRows(report);
    if (angles.length) {
      angles.forEach((angle, index) => drawAngleCard(doc, angle, index));
      if (angles.length % 2 === 1) doc.y += 70;
    } else {
      doc.fillColor(MUTED).fontSize(12).text("暂无关键角度数据。", PAGE_MARGIN, doc.y);
      doc.moveDown();
    }

    drawList(
      doc,
      "综合评价",
      normalizeItems(report.safetyRidingEvaluation || report.summary?.safetyRidingEvaluation)
    );
    drawList(doc, "安全提醒", normalizeItems(report.riskPoints), "#9a6700");
    drawList(doc, "改进建议", normalizeItems(report.improvements));
    drawList(doc, "主要问题", normalizeItems(report.problemPoints));

    const focus = Array.isArray(report.nextTrainingFocus)
      ? report.nextTrainingFocus.join("；")
      : report.nextTrainingFocus;
    drawList(doc, "下次训练重点", focus ? [focus] : []);
    drawList(doc, "趋势总结", report.trendSummary ? [report.trendSummary] : []);

    ensureSpace(doc, 44);
    doc.fillColor(ACCENT).fontSize(12).text("SOAI-EQ 专业分析平台", PAGE_MARGIN, doc.y);
    doc.fillColor(MUTED).fontSize(10).text("报告结果仅作训练参考，请结合教练现场判断。", PAGE_MARGIN, doc.y + 20);
    doc.end();
  });
}

module.exports = {
  renderLiteReportPdf
};
