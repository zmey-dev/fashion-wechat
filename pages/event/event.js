const { default: config } = require("../../config");
const { EventService } = require("../../services/api");
const { USER_ROLES } = require("../../services/constants");

Page({
  data: {
    currentEventIndex: 0,
    showRulesModal: false,
    showDeleteModal: false,
    selectedEvent: null,
    events: [], // Active events
    pastEvents: [], // Past events
    loading: false,
    error: null,
    isTeacher: false, // Teacher role flag
    userInfo: null,
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载活动失败",
        networkError: "网络错误",
        eventFull: "活动已满",
        schoolRestriction: "此活动仅限同校学生参加",
        notSet: "未设置",
        deleteError: "删除活动失败",
        updateError: "编辑活动失败"
      },
      actions: {
        participate: "参加",
        join: "加入活动",
        agree: "同意",
        close: "关闭",
        edit: "编辑",
        delete: "删除",
        confirmDelete: "确认删除",
        cancel: "取消"
      },
      status: {
        active: "进行中",
        past: "已结束",
        upcoming: "即将开始"
      },
      confirmMessages: {
        deleteEvent: "确定要删除这个活动吗？此操作无法撤销。"
      }
    }
  },  onLoad(options) {
    // Get user info and check if teacher
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    
    console.log('Event page - User info:', userInfo);
    console.log('Event page - Is teacher:', userInfo.role === USER_ROLES.TEACHER);
    
    this.setData({
      userInfo: userInfo,
      isTeacher: userInfo.role === USER_ROLES.TEACHER
    });
    
    // Load event data
    this.fetchEvents();
  },
    onShow() {
    // Refresh events whenever page is shown
    // Also refresh user info in case role changed
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    
    this.setData({
      userInfo: userInfo,
      isTeacher: userInfo.role === USER_ROLES.TEACHER
    });
    
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
            
            console.log('Selected event:', activeEvents[0]);
            console.log('Event owner ID:', activeEvents[0].user?.id);
            console.log('Current user ID:', this.data.userInfo?.id);
            console.log('Can manage event:', this.canManageEvent(activeEvents[0]));
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
    const selectedEvent = this.data.events[currentIndex];
    
    this.setData({
      currentEventIndex: currentIndex,
      selectedEvent: selectedEvent
    });
    
    console.log('Swiper changed to event:', selectedEvent?.title);
    console.log('Can manage this event:', this.canManageEvent(selectedEvent));
  },
  // Handle event card selection
  onEventSelect(e) {
    const index = e.currentTarget.dataset.index;
    const selectedEvent = this.data.events[index];
    
    this.setData({
      currentEventIndex: index,
      selectedEvent: selectedEvent
    });
    
    console.log('Event selected:', selectedEvent?.title);
    console.log('Can manage this event:', this.canManageEvent(selectedEvent));
  },
  // Handle participate button click
  onParticipate() {
    const event = this.data.selectedEvent;
    if (!event) return;

    // If teacher, show event details without participation logic
    if (this.data.isTeacher) {
      this.setData({
        showRulesModal: true
      });
      return;
    }

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
    
    // Only students can join events
    if (!this.data.isTeacher) {
      // Navigate to event detail page
      wx.navigateTo({
        url: `/pages/event-detail/event-detail?eventId=${this.data.selectedEvent.id}`
      });
    }
  },
    // Join event
  joinEvent() {
    const event = this.data.selectedEvent;
    if (!event) return;
    
    wx.navigateTo({
      url: `/pages/post/create-post?eventId=${event.id}&type=event`
    });
  },
  // Teacher functions - Update event
  onUpdateEvent() {
    const event = this.data.selectedEvent;
    if (!event) return;
    
    // Check if user is teacher and owns this event
    if (!this.data.isTeacher) {
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      });
      return;
    }
    
    // Check if current teacher owns this event
    if (!this.canManageEvent(event)) {
      wx.showToast({
        title: '只能编辑自己创建的活动',
        icon: 'none'
      });
      return;
    }
    
    // For now, navigate to upload page with event context
    // In a complete implementation, you would create a dedicated event-edit page
    wx.showToast({
      title: '活动编辑功能开发中',
      icon: 'none',
      duration: 2000
    });
    
    // Placeholder for event editing navigation
    // wx.navigateTo({
    //   url: `/pages/event-create/event-create?eventId=${event.id}&mode=edit`
    // });
  },
  // Teacher functions - Show delete confirmation
  onDeleteEvent() {
    const event = this.data.selectedEvent;
    if (!event) return;
    
    // Check if user is teacher and owns this event
    if (!this.data.isTeacher) {
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      });
      return;
    }
    
    // Check if current teacher owns this event
    if (!this.canManageEvent(event)) {
      wx.showToast({
        title: '只能删除自己创建的活动',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      showDeleteModal: true
    });
  },

  // Close delete confirmation modal
  onCloseDeleteModal() {
    this.setData({
      showDeleteModal: false
    });
  },

  // Confirm delete event
  onConfirmDelete() {
    const event = this.data.selectedEvent;
    if (!event) return;
    
    this.setData({
      showDeleteModal: false,
      loading: true
    });

    EventService.deleteEvent(event.id)
      .then((res) => {
        if (res.status === 'success') {
          wx.showToast({
            title: '活动删除成功',
            icon: 'success'
          });
          
          // Refresh events list
          this.fetchEvents();
        } else {
          throw new Error(res.msg || this.data.messages.errors.deleteError);
        }
      })
      .catch((error) => {
        console.error('Delete event failed:', error);
        this.setData({
          loading: false
        });
        
        wx.showToast({
          title: error.message || this.data.messages.errors.deleteError,
          icon: 'none'
        });
      });
  },

  // Check if current user can manage the event (is teacher and owns the event)
  canManageEvent(event) {
    if (!this.data.isTeacher || !event || !this.data.userInfo) {
      return false;
    }
    
    // Check if current teacher created this event
    return event.user && event.user.id === this.data.userInfo.id;
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