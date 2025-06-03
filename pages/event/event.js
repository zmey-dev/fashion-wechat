const { default: config } = require("../../config");

Page({
  data: {
    currentEventIndex: 0,
    showRulesModal: false,
    selectedEvent: null,
    events: [], // Active events
    pastEvents: [], // Past events
    loading: false,
    error: null
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
            error: res.data?.message || 'Failed to load events.'
          });
          
          wx.showToast({
            title: 'Failed to load events',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('Failed to fetch events:', err);
        this.setData({
          loading: false,
          error: 'Network error occurred.'
        });
        
        wx.showToast({
          title: 'Network error occurred',
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
        title: 'Event is full',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // Check if other school students are allowed
    if (!event.allow_other_school && 
        userInfo.university_id !== event.user.university_id) {
      wx.showToast({
        title: 'This event is only for same school students',
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
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
});