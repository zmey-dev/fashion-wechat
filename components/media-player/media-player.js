const { default: config } = require("../../config");
const { isEmpty } = require("../../utils/isEmpty");

// components/media-player/media-player.js
Component({
  properties: {
    selectedPost: {
      type: Object,
      value: null,
    },
    authUser: {
      type: Object,
      value: null,
    },
    index: {
      type: Number,
      value: 0,
    },
    totalCount: {
      type: Number,
      value: 0,
    },
    eventId: {
      type: String,
      value: null,
    },
    isEventExpired: {
      type: Boolean,
      value: false,
    },
    isContinue: {
      type: Boolean,
      value: false,
    },
    isPlaying: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    // Track if this is the first load ever (component attached)
    isFirstEntry: true,
    
    // Media state
    currentSlideIndex: 0,
    isLoading: false,
    showPlayIndicator: false,
    autoPlayTimer: null,
    
    // Internal playing state to override the property when manually paused/played
    internalIsPlaying: null, // null means use property value, true/false means override
    
    // Computed playing state for template
    actualIsPlaying: false,

    // Audio playback modes
    audioMode: "both", // "both" (both audio tracks), "uploaded" (uploaded audio only), "video" (video audio only)
    showAudioModeSelector: false,

    // Event state
    isEventExpired: false,
    shouldHideUserInfo: false, // Never hide user info (show all for expired events)

    // Template-bound computed data
    currentPost: null,
    currentPostUser: null,
    currentMedia: [],
    preloadedMedia: [], // Store preloaded media paths
    userComments: [],
    mediaLength: 0,
    mediaLoadingStates: [], // Track loading state of each media item

    // Computed display values
    displayTitle: "",
    displayContent: "",
    displayLikes: "",
    displayComments: "",
    displayFavorites: "",
    displayShares: "",
    displayFollowerCount: "",
    displayLikeCount: "", // UI state
    showDetail: false,
    showReportModal: false,
    detailPanelState: "closed", // 'closed', 'half', 'full'
    tabIndex: 1, // 0: User posts, 1: Comments, 2: Details

    // Dots and interactions
    selectedDot: null, // System information
    windowWidth: 0,
    windowHeight: 0,
    containerWidth: 0,
    containerHeight: 0,

    // Remove all swipe-related properties
    
    // API loading state
    isWaitingForApi: false,

  },
  /**
   * Component lifecycle
   */
  attached() {
    // Initialize flags
    this.isCurrentlyLoading = false;
    this._toggleInProgress = false;
    
    this.initializeComponent();

    // Add resize event listener
    this.onScreenResize = () => {
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        windowWidth: systemInfo.windowWidth,
        windowHeight: systemInfo.windowHeight,
      });
      this.getContainerDimensions();
    };

    wx.onWindowResize(this.onScreenResize);
  },

  ready() {
    // Update container dimensions after component is fully rendered
    this.getContainerDimensions();
    
    // WeChat Doc: Don't auto-start in ready() to prevent race conditions
    // Let parent components explicitly control playback
    console.log('[Ready] Component ready, waiting for explicit play command');
  },

  detached() {
    this.cleanup();

    // Reset flags
    this._toggleInProgress = false;

    // Remove resize event listener
    if (this.onScreenResize) {
      wx.offWindowResize(this.onScreenResize);
    }
  },
  /**
   * Component observers
   */
  observers: {
    selectedPost: function (newPost, oldPost) {
      // Add more strict duplicate prevention
      if (!newPost) {
        return;
      }
      
      // Check if this is actually a new post
      const isNewPost = !oldPost || newPost.id !== oldPost.id;
      const isCurrentPostDifferent = !this.data.currentPost || this.data.currentPost.id !== newPost.id;
      
      if (isNewPost && isCurrentPostDifferent) {
        // Clear dot-related state immediately when new post is detected
        this.setData({ selectedDot: null });
        
        // Clear dots in media-display component immediately
        const mediaDisplayComponent = this.selectComponent('media-display');
        if (mediaDisplayComponent) {
          mediaDisplayComponent.setData({ calculatedDots: [] });
        }
        
        this.loadPostData();
      }
    },
    showDetail: function (isShowing) {
      if (isShowing) {
        this.pauseAutoPlay();
      } else {
        this.resumeAutoPlay();
      }
      // Update container dimensions when detail panel is shown/hidden
      setTimeout(() => this.getContainerDimensions(), 300);
    },
  },

  /**
   * Component methods
   */
  methods: {
    /**
     * WeChat Doc Compliant: Direct play/pause control without observers
     */
    updatePlayingState() {
      const shouldPlay = this.properties.isPlaying;
      const currentlyPlaying = this.data.actualIsPlaying;
      
      console.log('[Media Player] updatePlayingState - should:', shouldPlay, 'current:', currentlyPlaying);
      
      // Only update if state actually changed
      if (shouldPlay !== currentlyPlaying) {
        if (shouldPlay) {
          this.startPlayback();
        } else {
          this.stopPlayback();
        }
      }
    },

    /**
     * Start playback - WeChat Doc compliant
     */
    startPlayback() {
      console.log('[Media Player] startPlayback called');
      
      if (!this.data.currentPost) return;
      
      // Update state first
      this.setData({ actualIsPlaying: true });
      
      // Clear any existing timer
      this.clearAutoPlayTimer();
      this.setData({ currentSlideIndex: 0 });
      
      // Start appropriate media playback
      if (this.data.currentPost.type === 'image') {
        this.startAutoPlay();
      } else if (this.data.currentPost.type === 'video') {
        const mediaDisplay = this.selectComponent('.media-display');
        if (mediaDisplay && mediaDisplay.startVideoAutoplay) {
          setTimeout(() => {
            mediaDisplay.startVideoAutoplay();
          }, 100);
        }
      }
    },

    /**
     * Stop playback - WeChat Doc compliant
     */
    stopPlayback() {
      console.log('[Media Player] stopPlayback called');
      
      // Update state first
      this.setData({ actualIsPlaying: false });
      
      // Clear timers
      this.clearAutoPlayTimer();
      
      // WeChat Doc: Use centralized video management
      const mediaDisplay = this.selectComponent('.media-display');
      if (mediaDisplay) {
        console.log('[Media Player] Stopping video via centralized management');
        
        // Use media-display's centralized video control
        if (mediaDisplay.stopVideo) {
          mediaDisplay.stopVideo();
        }
        
        // Destroy audio components
        if (mediaDisplay.destroyUploadedAudio) {
          mediaDisplay.destroyUploadedAudio();
        }
      }
    },

    /**
     * Get the actual playing state (simplified)
     */
    getActualPlayingState() {
      return this.data.actualIsPlaying;
    },

    /**
     * Initialize component
     */
    initializeComponent() {
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        windowWidth: systemInfo.windowWidth,
        windowHeight: systemInfo.windowHeight,
        actualIsPlaying: this.properties.isPlaying || false
      });

      // Get actual container dimensions
      this.getContainerDimensions();

      if (this.properties.selectedPost) {
        this.loadPostData();
      }
    },

    /**
     * Get actual container dimensions
     */
    getContainerDimensions() {
      const query = this.createSelectorQuery();
      query
        .select(".media-player")
        .boundingClientRect((rect) => {
          if (rect) {
            this.setData({
              containerHeight: rect.height,
              containerWidth: rect.width,
            });
          }
        })
        .exec();
    },

    /**
     * Load post data and related information with media preloading
     */
    async loadPostData() {
      const { selectedPost, eventId } = this.properties;
      if (!selectedPost) {
        return;
      }

      // Enhanced duplicate prevention
      if (this.isCurrentlyLoading) {
        return;
      }
      
      if (this.data.currentPost && this.data.currentPost.id === selectedPost.id) {
        return;
      }

      // Set loading flag to prevent concurrent loads
      this.isCurrentlyLoading = true;

      // Check if event is expired (if in event context)
      let isEventExpired = false;
      let shouldHideUserInfo = false;
      
      // Use the passed isEventExpired property if available
      if (eventId) {
        // If we have explicit isEventExpired from props, use it
        if (this.properties.isEventExpired !== undefined) {
          isEventExpired = this.properties.isEventExpired;
          // Only hide user info for active events (non-expired)
          shouldHideUserInfo = eventId && !isEventExpired;
          console.log('Using passed isEventExpired:', { isEventExpired, shouldHideUserInfo });
        } else if (selectedPost.event) {
          // Fallback to checking event data if available
          const now = new Date();
          const endDate = new Date(selectedPost.event.end_date);
          isEventExpired = endDate < now;
          // Only hide user info for active events
          shouldHideUserInfo = eventId && !isEventExpired;
          console.log('Event expired check from post data:', { isEventExpired, shouldHideUserInfo });
        } else {
          // If we have eventId but no event data or expiry info, assume active event
          // For event context without event data, we should hide for active events
          shouldHideUserInfo = true; // Default to hiding for event context
          console.log('Event ID without event data, assuming active event, hiding user info');
        }
      } else {
        // No event context at all
        shouldHideUserInfo = false;
      }

      const postUser = selectedPost.user || {};
      const comments = selectedPost.comments || [];
      const mediaRaw = selectedPost.media || [];
      
      // Clean all media URLs to remove #devtools_no_referrer
      const media = mediaRaw.map(item => {
        if (item && item.url) {
          // Remove hash fragments
          const cleanUrl = item.url.split('#')[0];
          return { ...item, url: cleanUrl };
        }
        return item;
      });

      // Clear dots when loading new post
      const mediaDisplayComponent = this.selectComponent('media-display');
      if (mediaDisplayComponent) {
        mediaDisplayComponent.setData({ calculatedDots: [] });
      }

      // Initialize media loading states
      const mediaLoadingStates = media.map(() => ({ loading: false, error: false }));

      // Only show loading on the very first entry to media player
      // isFirstEntry starts as true, becomes false after first load
      const shouldShowLoading = this.data.isFirstEntry;
      
      // Don't use global loading for media player navigation
      // Loading should only be shown on initial page load, not during swipe navigation
      
      // Immediately set data and ensure all loading states are false
      this.setData({
        isLoading: false,  // Don't use local loading anymore
        isFirstEntry: false,  // Mark that we've loaded at least once
        isWaitingForApi: false,
        currentSlideIndex: 0,
        selectedDot: null,
        showDetail: false,
        isEventExpired: isEventExpired,
        shouldHideUserInfo: shouldHideUserInfo,
        currentPost: {
          id: selectedPost.id || "",
          title: selectedPost.title || "",
          content: selectedPost.content || "",
          type: selectedPost.type || "image",
          likes: selectedPost.likes || 0,
          favorites: selectedPost.favorites || 0,
          shares: selectedPost.shares || 0,
          comments: comments,
          is_liked: selectedPost.is_liked || false,
          is_favorited: selectedPost.is_favorited || false,
          event_id: selectedPost.event_id || null,
          media: media,
          ...selectedPost,
        },
        currentPostUser: {
          id: postUser.id || "",
          username: postUser.username || "Unknown User",
          nickname: postUser.nickname || "Unknown User",
          avatar: postUser.avatar || "",
          is_followed: postUser.is_followed || false,
          posts: postUser.posts || [],
          ...postUser,
        },
        currentMedia: media,
        mediaLength: media.length,
        userComments: comments,
        mediaLoadingStates: mediaLoadingStates,
        preloadedMedia: new Array(media.length).fill(null)
      });

      this.updateDisplayValues();
      
      // Clear any existing timer first
      this.clearAutoPlayTimer();
      
      // Clear loading flag
      this.isCurrentlyLoading = false;
      
      // If this post is currently playing and it's an image post, start autoplay
      if (this.data.actualIsPlaying && selectedPost.type === 'image') {
        console.log('[LoadPostData] Starting autoplay for active image post');
        setTimeout(() => {
          this.startAutoPlay();
        }, 100);
      }
      
      // For video posts, ensure loading state is cleared after a short delay (only for first entry)
      if (selectedPost.type === 'video' && shouldShowLoading) {
        setTimeout(() => {
          this.setData({
            isLoading: false,
            isWaitingForApi: false
          });
        }, 500);
      }
    },

    /**
     * Preload media for current post - DISABLED to prevent duplicate loading
     */
    async preloadCurrentPostMedia() {
      // Disabled to prevent duplicate media loading
      return;
    },

    /**
     * Get optimized media URL (preloaded if available)
     */
    getOptimizedMediaUrl(index) {
      const { preloadedMedia, currentMedia } = this.data;
      
      if (preloadedMedia && preloadedMedia[index]) {
        return preloadedMedia[index];
      }
      
      if (currentMedia && currentMedia[index]) {
        return currentMedia[index].url;
      }
      
      return null;
    },

    /**
     * Check if media is loading
     */
    isMediaLoading(index) {
      const { mediaLoadingStates } = this.data;
      return mediaLoadingStates && mediaLoadingStates[index] && mediaLoadingStates[index].loading;
    },

    /**
     * Check if media has error
     */
    hasMediaError(index) {
      const { mediaLoadingStates } = this.data;
      return mediaLoadingStates && mediaLoadingStates[index] && mediaLoadingStates[index].error;
    },

    /**
     * Update computed display values for template
     */
    updateDisplayValues() {
      const { currentPost, currentPostUser } = this.data;
      if (!currentPost) return;

      this.setData({
        displayTitle: this.truncateTitle(currentPost.title, 30),
        displayContent: currentPost.content
          ? currentPost.content
          : "",
        displayLikes: this.formatNumber(currentPost.likes),
        displayComments: this.formatNumber(currentPost.comments?.length || 0),
        displayFavorites: this.formatNumber(currentPost.favorites),
        displayShares: this.formatNumber(currentPost.shares),
        displayFollowerCount: currentPostUser.followers
          ? this.formatNumber(currentPostUser.followers.length)
          : "0",
        displayLikeCount: this.formatNumber(currentPost.likes),
      });
    },

    /**
     * Auto play management
     */
    startAutoPlay() {
      // Only for image posts
      if (this.data.currentPost?.type !== "image") {
        console.log('[AutoPlay] Not an image post, skipping autoplay');
        return;
      }
      
      // Check if we should start autoplay
      if (!this.data.actualIsPlaying || this.data.showDetail) {
        console.log('[AutoPlay] Not playing or detail shown, skipping autoplay');
        return;
      }
      
      // Always clear any existing timer first
      this.clearAutoPlayTimer();
      
      console.log('[AutoPlay] Starting auto play timer for image post');
      
      // Create new timer only for images
      const timer = setInterval(() => {
        this.moveToNextSlide();
      }, 5000);
      this.setData({ autoPlayTimer: timer });
    },

    clearAutoPlayTimer() {
      if (this.data.autoPlayTimer) {
        // Handle both setInterval and setTimeout
        clearInterval(this.data.autoPlayTimer);
        clearTimeout(this.data.autoPlayTimer);
        this.setData({ autoPlayTimer: null });
      }
    },

    pauseAutoPlay() {
      this.clearAutoPlayTimer();
    },

    resumeAutoPlay() {
      console.log('[AutoPlay] resumeAutoPlay called');
      // Only restart if currently playing and is image post
      if (this.data.actualIsPlaying && this.data.currentPost?.type === 'image') {
        this.startAutoPlay();
      }
    },

    /**
     * Play/Pause management
     */
    togglePlayPause() {
      console.log('[Media Player] togglePlayPause - current state:', this.data.actualIsPlaying);
      
      // Simple debouncing
      if (this._toggleInProgress) {
        console.log('[Media Player] Toggle in progress, ignoring');
        return;
      }
      
      this._toggleInProgress = true;
      setTimeout(() => {
        this._toggleInProgress = false;
      }, 500);
      
      // Direct toggle without complex state management
      if (this.data.actualIsPlaying) {
        this.stopPlayback();
      } else {
        this.startPlayback();
      }
    },

    // Public methods for parent components (backward compatibility)
    pauseMedia() {
      this.stopPlayback();
    },

    playMedia() {
      this.startPlayback();
    },

    showPlayIndicatorBriefly() {
      this.setData({ showPlayIndicator: true });
      setTimeout(() => {
        this.setData({ showPlayIndicator: false });
      }, 1000);
    },

    /**
     * Event handlers from child components
     */

    // Media Display Events
    onScreenTap() {
      const { currentPost } = this.data;
      if (currentPost.type !== "image") return;

      this.togglePlayPause();
      this.showPlayIndicatorBriefly();
    },

    onSlideChange(e) {
      const newIndex = e.detail.current;
      this.setData({ currentSlideIndex: newIndex });
      
      // Don't restart timer on manual slide change - let existing timer continue
    },
    onDotTap(e) {
      const { index } = e.detail;
      const { currentMedia, currentSlideIndex } = this.data;
      const media = currentMedia[currentSlideIndex];

      if (media && media.dots && media.dots[index]) {
        this.setData({
          selectedDot: media.dots[index],
          tabIndex: 2,
          showDetail: true,
          detailPanelState: "half", // Add this line to update detail panel state
        });

        // Pause auto-play when detail panel opens via dot tap
        if (this.getActualPlayingState()) {
          this.pauseAutoPlay();
        }
      }
    },

    moveToPreviousSlide() {
      const { currentSlideIndex } = this.data;
      if (currentSlideIndex > 0) {
        this.setData({ currentSlideIndex: currentSlideIndex - 1 });
      }
    },

    moveToNextSlide() {
      const { currentSlideIndex, mediaLength, currentPost } = this.data;
      
      console.log('[AutoPlay] moveToNextSlide called - currentPost type:', currentPost?.type, 'actualIsPlaying:', this.data.actualIsPlaying);
      
      // Safety check: moveToNextSlide should only work for image posts
      if (currentPost?.type !== 'image') {
        console.log('[AutoPlay] Not an image post, stopping moveToNextSlide');
        return;
      }
      
      // Check actual playing state
      if (!this.data.actualIsPlaying) {
        console.log('[AutoPlay] Not playing, stopping moveToNextSlide');
        return;
      }
      
      if (mediaLength === 1) {
        // Single image - handle based on continue setting
        if (this.properties.isContinue) {
          this.clearAutoPlayTimer();
          this.triggerEvent('imageSlideEnded');
        }
        // For single image without continue, just keep the timer running
        // No need to restart it
      } else if (currentSlideIndex + 1 < mediaLength) {
        // Move to next slide, timer continues
        this.setData({ currentSlideIndex: currentSlideIndex + 1 });
      } else {
        // Last slide of multi-image post reached
        if (this.properties.isContinue) {
          this.clearAutoPlayTimer();
          // Auto-advance to next post immediately after last slide
          this.triggerEvent('imageSlideEnded');
        } else {
          // Loop back to first slide, timer continues
          this.setData({ currentSlideIndex: 0 });
        }
      }
    },


    // Media Controls Events
    onPlayPause() {
      this.togglePlayPause();
    },

    onProgressTap(e) {
      const { index } = e.detail;
      this.setData({ currentSlideIndex: index });
    },

    onContinueToggle(e) {
      const newValue = e.detail.value;
      // Notify parent component
      this.triggerEvent('continueToggled', { value: newValue });
    },

    // Video ended event handler
    onVideoEnded() {
      const { currentPost, isWaitingForApi, isLoading } = this.data;
      
      // Validate that this is a genuine video end, not a navigation artifact
      
      // Ignore video ended events during navigation or loading
      if (isWaitingForApi || isLoading) {
        return;
      }
      
      // Validate that this is actually a video post
      if (currentPost?.type !== 'video') {
        return;
      }
      
      // Check if we're in the middle of navigation (additional safety check)
      const mediaDisplayComponent = this.selectComponent('media-display');
      if (mediaDisplayComponent && mediaDisplayComponent.data.isNavigatingVideo) {
        return;
      }
      
      // Check if continue is enabled
      if (this.properties.isContinue) {
        // Auto-advance to next post
        this.triggerEvent('videoEnded');
      }
      // If continue is false, let the video loop naturally via loop attribute
    },


    // Action Buttons Events
    onUserProfile() {
      if (!this.properties.authUser) {
        this.showLoginToast();
        return;
      }
      getApp().handleGoUserProfile(this.data.currentPost.user.username);
    },

    handleLike() {
      if (isEmpty(this.properties.authUser)) {
        const app = getApp();
        app.setState("showLoginModal", true);
        return;
      }

      wx.request({
        url: `${config.BACKEND_URL}/post/add_like`,
        method: "POST",
        data: { post_id: this.data.currentPost.id },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.properties.authUser.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            const { currentPost } = this.data;
            const newLikeStatus = !currentPost.likes_exists;
            const newLikeCount = newLikeStatus
              ? currentPost.likes + 1
              : currentPost.likes - 1;

            this.setData({
              "currentPost.likes_exists": newLikeStatus,
              "currentPost.likes": newLikeCount,
              displayLikes: this.formatNumber(newLikeCount),
            });

            wx.vibrateShort();
            wx.showToast({
              title: newLikeStatus ? "已点赞" : "已取消点赞",
              icon: "success",
              duration: 1000,
            });

            this.triggerEvent("like", {
              postId: currentPost.id,
              isLiked: newLikeStatus,
            });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
        fail: (err) => {
          wx.showToast({
            title: "点赞失败",
            icon: "none",
            duration: 1500,
          });
        },
      });
    },

    handleFavorite() {
      if (isEmpty(this.properties.authUser)) {
        const app = getApp();
        app.setState("showLoginModal", true);
        return;
      }

      wx.request({
        url: `${config.BACKEND_URL}/post/save_favorite`,
        method: "POST",
        data: { post_id: this.data.currentPost.id },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.properties.authUser.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            const { currentPost } = this.data;
            const newFavoriteStatus = !currentPost.favorites_exists;
            const newFavoriteCount = newFavoriteStatus
              ? currentPost.favorites + 1
              : currentPost.favorites - 1;

            this.setData({
              "currentPost.favorites_exists": newFavoriteStatus,
              "currentPost.favorites": newFavoriteCount,
              displayFavorites: this.formatNumber(newFavoriteCount),
            });

            wx.vibrateShort();
            wx.showToast({
              title: newFavoriteStatus ? "已添加到收藏" : "已从收藏中移除",
              icon: "success",
              duration: 1000,
            });

            this.triggerEvent("favorite", {
              postId: currentPost.id,
              isFavorited: newFavoriteStatus,
            });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
        fail: (err) => {
          wx.showToast({
            title: "收藏失败",
            icon: "none",
            duration: 1500,
          });
        },
      });
    },

    handleShare() {
      wx.setClipboardData({
        data: `查看这个帖子: ${
          this.data.currentPost.media[this.data.currentSlideIndex].url
        }`,
        success: () => {
          const { currentPost } = this.data;
          this.setData({
            "currentPost.shares": currentPost.shares + 1,
            displayShares: this.formatNumber(currentPost.shares + 1),
          });
          wx.showToast({
            title: "链接已复制到剪贴板",
            icon: "success",
            duration: 1000,
          });
        },
        fail: (err) => {
          wx.showToast({
            title: "复制链接失败",
            icon: "none",
            duration: 1500,
          });
        },
      });
      wx.request({
        url: `${config.BACKEND_URL}/post/save_share`,
        method: "POST",
        data: { post_id: this.data.currentPost.id },
        header: {
          "Content-Type": "application/json",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
          }
        },
        fail: (err) => {
          // Share request failed
        },
      });
    },

    handleFollow() {
      if (isEmpty(this.properties.authUser)) {
        const app = getApp();
        app.setState("showLoginModal", true);
        return;
      }

      wx.request({
        url: `${config.BACKEND_URL}/post/save_follow`,
        method: "POST",
        data: { follower_id: this.data.currentPostUser.id },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.properties.authUser.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            const { currentPostUser } = this.data;
            const newFollowStatus = !currentPostUser.is_followed;
            const newFollowerCount = newFollowStatus
              ? Number(this.data.displayFollowerCount) + 1
              : Number(this.data.displayFollowerCount) - 1;

            this.setData({
              "currentPostUser.is_followed": newFollowStatus,
              displayFollowerCount: this.formatNumber(newFollowerCount),
            });

            wx.vibrateShort();
            wx.showToast({
              title: newFollowStatus ? "已关注" : "已取消关注",
              icon: "success",
              duration: 1000,
            });

            this.triggerEvent("follow", {
              userId: currentPostUser.id,
              isFollowed: newFollowStatus,
            });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
        fail: (err) => {
          wx.showToast({
            title: "关注失败",
            icon: "none",
            duration: 1500,
          });
        },
      });
    },
    onToggleDetail() {
      if (isEmpty(this.properties.authUser)) {
        const app = getApp();
        app.setState("showLoginModal", true);
        return;
      }

      const newShowDetail = !this.data.showDetail;

      this.setData({
        showDetail: newShowDetail,
        detailPanelState: newShowDetail ? "half" : "closed",
        tabIndex: 1,
      });

      // Pause auto-play when detail panel opens
      if (newShowDetail && this.getActualPlayingState()) {
        this.pauseAutoPlay();
      }
    },

    onShowReportModal() {
      if (isEmpty(this.properties.authUser)) {
        const app = getApp();
        app.setState("showLoginModal", true);
        return;
      }
      this.setData({ showReportModal: true });
    },

    // Detail Panel Events
    onTabChange(e) {
      const { index } = e.detail;
      this.setData({ tabIndex: parseInt(index) });
    },
    onCloseDetail() {
      this.setData({
        showDetail: false,
        selectedDot: null,
        detailPanelState: "closed",
      });

      // Resume auto-play when detail panel closes
      if (
        this.data.isContinue &&
        this.data.currentPost.type === "image" &&
        this.data.mediaLength > 1
      ) {
        this.resumeAutoPlay();
      }
    },

    onSelectUserPost(e) {
      const { post } = e.detail;
      this.onCloseDetail();
      wx.navigateTo({
        url: `/pages/post-detail/post-detail?postId=${post.id}`,
      });
      this.triggerEvent("selectUserPost", { post });
    },

    // Comment Events from comment-tree component
    onCommentLike(e) {
      if (isEmpty(this.properties.authUser)) {
        const app = getApp();
        app.setState("showLoginModal", true);
        return;
      }
      const { commentId, state_flag } = e.detail;
      wx.request({
        url: `${config.BACKEND_URL}/comment/like`,
        method: "POST",
        data: { comment_id: commentId, state_flag: state_flag },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.properties.authUser.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            const { userComments } = this.data;
            const updatedComments = userComments.map((comment) => {
              if (comment.id === commentId) {
                return {
                  ...comment,
                  like: res.data.like_count,
                  unlike: res.data.unlike_count,
                };
              }
              return comment;
            });

            this.setData({
              userComments: updatedComments,
              displayComments: this.formatNumber(updatedComments.length),
            });

            wx.showToast({
              title: res.data.msg,
              icon: "success",
              duration: 1000,
            });

            this.triggerEvent("commentLike", {
              commentId,
              isLiked: state_flag,
            });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
        fail: (err) => {
          wx.showToast({
            title: "点赞评论失败",
            icon: "none",
            duration: 1500,
          });
        },
      });
    },

    onCommentUnLike(e) {
      if (isEmpty(this.properties.authUser)) {
        const app = getApp();
        app.setState("showLoginModal", true);
        return;
      }
    },    onCommentSent(e) {
      const { comments } = e.detail;
      
      // Handle both single comment and array of comments
      const newComments = Array.isArray(comments) ? comments : [comments];
      
      // Check for duplicates by ID before adding
      const existingIds = new Set(this.data.userComments.map(c => c.id));
      const uniqueNewComments = newComments.filter(comment => 
        comment && comment.id && !existingIds.has(comment.id)
      );
      
      if (uniqueNewComments.length > 0) {
        const updatedComments = [...this.data.userComments, ...uniqueNewComments];
        
        this.setData({
          userComments: updatedComments,
          displayComments: this.formatNumber(updatedComments.length),
        });
      }

      this.triggerEvent("commentSent", e.detail);
    },

    onCommentUpdated(e) {
      const { comment } = e.detail;
      this.setData({
        userComments: this.data.userComments.map((c) =>
          c.id === comment.id ? { ...c, ...comment } : c
        ),
        displayComments: this.formatNumber(this.data.userComments.length),
      });

      this.triggerEvent("commentUpdated", e.detail);
    },

    onCommentDelete(e) {
      const { commentId } = e.detail;
      const { userComments } = this.data;
      wx.request({
        url: `${config.BACKEND_URL}/post/delete_comment`,
        method: "DELETE",
        data: { id: commentId },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.properties.authUser.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            const updatedComments = userComments.filter(
              (c) => c.id !== commentId
            );
            this.setData({
              userComments: updatedComments,
              displayComments: this.formatNumber(updatedComments.length),
            });

            this.triggerEvent("commentDeleted", e.detail);
            wx.showToast({
              title: "评论已删除",
              icon: "success",
              duration: 1000,
            });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
        fail: (err) => {
          wx.showToast({
            title: "删除评论失败",
            icon: "none",
            duration: 1500,
          });
        },
      });
    },

    onImagePreview(e) {
      const { url } = e.detail;
      wx.previewImage({
        urls: [url],
        current: url,
      });
    },

    onLoginRequired() {
      this.showLoginToast();
    },

    // Report Modal Events
    onCloseReportModal() {
      this.setData({ showReportModal: false });
    },

    onSubmitReport(e) {
      const { option } = e.detail;
      wx.showToast({
        title: "举报已提交",
        icon: "success",
        duration: 1500,
      });
      this.setData({ showReportModal: false });

      this.triggerEvent("reportSubmitted", {
        postId: this.data.currentPost.id,
        reason: option,
      });
    },

    /**
     * Utility methods
     */
    showLoginToast() {
      wx.showToast({
        title: "请先登录",
        icon: "none",
        duration: 1500,
      });
    },

    truncateTitle(title, maxLength = 30) {
      if (!title) return "";
      return title.length > maxLength
        ? title.substring(0, maxLength) + "..."
        : title;
    },

    formatNumber(num) {
      if (!num && num !== 0) return "0";
      if (num >= 10000) {
        return (num / 10000).toFixed(1) + "万";
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + "K";
      }
      return num.toString();
    },

    formatTime(timestamp) {
      const now = new Date();
      const time = new Date(timestamp);
      const diff = now - time;

      if (diff < 60000) return "刚刚";
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
      return `${Math.floor(diff / 86400000)} 天前`;
    },

    /**
     * Cleanup method
     */
    cleanup() {
      this.clearAutoPlayTimer();
    },

    // All touch event handlers removed - navigation handled by parent swiper

    /**
     * Audio mode management
     */
    toggleAudioModeSelector() {
      this.setData({ showAudioModeSelector: !this.data.showAudioModeSelector });
    },

    onAudioModeChange(e) {
      const mode = e.currentTarget.dataset.mode;
      this.setData({ 
        audioMode: mode,
        showAudioModeSelector: false 
      });
      
      // Notify media-display component about audio mode change
      const mediaDisplayComponent = this.selectComponent('.media-display');
      if (mediaDisplayComponent && mediaDisplayComponent.setAudioMode) {
        mediaDisplayComponent.setAudioMode(mode);
      }
      
      wx.showToast({
        title: mode === 'both' ? '播放两个音轨' : 
               mode === 'uploaded' ? '仅播放上传音频' : 
               '仅播放视频音频',
        icon: 'none',
        duration: 1500
      });
    },
    onDetailStateChange(e) {
      const { state } = e.detail;

      this.setData({
        detailPanelState: state,
      });


      // Handle auto-play based on panel state
      if (state === "half" || state === "full") {
        if (this.getActualPlayingState()) {
          this.pauseAutoPlay();
        }
      } else if (state === "closed") {
        if (
          this.data.isContinue &&
          this.data.currentPost.type === "image" &&
          this.data.mediaLength > 1
        ) {
          this.resumeAutoPlay();
        }
      }
    },
    
    // Swipe validation removed - handled by parent
    
    /**
     * Handle post change completion
     */
    onPostChanged() {
      
      // Force stop all loading states immediately and clear dots
      this.setData({
        isLoading: false,
        isWaitingForApi: false,
        selectedDot: null
      });
      
      // Clear dots in media-display component
      const mediaDisplayComponent = this.selectComponent('media-display');
      if (mediaDisplayComponent) {
        mediaDisplayComponent.setData({ calculatedDots: [] });
      }
      
      // Clear loading prevention flag
      this.isCurrentlyLoading = false;
      
      // Clear any existing autoplay timer from previous post
      this.clearAutoPlayTimer();
      
      // Don't start timer here - will be started by playMedia() when needed
      
      // Never show loading during navigation - isFirstEntry is now false
    },
    
    /**
     * Called when API loading is complete
     */
    onApiLoadComplete() {
      
      // Force stop all loading indicators and flags, clear dots
      this.setData({ 
        isWaitingForApi: false,
        isLoading: false,
        selectedDot: null
      });
      
      // Clear dots in media-display component
      const mediaDisplayComponent = this.selectComponent('media-display');
      if (mediaDisplayComponent) {
        mediaDisplayComponent.setData({ calculatedDots: [] });
      }
      
      // Clear loading prevention flag
      this.isCurrentlyLoading = false;
      
      // Don't start timer here - will be handled by playMedia() when post becomes current
      
      // Never show loading during navigation - isFirstEntry is now false
    },

  },
});
