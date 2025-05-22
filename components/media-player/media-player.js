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
    }
  },

  /**
   * Component initial data
   */
  data: {
    // Media state
    currentSlideIndex: 0,
    isPlaying: false,
    isContinue: true,
    isLoading: false,
    
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
    
    // Touch gesture
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    isPanelSwipe: false,
    panelSwipeThreshold: 100, // pixels from right edge to trigger panel swipe
    
    // Animation
    autoPlayTimer: null,
    
    // Background audio manager
    backgroundAudioManager: null
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
      // Pause/resume media when detail panel is shown/hidden
      if (isShowing) {
        this.pauseMedia()
      } else {
        this.resumeMedia()
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
      this.setData({
        systemInfo,
        windowWidth: systemInfo.windowWidth,
        windowHeight: systemInfo.windowHeight
      })

      // Initialize background audio manager
      const backgroundAudioManager = wx.getBackgroundAudioManager()
      this.setData({ backgroundAudioManager })

      // Setup audio event listeners
      this.setupAudioListeners()

      // Load initial post data
      if (this.properties.selectedPost) {
        this.loadPostData()
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
        wx.showToast({
          title: 'Audio playback failed',
          icon: 'none'
        })
      })
    },

    /**
     * Load post data and related information
     */
    loadPostData() {
      const { selectedPost } = this.properties
      if (!selectedPost) return

      this.setData({
        isLoading: true,
        currentSlideIndex: 0,
        commentId: null,
        personalComment: '',
        selectedDot: null,
        dots: [],
        showDetail: false // Close detail panel when loading new post
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
      const { backgroundAudioManager } = this.data
      
      if (selectedPost.audio) {
        backgroundAudioManager.title = selectedPost.title || 'Media Player'
        backgroundAudioManager.src = selectedPost.audio
      }
      
      this.setData({ isPlaying: true })
    },

    /**
     * Pause media when detail panel is shown
     */
    pauseMedia() {
      const { backgroundAudioManager } = this.data
      if (this.data.isPlaying) {
        backgroundAudioManager.pause()
      }
      this.clearAutoPlayTimer()
    },

    /**
     * Resume media when detail panel is hidden
     */
    resumeMedia() {
      const { backgroundAudioManager } = this.data
      const { selectedPost } = this.properties
      
      if (selectedPost.audio) {
        backgroundAudioManager.play()
      }
      
      if (selectedPost.type === 'image') {
        this.startAutoPlay()
      }
    },

    /**
     * Setup image dots for interactive points
     */
    setupImageDots() {
      const { selectedPost } = this.properties
      const { currentSlideIndex } = this.data
      
      if (selectedPost.media && 
          selectedPost.media[currentSlideIndex] && 
          selectedPost.media[currentSlideIndex].dots) {
        this.setData({
          dots: selectedPost.media[currentSlideIndex].dots
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

      // Use selector query to get image dimensions
      wx.createSelectorQuery().in(this)
        .select('#media-image')
        .boundingClientRect((rect) => {
          if (rect && rect.width && rect.height) {
            const realPositions = dots.map(dot => ({
              top: dot.y * rect.height + rect.top,
              left: dot.x * rect.width + rect.left
            }))
            
            this.setData({ realDotsPosition: realPositions })
          }
        })
        .exec()
    },

    /**
     * Start auto play for images
     */
    startAutoPlay() {
      if (this.data.isPlaying && 
          this.properties.selectedPost.type === 'image' && 
          !this.data.showDetail) {
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
      const { selectedPost } = this.properties
      
      // Simulate API call - replace with actual API endpoint
      wx.request({
        url: `${app.globalData.apiBase}/posts/${selectedPost.id}/comments`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${app.globalData.token || ''}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            this.setData({ userComments: res.data.comments || [] })
          }
        },
        fail: (err) => {
          console.error('Failed to load comments:', err)
          this.setData({ userComments: [] })
        }
      })
    },

    /**
     * Touch event handlers
     */
    onTouchStart(e) {
      const touch = e.touches[0]
      const { windowWidth, panelSwipeThreshold } = this.data
      
      // Check if touch started from right edge (for panel swipe)
      const isPanelSwipe = touch.clientX > windowWidth - panelSwipeThreshold
      
      this.setData({
        touchStartX: touch.clientX,
        touchStartY: touch.clientY,
        touchStartTime: Date.now(),
        isPanelSwipe
      })
    },

    onTouchEnd(e) {
      const { touchStartX, touchStartY, touchStartTime, isPanelSwipe, showDetail } = this.data
      const touch = e.changedTouches[0]
      const touchEndX = touch.clientX
      const touchEndY = touch.clientY
      const touchEndTime = Date.now()
      
      const deltaX = touchEndX - touchStartX
      const deltaY = touchEndY - touchStartY
      const deltaTime = touchEndTime - touchStartTime
      
      // Minimum distance and maximum time for valid swipe
      const minDistance = 50
      const maxTime = 500
      
      if (deltaTime > maxTime) return
      
      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)
      
      // Handle panel swipe from right edge
      if (isPanelSwipe && absDeltaX > minDistance && absDeltaX > absDeltaY) {
        if (deltaX < 0) {
          // Swiped left from right edge - show detail panel
          this.setData({ showDetail: true })
        }
        return
      }
      
      // Handle panel close swipe
      if (showDetail && absDeltaX > minDistance && absDeltaX > absDeltaY) {
        if (deltaX > 0) {
          // Swiped right - hide detail panel
          this.setData({ showDetail: false })
        }
        return
      }
      
      // Don't handle media swipes when detail panel is shown
      if (showDetail) return
      
      // Determine swipe direction for media navigation
      if (absDeltaX > absDeltaY && absDeltaX > minDistance) {
        // Horizontal swipe - slide navigation
        if (deltaX > 0) {
          this.moveToPreviousSlide()
        } else {
          this.moveToNextSlide()
        }
      } else if (absDeltaY > absDeltaX && absDeltaY > minDistance) {
        // Vertical swipe - post navigation
        if (deltaY > 0) {
          this.moveToPreviousPost()
        } else {
          this.moveToNextPost()
        }
      }
    },

    /**
     * Slide navigation methods
     */
    moveToPreviousSlide() {
      const { currentSlideIndex } = this.data
      const { selectedPost } = this.properties
      
      if (currentSlideIndex > 0) {
        this.setData({ currentSlideIndex: currentSlideIndex - 1 })
        this.onSlideChange(currentSlideIndex - 1)
      } else {
        // If at first slide, move to previous post
        this.moveToPreviousPost()
      }
    },

    moveToNextSlide() {
      const { currentSlideIndex, isContinue } = this.data
      const { selectedPost } = this.properties
      
      if (currentSlideIndex + 1 < selectedPost.media.length) {
        this.setData({ currentSlideIndex: currentSlideIndex + 1 })
        this.onSlideChange(currentSlideIndex + 1)
      } else {
        // If at last slide
        if (isContinue) {
          this.moveToNextPost()
        } else {
          // Loop back to first slide
          this.setData({ currentSlideIndex: 0 })
          this.onSlideChange(0)
        }
      }
    },

    /**
     * Post navigation methods
     */
    moveToPreviousPost() {
      const { index } = this.properties
      if (index > 0) {
        this.triggerEvent('postNavigation', {
          direction: 'previous',
          newIndex: index - 1
        })
      }
    },

    moveToNextPost() {
      const { index, totalCount } = this.properties
      if (index + 1 < totalCount) {
        this.triggerEvent('postNavigation', {
          direction: 'next', 
          newIndex: index + 1
        })
      }
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
      
      // Update dots for new image
      if (this.properties.selectedPost.type === 'image') {
        this.setupImageDots()
      }
    },

    /**
     * Media control methods
     */
    onPlayPause() {
      const { backgroundAudioManager, isPlaying } = this.data
      
      if (isPlaying) {
        backgroundAudioManager.pause()
      } else {
        if (this.properties.selectedPost.audio) {
          backgroundAudioManager.play()
        }
        this.startAutoPlay()
      }
    },

    onContinueToggle(e) {
      this.setData({ isContinue: e.detail.value })
    },

    /**
     * Interaction methods
     */
    handleLike() {
      if (!this.properties.authUser) {
        this.triggerEvent('showLogin')
        return
      }

      const { selectedPost } = this.properties
      
      wx.request({
        url: `${app.globalData.apiBase}/posts/${selectedPost.id}/like`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${app.globalData.token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            this.triggerEvent('likeUpdated', res.data)
            wx.showToast({
              title: res.data.liked ? 'Liked!' : 'Unliked!',
              icon: 'success',
              duration: 1000
            })
          }
        },
        fail: (err) => {
          console.error('Like failed:', err)
          wx.showToast({
            title: 'Operation failed',
            icon: 'none'
          })
        }
      })
    },

    handleFavorite() {
      if (!this.properties.authUser) {
        this.triggerEvent('showLogin')
        return
      }

      const { selectedPost } = this.properties

      wx.request({
        url: `${app.globalData.apiBase}/posts/${selectedPost.id}/favorite`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${app.globalData.token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            this.triggerEvent('favoriteUpdated', res.data)
            wx.showToast({
              title: res.data.favorited ? 'Added to favorites!' : 'Removed from favorites!',
              icon: 'success',
              duration: 1000
            })
          }
        },
        fail: (err) => {
          console.error('Favorite failed:', err)
          wx.showToast({
            title: 'Operation failed',
            icon: 'none'
          })
        }
      })
    },

    handleShare() {
      const { selectedPost } = this.properties
      const { currentSlideIndex } = this.data
      
      const shareUrl = selectedPost.media[currentSlideIndex].url
      
      // Copy to clipboard
      wx.setClipboardData({
        data: shareUrl,
        success: () => {
          wx.showToast({
            title: 'Link copied!',
            icon: 'success',
            duration: 1000
          })
        }
      })

      // Update share count
      this.updateShareCount()
    },

    updateShareCount() {
      const { selectedPost } = this.properties
      
      wx.request({
        url: `${app.globalData.apiBase}/posts/${selectedPost.id}/share`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${app.globalData.token || ''}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            this.triggerEvent('shareUpdated', res.data)
          }
        }
      })
    },

    handleFollow() {
      if (!this.properties.authUser) {
        this.triggerEvent('showLogin')
        return
      }

      const { selectedPostUser } = this.properties

      wx.request({
        url: `${app.globalData.apiBase}/users/${selectedPostUser.id}/follow`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${app.globalData.token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            this.triggerEvent('followUpdated', res.data)
            wx.showToast({
              title: res.data.is_followed ? 'Followed!' : 'Unfollowed!',
              icon: 'success',
              duration: 1000
            })
          }
        },
        fail: (err) => {
          console.error('Follow failed:', err)
          wx.showToast({
            title: 'Operation failed',
            icon: 'none'
          })
        }
      })
    },

    /**
     * Comment methods
     */
    onCommentInput(e) {
      this.setData({ personalComment: e.detail.value })
    },

    onCommentSubmit() {
      const { personalComment, commentId, isUpdate } = this.data
      const { authUser, selectedPost } = this.properties

      if (!authUser) {
        this.triggerEvent('showLogin')
        return
      }

      if (!personalComment.trim()) {
        wx.showToast({
          title: 'Please enter a comment',
          icon: 'none'
        })
        return
      }

      const url = isUpdate 
        ? `${app.globalData.apiBase}/comments/${commentId}`
        : `${app.globalData.apiBase}/posts/${selectedPost.id}/comments`

      const method = isUpdate ? 'PUT' : 'POST'

      wx.request({
        url,
        method,
        header: {
          'Authorization': `Bearer ${app.globalData.token}`
        },
        data: {
          content: personalComment,
          parent_id: commentId
        },
        success: (res) => {
          if (res.statusCode === 200) {
            this.setData({
              personalComment: '',
              commentId: null,
              isUpdate: false
            })
            this.loadComments()
            wx.showToast({
              title: isUpdate ? 'Comment updated!' : 'Comment posted!',
              icon: 'success',
              duration: 1000
            })
          }
        },
        fail: (err) => {
          console.error('Comment operation failed:', err)
          wx.showToast({
            title: 'Operation failed',
            icon: 'none'
          })
        }
      })
    },

    onReplyComment(e) {
      const { commentId } = e.currentTarget.dataset
      if (!this.properties.authUser) {
        this.triggerEvent('showLogin')
        return
      }
      
      this.setData({ 
        commentId,
        isUpdate: false,
        personalComment: '',
        showDetail: true,
        tabIndex: 1
      })
    },

    onEditComment(e) {
      const { comment } = e.currentTarget.dataset
      this.setData({
        commentId: comment.id,
        isUpdate: true,
        personalComment: comment.content || comment.comment_text || '',
        showDetail: true,
        tabIndex: 1
      })
    },

    onDeleteComment(e) {
      const { commentId } = e.currentTarget.dataset
      
      wx.showModal({
        title: 'Delete Comment',
        content: 'Are you sure you want to delete this comment?',
        success: (res) => {
          if (res.confirm) {
            wx.request({
              url: `${app.globalData.apiBase}/comments/${commentId}`,
              method: 'DELETE',
              header: {
                'Authorization': `Bearer ${app.globalData.token}`
              },
              success: () => {
                this.loadComments()
                wx.showToast({
                  title: 'Comment deleted',
                  icon: 'success',
                  duration: 1000
                })
              },
              fail: (err) => {
                console.error('Delete comment failed:', err)
                wx.showToast({
                  title: 'Delete failed',
                  icon: 'none'
                })
              }
            })
          }
        }
      })
    },

    onCancelReply() {
      this.setData({
        commentId: null,
        isUpdate: false,
        personalComment: ''
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
        this.triggerEvent('showLogin')
        return
      }
      this.setData({ showDetail: !this.data.showDetail })
    },

    onCloseDetail() {
      this.setData({ showDetail: false })
    },

    onImagePreview() {
      const { selectedPost } = this.properties
      const { currentSlideIndex } = this.data
      
      wx.previewImage({
        current: selectedPost.media[currentSlideIndex].url,
        urls: selectedPost.media.map(media => media.url)
      })
    },

    onVideoPlay() {
      this.setData({ isPlaying: true })
    },

    onVideoPause() {
      this.setData({ isPlaying: false })
    },

    onVideoEnded() {
      if (this.data.isContinue) {
        this.moveToNextPost()
      }
    },

    /**
     * Report methods
     */
    onShowReportModal() {
      if (!this.properties.authUser) {
        this.triggerEvent('showLogin')
        return
      }
      this.setData({ showReportModal: true })
    },

    onCloseReportModal() {
      this.setData({ showReportModal: false })
    },

    /**
     * Navigation to user profile
     */
    onUserProfile() {
      const { selectedPostUser, authUser } = this.properties
      
      if (!authUser) {
        this.triggerEvent('showLogin')
        return
      }

      this.triggerEvent('navigateToProfile', {
        userId: selectedPostUser.id,
        username: selectedPostUser.username
      })
    },

    /**
     * Utility methods
     */
    truncateTitle(title, maxLength = 30) {
      if (!title) return ''
      return title.length > maxLength ? title.substring(0, maxLength) + '...' : title
    },

    formatNumber(num) {
      if (!num) return '0'
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M'
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K'
      }
      return num.toString()
    },

    /**
     * Cleanup method
     */
    cleanup() {
      this.clearAutoPlayTimer()
      
      if (this.data.backgroundAudioManager) {
        this.data.backgroundAudioManager.stop()
      }
    }
  }
})