const { default: config } = require("../../config");
const app = getApp();

Page({
  data: {
    userInfo: app.globalData.userInfo || {},
    userList: [],
    filteredUserList: [],
    currentUser: null,
    currentPath: "follow",
    userMediaList: [],
    showUserMedia: false,
    loading: false,
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
        removeFriendFailed: "取消好友失败"
      },
      actions: {
        following: "关注中...",
        unfollowing: "取消关注中...",
        addingFriend: "添加好友中...",
        removingFriend: "取消好友中...",
        followed: "已关注",
        unfollowed: "已取消关注",
        friendAdded: "已添加好友",
        friendRemoved: "已取消好友"
      },
      confirmations: {
        removeFriendTitle: "提示",
        removeFriendContent: "您确定要删除您的好友请求吗？"
      }
    }
  },

  onLoad: function (options) {
    const postId = options.postId || null;

    // Subscribe to user info changes
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    }
    app.subscribe("userInfo", this.userInfoHandler);

    this.setData({
      userInfo: app.globalData.userInfo || {},
    });

    this.loadUserList();
  },

  onUnload: function () {
    // Unsubscribe from user info changes
    app.unsubscribe("userInfo", this.userInfoHandler);
  },

  // Load user list from API
  loadUserList: function () {
    wx.showLoading({
      title: this.data.messages.loading,
    });
    wx.request({
      url: `${config.BACKEND_URL}/user/get_my_follow_users`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
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
        wx.hideLoading();
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
      user.username.toLowerCase().includes(searchValue)
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

    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts`,
      method: "GET",
      data: {
        user_id: userId,
        page: this.data.page,
        pageSize: this.data.pageSize,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200) {
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
      },
    });
  },

  // Handle reaching bottom of page for infinite scroll
  onReachBottom: function () {
    if (this.data.showUserMedia && this.data.currentUser) {
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
    wx.navigateTo({
      url: `/pages/index/index?postId=${current}`,
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
    const currentUser = this.data.currentUser;
    const newFollowStatus = !currentUser.isFollowed;

    wx.showLoading({
      title: newFollowStatus ? this.data.messages.actions.following : this.data.messages.actions.unfollowing,
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
            title: newFollowStatus ? this.data.messages.actions.followed : this.data.messages.actions.unfollowed,
            icon: "success",
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
        wx.hideLoading();
      },
    });
  },

  // Helper function to filter users based on current search
  filterUsersBySearch: function (userList) {
    const searchValue = this.data.searchValue.toLowerCase();
    if (!searchValue) return userList;

    return userList.filter((user) =>
      user.username.toLowerCase().includes(searchValue)
    );
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

    wx.showLoading({
      title: addFriend ? this.data.messages.actions.addingFriend : this.data.messages.actions.removingFriend,
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
            wx.showToast({
              title: this.data.messages.errors.addFriendFailed,
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
          wx.hideLoading();
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
            wx.showToast({
              title: this.data.messages.errors.removeFriendFailed,
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
          wx.hideLoading();
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
