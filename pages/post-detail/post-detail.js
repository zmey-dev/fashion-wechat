import config from "../../config";
const postCacheService = require('../../services/postCache');
const postPreloaderService = require('../../services/postPreloader');
const mediaPreloaderService = require('../../services/mediaPreloader');
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

    // Initialize global config for services
    if (!app.globalData.config) {
      app.globalData.config = config;
    }

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
    
    // Load post using enhanced caching and preloading
    if (postId) {
      const requestOptions = {};
      if (userId) requestOptions.user_id = userId;
      if (eventId) requestOptions.event_id = eventId;
      if (filter) requestOptions.filter = filter;
      this.loadPostDetailWithCaching(postId, type, requestOptions);
    } else {
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: "No post ID provided",
      });
    }
  },
  onShow: function () {
    // Only reload if we don't have current post data (avoids unnecessary reloads during navigation)
    if(this.data.postId && !this.data.currentPost) {
      const options = {};
      if (this.data.userId) options.user_id = this.data.userId;
      if (this.data.eventId) options.event_id = this.data.eventId;
      if (this.data.filter) options.filter = this.data.filter;
      this.loadPostDetailWithCaching(this.data.postId, this.data.type, options);
    }
  },
  onUnload: function () {
    const app = getApp();
    // Unsubscribe from state changes
    app.unsubscribe("userInfo", this.userInfoHandler);
    app.unsubscribe("showLoginModal", this.showLoginModalHandler);
    app.unsubscribe("followedUser", this.followedUserHandler);
  },

  // Enhanced post loading with caching and preloading
  loadPostDetailWithCaching: async function (postId, type, options = {}) {
    this.setData({
      isLoading: true,
      loadError: false,
    });

    try {
      // Try to get from cache first
      let cachedData = postCacheService.getPost(postId, type, options);
      
      if (cachedData) {
        await this.handlePostDataLoaded(cachedData, true);
        
        // Notify media player of post change for TikTok-style transition
        const mediaPlayer = this.selectComponent('#media-player');
        if (mediaPlayer && mediaPlayer.onPostChanged) {
          mediaPlayer.onPostChanged();
        }
      } else {
        const data = await this.fetchPostFromAPI(postId, type, options);
        if (data) {
          // Cache the data
          postCacheService.setPost(postId, type, data, options);
          await this.handlePostDataLoaded(data, false);
        }
      }
    } catch (error) {
      console.error("Failed to load post detail:", error);
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: this.data.messages.errors.networkError,
      });
    }
  },

  // Fetch post from API (extracted for reusability)
  fetchPostFromAPI: function (postId, type, options = {}) {
    return new Promise((resolve, reject) => {
      // Build query parameters
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
            resolve(res.data);
          } else {
            reject(new Error(res.data?.msg || this.data.messages.errors.loadFailed));
          }
        },
        fail: (err) => {
          reject(err);
        },
      });
    });
  },

  // Handle loaded post data with media preloading
  handlePostDataLoaded: async function (data, fromCache = false, keepLoading = false) {
    
    // Support both new and old API formats with detailed logging
    const post = data.current || data.post;
    
    // NEW: Backend now returns full post objects instead of just IDs
    const next_post = data.next || data.next_post || null;
    const previous_post = data.previous || data.previous_post || null;
    
    // Extract IDs from full post objects (NEW format)
    let next_post_id = null;
    let previous_post_id = null;
    
    if (next_post && typeof next_post === 'object') {
      next_post_id = next_post.id;
    } else if (data.next_post_id) {
      // Fallback to old format
      next_post_id = data.next_post_id;
    }
    
    if (previous_post && typeof previous_post === 'object') {
      previous_post_id = previous_post.id;
    } else if (data.previous_post_id) {
      // Fallback to old format
      previous_post_id = data.previous_post_id;
    }
    
    
    // Additional validation check
    if (next_post && !next_post_id) {
      console.warn('[PostDetail] WARNING: next_post exists but next_post_id is null!', next_post);
    }
    if (previous_post && !previous_post_id) {
      console.warn('[PostDetail] WARNING: previous_post exists but previous_post_id is null!', previous_post);
    }
    
    // Update UI with post data
    this.setData({
      currentPost: post,
      nextPostId: next_post_id,
      previousPostId: previous_post_id,
      isLoading: keepLoading ? true : false,  // Keep loading if specified
    });
    
    // Only notify media player of API completion if not keeping loading state
    if (!keepLoading) {
      const mediaPlayer = this.selectComponent('#media-player');
      if (mediaPlayer) {
        if (mediaPlayer.onApiLoadComplete) {
          mediaPlayer.onApiLoadComplete();
        } else {
        }
      } else {
      }
    }

    // Update preloader context with new API format (full post objects)
    postPreloaderService.setCurrentPost(post.id, this.data.type, {
      user_id: this.data.userId,
      event_id: this.data.eventId,
      filter: this.data.filter
    }, {
      next_post_id,
      previous_post_id,
      next_post: next_post,  // Full post object (NEW format)
      previous_post: previous_post  // Full post object (NEW format)
    }, post);  // Pass current post data to preloader

    // Note: All media preloading (including current post) is now handled by PostPreloaderService
    // to ensure centralized management and prevent duplicates. The setCurrentPost call above
    // handles all media preloading through the postPreloader service to avoid duplication.
  },

  // Start background preloading of next/previous posts
  startBackgroundPreloading: async function () {
    try {
      const promises = [];
      
      // Preload next post if available
      if (this.data.nextPostId) {
        promises.push(this.preloadPostAndMedia(this.data.nextPostId, 'next'));
      }
      
      // Preload previous post if available
      if (this.data.previousPostId) {
        promises.push(this.preloadPostAndMedia(this.data.previousPostId, 'previous'));
      }
      
      await Promise.allSettled(promises);
    } catch (error) {
      console.warn('[PostDetail] Background preloading failed:', error);
    }
  },

  // Preload specific post and its media
  preloadPostAndMedia: async function (postId, direction) {
    try {
      const options = {
        user_id: this.data.userId,
        event_id: this.data.eventId,
        filter: this.data.filter
      };
      
      // Check if post is already cached
      let cachedPost = postCacheService.getPost(postId, this.data.type, options);
      
      if (!cachedPost) {
        // Fetch and cache post data
        const data = await this.fetchPostFromAPI(postId, this.data.type, options);
        if (data) {
          postCacheService.setPost(postId, this.data.type, data, options);
          cachedPost = data;
        }
      }
      
      // Media preloading is handled by PostPreloaderService to avoid duplicates
      
      // Note: Media preloading is handled when the post data is set via
      // PostPreloaderService.setCurrentPost() to ensure no duplicates
    } catch (error) {
      console.warn(`[PostDetail] Failed to preload ${direction} post:`, error);
    }
  },

  // Legacy method for backward compatibility
  loadPostDetail: function (postId, type, options = {}) {
    return this.loadPostDetailWithCaching(postId, type, options);
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

  handlePreviousPost: async function () {
    
    if (!this.data.previousPostId) {
      wx.showToast({
        title: this.data.messages.navigation.firstPost,
        icon: "none",
      });
      return;
    }

    try {
      const targetPostId = this.data.previousPostId;
      
      
      // Set loading state
      this.setData({ isLoading: true });
      
      // Try to get from preloader cache first
      const cachedData = await postPreloaderService.getPreviousPost();
      
      if (cachedData) {
        // Update post ID
        this.setData({ postId: targetPostId });
        
        // Check if it's a video post
        const post = cachedData.current || cachedData.post;
        const isVideoPost = post && post.type === 'video';
        
        // For video posts, don't keep loading state since we have full data
        await this.handlePostDataLoaded(cachedData, true, !isVideoPost); // Only keep loading for image posts
        
        // Notify media player of post change for TikTok-style transition
        const mediaPlayer = this.selectComponent('#media-player');
        if (mediaPlayer && mediaPlayer.onPostChanged) {
          mediaPlayer.onPostChanged();
        }
        
        // Only fetch background context for image posts that need it
        if (!isVideoPost) {
          // IMPORTANT: Fetch full navigation context in background to enable further navigation
          const options = {};
          if (this.data.userId) options.user_id = this.data.userId;
          if (this.data.eventId) options.event_id = this.data.eventId;
          if (this.data.filter) options.filter = this.data.filter;
          
          // Background API call to get full post with navigation data
          this.fetchPostFromAPI(targetPostId, this.data.type, options)
            .then(fullData => {
              // Update only navigation context without affecting UI
              this.updateNavigationContext(fullData);
              // Now hide loading state after API completes
              this.setData({ isLoading: false });
              // Notify media player that API is now complete
              const mp = this.selectComponent('#media-player');
              if (mp && mp.onApiLoadComplete) {
                mp.onApiLoadComplete();
              }
            })
            .catch(error => {
              console.warn('[PostDetail] Failed to load background navigation context:', error);
              // Hide loading state even on error
              this.setData({ isLoading: false });
            });
        } else {
          // For video posts, we still need navigation context even though we don't need to wait
          const options = {};
          if (this.data.userId) options.user_id = this.data.userId;
          if (this.data.eventId) options.event_id = this.data.eventId;
          if (this.data.filter) options.filter = this.data.filter;
          
          // Background API call to get navigation context for video posts too
          this.fetchPostFromAPI(targetPostId, this.data.type, options)
            .then(fullData => {
              // Update navigation context
              this.updateNavigationContext(fullData);
            })
            .catch(error => {
              console.warn('[PostDetail] Failed to load navigation context for video post:', error);
            });
          
          // Immediately notify API complete for video playback
          if (mediaPlayer && mediaPlayer.onApiLoadComplete) {
            mediaPlayer.onApiLoadComplete();
          }
        }
      } else {
        // Update post ID and load from API
        this.setData({ postId: targetPostId });
        const options = {};
        if (this.data.userId) options.user_id = this.data.userId;
        if (this.data.eventId) options.event_id = this.data.eventId;
        if (this.data.filter) options.filter = this.data.filter;
        await this.loadPostDetailWithCaching(targetPostId, this.data.type, options);
      }
    } catch (error) {
      console.error('[PostDetail] Failed to navigate to previous post:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: this.data.messages.errors.loadFailed,
        icon: "none",
      });
    }
  },

  handleNextPost: async function () {
    
    if (!this.data.nextPostId) {
      wx.showToast({
        title: this.data.messages.navigation.lastPost,
        icon: "none",
      });
      return;
    }

    try {
      const targetPostId = this.data.nextPostId;
      
      
      // Set loading state
      this.setData({ isLoading: true });
      
      // Try to get from preloader cache first
      const cachedData = await postPreloaderService.getNextPost();
      
      if (cachedData) {
        // Update post ID
        this.setData({ postId: targetPostId });
        
        // Check if it's a video post
        const post = cachedData.current || cachedData.post;
        const isVideoPost = post && post.type === 'video';
        
        // For video posts, don't keep loading state since we have full data
        await this.handlePostDataLoaded(cachedData, true, !isVideoPost); // Only keep loading for image posts
        
        // Notify media player of post change for TikTok-style transition
        const mediaPlayer = this.selectComponent('#media-player');
        if (mediaPlayer && mediaPlayer.onPostChanged) {
          mediaPlayer.onPostChanged();
        }
        
        // Only fetch background context for image posts that need it
        if (!isVideoPost) {
          // IMPORTANT: Fetch full navigation context in background to enable further navigation
          const options = {};
          if (this.data.userId) options.user_id = this.data.userId;
          if (this.data.eventId) options.event_id = this.data.eventId;
          if (this.data.filter) options.filter = this.data.filter;
          
          // Background API call to get full post with navigation data
          this.fetchPostFromAPI(targetPostId, this.data.type, options)
            .then(fullData => {
              // Update only navigation context without affecting UI
              this.updateNavigationContext(fullData);
              // Now hide loading state after API completes
              this.setData({ isLoading: false });
              // Notify media player that API is now complete
              const mp = this.selectComponent('#media-player');
              if (mp && mp.onApiLoadComplete) {
                mp.onApiLoadComplete();
              }
            })
            .catch(error => {
              console.warn('[PostDetail] Failed to load background navigation context:', error);
              // Hide loading state even on error
              this.setData({ isLoading: false });
            });
        } else {
          // For video posts, we still need navigation context even though we don't need to wait
          const options = {};
          if (this.data.userId) options.user_id = this.data.userId;
          if (this.data.eventId) options.event_id = this.data.eventId;
          if (this.data.filter) options.filter = this.data.filter;
          
          // Background API call to get navigation context for video posts too
          this.fetchPostFromAPI(targetPostId, this.data.type, options)
            .then(fullData => {
              // Update navigation context
              this.updateNavigationContext(fullData);
            })
            .catch(error => {
              console.warn('[PostDetail] Failed to load navigation context for video post:', error);
            });
          
          // Immediately notify API complete for video playback
          if (mediaPlayer && mediaPlayer.onApiLoadComplete) {
            mediaPlayer.onApiLoadComplete();
          }
        }
      } else {
        // Update post ID and load from API
        this.setData({ postId: targetPostId });
        const options = {};
        if (this.data.userId) options.user_id = this.data.userId;
        if (this.data.eventId) options.event_id = this.data.eventId;
        if (this.data.filter) options.filter = this.data.filter;
        await this.loadPostDetailWithCaching(targetPostId, this.data.type, options);
      }
    } catch (error) {
      console.error('[PostDetail] Failed to navigate to next post:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: this.data.messages.errors.loadFailed,
        icon: "none",
      });
    }
  },

  // Update only navigation context without affecting current UI
  updateNavigationContext: function (data) {
    
    // NEW: Backend now returns full post objects instead of just IDs
    const next_post = data.next || data.next_post || null;
    const previous_post = data.previous || data.previous_post || null;
    
    // Extract IDs from full post objects (NEW format)
    let next_post_id = null;
    let previous_post_id = null;
    
    if (next_post && typeof next_post === 'object') {
      next_post_id = next_post.id;
    } else if (data.next_post_id) {
      // Fallback to old format
      next_post_id = data.next_post_id;
    }
    
    if (previous_post && typeof previous_post === 'object') {
      previous_post_id = previous_post.id;
    } else if (data.previous_post_id) {
      // Fallback to old format
      previous_post_id = data.previous_post_id;
    }
    
    
    // Additional validation check  
    if (next_post && !next_post_id) {
      console.warn('[PostDetail] WARNING: next_post exists but next_post_id is null in updateNavigationContext!', next_post);
    }
    if (previous_post && !previous_post_id) {
      console.warn('[PostDetail] WARNING: previous_post exists but previous_post_id is null in updateNavigationContext!', previous_post);
    }
    
    // Update navigation IDs silently
    this.setData({
      nextPostId: next_post_id,
      previousPostId: previous_post_id,
    });

    // Update preloader context with new navigation data (full post objects)
    postPreloaderService.setCurrentPost(this.data.postId, this.data.type, {
      user_id: this.data.userId,
      event_id: this.data.eventId,
      filter: this.data.filter
    }, {
      next_post_id,
      previous_post_id,
      next_post: next_post,  // Full post object (NEW format)
      previous_post: previous_post  // Full post object (NEW format)
    }, null);  // No current post data needed for navigation context update

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
