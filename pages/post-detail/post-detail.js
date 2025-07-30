const { default: config } = require("../../config");
const app = getApp();

Page({
  data: {
    // Post information
    postId: null,
    userId: null,
    eventId: null,
    type: "discover",
    filter: "",
    
    // Post data
    post: null,
    nextPostId: null,
    previousPostId: null,
    
    // Pre-cached navigation posts for instant display
    nextPost: null,
    previousPost: null,
    
    // Loading states
    isLoading: false,
    hasError: false,
    errorMessage: "",
    isNavigating: false, // Separate flag for navigation loading
    hasLoadedOnce: false, // Flag to track if we've attempted to load data at least once
    
    // User state
    userInfo: null,
    showLoginModal: false,
    
    // Media loading flag to prevent duplicates
    mediaInitialized: false,
    
    // UI messages (Chinese for user interface)
    messages: {
      loading: "加载中...",
      loadFailed: "加载失败",
      networkError: "网络错误",
      noPostFound: "帖子不存在",
      firstPost: "已经是第一篇了",
      lastPost: "已经是最后一篇了",
      noPostId: "帖子ID不能为空",
    },
  },

  onLoad: function(options) {
    const postId = options.postId;
    const userId = options.user_id;
    const eventId = options.eventId || options.event_id;
    const type = options.type || "discover";
    const filter = options.filter || "";
    
    if (!postId) {
      this.showError(this.data.messages.noPostId);
      return;
    }
    
    // Initialize loading flags
    this.isLoadingPost = false;
    this.loadingPostId = null;
    
    // Set initial data
    this.setData({
      postId: postId,
      userId: userId || null,
      eventId: eventId || null,
      type: type,
      filter: filter,
      userInfo: app.globalData.userInfo || null,
      showLoginModal: app.globalData.showLoginModal || false,
    });
    
    // Subscribe to global events
    this.subscribeToGlobalEvents();
    
    // Start loading the post
    this.loadPostData();
  },

  onShow: function() {
    // Only reload if no post data exists and not currently loading
    if (!this.data.post && !this.data.isLoading && this.data.postId && !this.data.hasLoadedOnce) {
      this.loadPostData();
    }
  },

  onUnload: function() {
    this.unsubscribeFromGlobalEvents();
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

  // Main function to load post data from API
  loadPostData: function() {
    if (!this.data.postId) {
      return;
    }
    
    // Simple duplicate prevention - only check if same request is in progress
    if (this.isLoadingPost && this.loadingPostId === this.data.postId) {
      return;
    }
    
    // Set loading flags
    this.isLoadingPost = true;
    this.loadingPostId = this.data.postId;
    
    this.setData({
      isLoading: true,
      hasError: false,
      errorMessage: "",
      mediaInitialized: false,
      hasLoadedOnce: true, // Mark that we've started loading
    });
    
    // Build query parameters for API request
    const apiParams = { 
      type: this.data.type 
    };
    
    if (this.data.userId) {
      apiParams.user_id = this.data.userId;
    }
    if (this.data.eventId) {
      apiParams.event_id = this.data.eventId;
    }
    if (this.data.filter) {
      apiParams.filter = this.data.filter;
    }
    
    // Build request headers
    const requestHeaders = {
      "Content-Type": "application/json"
    };
    
    if (this.data.userInfo && this.data.userInfo.token) {
      requestHeaders.Authorization = `Bearer ${this.data.userInfo.token}`;
    }
    
    const apiUrl = `${config.BACKEND_URL}/v2/post/detail/${this.data.postId}`;
    
    // Execute API request
    wx.request({
      url: apiUrl,
      method: "GET",
      data: apiParams,
      header: requestHeaders,
      success: (response) => {
        // Immediately stop loading on success
        this.setData({ isLoading: false });
        this.handleApiSuccessResponse(response);
      },
      fail: (error) => {
        // Immediately stop loading on failure  
        this.setData({ isLoading: false });
        this.handleApiErrorResponse(error);
      },
      complete: () => {
        // Clear loading flags
        this.isLoadingPost = false;
        this.loadingPostId = null;
        
        // Ensure loading is stopped
        this.setData({ isLoading: false });
      },
    });
  },

  // Handle successful API response with navigation caching
  handleApiSuccessResponse: function(response) {
    if (response.statusCode !== 200) {
      this.showError(this.data.messages.networkError);
      return;
    }
    
    if (!response.data || response.data.status !== "success") {
      const errorMessage = response.data?.message || this.data.messages.loadFailed;
      this.showError(errorMessage);
      return;
    }
    
    const responseData = response.data;
    const postData = responseData.current || responseData.post;
    
    if (!postData) {
      this.showError(this.data.messages.noPostFound);
      return;
    }
    
    // Extract navigation data
    const nextPostId = this.extractPostIdFromData(responseData.next || responseData.next_post, responseData.next_post_id);
    const previousPostId = this.extractPostIdFromData(responseData.previous || responseData.previous_post, responseData.previous_post_id);
    const nextPost = responseData.next || null;
    const previousPost = responseData.previous || null;
    
    // Update with complete data and cache navigation posts
    this.setData({
      post: postData,
      nextPostId: nextPostId,
      previousPostId: previousPostId,
      nextPost: nextPost, // Cache for instant navigation
      previousPost: previousPost, // Cache for instant navigation
      hasError: false,
      errorMessage: "",
      isLoading: false,
      isNavigating: false, // Stop navigation indicator
    });
    
    // Initialize media player if not already done (for new posts)
    if (!this.data.mediaInitialized) {
      setTimeout(() => {
        this.initializeMediaPlayerForPost();
      }, 100);
    }
    
    // For video posts, add additional safety net to clear loading
    if (postData && postData.type === 'video') {
      setTimeout(() => {
        this.setData({
          isLoading: false,
          isNavigating: false
        });
      }, 1500);
    }
  },

  // Handle API request error
  handleApiErrorResponse: function(error) {
    this.showError(this.data.messages.networkError);
  },

  // Display error message to user
  showError: function(message) {
    // Clear loading states
    this.isLoadingPost = false;
    this.loadingPostId = null;
    
    this.setData({
      hasError: true,
      errorMessage: message,
      isLoading: false,
      // Don't clear post on error to avoid showing empty state
    });
  },

  // Extract post ID from post object or use fallback ID
  extractPostIdFromData: function(postObject, fallbackId) {
    if (postObject && typeof postObject === 'object' && postObject.id) {
      return postObject.id;
    }
    return fallbackId || null;
  },

  // Simplified media player initialization with immediate execution
  initializeMediaPlayerForPost: function() {
    if (this.data.mediaInitialized || this.isInitializingMedia) {
      return;
    }
    
    if (!this.data.post || !this.data.post.id) {
      return;
    }
    
    // Set initialization flags
    this.isInitializingMedia = true;
    
    // Force ensure loading is stopped
    this.setData({ 
      mediaInitialized: true,
      isLoading: false // Force stop loading during initialization
    });
    
    // Use direct initialization approach
    this.initializeMediaPlayerDirect();
  },

  // Direct media player initialization without delays
  initializeMediaPlayerDirect: function() {
    // Force stop loading immediately
    this.setData({ isLoading: false });
    
    // Try immediate component selection
    const component = this.selectComponent('#media-player');
    if (component) {
      this.callMediaPlayerMethods(component);
      return;
    }
    
    // If not found immediately, try once after nextTick
    wx.nextTick(() => {
      const componentAfterTick = this.selectComponent('#media-player');
      if (componentAfterTick) {
        this.callMediaPlayerMethods(componentAfterTick);
      } else {
        this.setData({ mediaInitialized: false });
        this.isInitializingMedia = false;
      }
    });
  },
  
  // Try immediate component initialization
  tryImmediateComponentInit: function() {
    const selectors = [
      '#media-player',
      '.media-player', 
      'media-player'
    ];
    
    for (let selector of selectors) {
      try {
        const component = this.selectComponent(selector);
        if (component) {
                this.callMediaPlayerMethods(component);
          return true;
        }
      } catch (error) {
        // Error with selector - continue to next
      }
    }
    
    // No component found immediately
    return false;
  },
  
  // Try delayed initialization with progressive delays and loading control
  tryDelayedInit: function(index, delays) {
    if (index >= delays.length) {
      // All delayed initialization attempts failed
      
      // Ensure loading is stopped even if initialization fails
      this.setData({ 
        mediaInitialized: false,
        isLoading: false // Force stop loading
      });
      
      // Clear initialization flag
      this.isInitializingMedia = false;
      return;
    }
    
    const delay = delays[index];
    // Trying delayed init with delay
    
    setTimeout(() => {
      // Ensure loading is still stopped during retry
      if (this.data.isLoading) {
        this.setData({ isLoading: false });
      }
      
      const success = this.tryImmediateComponentInit();
      if (!success) {
        this.tryDelayedInit(index + 1, delays);
      }
    }, delay);
  },
  
  // Call media player methods with enhanced error handling
  callMediaPlayerMethods: function(component) {
    try {
      // Method 1: Force stop all loading states immediately
      if (typeof component.setData === 'function') {
        component.setData({
          isWaitingForApi: false,
          isLoading: false
        });
      }
      
      // Method 2: onPostChanged
      if (typeof component.onPostChanged === 'function') {
        component.onPostChanged();
      }
      
      // Method 3: onApiLoadComplete
      if (typeof component.onApiLoadComplete === 'function') {
        component.onApiLoadComplete();
      }
      
    } catch (error) {
      this.setData({ mediaInitialized: false });
    } finally {
      // Clear initialization flag
      this.isInitializingMedia = false;
    }
  },

  

  // Navigate to previous post in sequence with instant display
  handlePreviousPost: function() {
    if (!this.data.previousPostId) {
      wx.showToast({
        title: this.data.messages.firstPost,
        icon: "none",
      });
      return;
    }
    
    this.navigateToPostById(this.data.previousPostId, 'previous');
  },

  // Navigate to next post in sequence with instant display
  handleNextPost: function() {
    if (!this.data.nextPostId) {
      wx.showToast({
        title: this.data.messages.lastPost,
        icon: "none",
      });
      return;
    }
    
    this.navigateToPostById(this.data.nextPostId, 'next');
  },

  // Navigate to specific post by ID with instant display and background loading
  navigateToPostById: function(postId, direction = 'unknown') {
    // Only prevent if exactly same post ID
    if (this.data.postId === postId) {
      return;
    }
    
    // Get pre-cached post data for instant display
    let cachedPost = null;
    if (direction === 'next' && this.data.nextPost) {
      cachedPost = this.data.nextPost;
    } else if (direction === 'previous' && this.data.previousPost) {
      cachedPost = this.data.previousPost;
    }
    
    if (cachedPost) {
      // Immediately display cached post
      this.setData({
        postId: postId,
        post: cachedPost,
        nextPostId: null, // Will be updated from API
        previousPostId: null,
        nextPost: null, // Clear cache
        previousPost: null,
        mediaInitialized: false,
        hasError: false,
        errorMessage: "",
        isNavigating: true, // Show subtle navigation indicator
        isLoading: false, // Don't show main loading since we have content
      });
      
      // Initialize media player immediately with cached data
      setTimeout(() => {
        this.initializeMediaPlayerForPost();
      }, 50);
      
      // Load complete data in background
      this.loadPostDataInBackground();
      
    } else {
      // Standard loading when no cached data
      this.isLoadingPost = false;
      
      this.setData({
        postId: postId,
        mediaInitialized: false,
        hasError: false,
        errorMessage: "",
        isLoading: true,
        isNavigating: false,
        hasLoadedOnce: true, // Mark that we're starting a new load
      });
      
      // Load post data normally
      this.loadPostData();
    }
  },

  // Handle user profile tap event
  onUserTap: function(event) {
    const username = event.currentTarget.dataset.username;
    if (username && app.handleGoUserProfile) {
      app.handleGoUserProfile(username);
    }
  },

  // Handle login modal close event
  onLoginClose: function() {
    if (app.setState) {
      app.setState("showLoginModal", false);
    }
  },

  // Handle successful login event
  onLoginSuccess: function() {
    this.setData({
      userInfo: app.globalData.userInfo,
    });
    
    // Reload current post with authentication if needed
    if (this.data.postId && !this.data.isLoading) {
      this.loadPostData();
    }
  },

  // Handle retry button tap event
  onRetry: function() {
    if (this.data.postId && !this.data.isLoading) {
      this.loadPostData();
    }
  },

  // Handle page refresh event (pull down or manual)
  onRefresh: function() {
    if (this.data.postId && !this.data.isLoading) {
      this.setData({
        post: null,
        mediaInitialized: false,
        hasError: false,
        errorMessage: "",
      });
      this.loadPostData();
    }
  },

  // Manual retry for media player initialization (can be called from WXML)
  retryMediaPlayerInit: function() {
    if (this.data.post && !this.data.mediaInitialized) {
      this.setData({ mediaInitialized: false });
      this.initializeMediaPlayerForPost();
    }
  },

  // Handle retry button tap event
  onRetry: function() {
    if (this.data.postId && !this.data.isLoading) {
      this.setData({
        hasError: false,
        errorMessage: "",
        post: null,
        mediaInitialized: false,
        hasLoadedOnce: true, // Keep the flag since we're retrying
      });
      this.loadPostData();
    }
  },
  
  
  // Load post data in background (for cached navigation)
  loadPostDataInBackground: function() {
    if (!this.data.postId) {
      return;
    }
    
    // Build request parameters
    const apiParams = { 
      type: this.data.type 
    };
    
    if (this.data.userId) {
      apiParams.user_id = this.data.userId;
    }
    if (this.data.eventId) {
      apiParams.event_id = this.data.eventId;
    }
    if (this.data.filter) {
      apiParams.filter = this.data.filter;
    }
    
    // Build request headers
    const requestHeaders = {
      "Content-Type": "application/json"
    };
    
    if (this.data.userInfo && this.data.userInfo.token) {
      requestHeaders.Authorization = `Bearer ${this.data.userInfo.token}`;
    }
    
    const apiUrl = `${config.BACKEND_URL}/v2/post/detail/${this.data.postId}`;
    
    // Execute background API request
    wx.request({
      url: apiUrl,
      method: "GET",
      data: apiParams,
      header: requestHeaders,
      success: (response) => {
        this.handleBackgroundApiResponse(response);
      },
      fail: (error) => {
        // Don't show error for background requests
        this.setData({ isNavigating: false });
      },
      complete: () => {
        // Background API request completed
      },
    });
  },
  
  // Handle background API response (update with complete data)
  handleBackgroundApiResponse: function(response) {
    if (response.statusCode !== 200 || !response.data || response.data.status !== "success") {
      this.setData({ isNavigating: false });
      return;
    }
    
    const responseData = response.data;
    const postData = responseData.current || responseData.post;
    
    if (!postData || postData.id !== this.data.postId) {
      this.setData({ isNavigating: false });
      return;
    }
    
    // Extract navigation data
    const nextPostId = this.extractPostIdFromData(responseData.next || responseData.next_post, responseData.next_post_id);
    const previousPostId = this.extractPostIdFromData(responseData.previous || responseData.previous_post, responseData.previous_post_id);
    const nextPost = responseData.next || null;
    const previousPost = responseData.previous || null;
    
    // Update with complete data
    this.setData({
      post: postData, // Update with complete post data
      nextPostId: nextPostId,
      previousPostId: previousPostId,
      nextPost: nextPost,
      previousPost: previousPost,
      isNavigating: false,
    });
  },
  
});