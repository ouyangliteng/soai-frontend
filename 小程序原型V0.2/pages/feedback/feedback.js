const dataService = require("../../utils/data-service");

const studentTags = ["上传慢", "报告看不懂", "建议具体", "想继续上传", "想咨询装备"];
const coachTags = ["问题准确", "建议可执行", "风险表达谨慎", "明显错误", "视频角度不足"];

function buildTags(labels) {
  return labels.map((label) => ({ label, selected: false }));
}

Page({
  data: {
    ratings: [1, 2, 3, 4, 5],
    reportId: "",
    submitting: false,
    availableTags: buildTags(studentTags),
    form: {
      role: "student",
      rating: 5,
      accuracyRating: 4,
      usefulnessRating: 5,
      uploadExperienceRating: 5,
      comment: "",
      contact: ""
    }
  },

  onLoad(options) {
    this.setData({
      reportId: options.reportId || ""
    });
  },

  selectRole(event) {
    const role = event.currentTarget.dataset.role;
    this.setData({
      "form.role": role,
      availableTags: buildTags(role === "coach" ? coachTags : studentTags)
    });
  },

  selectRating(event) {
    const field = event.currentTarget.dataset.field;
    const value = Number(event.currentTarget.dataset.value);
    this.setData({
      [`form.${field}`]: value
    });
  },

  toggleTag(event) {
    const index = Number(event.currentTarget.dataset.index);
    const tags = this.data.availableTags.map((tag, currentIndex) => (
      currentIndex === index ? { ...tag, selected: !tag.selected } : tag
    ));
    this.setData({
      availableTags: tags
    });
  },

  onComment(event) {
    this.setData({
      "form.comment": event.detail.value
    });
  },

  onContact(event) {
    this.setData({
      "form.contact": event.detail.value
    });
  },

  async submit() {
    const { form, availableTags, reportId } = this.data;
    const tags = availableTags.filter((tag) => tag.selected).map((tag) => tag.label);

    if (!form.comment && tags.length === 0) {
      wx.showToast({ title: "请选择标签或填写说明", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    const res = await dataService.submitFeedback({
      ...form,
      reportId,
      tags
    });
    this.setData({ submitting: false });

    if (!res.success) {
      wx.showToast({ title: "提交失败，请稍后重试", icon: "none" });
      return;
    }

    wx.showToast({ title: "已收到反馈", icon: "success" });
    setTimeout(() => wx.navigateBack(), 700);
  }
});
