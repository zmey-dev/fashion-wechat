const { default: config } = require("../config");

const STORAGE_KEY = "wx_subscription_asked";

const requestSubscription = () => {
  const tmplId = config.WECHAT_SUBSCRIPTION_TEMPLATE_ID;
  if (!tmplId) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success(res) {
        try {
          wx.setStorageSync(STORAGE_KEY, Date.now());
        } catch (e) {}
        resolve(res);
      },
      fail() {
        resolve(null);
      },
    });
  });
};

const hasAskedRecently = (daysThreshold = 7) => {
  try {
    const last = wx.getStorageSync(STORAGE_KEY);
    if (!last) return false;
    return Date.now() - Number(last) < daysThreshold * 86400000;
  } catch (e) {
    return false;
  }
};

module.exports = {
  requestSubscription,
  hasAskedRecently,
};
