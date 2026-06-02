const dataService = require("../../utils/data-service");

Page({
  data: {
    profileReady: false,
    video: null,
    uploading: false,
    progress: 0,
    analysisConsent: false,
    caseConsent: false
  },

  async onShow() {
    try {
      const profile = await dataService.getProfile();
      const profileReady = Boolean(profile && profile.name && profile.ridingYears && profile.currentLevel);
      this.setData({
        profileReady
      });
    } catch (error) {
      wx.showToast({ title: error.message || "资料检查失败", icon: "none" });
    }
  },

  chooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      sourceType: ["album", "camera"],
      maxDuration: 60,
      success: (res) => {
        const file = res.tempFiles[0];
        const video = {
          name: "training-video.mp4",
          path: file.tempFilePath,
          sizeMb: Number((file.size / 1024 / 1024).toFixed(1)),
          durationSec: Math.round(file.duration || 60),
          format: "mp4"
        };
        const error = this.validateVideo(video);
        if (error) {
          dataService.trackEvent("video_validate_failed", {
            page: "upload",
            properties: {
              reason: error,
              sizeMb: video.sizeMb,
              durationSec: video.durationSec
            }
          });
          wx.showToast({ title: error, icon: "none" });
          return;
        }
        this.setData({ video });
        dataService.trackEvent("video_select", {
          page: "upload",
          properties: {
            sizeMb: video.sizeMb,
            durationSec: video.durationSec,
            format: video.format
          }
        });
      }
    });
  },

  validateVideo(video) {
    if (video.sizeMb > 150) return "视频过大，请选择 150 MB 以内片段";
    if (video.durationSec < 10) return "视频过短，请至少上传 10 秒";
    if (video.durationSec > 60) return "视频过长，请截取 60 秒以内";
    return "";
  },

  toggleAnalysisConsent() {
    this.setData({
      analysisConsent: !this.data.analysisConsent
    });
  },

  toggleCaseConsent() {
    this.setData({
      caseConsent: !this.data.caseConsent
    });
  },

  startUpload() {
    if (!this.data.profileReady) {
      wx.showToast({ title: "请先补全学员资料", icon: "none" });
      return;
    }
    if (!this.data.video) {
      wx.showToast({ title: "请先选择视频", icon: "none" });
      return;
    }
    if (!this.data.analysisConsent) {
      wx.showToast({ title: "请先确认视频用于本次训练分析", icon: "none" });
      return;
    }

    this.setData({ uploading: true, progress: 0 });
    dataService.trackEvent("video_upload_start", {
      page: "upload",
      properties: {
        sizeMb: this.data.video.sizeMb,
        durationSec: this.data.video.durationSec,
        analysisConsent: this.data.analysisConsent,
        caseConsent: this.data.caseConsent
      }
    });
    this.tickUpload();
  },

  tickUpload() {
    const next = Math.min(100, this.data.progress + 20);
    this.setData({ progress: next });

    if (next < 100) {
      setTimeout(() => this.tickUpload(), 260);
      return;
    }

    dataService.createUploadAndAnalysisTask({
      ...this.data.video,
      analysisConsent: this.data.analysisConsent,
      caseConsent: this.data.caseConsent
    })
      .then((task) => {
        dataService.trackEvent("video_upload_success", {
          page: "upload",
          taskId: task.id,
          properties: {
            progress: 100
          }
        });
        dataService.trackEvent("analysis_task_created", {
          page: "upload",
          taskId: task.id
        });
        wx.navigateTo({ url: "/pages/analysis/analysis" });
      })
      .catch((error) => {
        this.setData({ uploading: false });
        dataService.trackEvent("video_upload_failed", {
          page: "upload",
          properties: {
            message: error.message || "创建分析任务失败"
          }
        });
        wx.showToast({ title: error.message || "创建分析任务失败", icon: "none" });
      });
  },

  goProfile() {
    wx.switchTab({ url: "/pages/profile/profile" });
  },

  goPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/privacy" });
  }
});
