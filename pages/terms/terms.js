Page({
  data: {
    agreed: false,
    showTerms: true,
    // Chinese messages for UI text
    messages: {
      title: "学校秀用户服务协议",
      agreeText: "我已阅读并同意《用户服务协议》",
      continueButton: "同意并继续",
      disagreeCancelButton: "不同意",
      mustAgreeError: "请先阅读并同意用户服务协议",
      loadingText: "加载中...",
    },
  },

  onLoad: function (options) {
    // Check if user came from specific page
    const { from } = options;
    this.setData({ fromPage: from || 'login' });
  },

  // Handle agreement checkbox change
  onAgreeChange: function (e) {
    this.setData({
      agreed: e.detail.value.length > 0,
    });
  },

  // Handle continue button tap
  onContinue: function () {
    if (!this.data.agreed) {
      wx.showToast({
        title: this.data.messages.mustAgreeError,
        icon: "none",
        duration: 2000,
      });
      return;
    }

    // Navigate to register page with from parameter if applicable
    const fromParam = this.data.fromPage ? `?from=${this.data.fromPage}` : '';
    wx.navigateTo({
      url: `/pages/register/register${fromParam}`
    });
  },

  // Handle disagree/cancel button tap
  onCancel: function () {
    wx.showModal({
      title: "提示",
      content: "不同意用户服务协议将无法使用学校秀服务",
      confirmText: "重新阅读",
      cancelText: "返回",
      success: (res) => {
        if (res.cancel) {
          // Go back to previous page
          wx.navigateBack({
            fail: () => {
              // If can't go back, go to index page
              wx.redirectTo({
                url: '/pages/index/index'
              });
            }
          });
        }
        // If confirm, stay on this page to re-read
      },
    });
  },

  // Scroll to bottom to enable continue button
  onScrollToLower: function () {
    // Optional: Enable continue button only after scrolling to bottom
    // this.setData({ hasScrolledToBottom: true });
  },

  // Handle scroll
  onScroll: function (e) {
    // Optional: Track scroll progress
    // console.log('Scroll progress:', e.detail.scrollTop);
  },
});