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
  },

  onLoad: function (options) {
    const postId = options.postId || null;
    const app = getApp();

    // Subscribe to state changes
    this.sidebarHandler = (showSidebar) => {
      this.setData({ showSidebar });
    };
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    }
    app.subscribe("showSidebar", this.sidebarHandler);
    app.subscribe("userInfo", this.userInfoHandler);
    this.setData({
      showSidebar: app.globalData.showSidebar || false,
      userInfo: app.globalData.userInfo || {},
    });
    this.loadUserList();
  },

  onUnload: function () {
    const app = getApp();
    app.unsubscribe("showSidebar", this.sidebarHandler);
    app.unsubscribe("userInfo", this.userInfoHandler);
  },

  loadUserList: function () {
    wx.showLoading({
      title: "加载中...",
    });
    wx.request({
      url: `${config.BACKEND_URL}/user/get_my_follow_users`,
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
            title: "加载失败",
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: "网络错误",
          icon: "none",
        });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },

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

  clearSearch: function () {
    this.setData({
      searchValue: "",
      filteredUserList: this.data.userList,
    });
  },

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
            title: "加载失败",
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: "网络错误",
          icon: "none",
        });
      },
      complete: () => {
        this.setData({ loading: false });
      },
    });
  },

  onReachBottom: function () {
    if (this.data.showUserMedia && this.data.currentUser) {
      this.loadUserMedia(this.data.currentUser.id);
    }
  },

  backToUserList: function () {
    this.setData({
      showUserMedia: false,
      currentUser: null,
    });
  },

  previewImage: function (e) {
    const current = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/index/index?postId=${current}`,
    });
  },

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
      title: newFollowStatus ? "关注中..." : "取消关注中...",
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
            title: newFollowStatus ? "已关注" : "已取消关注",
            icon: "success",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: "操作失败",
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
        title: "提示",
        content: "您确定要删除您的好友请求吗？",
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
      title: addFriend ? "添加好友中..." : "取消好友中...",
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
              title: "已添加好友",
              icon: "success",
            });
          } else {
            wx.showToast({
              title: "添加好友失败",
              icon: "error",
            });
          }
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
              title: "已取消好友",
              icon: "success",
            });
          } else {
            wx.showToast({
              title: "取消好友失败",
              icon: "error",
            });
          }
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
