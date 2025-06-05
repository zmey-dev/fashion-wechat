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
    // 媒体状态
    currentSlideIndex: 0,
    isPlaying: false,
    isContinue: true,
    isLoading: false,
    showPlayIndicator: false,
    autoPlayTimer: null,

    // 模板绑定的计算数据
    currentPost: null,
    currentPostUser: null,
    currentMedia: [],
    userComments: [],
    mediaLength: 0,

    // 计算显示值
    displayTitle: "",
    displayContent: "",
    displayLikes: "",
    displayComments: "",
    displayFavorites: "",
    displayShares: "",
    displayFollowerCount: "",
    displayLikeCount: "",

    // UI状态
    showDetail: false,
    showReportModal: false,
    tabIndex: 1, // 0: 用户帖子, 1: 评论, 2: 详情

    // 圆点和交互
    selectedDot: null,

    // 系统信息
    windowWidth: 0,
    windowHeight: 0,

    touchStartY: 0,
    touchStartX: 0,
    touchEndY: 0,
    touchEndX: 0,
    currentTouchY: 0,
    isVerticalSwiping: false,
    verticalTransform: 0, // 当前垂直变换值
    minSwipeDistance: 50, // 有效滑动的最小距离
    maxHorizontalThreshold: 100, // 仍被视为垂直滑动的最大水平移动
    maxTransformDistance: 150, // 视觉反馈的最大变换距离
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
    },

    onToggleDetail() {
      if (isEmpty(this.properties.authUser)) {
        const app = getApp();
        app.setState("showLoginModal", true);
      }
      this.setData({ showDetail: !this.data.showDetail });
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

      this.setData({ currentTouchY: touch.pageY });

      // 判断是否为垂直滑动
      if (absDeltaY > 10 && (absDeltaY > deltaX || deltaX < 30)) {
        this.setData({ isVerticalSwiping: true });

        // 计算带阻尼效果的变换值
        let transformValue = deltaY;

        // 超过最大距离时应用阻尼
        if (Math.abs(transformValue) > maxTransformDistance) {
          const excess = Math.abs(transformValue) - maxTransformDistance;
          const dampingFactor = 0.3; // 超过限制时减少移动
          transformValue =
            transformValue > 0
              ? maxTransformDistance + excess * dampingFactor
              : -maxTransformDistance - excess * dampingFactor;
        }

        this.setData({ verticalTransform: transformValue });

        // 返回false以防止默认行为
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
      const deltaX = Math.abs(touch.pageX - touchStartX);
      const absDeltalY = Math.abs(deltaY);

      // 检查是否为有效的垂直滑动
      if (absDeltalY >= minSwipeDistance && deltaX <= maxHorizontalThreshold) {
        if (deltaY < 0) {
          // 向上滑动 - 下一个帖子
          this.handleVerticalSwipeUp();
        } else {
          // 向下滑动 - 上一个帖子
          this.handleVerticalSwipeDown();
        }
      } else {
        // 无效滑动 - 动画回到原始位置
        this.animateBackToCenter();
      }

      // 重置触摸数据
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
      // 动画滑出并触发下一个帖子
      this.animateSwipeOut("up", () => {
        this.moveToNextPost();
      });
    },

    /**
     * Handle vertical swipe down (previous post)
     */
    handleVerticalSwipeDown() {
      // 动画滑出并触发上一个帖子
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

      // 动画后执行回调
      setTimeout(() => {
        if (callback) callback();
        // 为下一个帖子重置变换
        this.setData({ verticalTransform: 0 });
      }, 300);
    },

    /**
     * Animate back to center when swipe is not valid
     */
    animateBackToCenter() {
      this.setData({ verticalTransform: 0 });
    },

    onDetailStateChange(e) {
      const { state } = e.detail;
      console.log('Detail panel state changed to:', state);
      // Additional logic can be added here based on panel state
    },
  },
});
