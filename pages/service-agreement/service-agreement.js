Page({
  data: {
    // Chinese messages for UI text
    messages: {
      title: "用户服务协议",
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
  }
});