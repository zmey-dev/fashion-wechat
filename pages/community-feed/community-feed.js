const { default: config } = require("../../config");

const app = getApp();

Page({
  data: {
    layoutCurrentPage: "category_news",
    category: "",
    posts: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
    offset: 0,
    limit: 20,
  },

  onLoad(options) {
    const category = options.category ? decodeURIComponent(options.category) : "";
    let layoutKey = "category_news";
    if (category === "日常投稿") layoutKey = "category_daily";
    else if (category === "二手闲置") layoutKey = "category_market";

    this.setData({ category, layoutCurrentPage: layoutKey });
    this.loadPosts(true);
  },

  onShow() {
    if (app.globalData.refreshPosts) {
      app.globalData.refreshPosts = false;
      this.loadPosts(true);
    }
  },

  onPullDownRefresh() {
    this.loadPosts(true);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadPosts(false);
    }
  },

  loadPosts(refresh) {
    if (refresh) {
      this.setData({ offset: 0, hasMore: true, loading: true });
    } else {
      this.setData({ loadingMore: true });
    }

    const params = {
      category: this.data.category,
      limit: this.data.limit,
      offset: refresh ? 0 : this.data.offset,
    };

    const token = app.globalData.userInfo?.token;
    const header = { "Content-Type": "application/json" };
    if (token) header.Authorization = `Bearer ${token}`;

    wx.request({
      url: `${config.BACKEND_URL}/v2/post/discover`,
      method: "GET",
      data: params,
      header,
      success: (res) => {
        if (res.data.status === "success") {
          const newPosts = (res.data.posts || []).map((post) => {
            post.time_display = this.formatTime(post.created_at);
            return post;
          });

          const posts = refresh ? newPosts : [...this.data.posts, ...newPosts];
          this.setData({
            posts,
            offset: (refresh ? 0 : this.data.offset) + newPosts.length,
            hasMore: newPosts.length >= this.data.limit,
          });
        }
      },
      complete: () => {
        this.setData({ loading: false, loadingMore: false });
        if (refresh) wx.stopPullDownRefresh();
      },
    });
  },

  onPostTap(e) {
    const { postId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/community-detail/community-detail?postId=${postId}&source=${this.data.layoutCurrentPage}`,
    });
  },

  onUserTap(e) {
    const { username, userId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/user-profile/user-profile?username=${username}&userId=${userId}`,
    });
  },

  onSearch(e) {
    const { value } = e.detail;
    wx.redirectTo({
      url: `/pages/index/index?search=${encodeURIComponent(value)}`,
    });
  },

  formatTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
  },
});
