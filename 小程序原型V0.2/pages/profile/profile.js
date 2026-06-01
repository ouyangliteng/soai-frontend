const dataService = require("../../utils/data-service");

Page({
  data: {
    form: {},
    dataMode: "local"
  },

  async onShow() {
    try {
      dataService.trackEvent("profile_view", { page: "profile" });
      this.setData({
        form: (await dataService.getProfile()) || {},
        dataMode: dataService.getMode()
      });
    } catch (error) {
      wx.showToast({ title: error.message || "资料加载失败", icon: "none" });
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  async save() {
    const { form } = this.data;
    const missing = ["name", "ridingYears", "currentLevel"].filter((field) => !form[field]);

    if (missing.length) {
      wx.showToast({
        title: "请补全重点字段",
        icon: "none"
      });
      return;
    }

    try {
      await dataService.saveProfile(form);
      dataService.trackEvent("profile_save_success", {
        page: "profile",
        properties: {
          hasCoach: Boolean(form.coachName),
          hasClub: Boolean(form.clubName)
        }
      });
      wx.showToast({
        title: "已保存",
        icon: "success"
      });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    }
  },

  switchDataMode(event) {
    const mode = event.currentTarget.dataset.mode;
    dataService.setMode(mode);
    this.setData({ dataMode: dataService.getMode() });
    wx.showToast({
      title: mode === "api" ? "已切到 API" : "已切到本地",
      icon: "none"
    });
  }
});
