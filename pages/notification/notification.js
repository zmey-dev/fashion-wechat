const { default: config } = require("../../config");

const app = getApp();

Page({
  data: {
    userInfo: {},
    activeTab: 0, // 0: friend notifications, 1: post notifications
    notifications: [],
    friendNotifications: [],
    postNotifications: [],
    expandedItems: {}, // Track which items are expanded
    loading: false,
    error: null,
    isProcessing: false, // Loading state for actions
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "获取通知失败",
        networkError: "网络错误",
        actionFailed: "操作失败",
      },
      actions: {
        processing: "处理中...",
        friendAdded: "已添加好友！",
        requestRejected: "已拒绝请求",
        notificationRemoved: "已移除通知",
      },
      time: {
        today: "今天",
        yesterday: "昨天",
        daysAgo: "天前",
      },
    },
  },

  onLoad() {
    this.setData({
      userInfo: app.globalData.userInfo || {},
    });
    
    // Subscribe to notification updates
    this.notificationHandler = (notifications) => {
      console.log("Notification page received global notification update:", notifications.length);
      this.processNotifications(notifications);
    };
    app.subscribe("notifications", this.notificationHandler);
    
    // Get initial notifications
    this.getNotifications();
  },

  onShow() {
    // Check if there are global notifications available
    const globalNotifications = app.getNotifications();
    if (globalNotifications && globalNotifications.length > 0) {
      this.processNotifications(globalNotifications);
    } else {
      this.getNotifications();
    }
  },

  onUnload() {
    // Unsubscribe from notification updates
    if (this.notificationHandler) {
      app.unsubscribe("notifications", this.notificationHandler);
    }
  },

  // Pull down to refresh
  onPullDownRefresh() {
    console.log("Refreshing notifications...");
    
    // Fetch fresh notifications
    wx.request({
      url: `${config.BACKEND_URL}/notify/get_notifications`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        if (res.data && res.data.status === "success") {
          const notifications = res.data.message || [];
          
          // Process notifications
          this.processNotifications(notifications);
          
          // Update global state
          app.updateNotifications(notifications);
          
          wx.showToast({
            title: "已刷新",
            icon: "success",
            duration: 1000,
          });
        }
        
        // Stop pull down refresh
        wx.stopPullDownRefresh();
      },
      fail: (err) => {
        console.error("Failed to refresh notifications:", err);
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
        
        // Stop pull down refresh
        wx.stopPullDownRefresh();
      },
    });
  },

  processNotifications(notifications) {
    const friendNotifications = notifications.filter(
      (item) => item.event_type !== "new_post"
    );
    const postNotifications = notifications.filter(
      (item) => item.event_type === "new_post"
    );

    this.setData({
      notifications,
      friendNotifications,
      postNotifications,
      loading: false,
      error: null,
    });
  },

  getNotifications() {
    this.setData({ loading: true });

    wx.request({
      url: `${config.BACKEND_URL}/notify/get_notifications`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        if (res.data && res.data.status === "success") {
          const notifications = res.data.message || [];
          
          // Process notifications
          this.processNotifications(notifications);
          
          // Update global state
          app.updateNotifications(notifications);
        } else {
          this.setData({
            loading: false,
            error: res.data?.message || this.data.messages.errors.loadFailed,
          });

          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        }
      },
      fail: (err) => {
        console.error("Failed to fetch notifications:", err);
        this.setData({
          loading: false,
          error: this.data.messages.errors.networkError,
        });

        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
    });
  },

  // Switch tabs
  switchTab(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      activeTab: parseInt(index),
    });
  },

  // Toggle item expansion
  toggleItem(e) {
    const { id } = e.currentTarget.dataset;
    const expandedItems = { ...this.data.expandedItems };
    expandedItems[id] = !expandedItems[id];

    this.setData({
      expandedItems,
    });
  },

  // Handle friend request (accept/reject)
  handleFriendRequest(e) {
    console.log(e);
    
    const { action, notifyId } = e.currentTarget.dataset;

    // Find the notification to get sender and receiver info
    const notification = this.data.friendNotifications.find(
      item => item.notify_id === parseInt(notifyId)
    );

    if (!notification) {
      wx.showToast({
        title: this.data.messages.errors.networkError,
        icon: "none",
      });
      return;
    }

    console.log("Notification found:", notification);
    console.log("Current user:", this.data.userInfo);

    this.setData({
      isProcessing: true
    });

    // For friend requests, the current user is the receiver
    // and the notification sender is the one who sent the request
    this.requestFriendAction({
      status: action,
      notify_id: parseInt(notifyId),
      sender_id: notification.sender_id,
      receiver_id: this.data.userInfo.id || this.data.userInfo.user_id
    });
  },

  // Handle post notification
  handlePostNotification(e) {
    const { notifyId } = e.currentTarget.dataset;

    // Find the notification to get sender and receiver info
    const notification = this.data.postNotifications.find(
      item => item.notify_id === parseInt(notifyId)
    );

    if (!notification) {
      wx.showToast({
        title: this.data.messages.errors.networkError,
        icon: "none",
      });
      return;
    }

    this.requestFriendAction({
      status: "removed",
      notify_id: parseInt(notifyId),
      sender_id: notification.sender_id,
      receiver_id: this.data.userInfo.id || this.data.userInfo.user_id
    });
  },

  // Remove notification from local data
  removeNotification(notifyId) {
    const notifications = this.data.notifications.filter(
      (item) => item.notify_id !== parseInt(notifyId)
    );
    const friendNotifications = notifications.filter(
      (item) => item.event_type !== "new_post"
    );
    const postNotifications = notifications.filter(
      (item) => item.event_type === "new_post"
    );

    this.setData({
      notifications,
      friendNotifications,
      postNotifications,
    });

    // Update global state
    app.updateNotifications(notifications);
  },

  requestFriendAction(data) {
    console.log("Sending friend action request:", data);
    
    wx.request({
      url: `${config.BACKEND_URL}/friend/handle_friend`,
      method: "POST",
      data: data,
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        this.setData({
          isProcessing: false
        });

        if (res.data && res.data.status === "success") {
          const actionText =
            data.status === "accept"
              ? this.data.messages.actions.friendAdded
              : data.status === "declined"
              ? this.data.messages.actions.requestRejected
              : this.data.messages.actions.notificationRemoved;

          wx.showToast({
            title: actionText,
            icon: "success",
          });

          this.removeNotification(data.notify_id);
        } else {
          console.error("Friend action failed:", res.data);
          if (res.data.msg)
            wx.showToast({
              title: res.data.msg,
              icon: "error",
            });
        }
      },
      fail: (err) => {
        this.setData({
          isProcessing: false
        });
        console.error("Friend action request failed:", err);

        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
    });
  },

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return this.data.messages.time.today;
    } else if (diffDays === 2) {
      return this.data.messages.time.yesterday;
    } else if (diffDays <= 7) {
      return `${diffDays - 1}${this.data.messages.time.daysAgo}`;
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  },

  navigateToUserProfile(e) {
    const { userId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/profile/profile?userId=${userId}`,
    });
  },

  navigateToPost(e) {
    const { postId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/post/post-detail?postId=${postId}`,
    });
  },
});
