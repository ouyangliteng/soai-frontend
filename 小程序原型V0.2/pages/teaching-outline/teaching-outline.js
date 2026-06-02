const dataService = require("../../utils/data-service");

Page({
  data: {
    reportId: "",
    report: null,
    coachObservation: "",
    stageGoal: "",
    constraints: "",
    weeks: 4,
    outline: null,
    loading: false
  },

  async onLoad(options) {
    const reportId = options.reportId || options.id || "";
    if (!reportId) {
      wx.showToast({ title: "缺少报告 ID", icon: "none" });
      return;
    }

    try {
      const report = await dataService.getReport(reportId);
      const defaultGoal = `未来 4 周提升${report.nextTrainingFocus.slice(0, 2).join("、")}。`;
      this.setData({
        reportId,
        report,
        stageGoal: defaultGoal,
        constraints: "每周 2 次训练，优先安全和基础稳定，每次只抓 1 到 2 个重点。"
      });
    } catch (error) {
      wx.showToast({ title: error.message || "报告加载失败", icon: "none" });
    }
  },

  onCoachObservation(event) {
    this.setData({ coachObservation: event.detail.value });
  },

  onStageGoal(event) {
    this.setData({ stageGoal: event.detail.value });
  },

  onConstraints(event) {
    this.setData({ constraints: event.detail.value });
  },

  onWeeks(event) {
    this.setData({ weeks: Number(event.detail.value) });
  },

  async generateOutline() {
    const { reportId, coachObservation, stageGoal, constraints, weeks } = this.data;
    if (!coachObservation.trim()) {
      wx.showToast({ title: "请先填写教练对学员的认知", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    try {
      const outline = await dataService.generateTeachingOutline(reportId, {
        coachObservation,
        stageGoal,
        constraints,
        weeks
      });
      dataService.trackEvent("teaching_outline_generate", {
        page: "teaching-outline",
        reportId,
        properties: {
          weeks,
          hasCoachObservation: true
        }
      });
      this.setData({ outline, loading: false });
      wx.showToast({ title: "已生成大纲", icon: "success" });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: error.message || "生成失败", icon: "none" });
    }
  },

  exportImage() {
    if (!this.data.outline) return;
    drawOutlineImage(this.data.outline, this.data.report);
  },

  exportPdf() {
    wx.showModal({
      title: "PDF 导出说明",
      content: "体验版先支持生成分享图片。正式上线建议由云端服务生成 PDF，保证中文排版、品牌页眉和多页课程安排稳定。",
      showCancel: false
    });
  }
});

function drawOutlineImage(outline, report) {
  const ctx = wx.createCanvasContext("outlineCanvas");
  const width = 680;
  ctx.setFillStyle("#ffffff");
  ctx.fillRect(0, 0, width, 980);
  ctx.setFillStyle("#08111f");
  ctx.fillRect(0, 0, width, 150);
  ctx.setFillStyle("#ffffff");
  ctx.setFontSize(28);
  ctx.fillText("SOAI 阶段教学任务大纲", 34, 58);
  ctx.setFontSize(20);
  ctx.fillText(`${report.studentSnapshot.name} · ${outline.title}`, 34, 104);

  ctx.setFillStyle("#111827");
  ctx.setFontSize(24);
  ctx.fillText("阶段目标", 34, 196);
  drawLines(ctx, outline.stageGoal, 34, 232, 610, 24);

  ctx.setFillStyle("#0f67ff");
  ctx.setFontSize(24);
  ctx.fillText("按周任务", 34, 330);

  let y = 370;
  outline.weeklyPlan.slice(0, 4).forEach((week) => {
    ctx.setFillStyle("#111827");
    ctx.setFontSize(22);
    ctx.fillText(`第 ${week.week} 周 · ${week.theme}`, 34, y);
    y += 36;
    ctx.setFillStyle("#344054");
    ctx.setFontSize(19);
    drawLines(ctx, `教练：${week.coachTasks[0]}`, 50, y, 580, 22);
    y += 58;
    drawLines(ctx, `学员：${week.studentTasks[0]}`, 50, y, 580, 22);
    y += 66;
  });

  ctx.setFillStyle("#b54708");
  ctx.setFontSize(18);
  drawLines(ctx, "AI 只生成教学辅助大纲，必须由教练结合现场情况确认后执行。", 34, 900, 610, 22);

  ctx.draw(false, () => {
    wx.canvasToTempFilePath({
      canvasId: "outlineCanvas",
      width,
      height: 980,
      destWidth: width * 2,
      destHeight: 1960,
      success: (res) => {
        wx.previewImage({
          urls: [res.tempFilePath],
          current: res.tempFilePath
        });
      },
      fail: () => {
        wx.showToast({ title: "图片生成失败", icon: "none" });
      }
    });
  });
}

function drawLines(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = String(text || "").split("");
  let line = "";
  chars.forEach((char) => {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else {
      line = testLine;
    }
  });
  if (line) ctx.fillText(line, x, y);
}
