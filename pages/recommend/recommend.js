import config from "../../config";
const app = getApp();

Page({
  data: {
    currentPath: "recommend",
    showLoginModal: app.globalData.showLoginModal || false,
    userInfo: app.globalData.userInfo || {},
    followedUsers: app.globalData.followedUsers || [],
    postId: null,

    // Web version style data structure
    selectedPost: null,
    nextPostId: null,
    previousPostId: null,
    isLoading: true,
    loadError: false,
    errorMessage: "",
    filterText: "",

    touchStartX: 0,
    touchStartY: 0,

    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "内容加载失败",
        networkError: "网络错误，请稍后重试",
      },
      navigation: {
        firstPost: "已经是第一篇文章了",
        lastPost: "已经是最后一篇文章了",
      },
    },
  },

  onLoad: function (options) {
    const postId = options.postId || null;
    const filterText = options.filter || "";
    this.setData({
      postId: postId,
      filterText: filterText,
    });
    const app = getApp();

    // Subscribe to state changes
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    this.showLoginModalHandler = (showLoginModal) => {
      this.setData({ showLoginModal });
    };
    this.followedUserHandler = (followedUsers) => {
      this.setData({ followedUsers });
    };

    app.subscribe("userInfo", this.userInfoHandler);
    app.subscribe("followedUser", this.followedUserHandler);
    app.subscribe("showLoginModal", this.showLoginModalHandler);

    this.setData({
      showLoginModal: app.globalData.showLoginModal || false,
      userInfo: app.globalData.userInfo || {},
      followedUsers: app.globalData.followedUsers || [],
    });

    // Load initial post like web version
    this.loadInitialPost();
  },

  onShow: function () {
    // Reload initial post
    this.loadInitialPost();
  },

  onUnload: function () {
    const app = getApp();
    // Unsubscribe from state changes
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.showLoginModalHandler);
    app.unsubscribe("followedUser", this.followedUserHandler);
    
    // Clear selected post like web version
    this.setData({ selectedPost: null });
  },

  // Load initial post like web version
  loadInitialPost: function () {
    this.setData({ isLoading: true });
    
    // Get first recommended post
    wx.request({
      url: `${config.BACKEND_URL}/v2/post/recommend`,
      method: "GET",
      data: {
        limit: 1,
        offset: 0,
        filter: this.data.filterText,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: app.globalData?.userInfo?.token
          ? `Bearer ${app.globalData?.userInfo?.token}`
          : "",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success" && res.data.posts.length > 0) {
          const firstPost = res.data.posts[0];
          // Get detailed post data with navigation like web version
          this.fetchPostDetail(firstPost.id, "recommend", {});
        } else {
          this.setData({
            isLoading: false,
            loadError: true,
            errorMessage: this.data.messages.errors.loadFailed,
          });
        }
      },
      fail: (err) => {
        console.error("Failed to load initial post:", err);
        this.setData({
          isLoading: false,
          loadError: true,
          errorMessage: this.data.messages.errors.networkError,
        });
      },
    });
  },

  // Fetch post detail like web version
  fetchPostDetail: function (postId, type, options = {}) {
    // Build query parameters like web version
    const params = { type };
    Object.keys(options).forEach(key => {
      if (options[key] !== null && options[key] !== undefined) {
        params[key] = options[key];
      }
    });

    wx.request({
      url: `${config.BACKEND_URL}/v2/post/detail/${postId}`,
      method: "GET",
      data: params,
      header: {
        "Content-Type": "application/json",
        Authorization: app.globalData?.userInfo?.token
          ? `Bearer ${app.globalData?.userInfo?.token}`
          : "",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          this.setData({
            selectedPost: res.data.post,
            nextPostId: res.data.next_post_id,
            previousPostId: res.data.previous_post_id,
            isLoading: false,
          });
        } else {
          this.setData({
            isLoading: false,
            loadError: true,
            errorMessage: res.data?.msg || this.data.messages.errors.loadFailed,
          });
        }
      },
      fail: (err) => {
        console.error("Failed to fetch post detail:", err);
        this.setData({
          isLoading: false,
          loadError: true,
          errorMessage: this.data.messages.errors.networkError,
        });
      },
    });
  },


  // Navigation like web version onClickArrow
  handlePreviousPost: function () {
    if (this.data.previousPostId) {
      this.setData({ isLoading: true });
      this.fetchPostDetail(this.data.previousPostId, "recommend", {});
    } else {
      wx.showToast({
        title: this.data.messages.navigation.firstPost,
        icon: "none",
      });
    }
  },

  handleNextPost: function () {
    if (this.data.nextPostId) {
      this.setData({ isLoading: true });
      this.fetchPostDetail(this.data.nextPostId, "recommend", {});
    } else {
      wx.showToast({
        title: this.data.messages.navigation.lastPost,
        icon: "none",
      });
    }
  },

  // Refresh current post like web version
  handleRefreshPost: function () {
    if (this.data.selectedPost?.id) {
      this.setData({ isLoading: true });
      this.fetchPostDetail(this.data.selectedPost.id, "recommend", {});
    }
  },

  closeSidebar: function () {
    this.setState("showSidebar", false);
  },
});
