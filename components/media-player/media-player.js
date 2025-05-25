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
    isPlaying: true,
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
          id: selectedPost.id || '',
          title: selectedPost.title || '',
          content: selectedPost.content || '',
          type: selectedPost.type || 'image',
          likes: selectedPost.likes || 0,
          favorites: selectedPost.favorites || 0,
          shares: selectedPost.shares || 0,
          comments: comments,
          is_liked: selectedPost.is_liked || false,
          is_favorited: selectedPost.is_favorited || false,
          event_id: selectedPost.event_id || null,
          media: selectedPost.media || [],
          ...selectedPost
        },
        currentPostUser: {
          id: postUser.id || '',
          username: postUser.username || 'Unknown User',
          avatar: postUser.avatar || '',
          is_followed: postUser.is_followed || false,
          posts: postUser.posts || [],
          ...postUser
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
        displayFollowerCount: currentPostUser.posts
          ? this.formatNumber(currentPostUser.posts.length)
          : "0",
        displayLikeCount: this.formatNumber(currentPost.likes),
      });
    },

    /**
     * Auto play management
     */
    startAutoPlay() {
      if (this.data.isPlaying && !this.data.showDetail && this.data.currentPost?.type === 'image') {
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
      this.triggerEvent('previousPost');
    },

    moveToNextPost() {
      this.triggerEvent('nextPost');
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
      if (!this.properties.authUser) {
        this.showLoginToast();
        return;
      }

      const { currentPost } = this.data;
      const newLikeStatus = !currentPost.is_liked;
      const newLikeCount = newLikeStatus
        ? currentPost.likes + 1
        : currentPost.likes - 1;

      this.setData({
        "currentPost.is_liked": newLikeStatus,
        "currentPost.likes": newLikeCount,
        displayLikes: this.formatNumber(newLikeCount),
      });

      wx.vibrateShort();
      wx.showToast({
        title: newLikeStatus ? "Liked" : "Like removed",
        icon: "success",
        duration: 1000,
      });

      this.triggerEvent('like', {
        postId: currentPost.id,
        isLiked: newLikeStatus
      });
    },

    handleFavorite() {
      if (!this.properties.authUser) {
        this.showLoginToast();
        return;
      }

      const { currentPost } = this.data;
      const newFavoriteStatus = !currentPost.is_favorited;
      const newFavoriteCount = newFavoriteStatus
        ? currentPost.favorites + 1
        : currentPost.favorites - 1;

      this.setData({
        "currentPost.is_favorited": newFavoriteStatus,
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

      this.triggerEvent('favorite', {
        postId: currentPost.id,
        isFavorited: newFavoriteStatus
      });
    },

    handleShare() {
      wx.showActionSheet({
        itemList: ["Share with friends", "Share to feed", "Copy link"],
        success: (res) => {
          const actions = ["Share with friends", "Share to feed", "Copy link"];
          wx.showToast({
            title: actions[res.tapIndex],
            icon: "success",
            duration: 1000,
          });

          const { currentPost } = this.data;
          const newShareCount = currentPost.shares + 1;
          this.setData({
            "currentPost.shares": newShareCount,
            displayShares: this.formatNumber(newShareCount),
          });

          this.triggerEvent('share', {
            postId: currentPost.id,
            shareType: res.tapIndex
          });
        },
      });
    },

    handleFollow() {
      if (!this.properties.authUser) {
        this.showLoginToast();
        return;
      }

      const { currentPostUser } = this.data;
      const newFollowStatus = !currentPostUser.is_followed;

      this.setData({
        "currentPostUser.is_followed": newFollowStatus,
      });

      wx.vibrateShort();
      wx.showToast({
        title: newFollowStatus ? "Following" : "Unfollowed",
        icon: "success",
        duration: 1000,
      });

      this.triggerEvent('follow', {
        userId: currentPostUser.id,
        isFollowed: newFollowStatus
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
      wx.showToast({
        title: `Selected post: ${post.title}`,
        icon: "none",
        duration: 1000,
      });
      this.triggerEvent('selectUserPost', { post });
    },

    // Comment Events from comment-tree component
    onCommentLike(e) {
      this.triggerEvent('commentLike', e.detail);
    },

    onCommentSent(e) {
      const { comment } = e.detail;
      const { userComments } = this.data;
      
      const updatedComments = [...userComments, comment];
      this.setData({
        userComments: updatedComments,
        displayComments: this.formatNumber(updatedComments.length)
      });

      this.triggerEvent('commentSent', e.detail);
    },

    onCommentUpdated(e) {
      const { comment } = e.detail;
      const { userComments } = this.data;
      
      const updatedComments = userComments.map(c => 
        c.id === comment.id ? comment : c
      );
      this.setData({
        userComments: updatedComments
      });

      this.triggerEvent('commentUpdated', e.detail);
    },

    onCommentDelete(e) {
      const { commentId } = e.detail;
      const { userComments } = this.data;
      
      const updatedComments = userComments.filter(c => c.id !== commentId);
      this.setData({
        userComments: updatedComments,
        displayComments: this.formatNumber(updatedComments.length)
      });

      this.triggerEvent('commentDeleted', e.detail);
    },

    onImagePreview(e) {
      const { url } = e.detail;
      wx.previewImage({
        urls: [url],
        current: url
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
      
      this.triggerEvent('reportSubmitted', {
        postId: this.data.currentPost.id,
        reason: option
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
  },
});