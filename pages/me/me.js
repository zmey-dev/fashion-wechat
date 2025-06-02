const { default: config } = require("../../config");

Page({
  data: {
    userInfo: getApp().globalData.userInfo || {},
    posts: [],
    loading: false,
    hasMore: true,
    currentTab: 0,
    tabs: ["Works", "Likes", "Favorites", "History"],
    age: 0,
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

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentTab: parseInt(index),
      posts: [],
    });
    this.loadPosts();
  },

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
            title: "Failed to load posts",
            icon: "none",
          });
        },
      });
    } catch (error) {
      console.error("Failed to load posts:", error);
      this.setData({ loading: false });
      wx.showToast({
        title: "Loading failed",
        icon: "none",
      });
    }
  },

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
            title: "Failed to load posts",
            icon: "none",
          });
        },
      });
    } catch (error) {
      this.setData({ loading: false });
    }
  },

  async refreshPosts() {
    this.setData({ posts: [] });
    await this.loadPosts();
    wx.stopPullDownRefresh();
  },

  onDeletePost(e) {
    const postId = e.currentTarget.dataset.id;

    wx.showModal({
      title: "Delete Confirmation",
      content: "Are you sure you want to delete this post?",
      success: (res) => {
        if (res.confirm) {
          this.deletePost(postId);
        }
      },
    });
  },

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
              title: "Deleted successfully",
              icon: "success",
            });
          } else {
            wx.showToast({
              title: "Failed to delete post",
              icon: "none",
            });
          }
        },
        fail: () => {
          wx.showToast({
            title: "Failed to delete post",
            icon: "none",
          });
        },
      });
    } catch (error) {
      console.error("Error deleting post:", error);
      wx.showToast({
        title: "Failed to delete post",
        icon: "none",
      });
      return;
    }
  },

  scrollToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300,
    });
  },
});
