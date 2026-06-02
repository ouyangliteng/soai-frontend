const dataService = require("../../utils/data-service");

Page({
  data: {
    form: {},
    dataMode: "local",
    coaches: [],
    coachNames: [],
    selectedCoachIndex: 0
  },

  async onShow() {
    try {
      dataService.trackEvent("profile_view", { page: "profile" });
      const coaches = dataService.getCoaches();
      const form = (await dataService.getProfile()) || {};
      const selectedCoachIndex = Math.max(0, coaches.findIndex((coach) => coach.id === form.coachId));
      this.setData({
        form,
        dataMode: dataService.getMode(),
        coaches,
        coachNames: coaches.map((coach) => `${coach.name} · ${coach.clubName}`),
        selectedCoachIndex
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

  onCoachPicker(event) {
    const selectedCoachIndex = Number(event.detail.value);
    const coach = this.data.coaches[selectedCoachIndex];
    this.setData({
      selectedCoachIndex,
      "form.coachId": coach.id,
      "form.coachName": coach.name,
      "form.clubName": coach.clubName
    });
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        this.setData({
          "form.avatarUrl": file.tempFilePath
        });
      },
      fail: () => {
        wx.showToast({ title: "未选择头像", icon: "none" });
      }
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
