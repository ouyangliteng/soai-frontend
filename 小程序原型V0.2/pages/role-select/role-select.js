const dataService = require("../../utils/data-service");

Page({
  data: {
    currentRole: "",
    coaches: [],
    coachNames: [],
    selectedCoachIndex: 0,
    studentForm: {
      wxOpenId: "mock_wx_student_demo",
      name: "王小涵",
      currentLevel: "初级进阶"
    },
    coachForm: {
      wxOpenId: "mock_wx_coach_demo",
      name: "李教练",
      loginType: "coach_wechat"
    }
  },

  onShow() {
    const session = dataService.getCurrentSession();
    const coaches = dataService.getCoaches();
    this.setData({
      currentRole: session.role || "",
      coaches,
      coachNames: coaches.map((coach) => `${coach.name} · ${coach.clubName}`)
    });
  },

  onStudentInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`studentForm.${field}`]: event.detail.value
    });
  },

  onCoachInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`coachForm.${field}`]: event.detail.value
    });
  },

  onCoachPicker(event) {
    this.setData({
      selectedCoachIndex: Number(event.detail.value)
    });
  },

  setCoachLoginType(event) {
    const loginType = event.currentTarget.dataset.type;
    const wxOpenId = loginType === "company_wechat" ? "mock_wx_company_soai" : "mock_wx_coach_demo";
    const name = loginType === "company_wechat" ? "SOAI 公司教练号" : this.data.coachForm.name;
    this.setData({
      "coachForm.loginType": loginType,
      "coachForm.wxOpenId": wxOpenId,
      "coachForm.name": name
    });
  },

  async loginStudent() {
    const coach = this.data.coaches[this.data.selectedCoachIndex] || this.data.coaches[0];
    if (!this.data.studentForm.name) {
      wx.showToast({ title: "请填写学员姓名", icon: "none" });
      return;
    }
    await dataService.loginAsStudent({
      ...this.data.studentForm,
      coachId: coach && coach.id,
      clubName: coach && coach.clubName
    });
    wx.switchTab({ url: "/pages/home/home" });
  },

  async loginCoach() {
    if (!this.data.coachForm.name) {
      wx.showToast({ title: "请填写教练或公司账号名称", icon: "none" });
      return;
    }
    await dataService.loginAsCoach(this.data.coachForm);
    wx.switchTab({ url: "/pages/coach/coach" });
  }
});
