// pages/notification/notification.js
Page({
  data: {
    activeTab: 0, // 0: friend notifications, 1: post notifications
    notifications: [],
    friendNotifications: [],
    postNotifications: [],
    expandedItems: {} // Track which items are expanded
  },

  onLoad() {
    this.loadNotifications();
  },

  // Load notifications from your API or storage
  loadNotifications() {
    // Replace this with your actual API call
    // For demo purposes, using mock data
    const mockNotifications = [
      {
        notify_id: 1,
        event_type: "add_friend",
        type: "add_friend",
        sender_id: 101,
        receiver_id: 102,
        sender_name: "John Doe",
        sender_avatar: "/images/avatar1.png",
        message: "Hello! I'd like to add you as a friend.",
        updated_at: "2025-05-29T10:30:00Z"
      },
      {
        notify_id: 2,
        event_type: "new_post",
        type: "new_post",
        sender_id: 103,
        receiver_id: 102,
        sender_name: "Jane Smith",
        sender_avatar: "/images/avatar2.png",
        message: "Check out my new post about WeChat Mini Programs!",
        updated_at: "2025-05-29T09:15:00Z"
      }
    ];

    const friendNotifications = mockNotifications.filter(item => item.event_type !== "new_post");
    const postNotifications = mockNotifications.filter(item => item.event_type === "new_post");

    this.setData({
      notifications: mockNotifications,
      friendNotifications,
      postNotifications
    });
  },

  // Switch between tabs
  switchTab(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      activeTab: parseInt(index)
    });
  },

  // Toggle item expansion
  toggleItem(e) {
    const { id } = e.currentTarget.dataset;
    const expandedItems = { ...this.data.expandedItems };
    expandedItems[id] = !expandedItems[id];
    
    this.setData({
      expandedItems
    });
  },

  // Handle friend request actions
  handleFriendRequest(e) {
    const { action, notifyId } = e.currentTarget.dataset;
    
    wx.showLoading({
      title: 'Processing...'
    });

    // Replace with your actual API call
    this.requestFriendAction({
      status: action,
      notify_id: notifyId
    }).then(() => {
      wx.hideLoading();
      wx.showToast({
        title: action === 'accept' ? 'Friend Added!' : 'Request Declined',
        icon: 'success'
      });
      
      // Remove notification from list
      this.removeNotification(notifyId);
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({
        title: 'Operation Failed',
        icon: 'error'
      });
    });
  },

  // Handle post notification removal
  handlePostNotification(e) {
    const { notifyId } = e.currentTarget.dataset;
    
    this.requestFriendAction({
      status: 'removed',
      notify_id: notifyId
    }).then(() => {
      wx.showToast({
        title: 'Notification Removed',
        icon: 'success'
      });
      
      this.removeNotification(notifyId);
    });
  },

  // Remove notification from local data
  removeNotification(notifyId) {
    const notifications = this.data.notifications.filter(item => item.notify_id !== parseInt(notifyId));
    const friendNotifications = notifications.filter(item => item.event_type !== "new_post");
    const postNotifications = notifications.filter(item => item.event_type === "new_post");

    this.setData({
      notifications,
      friendNotifications,
      postNotifications
    });
  },

  // API request function (replace with your actual implementation)
  requestFriendAction(data) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'YOUR_API_ENDPOINT/handle-friend',
        method: 'POST',
        data: data,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(res);
          }
        },
        fail: reject
      });
    });
  },

  // Format date for display
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toISOString().split('T')[0];
    }
  }
});