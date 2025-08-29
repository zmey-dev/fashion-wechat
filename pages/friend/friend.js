const { default: config } = require("../../config");

const app = getApp();

Page({
  data: {
    currentPath: "friend",
    userInfo: app.globalData.userInfo || {},
    userList: [],
    filteredUserList: [],
    currentUser: null,
    userMediaList: [],
    showUserMedia: false,
    loading: false,
    isFollowLoading: false,
    isFriendLoading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    searchValue: "",
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载失败",
        networkError: "网络错误",
        operationFailed: "操作失败",
        addFriendFailed: "添加好友失败",
        removeFriendFailed: "取消好友失败",
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

  onLoad: function (options) {
    const postId = options.postId || null;
    const app = getApp();

    // Remove sidebar related code
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    // Subscribe to user info changes
    app.subscribe("userInfo", this.userInfoHandler);

    this.setData({
      userInfo: app.globalData.userInfo || {},
    });

    this.loadUserList();
  },
  onShow: function () {
    this.loadUserList();
  },
  onUnload: function () {
    const app = getApp();
    // Unsubscribe from user info changes
    app.unsubscribe("userInfo", this.userInfoHandler);
  },

  // Load user list from API
  loadUserList: function () {
    this.setData({ loading: true });
    getApp().showGlobalLoading('加载中...');
    wx.request({
      url: `${config.BACKEND_URL}/friend/get_friends`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`, // Assuming token is stored in local storage
      },
      success: (res) => {
        if (res.statusCode === 200) {
          this.setData({
            userList: res.data.users,
            filteredUserList: res.data.users,
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

  // Search users functionality
  searchUsers: function (e) {
    const searchValue = e.detail.value.toLowerCase();
    this.setData({
      searchValue: searchValue,
    });

    if (!searchValue) {
      this.setData({
        filteredUserList: this.data.userList,
      });
      return;
    }

    const filtered = this.data.userList.filter((user) =>
      user.nickname.toLowerCase().includes(searchValue)
    );

    this.setData({
      filteredUserList: filtered,
    });
  },

  // Clear search input
  clearSearch: function () {
    this.setData({
      searchValue: "",
      filteredUserList: this.data.userList,
    });
  },
  // Select user and show their media
  selectUser: function (e) {
    const userId = e.currentTarget.dataset.id;
    const selectedUser = this.data.userList.find((user) => user.id === userId);

    if (!selectedUser) {
      wx.showToast({
        title: this.data.messages.errors.loadFailed,
        icon: "none",
      });
      return;
    }

    // Prepare user data with required properties for UI interactions
    const userWithState = {
      ...selectedUser,
      // Ensure these properties exist for the UI controls
      isFollowed: selectedUser.is_followed || false,
      isFriend: selectedUser.is_friend || false,
      isAllowed: selectedUser.is_allowed || false,
    };

    this.setData({
      currentUser: userWithState,
      showUserMedia: true,
      userMediaList: [],
      page: 1,
      hasMore: true,
    });

    this.loadUserMedia(userId);
  },

  // Load user's media posts
  loadUserMedia: function (userId) {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({ loading: true });
    
    const app = getApp();
    app.showGlobalLoading('加载更多...');

    wx.request({
      url: `${config.BACKEND_URL}/v2/post/by-user-id`,
      method: "GET",
      data: {
        user_id: userId,
        limit: this.data.pageSize,
        offset: (this.data.page - 1) * this.data.pageSize,
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
            page: this.data.page + 1,
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
    if (this.data.showUserMedia && this.data.currentUser && this.data.hasMore && !this.data.loading) {
      this.loadUserMedia(this.data.currentUser.id);
    }
  },

  // Go back to user list
  backToUserList: function () {
    this.setData({
      showUserMedia: false,
      currentUser: null,
    });
  },

  // Preview image by navigating to post detail
  previewImage: function (e) {
    const current = e.currentTarget.dataset.id;
    const userId = this.data.currentUser.id;
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?postId=${current}&user_id=${userId}&type=by_user_id`,
    });
  },

  // Handle pull down refresh
  onPullDownRefresh: function () {
    if (this.data.showUserMedia && this.data.currentUser) {
      this.setData({
        userMediaList: [],
        page: 1,
        hasMore: true,
      });
      this.loadUserMedia(this.data.currentUser.id);
    } else {
      this.loadUserList();
    }
    wx.stopPullDownRefresh();
  },
  /**
   * Handle follow/unfollow action
   */
  handleFollowToggle: function () {
    if (!this.data.currentUser) {
      wx.showToast({
        title: this.data.messages.errors.operationFailed,
        icon: "none",
      });
      return;
    }

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

          // Also update in the main user list
          const updatedUserList = this.data.userList.map((user) =>
            user.id === currentUser.id
              ? { ...user, is_followed: newFollowStatus }
              : user
          );

          this.setData({
            currentUser: updatedUser,
            userList: updatedUserList,
            filteredUserList: this.filterUsersBySearch(updatedUserList),
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
        this.setData({ loading: false });
        getApp().hideGlobalLoading();
      },
    });
  },

  // Helper function to filter users based on current search
  filterUsersBySearch: function (userList) {
    const searchValue = this.data.searchValue.toLowerCase();
    if (!searchValue) return userList;

    return userList.filter((user) =>
      user.nickname.toLowerCase().includes(searchValue)
    );
  },
  /**
   * Handle friend request/cancel
   */
  handleFriendToggle: function () {
    if (!this.data.currentUser) {
      wx.showToast({
        title: this.data.messages.errors.operationFailed,
        icon: "none",
      });
      return;
    }

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
    if (!this.data.currentUser) {
      wx.showToast({
        title: this.data.messages.errors.operationFailed,
        icon: "none",
      });
      return;
    }

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
          this.setData({ loading: false });
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
          this.setData({ loading: false });
        },
      });
  },
  /**
   * Navigate to message page
   */
  handleSendMessage: function () {
    if (!this.data.currentUser) {
      wx.showToast({
        title: this.data.messages.errors.operationFailed,
        icon: "none",
      });
      return;
    }

    const currentUser = this.data.currentUser;

    wx.navigateTo({
      url: `/pages/chat/chat?username=${currentUser.username}`,
    });
  },
});
