const { default: config } = require("../../config");

// pages/notification/notification.js
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
    error: null
  },

  onLoad() {
    this.setData({
      userInfo: app.globalData.userInfo || {}
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
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        if (res.data && res.data.status === 'success') {
          const notifications = res.data.message || [];
          
          const friendNotifications = notifications.filter(item => item.event_type !== "new_post");
          const postNotifications = notifications.filter(item => item.event_type === "new_post");

          this.setData({
            notifications,
            friendNotifications,
            postNotifications,
            loading: false,
            error: null
          });
        } else {
          this.setData({
            loading: false,
            error: res.data?.message || '알림을 가져오는데 실패했습니다'
          });
          
          wx.showToast({
            title: '알림을 가져오는데 실패했습니다',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('Failed to fetch notifications:', err);
        this.setData({
          loading: false,
          error: '네트워크 오류가 발생했습니다'
        });
        
        wx.showToast({
          title: '네트워크 오류가 발생했습니다',
          icon: 'none'
        });
      }
    });
  },

  // 탭 전환
  switchTab(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      activeTab: parseInt(index)
    });
  },

  // 항목 확장/축소 토글
  toggleItem(e) {
    const { id } = e.currentTarget.dataset;
    const expandedItems = { ...this.data.expandedItems };
    expandedItems[id] = !expandedItems[id];
    
    this.setData({
      expandedItems
    });
  },

  // 친구 요청 처리 (수락/거절)
  handleFriendRequest(e) {
    const { action, notifyId } = e.currentTarget.dataset;
    
    wx.showLoading({
      title: '처리 중...'
    });

    // 실제 API 호출로 친구 요청 처리
    this.requestFriendAction({
      status: action,
      notify_id: notifyId
    });
  },

  // 게시물 알림 처리
  handlePostNotification(e) {
    const { notifyId } = e.currentTarget.dataset;
    
    // 게시물 알림 제거 API 호출
    this.requestFriendAction({
      status: 'removed',
      notify_id: notifyId
    });
  },

  // 로컬 데이터에서 알림 제거
  removeNotification(notifyId) {
    const notifications = this.data.notifications.filter(
      item => item.notify_id !== parseInt(notifyId)
    );
    const friendNotifications = notifications.filter(
      item => item.event_type !== "new_post"
    );
    const postNotifications = notifications.filter(
      item => item.event_type === "new_post"
    );

    this.setData({
      notifications,
      friendNotifications,
      postNotifications
    });
  },

  requestFriendAction(data) {
    wx.request({
      url: `${config.BACKEND_URL}/handle-friend`,
      method: 'POST',
      data: data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.userInfo.token}`
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.data && res.data.status === 'success') {
          const actionText = 
            data.status === 'accept' ? '친구 추가됨!' :
            data.status === 'reject' ? '요청 거절됨' : '알림 제거됨';
          
          wx.showToast({
            title: actionText,
            icon: 'success'
          });
          
          this.removeNotification(data.notify_id);
        } else {
          wx.showToast({
            title: '작업 실패',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Friend action request failed:', err);
        
        wx.showToast({
          title: '네트워크 오류',
          icon: 'none'
        });
      }
    });
  },

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
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
  },
  
  navigateToUserProfile(e) {
    const { userId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/profile/profile?userId=${userId}`
    });
  },
  
  navigateToPost(e) {
    const { postId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/post/post-detail?postId=${postId}`
    });
  }
});