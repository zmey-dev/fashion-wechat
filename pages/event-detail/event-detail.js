const { default: config } = require("../../config");

Page({
  data: {
    eventId: null,
    event: {},
    posts: [],
    loading: false,
    hasMore: true,
    currentPage: 1,
    pageSize: 15,
    userInfo: null,
    currentDate: '',
    currentTime: '',
    canJoinEvent: false,
    viewOnly: false,
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载失败，请稍后重试",
        networkError: "网络错误，请检查网络连接",
        joinFailed: "报名失败，请重试",
      },
      success: {
        joinSuccess: "报名成功",
      },
      time: {
        justNow: "刚刚",
        minutesAgo: "分钟前",
        hoursAgo: "小时前",
        daysAgo: "天前",
      },
    },
  },

  onLoad: function (options) {
    const eventId = options.eventId;
    const viewOnly = options.viewOnly === 'true';
    
    if (!eventId) {
      wx.navigateBack();
      return;
    }

    this.setData({
      eventId: eventId,
      viewOnly: viewOnly,
      userInfo: getApp().globalData.userInfo || {}
    });

    this.initializePage();
  },

  onShow: function () {
    this.updateCurrentTime();
    this.onRefresh();
  },

  initializePage: function () {
    this.updateCurrentTime();
    this.loadEventInfo();
    this.loadPosts(true);
  },

  updateCurrentTime: function () {
    const now = new Date();
    const currentDate = this.formatDate(now);
    const currentTime = this.formatTime(now);
    
    this.setData({
      currentDate: currentDate,
      currentTime: currentTime
    });
  },

  formatDate: function (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
  },

  formatTime: function (date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  formatEventDate: function (dateString) {
    if (!dateString) return "未设定";
    try {
      const dateRegex = /^(\d{4})-(\d{2})-(\d{2})/;
      const match = dateString.match(dateRegex);
      
      if (match) {
        const [_, year, month, day] = match;
        return `${year}年${month}月${day}日`;
      } else {
        return dateString;
      }
    } catch (e) {
      return dateString;
    }
  },

  loadEventInfo: function () {
    wx.request({
      url: `${config.BACKEND_URL}/event`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === 'success') {
          console.log("Event data loaded successfully:", res.data.events);
          console.log("Event ID:", this.data.eventId);
          
            const event = res.data.events.find(e => e.id == this.data.eventId);
          if (!event) {
            this.showToast("活动不存在或已被删除");
            wx.navigateBack();
            return;
          }
          
          // Process HTML content for rich-text display
          const processedEvent = {
            ...event,
            description: this.processHtmlContent(event.description)
          };
          
          const canJoin = this.checkCanJoinEvent(event);
          
          this.setData({
            event: processedEvent,
            canJoinEvent: canJoin
          });
        } else {
          this.showToast(this.data.messages.errors.loadFailed);
        }
      },
      fail: () => {
        this.showToast(this.data.messages.errors.networkError);
      }
    });
  },

  checkCanJoinEvent: function (event) {
    const { userInfo, viewOnly } = this.data;
    
    // If view only mode, cannot join
    if (viewOnly) return false;
    
    // Check if event has ended
    const now = new Date();
    const endDate = new Date(event.end_date);
    if (endDate < now) return false;
    
    if (userInfo.role !== 'user') return false;
    
    // Check if user's university matches or other schools are allowed
    const universityMatch = userInfo.university_id === event.user.university_id;
    const allowOtherSchool = event.allow_other_school;
    
    if (!universityMatch && !allowOtherSchool) return false;
    
    // Check if event has capacity limit
    if (event.allow_limit && event.students_count >= event.limit) return false;
    
    return true;
  },

  loadPosts: function (refresh = false) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });

    const requestData = {
      scope: this.data.pageSize,
      eventId: this.data.eventId,
      isDiscover: true
    };

    // Add exist_post_ids for pagination (not refresh)
    if (!refresh && this.data.posts.length > 0) {
      requestData.exist_post_ids = this.data.posts.map(post => post.id);
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts_event_discover/${this.data.eventId}`,
      method: 'GET',
      data: requestData,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === 'success') {
          const newPosts = res.data.posts || [];
          
          // Format timestamps
          newPosts.forEach(post => {
            post.timeAgo = this.formatTimeAgo(post.created_at);
          });

          if (refresh) {
            // Reset data for refresh
            this.setData({
              posts: newPosts,
              hasMore: res.data.has_more || false,
              currentPage: 1
            });
          } else {
            // Append new posts for pagination
            this.setData({
              posts: [...this.data.posts, ...newPosts],
              hasMore: res.data.has_more || false,
              currentPage: this.data.currentPage + 1
            });
          }
        } else {
          this.showToast(this.data.messages.errors.loadFailed);
        }
      },
      fail: () => {
        this.showToast(this.data.messages.errors.networkError);
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  onJoinEvent: function () {
    if (!this.data.canJoinEvent) {
      this.showToast("无法参加此活动");
      return;
    }

    // Navigate to create post for event
    wx.navigateTo({
      url: `/pages/upload/upload?eventId=${this.data.eventId}&type=event`
    });
  },

  onPostTap: function (e) {
    const { postId, index } = e.currentTarget.dataset;
    
    // Navigate to post detail with eventId
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?postId=${postId}&index=${index}&eventId=${this.data.eventId}`
    });
  },

  onLikePost: function (e) {
    e.stopPropagation();
    
    const { postId, index } = e.currentTarget.dataset;
    
    wx.request({
      url: `${config.BACKEND_URL}/post/like`,
      method: 'POST',
      data: { post_id: postId },
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === 'success') {
          // Update local post data
          const posts = [...this.data.posts];
          const post = posts[index];
          
          if (post.likes_exists) {
            post.likes_exists = false;
            post.likes = Math.max(0, post.likes - 1);
          } else {
            post.likes_exists = true;
            post.likes = post.likes + 1;
          }
          
          this.setData({ posts: posts });
        }
      },
      fail: () => {
        this.showToast(this.data.messages.errors.networkError);
      }
    });
  },

  onRefresh: function () {
    this.loadPosts(true);
  },

  onScrollToTop: function () {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts(false);
    }
  },

  formatTimeAgo: function (dateStr) {
    const now = new Date();
    const postDate = new Date(dateStr);
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (diffInSeconds < 60) {
      return this.data.messages.time.justNow;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}${this.data.messages.time.minutesAgo}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}${this.data.messages.time.hoursAgo}`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}${this.data.messages.time.daysAgo}`;
    }
  },

  showToast: function (title) {
    wx.showToast({
      title: title,
      icon: 'none',
      duration: 2000
    });
  },

  // Process HTML content for rich-text component
  processHtmlContent(htmlString) {
    if (!htmlString) return '';
    
    // Add inline styles to common HTML elements for rich-text component
    let processedHtml = htmlString;
    
    // Style headings
    processedHtml = processedHtml.replace(
      /<h([1-6])([^>]*)>/g, 
      '<h$1$2 style="color: #ff6b6b; font-weight: 700; margin: 24rpx 0 16rpx 0;">'
    );
    
    // Style paragraphs
    processedHtml = processedHtml.replace(
      /<p([^>]*)>/g, 
      '<p$1 style="margin: 0 0 16rpx 0; line-height: 1.6; color: #2d1810;">'
    );
    
    // Style strong/bold text
    processedHtml = processedHtml.replace(
      /<(strong|b)([^>]*)>/g, 
      '<$1$2 style="color: #ff4757; font-weight: 700;">'
    );
    
    // Style emphasis/italic text
    processedHtml = processedHtml.replace(
      /<(em|i)([^>]*)>/g, 
      '<$1$2 style="color: #ff9f43; font-style: italic;">'
    );
    
    // Style links
    processedHtml = processedHtml.replace(
      /<a([^>]*)>/g, 
      '<a$1 style="color: #ff6b6b; text-decoration: underline;">'
    );
    
    // Style blockquotes
    processedHtml = processedHtml.replace(
      /<blockquote([^>]*)>/g, 
      '<blockquote$1 style="background: rgba(255, 107, 107, 0.1); border-left: 4rpx solid #ff6b6b; margin: 16rpx 0; padding: 16rpx 24rpx; border-radius: 8rpx;">'
    );
    
    // Style code
    processedHtml = processedHtml.replace(
      /<code([^>]*)>/g, 
      '<code$1 style="background: rgba(255, 159, 67, 0.2); color: #8B4513; padding: 4rpx 8rpx; border-radius: 4rpx; font-family: monospace;">'
    );
    
    // Style lists
    processedHtml = processedHtml.replace(
      /<(ul|ol)([^>]*)>/g, 
      '<$1$2 style="margin: 16rpx 0; padding-left: 32rpx; color: #2d1810;">'
    );
    
    processedHtml = processedHtml.replace(
      /<li([^>]*)>/g, 
      '<li$1 style="margin: 8rpx 0; line-height: 1.5;">'
    );
    
    return processedHtml;
  },
});