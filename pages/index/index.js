const app = getApp();
const { default: config } = require("../../config");
const shareHelper = require("../../utils/shareHelper");

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

    // Check if there are search parameters in URL
    if (options.search || options.university_id) {
      const searchParams = {};
      if (options.search) searchParams.search = decodeURIComponent(options.search);
      if (options.university_id) searchParams.university_id = options.university_id;
      


      this.setData({ searchParams });
      
      // Clear any existing pendingSearch since URL params take priority
      if (app.globalData.pendingSearch) {

        app.globalData.pendingSearch = null;
      }
    }

    // Initial post loading
    this.initializePage();
  },

  onShow: function () {
    // Check if we already have searchParams from URL (onLoad)
    // If so, don't process pendingSearch to avoid overriding URL params
    const hasUrlParams = this.data.searchParams && (this.data.searchParams.search || this.data.searchParams.university_id);
    



    
    if (!hasUrlParams && app.globalData.pendingSearch) {
      // Only use pendingSearch if we don't have URL params
      const searchParams = app.globalData.pendingSearch;

      this.setData({ searchParams });
      this.handleRefresh();
      // Clear the pending search
      app.globalData.pendingSearch = null;
    } else if (hasUrlParams) {
      // URL params take priority, clear pendingSearch and refresh

      app.globalData.pendingSearch = null;
      this.handleRefresh();
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


  loadPosts: function (refresh = false) {
    // Prevent duplicate loading
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });
    getApp().showGlobalLoading();

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
        getApp().hideGlobalLoading();
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

  // Handle reaching bottom of scroll-view for infinite scroll
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

  // Share to friends/groups
  onShareAppMessage: function() {
    return shareHelper.getShareConfig({
      title: '校Show - 发现精彩内容',
      path: '/pages/index/index'
    });
  },

  // Share to WeChat Moments
  onShareTimeline: function() {
    return shareHelper.getTimelineConfig({
      title: '校Show - 发现精彩内容'
    });
  }
});
