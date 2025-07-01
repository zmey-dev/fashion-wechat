import config from "../../config";
const app = getApp();

Page({
  data: {
    currentPath: "",
    showLoginModal: app.globalData.showLoginModal || false,
    userInfo: app.globalData.userInfo || {},
    followedUsers: app.globalData.followedUsers || [],
    postId: null,
    userId: null,
    userPosts: [],
    currentUserPostIndex: 0,

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
    const userId = options.user_id || null;
    this.setData({
      postId: postId,
      userId: userId,
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
    if (userId) {
      // If user_id is provided, load user's posts
      this.loadUserPosts(postId);
    } else {
      // Otherwise, use the original logic
      if (postId) this.loadPostData(null, postId);
      else this.loadPostData(0);
    }
  },
  onShow: function () {
    if (this.data.userId) {
      // If user_id is provided, reload user's posts
      this.loadUserPosts(this.data.postId);
    } else {
      // Otherwise, use the original logic
      if(this.data.postId) {
        this.loadPostData(null, this.data.postId);
      } else {
        this.loadPostData(0);
      }
    }
  },
  onUnload: function () {
    const app = getApp();
    // Unsubscribe from state changes
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.showLoginModalHandler);
    app.unsubscribe("followedUser", this.followedUserHandler);
  },

  // Load posts for a specific user
  loadUserPosts: function (selectedPostId) {
    this.setData({
      isLoading: true,
      loadError: false,
    });

    // Fetch all posts for the specific user
    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts`,
      method: "GET",
      data: {
        user_id: this.data.userId,
        page: 1,
        pageSize: 100, // Get many posts at once
      },
      header: {
        Authorization: app.globalData?.userInfo?.token
          ? `Bearer ${app.globalData?.userInfo?.token}`
          : "",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const posts = res.data.posts || [];
          if (posts.length > 0) {
            // Find the index of the selected post
            let currentIndex = 0;
            if (selectedPostId) {
              const index = posts.findIndex(post => post.id == selectedPostId);
              if (index !== -1) {
                currentIndex = index;
              }
            }

            this.setData({
              userPosts: posts,
              currentPost: posts[currentIndex],
              currentUserPostIndex: currentIndex,
              totalPosts: posts.length,
              isLoading: false,
            });
          } else {
            this.setData({
              isLoading: false,
              loadError: true,
              errorMessage: "该用户暂无作品",
            });
          }
        } else {
          this.setData({
            isLoading: false,
            loadError: true,
            errorMessage: this.data.messages.errors.loadFailed,
          });
        }
      },
      fail: (err) => {
        console.error("Failed to load user posts:", err);
        this.setData({
          isLoading: false,
          loadError: true,
          errorMessage: this.data.messages.errors.networkError,
        });
      },
    });
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
    if (this.data.userId) {
      // If viewing user's posts, navigate through userPosts array
      if (this.data.currentUserPostIndex > 0) {
        const newIndex = this.data.currentUserPostIndex - 1;
        this.setData({
          currentUserPostIndex: newIndex,
          currentPost: this.data.userPosts[newIndex],
        });
      } else {
        wx.showToast({
          title: this.data.messages.navigation.firstPost,
          icon: "none",
        });
      }
    } else {
      // Original logic for discover posts
      if (this.data.currentIndex > 0) {
        this.loadPostData(this.data.currentIndex - 1);
      } else {
        wx.showToast({
          title: this.data.messages.navigation.firstPost,
          icon: "none",
        });
      }
    }
  },

  handleNextPost: function () {
    if (this.data.userId) {
      // If viewing user's posts, navigate through userPosts array
      if (this.data.currentUserPostIndex < this.data.userPosts.length - 1) {
        const newIndex = this.data.currentUserPostIndex + 1;
        this.setData({
          currentUserPostIndex: newIndex,
          currentPost: this.data.userPosts[newIndex],
        });
      } else {
        wx.showToast({
          title: this.data.messages.navigation.lastPost,
          icon: "none",
        });
      }
    } else {
      // Original logic for discover posts
      if (this.data.currentIndex < this.data.totalPosts - 1) {
        this.loadPostData(this.data.currentIndex + 1);
      } else {
        wx.showToast({
          title: this.data.messages.navigation.lastPost,
          icon: "none",
        });
      }
    }
  },

  closeSidebar: function () {
    this.setState("showSidebar", false);
  },
});
