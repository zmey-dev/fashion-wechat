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
    scrollTopAnimating: false,
    existPostIds: [],
    showUserIdModal: false,
    userId: "",
    inputError: "",
    submitLoading: false,
    // Search parameters
    searchParams: {},
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载失败，请稍后重试",
        networkError: "网络错误，请检查网络连接",
      },
      time: {
        justNow: "刚刚",
        minutesAgo: "分钟前",
        hoursAgo: "小时前",
        daysAgo: "天前",
      },
    },
  },

  onLoad: function (options) {
    // Set user info
    this.setData({
      userInfo: app.globalData.userInfo,
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
    this.checkUserIdModal();
  },

  onShow: function () {
    // Check for pending search from other pages
    if (app.globalData.pendingSearch) {
      const searchParams = app.globalData.pendingSearch;
      this.setData({ searchParams });
      this.handleRefresh();
      // Clear the pending search
      app.globalData.pendingSearch = null;
    }
    // Check if posts need to be refreshed
    else if (app.globalData.refreshPosts) {
      this.handleRefresh();
      app.globalData.refreshPosts = false;
    } else if (!this.data.posts.length && !this.data.loading) {
      // Only initialize if no posts loaded and not currently loading
      this.initializePage();
    }
  },

  onUnload: function () {
    // Unsubscribe from events
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.loginModalHandler);
  },

  initializePage: function () {
    // Only refresh if not already loading and no posts loaded
    if (!this.data.loading && this.data.posts.length === 0) {
      this.handleRefresh();
    }
  },

  checkUserIdModal() {
    const userInfo = getApp().globalData.userInfo;
    if (
      userInfo &&
      (userInfo.role === "teacher" || userInfo.role === "user") &&
      userInfo.is_id_changed === false
    ) {
      this.setData({
        showUserIdModal: true,
      });
    }
  },

  isEnglishOnly(text) {
    // Allow letters, numbers, underscore, hyphen, and dot
    const englishPattern = /^[a-zA-Z0-9._-]*$/;
    return englishPattern.test(text);
  },

  onUserIdInput(e) {
    const value = e.detail.value;

    // Only update if the input contains English characters only
    if (this.isEnglishOnly(value)) {
      this.setData({
        userId: value,
        inputError: "",
      });
    } else {
      this.setData({
        inputError: "用户ID只能包含英文字母、数字、下划线(_)、连字符(-)和点(.)",
      });
    }
  },

  onCloseUserIdModal() {
    this.setData({
      showUserIdModal: false,
      userId: "",
      inputError: "",
    });
  },

  // Skip user ID modal
  onSkipUserIdModal() {
    this.onCloseUserIdModal();
  },

  // Handle user ID change request
  handleChangeUserId: function (id) {
    return new Promise((resolve, reject) => {
      this.setData({ submitLoading: true });

      wx.request({
        url: `${config.BACKEND_URL}/update_user_id`,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        data: {
          id: id,
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            // Update user info
            const updatedUserInfo = {
              ...getApp().globalData.userInfo,
              is_id_changed: true,
              username: id,
            };

            getApp().globalData.userInfo = updatedUserInfo;

            // Update local storage
            wx.setStorageSync("userInfo", updatedUserInfo);

            // Close modal
            this.setData({
              showUserIdModal: false,
              userId: "",
              inputError: "",
              userInfo: updatedUserInfo,
            });

            wx.showToast({
              title: "用户ID更新成功",
              icon: "success",
            });

            resolve(res.data);
          } else {
            const errorMsg = res.data.message || "更新失败，请重试";
            this.setData({
              inputError: errorMsg,
            });
            reject(new Error(errorMsg));
          }
        },
        fail: (err) => {
          const errorMsg = "网络错误，请重试";
          this.setData({
            inputError: errorMsg,
          });
          reject(new Error(`${errorMsg}: ${err.errMsg}`));
        },
        complete: () => {
          this.setData({ submitLoading: false });
        },
      });
    });
  },

  // Submit user ID
  onSubmitUserId() {
    const { userId } = this.data;

    if (userId.trim() === "") {
      this.setData({
        inputError: "请输入用户 ID 或点击跳过",
      });
      return;
    }

    // Double check for English-only characters before submitting
    if (!this.isEnglishOnly(userId)) {
      this.setData({
        inputError: "用户ID只能包含英文字母、数字、下划线(_)、连字符(-)和点(.)",
      });
      return;
    }

    this.handleChangeUserId(userId)
      .then(() => {
      })
      .catch((error) => {
      });
  },

  loadPosts: function (refresh = false) {
    // Prevent duplicate loading
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });

    const requestData = {
      limit: this.data.pageSize,
      offset: refresh ? 0 : this.data.posts.length,
    };

    // Add search parameters if they exist
    const { searchParams } = this.data;
    if (searchParams.search) {
      requestData.search = searchParams.search;
    }
    if (searchParams.university_id) {
      requestData.university_id = searchParams.university_id;
    }

    wx.request({
      url: `${config.BACKEND_URL}/v2/post/discover`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${app.globalData.userInfo?.token}`,
      },
      data: requestData,
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          const newPosts = res.data.posts || [];

          // Format timestamps
          newPosts.forEach((post) => {
            post.timeAgo = this.formatTimeAgo(post.created_at);
          });

          if (refresh) {
            // Reset data for refresh
            this.setData({
              posts: newPosts,
              existPostIds: newPosts.map((post) => post.id),
              hasMore: res.data.has_more || false,
              currentPage: 1,
            });
          } else {
            // Append new posts for pagination
            const allPosts = [...this.data.posts, ...newPosts];
            const allIds = [
              ...this.data.existPostIds,
              ...newPosts.map((post) => post.id),
            ];

            this.setData({
              posts: allPosts,
              existPostIds: allIds,
              hasMore: res.data.has_more || false,
              currentPage: this.data.currentPage + 1,
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
      },
    });
  },

  handleRefresh: function () {
    // Prevent duplicate refresh
    if (this.data.loading) {
      return;
    }

    // Reset pagination state
    this.setData({
      posts: [],
      existPostIds: [],
      currentPage: 1,
      hasMore: true,
    });

    this.loadPosts(true);
  },

  onSearch: function(e) {
    const searchParams = e.detail;
    
    // Store search parameters
    this.setData({
      searchParams: searchParams
    });
    
    // Refresh posts with search parameters
    this.handleRefresh();
  },

  onPostTap: function (e) {
    const postId = e.currentTarget.dataset.postId;
    
    // Build URL with search parameters if they exist
    let url = `/pages/post-detail/post-detail?postId=${postId}&type=discover`;
    
    const { searchParams } = this.data;
    if (searchParams.search) {
      url += `&search=${encodeURIComponent(searchParams.search)}`;
    }
    if (searchParams.university_id) {
      url += `&university_id=${searchParams.university_id}`;
    }
    
    wx.navigateTo({
      url: url,
    });
  },

  // Handle reaching bottom of page for infinite scroll
  onReachBottom: function() {
    
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts(false);
    }
  },

  // Handle pull down refresh
  onPullDownRefresh: function() {
    this.handleRefresh();
    // Stop pull down refresh animation
    wx.stopPullDownRefresh();
  },

  onUserTap: function (e) {
    const username = e.currentTarget.dataset.username;
    getApp().handleGoUserProfile(username);
  },

  onSearchTap: function () {
    wx.navigateTo({
      url: "/pages/search/search",
    });
  },

  onLoginClose: function () {
    app.setState("showLoginModal", false);
  },

  onLoginSuccess: function () {
    this.setData({
      userInfo: app.globalData.userInfo,
    });
    // Only refresh if not already loading
    if (!this.data.loading) {
      this.handleRefresh();
    }
  },

  onReloadTap: function () {
    if (this.data.loading) return;

    wx.vibrateShort();
    this.handleRefresh();
  },


  onPageScroll: function (e) {
    // Show scroll to top button based on scroll position
    const showScrollTop = e.scrollTop > 300;
    if (this.data.showScrollTop !== showScrollTop) {
      this.setData({ showScrollTop });
    }
  },

  onScrollToTop: function () {
    // Add animation feedback
    this.setData({ scrollTopAnimating: true });
    
    // Haptic feedback
    wx.vibrateShort({ type: 'light' });
    
    // Smooth scroll to top
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 500,
      complete: () => {
        // Remove animation class after scroll completes
        setTimeout(() => {
          this.setData({ scrollTopAnimating: false });
        }, 600);
      }
    });
  },

  formatTimeAgo: function (dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = (now - date) / 1000; // Difference in seconds

    if (diff < 60) return this.data.messages.time.justNow;
    if (diff < 3600)
      return Math.floor(diff / 60) + this.data.messages.time.minutesAgo;
    if (diff < 86400)
      return Math.floor(diff / 3600) + this.data.messages.time.hoursAgo;
    if (diff < 604800)
      return Math.floor(diff / 86400) + this.data.messages.time.daysAgo;

    // For more than a week, show date format
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  showToast: function (title) {
    wx.showToast({
      title: title,
      icon: "none",
      duration: 2000,
    });
  },
});
