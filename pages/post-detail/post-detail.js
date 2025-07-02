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
    userPosts: [],
    eventPosts: [],
    currentUserPostIndex: 0,
    currentEventPostIndex: 0,
    hasMoreEventPosts: true,

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
    const eventId = options.eventId || null;
    this.setData({
      postId: postId,
      userId: userId,
      eventId: eventId,
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
    if (eventId) {
      // If eventId is provided, load event's posts
      this.loadEventPosts(postId);
    } else if (userId) {
      // If user_id is provided, load user's posts
      this.loadUserPosts(postId);
    } else {
      // Otherwise, use the original logic
      if (postId) this.loadPostData(null, postId);
      else this.loadPostData(0);
    }
  },
  onShow: function () {
    if (this.data.eventId) {
      // If eventId is provided, reload event's posts
      this.loadEventPosts(this.data.postId);
    } else if (this.data.userId) {
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
    if (this.data.eventId) {
      // If viewing event's posts, navigate through eventPosts array
      if (this.data.currentEventPostIndex > 0) {
        const newIndex = this.data.currentEventPostIndex - 1;
        this.setData({
          currentEventPostIndex: newIndex,
          currentPost: this.data.eventPosts[newIndex],
        });
      } else {
        wx.showToast({
          title: this.data.messages.navigation.firstPost,
          icon: "none",
        });
      }
    } else if (this.data.userId) {
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
    if (this.data.eventId) {
      // If viewing event's posts, navigate through eventPosts array
      if (this.data.currentEventPostIndex < this.data.eventPosts.length - 1) {
        const newIndex = this.data.currentEventPostIndex + 1;
        this.setData({
          currentEventPostIndex: newIndex,
          currentPost: this.data.eventPosts[newIndex],
        });
      } else {
        // Load more event posts if available
        this.loadMoreEventPosts();
      }
    } else if (this.data.userId) {
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
