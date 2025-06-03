const app = getApp();
const { default: config } = require("../../config");

Page({
  data: {
    posts: [],
    loading: false,
    currentPage: 1,
    hasMore: true,
    pageSize: 15,
    userInfo: null,
    showLoginModal: false,
    showScrollTop: false,
    existPostIds: [],
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载失败，请稍后重试",
        networkError: "网络错误，请检查网络连接"
      },
      time: {
        justNow: "刚刚",
        minutesAgo: "分钟前",
        hoursAgo: "小时前",
        daysAgo: "天前"
      }
    }
  },

  onLoad: function (options) {
    // Set user info
    this.setData({
      userInfo: app.globalData.userInfo
    });

    // Setup subscriptions
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    app.subscribe("userInfo", this.userInfoHandler);

    this.loginModalHandler = (showLoginModal) => {
      this.setData({ showLoginModal });
    };
    app.subscribe("showLoginModal", this.loginModalHandler);

    // Initial post loading
    this.initializePage();
  },

  onUnload: function () {
    // Unsubscribe from events
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.loginModalHandler);
  },

  onShow: function () {
    // Refresh posts if needed
    if (app.globalData.refreshPosts) {
      this.handleRefresh();
      app.globalData.refreshPosts = false;
    }
  },

  initializePage: function () {
    this.handleRefresh();
  },

  loadPosts: function (refresh = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    const requestData = {
      scope: this.data.pageSize,
      isDiscover: true
    };

    // Add exist_post_ids for pagination (not refresh)
    if (!refresh && this.data.posts.length > 0) {
      requestData.exist_post_ids = this.data.existPostIds;
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts_discover`,
      method: 'GET',
      data: requestData,
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === 'success') {
          const newPosts = res.data.posts || [];
          
          // Format timestamps
          newPosts.forEach(post => {
            post.timeAgo = this.formatTimeAgo(post.created_at);
          });

          if (refresh) {
            // Reset data for refresh
            this.setData({
              posts: newPosts,
              existPostIds: newPosts.map(post => post.id),
              hasMore: res.data.has_more || false,
              currentPage: 1
            });
          } else {
            // Append new posts for pagination
            const allPosts = [...this.data.posts, ...newPosts];
            const allIds = [...this.data.existPostIds, ...newPosts.map(post => post.id)];
            
            this.setData({
              posts: allPosts,
              existPostIds: allIds,
              hasMore: res.data.has_more || false,
              currentPage: this.data.currentPage + 1
            });
          }
        } else {
          this.showToast(this.data.messages.errors.loadFailed);
        }
      },
      fail: () => {
        this.showToast(this.data.messages.errors.networkError);
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  handleRefresh: function() {
    // Reset pagination state
    this.setData({
      posts: [],
      existPostIds: [],
      currentPage: 1,
      hasMore: true
    });
    
    this.loadPosts(true);
  },

  onPostTap: function (e) {
    const postId = e.currentTarget.dataset.postId;
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?id=${postId}`
    });
  },

  onUserTap: function (e) {
    const userId = e.currentTarget.dataset.userId;
    wx.navigateTo({
      url: `/pages/user-profile/user-profile?id=${userId}`
    });
  },

  onSearchTap: function () {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  onLoginClose: function () {
    app.setState("showLoginModal", false);
  },

  onLoginSuccess: function() {
    this.setData({
      userInfo: app.globalData.userInfo
    });
    this.handleRefresh();
  },

  onReloadTap: function() {
    if (this.data.loading) return;
    
    wx.vibrateShort();
    this.handleRefresh();
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts(false);
    }
  },

  onPageScroll: function(e) {
    // Show scroll to top button based on scroll position
    const showScrollTop = e.scrollTop > 300;
    if (this.data.showScrollTop !== showScrollTop) {
      this.setData({ showScrollTop });
    }
  },

  onScrollToTop: function() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
  },

  formatTimeAgo: function (dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = (now - date) / 1000; // Difference in seconds

    if (diff < 60) return this.data.messages.time.justNow;
    if (diff < 3600) return Math.floor(diff / 60) + this.data.messages.time.minutesAgo;
    if (diff < 86400) return Math.floor(diff / 3600) + this.data.messages.time.hoursAgo;
    if (diff < 604800) return Math.floor(diff / 86400) + this.data.messages.time.daysAgo;
    
    // For more than a week, show date format
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  showToast: function (title) {
    wx.showToast({
      title: title,
      icon: 'none',
      duration: 2000
    });
  }
});
