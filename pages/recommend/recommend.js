import config from "../../config";
const app = getApp();

Page({
  data: {
    currentPath: "recommend",
    showLoginModal: app.globalData.showLoginModal || false,
    userInfo: app.globalData.userInfo || {},
    followedUsers: app.globalData.followedUsers || [],
    
    // Swiper infinite scroll data
    posts: [], // Array of posts for swiper
    currentIndex: 0, // Start at first post
    isLoadingNext: false,
    isLoadingPrev: false,
    
    // Loading states
    isLoading: false,
    loadError: false,
    errorMessage: "",
    filterText: "",
    
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "内容加载失败",
        networkError: "网络错误，请稍后重试",
      },
      navigation: {
        firstPost: "已经是第一个作品了",
        lastPost: "已经是最后一个作品了",
      },
    },
  },

  onLoad: function (options) {
    const postId = options.postId || null;
    const filterText = options.filter || "";
    this.setData({
      filterText: filterText,
    });

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

    // Load initial posts for infinite scroll
    this.initializeInfiniteScroll(postId);
  },

  onShow: function () {
    // Only reload if no posts exist
    if (this.data.posts.length === 0 && !this.data.isLoading) {
      this.initializeInfiniteScroll();
    }
  },

  onUnload: function () {
    // Unsubscribe from state changes
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.showLoginModalHandler);
    app.unsubscribe("followedUser", this.followedUserHandler);
    
    // Clear posts
    this.setData({ posts: [] });
  },

  // Initialize infinite scroll with recommended posts
  initializeInfiniteScroll: async function(postId) {
    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true,
      loadError: false,
      posts: []
    });
    
    // Show loading only for initial load
    const app = getApp();
    app.showGlobalLoading('加载中...');

    try {
      if (postId) {
        // If specific postId provided, load it with neighbors
        const data = await this.loadPostWithNeighbors(postId);
        
        if (data && data.current) {
          const posts = [];
          if (data.previous) posts.push(data.previous);
          posts.push(data.current);
          if (data.next) posts.push(data.next);
          
          this.setData({
            posts: posts,
            currentIndex: data.previous ? 1 : 0,
            isLoading: false
          });
          
          // Hide loading after initial load
          app.hideGlobalLoading();
        }
      } else {
        // Load initial batch of recommended posts
        const posts = await this.loadRecommendedPosts(0, 3);
        
        if (posts && posts.length > 0) {
          this.setData({
            posts: posts,
            currentIndex: 0,
            isLoading: false
          });
          app.hideGlobalLoading();
        } else {
          this.setData({
            isLoading: false,
            loadError: true,
            errorMessage: this.data.messages.errors.loadFailed
          });
          app.hideGlobalLoading();
        }
      }
    } catch (error) {
      const app = getApp();
      app.hideGlobalLoading();
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: this.data.messages.errors.networkError
      });
    }
  },

  // Load recommended posts from API
  loadRecommendedPosts: function(offset, limit) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/v2/post/recommend`,
        method: "GET",
        data: {
          limit: limit,
          offset: offset,
          filter: this.data.filterText,
        },
        header: {
          "Content-Type": "application/json",
          Authorization: this.data.userInfo?.token
            ? `Bearer ${this.data.userInfo.token}`
            : "",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            resolve(res.data.posts || []);
          } else {
            reject(new Error(res.data?.msg || "Failed to load"));
          }
        },
        fail: reject
      });
    });
  },

  // Load post with its neighbors
  loadPostWithNeighbors: function(postId) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/v2/post/detail/${postId}`,
        method: "GET",
        data: { type: "recommend" },
        header: {
          "Content-Type": "application/json",
          Authorization: this.data.userInfo?.token
            ? `Bearer ${this.data.userInfo.token}`
            : "",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            resolve({
              current: res.data.current || res.data.post,
              next: res.data.next,
              previous: res.data.previous
            });
          } else {
            reject(new Error(res.data?.message || "Failed to load"));
          }
        },
        fail: reject
      });
    });
  },

  // Handle swiper change event
  onSwiperChange: function(e) {
    const newIndex = e.detail.current;
    const oldIndex = this.data.currentIndex;
    
    // Prevent redundant updates
    if (newIndex === oldIndex) return;
    
    this.setData({ currentIndex: newIndex });
    
    const { posts } = this.data;
    
    // Load previous posts when reaching first item
    if (newIndex === 0 && oldIndex > 0) {
      this.loadPreviousPost();
    }
    // Load next posts when reaching last item
    else if (newIndex === posts.length - 1 && newIndex > oldIndex) {
      this.loadNextPost();
    }
  },

  // Load previous post for infinite scroll
  loadPreviousPost: async function() {
    if (this.data.isLoadingPrev) return;
    
    const { posts, currentIndex } = this.data;
    const currentPost = posts[currentIndex];
    
    if (!currentPost || !currentPost.id) return;
    
    this.setData({ isLoadingPrev: true });
    
    try {
      // For recommend page, load more recommended posts
      const newPosts = await this.loadRecommendedPosts(posts.length, 1);
      
      if (newPosts && newPosts.length > 0) {
        // Add to beginning for previous navigation
        const updatedPosts = [...newPosts, ...posts];
        
        // Keep array size manageable (max 5 posts)
        if (updatedPosts.length > 5) {
          updatedPosts.pop();
        }
        
        this.setData({
          posts: updatedPosts,
          currentIndex: currentIndex + newPosts.length,
          isLoadingPrev: false
        });
      } else {
        wx.showToast({
          title: this.data.messages.navigation.firstPost,
          icon: 'none',
          duration: 1500
        });
        this.setData({ isLoadingPrev: false });
      }
    } catch (error) {
      this.setData({ isLoadingPrev: false });
    }
  },

  // Load next post for infinite scroll
  loadNextPost: async function() {
    if (this.data.isLoadingNext) return;
    
    const { posts } = this.data;
    
    this.setData({ isLoadingNext: true });
    
    try {
      // Load more recommended posts
      const newPosts = await this.loadRecommendedPosts(posts.length, 1);
      
      if (newPosts && newPosts.length > 0) {
        // Add to end
        const updatedPosts = [...posts, ...newPosts];
        
        // Keep array size manageable (max 5 posts)
        if (updatedPosts.length > 5) {
          updatedPosts.shift();
          // Adjust current index since we removed from beginning
          this.setData({
            posts: updatedPosts,
            currentIndex: this.data.currentIndex - 1,
            isLoadingNext: false
          });
        } else {
          this.setData({
            posts: updatedPosts,
            isLoadingNext: false
          });
        }
      } else {
        wx.showToast({
          title: this.data.messages.navigation.lastPost,
          icon: 'none',
          duration: 1500
        });
        this.setData({ isLoadingNext: false });
      }
    } catch (error) {
      this.setData({ isLoadingNext: false });
    }
  },

  // Animation finish handler
  onAnimationFinish: function(e) {
    // Clean up posts array if needed after animation completes
    const { posts, currentIndex } = this.data;
    
    // Maintain a window of 5 posts maximum for performance
    if (posts.length > 5) {
      let newPosts = [...posts];
      let newIndex = currentIndex;
      
      // Remove posts that are too far from current position
      if (currentIndex > 3) {
        // Remove from beginning
        newPosts = newPosts.slice(-5);
        newIndex = currentIndex - (posts.length - 5);
      } else if (currentIndex < 2 && posts.length > 5) {
        // Remove from end
        newPosts = newPosts.slice(0, 5);
      }
      
      if (newPosts.length !== posts.length) {
        this.setData({
          posts: newPosts,
          currentIndex: newIndex
        });
      }
    }
  },

  // Retry loading
  onRetry: function() {
    this.initializeInfiniteScroll();
  },

  // Event handlers from media player
  handlePostNavigation: function(e) {
    // Navigation is now handled by swiper
  },

  handleLikeUpdated: function(e) {
    // Update like status in posts array if needed
  },

  handleFavoriteUpdated: function(e) {
    // Update favorite status in posts array if needed
  },

  handleShareUpdated: function(e) {
    // Handle share update
  },

  handleFollowUpdated: function(e) {
    // Handle follow update
  },

  showLoginModal: function() {
    app.setState("showLoginModal", true);
  },

  navigateToUserProfile: function(e) {
    const { username } = e.detail;
    if (username) {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?username=${username}`
      });
    }
  },

  handleVideoEnded: function(e) {
    const { currentIndex, posts } = this.data;
    
    if (currentIndex < posts.length - 1) {
      this.setData({ currentIndex: currentIndex + 1 });
      
      if (currentIndex === posts.length - 2) {
        this.loadNextPost();
      }
    }
  }
});