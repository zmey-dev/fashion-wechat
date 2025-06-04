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
    this.getNotifications();
  },

  onShow() {
    this.getNotifications();
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

    wx.showLoading({
      title: this.data.messages.actions.processing,
    });

    this.requestFriendAction({
      status: action,
      notify_id: notifyId,
    });
  },

  // Handle post notification
  handlePostNotification(e) {
    const { notifyId } = e.currentTarget.dataset;

    this.requestFriendAction({
      status: "removed",
      notify_id: notifyId,
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
  },

  requestFriendAction(data) {
    wx.request({
      url: `${config.BACKEND_URL}/friend/handle_friend`,
      method: "POST",
      data: data,
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
      success: (res) => {
        wx.hideLoading();

        if (res.data && res.data.status === "success") {
          const actionText =
            data.status === "accept"
              ? this.data.messages.actions.friendAdded
              : data.status === "reject"
              ? this.data.messages.actions.requestRejected
              : this.data.messages.actions.notificationRemoved;

          wx.showToast({
            title: actionText,
            icon: "success",
          });

          this.removeNotification(data.notify_id);
        } else {
          if (res.data.msg)
            wx.showToast({
              title: res.data.msg,
              icon: "error",
            });
        }
      },
      fail: (err) => {
        wx.hideLoading();
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
