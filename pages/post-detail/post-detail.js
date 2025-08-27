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
    
    // Post data
    post: null,
    nextPostId: null,
    previousPostId: null,
    
    // Removed pre-cached posts to disable caching
    
    // Loading states
    isLoading: false,
    hasError: false,
    errorMessage: "",
    isNavigating: false, // Separate flag for navigation loading
    isTransitioning: false, // Flag to prevent empty state during post transitions
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
      isEventExpired: isEventExpired,
      type: type,
      filter: filter,
      search: search,
      universityId: universityId,
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
      // Don't change isNavigating here - let navigation flow control it
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
    if (this.data.search) {
      apiParams.search = this.data.search;
    }
    if (this.data.universityId) {
      apiParams.university_id = this.data.universityId;
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
        // Let handleApiSuccessResponse manage loading state
        this.handleApiSuccessResponse(response);
      },
      fail: (error) => {
        // Let handleApiErrorResponse manage loading state
        this.handleApiErrorResponse(error);
      },
      complete: () => {
        // Clear loading flags
        this.isLoadingPost = false;
        this.loadingPostId = null;
        
        // Don't force loading state here - let success/error handlers manage it
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
    
    // Update with complete data without caching
    this.setData({
      post: postData,
      nextPostId: nextPostId,
      previousPostId: previousPostId,
      // Removed cached posts to disable instant navigation
      hasError: false,
      errorMessage: "",
      isLoading: false,
      isNavigating: false, // Stop navigation indicator
      isTransitioning: false, // Clear transition flag
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
      isNavigating: false, // Clear navigation flag on error
      isTransitioning: false, // Clear transition flag on error
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

  // Navigate to specific post by ID without caching
  navigateToPostById: function(postId, direction = 'unknown') {
    // Only prevent if exactly same post ID
    if (this.data.postId === postId) {
      return;
    }
    
    // Always load fresh data without caching
    this.isLoadingPost = false;
    
    // Immediately show loading and set transition flags
    this.setData({
      isLoading: true,
      isNavigating: true, // Set navigation flag to prevent empty state
      isTransitioning: true, // Prevent empty state during transition
    });
    
    // Use setTimeout to ensure UI updates before clearing post data
    setTimeout(() => {
      this.setData({
        postId: postId,
        post: null, // Clear current post to prevent flickering
        mediaInitialized: false,
        hasError: false,
        errorMessage: "",
        hasLoadedOnce: true, // Mark that we're starting a new load
        isLoading: true, // Ensure loading state is maintained
        isNavigating: true, // Keep navigation flag during transition
        isTransitioning: true, // Maintain transition flag
      });
      
      // Load post data normally
      this.loadPostData();
    }, 30); // Reduced delay for faster response
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