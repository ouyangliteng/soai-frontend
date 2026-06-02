const dataService = require("../../utils/data-service");

Page({
  data: {
    outline: null,
    profile: {}
  },

  async onLoad(options) {
    try {
      const profile = (await dataService.getProfile()) || {};
      const outlines = await dataService.getTeachingOutlines(profile.id);
      const outline = outlines.find((item) => item.id === options.id) || outlines[outlines.length - 1] || null;
      this.setData({ profile, outline });
      if (!outline) {
        wx.showToast({ title: "暂无课程安排", icon: "none" });
      }
    } catch (error) {
      wx.showToast({ title: error.message || "训练计划加载失败", icon: "none" });
    }
  },

  exportImage() {
    if (!this.data.outline) return;
    drawOutlineImage(this.data.outline, this.data.profile);
  },

  exportPdf() {
    wx.showModal({
      title: "PDF 导出说明",
      content: "体验版先支持生成分享图片。正式上线建议由云端服务生成 PDF，方便教练统一发送、打印或归档。",
      showCancel: false
    });
  }
});

function drawOutlineImage(outline, profile) {
  const ctx = wx.createCanvasContext("studentPlanCanvas");
  const width = 680;
  ctx.setFillStyle("#ffffff");
  ctx.fillRect(0, 0, width, 980);
  ctx.setFillStyle("#08111f");
  ctx.fillRect(0, 0, width, 150);
  ctx.setFillStyle("#ffffff");
  ctx.setFontSize(28);
  ctx.fillText("SOAI 我的阶段训练计划", 34, 58);
  ctx.setFontSize(20);
  ctx.fillText(`${profile.name || "学员"} · ${outline.title}`, 34, 104);

  ctx.setFillStyle("#111827");
  ctx.setFontSize(24);
  ctx.fillText("阶段目标", 34, 196);
  drawLines(ctx, outline.stageGoal, 34, 232, 610, 24);

  ctx.setFillStyle("#0f67ff");
  ctx.setFontSize(24);
  ctx.fillText("本阶段怎么练", 34, 330);

  let y = 370;
  outline.weeklyPlan.slice(0, 4).forEach((week) => {
    ctx.setFillStyle("#111827");
    ctx.setFontSize(22);
    ctx.fillText(`第 ${week.week} 周 · ${week.theme}`, 34, y);
    y += 36;
    ctx.setFillStyle("#344054");
    ctx.setFontSize(19);
    drawLines(ctx, `我的任务：${week.studentTasks[0]}`, 50, y, 580, 22);
    y += 58;
    drawLines(ctx, `复盘重点：${week.aiReviewFocus.join("、")}`, 50, y, 580, 22);
    y += 66;
  });

  ctx.setFillStyle("#b54708");
  ctx.setFontSize(18);
  drawLines(ctx, "训练安排以教练现场指导为准。AI 报告用于课后复盘和趋势对比。", 34, 900, 610, 22);

  ctx.draw(false, () => {
    wx.canvasToTempFilePath({
      canvasId: "studentPlanCanvas",
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
