Page({
  data: {
    // Chinese messages for UI text
    messages: {
      title: "用户协议",
      continueButton: "我已了解",
      loadingText: "加载中...",
    },
  },

  onLoad: function (options) {
    // Check if user came from specific page
    const { from } = options;
    this.setData({ fromPage: from || 'login' });
  },

  // Handle continue button tap
  onContinue: function () {
    // Navigate back to previous page
    wx.navigateBack();
  },

  // Handle scroll event
  onScroll: function(e) {
    // Track scroll position if needed
  },

  // Handle scroll to bottom
  onScrollToLower: function() {
    // Mark as read when user scrolls to bottom
    this.setData({ hasReadToBottom: true });
  },

  // Handle disagree/cancel button tap (keeping for compatibility)
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