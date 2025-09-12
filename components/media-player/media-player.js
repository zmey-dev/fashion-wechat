const { default: config } = require("../../config");
const { isEmpty } = require("../../utils/isEmpty");

// components/media-player/media-player.js
Component({
  properties: {
    // Single post to display
    post: {
      type: Object,
      value: null,
      observer: function(newPost, oldPost) {
        if (!newPost) return;
        // Always load post immediately when it changes or when component is first rendered
        if (!this.data.currentPost || !oldPost || newPost.id !== oldPost.id) {
          this.loadPost(newPost);
        }
      }
    },
    // Authentication user
    authUser: {
      type: Object,
      value: null,
    },
    // Event context (optional)
    eventId: {
      type: String,
      value: null,
    },
    isEventExpired: {
      type: Boolean,
      value: false,
    },
    // Control playback state
    isPlaying: {
      type: Boolean,
      value: false,
      observer: function(newVal, oldVal) {
        // Only handle if value actually changed
        if (newVal !== oldVal && oldVal !== undefined) {
          this.handlePlayStateChange(newVal);
        }
      }
    },
    // Continue mode
    isContinue: {
      type: Boolean,
      value: false
    },
  },
  data: {
    // Current post data
    currentPost: null,
    currentPostUser: null,
    currentMedia: [],
    userComments: [],
    mediaLength: 0,
    
    // Media playback state
    currentSlideIndex: 0,
    autoPlayTimer: null,
    // isPlaying removed - use properties.isPlaying instead
    showPlayIndicator: false,
    
    // Audio modes
    audioMode: "both",
    showAudioModeSelector: false,
    
    // UI state
    showDetail: false,
    showReportModal: false,
    detailPanelState: "closed",
    tabIndex: 1,
    selectedDot: null,
    
    // Display values
    displayTitle: "",
    displayContent: "",
    displayLikes: "",
    displayComments: "",
    displayFavorites: "",
    displayShares: "",
    displayFollowerCount: "",
    
    // Event state
    shouldHideUserInfo: false,
    
    // System
    windowWidth: 0,
    windowHeight: 0,
    containerWidth: 0,
    containerHeight: 0,
  },
  /**
   * Component lifecycle
   */
  attached() {
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
    this.getContainerDimensions();
  },

  detached() {
    this.cleanup();
    if (this.onScreenResize) {
      wx.offWindowResize(this.onScreenResize);
    }
  },
  /**
   * Component observers
   */
  observers: {
    showDetail: function (isShowing) {
      if (isShowing) {
        this.pauseAutoPlay();
      } else if (this.data.isPlaying && this.data.currentPost?.type === 'image') {
        this.resumeAutoPlay();
      }
      setTimeout(() => this.getContainerDimensions(), 300);
    },
  },

  /**
   * Component methods
   */
  methods: {
    /**
     * Initialize component
     */
    initializeComponent() {
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        windowWidth: systemInfo.windowWidth,
        windowHeight: systemInfo.windowHeight,
      });
      this.getContainerDimensions();
    },

    /**
     * Handle play state change from property
     */
    handlePlayStateChange(shouldPlay) {
      if (!this.data.currentPost) return;
      
      // Don't set isPlaying in data - it's already in properties
      
      if (shouldPlay) {
        this.startPlayback();
      } else {
        this.stopPlayback();
      }
    },

    /**
     * Start playback
     */
    startPlayback() {
      if (!this.data.currentPost) return;
      
      // Prevent multiple starts
      if (this._startingPlayback) return;
      this._startingPlayback = true;
      
      this.clearAutoPlayTimer();
      
      if (this.data.currentPost.type === 'image') {
        this.startAutoPlay();
        this._startingPlayback = false;
      } else if (this.data.currentPost.type === 'video') {
        const mediaDisplay = this.selectComponent('.media-display');
        if (mediaDisplay && mediaDisplay.startVideoAutoplay) {
          setTimeout(() => {
            mediaDisplay.startVideoAutoplay();
            this._startingPlayback = false;
          }, 100);
        } else {
          this._startingPlayback = false;
        }
      } else {
        this._startingPlayback = false;
      }
    },

    /**
     * Stop playback
     */
    stopPlayback() {
      // Reset flag when stopping
      this._startingPlayback = false;
      
      this.clearAutoPlayTimer();
      
      const mediaDisplay = this.selectComponent('.media-display');
      if (mediaDisplay) {
        if (mediaDisplay.stopVideo) {
          mediaDisplay.stopVideo();
        }
        if (mediaDisplay.destroyUploadedAudio) {
          mediaDisplay.destroyUploadedAudio();
        }
      }
    },

    /**
     * Load and setup post data
     */
    loadPost(post) {
      if (!post) return;
      
      // Clear any existing state
      this.clearAutoPlayTimer();
      this.setData({ 
        currentSlideIndex: 0,
        selectedDot: null,
        showDetail: false 
      });
      
      // Process post data
      const postUser = post.user || {};
      const comments = post.comments || [];
      const media = (post.media || []).map(item => {
        if (item && item.url) {
          const cleanUrl = item.url.split('#')[0];
          return { ...item, url: cleanUrl };
        }
        return item;
      });
      
      // Check event context
      let shouldHideUserInfo = false;
      if (this.properties.eventId) {
        shouldHideUserInfo = this.properties.eventId && !this.properties.isEventExpired;
      }
      
      // Set post data
      this.setData({
        currentPost: { ...post, media },
        currentPostUser: postUser,
        currentMedia: media,
        mediaLength: media.length,
        userComments: comments,
        shouldHideUserInfo: shouldHideUserInfo
      });
      
      this.updateDisplayValues();
      
      // Preloading is handled by parent page to avoid duplicates
      
      // Start playback if needed
      if (this.data.isPlaying) {
        this.startPlayback();
      }
    },
    
    // Removed preloadFirstMedia - preloading is handled by parent page

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
     * Auto play management for images
     */
    startAutoPlay() {
      if (this.data.currentPost?.type !== "image" || this.data.showDetail) {
        return;
      }
      
      this.clearAutoPlayTimer();
      
      const timer = setInterval(() => {
        this.moveToNextSlide();
      }, 5000);
      this.setData({ autoPlayTimer: timer });
    },

    clearAutoPlayTimer() {
      if (this.data.autoPlayTimer) {
        clearInterval(this.data.autoPlayTimer);
        this.setData({ autoPlayTimer: null });
      }
    },

    pauseAutoPlay() {
      this.clearAutoPlayTimer();
    },

    resumeAutoPlay() {
      if (this.data.isPlaying && this.data.currentPost?.type === 'image') {
        this.startAutoPlay();
      }
    },

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
      const newState = !this.properties.isPlaying;
      // Don't set isPlaying - it should be controlled by parent
      this.handlePlayStateChange(newState);
      this.showPlayIndicatorBriefly();
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
          detailPanelState: "half",
        });
      }
    },


    moveToNextSlide() {
      const { currentSlideIndex, mediaLength, currentPost } = this.data;
      
      if (currentPost?.type !== 'image' || !this.data.isPlaying) {
        return;
      }
      
      if (currentSlideIndex + 1 < mediaLength) {
        this.setData({ currentSlideIndex: currentSlideIndex + 1 });
      } else {
        // Last slide reached
        if (this.properties.isContinue) {
          // Trigger event to move to next post
          this.clearAutoPlayTimer();
          this.triggerEvent('imageSlideEnded');
        } else {
          // Loop back to first slide
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

    // Video ended event handler
    onVideoEnded() {
      const { currentPost } = this.data;
      
      // Check if this is a video post and continue is enabled
      if (currentPost?.type === 'video' && this.properties.isContinue) {
        // Trigger event to move to next post
        this.triggerEvent('videoEnded');
      }
      // If continue is false, video will loop automatically
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
      if (this.data.isPlaying && this.data.currentPost?.type === "image") {
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

    // Continue Toggle Event
    onContinueToggle(e) {
      const { value } = e.detail;
      // Trigger event to parent component
      this.triggerEvent('continueToggled', { value });
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
      this.setData({ detailPanelState: state });

      // Handle auto-play based on panel state
      if (state === "half" || state === "full") {
        this.pauseAutoPlay();
      } else if (state === "closed" && this.data.isPlaying && this.data.currentPost?.type === "image") {
        this.resumeAutoPlay();
      }
    },

  },
});
