const { default: config } = require("../../config");
const app = getApp();

Page({
  data: {
    // Post information
    postId: null,
    userId: null,
    eventId: null,
    isEventExpired: false,
    type: "discover",
    filter: "",
    search: "",
    universityId: "",
    
    // Source page for navigation context
    sourcePage: "discover",
    
    // Swiper infinite scroll data
    posts: [], // Array of posts for swiper
    currentIndex: 1, // Start at middle (index 1)
    isLoadingNext: false,
    isLoadingPrev: false,
    
    // Loading states
    isLoading: false,
    hasError: false,
    errorMessage: "",
    hasLoadedOnce: false,
    
    // User state
    userInfo: null,
    showLoginModal: false,
    
    // Global auto-continue state
    globalIsContinue: false,
    
    // Flag to prevent swiper bounce back
    isAutoAdvancing: false,
    
    // WeChat Doc: Global media state tracking for Android
    activeMediaIndex: -1,
    
    // Removed caches - let components handle their own loading
    
    // UI messages (Chinese for user interface)
    messages: {
      loading: "加载中...",
      loadFailed: "加载失败",
      networkError: "网络错误",
      noPostFound: "帖子不存在",
      firstPost: "已经是第一个作品了",
      lastPost: "已经是最后一个作品了",
      noPostId: "帖子ID不能为空",
    },
  },

  onLoad: function(options) {
    const postId = options.postId;
    const userId = options.user_id;
    const eventId = options.eventId || options.event_id;
    const isEventExpired = options.isEventExpired === 'true';
    const type = options.type || "discover";
    const filter = options.filter || "";
    const search = options.search || "";
    const universityId = options.university_id || "";
    const source = options.source || ""; // Add source parameter
    
    if (!postId) {
      this.showError(this.data.messages.noPostId);
      return;
    }
    
    // Determine source page based on parameters
    let sourcePage = "index"; // default (discover page is "index" in app-layout)
    
    // Check source parameter first (explicit source takes priority)
    if (source) {
      sourcePage = source;
    } else {
      // Map post types to app-layout page keys
      switch(type) {
        case "recommend":
          sourcePage = "recommend";
          break;
        case "discover":
          sourcePage = "index";
          break;
        case "user":
        case "by_user_id":
          sourcePage = "me"; // user profile posts
          break;
        case "event":
        case "by_event_id":
          sourcePage = "event";
          break;
        case "company":
          sourcePage = "company";
          break;
        case "follow":
          sourcePage = "follow";
          break;
        case "like":
        case "liked":
        case "favorite":
        case "history":
        case "me":
          sourcePage = "me";
          break;
        default:
          // Check parameters for additional context
          if (userId) {
            sourcePage = "me";
          } else if (eventId) {
            sourcePage = "event";
          } else if (search) {
            sourcePage = "index"; // search results come from discover (index)
          } else {
            sourcePage = "index"; // fallback to discover
          }
      }
    }
    
    
    // Set initial data
    this.setData({
      postId: postId,
      userId: userId || null,
      eventId: eventId || null,
      isEventExpired: isEventExpired,
      type: type,
      filter: filter,
      search: search,
      universityId: universityId,
      sourcePage: sourcePage,
      userInfo: app.globalData.userInfo || null,
      showLoginModal: app.globalData.showLoginModal || false,
    });
    
    // Subscribe to global events
    this.subscribeToGlobalEvents();
    
    // Initialize with current post
    this.initializeInfiniteScroll(postId);
  },

  onShow: function() {
    // Only reload if no posts exist
    if (this.data.posts.length === 0 && !this.data.isLoading && this.data.postId) {
      this.initializeInfiniteScroll(this.data.postId);
    }
  },

  onUnload: function() {
    // Stop all posts when leaving the page
    const { posts } = this.data;
    posts.forEach((post, index) => {
      this.stopPostAtIndex(index);
    });
    
    // No cache to clear
    
    this.unsubscribeFromGlobalEvents();
  },
  
  onHide: function() {
    
    // WeChat Doc: Complete media cleanup on page hide
    const { posts } = this.data;
    const systemInfo = wx.getSystemInfoSync();
    const isAndroid = systemInfo.platform === 'android';
    
    // Android: More aggressive cleanup
    if (isAndroid) {
      // Force stop background audio first
      try {
        wx.stopBackgroundAudio();
      } catch (error) {
      }
      
      // Stop all posts with extra cleanup
      posts.forEach((post, index) => {
        this.stopPostAtIndex(index);
        
        // Additional cleanup for Android
        setTimeout(() => {
          const mediaPlayer = this.selectComponent(`#media-player-${index}`);
          if (mediaPlayer) {
            const mediaDisplay = mediaPlayer.selectComponent('.media-display');
            if (mediaDisplay && mediaDisplay.destroyVideoContext) {
              mediaDisplay.destroyVideoContext();
            }
          }
        }, 100);
      });
    } else {
      // iOS: Normal cleanup
      posts.forEach((post, index) => {
        this.stopPostAtIndex(index);
      });
    }
    
    // Reset global media state
    this.setData({ activeMediaIndex: -1 });
  },

  // Initialize infinite scroll with current, previous, and next posts
  initializeInfiniteScroll: async function(postId) {
    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true,
      hasError: false,
      posts: []
    });
    
    // Show loading only for initial load
    const app = getApp();
    app.showGlobalLoading('加载中...');

    try {
      // Load current post with neighbors
      const data = await this.loadPostWithNeighbors(postId);
      
      if (data && data.current) {
        // Build initial posts array [prev, current, next]
        const posts = [];
        
        // Add previous if exists
        if (data.previous) {
          posts.push(data.previous);
        }
        
        // Add current (always exists)
        posts.push(data.current);
        
        // Add next if exists  
        if (data.next) {
          posts.push(data.next);
        }
        
        // Determine current index based on what's available
        let currentIndex = 0;
        if (data.previous) {
          currentIndex = 1; // Current is at index 1 if previous exists
        }
        
        this.setData({
          posts: posts,
          currentIndex: currentIndex,
          isLoading: false,
          hasLoadedOnce: true
        });
        
        // Hide loading after initial load
        app.hideGlobalLoading();
        
        // No preloading - let components handle their own loading
        
        // Initialize all loaded posts immediately for instant rendering
        wx.nextTick(() => {
          // Initialize all posts so they're ready before swiping
          // Media players will initialize themselves via post property observer
          // No need to call loadPost manually
          
          // Set activeMediaIndex for current post
          this.setData({ activeMediaIndex: currentIndex });
        });
      } else {
        app.hideGlobalLoading();
        this.showError(this.data.messages.noPostFound);
      }
    } catch (error) {
      const app = getApp();
      app.hideGlobalLoading();
      this.showError(this.data.messages.networkError);
    }
  },

  // Load post with its neighbors
  loadPostWithNeighbors: function(postId) {
    return new Promise((resolve, reject) => {
      const apiParams = { 
        type: this.data.type 
      };
      
      if (this.data.userId) apiParams.user_id = this.data.userId;
      if (this.data.eventId) apiParams.event_id = this.data.eventId;
      if (this.data.filter) apiParams.filter = this.data.filter;
      if (this.data.search) apiParams.search = this.data.search;
      if (this.data.universityId) apiParams.university_id = this.data.universityId;
      
      const requestHeaders = {
        "Content-Type": "application/json"
      };
      
      if (this.data.userInfo && this.data.userInfo.token) {
        requestHeaders.Authorization = `Bearer ${this.data.userInfo.token}`;
      }
      
      wx.request({
        url: `${config.BACKEND_URL}/v2/post/detail/${postId}`,
        method: "GET",
        data: apiParams,
        header: requestHeaders,
        success: (response) => {
          if (response.statusCode === 200 && response.data.status === "success") {
            // Clean media URLs for all posts
            const cleanPost = (post) => {
              if (!post) return post;
              if (post.media && Array.isArray(post.media)) {
                post.media = post.media.map(item => {
                  if (item && item.url) {
                    // Remove #devtools_no_referrer and any other hash fragments
                    const cleanUrl = item.url.split('#')[0];
                    return { ...item, url: cleanUrl };
                  }
                  return item;
                });
              }
              return post;
            };
            
            resolve({
              current: cleanPost(response.data.current || response.data.post),
              next: cleanPost(response.data.next),
              previous: cleanPost(response.data.previous)
            });
          } else {
            reject(new Error(response.data?.message || "Failed to load"));
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
    const { posts, isAutoAdvancing } = this.data;
    
    if (newIndex === oldIndex) return;
    
    // Prevent rapid swiping - throttle swipe events
    const now = Date.now();
    if (this._lastSwipeTime && (now - this._lastSwipeTime) < 500) {
      // Too fast - ignore this swipe
      return;
    }
    this._lastSwipeTime = now;
    
    // If we're auto-advancing, don't do anything here
    // The state has already been updated
    if (isAutoAdvancing) {
      // Reset the flag after a short delay
      setTimeout(() => {
        this.setData({ isAutoAdvancing: false });
      }, 500);
      return;
    }
    
    // Update current index
    this.setData({ currentIndex: newIndex });
    
    // Initialize current media player only
    // Media player will update itself via post property observer
    // No need to manually call loadPost
    
    // Load more posts if needed - preload when approaching edges
    if (newIndex <= 1 && oldIndex > newIndex) {
      // Moving backwards and approaching the beginning
      this.loadPreviousPost();
    } else if (newIndex >= posts.length - 2 && newIndex > oldIndex) {
      // Moving forward and approaching the end
      this.loadNextPost();
    }
  },
  
  // Removed all preload methods - keep it simple

  // Load previous post for infinite scroll
  loadPreviousPost: async function() {
    if (this.data.isLoadingPrev) return;
    
    const { posts, currentIndex } = this.data;
    // Use the first post in array to get its previous, not current post
    const firstPost = posts[0];
    
    // Check if first post exists
    if (!firstPost || !firstPost.id) return;
    
    this.setData({ isLoadingPrev: true });
    
    try {
      // Load the previous post's data from the first post in array
      const data = await this.loadPostWithNeighbors(firstPost.id);
      
      if (data && data.previous) {
        // Check if the previous post is already in the array to prevent loops
        const existingPostIds = posts.map(post => post.id);
        if (existingPostIds.includes(data.previous.id)) {
          // Already have this post in the array, don't add again
          this.setData({ isLoadingPrev: false });
          return;
        }
        
        // Add previous post to beginning of array
        const newPosts = [data.previous, ...posts];
        
        // Keep array size manageable (max 10 posts) - increased to prevent destruction
        if (newPosts.length > 10) {
          newPosts.pop(); // Remove last post
        }
        
        // First update posts array
        this.setData({
          posts: newPosts,
          currentIndex: currentIndex + 1, // Adjust index since we added at beginning
          isLoadingPrev: false
        }, () => {
          // Initialize the new post immediately after DOM update
          // Media player will initialize itself via post property observer
        });
      } else {
        // This should rarely happen now with loop navigation
        wx.showToast({
          title: this.data.messages.firstPost,
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
    
    const { posts, currentIndex } = this.data;
    // Use the last post in array to get its next, not current post
    const lastPost = posts[posts.length - 1];
    
    if (!lastPost || !lastPost.id) return;
    
    this.setData({ isLoadingNext: true });
    
    try {
      // Load the next post's data from the last post in array
      const data = await this.loadPostWithNeighbors(lastPost.id);
      
      if (data && data.next) {
        // Check if the next post is already in the array to prevent loops
        const existingPostIds = posts.map(post => post.id);
        if (existingPostIds.includes(data.next.id)) {
          // Already have this post in the array, don't add again
          this.setData({ isLoadingNext: false });
          return;
        }
        
        // Add next post to end of array
        const newPosts = [...posts, data.next];
        
        // Keep array size manageable (max 10 posts) - increased to prevent destruction
        if (newPosts.length > 10) {
          newPosts.shift(); // Remove first post
          // Adjust current index since we removed from beginning
          this.setData({
            posts: newPosts,
            currentIndex: currentIndex - 1,
            isLoadingNext: false
          }, () => {
            // Initialize the new post immediately
            wx.nextTick(() => {
              // Media player will initialize itself via post property observer
            });
          });
        } else {
          this.setData({
            posts: newPosts,
            isLoadingNext: false
          }, () => {
            // Initialize the new post immediately
            wx.nextTick(() => {
              // Media player will initialize itself via post property observer
            });
          });
        }
      } else {
        // This should rarely happen now with loop navigation
        wx.showToast({
          title: this.data.messages.lastPost,
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
    const { isAutoAdvancing } = this.data;
    
    // Reset auto-advancing flag after animation completes
    if (isAutoAdvancing) {
      this.setData({ isAutoAdvancing: false });
    }
    
    // Clean up posts array if needed after animation completes
    const { posts, currentIndex } = this.data;
    
    // Maintain a window of 10 posts maximum for performance
    if (posts.length > 10) {
      let newPosts = [...posts];
      let newIndex = currentIndex;
      
      // Remove posts that are too far from current position
      if (currentIndex > 7) {
        // Remove from beginning
        newPosts = newPosts.slice(-10);
        newIndex = currentIndex - (posts.length - 10);
      } else if (currentIndex < 3 && posts.length > 10) {
        // Remove from end
        newPosts = newPosts.slice(0, 10);
      }
      
      if (newPosts.length !== posts.length) {
        this.setData({
          posts: newPosts,
          currentIndex: newIndex
        });
      }
    }
  },

  // Subscribe to global application events
  subscribeToGlobalEvents: function() {
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    
    this.loginModalHandler = (showLoginModal) => {
      this.setData({ showLoginModal });
    };
    
    app.subscribe("userInfo", this.userInfoHandler);
    app.subscribe("showLoginModal", this.loginModalHandler);
  },

  // Unsubscribe from global application events
  unsubscribeFromGlobalEvents: function() {
    if (this.userInfoHandler) {
      app.unsubscribe("userInfo", this.userInfoHandler);
    }
    if (this.loginModalHandler) {
      app.unsubscribe("showLoginModal", this.loginModalHandler);
    }
  },

  // Display error message to user
  showError: function(message) {
    this.setData({
      hasError: true,
      errorMessage: message,
      isLoading: false,
    });
  },

  // Retry loading
  onRetry: function() {
    if (this.data.postId) {
      this.initializeInfiniteScroll(this.data.postId);
    } else {
      wx.navigateBack();
    }
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
  
  /**
   * Stop a specific post at given index
   */
  stopPostAtIndex: function(index) {
    const systemInfo = wx.getSystemInfoSync();
    const isAndroid = systemInfo.platform === 'android';
    
    
    const mediaPlayer = this.selectComponent(`#media-player-${index}`);
    if (mediaPlayer) {
      // Force set playing state to false
      mediaPlayer.setData({
        internalIsPlaying: false,
        actualIsPlaying: false
      });
      
      // Pause the media player
      if (mediaPlayer.pauseMedia) {
        mediaPlayer.pauseMedia();
      }
      
      // Get media-display component and stop all media
      const mediaDisplay = mediaPlayer.selectComponent('.media-display');
      if (mediaDisplay) {
        if (isAndroid) {
          // Android: Aggressive cleanup sequence
          
          // Step 1: Immediate audio destruction
          if (mediaDisplay.destroyUploadedAudio) {
            mediaDisplay.destroyUploadedAudio();
          }
          
          // Step 2: Multiple video stop attempts with escalating delays
          if (mediaDisplay.stopVideo) {
            mediaDisplay.stopVideo(); // Immediate attempt
            
            // One additional attempt for Android reliability
            setTimeout(() => {
              if (mediaDisplay.stopVideo) {
                mediaDisplay.stopVideo();
              }
            }, 100);
          }
          
          // Step 3: Global audio cleanup attempts
          setTimeout(() => {
            try {
              wx.stopBackgroundAudio();
            } catch (bgError) {
            }
            
            try {
              const bgAudioManager = wx.getBackgroundAudioManager();
              if (bgAudioManager) {
                bgAudioManager.stop();
                bgAudioManager.src = '';
              }
            } catch (bgManagerError) {
            }
          }, 200);
          
        } else {
          // iOS: Standard cleanup
          if (mediaDisplay.stopVideo) {
            mediaDisplay.stopVideo();
          }
          
          if (mediaDisplay.destroyUploadedAudio) {
            mediaDisplay.destroyUploadedAudio();
          }
        }
      }
    }
    
  },
  
  /**
   * Stop all posts except the currently active one
   */
  stopAllPostsExceptCurrent: function(currentIndex) {
    const { posts } = this.data;
    
    
    posts.forEach((post, index) => {
      if (index !== currentIndex) {
        const mediaPlayer = this.selectComponent(`#media-player-${index}`);
        if (mediaPlayer) {
          // Pause the media player
          if (mediaPlayer.pauseMedia) {
            mediaPlayer.pauseMedia();
          }
          
          // Get media-display component and stop all media
          const mediaDisplay = mediaPlayer.selectComponent('.media-display');
          if (mediaDisplay) {
            // WeChat Doc: Use centralized video management to prevent conflicts
            
            // Use media-display's centralized video control
            if (mediaDisplay.stopVideo) {
              mediaDisplay.stopVideo();
            }
            
            // Destroy audio components
            if (mediaDisplay.destroyUploadedAudio) {
              mediaDisplay.destroyUploadedAudio();
            }
          }
        }
      }
    });
    
    
    // Android-specific: Global audio cleanup using WeChat API
    const systemInfo = wx.getSystemInfoSync();
    if (systemInfo.platform === 'android') {
      // WeChat Doc: Stop all background audio to prevent overlap
      try {
        wx.stopBackgroundAudio();
      } catch (error) {
        // Background audio API might not be available
      }
      
      // Additional cleanup delay for Android
      setTimeout(() => {
      }, 200);
    }
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
      // Set flag to prevent bounce back
      this.setData({ 
        isAutoAdvancing: true,
        currentIndex: currentIndex + 1 
      });
      
      // Load more posts if needed
      if (currentIndex === posts.length - 2) {
        this.loadNextPost();
      }
    } else {
      // At last post, try to load more
      this.loadNextPost();
    }
  },

  handleImageSlideEnded: function(e) {
    const { currentIndex, posts } = this.data;
    
    if (currentIndex < posts.length - 1) {
      // Set flag to prevent bounce back
      this.setData({ 
        isAutoAdvancing: true,
        currentIndex: currentIndex + 1 
      });
      
      // Load more posts if needed
      if (currentIndex === posts.length - 2) {
        this.loadNextPost();
      }
    } else {
      // At last post, try to load more
      this.loadNextPost();
    }
  },

  handleContinueToggled: function(e) {
    this.setData({ globalIsContinue: e.detail.value });
    
    // Update all media players with new continue value
    const { posts } = this.data;
    posts.forEach((post, index) => {
      const mediaPlayer = this.selectComponent(`#media-player-${index}`);
      if (mediaPlayer) {
        mediaPlayer.setData({ isContinue: e.detail.value });
      }
    });
  }
});