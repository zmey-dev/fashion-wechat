// components/media-display/media-display.js
Component({
  properties: {
    currentPost: { type: Object, value: {} },
    currentMedia: { type: Array, value: [] },
    currentSlideIndex: { type: Number, value: 0 },
    mediaLength: { type: Number, value: 0 },
    isPlaying: { type: Boolean, value: true },
    showPlayIndicator: { type: Boolean, value: false },
    selectedDot: { type: Object, value: null },
    isWaitingForApi: { type: Boolean, value: false },
    isContinue: { type: Boolean, value: true },
    detailPanelState: {
      type: String,
      value: 'closed',
      observer(newVal) {
        this.getContainerDimensions();
      }
    }
  },

  data: {
    containerWidth: 0,
    containerHeight: 0,
    calculatedDots: [],
    audioMode: 'both', // 'both', 'uploaded', 'video'
    // Removed image loading states for caching
    showVideo: true, // Control video visibility during navigation
    isNavigatingVideo: false, // Flag to prevent false video ended events during navigation
    videoReady: false, // Flag to control when video src is set
    videoSrc: '', // Dynamic video source
  },

  observers: {
    'currentMedia, currentSlideIndex': function(currentMedia, currentSlideIndex) {
      // Clear previous dots immediately when media changes
      this.setData({ calculatedDots: [] });
      
      // Clear previous video state to prevent thumbnail artifacts
      this.clearVideoState();
      
      // Set video source dynamically to prevent infinite loading
      if (currentMedia && currentMedia.length > 0 && currentMedia[0]) {
        this.setData({
          videoSrc: currentMedia[0].url || '',
          videoReady: true
        });
        
        // Auto-start video after a short delay to ensure it's loaded
        setTimeout(() => {
          this.startVideoAutoplay();
        }, 300);
      }
      
      // Calculate dot positions after DOM updates
      setTimeout(() => {
        this.calculateDotPositions();
      }, 50);
      
      // Removed image preloading check
    }
  },
  ready() {
    this.getContainerDimensions();
    
    // Listen for window resize events
    wx.onWindowResize && wx.onWindowResize(() => {
      setTimeout(() => {
        this.getContainerDimensions();
      }, 200);
    });
  },

  detached() {
    // Clean up event listeners
    wx.offWindowResize && wx.offWindowResize();
  },

  methods: {
    /**
     * Clear video state to prevent thumbnail artifacts during navigation
     */
    clearVideoState() {
      // Clear video source first to stop any loading
      this.setData({ 
        showVideo: false,
        isNavigatingVideo: true,
        videoReady: false,
        videoSrc: '',
        userPausedVideo: false, // Reset user pause flag for new video
        calculatedDots: [] // Clear dots when clearing video state
      });
      
      const videoContext = wx.createVideoContext('media-video', this);
      if (videoContext) {
        // Stop video completely and reset to clear loading state
        videoContext.stop();
        videoContext.seek(0);
      }
      
      // Pause uploaded audio but don't destroy context to avoid reloading
      if (this.audioContext) {
        this.audioContext.pause();
      }
      
      // Show video again after a delay with fresh source
      setTimeout(() => {
        this.setData({ 
          showVideo: true,
          isNavigatingVideo: false  // Reset navigation flag
        });
      }, 100);
    },

    /**
     * Start video autoplay
     */
    startVideoAutoplay() {
      // Only autoplay if this is a video post and playing is enabled
      if (this.properties.currentPost && this.properties.currentPost.type === 'video' && this.properties.isPlaying && !this.properties.isWaitingForApi) {
        const videoContext = wx.createVideoContext('media-video', this);
        if (videoContext) {
          // Ensure video starts from beginning and plays
          videoContext.seek(0);
          setTimeout(() => {
            videoContext.play();
          }, 100);
        }
      }
    },

    // Removed image preloading methods to disable caching

    /**
     * Calculate actual image size within container (aspectFit mode)
     */
    calculateContainedImageSize(containerWidth, containerHeight, imageWidth, imageHeight) {
      
      const containerRatio = containerWidth / containerHeight;
      const imageRatio = imageWidth / imageHeight;

      let displayedWidth, displayedHeight, left, top;

      if (imageRatio > containerRatio) {
        // Image is wider, fits container width exactly
        displayedWidth = containerWidth;
        displayedHeight = containerWidth / imageRatio;
        left = 0;
        top = (containerHeight - displayedHeight) / 2;
      } else {
        // Image is taller, fits container height exactly
        displayedHeight = containerHeight;
        displayedWidth = containerHeight * imageRatio;
        top = 0;
        left = (containerWidth - displayedWidth) / 2;
      }

      return { width: displayedWidth, height: displayedHeight, left, top };
    },

    /**
     * Get container dimensions
     */
    getContainerDimensions() {
      const query = this.createSelectorQuery();
      query.select('.media-container').boundingClientRect((rect) => {
        
        if (rect) {
          this.setData({
            containerWidth: rect.width,
            containerHeight: rect.height
          });
          this.calculateDotPositions();
        }
      }).exec();
    },    /**
     * Calculate dot positions based on actual image size
     */
    calculateDotPositions() {
      const { currentMedia, currentSlideIndex, containerWidth, containerHeight } = this.data;
      
      // Enhanced validation - ensure we have valid data
      if (!currentMedia || currentMedia.length === 0) {
        this.setData({ calculatedDots: [] });
        return;
      }
      
      if (currentSlideIndex < 0 || currentSlideIndex >= currentMedia.length) {
        this.setData({ calculatedDots: [] });
        return;
      }
      
      const currentItem = currentMedia[currentSlideIndex];
      if (!currentItem || !currentItem.dots) {
        this.setData({ calculatedDots: [] });
        return;
      }

      const dots = currentItem.dots;
      if (!dots || dots.length === 0 || !containerWidth || !containerHeight) {
        this.setData({ calculatedDots: [] });
        return;
      }

      // Use fallback dimensions without caching image info
      const actualImageSize = this.calculateContainedImageSize(
        containerWidth,
        containerHeight,
        1080, // fallback width
        1080  // fallback height
      );

      const calculatedDots = dots.map((dot, index) => {
        const realLeft = dot.x * actualImageSize.width + actualImageSize.left;
        const realTop = dot.y * actualImageSize.height + actualImageSize.top;
        
        return {
          ...dot,
          index,
          slideIndex: currentSlideIndex, // Add slide index to identify which slide these dots belong to
          realLeft: Math.round(realLeft),
          realTop: Math.round(realTop),
          leftPercent: (realLeft / containerWidth) * 100,
          topPercent: (realTop / containerHeight) * 100
        };
      });

      this.setData({ calculatedDots });
    },onScreenTap() {
      this.triggerEvent('screentap');
    },

    onSlideChange(e) {
      this.triggerEvent('slidechange', { current: e.detail.current });
      // Immediately clear dots and recalculate for new slide
      this.setData({ calculatedDots: [] });
      setTimeout(() => {
        this.calculateDotPositions();
      }, 50); // Reduced delay from 100ms to 50ms
    },

    onDotTap(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent('dottap', { index });
    },

    moveToPreviousSlide() {
      this.triggerEvent('previousslide');
    },

    moveToNextSlide() {
      this.triggerEvent('nextslide');
    },

    onVideoTap(e){
    },
    
    onVideoPlay() {
      // Video started playing - clear any loading states
      this.triggerEvent('videoplaying');
      
      // Clear user pause flag since video is now playing
      this.setData({ userPausedVideo: false });
      
      // Notify parent component that video is ready and playing
      const parent = this.selectOwnerComponent();
      if (parent && parent.setData) {
        parent.setData({
          isLoading: false,
          isWaitingForApi: false,
          isPlaying: true
        });
      }
    },

    onVideoPause() {
      this.triggerEvent('videopaused');
    },    onVideoEnded() {
      // Always trigger video ended event to move to next post
      // Parent component will handle navigation
      this.triggerEvent('videoended');
    },


    onVideoError(e) {
      // Video error occurred - clear loading state
      const parent = this.selectOwnerComponent();
      if (parent && parent.setData) {
        parent.setData({
          isLoading: false,
          isWaitingForApi: false
        });
      }
      
      // Show error to user
      wx.showToast({
        title: '视频加载失败',
        icon: 'none',
        duration: 2000
      });
    },

    // New video loading event handlers
    onVideoLoadStart() {
      // Video started loading - this is called when video begins to load
      // Don't set loading here as it's already managed by parent component
    },

    onVideoCanPlay() {
      // Video can start playing - clear loading states
      const parent = this.selectOwnerComponent();
      if (parent && parent.setData) {
        parent.setData({
          isLoading: false,
          isWaitingForApi: false
        });
      }
      
      // Also clear internal loading flags if they exist
      if (parent && parent.isCurrentlyLoading) {
        parent.isCurrentlyLoading = false;
      }
      
      // Start autoplay when video is ready
      this.startVideoAutoplay();
    },

    onVideoWaiting() {
      // Video is waiting for more data - this can cause infinite loading
      // Force clear loading after a timeout to prevent infinite loading
      setTimeout(() => {
        const parent = this.selectOwnerComponent();
        if (parent && parent.setData) {
          parent.setData({
            isLoading: false,
            isWaitingForApi: false
          });
        }
      }, 3000); // 3 second timeout
    },

    onVideoLoadedData() {
      // Video data has been loaded - aggressively clear loading states
      const videoContext = wx.createVideoContext('media-video', this);
      if (videoContext) {
        // Multiple attempts to clear the native loading spinner
        videoContext.seek(0);
        
        // Force play briefly to trigger proper initialization
        videoContext.play();
        setTimeout(() => {
          videoContext.pause();
          videoContext.seek(0);
          
          // Second attempt after short delay
          setTimeout(() => {
            videoContext.play();
            setTimeout(() => {
              if (!this.properties.isPlaying) {
                videoContext.pause();
              }
            }, 50);
          }, 100);
        }, 50);
      }
      
      // Clear parent loading states
      const parent = this.selectOwnerComponent();
      if (parent && parent.setData) {
        parent.setData({
          isLoading: false,
          isWaitingForApi: false
        });
      }
      
      // Start autoplay after data is loaded
      setTimeout(() => {
        this.startVideoAutoplay();
      }, 200);
    },

    onVideoTimeUpdate() {
      // Video time is updating - means it's playing properly
      // Clear any lingering loading states
      const parent = this.selectOwnerComponent();
      if (parent && parent.setData && parent.data.isLoading) {
        parent.setData({
          isLoading: false,
          isWaitingForApi: false
        });
      }
    },

    /**
     * Handle image load event to recalculate positions
     */
    onImageLoad(e) {
      // Only recalculate dot positions without caching
      setTimeout(() => {
        this.calculateDotPositions();
      }, 100);
    },

    /**
     * Set audio mode for video playback
     */
    setAudioMode(mode) {
      this.setData({ audioMode: mode });
      
      // Apply audio mode to current video if playing
      const videoContext = wx.createVideoContext('media-video', this);
      if (videoContext && this.properties.currentPost && this.properties.currentPost.type === 'video') {
        this.applyAudioMode(videoContext);
      }
    },

    /**
     * Apply audio mode settings to video
     */
    applyAudioMode(videoContext) {
      const { audioMode, currentPost } = this.data;
      
      // Check if post has uploaded audio
      const hasUploadedAudio = currentPost && currentPost.audio_url;
      
      if (!hasUploadedAudio) {
        // No uploaded audio, just play video normally
        return;
      }
      
      // Handle different audio modes
      if (audioMode === 'video') {
        // Mute uploaded audio, play only video audio
        this.muteUploadedAudio();
      } else if (audioMode === 'uploaded') {
        // Mute video audio, play only uploaded audio
        videoContext.muted = true;
        this.playUploadedAudio();
      } else {
        // Play both audio tracks
        videoContext.muted = false;
        this.playUploadedAudio();
      }
    },

    /**
     * Play uploaded audio
     */
    playUploadedAudio() {
      const { currentPost } = this.properties;
      if (!currentPost || !currentPost.audio_url) return;
      
      // Create or get audio context
      if (!this.audioContext) {
        this.audioContext = wx.createInnerAudioContext();
        this.audioContext.src = currentPost.audio_url;
        this.audioContext.loop = true;
      }
      
      this.audioContext.play();
    },

    /**
     * Mute uploaded audio
     */
    muteUploadedAudio() {
      if (this.audioContext) {
        this.audioContext.pause();
      }
    }
  }
});