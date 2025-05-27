import config from "../../config";
import { isEmpty } from "../../utils/isEmpty";
const app = getApp();

Page({
  data: {
    showSidebar: false,
    currentPath: "discover",
    showLoginModal: app.globalData.showLoginModal || false,
    userInfo: app.globalData.userInfo || {},
    followedUsers: app.globalData.followedUsers || [],

    currentPost: null,
    currentPostUser: null,
    userInfo: null,
    currentIndex: 0,
    totalPosts: 0,
    isLoading: true,
    loadError: false,
    errorMessage: "",

    touchStartX: 0,
    touchStartY: 0,
  },
  onLoad: function (options) {
    console.time('onLoad');
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
      showSidebar: app.globalData.showSidebar,
      showLoginModal: app.globalData.showLoginModal || false,
      userInfo: app.globalData.userInfo || {},
      followedUsers: app.globalData.followedUsers || [],
      // currentPath: currentPath,
      // userInfo: userInfo,
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

  setShowLoginModal: function (show) {
    this.setData({ showLoginModal: show });
  },

  hideLoginModal: function () {
    this.setData({ showLoginModal: false });
  },

  updateSidebar: function (data) {
    this.setData({
      showSidebar: data.showSidebar,
      currentPath: data.currentPath,
      userInfo: data.userInfo,
    });
  },

  onTouchStart: function (e) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
    });
  },

  onTouchEnd: function (e) {
    app.handleSwipe(
      this.data.touchStartX,
      this.data.touchStartY,
      e.changedTouches[0].clientX,
      e.changedTouches[0].clientY
    );
  },

  toggleSideBar: function () {
    app.toggleSidebar();
  },

  loadPostData: function (index, postId) {
    this.setData({
      isLoading: true,
      loadError: false,
    });
    const data = {};
    if(index !== null && index !== undefined) {
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
            errorMessage: "内容加载失败",
          });
        }
      },
      fail: (err) => {
        console.error("Failed to load post:", err);
        this.setData({
          isLoading: false,
          loadError: true,
          errorMessage: "网络错误，请稍后重试",
        });
      },
    });
  },

  // Handle navigation between posts
  handlePostNavigation: function (e) {
    const { direction, newIndex } = e.detail;

    this.setData({ isLoading: true });

    // Fetch the next/previous post
    wx.request({
      url: `${app.globalData.apiBase}/posts/navigation`,
      method: "GET",
      data: {
        current_index: this.data.currentIndex,
        direction: direction,
      },
      header: {
        Authorization: app.globalData.token
          ? `Bearer ${app.globalData.token}`
          : "",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          this.setData({
            currentPost: res.data.post,
            currentPostUser: res.data.user,
            currentIndex: newIndex,
            isLoading: false,
          });
        } else {
          wx.showToast({
            title: "没有更多内容",
            icon: "none",
          });
          this.setData({ isLoading: false });
        }
      },
      fail: (err) => {
        console.error("Navigation failed:", err);
        wx.showToast({
          title: "加载失败",
          icon: "none",
        });
        this.setData({ isLoading: false });
      },
    });
  },

  // Handle like update
  handleLikeUpdated: function (e) {
    const updatedPost = this.data.currentPost;

    // Update like status and count
    updatedPost.likes_exists = e.detail.liked;
    updatedPost.likes = e.detail.likes_count;

    this.setData({ currentPost: updatedPost });
  },

  // Handle favorite update
  handleFavoriteUpdated: function (e) {
    const updatedPost = this.data.currentPost;

    // Update favorite status and count
    updatedPost.favorites_exists = e.detail.favorited;
    updatedPost.favorites = e.detail.favorites_count;

    this.setData({ currentPost: updatedPost });
  },

  // Handle share update
  handleShareUpdated: function (e) {
    const updatedPost = this.data.currentPost;

    // Update share count
    updatedPost.shares = e.detail.shares_count;

    this.setData({ currentPost: updatedPost });
  },

  // Handle follow update
  handleFollowUpdated: function (e) {
    const updatedUser = this.data.currentPostUser;

    // Update follow status and count
    updatedUser.is_followed = e.detail.is_followed;
    updatedUser.follower_number = e.detail.follower_count;

    this.setData({ currentPostUser: updatedUser });
  },

  // Show login modal
  showLoginModal: function () {
    wx.showModal({
      title: "需要登录",
      content: "请先登录以继续操作",
      confirmText: "去登录",
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: "/pages/login/login",
          });
        }
      },
    });
  },

  // Navigate to user profile
  navigateToUserProfile: function (e) {
    const { userId, username } = e.detail;

    wx.navigateTo({
      url: `/pages/user-profile/user-profile?id=${userId}&username=${encodeURIComponent(
        username
      )}`,
    });
  },

  handlePreviousPost: function () {
    if (this.data.currentIndex > 0) {
      this.loadPostData(this.data.currentIndex - 1);
    } else {
      wx.showToast({
        title: "已经是第一篇文章了",
        icon: "none",
      });
    }
  },

  handleNextPost: function () {
    if (this.data.currentIndex < this.data.totalPosts - 1) {
      this.loadPostData(this.data.currentIndex + 1);
    } else {
      wx.showToast({
        title: "已经是最后一篇文章了",
        icon: "none",
      });
    }
  },
});
