const { default: config } = require("../../config");

Page({
  data: {
    currentEventIndex: 0,
    showRulesModal: false,
    selectedEvent: null,
    events: [], // Active events
    pastEvents: [], // Past events
    loading: false,
    error: null,
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载活动失败",
        networkError: "网络错误",
        eventFull: "活动已满",
        schoolRestriction: "此活动仅限同校学生参加",
        notSet: "未设置"
      },
      actions: {
        participate: "参加",
        join: "加入活动",
        agree: "同意",
        close: "关闭"
      },
      status: {
        active: "进行中",
        past: "已结束",
        upcoming: "即将开始"
      }
    }
  },

  onLoad(options) {
    // Load event data
    this.fetchEvents();
  },
  
  onShow() {
    // Refresh events whenever page is shown
    this.fetchEvents();
  },

  // Fetch event data from API
  fetchEvents() {
    this.setData({ loading: true });
    
    wx.request({
      url: `${config.BACKEND_URL}/event`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApp().globalData.userInfo?.token}`
      },
      success: (res) => {
        if (res.data && res.data.status === 'success') {
          const allEvents = res.data.events || [];
          
          // Current date
          const now = new Date();
          
          // Separate active and past events
          const activeEvents = allEvents.filter(
            event => new Date(event.end_date) >= now
          );
          
          const pastEvents = allEvents.filter(
            event => new Date(event.end_date) < now
          );
          
          this.setData({
            events: activeEvents,
            pastEvents: pastEvents,
            loading: false,
            error: null
          });
          
          // Initialize selected event
          if (activeEvents.length > 0) {
            this.setData({
              selectedEvent: activeEvents[0]
            });
          }
        } else {
          this.setData({
            loading: false,
            error: res.data?.msg || this.data.messages.errors.loadFailed
          });
          
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('Failed to fetch events:', err);
        this.setData({
          loading: false,
          error: this.data.messages.errors.networkError
        });
        
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: 'none'
        });
      }
    });
  },

  // Handle swiper change
  onSwiperChange(e) {
    const currentIndex = e.detail.current;
    this.setData({
      currentEventIndex: currentIndex,
      selectedEvent: this.data.events[currentIndex]
    });
  },

  // Handle event card selection
  onEventSelect(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentEventIndex: index,
      selectedEvent: this.data.events[index]
    });
  },

  // Handle participate button click
  onParticipate() {
    const event = this.data.selectedEvent;
    if (!event) return;

    // Get current user info
    const userInfo = getApp().globalData.userInfo || {};

    // Check participation limit
    if (event.allow_limit && event.students_count >= event.limit) {
      wx.showToast({
        title: this.data.messages.errors.eventFull,
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // Check if other school students are allowed
    if (!event.allow_other_school && 
        userInfo.university_id !== event.user.university_id) {
      wx.showToast({
        title: this.data.messages.errors.schoolRestriction,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // Show rules modal
    this.setData({
      showRulesModal: true
    });
  },

  // Close rules modal
  onCloseRulesModal() {
    this.setData({
      showRulesModal: false
    });
  },

  // Handle rules agreement
  onAgreeRules() {
    this.setData({
      showRulesModal: false
    });
    
    // Navigate to event detail page
    wx.navigateTo({
      url: `/pages/event-detail/event-detail?eventId=${this.data.selectedEvent.id}`
    });
  },
  
  // Join event
  joinEvent() {
    const event = this.data.selectedEvent;
    if (!event) return;
    
    wx.navigateTo({
      url: `/pages/post/create-post?eventId=${event.id}&type=event`
    });
  },
  
  // Format date for display
  formatDate(dateString) {
    if (!dateString) return this.data.messages.errors.notSet;
    
    const date = new Date(dateString);
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    return `${date.getFullYear()}年${months[date.getMonth()]}${date.getDate()}日`;
  },

  // Get event status text in Chinese
  getEventStatus(event) {
    if (!event) return '';
    
    const now = new Date();
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    
    if (now < startDate) {
      return this.data.messages.status.upcoming;
    } else if (now >= startDate && now <= endDate) {
      return this.data.messages.status.active;
    } else {
      return this.data.messages.status.past;
    }
  },

  // Format event time for display
  formatEventTime(startDate, endDate) {
    if (!startDate || !endDate) return this.data.messages.errors.notSet;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Format time in Chinese style
    const formatTime = (date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };
    
    return `${formatTime(start)} - ${formatTime(end)}`;
  }
});