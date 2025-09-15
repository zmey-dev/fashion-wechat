const { default: config } = require("../../config");
const { USER_ROLES } = require("../../services/constants");

Page({
  data: {
    currentEventIndex: 0,
    autoRotationTimer: null,
    showRulesModal: false,
    showDeleteModal: false,
    selectedEvent: null,
    events: [], // Active events
    pastEvents: [], // Past events
    loading: false,
    error: null,
    isTeacher: false, // Teacher role flag
    userInfo: null, // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      processing: "处理中...",
      errors: {
        loadFailed: "加载活动失败",
        networkError: "网络错误",
        eventFull: "活动已满",
        schoolRestriction: "此活动仅限同校学生参加",
        notSet: "未设置",
        deleteError: "删除活动失败",
        updateError: "编辑活动失败",
        hasParticipants: "已有参与者的活动不能删除",
      },
      actions: {        participate: "参加",
        join: "加入活动",
        agree: "同意",
        close: "关闭",
        edit: "编辑",
        delete: "删除",
        confirmDelete: "确认删除",
        cancel: "取消",
        viewDetails: "查看详情",
        teacherJoin: "参与活动",
      },
      status: {
        active: "进行中",
        past: "已结束",
        upcoming: "即将开始",
      },
      confirmMessages: {
        deleteEvent: "确定要删除这个活动吗？此操作无法撤销。",
      },
    },
  },
  onLoad(options) {
    // Get user info and check if teacher
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};



    this.setData({
      userInfo: userInfo,
      isTeacher: userInfo.role == USER_ROLES.TEACHER,
    });
    // Load event data
    this.fetchEvents();
  },

  startAutoRotation() {
    // Clear any existing timer
    this.stopAutoRotation();
    
    // Only start rotation if there are multiple events
    if (this.data.events.length > 1) {
      this.setData({
        autoRotationTimer: setInterval(() => {
          const nextIndex = (this.data.currentEventIndex + 1) % this.data.events.length;
          this.setData({
            currentEventIndex: nextIndex
          });
        }, 15000) // 15 seconds
      });
    }
  },

  stopAutoRotation() {
    if (this.data.autoRotationTimer) {
      clearInterval(this.data.autoRotationTimer);
      this.setData({
        autoRotationTimer: null
      });
    }
  },
  onShow() {
    // Refresh events whenever page is shown
    // Also refresh user info in case role changed
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};

    this.setData({
      userInfo: userInfo,
      isTeacher: userInfo.role === USER_ROLES.TEACHER,
    });
    
    // Start auto rotation when page is shown
    this.startAutoRotation();

    this.fetchEvents();
  },

  onHide() {
    // Stop auto rotation when page is hidden
    this.stopAutoRotation();
  },

  onUnload() {
    // Stop auto rotation when page is unloaded
    this.stopAutoRotation();
  },

  // Fetch event data from API
  fetchEvents() {
    this.setData({ loading: true });
    getApp().showGlobalLoading();

    wx.request({
      url: `${config.BACKEND_URL}/event`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        if (res.data && res.data.status === "success") {
          const allEvents = res.data.events || [];

          // Current date at start of day for comparison
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          // Separate active and past events
          // Events are active until the end of their end_date (inclusive)
          const activeEvents = allEvents.filter((event) => {
            const endDate = new Date(event.end_date);
            endDate.setHours(23, 59, 59, 999); // Set to end of day
            return endDate >= now;
          });

          const pastEvents = allEvents.filter((event) => {
            const endDate = new Date(event.end_date);
            endDate.setHours(23, 59, 59, 999); // Set to end of day
            return endDate < now;
          });
          this.setData({
            events: activeEvents,
            pastEvents: pastEvents,
            loading: false,
            error: null,
          });
          
          // Start auto rotation after events are loaded
          this.startAutoRotation();          // Initialize selected event
          if (activeEvents.length > 0) {
            // Process HTML content for the first event
            const processedEvent = {
              ...activeEvents[0],
              description: this.processHtmlContent(activeEvents[0].description)
            };
            
            this.setData({
              currentEventIndex: 0,
              selectedEvent: processedEvent,
            });
          } else {
            // Reset selected event and index if no active events
            this.setData({
              currentEventIndex: 0,
              selectedEvent: null,
            });
          }
        } else {
          this.setData({
            loading: false,
            error: res.data?.msg || this.data.messages.errors.loadFailed,
          });

          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
          getApp().hideGlobalLoading();
        }
      },
      fail: (err) => {

        this.setData({
          loading: false,
          error: this.data.messages.errors.networkError,
        });
        getApp().hideGlobalLoading();

        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
      complete: () => {
        getApp().hideGlobalLoading();
      },
    });
  }, // Handle swiper change
  onSwiperChange(e) {
    const currentIndex = e.detail.current;    // Verify the index is valid
    if (currentIndex >= 0 && currentIndex < this.data.events.length) {
      const selectedEvent = this.data.events[currentIndex];
      
      // Process HTML content for rich-text display
      const processedEvent = {
        ...selectedEvent,
        description: this.processHtmlContent(selectedEvent.description)
      };

      this.setData({
        currentEventIndex: currentIndex,
        selectedEvent: processedEvent,
      });



    } else {

    }
  }, // Handle event card selection
  onEventSelect(e) {
    const index = e.currentTarget.dataset.index;    // Verify the index is valid
    if (index >= 0 && index < this.data.events.length) {
      const selectedEvent = this.data.events[index];
      
      // Process HTML content for rich-text display
      const processedEvent = {
        ...selectedEvent,
        description: this.processHtmlContent(selectedEvent.description)
      };

      this.setData({
        currentEventIndex: index,
        selectedEvent: processedEvent,
      });



    } else {

    }
  }, // Handle participate button click
  onParticipate() {
    const event = this.data.selectedEvent;
    if (!event) return;

    // Navigate directly to event detail page for both teachers and students
    wx.navigateTo({
      url: `/pages/event-detail/event-detail?eventId=${event.id}`,
    });
  },

  // Close rules modal
  onCloseRulesModal() {
    this.setData({
      showRulesModal: false,
    });
  },

  // Handle past event click
  onPastEventClick(e) {
    const eventId = e.currentTarget.dataset.id;
    if (!eventId) return;

    // Navigate directly to event detail page to view posts
    wx.navigateTo({
      url: `/pages/event-detail/event-detail?eventId=${eventId}&viewOnly=true`,
    });
  }, // Handle rules agreement
  onAgreeRules() {
    this.setData({
      showRulesModal: false,
    });

    // Navigate to event detail page for both teachers and students
    wx.navigateTo({
      url: `/pages/event-detail/event-detail?eventId=${this.data.selectedEvent.id}`,
    });
  },  // Join event
  joinEvent() {
    const event = this.data.selectedEvent;
    if (!event) return;

    wx.navigateTo({
      url: `/pages/post/create-post?eventId=${event.id}&type=event`,
    });
  },
  
  // Handle teacher participation in an event
  onTeacherParticipate() {
    const event = this.data.selectedEvent;
    if (!event) return;
    
    // Close the modal
    this.setData({
      showRulesModal: false,
    });
    
    // Show loading
    this.setData({
      loading: true
    });
    
    // Use a teacher-specific API endpoint to join the event
    wx.request({
      url: `${config.BACKEND_URL}/teacher/event/${event.id}/join`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApp().globalData.userInfo?.token}`
      },
      success: (res) => {
        this.setData({
          loading: false
        });
        
        if (res.data && res.data.status === 'success') {
          wx.showToast({
            title: '已成功参与活动',
            icon: 'success'
          });
          
          // Navigate to event detail page
          setTimeout(() => {
            wx.navigateTo({
              url: `/pages/event-detail/event-detail?eventId=${event.id}`
            });
          }, 1500);
          
          // Refresh events list
          this.fetchEvents();
        } else {
          wx.showToast({
            title: res.data?.msg || '参与活动失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        this.setData({
          loading: false
        });

        
        wx.showToast({
          title: '参与活动失败，请重试',
          icon: 'none'
        });
      }
    });
  },// Teacher functions - Update event
  onUpdateEvent() {
    const event = this.data.selectedEvent;
    if (!event) return;

    // Check if user is teacher and owns this event
    if (!this.data.isTeacher) {
      wx.showToast({
        title: "无权限操作",
        icon: "none",
      });
      return;
    }

    // Check if current teacher owns this event
    if (!this.canManageEvent(event)) {
      wx.showToast({
        title: "只能编辑自己创建的活动",
        icon: "none",
      });
      return;
    }

    // Navigate to event creation page in edit mode
    wx.navigateTo({
      url: `/pages/event-create/event-create?eventId=${event.id}&mode=edit`,
    });
  },

  // Teacher functions - Create new event
  onCreateEvent() {
    // Check if user is teacher
    if (!this.data.isTeacher) {
      wx.showToast({
        title: "无权限操作",
        icon: "none",
      });
      return;
    }

    // Navigate to event creation page in create mode
    wx.navigateTo({
      url: "/pages/event-create/event-create?mode=create",
    });
  }, // Teacher functions - Show delete confirmation
  onDeleteEvent() {
    const event = this.data.selectedEvent;
    if (!event) return;

    // Check if user is teacher and owns this event
    if (!this.data.isTeacher) {
      wx.showToast({
        title: "无权限操作",
        icon: "none",
      });
      return;
    }

    // Check if current teacher owns this event
    if (!this.canManageEvent(event)) {
      wx.showToast({
        title: "只能删除自己创建的活动",
        icon: "none",
      });
      return;
    }
    // Check if event has participants
    if (event.students_count && event.students_count > 0) {
      wx.showToast({
        title: this.data.messages.errors.hasParticipants,
        icon: "none",
        duration: 2000,
      });
      return;
    }

    // Use WeChat standard modal
    wx.showModal({
      title: "删除活动",
      content: this.data.messages.confirmMessages.deleteEvent,
      confirmText: "删除",
      confirmColor: "#FF4949",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) {
          this.performDeleteEvent();
        }
      },
    });
  },

  // Close delete confirmation modal (deprecated, kept for compatibility)
  onCloseDeleteModal() {
    this.setData({
      showDeleteModal: false,
    });
  }, // Perform the event deletion
  performDeleteEvent() {
    const event = this.data.selectedEvent;
    if (!event) return;

    // Double-check that event has no participants
    if (event.students_count && event.students_count > 0) {
      wx.showToast({
        title: this.data.messages.errors.hasParticipants,
        icon: "none",
        duration: 2000,
      });
      return;
    }

    this.setData({
      loading: true,
    });

    // Using WeChat standard request approach instead of EventService
    wx.request({
      url: `${config.BACKEND_URL}/teacher/event/${event.id}`,
      method: "DELETE",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        if (res.data && res.data.status === "success") {
          wx.showToast({
            title: "活动删除成功",
            icon: "success",
          });

          // Refresh events list
          this.fetchEvents();
        } else {
          wx.showToast({
            title: res.data?.msg || this.data.messages.errors.deleteError,
            icon: "none",
          });

          this.setData({
            loading: false,
          });
        }
      },
      fail: (err) => {

        this.setData({
          loading: false,
        });

        wx.showToast({
          title: this.data.messages.errors.deleteError,
          icon: "none",
        });
      },
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
    const months = [
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
      "8月",
      "9月",
      "10月",
      "11月",
      "12月",
    ];
    return `${date.getFullYear()}年${
      months[date.getMonth()]
    }${date.getDate()}日`;
  },

  // Get event status text in Chinese
  getEventStatus(event) {
    if (!event) return "";

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
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    };

    return `${formatTime(start)} - ${formatTime(end)}`;
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
