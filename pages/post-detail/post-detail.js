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
    
    // WeChat Doc: Global media state tracking for Android
    activeMediaIndex: -1,
    
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
    
    this.unsubscribeFromGlobalEvents();
  },
  
  onHide: function() {
    console.log('[Page Hide] Stopping all media for page hide');
    
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
        console.warn('Background audio stop failed:', error);
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
        
        // Immediately ensure only current post can load media
        setTimeout(() => {
          console.log(`[Post Detail] Setting up posts - current index: ${currentIndex}`);
          
          // Force all posts to respect their playing state
          posts.forEach((post, index) => {
            const mediaPlayer = this.selectComponent(`#media-player-${index}`);
            if (mediaPlayer) {
              const isCurrentPost = index === currentIndex;
              console.log(`[Post Detail] Post ${index} - isCurrentPost: ${isCurrentPost}`);
              
              if (!isCurrentPost) {
                // Force non-current posts to stop completely
                this.stopPostAtIndex(index);
              }
            }
          });
          
          // CRITICAL: Set activeMediaIndex before starting current post
          this.setData({ activeMediaIndex: currentIndex });
          console.log(`[Post Detail] Set activeMediaIndex to: ${currentIndex}`);
          
          // Start the current post
          const currentMediaPlayer = this.selectComponent(`#media-player-${currentIndex}`);
          if (currentMediaPlayer && currentMediaPlayer.playMedia) {
            console.log(`[Post Detail] Starting current post: ${currentIndex}`);
            currentMediaPlayer.playMedia();
          }
        }, 300);
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
            resolve({
              current: response.data.current || response.data.post,
              next: response.data.next,
              previous: response.data.previous
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
    const { posts, activeMediaIndex } = this.data;
    
    console.log(`[Swiper Change] ${oldIndex} → ${newIndex}, activeMedia: ${activeMediaIndex}`);
    
    // Prevent redundant updates
    if (newIndex === oldIndex) return;
    
    // WeChat Doc: Strict media control with global state tracking
    const systemInfo = wx.getSystemInfoSync();
    const isAndroid = systemInfo.platform === 'android';
    
    // Step 1: Stop ALL media immediately, including previously active
    if (activeMediaIndex !== -1 && activeMediaIndex !== newIndex) {
      console.log(`[Android Media] Force stopping previously active: ${activeMediaIndex}`);
      this.stopPostAtIndex(activeMediaIndex);
    }
    
    // Step 2: Stop all other posts
    this.stopAllPostsExceptCurrent(newIndex);
    
    // Step 3: CRITICAL - Immediately claim the new index to prevent audio conflicts
    this.setData({ 
      currentIndex: newIndex,
      activeMediaIndex: newIndex  // Immediately set to prevent other posts from starting audio
    });
    
    console.log(`[Media Control] IMMEDIATELY claimed activeMediaIndex: ${newIndex}`);
    
    // Step 4: Start new media with minimal delay
    const startDelay = isAndroid ? 300 : 200;  // Reduced delays
    setTimeout(() => {
      // Double-check that we still own this index
      if (this.data.currentIndex === newIndex && this.data.activeMediaIndex === newIndex) {
        if (newIndex >= 0 && newIndex < posts.length) {
          const newMediaPlayer = this.selectComponent(`#media-player-${newIndex}`);
          if (newMediaPlayer && newMediaPlayer.playMedia) {
            console.log(`[Media Control] Starting media for confirmed active index ${newIndex}`);
            newMediaPlayer.playMedia();
          }
        }
      } else {
        console.log(`[Media Control] Index ownership changed during delay - aborting start`);
      }
    }, startDelay);
    
    // Check if we need to load more posts
    // posts variable already declared above
    
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
    
    // Check if current post has previous_post_id
    if (!currentPost || !currentPost.id) return;
    
    this.setData({ isLoadingPrev: true });
    
    try {
      // Load the previous post's data
      const data = await this.loadPostWithNeighbors(currentPost.id);
      
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
        
        // Keep array size manageable (max 5 posts)
        if (newPosts.length > 5) {
          newPosts.pop(); // Remove last post
        }
        
        this.setData({
          posts: newPosts,
          currentIndex: currentIndex + 1, // Adjust index since we added at beginning
          isLoadingPrev: false
        });
        
        // Stop the newly loaded previous post immediately
        setTimeout(() => {
          const newPostIndex = 0; // Previous post is at index 0
          this.stopPostAtIndex(newPostIndex);
        }, 100);
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
    const currentPost = posts[currentIndex];
    
    if (!currentPost || !currentPost.id) return;
    
    this.setData({ isLoadingNext: true });
    
    try {
      // Load the next post's data
      const data = await this.loadPostWithNeighbors(currentPost.id);
      
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
        
        // Keep array size manageable (max 5 posts)
        if (newPosts.length > 5) {
          newPosts.shift(); // Remove first post
          // Adjust current index since we removed from beginning
          this.setData({
            posts: newPosts,
            currentIndex: currentIndex - 1,
            isLoadingNext: false
          });
        } else {
          this.setData({
            posts: newPosts,
            isLoadingNext: false
          });
        }
        
        // Stop the newly loaded next post immediately
        setTimeout(() => {
          const newPostIndex = newPosts.length - 1;
          if (newPostIndex !== this.data.currentIndex) {
            this.stopPostAtIndex(newPostIndex);
          }
        }, 100);
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
    
    console.log(`[${systemInfo.platform} Page] Stopping post at index ${index}`);
    
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
          console.log(`[Android Page] Starting aggressive cleanup for post ${index}`);
          
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
              console.warn('Background audio stop error:', bgError);
            }
            
            try {
              const bgAudioManager = wx.getBackgroundAudioManager();
              if (bgAudioManager) {
                bgAudioManager.stop();
                bgAudioManager.src = '';
              }
            } catch (bgManagerError) {
              console.warn('Background audio manager error:', bgManagerError);
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
    
    console.log(`[${systemInfo.platform} Page] Completed stopping post at index ${index}`);
  },
  
  /**
   * Stop all posts except the currently active one
   */
  stopAllPostsExceptCurrent: function(currentIndex) {
    const { posts } = this.data;
    
    console.log(`[Post Detail] Stopping all posts except index ${currentIndex}`);
    
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
            console.log(`[Post Detail] Stopping video for post ${index} via media-display`);
            
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
    
    console.log(`[Post Detail] All posts except ${currentIndex} have been stopped`);
    
    // Android-specific: Global audio cleanup using WeChat API
    const systemInfo = wx.getSystemInfoSync();
    if (systemInfo.platform === 'android') {
      console.log('[Android Global] Performing additional media cleanup');
      
      // WeChat Doc: Stop all background audio to prevent overlap
      try {
        wx.stopBackgroundAudio();
      } catch (error) {
        // Background audio API might not be available
        console.warn('Background audio stop failed:', error);
      }
      
      // Additional cleanup delay for Android
      setTimeout(() => {
        console.log('[Android Global] Final cleanup completed');
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
      const newIndex = currentIndex + 1;
      
      // Pause ALL media players first
      posts.forEach((post, index) => {
        const mediaPlayer = this.selectComponent(`#media-player-${index}`);
        if (mediaPlayer && mediaPlayer.pauseMedia) {
          mediaPlayer.pauseMedia();
        }
      });
      
      this.setData({ currentIndex: newIndex });
      
      // Play the new current media player to maintain play state
      const newMediaPlayer = this.selectComponent(`#media-player-${newIndex}`);
      if (newMediaPlayer) {
        setTimeout(() => {
          newMediaPlayer.playMedia && newMediaPlayer.playMedia();
        }, 200);
      }
      
      if (currentIndex === posts.length - 2) {
        this.loadNextPost();
      }
    }
  },

  handleImageSlideEnded: function(e) {
    const { currentIndex, posts } = this.data;
    
    console.log('handleImageSlideEnded called', {
      currentIndex,
      totalPosts: posts.length,
      canAdvance: currentIndex < posts.length - 1
    });
    
    if (currentIndex < posts.length - 1) {
      const newIndex = currentIndex + 1;
      console.log('Advancing to next post:', newIndex);
      
      // Pause ALL media players first
      posts.forEach((post, index) => {
        const mediaPlayer = this.selectComponent(`#media-player-${index}`);
        if (mediaPlayer && mediaPlayer.pauseMedia) {
          mediaPlayer.pauseMedia();
        }
      });
      
      this.setData({ currentIndex: newIndex });
      
      // Play the new current media player to maintain play state
      const newMediaPlayer = this.selectComponent(`#media-player-${newIndex}`);
      if (newMediaPlayer) {
        setTimeout(() => {
          newMediaPlayer.playMedia && newMediaPlayer.playMedia();
        }, 200);
      }
      
      if (currentIndex === posts.length - 2) {
        console.log('Loading next post batch');
        this.loadNextPost();
      }
    } else {
      console.log('Already at last post, cannot advance');
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