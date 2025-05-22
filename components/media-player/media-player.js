// components/media-player/media-player.js
const app = getApp()

Component({
  /**
   * Component properties
   */
  properties: {
    selectedPost: {
      type: Object,
      value: null
    },
    selectedPostUser: {
      type: Object, 
      value: null
    },
    authUser: {
      type: Object,
      value: null
    },
    index: {
      type: Number,
      value: 0
    },
    totalCount: {
      type: Number,
      value: 0
    },
    selectedUserPosts: {
      type: Object,
      value: null
    }
  },

  /**
   * Component initial data
   */
  data: {
    // Media state
    currentSlideIndex: 0,
    isPlaying: true,
    isContinue: true,
    isLoading: false,
    showPlayIndicator: false,
    playIndicatorTimer: null,
    
    // Computed data for template binding
    currentPost: null,
    currentPostUser: null,
    currentMedia: [],
    mediaLength: 0,
    
    // Computed display values
    displayTitle: '',
    displayContent: '',
    displayLikes: '',
    displayComments: '',
    displayFavorites: '',
    displayShares: '',
    displayFollowerCount: '',
    displayLikeCount: '',
    replyIndicatorText: '',
    
    // UI state
    showDetail: false,
    showEmojiPicker: false,
    showImageModal: false,
    showReportModal: false,
    tabIndex: 1, // 0: user posts, 1: comments, 2: details
    
    // Comment state
    commentId: null,
    personalComment: '',
    isUpdate: false,
    userComments: [],
    
    // Dots and interaction
    dots: [],
    selectedDot: null,
    realDotsPosition: [],
    
    // System info
    systemInfo: {},
    windowWidth: 0,
    windowHeight: 0,
    safeAreaHeight: 0,
    
    // Touch gesture
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    isPanelSwipe: false,
    panelSwipeThreshold: 80,
    
    // Animation
    autoPlayTimer: null,
    
    // Background audio manager
    backgroundAudioManager: null,

    // Mock data for demonstration
    mockPost: {
      id: 36,
      user_id: 11,
      event_id: null,
      title: "Beautiful Heart ❤️",
      content: "A stunning heart-shaped artwork that symbolizes love and passion",
      views: 1240,
      shares: 8,
      favorites: 23,
      likes: 156,
      comments: 24,
      type: "image",
      active: true,
      is_liked: false,
      is_favorited: false,
      user: {
        id: 11,
        avatar: "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKotq0ZkPLic6yEicqMD3Fk3PuNvnaJF8phUSJjz9K7SOYEtKGUQN8CzbJ3yO4o6kV4TXBiaKX8OhCEA/132",
        username: "artcreator",
        is_followed: false,
        follower_number: 1250,
        like_number: 8940
      },
      media: [
        {
          id: 35,
          post_id: 36,
          url: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=800&h=600&fit=crop",
          preview_url: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&h=300&fit=crop",
          dots: [
            { id: 1, x: 0.3, y: 0.2, title: "Beautiful Heart", description: "This stunning heart decoration symbolizes love and affection. Made with premium materials." },
            { id: 2, x: 0.7, y: 0.6, title: "Red Rose", description: "A beautiful red rose that complements the heart perfectly, representing passion and romance." }
          ]
        },
        {
          id: 36,
          post_id: 36,
          url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop",
          preview_url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop",
          dots: [
            { id: 3, x: 0.5, y: 0.3, title: "Nature Scene", description: "A peaceful nature landscape that brings tranquility to the soul." }
          ]
        }
      ],
      audio: null
    },

    mockComments: [
      {
        id: 1,
        sender_id: 12,
        post_id: 36,
        comment_text: "这个爱心很好看！太美了",
        created_at: "2025-05-09T13:27:32.000000Z",
        updated_at: "2025-05-09T13:27:32.000000Z",
        parent_id: null,
        like: "5",
        unlike: "0",
        url: null,
        sender: {
          id: 12,
          username: "user123",
          avatar: "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKotq0ZkPLic6yEicqMD3Fk3PuNvnaJF8phUSJjz9K7SOYEtKGUQN8CzbJ3yO4o6kV4TXBiaKX8OhCEA/132"
        }
      },
      {
        id: 2,
        sender_id: 11,
        post_id: 36,
        comment_text: "过奖了，谢谢大家的支持！",
        created_at: "2025-05-09T13:28:12.000000Z",
        updated_at: "2025-05-09T13:28:12.000000Z",
        parent_id: 1,
        like: "2",
        unlike: "0",
        url: null,
        sender: {
          id: 11,
          username: "artcreator",
          avatar: "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKotq0ZkPLic6yEicqMD3Fk3PuNvnaJF8phUSJjz9K7SOYEtKGUQN8CzbJ3yO4o6kV4TXBiaKX8OhCEA/132"
        }
      },
      {
        id: 3,
        sender_id: 13,
        post_id: 36,
        comment_text: "太棒了！求教程",
        created_at: "2025-05-09T13:29:03.000000Z",
        updated_at: "2025-05-09T13:29:03.000000Z",
        parent_id: null,
        like: "8",
        unlike: "1",
        url: null,
        sender: {
          id: 13,
          username: "artlover",
          avatar: "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKotq0ZkPLic6yEicqMD3Fk3PuNvnaJF8phUSJjz9K7SOYEtKGUQN8CzbJ3yO4o6kV4TXBiaKX8OhCEA/132"
        }
      }
    ],

    mockUserPosts: [
      {
        id: 36,
        title: "Heart Art",
        type: "image",
        media: [{ url: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=300&h=300&fit=crop" }]
      },
      {
        id: 37,
        title: "Nature Beauty",
        type: "image", 
        media: [{ url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&h=300&fit=crop" }]
      },
      {
        id: 38,
        title: "Sunset",
        type: "image",
        media: [{ url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop" }]
      },
      {
        id: 39,
        title: "Ocean Waves", 
        type: "image",
        media: [{ url: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=300&h=300&fit=crop" }]
      }
    ]
  },

  /**
   * Component lifecycle
   */
  attached() {
    this.initializeComponent()
  },

  detached() {
    this.cleanup()
  },

  /**
   * Component observers
   */
  observers: {
    'selectedPost': function(newPost) {
      if (newPost) {
        this.loadPostData()
      }
    },
    'showDetail': function(isShowing) {
      if (isShowing) {
        this.pauseAutoPlay()
      } else {
        this.resumeAutoPlay()
      }
    }
  },

  /**
   * Component methods
   */
  methods: {
    /**
     * Initialize component
     */
    initializeComponent() {
      // Get system info
      const systemInfo = wx.getSystemInfoSync()
      const safeAreaHeight = systemInfo.safeArea ? systemInfo.safeArea.height : systemInfo.screenHeight
      
      this.setData({
        systemInfo,
        windowWidth: systemInfo.windowWidth,
        windowHeight: systemInfo.windowHeight,
        safeAreaHeight
      })

      // Initialize background audio manager
      const backgroundAudioManager = wx.getBackgroundAudioManager()
      this.setData({ backgroundAudioManager })

      // Setup audio event listeners
      this.setupAudioListeners()

      // Use mock data for demonstration
      this.loadMockData()
    },

    /**
     * Load mock data for demonstration
     */
    loadMockData() {
      const post = this.properties.selectedPost || this.data.mockPost
      const postUser = this.properties.selectedPostUser || this.data.mockPost.user
      
      this.setData({
        currentPost: post,
        currentPostUser: postUser,
        currentMedia: post.media || [],
        mediaLength: post.media ? post.media.length : 0,
        userComments: this.data.mockComments,
        isLoading: false
      })
      
      // Update computed display values
      this.updateDisplayValues()
      
      // Setup media with mock data
      this.setupMedia()
      
      // Setup dots if image type
      if (post.type === 'image') {
        this.setupImageDots()
        this.startAutoPlay()
      }
    },

    /**
     * Update computed display values for template
     */
    updateDisplayValues() {
      const { currentPost, currentPostUser } = this.data
      
      this.setData({
        displayTitle: this.truncateTitle(currentPost.title, 50),
        displayContent: currentPost.content ? this.truncateTitle(currentPost.content, 100) : '',
        displayLikes: this.formatNumber(currentPost.likes),
        displayComments: this.formatNumber(currentPost.comments),
        displayFavorites: this.formatNumber(currentPost.favorites),
        displayShares: this.formatNumber(currentPost.shares),
        displayFollowerCount: this.formatNumber(currentPostUser.follower_number),
        displayLikeCount: this.formatNumber(currentPostUser.like_number)
      })
      
      this.updateReplyIndicatorText()
    },

    /**
     * Update reply indicator text
     */
    updateReplyIndicatorText() {
      const { commentId, isUpdate, userComments } = this.data
      
      if (!commentId) {
        this.setData({ replyIndicatorText: '' })
        return
      }
      
      if (isUpdate) {
        this.setData({ replyIndicatorText: '编辑评论' })
        return
      }
      
      const comment = userComments.find(c => c.id === commentId)
      if (comment) {
        this.setData({ replyIndicatorText: `回复 ${comment.sender.username}` })
      } else {
        this.setData({ replyIndicatorText: '回复' })
      }
    },

    /**
     * Setup background audio event listeners
     */
    setupAudioListeners() {
      const { backgroundAudioManager } = this.data
      
      backgroundAudioManager.onPlay(() => {
        this.setData({ isPlaying: true })
      })
      
      backgroundAudioManager.onPause(() => {
        this.setData({ isPlaying: false })
        this.clearAutoPlayTimer()
      })
      
      backgroundAudioManager.onStop(() => {
        this.setData({ isPlaying: false })
        this.clearAutoPlayTimer()
      })
      
      backgroundAudioManager.onError((err) => {
        console.error('Background audio error:', err)
      })
    },

    /**
     * Handle screen tap to toggle play/pause
     */
    onScreenTap(e) {
      // Prevent bubbling to avoid conflicts with other tap events
      e.stopPropagation()
      
      // Only handle screen tap for image posts
      const { currentPost } = this.data
      if (currentPost.type !== 'image') {
        return
      }
      
      // Toggle play/pause
      this.togglePlayPause()
      
      // Show play indicator temporarily
      this.showPlayIndicatorBriefly()
    },

    /**
     * Toggle play/pause state
     */
    togglePlayPause() {
      const { isPlaying } = this.data
      
      if (isPlaying) {
        this.pausePlayback()
      } else {
        this.resumePlayback()
      }
    },

    /**
     * Pause playback
     */
    pausePlayback() {
      this.setData({ isPlaying: false })
      this.clearAutoPlayTimer()
      
      const { backgroundAudioManager } = this.data
      if (backgroundAudioManager) {
        backgroundAudioManager.pause()
      }
    },

    /**
     * Resume playback
     */
    resumePlayback() {
      this.setData({ isPlaying: true })
      this.startAutoPlay()
      
      const { backgroundAudioManager } = this.data
      const { selectedPost } = this.properties
      const { mockPost } = this.data
      const post = selectedPost || mockPost
      
      if (backgroundAudioManager && post.audio) {
        backgroundAudioManager.play()
      }
    },

    /**
     * Show play indicator briefly
     */
    showPlayIndicatorBriefly() {
      // Clear existing timer
      if (this.data.playIndicatorTimer) {
        clearTimeout(this.data.playIndicatorTimer)
      }
      
      // Show indicator
      this.setData({ showPlayIndicator: true })
      
      // Hide after 1 second
      const timer = setTimeout(() => {
        this.setData({ 
          showPlayIndicator: false,
          playIndicatorTimer: null
        })
      }, 1000)
      
      this.setData({ playIndicatorTimer: timer })
    },

    /**
     * Load post data and related information
     */
    loadPostData() {
      const { selectedPost } = this.properties
      if (!selectedPost) return

      const postUser = this.properties.selectedPostUser || selectedPost.user

      this.setData({
        isLoading: true,
        currentSlideIndex: 0,
        commentId: null,
        personalComment: '',
        selectedDot: null,
        dots: [],
        showDetail: false,
        currentPost: selectedPost,
        currentPostUser: postUser,
        currentMedia: selectedPost.media || [],
        mediaLength: selectedPost.media ? selectedPost.media.length : 0
      })

      // Reset audio
      this.resetAudio()

      // Load comments
      this.loadComments()
      
      // Setup media
      this.setupMedia()
      
      // Setup dots if image type
      if (selectedPost.type === 'image') {
        this.setupImageDots()
        this.startAutoPlay()
      }

      this.setData({ isLoading: false })
    },

    /**
     * Reset audio playback
     */
    resetAudio() {
      const { backgroundAudioManager } = this.data
      backgroundAudioManager.stop()
    },

    /**
     * Setup media (audio/video)
     */
    setupMedia() {
      const { selectedPost } = this.properties
      const { backgroundAudioManager, mockPost } = this.data
      
      const post = selectedPost || mockPost
      
      if (post.audio) {
        backgroundAudioManager.title = post.title || 'Media Player'
        backgroundAudioManager.src = post.audio
      }
      
      this.setData({ isPlaying: true })
    },

    /**
     * Pause auto play when detail panel is shown
     */
    pauseAutoPlay() {
      this.clearAutoPlayTimer()
    },

    /**
     * Resume auto play when detail panel is hidden
     */
    resumeAutoPlay() {
      const { selectedPost } = this.properties
      const { mockPost } = this.data
      const post = selectedPost || mockPost
      
      if (post.type === 'image') {
        this.startAutoPlay()
      }
    },

    /**
     * Setup image dots for interactive points
     */
    setupImageDots() {
      const { selectedPost } = this.properties
      const { currentSlideIndex, mockPost } = this.data
      
      const post = selectedPost || mockPost
      
      if (post.media && 
          post.media[currentSlideIndex] && 
          post.media[currentSlideIndex].dots) {
        this.setData({
          dots: post.media[currentSlideIndex].dots
        })
        this.calculateDotsPosition()
      } else {
        this.setData({ dots: [] })
      }
    },

    /**
     * Calculate real dots position based on image size
     */
    calculateDotsPosition() {
      const { dots, windowWidth, windowHeight } = this.data
      
      if (!dots || dots.length === 0) {
        this.setData({ realDotsPosition: [] })
        return
      }

      // Simulate image bounds for demo
      const imageWidth = windowWidth
      const imageHeight = windowHeight - 160 // Account for UI elements
      
      const realPositions = dots.map(dot => ({
        top: dot.y * imageHeight + 80, // Offset for top UI
        left: dot.x * imageWidth
      }))
      
      this.setData({ realDotsPosition: realPositions })
    },

    /**
     * Start auto play for images
     */
    startAutoPlay() {
      if (this.data.isPlaying && !this.data.showDetail) {
        this.clearAutoPlayTimer()
        const timer = setInterval(() => {
          this.moveToNextSlide()
        }, 4000)
        this.setData({ autoPlayTimer: timer })
      }
    },

    /**
     * Clear auto play timer
     */
    clearAutoPlayTimer() {
      if (this.data.autoPlayTimer) {
        clearInterval(this.data.autoPlayTimer)
        this.setData({ autoPlayTimer: null })
      }
    },

    /**
     * Load comments for the post
     */
    loadComments() {
      // Use mock data for demonstration
      this.setData({ userComments: this.data.mockComments })
    },

    /**
     * Slide navigation methods
     */
    moveToPreviousSlide() {
      const { currentSlideIndex } = this.data
      const { selectedPost } = this.properties
      const { mockPost } = this.data
      const post = selectedPost || mockPost
      
      if (currentSlideIndex > 0) {
        this.setData({ currentSlideIndex: currentSlideIndex - 1 })
        this.onSlideChange(currentSlideIndex - 1)
      } else {
        this.moveToPreviousPost()
      }
    },

    moveToNextSlide() {
      const { currentSlideIndex, isContinue } = this.data
      const { selectedPost } = this.properties
      const { mockPost } = this.data
      const post = selectedPost || mockPost
      
      if (currentSlideIndex + 1 < post.media.length) {
        this.setData({ currentSlideIndex: currentSlideIndex + 1 })
        this.onSlideChange(currentSlideIndex + 1)
      } else {
        if (isContinue) {
          this.moveToNextPost()
        } else {
          this.setData({ currentSlideIndex: 0 })
          this.onSlideChange(0)
        }
      }
    },

    /**
     * Post navigation methods
     */
    moveToPreviousPost() {
      wx.showToast({
        title: '已是第一个',
        icon: 'none',
        duration: 1000
      })
    },

    moveToNextPost() {
      wx.showToast({
        title: '已是最后一个',
        icon: 'none', 
        duration: 1000
      })
    },

    /**
     * Handle swiper slide change
     */
    onSlideChange(e) {
      let newIndex
      if (typeof e === 'number') {
        newIndex = e
      } else {
        newIndex = e.detail.current
      }
      
      this.setData({ currentSlideIndex: newIndex })
      
      const { selectedPost } = this.properties
      const { mockPost } = this.data
      const post = selectedPost || mockPost
      
      if (post.type === 'image') {
        this.setupImageDots()
      }
    },

    /**
     * Media control methods
     */
    onPlayPause() {
      this.togglePlayPause()
    },

    onContinueToggle(e) {
      this.setData({ isContinue: e.detail.value })
    },

    /**
     * Interaction methods
     */
    handleLike() {
      if (!this.properties.authUser) {
        this.showLoginToast()
        return
      }

      const { currentPost } = this.data
      const newLikeStatus = !currentPost.is_liked
      const newLikeCount = newLikeStatus ? currentPost.likes + 1 : currentPost.likes - 1

      this.setData({
        'currentPost.is_liked': newLikeStatus,
        'currentPost.likes': newLikeCount,
        displayLikes: this.formatNumber(newLikeCount)
      })

      wx.vibrateShort()
      wx.showToast({
        title: newLikeStatus ? '已点赞' : '取消点赞',
        icon: 'success',
        duration: 1000
      })
    },

    handleFavorite() {
      if (!this.properties.authUser) {
        this.showLoginToast()
        return
      }

      const { currentPost } = this.data
      const newFavoriteStatus = !currentPost.is_favorited
      const newFavoriteCount = newFavoriteStatus ? currentPost.favorites + 1 : currentPost.favorites - 1

      this.setData({
        'currentPost.is_favorited': newFavoriteStatus,
        'currentPost.favorites': newFavoriteCount,
        displayFavorites: this.formatNumber(newFavoriteCount)
      })

      wx.vibrateShort()
      wx.showToast({
        title: newFavoriteStatus ? '已收藏' : '取消收藏',
        icon: 'success',
        duration: 1000
      })
    },

    handleShare() {
      wx.showActionSheet({
        itemList: ['分享给朋友', '分享到朋友圈', '复制链接'],
        success: (res) => {
          const actions = ['分享给朋友', '分享到朋友圈', '复制链接']
          wx.showToast({
            title: actions[res.tapIndex],
            icon: 'success',
            duration: 1000
          })
          
          // Update share count
          const { currentPost } = this.data
          const newShareCount = currentPost.shares + 1
          this.setData({
            'currentPost.shares': newShareCount,
            displayShares: this.formatNumber(newShareCount)
          })
        }
      })
    },

    handleFollow() {
      if (!this.properties.authUser) {
        this.showLoginToast()
        return
      }

      const { currentPostUser } = this.data
      const newFollowStatus = !currentPostUser.is_followed

      this.setData({
        'currentPostUser.is_followed': newFollowStatus
      })

      wx.vibrateShort()
      wx.showToast({
        title: newFollowStatus ? '已关注' : '取消关注',
        icon: 'success',
        duration: 1000
      })
    },

    /**
     * Comment methods
     */
    onCommentInput(e) {
      this.setData({ personalComment: e.detail.value })
    },

    onCommentSubmit() {
      const { personalComment, commentId, isUpdate, userComments } = this.data
      const { authUser } = this.properties

      if (!authUser) {
        this.showLoginToast()
        return
      }

      if (!personalComment.trim()) {
        wx.showToast({
          title: '请输入评论内容',
          icon: 'none'
        })
        return
      }

      if (isUpdate) {
        // Update existing comment
        const updatedComments = userComments.map(comment => {
          if (comment.id === commentId) {
            return { ...comment, comment_text: personalComment }
          }
          return comment
        })
        this.setData({ userComments: updatedComments })
      } else {
        // Add new comment
        const newComment = {
          id: Date.now(),
          sender_id: authUser.id,
          post_id: this.data.mockPost.id,
          comment_text: personalComment,
          created_at: new Date().toISOString(),
          parent_id: commentId,
          like: "0",
          unlike: "0",
          url: null,
          sender: authUser
        }

        if (commentId) {
          // It's a reply - find parent and add to replies
          const updatedComments = [...userComments]
          const parentComment = updatedComments.find(c => c.id === commentId)
          if (parentComment) {
            if (!parentComment.replies) parentComment.replies = []
            parentComment.replies.push(newComment)
          }
          this.setData({ userComments: updatedComments })
        } else {
          // It's a new top-level comment
          this.setData({ userComments: [...userComments, newComment] })
        }

        // Update comment count
        const newCommentCount = this.data.currentPost.comments + 1
        this.setData({
          'currentPost.comments': newCommentCount,
          displayComments: this.formatNumber(newCommentCount)
        })
      }

      this.setData({
        personalComment: '',
        commentId: null,
        isUpdate: false
      })

      wx.showToast({
        title: isUpdate ? '评论已更新' : '评论已发布',
        icon: 'success',
        duration: 1000
      })
    },

    onReplyComment(e) {
      const { commentId } = e.currentTarget.dataset
      if (!this.properties.authUser) {
        this.showLoginToast()
        return
      }
      
      this.setData({
        commentId,
        isUpdate: false,
        personalComment: '',
        showDetail: true,
        tabIndex: 1
      })
      
      this.updateReplyIndicatorText()
    },

    onEditComment(e) {
      const { comment } = e.currentTarget.dataset
      this.setData({
        commentId: comment.id,
        isUpdate: true,
        personalComment: comment.comment_text || '',
        showDetail: true,
        tabIndex: 1
      })
      
      this.updateReplyIndicatorText()
    },

    onDeleteComment(e) {
      const { commentId } = e.currentTarget.dataset
      
      wx.showModal({
        title: '删除评论',
        content: '确定要删除这条评论吗？',
        success: (res) => {
          if (res.confirm) {
            const { userComments } = this.data
            const updatedComments = userComments.filter(comment => comment.id !== commentId)
            const newCommentCount = this.data.currentPost.comments - 1
            this.setData({ 
              userComments: updatedComments,
              'currentPost.comments': newCommentCount,
              displayComments: this.formatNumber(newCommentCount)
            })
            
            wx.showToast({
              title: '评论已删除',
              icon: 'success',
              duration: 1000
            })
          }
        }
      })
    },

    onCancelReply() {
      this.setData({
        commentId: null,
        isUpdate: false,
        personalComment: '',
        replyIndicatorText: ''
      })
    },

    /**
     * Dot interaction methods
     */
    onDotTap(e) {
      const { index } = e.currentTarget.dataset
      const { dots } = this.data
      
      if (dots[index]) {
        this.setData({
          selectedDot: dots[index],
          tabIndex: 2,
          showDetail: true
        })
      }
    },

    /**
     * UI control methods
     */
    onTabChange(e) {
      const { index } = e.currentTarget.dataset
      this.setData({ tabIndex: index })
    },

    onToggleDetail() {
      if (!this.properties.authUser) {
        this.showLoginToast()
        return
      }
      this.setData({ showDetail: !this.data.showDetail })
    },

    onCloseDetail() {
      this.setData({ 
        showDetail: false,
        selectedDot: null
      })
    },

    onImagePreview() {
      const { currentSlideIndex, currentMedia } = this.data
      
      wx.previewImage({
        current: currentMedia[currentSlideIndex].url,
        urls: currentMedia.map(media => media.url)
      })
    },

    onShowReportModal() {
      if (!this.properties.authUser) {
        this.showLoginToast()
        return
      }
      this.setData({ showReportModal: true })
    },

    onCloseReportModal() {
      this.setData({ showReportModal: false })
    },

    onUserProfile() {
      if (!this.properties.authUser) {
        this.showLoginToast()
        return
      }

      wx.showToast({
        title: '跳转到用户主页',
        icon: 'none',
        duration: 1000
      })
    },

    onSelectUserPost(e) {
      const { post } = e.currentTarget.dataset
      wx.showToast({
        title: `选择了作品: ${post.title}`,
        icon: 'none',
        duration: 1000
      })
    },

    /**
     * Utility methods
     */
    showLoginToast() {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      })
    },

    truncateTitle(title, maxLength = 30) {
      if (!title) return ''
      return title.length > maxLength ? title.substring(0, maxLength) + '...' : title
    },

    formatNumber(num) {
      if (!num) return '0'
      if (num >= 10000) {
        return (num / 10000).toFixed(1) + '万'
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K'
      }
      return num.toString()
    },

    formatTime(timestamp) {
      const now = new Date()
      const time = new Date(timestamp)
      const diff = now - time
      
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      return `${Math.floor(diff / 86400000)}天前`
    },

    /**
     * Build comment tree structure
     */
    buildCommentTree(commentList, parentId = null) {
      return commentList.filter(comment => comment.parent_id === parentId)
    },

    /**
     * Cleanup method
     */
    cleanup() {
      this.clearAutoPlayTimer()
      
      // Clear play indicator timer
      if (this.data.playIndicatorTimer) {
        clearTimeout(this.data.playIndicatorTimer)
        this.setData({ playIndicatorTimer: null })
      }
      
      if (this.data.backgroundAudioManager) {
        this.data.backgroundAudioManager.stop()
      }
    }
  }
})