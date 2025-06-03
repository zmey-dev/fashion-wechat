// modals/detail-modal/detail-modal.js
import config from "../../config";
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    postId: {
      type: String,
      value: "",
    },
  },

  data: {
    post: null,
    comments: [],
    newComment: "",
    isLoading: true,
    commentLoading: false,
  },

  observers: {
    "visible, postId": function (visible, postId) {
      if (visible && postId) {
        this.loadPostDetails();
      }
    },
  },

  methods: {
    loadPostDetails: function () {
      if (!this.properties.postId) return;

      const that = this;
      this.setData({ isLoading: true });

      // Get post details
      wx.request({
        url: `${config.BACKEND_URL}/posts/${this.properties.postId}`,
        method: "GET",
        header: {
          Authorization: "Bearer " + wx.getStorageSync("token"),
        },
        success: function (res) {
          if (res.statusCode === 200) {
            that.setData({
              post: res.data,
              isLoading: false,
            });

            // Load comments
            that.loadComments();
          }
        },
        fail: function () {
          that.setData({ isLoading: false });
          wx.showToast({
            title: "加载失败",
            icon: "none",
          });
        },
      });
    },

    loadComments: function () {
      const that = this;

      wx.request({
        url: `${config.BACKEND_URL}/posts/${this.properties.postId}/comments`,
        method: "GET",
        header: {
          Authorization: "Bearer " + wx.getStorageSync("token"),
        },
        success: function (res) {
          if (res.statusCode === 200) {
            that.setData({
              comments: res.data,
            });
          }
        },
      });
    },

    onInputComment: function (e) {
      this.setData({
        newComment: e.detail.value,
      });
    },

    submitComment: function () {
      const { newComment } = this.data;

      if (!newComment.trim()) return;

      const that = this;
      this.setData({ commentLoading: true });

      wx.request({
        url: `${config.BACKEND_URL}/posts/${this.properties.postId}/comments`,
        method: "POST",
        header: {
          Authorization: "Bearer " + wx.getStorageSync("token"),
        },
        data: {
          content: newComment,
        },
        success: function (res) {
          if (res.statusCode === 201) {
            // Add new comment to the list
            const comments = that.data.comments.concat(res.data);
            that.setData({
              comments: comments,
              newComment: "",
              commentLoading: false,
            });
          } else {
            that.setData({ commentLoading: false });
            wx.showToast({
              title: "评论失败",
              icon: "none",
            });
          }
        },
        fail: function () {
          that.setData({ commentLoading: false });
          wx.showToast({
            title: "评论失败",
            icon: "none",
          });
        },
      });
    },

    likePost: function () {
      if (!this.data.post) return;

      const that = this;

      wx.request({
        url: `${config.BACKEND_URL}/posts/${this.properties.postId}/like`,
        method: "POST",
        header: {
          Authorization: "Bearer " + wx.getStorageSync("token"),
        },
        success: function (res) {
          if (res.statusCode === 200) {
            // Update post likes
            const post = that.data.post;
            const userLiked = post.liked;

            if (userLiked) {
              post.likes = post.likes.filter(
                (like) => like.user_id !== that.data.currentUserId
              );
            } else {
              post.likes.push({ user_id: that.data.currentUserId });
            }

            post.liked = !userLiked;

            that.setData({ post: post });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
      });
    },

    previewImage: function (e) {
      const url = e.currentTarget.dataset.url;
      const urls = this.data.post.medias.map((media) => media.url);

      wx.previewImage({
        current: url,
        urls: urls,
      });
    },

    close: function () {
      this.triggerEvent("close");
    },
  },
});
