const { default: config } = require("../../config");

Page({
  data: {
    userInfo: getApp().globalData.userInfo || {},
    posts: [],
    loading: false,
    hasMore: true,
    currentTab: 0,
    tabs: ["作品", "喜欢", "收藏", "历史"],
    age: 0,
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载失败",
        networkError: "网络错误",
      },
      confirmations: {
        deleteTitle: "删除确认",
        deleteContent: "您确定要删除这个帖子吗？",
      },
      success: {
        deleteSuccess: "删除成功",
      },
    },
  },

  onLoad: function (options) {
    const app = getApp();
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    app.subscribe("userInfo", this.userInfoHandler);
    this.setData({
      userInfo: app.globalData.userInfo || {},
    });
    this.calculateAge();
    this.loadPosts();
  },

  onUnload: function () {
    const app = getApp();
    app.unsubscribe("userInfo", this.userInfoHandler);
  },

  onShow() {
    this.loadPosts();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMorePosts();
    }
  },

  onPullDownRefresh() {
    this.refreshPosts();
  },

  // Calculate user age based on birthday
  calculateAge() {
    const birthday = new Date(this.data.userInfo.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > birthday.getMonth() ||
      (today.getMonth() === birthday.getMonth() &&
        today.getDate() >= birthday.getDate());

    if (!hasHadBirthdayThisYear) {
      age -= 1;
    }

    this.setData({ age });
  },

  // Handle tab change
  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentTab: parseInt(index),
      posts: [],
    });
    this.loadPosts();
  },

  // Load posts based on current tab
  async loadPosts() {
    this.setData({ loading: true });

    try {
      wx.request({
        url: `${config.BACKEND_URL}/post/get_posts?scope=15&${
          this.data.currentTab == 0 && "user_id="
        }${this.data.currentTab == 0 ? this.data.userInfo?.id : ""}&isLike=${
          this.data.currentTab == 1
        }&isFavorite=${this.data.currentTab == 2}&isHistory=${
          this.data.currentTab == 3
        }`,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        method: "GET",
        success: (res) => {
          if (res.data && res.data.status === "success") {
            this.setData({
              posts: this.data.posts.concat(res.data.posts),
              loading: false,
              hasMore: res.data.has_more || false,
            });
          } else {
            this.setData({ hasMore: false, loading: false });
          }
        },
        fail: () => {
          this.setData({ loading: false });
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        },
      });
    } catch (error) {
      console.error("Failed to load posts:", error);
      this.setData({ loading: false });
      wx.showToast({
        title: this.data.messages.errors.loadFailed,
        icon: "none",
      });
    }
  },

  // Load more posts for pagination
  async loadMorePosts() {
    this.setData({ loading: true });

    try {
      wx.request({
        url: `${config.BACKEND_URL}/post/get_posts?scope=15&${
          this.data.currentTab == 0 && "user_id="
        }${this.data.currentTab == 0 ? this.data.userInfo?.id : ""}&isLike=${
          this.data.currentTab == 1
        }&isFavorite=${this.data.currentTab == 2}&isHistory=${
          this.data.currentTab == 3
        }`,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        method: "GET",
        success: (res) => {
          if (res.data && res.data.status === "success") {
            this.setData({
              posts: this.data.posts.concat(res.data.posts || []),
              loading: false,
              hasMore: res.data.has_more || false,
            });
          } else {
            this.setData({ hasMore: false, loading: false });
          }
        },
        fail: () => {
          this.setData({ loading: false });
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        },
      });
    } catch (error) {
      this.setData({ loading: false });
    }
  },

  // Refresh posts
  async refreshPosts() {
    this.setData({ posts: [] });
    await this.loadPosts();
    wx.stopPullDownRefresh();
  },

  // Handle delete post confirmation
  onDeletePost(e) {
    const postId = e.currentTarget.dataset.id;

    wx.showModal({
      title: this.data.messages.confirmations.deleteTitle,
      content: this.data.messages.confirmations.deleteContent,
      success: (res) => {
        if (res.confirm) {
          this.deletePost(postId);
        }
      },
    });
  },

  // Delete post
  deletePost(postId) {
    try {
      wx.request({
        url: `${config.BACKEND_URL}/post/delete_my_post?id=${postId}`,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        method: "DELETE",
        success: (res) => {
          if (res.data && res.data.status === "success") {
            const posts = this.data.posts.filter((post) => post.id !== postId);
            this.setData({ posts });

            wx.showToast({
              title: this.data.messages.success.deleteSuccess,
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
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        },
      });
    } catch (error) {
      console.error("Error deleting post:", error);
      wx.showToast({
        title: this.data.messages.errors.loadFailed,
        icon: "none",
      });
      return;
    }
  },

  // Scroll to top
  scrollToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300,
    });
  },
});
