const { default: config } = require("../../config");

const app = getApp();

Page({
  /**
   * Page initial data
   */
  data: {
    // Posts data
    posts: [],
    // Loading state
    loading: false,
    // Current page
    currentPage: 1,
    // Has more data
    hasMore: true,
    // Page size
    pageSize: 8,
    // User info
    userInfo: null,
    // Show login modal
    showLoginModal: false,
    // Current filter
    currentFilter: "discover",
    // Search filter (search term)
    searchFilter: "",
    // Filter options
    filterOptions: [
      { key: "discover", name: "发现" },
      { key: "recommend", name: "推荐" },
      { key: "following", name: "关注" },
      { key: "latest", name: "最新" },
    ],
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    const app = getApp();

    // Subscribe to state changes
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    this.showLoginModal = (showLoginModal) => {
      this.setData({ showLoginModal });
    }
    app.subscribe("showLoginModal", this.showLoginModal);
    app.subscribe("userInfo", this.userInfoHandler);
    this.setData({
      showLoginModal: app.globalData.showLoginModal || false,
      userInfo: app.globalData.userInfo || {},
    });
    this.initializePage();
    this.loadPosts(true);
  },

  onUnload: function () {
    const app = getApp();
    app.unsubscribe("showLoginModal", this.showLoginModal);
    app.unsubscribe("userInfo", this.userInfoHandler);
  },
  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    this.setData({
      userInfo: app.globalData.userInfo,
    });
  },

  /**
   * Initialize page settings
   */
  initializePage: function () {
    wx.setNavigationBarTitle({
      title: "时装秀平台",
    });
  },

  /**
   * Load posts from server
   */
  loadPosts: function (refresh = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    const page = refresh ? 1 : this.data.currentPage;
    const existIds = refresh ? [] : this.data.posts.map((p) => p.id);

    // Build request data object
    const requestData = {
      page: page,
      limit: this.data.pageSize,
      scope: 15,
      isDiscover: true,
    };

    // Only add exist_post_ids if there are existing posts
    if (existIds && existIds.length > 0) {
      requestData.exist_post_ids = JSON.stringify(existIds);
    }

    // Only add filter if there's a search term
    if (this.data.searchFilter && this.data.searchFilter.trim()) {
      requestData.filter = this.data.searchFilter.trim();
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts_discover`,
      method: "GET",
      data: requestData,
      header: {
        Authorization: app.globalData.userInfo?.token
          ? `Bearer ${app.globalData.userInfo.token}`
          : "",
        "Content-Type": "application/json",
      },
      success: (res) => {
        console.log("Posts loaded:", res.data);
        if (res.data.status === "success") {
          const newPosts = res.data.posts || [];
          const allPosts = refresh
            ? newPosts
            : [...this.data.posts, ...newPosts];

          this.setData({
            posts: allPosts,
            hasMore: res.data.has_more || false,
            currentPage: page + 1,
            loading: false,
          });
        } else {
          this.showToast("加载失败，请重试");
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        console.error("Load posts failed:", err);
        this.showToast("网络错误，请检查连接");
        this.setData({ loading: false });
      },
    });
  },

  /**
   * Handle post item tap - navigate to detail
   */
  onPostTap: function (e) {
    const { postId, index } = e.currentTarget.dataset;

    if (!postId) {
      this.showToast("帖子信息错误");
      return;
    }

    wx.navigateTo({
      url: `/pages/post-detail/post-detail?postId=${postId}&index=${index}`,
      fail: () => {
        this.showToast("页面跳转失败");
      },
    });
  },

  /**
   * Handle like button tap
   */
  onLikeTap: function (e) {
    e.stopPropagation();

    if (!app.globalData.userInfo) {
      this.setData({ showLoginModal: true });
      return;
    }

    const { postId, index } = e.currentTarget.dataset;

    wx.request({
      url: `${app.globalData.baseUrl}/post/add_like`,
      method: "POST",
      data: { post_id: postId },
      header: {
        Authorization: `Bearer ${app.globalData.userInfo.token}`,
        "Content-Type": "application/json",
      },
      success: (res) => {
        if (res.data.status === "success") {
          const posts = [...this.data.posts];
          posts[index].likes = res.data.post.likes;
          posts[index].likes_exists = !posts[index].likes_exists;

          this.setData({ posts });
          wx.vibrateShort();
        }
      },
      fail: () => {
        this.showToast("操作失败");
      },
    });
  },

  /**
   * Handle user avatar tap
   */
  onUserTap: function (e) {
    e.stopPropagation();

    const { username } = e.currentTarget.dataset;

    wx.navigateTo({
      url: `/pages/profile/profile?username=${username}`,
    });
  },

  /**
   * Handle search input
   */
  onSearchInput: function (e) {
    const searchTerm = e.detail.value;
    this.setData({
      searchFilter: searchTerm,
    });

    // Debounce search - wait 500ms after user stops typing
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.setData({ currentPage: 1 });
      this.loadPosts(true);
    }, 500);
  },

  /**
   * Clear search filter
   */
  onClearSearch: function () {
    this.setData({
      searchFilter: "",
      currentPage: 1,
    });
    this.loadPosts(true);
  },

  /**
   * Handle filter change
   */
  onFilterTap: function (e) {
    const { filter } = e.currentTarget.dataset;

    if (filter === this.data.currentFilter) return;

    this.setData({
      currentFilter: filter,
      currentPage: 1,
      searchFilter: "", // Clear search when changing category filter
    });

    this.loadPosts(true);
  },

  /**
   * Handle search tap
   */
  onSearchTap: function () {
    wx.navigateTo({
      url: "/pages/search/search",
    });
  },

  /**
   * Handle upload tap
   */
  onUploadTap: function () {
    if (!app.globalData.userInfo) {
      this.setData({ showLoginModal: true });
      return;
    }

    wx.navigateTo({
      url: "/pages/upload/upload",
    });
  },

  /**
   * Pull down refresh
   */
  onPullDownRefresh: function () {
    this.loadPosts(true);
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  /**
   * Reach bottom load more
   */
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts(false);
    }
  },

  /**
   * Format relative time display
   */
  formatTimeAgo: function (dateStr) {
    if (!dateStr) return "";

    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;

    return date.toLocaleDateString("zh-CN");
  },

  /**
   * Show toast message
   */
  showToast: function (title) {
    wx.showToast({
      title: title,
      icon: "none",
      duration: 2000,
    });
  },

  /**
   * Close login modal
   */
  onLoginClose: function () {
    this.setData({ showLoginModal: false });
  },
});
