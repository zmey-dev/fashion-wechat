const { default: config } = require("../../config");

const app = getApp();

Page({
  data: {
    post: null,
    postForComments: null,
    comments: [],
    userInfo: {},
    loading: true,
    errorMessage: "",
    isLiked: false,
    isFavorited: false,
    timeDisplay: "",
    sourcePage: "category_news",
    scrollTarget: "",
  },

  onLoad(options) {
    const postId = options.postId;
    const source = options.source || "category_news";
    if (!postId) {
      this.setData({ loading: false, errorMessage: "内容不存在" });
      return;
    }

    this.setData({
      userInfo: app.globalData.userInfo || {},
      sourcePage: source,
    });

    this.loadPost(postId);
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo || {} });
  },

  loadPost(postId) {
    this.setData({ loading: true });

    const header = { "Content-Type": "application/json" };
    const token = this.data.userInfo?.token;
    if (token) header.Authorization = `Bearer ${token}`;

    wx.request({
      url: `${config.BACKEND_URL}/v2/post/detail/${postId}`,
      method: "GET",
      data: { type: "discover" },
      header,
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          const post = res.data.current || res.data.post;
          if (!post) {
            this.setData({ loading: false, errorMessage: "内容不存在" });
            return;
          }

          const comments = post.comments || [];
          const postForComments = Object.assign({}, post, { title: "", content: "" });
          this.setData({
            post,
            postForComments,
            comments,
            isLiked: !!post.likes_exists,
            isFavorited: !!post.favorites_exists,
            timeDisplay: this.formatTime(post.created_at),
            loading: false,
          });
        } else {
          this.setData({ loading: false, errorMessage: "加载失败" });
        }
      },
      fail: () => {
        this.setData({ loading: false, errorMessage: "网络错误" });
      },
    });
  },

  onUserTap() {
    const user = this.data.post?.user;
    if (user) {
      wx.navigateTo({
        url: `/pages/user-profile/user-profile?username=${user.username}&userId=${user.id}`,
      });
    }
  },

  onImagePreview(e) {
    const current = e.currentTarget.dataset.url;
    const urls = this.data.post.media.map((m) => m.url);
    wx.previewImage({ current, urls });
  },

  onLikeTap() {
    const { post, userInfo, isLiked } = this.data;
    if (!userInfo?.token) {
      app.setState("showLoginModal", true);
      return;
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/add_like`,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userInfo.token}`,
      },
      data: { post_id: post.id },
      success: (res) => {
        if (res.data.status === "success") {
          const newLiked = !isLiked;
          this.setData({
            isLiked: newLiked,
            "post.likes": newLiked ? post.likes + 1 : post.likes - 1,
          });
        } else if (res.data.msg) {
          wx.showToast({ title: res.data.msg, icon: "none" });
        }
      },
    });
  },

  onFavoriteTap() {
    const { post, userInfo, isFavorited } = this.data;
    if (!userInfo?.token) {
      app.setState("showLoginModal", true);
      return;
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/save_favorite`,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userInfo.token}`,
      },
      data: { post_id: post.id },
      success: (res) => {
        if (res.data.status === "success") {
          const newFav = !isFavorited;
          this.setData({
            isFavorited: newFav,
            "post.favorites": newFav ? post.favorites + 1 : post.favorites - 1,
          });
          wx.showToast({ title: newFav ? "已收藏" : "已取消收藏", icon: "none" });
        } else if (res.data.msg) {
          wx.showToast({ title: res.data.msg, icon: "none" });
        }
      },
    });
  },

  onShareTap() {
    wx.showToast({ title: "请使用右上角分享", icon: "none" });
  },

  scrollToComments() {
    this.setData({ scrollTarget: "commentsSection" });
  },

  onCommentSent(e) {
    const { comments: newComment } = e.detail;
    if (!newComment) return;

    const newComments = Array.isArray(newComment) ? newComment : [newComment];
    const existingIds = new Set(this.data.comments.map((c) => c.id));
    const unique = newComments.filter((c) => c && c.id && !existingIds.has(c.id));

    if (unique.length > 0) {
      const comments = [...this.data.comments, ...unique];
      this.setData({ comments });
    }
  },

  onCommentDeleted(e) {
    const { commentId } = e.detail;
    const { userInfo } = this.data;
    if (!userInfo?.token) return;

    wx.request({
      url: `${config.BACKEND_URL}/post/delete_comment`,
      method: "DELETE",
      data: { id: commentId },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userInfo.token}`,
      },
      success: (res) => {
        if (res.data.status === "success") {
          const comments = this.data.comments.filter((c) => c.id !== commentId);
          this.setData({ comments });
          wx.showToast({ title: "评论已删除", icon: "success" });
        } else if (res.data.msg) {
          wx.showToast({ title: res.data.msg, icon: "none" });
        }
      },
    });
  },

  onCommentLiked(e) {
    const { commentId, state_flag } = e.detail;
    const { userInfo } = this.data;
    if (!userInfo?.token) return;

    wx.request({
      url: `${config.BACKEND_URL}/comment/like`,
      method: "POST",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userInfo.token}`,
      },
      data: { comment_id: commentId, state_flag },
    });
  },

  onShareAppMessage() {
    const { post } = this.data;
    return {
      title: post?.title || "校Show",
      path: `/pages/community-detail/community-detail?postId=${post?.id}`,
    };
  },

  onShareTimeline() {
    const { post } = this.data;
    return {
      title: post?.title || "校Show",
    };
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
