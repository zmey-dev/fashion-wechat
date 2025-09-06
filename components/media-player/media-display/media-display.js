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
      observer(newVal, oldVal) {
        // When detail panel state changes, recalculate container dimensions and dots
        if (oldVal !== undefined && newVal !== oldVal) {
          // Use setTimeout to ensure DOM has updated
          setTimeout(() => {
            this.getContainerDimensions();
            // Recalculate dots with new container dimensions
            setTimeout(() => {
              this.calculateDotPositions();
            }, 100);
          }, 300); // Wait for animation to complete
        }
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
    imageDimensions: {}, // Store actual image dimensions for each image
  },

  observers: {
    'currentMedia, currentSlideIndex': function(currentMedia, currentSlideIndex) {
      // Clear previous dots immediately when media changes
      this.setData({ calculatedDots: [] });
      
      // Stop any existing video and audio before setting new source
      this.stopCurrentVideo();
      
      // Immediately update video source without delay to prevent loading
      if (currentMedia && currentMedia.length > 0 && currentMedia[0]) {
        this.setData({
          videoSrc: currentMedia[0].url || '',
          videoReady: true,
          showVideo: true,
          isNavigatingVideo: false
        });
        
        // Start video autoplay after source is set
        if (this.properties.currentPost && this.properties.currentPost.type === 'video') {
          setTimeout(() => {
            this.startVideoAutoplay();
          }, 100);
        }
      }
      
      // Calculate dot positions after DOM updates
      setTimeout(() => {
        this.calculateDotPositions();
      }, 50);
      
      // Pre-fetch image dimensions for better accuracy
      if (currentMedia && currentMedia.length > 0 && this.properties.currentPost?.type === 'image') {
        this.prefetchImageDimensions(currentMedia);
      }
    }
  },
  ready() {
    this.getContainerDimensions();
    
    // Store resize handler for cleanup
    this.onResizeHandler = () => {
      // Debounce resize events
      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }
      this.resizeTimer = setTimeout(() => {
        this.getContainerDimensions();
      }, 200);
    };
    
    // Listen for window resize events
    wx.onWindowResize && wx.onWindowResize(this.onResizeHandler);
    
    // Pre-fetch image dimensions on ready
    const { currentMedia } = this.properties;
    if (currentMedia && currentMedia.length > 0 && this.properties.currentPost?.type === 'image') {
      this.prefetchImageDimensions(currentMedia);
    }
  },

  detached() {
    // Clean up event listeners
    if (this.onResizeHandler) {
      wx.offWindowResize && wx.offWindowResize(this.onResizeHandler);
    }
    
    // Clear any pending timers
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
    
    // Stop video playback
    this.stopCurrentVideo();
    
    // Clean up audio context to prevent memory leaks
    this.destroyUploadedAudio();
  },

  methods: {
    /**
     * Stop current video playback
     */
    stopCurrentVideo() {
      const videoContext = wx.createVideoContext('media-video', this);
      if (videoContext) {
        videoContext.stop();
        videoContext.seek(0);
      }
      
      // Also destroy any uploaded audio
      this.destroyUploadedAudio();
    },
    
    /**
     * Clear video state to prevent thumbnail artifacts during navigation
     */
    clearVideoState() {
      // Destroy uploaded audio context first to prevent overlap
      this.destroyUploadedAudio();
      
      // Clear video source to stop any loading
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
      if (this.properties.currentPost && 
          this.properties.currentPost.type === 'video' && 
          this.properties.isPlaying && 
          !this.properties.isWaitingForApi) {
        const videoContext = wx.createVideoContext('media-video', this);
        if (videoContext) {
          // Just play without stop to avoid interruption
          videoContext.play();
          
          // Apply audio mode after a delay to ensure video is actively playing
          setTimeout(() => {
            // Double-check that this post is still the active one before applying audio mode
            if (this.properties.isPlaying && 
                this.properties.currentPost && 
                this.properties.currentPost.type === 'video') {
              this.applyAudioMode(videoContext);
            }
          }, 500); // 500ms delay
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
          const hasChanged = this.data.containerWidth !== rect.width || 
                           this.data.containerHeight !== rect.height;
          
          this.setData({
            containerWidth: rect.width,
            containerHeight: rect.height
          });
          
          // Only recalculate dots if dimensions actually changed
          if (hasChanged) {
            this.calculateDotPositions();
          }
        }
      }).exec();
    },    /**
     * Calculate dot positions based on actual image size
     */
    calculateDotPositions() {
      const { currentMedia, currentSlideIndex, containerWidth, containerHeight, imageDimensions } = this.data;
      
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

      // Get actual image dimensions or use defaults
      const imageUrl = currentItem.url;
      const imageDims = imageDimensions[imageUrl] || { width: 1080, height: 1080 };
      
      // Calculate actual displayed image size based on real dimensions
      const actualImageSize = this.calculateContainedImageSize(
        containerWidth,
        containerHeight,
        imageDims.width,
        imageDims.height
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
      
      // Get current image URL and check if we have dimensions
      const currentIndex = e.detail.current;
      const { currentMedia } = this.data;
      if (currentMedia && currentMedia[currentIndex]) {
        const imageUrl = currentMedia[currentIndex].url;
        
        // If we don't have dimensions for this image, fetch them
        if (imageUrl && !this.data.imageDimensions[imageUrl]) {
          wx.getImageInfo({
            src: imageUrl,
            success: (res) => {
              const imageDimensions = this.data.imageDimensions || {};
              imageDimensions[imageUrl] = {
                width: res.width,
                height: res.height
              };
              this.setData({ imageDimensions });
              this.calculateDotPositions();
            },
            fail: () => {
              // Fallback to calculating with default dimensions
              this.calculateDotPositions();
            }
          });
        } else {
          // We already have dimensions, just recalculate
          setTimeout(() => {
            this.calculateDotPositions();
          }, 50);
        }
      }
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
      
      // Apply audio mode after a delay to ensure this is the actively playing post
      setTimeout(() => {
        // Only apply audio mode if this post is still active and playing
        if (this.properties.isPlaying && 
            this.properties.currentPost && 
            this.properties.currentPost.type === 'video') {
          const videoContext = wx.createVideoContext('media-video', this);
          if (videoContext) {
            this.applyAudioMode(videoContext);
          }
        }
      }, 300); // 300ms delay
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
      
      // Start playing immediately when video can play
      if (this.properties.isPlaying) {
        const videoContext = wx.createVideoContext('media-video', this);
        if (videoContext) {
          videoContext.play();
        }
      }
    },

    onVideoWaiting() {
      // Video is waiting for more data
      // Don't show any loading indicator, let poster image remain visible
      // Immediately clear any loading states to prevent built-in loading
      const parent = this.selectOwnerComponent();
      if (parent && parent.setData) {
        parent.setData({
          isLoading: false,
          isWaitingForApi: false
        });
      }
      
      // Try to resume playback after short delay
      setTimeout(() => {
        const videoContext = wx.createVideoContext('media-video', this);
        if (videoContext) {
          videoContext.play();
        }
      }, 500);
    },

    onVideoLoadedData() {
      // Video data has been loaded - immediately start playback
      const videoContext = wx.createVideoContext('media-video', this);
      if (videoContext) {
        // Immediately play without multiple seeks to reduce loading appearance
        if (this.properties.isPlaying) {
          videoContext.play();
        }
      }
      
      // Clear parent loading states
      const parent = this.selectOwnerComponent();
      if (parent && parent.setData) {
        parent.setData({
          isLoading: false,
          isWaitingForApi: false
        });
      }
    },

    onVideoLoadedMetadata() {
      // Video metadata loaded - can start playing now
      const videoContext = wx.createVideoContext('media-video', this);
      if (videoContext && this.properties.isPlaying) {
        // Start playing immediately when metadata is ready
        videoContext.play();
      }
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
     * Pre-fetch image dimensions for accurate dot positioning
     */
    prefetchImageDimensions(mediaList) {
      if (!mediaList || mediaList.length === 0) return;
      
      mediaList.forEach((media) => {
        if (media.url && !this.data.imageDimensions[media.url]) {
          wx.getImageInfo({
            src: media.url,
            success: (res) => {
              const imageDimensions = this.data.imageDimensions || {};
              imageDimensions[media.url] = {
                width: res.width,
                height: res.height
              };
              this.setData({ imageDimensions });
              
              // Recalculate dots if this is the current image
              const currentMedia = this.data.currentMedia;
              const currentSlideIndex = this.data.currentSlideIndex;
              if (currentMedia && currentMedia[currentSlideIndex] && 
                  currentMedia[currentSlideIndex].url === media.url) {
                this.calculateDotPositions();
              }
            },
            fail: (err) => {
              console.log('Failed to get image info:', err);
            }
          });
        }
      });
    },

    /**
     * Handle image load event to recalculate positions
     */
    onImageLoad(e) {
      // Get the actual image dimensions from the load event
      const { width: imageWidth, height: imageHeight } = e.detail;
      const imageUrl = e.currentTarget.dataset.src;
      
      // Store the actual image dimensions
      const imageDimensions = this.data.imageDimensions || {};
      imageDimensions[imageUrl] = {
        width: imageWidth,
        height: imageHeight
      };
      
      this.setData({ imageDimensions });
      
      // Recalculate dot positions with actual image dimensions
      setTimeout(() => {
        this.calculateDotPositions();
      }, 100);
    },

    /**
     * Set audio mode for video playback
     */
    setAudioMode(mode) {
      this.setData({ audioMode: mode });
      
      // Apply audio mode only if this is the currently playing post
      if (!this.properties.isPlaying) {
        return;
      }
      
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
      const { audioMode } = this.data;
      const { currentPost, isPlaying } = this.properties;
      
      // Only apply audio mode if this is the currently playing post
      if (!isPlaying) {
        return;
      }
      
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
      const { currentPost, isPlaying, isWaitingForApi } = this.properties;
      const { videoReady } = this.data;
      
      // Only play audio if this is the currently active/playing post with strict conditions
      if (!currentPost || 
          !currentPost.audio_url || 
          !isPlaying || 
          isWaitingForApi ||
          !videoReady) {
        return;
      }
      
      // Additional check: ensure we're not in a transition state
      const parent = this.selectOwnerComponent();
      if (parent && (parent.data.isLoading || parent.data.isWaitingForApi || parent.isCurrentlyLoading)) {
        return;
      }
      
      // Destroy previous audio context first to prevent multiple audio playback
      this.destroyUploadedAudio();
      
      // Create new audio context for current post
      this.audioContext = wx.createInnerAudioContext();
      this.audioContext.src = currentPost.audio_url;
      this.audioContext.loop = true;
      
      // Add error handling
      this.audioContext.onError((err) => {
        console.error('Audio playback error:', err);
        this.destroyUploadedAudio();
      });
      
      this.audioContext.play();
    },

    /**
     * Mute uploaded audio
     */
    muteUploadedAudio() {
      if (this.audioContext) {
        this.audioContext.pause();
      }
    },

    /**
     * Destroy uploaded audio context to prevent memory leaks and multiple audio playback
     */
    destroyUploadedAudio() {
      if (this.audioContext) {
        try {
          // Stop and destroy the audio context completely
          this.audioContext.stop();
          this.audioContext.destroy();
        } catch (error) {
          // Handle any errors during audio context destruction
          console.warn('Error destroying audio context:', error);
        } finally {
          // Always set to null regardless of errors
          this.audioContext = null;
        }
      }
    }
  }
});