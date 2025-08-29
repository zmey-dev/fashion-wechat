const { default: config } = require("../../config");

const app = getApp();

Page({
  data: {
    userInfo: app.globalData.userInfo || {},
    username: "",
    currentUser: null,
    userMediaList: [],
    loading: false,
    isFollowLoading: false,
    isFriendLoading: false,
    hasMore: true,
    offset: 0,
    limit: 20, // Match web version
    error: false,
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载失败",
        networkError: "网络错误",
        operationFailed: "操作失败",
        addFriendFailed: "添加好友失败",
        removeFriendFailed: "取消好友失败",
        userNotFound: "用户不存在",
      },
      actions: {
        following: "关注中...",
        unfollowing: "取消关注中...",
        addingFriend: "添加好友中...",
        removingFriend: "取消好友中...",
        followed: "已关注",
        unfollowed: "已取消关注",
        friendAdded: "已添加好友",
        friendRemoved: "已取消好友",
      },
      confirmations: {
        removeFriendTitle: "提示",
        removeFriendContent: "您确定要删除您的好友请求吗？",
      },
    },
  },

  navigateBack: function() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        // If navigateBack fails, go to discover page
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    });
  },

  onLoad: function (options) {
    const { username } = options;
    this.setData({ username });
    if (!username) {
      wx.showToast({
        title: this.data.messages.errors.userNotFound,
        icon: "none",
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // Subscribe to user info changes
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    app.subscribe("userInfo", this.userInfoHandler);

    this.setData({
      userInfo: app.globalData.userInfo || {},
    });

    this.loadUserProfile(username);
  },

  onUnload: function () {
    // Unsubscribe from user info changes
    app.unsubscribe("userInfo", this.userInfoHandler);
  },

  // Load user profile from API
  loadUserProfile: function (username) {
    this.setData({ loading: true, error: false });
    getApp().showGlobalLoading('加载中...');
    wx.request({
      url: `${config.BACKEND_URL}/profile/get_profile`,
      method: "GET",
      data: {
        username: username,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (res) => {

        if (res.statusCode === 200) {
          // Prepare user data with required properties for UI interactions
          const userWithState = {
            ...res.data.user,
            // Ensure these properties exist for the UI controls
            isFollowed: res.data.user.is_followed || false,
            isFriend: res.data.user.is_friend || false,
            isAllowed: res.data.user.is_allowed || false,
          };
          this.setData({ loading: false });

          this.setData({
            currentUser: userWithState,
            userMediaList: [],
            page: 1,
            hasMore: true,
          });

          this.loadUserMedia(userWithState.id);
        } else {
          this.setData({ error: true });
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        }
      },
      fail: () => {
        this.setData({ error: true });
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
      complete: () => {
        this.setData({ loading: false });
        getApp().hideGlobalLoading();
      },
    });
  },

  // Load user's media posts
  loadUserMedia: function (userId) {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({ loading: true });
    getApp().showGlobalLoading('加载中...');

    // Use web version API pattern
    wx.request({
      url: `${config.BACKEND_URL}/v2/post/by-user-id`,
      method: "GET",
      data: {
        user_id: userId,
        limit: this.data.limit,
        offset: this.data.offset,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          const newMedia = res.data.posts || [];
          this.setData({
            userMediaList: this.data.userMediaList.concat(newMedia),
            hasMore: res.data.has_more || false,
            offset: this.data.offset + this.data.limit,
          });
        } else {
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
      complete: () => {
        this.setData({ loading: false });
        getApp().hideGlobalLoading();
      },
    });
  },

  // Handle reaching bottom of page for infinite scroll
  onReachBottom: function () {
    if (this.data.currentUser && this.data.hasMore && !this.data.loading) {
      this.loadUserMedia(this.data.currentUser.id);
    }
  },

  // Preview image by navigating to post detail with web version parameters
  previewImage: function (e) {
    const postId = e.currentTarget.dataset.id;
    const userId = this.data.currentUser.id;
    
    // Build URL with web version parameters
    const url = `/pages/post-detail/post-detail?postId=${postId}&type=by_user_id&user_id=${userId}`;
    
    wx.navigateTo({ url });
  },

  // Handle pull down refresh
  onPullDownRefresh: function () {
    if (this.data.currentUser) {
      this.setData({
        userMediaList: [],
        offset: 0,
        hasMore: true,
      });
      this.loadUserMedia(this.data.currentUser.id);
    }
    wx.stopPullDownRefresh();
  },

  /**
   * Handle follow/unfollow action
   */
  handleFollowToggle: function () {
    const currentUser = this.data.currentUser;
    const newFollowStatus = !currentUser.isFollowed;

    this.setData({
      isFollowLoading: true
    });

    wx.request({
      url: `${config.BACKEND_URL}/post/save_follow`,
      method: "POST",
      data: {
        follower_id: currentUser.id,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // Update local state
          const updatedUser = { ...currentUser, isFollowed: newFollowStatus };

          this.setData({
            currentUser: updatedUser,
          });

          wx.showToast({
            title: newFollowStatus
              ? this.data.messages.actions.followed
              : this.data.messages.actions.unfollowed,
            icon: "success",
          });
        } else {
          if (res.data.msg)
            wx.showToast({
              title: res.data.msg,
              icon: "error",
            });
        }
      },
      fail: () => {
        wx.showToast({
          title: this.data.messages.errors.operationFailed,
          icon: "error",
        });
      },
      complete: () => {
        this.setData({
          isFollowLoading: false
        });
      },
    });
  },

  /**
   * Handle friend request/cancel
   */
  handleFriendToggle: function () {
    const currentUser = this.data.currentUser;

    if (currentUser.isFriend) {
      // Confirm before removing friend
      wx.showModal({
        title: this.data.messages.confirmations.removeFriendTitle,
        content: this.data.messages.confirmations.removeFriendContent,
        success: (res) => {
          if (res.confirm) {
            this.updateFriendStatus(false);
          }
        },
      });
    } else {
      // Add friend directly
      this.updateFriendStatus(true);
    }
  },

  /**
   * Update friend status with API
   */
  updateFriendStatus: function (addFriend) {
    const currentUser = this.data.currentUser;

    this.setData({
      isFriendLoading: true
    });

    if (addFriend)
      wx.request({
        url: `${config.BACKEND_URL}/friend/add_friend`,
        method: "POST",
        data: {
          friend_id: currentUser.id,
        },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200) {
            const updatedUser = { ...currentUser, isFriend: true };
            this.setData({
              currentUser: updatedUser,
            });
            wx.showToast({
              title: this.data.messages.actions.friendAdded,
              icon: "success",
            });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
        fail: () => {
          wx.showToast({
            title: this.data.messages.errors.addFriendFailed,
            icon: "error",
          });
        },
        complete: () => {
          this.setData({
            isFriendLoading: false
          });
        },
      });
    else
      wx.request({
        url: `${config.BACKEND_URL}/friend/del_friend_by_friend_id`,
        method: "DELETE",
        data: {
          friend_id: currentUser.id,
        },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200) {
            const updatedUser = { ...currentUser, isFriend: false };
            this.setData({
              currentUser: updatedUser,
            });
            wx.showToast({
              title: this.data.messages.actions.friendRemoved,
              icon: "success",
            });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
        fail: () => {
          wx.showToast({
            title: this.data.messages.errors.removeFriendFailed,
            icon: "error",
          });
        },
        complete: () => {
          this.setData({
            isFriendLoading: false
          });
        },
      });
  },

  /**
   * Navigate to message page
   */
  handleSendMessage: function () {
    const currentUser = this.data.currentUser;

    wx.navigateTo({
      url: `/pages/chat/chat?username=${currentUser.username}`,
    });
  },
});
