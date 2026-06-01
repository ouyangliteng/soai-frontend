const store = require("./utils/store");

App({
  onLaunch() {
    store.ensureSeedData();
  },
  globalData: {
    productName: "SOAI 马术 AI 训练"
  }
});

