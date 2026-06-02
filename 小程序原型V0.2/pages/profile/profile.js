const dataService = require("../../utils/data-service");

Page({
  data: {
    role: "student",
    coach: {},
    coachForm: {},
    form: {},
    dataMode: "local",
    coaches: [],
    coachNames: [],
    selectedCoachIndex: 0
  },

  async onShow() {
    try {
      dataService.trackEvent("profile_view", { page: "profile" });
      const session = dataService.getCurrentSession();
      if (session.role === "coach") {
        const coach = dataService.getCurrentCoach();
        this.setData({
          role: "coach",
          coach,
          coachForm: { ...coach },
          dataMode: dataService.getMode()
        });
        return;
      }
      const coaches = dataService.getCoaches();
      const form = (await dataService.getProfile()) || {};
      const selectedCoachIndex = Math.max(0, coaches.findIndex((coach) => coach.id === form.coachId));
      this.setData({
        role: "student",
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

  onCoachInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`coachForm.${field}`]: event.detail.value
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

  async saveCoach() {
    const { coachForm } = this.data;
    if (!coachForm.clubName) {
      wx.showToast({ title: "请填写所属俱乐部", icon: "none" });
      return;
    }

    try {
      const coach = await dataService.saveCoachProfile(coachForm);
      this.setData({
        coach,
        coachForm: { ...coach }
      });
      dataService.trackEvent("coach_profile_save_success", {
        page: "profile",
        properties: {
          hasClub: Boolean(coach.clubName)
        }
      });
      wx.showToast({ title: "已保存", icon: "success" });
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
