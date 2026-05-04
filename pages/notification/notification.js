const { default: config } = require("../../config");

const app = getApp();

Page({
  data: {
    userInfo: {},
    activeTab: 0, // 0: friend notifications, 1: post notifications
    notifications: [],
    friendNotifications: [],
    postNotifications: [],
    expandedItems: {},
    readNotifications: {},
    lockedNotifications: {},
    unreadFriendCount: 0,
    unreadPostCount: 0,
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

      this.processNotifications(notifications);
    };
    app.subscribe("notifications", this.notificationHandler);
    
    this.loadReadStatus();
    this.loadLockedStatus();
    this.getNotifications();
  },

  onShow() {
    this.loadReadStatus();
    this.loadLockedStatus();
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
    const isPostEvent = (item) =>
      item.event_type === "new_post" || item.event_type === "company_new_post";
    const friendNotifications = notifications.filter((item) => !isPostEvent(item));
    const postNotifications = notifications.filter(isPostEvent);

    const lockedSet = {};
    notifications.forEach((n) => {
      if (n.locked_at) lockedSet[String(n.notify_id)] = true;
    });

    const readSet = this.data.readNotifications || {};
    const unreadFriendCount = friendNotifications.filter(
      (n) => !readSet[String(n.notify_id)]
    ).length;
    const unreadPostCount = postNotifications.filter(
      (n) => !readSet[String(n.notify_id)]
    ).length;

    this.setData({
      notifications,
      friendNotifications,
      postNotifications,
      lockedNotifications: lockedSet,
      unreadFriendCount,
      unreadPostCount,
      loading: false,
      error: null,
    });
  },

  onPostNotificationTap(e) {
    const { postId, notifyId } = e.currentTarget.dataset;

    if (postId) {
      this.markAsRead(notifyId);
      wx.navigateTo({
        url: `/pages/post-detail/post-detail?postId=${postId}`,
      });
      return;
    }

    this.toggleItem({ currentTarget: { dataset: { id: notifyId } } });
  },

  markAsRead(notifyId) {
    try {
      const readIds = wx.getStorageSync("read_notifications") || [];
      const id = String(notifyId);
      if (!readIds.includes(id)) {
        readIds.push(id);
        wx.setStorageSync("read_notifications", readIds);

        const currentCount = app.getNotificationCount() || 0;
        if (currentCount > 0) {
          app.updateNotifications(this.data.notifications);
          app.globalData.notificationCount = currentCount - 1;
          app.setState("notificationCount", currentCount - 1);
        }
      }
      const readSet = {};
      readIds.forEach((rid) => { readSet[rid] = true; });
      this.updateUnreadCounts(readSet);
    } catch (e) {}
  },

  loadReadStatus() {
    try {
      const readIds = wx.getStorageSync("read_notifications") || [];
      const readSet = {};
      readIds.forEach((rid) => { readSet[rid] = true; });
      this.setData({ readNotifications: readSet });
    } catch (e) {}
  },

  updateUnreadCounts(readSet) {
    const unreadFriendCount = this.data.friendNotifications.filter(
      (n) => !readSet[String(n.notify_id)]
    ).length;
    const unreadPostCount = this.data.postNotifications.filter(
      (n) => !readSet[String(n.notify_id)]
    ).length;
    this.setData({ readNotifications: readSet, unreadFriendCount, unreadPostCount });
  },

  onLockTap(e) {
    const { notifyId } = e.currentTarget.dataset;
    const id = String(notifyId);
    const isLocked = !!this.data.lockedNotifications[id];

    if (isLocked) {
      wx.showModal({
        title: "解锁消息",
        content: "解锁后该消息将在30天后自动删除，确定要解锁吗？",
        confirmText: "解锁",
        cancelText: "取消",
        success: (res) => {
          if (res.confirm) {
            this.toggleLock(id, false);
          }
        },
      });
    } else {
      wx.showModal({
        title: "锁定消息",
        content: "锁定后该消息将永久保留，不会被自动删除。确定要锁定吗？",
        confirmText: "锁定",
        cancelText: "取消",
        success: (res) => {
          if (res.confirm) {
            this.toggleLock(id, true);
          }
        },
      });
    }
  },

  toggleLock(notifyId, lock) {
    const token = this.data.userInfo?.token;
    if (!token) return;

    wx.request({
      url: `${config.BACKEND_URL}/notify/toggle_lock`,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: { notify_id: parseInt(notifyId), locked: lock },
      success: (res) => {
        if (res.data.status === "success") {
          const lockedSet = { ...this.data.lockedNotifications };
          if (lock) {
            lockedSet[notifyId] = true;
          } else {
            delete lockedSet[notifyId];
          }
          this.setData({ lockedNotifications: lockedSet });
          wx.showToast({ title: lock ? "已锁定" : "已解锁", icon: "success" });
        } else if (res.data.msg) {
          wx.showToast({ title: res.data.msg, icon: "none" });
        }
      },
    });
  },

  loadLockedStatus() {
    const notifications = this.data.notifications || [];
    const lockedSet = {};
    notifications.forEach((n) => {
      if (n.locked_at) lockedSet[String(n.notify_id)] = true;
    });
    this.setData({ lockedNotifications: lockedSet });
  },

  getNotifications() {
    this.setData({ loading: true });
    getApp().showGlobalLoading();

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

  handlePostNotification(e) {
    const { notifyId } = e.currentTarget.dataset;

    const notification = this.data.postNotifications.find(
      item => String(item.notify_id) === String(notifyId)
    );

    if (!notification) {
      wx.showToast({
        title: this.data.messages.errors.networkError,
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "删除通知",
      content: "确定要删除这条通知吗？",
      confirmText: "删除",
      confirmColor: "#ff4757",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;

        const isPersistedId = typeof notifyId === "number" ||
          (typeof notifyId === "string" && /^\d+$/.test(notifyId));

        if (!isPersistedId) {
          this.removeNotification(notifyId);
          return;
        }

        this.requestFriendAction({
          status: "removed",
          notify_id: parseInt(notifyId),
          sender_id: notification.sender_id,
          receiver_id: this.data.userInfo.id || this.data.userInfo.user_id
        });
      },
    });
  },

  // Remove notification from local data
  removeNotification(notifyId) {
    const isPostEvent = (item) =>
      item.event_type === "new_post" || item.event_type === "company_new_post";
    const notifications = this.data.notifications.filter(
      (item) => String(item.notify_id) !== String(notifyId)
    );
    const friendNotifications = notifications.filter((item) => !isPostEvent(item));
    const postNotifications = notifications.filter(isPostEvent);

    this.setData({
      notifications,
      friendNotifications,
      postNotifications,
    });

    // Update global state
    app.updateNotifications(notifications);
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

  // Share to friends/groups
  onShareAppMessage: function() {
    const shareHelper = require("../../utils/shareHelper");
    return shareHelper.getShareConfig({
      title: '校Show - 通知',
      path: '/pages/notification/notification'
    });
  },

  // Share to WeChat Moments
  onShareTimeline: function() {
    const shareHelper = require("../../utils/shareHelper");
    return shareHelper.getTimelineConfig({
      title: '校Show - 通知'
    });
  }
});
