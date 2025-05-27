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

    // Computed data for template binding
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
    displayFollowerCount: "",
    displayLikeCount: "",

    // UI state
    showDetail: false,
    showReportModal: false,
    tabIndex: 1, // 0: user posts, 1: comments, 2: details

    // Dots and interaction
    selectedDot: null,

    // System info
    windowWidth: 0,
    windowHeight: 0,

    touchStartY: 0,
    touchStartX: 0,
    touchEndY: 0,
    touchEndX: 0,
    currentTouchY: 0,
    isVerticalSwiping: false,
    verticalTransform: 0, // Current vertical transform value
    minSwipeDistance: 50, // Minimum distance for a valid swipe
    maxHorizontalThreshold: 100, // Maximum horizontal movement to still consider vertical swipe
    maxTransformDistance: 150, // Maximum transform distance for visual feedback
  },

  /**
   * Component lifecycle
   */
  attached() {
    this.initializeComponent();
  },

  detached() {
    this.cleanup();
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

      if (this.properties.selectedPost) {
        this.loadPostData();
      }
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
      if (
        this.data.isPlaying &&
        !this.data.showDetail &&
        this.data.currentPost?.type === "image"
      ) {
        this.clearAutoPlayTimer();
        const timer = setInterval(() => {
          this.moveToNextSlide();
        }, 4000);
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
      const newIndex = e.detail.current || e.detail.index;
      this.setData({ currentSlideIndex: newIndex });
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
        });
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
      wx.showToast({
        title: "Go to user profile",
        icon: "none",
        duration: 1000,
      });
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
              title: newLikeStatus ? "Liked" : "Like removed",
              icon: "success",
              duration: 1000,
            });

            this.triggerEvent("like", {
              postId: currentPost.id,
              isLiked: newLikeStatus,
            });
          }
        },
        fail: (err) => {
          console.error("Like request failed:", err);
          wx.showToast({
            title: "Failed to update like",
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
                ? "Added to favorites"
                : "Removed from favorites",
              icon: "success",
              duration: 1000,
            });

            this.triggerEvent("favorite", {
              postId: currentPost.id,
              isFavorited: newFavoriteStatus,
            });
          }
        },
        fail: (err) => {
          console.error("Favorite request failed:", err);
          wx.showToast({
            title: "Failed to update favorite",
            icon: "none",
            duration: 1500,
          });
        },
      });
    },

    handleShare() {
      wx.setClipboardData({
        data: `Check out this post: ${
          this.data.currentPost.media[this.data.currentSlideIndex].url
        }`,
        success: () => {
          const { currentPost } = this.data;
          this.setData({
            "currentPost.shares": currentPost.shares + 1,
            displayShares: this.formatNumber(currentPost.shares + 1),
          });
          wx.showToast({
            title: "Link copied to clipboard",
            icon: "success",
            duration: 1000,
          });
        },
        fail: (err) => {
          console.error("Copy to clipboard failed:", err);
          wx.showToast({
            title: "Failed to copy link",
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
              title: newFollowStatus ? "Following" : "Unfollowed",
              icon: "success",
              duration: 1000,
            });

            this.triggerEvent("follow", {
              userId: currentPostUser.id,
              isFollowed: newFollowStatus,
            });
          }
        },
        fail: (err) => {
          console.error("Follow request failed:", err);
          wx.showToast({
            title: "Failed to update follow status",
            icon: "none",
            duration: 1500,
          });
        },
      });
    },

    onToggleDetail() {
      this.setData({ showDetail: !this.data.showDetail });
    },

    onShowReportModal() {
      if (!this.properties.authUser) {
        this.showLoginToast();
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
      });
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
      const { commentId,state_flag } = e.detail;
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
            wx.showToast({
              title: "Failed to like comment",
              icon: "none",
              duration: 1500,
            });
          }
        },
        fail: (err) => {
          console.error("Like request failed:", err);
          wx.showToast({
            title: "Failed to like comment",
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
      const { comment } = e.detail;
      const { userComments } = this.data;

      const updatedComments = [...userComments, comment];
      this.setData({
        userComments: updatedComments,
        displayComments: this.formatNumber(updatedComments.length),
      });

      this.triggerEvent("commentSent", e.detail);
    },

    onCommentUpdated(e) {
      const { comment } = e.detail;
      const { userComments } = this.data;

      const updatedComments = userComments.map((c) =>
        c.id === comment.id ? comment : c
      );
      this.setData({
        userComments: updatedComments,
      });

      this.triggerEvent("commentUpdated", e.detail);
    },

    onCommentDelete(e) {
      const { commentId } = e.detail;
      const { userComments } = this.data;

      const updatedComments = userComments.filter((c) => c.id !== commentId);
      this.setData({
        userComments: updatedComments,
        displayComments: this.formatNumber(updatedComments.length),
      });

      this.triggerEvent("commentDeleted", e.detail);
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
        title: "Report submitted",
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
        title: "Please login first",
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

      if (diff < 60000) return "Just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
      return `${Math.floor(diff / 86400000)} days ago`;
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
      if (this.data.showDetail) return;
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
      if (this.data.showDetail) return;
      const touch = e.touches[0];
      const { touchStartY, touchStartX, maxTransformDistance } = this.data;

      const deltaY = touch.pageY - touchStartY;
      const deltaX = Math.abs(touch.pageX - touchStartX);
      const absDeltaY = Math.abs(deltaY);

      // Update current touch position
      this.setData({ currentTouchY: touch.pageY });

      // Determine if this is a vertical swipe (reduced threshold for better detection)
      if (absDeltaY > 10 && (absDeltaY > deltaX || deltaX < 30)) {
        this.setData({ isVerticalSwiping: true });

        // Calculate transform value with damping effect
        let transformValue = deltaY;

        // Apply damping when exceeding max distance
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
      if (this.data.showDetail) return;
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
      const deltaX = Math.abs(touch.pageX - touchStartX);
      const absDeltalY = Math.abs(deltaY);

      // Check if it's a valid vertical swipe
      if (absDeltalY >= minSwipeDistance && deltaX <= maxHorizontalThreshold) {
        if (deltaY < 0) {
          // Swipe up - go to next post
          this.handleVerticalSwipeUp();
        } else {
          // Swipe down - go to previous post
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
     */
    handleVerticalSwipeUp() {
      // Add haptic feedback
      // wx.vibrateShort();

      // Animate out and trigger next post
      this.animateSwipeOut("up", () => {
        this.moveToNextPost();
      });
    },

    /**
     * Handle vertical swipe down (previous post)
     */
    handleVerticalSwipeDown() {
      // Add haptic feedback
      // wx.vibrateShort();

      // Animate out and trigger previous post
      this.animateSwipeOut("down", () => {
        this.moveToPreviousPost();
      });
    },

    /**
     * Animate swipe out effect
     */
    animateSwipeOut(direction, callback) {
      const { windowHeight } = this.data;
      const targetTransform = direction === "up" ? -windowHeight : windowHeight;

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
    },
  },
});
