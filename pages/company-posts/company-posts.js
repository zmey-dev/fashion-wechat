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
    if (options.search) {
      const searchParams = {};
      if (options.search) searchParams.search = decodeURIComponent(options.search);
      
      console.log('onLoad - URL search params:', searchParams);
      console.log('onLoad - Raw options:', options);
      this.setData({ searchParams });
      
      // Clear any existing pendingSearch since URL params take priority
      if (app.globalData.pendingSearch) {
        console.log('onLoad - Clearing pendingSearch due to URL params:', app.globalData.pendingSearch);
        app.globalData.pendingSearch = null;
      }
    }

    // Initial post loading
    this.initializePage();
  },

  onShow: function () {
    // Check if we already have searchParams from URL (onLoad)
    // If so, don't process pendingSearch to avoid overriding URL params
    const hasUrlParams = this.data.searchParams && this.data.searchParams.search;
    
    console.log('onShow - hasUrlParams:', hasUrlParams);
    console.log('onShow - current searchParams:', this.data.searchParams);
    console.log('onShow - pendingSearch:', app.globalData.pendingSearch);
    
    if (!hasUrlParams && app.globalData.pendingSearch) {
      // Only use pendingSearch if we don't have URL params
      const searchParams = app.globalData.pendingSearch;
      console.log('Processing pendingSearch:', searchParams);
      this.setData({ searchParams });
      this.handleRefresh();
      // Clear the pending search
      app.globalData.pendingSearch = null;
    } else if (hasUrlParams) {
      // URL params take priority, clear pendingSearch and refresh
      console.log('URL params found, clearing pendingSearch and refreshing');
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
    // Unsubscribe
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.loginModalHandler);
  },

  initializePage: function () {
    // Load posts with current search params (empty or from URL)
    this.loadCompanyPosts();
  },

  onSearch: function (e) {
    console.log('Search event received:', e.detail);
    const searchParams = e.detail;
    this.setData({ searchParams });
    this.handleRefresh();
  },

  loadCompanyPosts: function () {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });
    getApp().showGlobalLoading();

    const params = {
      limit: this.data.pageSize,
      offset: (this.data.currentPage - 1) * this.data.pageSize
    };

    // Add search parameter if exists
    if (this.data.searchParams.search) {
      params.search = this.data.searchParams.search;
    }

    wx.request({
      url: `${config.BACKEND_URL}/v2/post/company`,
      method: "GET",
      data: params,
      header: {
        "Content-Type": "application/json",
        Authorization: app.globalData.userInfo
          ? `Bearer ${app.globalData.userInfo.token}`
          : "",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          const newPosts = res.data.posts || [];
          
          // Filter out duplicates
          const filteredPosts = newPosts.filter(
            (post) => !this.data.existPostIds.includes(post.id)
          );
          const newPostIds = filteredPosts.map((post) => post.id);

          this.setData({
            posts: [...this.data.posts, ...filteredPosts],
            existPostIds: [...this.data.existPostIds, ...newPostIds],
            hasMore: res.data.has_more || false,
            currentPage: this.data.currentPage + 1,
          });
        } else {
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
      complete: () => {
        this.setData({ loading: false });
        getApp().hideGlobalLoading();
        wx.stopPullDownRefresh();
      },
    });
  },

  onReachBottom: function () {
    this.loadCompanyPosts();
  },

  onPullDownRefresh: function () {
    this.handleRefresh();
  },

  handleRefresh: function () {
    // Reset all data and reload
    this.setData({
      posts: [],
      currentPage: 1,
      hasMore: true,
      existPostIds: [],
      showScrollTop: false,
    });
    this.loadCompanyPosts();
  },

  onPostTap: function (e) {
    const postId = e.currentTarget.dataset.postId;
    const postIndex = e.currentTarget.dataset.index;

    // Navigate to post detail with company type
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?postId=${postId}&type=company`,
    });
  },

  onUserTap: function (e) {
    const username = e.currentTarget.dataset.username;
    getApp().handleGoUserProfile(username);
  },

  onScrollToTop: function () {
    this.setData({ scrollTopAnimating: true });
    
    // Scroll to top
    const scrollView = this.createSelectorQuery().select('#contentArea');
    if (scrollView) {
      scrollView.scrollTo({ top: 0, duration: 300 });
    }

    // Hide button after animation
    setTimeout(() => {
      this.setData({ scrollTopAnimating: false, showScrollTop: false });
    }, 300);
  },

  // Monitor scroll position to show/hide scroll to top button
  onPageScroll: function (e) {
    const showScrollTop = e.scrollTop > 500;
    if (this.data.showScrollTop !== showScrollTop) {
      this.setData({ showScrollTop });
    }
  },

  onLoginClose: function () {
    this.setData({ showLoginModal: false });
  },

  onLoginSuccess: function () {
    this.setData({ showLoginModal: false });
    // Reload posts after successful login
    this.handleRefresh();
  },

  onSearchTap: function () {
    wx.navigateTo({
      url: "/pages/search/search",
    });
  },
});