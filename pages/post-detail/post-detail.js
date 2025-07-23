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
    eventId: null,
    type: "discover", // Add type like web version
    userPosts: [],
    eventPosts: [],
    currentUserPostIndex: 0,
    currentEventPostIndex: 0,
    hasMoreEventPosts: true,

    currentPost: null,
    currentPostUser: null,
    currentIndex: 0,
    totalPosts: 0,
    // Navigation data from v2 API like web version
    nextPostId: null,
    previousPostId: null,
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
    const eventId = options.eventId || options.event_id || null; // Support both formats
    const type = options.type || "discover"; // Add type parameter like web version
    const filter = options.filter || ""; // Add filter parameter like web version
    this.setData({
      postId: postId,
      userId: userId,
      eventId: eventId,
      type: type,
      filter: filter,
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
    
    // Load post using web version logic - use getPostDetail with type
    if (postId) {
      const options = {};
      if (userId) options.user_id = userId;
      if (eventId) options.event_id = eventId;
      if (filter) options.filter = filter;
      this.loadPostDetail(postId, type, options);
    } else {
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: "No post ID provided",
      });
    }
  },
  onShow: function () {
    // Reload post using web version logic
    if(this.data.postId) {
      const options = {};
      if (this.data.userId) options.user_id = this.data.userId;
      if (this.data.eventId) options.event_id = this.data.eventId;
      if (this.data.filter) options.filter = this.data.filter;
      this.loadPostDetail(this.data.postId, this.data.type, options);
    }
  },
  onUnload: function () {
    const app = getApp();
    // Unsubscribe from state changes
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.showLoginModalHandler);
    app.unsubscribe("followedUser", this.followedUserHandler);
  },

  // Load post detail using web version API pattern
  loadPostDetail: function (postId, type, options = {}) {
    this.setData({
      isLoading: true,
      loadError: false,
    });

    // Build query parameters like web version
    const params = { type };
    Object.keys(options).forEach(key => {
      if (options[key] !== null && options[key] !== undefined) {
        params[key] = options[key];
      }
    });

    // Use v2 API like web version
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
            currentPost: res.data.post,
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
        console.error("Failed to load post detail:", err);
        this.setData({
          isLoading: false,
          loadError: true,
          errorMessage: this.data.messages.errors.networkError,
        });
      },
    });
  },

  // Load posts for a specific user
  loadUserPosts: function (selectedPostId) {
    this.setData({
      isLoading: true,
      loadError: false,
    });

    // Fetch all posts for the specific user
    wx.request({
      url: `${config.BACKEND_URL}/v2/post/by-user-id`,
      method: "GET",
      data: {
        user_id: this.data.userId,
        limit: 100, // Get many posts at once
        offset: 0,
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
      url: `${config.BACKEND_URL}/v2/post/recommend`,
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
    // Use web version navigation with previousPostId
    if (this.data.previousPostId) {
      const options = {};
      if (this.data.userId) options.user_id = this.data.userId;
      if (this.data.eventId) options.event_id = this.data.eventId;
      if (this.data.filter) options.filter = this.data.filter;
      this.loadPostDetail(this.data.previousPostId, this.data.type, options);
    } else {
      wx.showToast({
        title: this.data.messages.navigation.firstPost,
        icon: "none",
      });
    }
  },

  handleNextPost: function () {
    // Use web version navigation with nextPostId
    if (this.data.nextPostId) {
      const options = {};
      if (this.data.userId) options.user_id = this.data.userId;
      if (this.data.eventId) options.event_id = this.data.eventId;
      if (this.data.filter) options.filter = this.data.filter;
      this.loadPostDetail(this.data.nextPostId, this.data.type, options);
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

  // Load posts for a specific event
  loadEventPosts: function (selectedPostId) {
    this.setData({
      isLoading: true,
      loadError: false,
    });

    // Fetch posts for the specific event
    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts_event_discover/${this.data.eventId}`,
      method: "GET",
      data: {
        eventId: this.data.eventId,
        scope: 30, // Get more posts at once for smoother navigation
        isDiscover: true,
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
              eventPosts: posts,
              currentPost: posts[currentIndex],
              currentEventPostIndex: currentIndex,
              totalPosts: posts.length,
              isLoading: false,
              hasMoreEventPosts: res.data.has_more || false,
            });
          } else {
            this.setData({
              isLoading: false,
              loadError: true,
              errorMessage: "该活动暂无作品",
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
        console.error("Failed to load event posts:", err);
        this.setData({
          isLoading: false,
          loadError: true,
          errorMessage: this.data.messages.errors.networkError,
        });
      },
    });
  },

  // Load more event posts when reaching the end
  loadMoreEventPosts: function () {
    if (!this.data.hasMoreEventPosts || this.data.isLoading) {
      wx.showToast({
        title: this.data.messages.navigation.lastPost,
        icon: "none",
      });
      return;
    }

    this.setData({ isLoading: true });

    // Get existing post IDs to avoid duplicates
    const existingPostIds = this.data.eventPosts.map(post => post.id);

    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts_event_discover/${this.data.eventId}`,
      method: "GET",
      data: {
        eventId: this.data.eventId,
        exist_post_ids: existingPostIds,
        scope: 15,
        isDiscover: true,
      },
      header: {
        Authorization: app.globalData?.userInfo?.token
          ? `Bearer ${app.globalData?.userInfo?.token}`
          : "",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const newPosts = res.data.posts || [];
          if (newPosts.length > 0) {
            const updatedPosts = [...this.data.eventPosts, ...newPosts];
            const newIndex = this.data.currentEventPostIndex + 1;
            
            this.setData({
              eventPosts: updatedPosts,
              currentEventPostIndex: newIndex,
              currentPost: updatedPosts[newIndex],
              totalPosts: updatedPosts.length,
              hasMoreEventPosts: res.data.has_more || false,
              isLoading: false,
            });
          } else {
            this.setData({
              hasMoreEventPosts: false,
              isLoading: false,
            });
            wx.showToast({
              title: this.data.messages.navigation.lastPost,
              icon: "none",
            });
          }
        } else {
          this.setData({ isLoading: false });
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        }
      },
      fail: () => {
        this.setData({ isLoading: false });
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
    });
  },
});
