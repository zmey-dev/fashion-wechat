import config from "../../config";
const app = getApp();

Page({
  data: {
    currentPath: "discover",
    showLoginModal: app.globalData.showLoginModal || false,
    userInfo: app.globalData.userInfo || {},
    followedUsers: app.globalData.followedUsers || [],

    currentPost: null,
    currentPostUser: null,
    currentIndex: 0,
    totalPosts: 0,
    isLoading: true,
    loadError: false,
    errorMessage: "",

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
    if (postId) this.loadPostData(null, postId);
    else this.loadPostData(0);
  },

  onUnload: function () {
    const app = getApp();
    // Unsubscribe from state changes
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.showLoginModalHandler);
    app.unsubscribe("followedUser", this.followedUserHandler);
  },

  loadPostData: function (index, postId) {
    this.setData({
      isLoading: true,
      loadError: false,
    });

    const data = {};
    if (index !== null && index !== undefined) {
      data.index = index;
    }
    if (postId) {
      data.id = postId;
    }

    // Fetch post data from API
    wx.request({
      url: `${config.BACKEND_URL}/post/get_post_in_discover`,
      method: "GET",
      data: data,
      header: {
        Authorization: app.globalData?.userInfo?.token
          ? `Bearer ${app.globalData?.userInfo?.token}`
          : "",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          // Get post count for navigation
          const totalPosts = res.data.count || 1;

          this.setData({
            currentPost: res.data.post,
            currentIndex: index || 0,
            totalPosts: totalPosts,
            isLoading: false,
          });
        } else {
          this.setData({
            isLoading: false,
            loadError: true,
            errorMessage: this.data.messages.errors.loadFailed,
          });
        }
      },
      fail: (err) => {
        console.error("Failed to load post:", err);
        this.setData({
          isLoading: false,
          loadError: true,
          errorMessage: this.data.messages.errors.networkError,
        });
      },
    });
  },

  handlePreviousPost: function () {
    if (this.data.currentIndex > 0) {
      this.loadPostData(this.data.currentIndex - 1);
    } else {
      wx.showToast({
        title: this.data.messages.navigation.firstPost,
        icon: "none",
      });
    }
  },

  handleNextPost: function () {
    if (this.data.currentIndex < this.data.totalPosts - 1) {
      this.loadPostData(this.data.currentIndex + 1);
    } else {
      wx.showToast({
        title: this.data.messages.navigation.lastPost,
        icon: "none",
      });
    }
  },

  closeSidebar: function () {
    this.setState("showSidebar", false);
  },
});
