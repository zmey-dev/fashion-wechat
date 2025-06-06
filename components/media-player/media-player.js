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
  },
  data: {
    // Media state
    currentSlideIndex: 0,
    isPlaying: false,
    isContinue: true,
    isLoading: false,
    showPlayIndicator: false,
    autoPlayTimer: null,

    // Template-bound computed data
    currentPost: null,
    currentPostUser: null,
    currentMedia: [],
    userComments: [],
    mediaLength: 0,

    // Computed display values
    displayTitle: "",
    displayContent: "",
    displayLikes: "",
    displayComments: "",
    displayFavorites: "",
    displayShares: "",
    displayFollowerCount: "",    displayLikeCount: "",    // UI state
    showDetail: false,
    showReportModal: false,
    detailPanelState: 'closed', // 'closed', 'half', 'full'
    tabIndex: 1, // 0: User posts, 1: Comments, 2: Details

    // Dots and interactions
    selectedDot: null,    // System information
    windowWidth: 0,
    windowHeight: 0,
    containerWidth: 0,
    containerHeight: 0,

    touchStartY: 0,
    touchStartX: 0,
    touchEndY: 0,
    touchEndX: 0,
    currentTouchY: 0,
    isVerticalSwiping: false,
    verticalTransform: 0, // Current vertical transform value
    minSwipeDistance: 50, // Minimum distance for valid swipe
    maxHorizontalThreshold: 100, // Maximum horizontal movement still considered vertical swipe
    maxTransformDistance: 150, // Maximum transform distance for visual feedback
  },  /**
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
    // Update container dimensions after component is fully rendered
    this.getContainerDimensions();
  },

  detached() {
    this.cleanup();
    
    // Remove resize event listener
    if (this.onScreenResize) {
      wx.offWindowResize(this.onScreenResize);
    }
  },
  /**
   * Component observers
   */
  observers: {
    selectedPost: function (newPost) {
      if (newPost) {
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
  methods: {    /**
     * Initialize component
     */
    initializeComponent() {
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        windowWidth: systemInfo.windowWidth,
        windowHeight: systemInfo.windowHeight,
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
      query.select('.media-player').boundingClientRect((rect) => {
        if (rect) {
          this.setData({
            containerHeight: rect.height,
            containerWidth: rect.width
          });
        }
      }).exec();
    },

    /**
     * Load post data and related information
     */
    loadPostData() {
      const { selectedPost } = this.properties;
      if (!selectedPost) return;

      const postUser = selectedPost.user || {};
      const comments = selectedPost.comments || [];

      this.setData({
        isLoading: true,
        currentSlideIndex: 0,
        selectedDot: null,
        showDetail: false,
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
          media: selectedPost.media || [],
          ...selectedPost,
        },
        currentPostUser: {
          id: postUser.id || "",
          username: postUser.username || "Unknown User",
          avatar: postUser.avatar || "",
          is_followed: postUser.is_followed || false,
          posts: postUser.posts || [],
          ...postUser,
        },
        currentMedia: selectedPost.media || [],
        mediaLength: selectedPost.media ? selectedPost.media.length : 0,
        userComments: comments,
      });

      this.updateDisplayValues();
      this.startAutoPlay();
      this.setData({ isLoading: false });
    },

    /**
     * Update computed display values for template
     */
    updateDisplayValues() {
      const { currentPost, currentPostUser } = this.data;
      if (!currentPost) return;

      this.setData({
        displayTitle: this.truncateTitle(currentPost.title, 50),
        displayContent: currentPost.content
          ? this.truncateTitle(currentPost.content, 100)
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
      this.clearAutoPlayTimer();
      if (
        this.data.isPlaying &&
        !this.data.showDetail &&
        this.data.currentPost?.type === "image"
      ) {
        const timer = setInterval(() => {
          this.moveToNextSlide();
        }, 5000);
        this.setData({ autoPlayTimer: timer });
      }
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
      if (this.data.currentPost && this.data.currentPost.type === "image") {
        this.startAutoPlay();
      }
    },

    /**
     * Play/Pause management
     */
    togglePlayPause() {
      const { isPlaying } = this.data;
      if (isPlaying) {
        this.pausePlayback();
      } else {
        this.resumePlayback();
      }
    },

    pausePlayback() {
      this.setData({ isPlaying: false });
      this.clearAutoPlayTimer();
    },

    resumePlayback() {
      this.setData({ isPlaying: true });
      this.startAutoPlay();
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
    },    onDotTap(e) {
      const { index } = e.detail;
      const { currentMedia, currentSlideIndex } = this.data;
      const media = currentMedia[currentSlideIndex];

      if (media && media.dots && media.dots[index]) {
        console.log('onDotTap called, opening detail panel');
        this.setData({
          selectedDot: media.dots[index],
          tabIndex: 2,
          showDetail: true,
          detailPanelState: 'half' // Add this line to update detail panel state
        });
        
        // Pause auto-play when detail panel opens via dot tap
        if (this.data.isPlaying) {
          console.log('Pausing auto-play as detail panel opened via dot tap');
          this.pauseAutoPlay();
        }
      }
    },

    moveToPreviousSlide() {
      const { currentSlideIndex } = this.data;
      if (currentSlideIndex > 0) {
        this.setData({ currentSlideIndex: currentSlideIndex - 1 });
      } else {
        this.moveToPreviousPost();
      }
    },

    moveToNextSlide() {
      const { currentSlideIndex, mediaLength, isContinue } = this.data;
      if (currentSlideIndex + 1 < mediaLength) {
        this.setData({ currentSlideIndex: currentSlideIndex + 1 });
      } else {
        if (isContinue) {
          this.moveToNextPost();
        } else {
          this.setData({ currentSlideIndex: 0 });
        }
      }
    },

    moveToPreviousPost() {
      this.triggerEvent("previousPost");
    },

    moveToNextPost() {
      this.triggerEvent("nextPost");
    },

    // Media Controls Events
    onPlayPause() {
      this.togglePlayPause();
    },

    onContinueToggle(e) {
      this.setData({ isContinue: e.detail.value });
    },

    onProgressTap(e) {
      const { index } = e.detail;
      this.setData({ currentSlideIndex: index });
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
          console.error("Like request failed:", err);
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
              title: newFavoriteStatus
                ? "已添加到收藏"
                : "已从收藏中移除",
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
          console.error("Favorite request failed:", err);
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
          console.error("Copy to clipboard failed:", err);
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
          console.error("Share request failed:", err);
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
          console.error("Follow request failed:", err);
          wx.showToast({
            title: "关注失败",
            icon: "none",
            duration: 1500,
          });
        },
      });
    },    onToggleDetail() {
      console.log('onToggleDetail called');
      if (isEmpty(this.properties.authUser)) {
        console.log('User not authenticated, showing login modal');
        const app = getApp();
        app.setState("showLoginModal", true);
        return;
      }
      
      const newShowDetail = !this.data.showDetail;
      console.log('Toggling detail panel:', { current: this.data.showDetail, new: newShowDetail });
      
      this.setData({ 
        showDetail: newShowDetail,
        detailPanelState: newShowDetail ? 'half' : 'closed'
      });
      
      // Pause auto-play when detail panel opens
      if (newShowDetail && this.data.isPlaying) {
        console.log('Pausing auto-play as detail panel opened');
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
    },    onCloseDetail() {
      console.log('onCloseDetail called');
      this.setData({
        showDetail: false,
        selectedDot: null,
        detailPanelState: 'closed',
      });
      
      console.log('Detail panel closed, detailPanelState set to: closed');
      
      // Resume auto-play when detail panel closes
      if (this.data.isContinue && this.data.currentPost.type === 'image' && this.data.mediaLength > 1) {
        console.log('Resuming auto-play as detail panel was closed');
        this.resumeAutoPlay();
      }
    },

    onSelectUserPost(e) {
      const { post } = e.detail;
      this.onCloseDetail();
      wx.navigateTo({
        url: `/pages/index/index?postId=${post.id}`,
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

            wx.vibrateShort();
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
          console.error("Like request failed:", err);
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
    },

    onCommentSent(e) {
      const { comments } = e.detail;
      this.setData({
        userComments: comments,
        displayComments: this.formatNumber(comments.length),
      });

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
        loading: true,
        showLoading: true,
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
          console.error("Delete request failed:", err);
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

    /**
     * Touch event handlers for vertical swipe navigation
     */
    onTouchStart(e) {
      if (this.data.showDetail || this.data.showReportModal) return;
      const touch = e.touches[0];
      this.setData({
        touchStartY: touch.pageY,
        touchStartX: touch.pageX,
        currentTouchY: touch.pageY,
        isVerticalSwiping: false,
        verticalTransform: 0,
      });
    },

    onTouchMove(e) {
      if (this.data.showDetail || this.data.showReportModal) return;
      const touch = e.touches[0];
      const { touchStartY, touchStartX, maxTransformDistance } = this.data;

      const deltaY = touch.pageY - touchStartY;
      const deltaX = Math.abs(touch.pageX - touchStartX);
      const absDeltaY = Math.abs(deltaY);

      this.setData({ currentTouchY: touch.pageY });      // Check if this is a vertical swipe
      if (absDeltaY > 10 && (absDeltaY > deltaX || deltaX < 30)) {
        this.setData({ isVerticalSwiping: true });

        // Calculate transform value with damping effect
        let transformValue = deltaY;

        // Apply damping when exceeding maximum distance
        if (Math.abs(transformValue) > maxTransformDistance) {
          const excess = Math.abs(transformValue) - maxTransformDistance;
          const dampingFactor = 0.3; // Reduce movement when exceeding limit
          transformValue =
            transformValue > 0
              ? maxTransformDistance + excess * dampingFactor
              : -maxTransformDistance - excess * dampingFactor;
        }

        this.setData({ verticalTransform: transformValue });

        // Return false to prevent default behavior
        return false;
      }
    },

    onTouchEnd(e) {
      if (this.data.showDetail || this.data.showReportModal) return;
      const touch = e.changedTouches[0];
      const {
        touchStartY,
        touchStartX,
        minSwipeDistance,
        maxHorizontalThreshold,
        isVerticalSwiping,
        verticalTransform,
      } = this.data;

      if (!isVerticalSwiping) return;

      this.setData({
        touchEndY: touch.pageY,
        touchEndX: touch.pageX,
      });

      const deltaY = touch.pageY - touchStartY;
      const deltaX = Math.abs(touch.pageX - touchStartX);      const absDeltalY = Math.abs(deltaY);

      // Check if this is a valid vertical swipe
      if (absDeltalY >= minSwipeDistance && deltaX <= maxHorizontalThreshold) {
        if (deltaY < 0) {
          // Swipe up - next post
          this.handleVerticalSwipeUp();
        } else {
          // Swipe down - previous post
          this.handleVerticalSwipeDown();
        }
      } else {
        // Invalid swipe - animate back to original position
        this.animateBackToCenter();
      }

      // Reset touch data
      this.setData({
        touchStartY: 0,
        touchStartX: 0,
        touchEndY: 0,
        touchEndX: 0,
        currentTouchY: 0,
        isVerticalSwiping: false,
      });
    },

    /**
     * Handle vertical swipe up (next post)
     */    handleVerticalSwipeUp() {
      // Animate swipe out and trigger next post
      this.animateSwipeOut("up", () => {
        this.moveToNextPost();
      });
    },

    /**
     * Handle vertical swipe down (previous post)
     */
    handleVerticalSwipeDown() {
      // Animate swipe out and trigger previous post
      this.animateSwipeOut("down", () => {
        this.moveToPreviousPost();
      });
    },    /**
     * Animate swipe out effect
     */
    animateSwipeOut(direction, callback) {
      const { containerHeight, windowHeight } = this.data;
      // Use containerHeight if available, fallback to windowHeight
      const height = containerHeight || windowHeight;
      const targetTransform = direction === "up" ? -height : height;
      this.setData({ verticalTransform: targetTransform });

      // Execute callback after animation
      setTimeout(() => {
        if (callback) callback();
        // Reset transform for next post
        this.setData({ verticalTransform: 0 });
      }, 300);
    },

    /**
     * Animate back to center when swipe is not valid
     */
    animateBackToCenter() {
      this.setData({ verticalTransform: 0 });
    },    onDetailStateChange(e) {
      const { state } = e.detail;
      console.log('Detail panel state changed to:', state);
      console.log('Previous detailPanelState:', this.data.detailPanelState);
      
      this.setData({
        detailPanelState: state
      });
      
      console.log('Updated detailPanelState to:', state);
      
      // Handle auto-play based on panel state
      if (state === 'half' || state === 'full') {
        if (this.data.isPlaying) {
          console.log('Pausing auto-play for panel state:', state);
          this.pauseAutoPlay();
        }
      } else if (state === 'closed') {
        if (this.data.isContinue && this.data.currentPost.type === 'image' && this.data.mediaLength > 1) {
          console.log('Resuming auto-play as panel closed');
          this.resumeAutoPlay();
        }
      }
    },
  },
});
