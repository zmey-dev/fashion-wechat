const { default: config } = require("../../../config");
const { isContainSword } = require("../../../utils/isContainSword");
const { isEmpty } = require("../../../utils/isEmpty");

// comment-tree.js
Component({
  properties: {
    comments: {
      type: Array,
      value: [],
    },
    loggedUser: {
      type: Object,
      value: {},
    },
    authUser: {
      type: Object,
      value: {},
    },
    selectedPost: {
      type: Object,
      value: {},
    },
  },

  data: {
    personalComment: "",
    commentId: null,
    isUpdate: false,
    showEmojiPicker: false,
    replyToComment: null,
    rootComments: [],
    emojiList: [
      "😀",
      "😂",
      "😍",
      "🥰",
      "😊",
      "😎",
      "🤔",
      "😮",
      "😢",
      "😡",
      "👍",
      "👎",
      "❤️",
      "🔥",
      "💯",
      "🎉",
      "😱",
      "🤣",
      "😭",
      "🥺",
    ],
  },

  observers: {
    comments: function (comments) {
      this.buildCommentTree();
    },
    commentId: function (commentId) {
      if (commentId) {
        const replyComment = this.properties.comments.find(
          (c) => c.id === commentId
        );
        this.setData({
          replyToComment: replyComment,
        });
      } else {
        this.setData({
          replyToComment: null,
        });
      }
    },
  },

  lifetimes: {
    attached() {
      this.buildCommentTree();
    },
  },

  methods: {
    // Build comment tree structure
    buildCommentTree() {
      const { comments } = this.properties;
      const rootComments = comments.filter(
        (comment) => comment.parent_id === null
      );
      this.setData({
        rootComments: rootComments,
      });
    },

    // Handle comment input
    onCommentInput(e) {
      this.setData({
        personalComment: e.detail.value,
      });
    },

    // Handle emoji toggle
    onToggleEmoji() {
      this.setData({
        showEmojiPicker: !this.data.showEmojiPicker,
      });
    },

    // Handle emoji click
    onEmojiClick(e) {
      const emoji = e.currentTarget.dataset.emoji;
      this.setData({
        personalComment: this.data.personalComment + emoji,
        showEmojiPicker: false,
      });
    },

    // Handle image selection
    onChooseImage() {
      const that = this;
      wx.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
        success(res) {
          const tempFilePath = res.tempFilePaths[0];
          that.uploadCommentImage(tempFilePath);
        },
        fail(err) {
          wx.showToast({
            title: "选择图片失败",
            icon: "error",
          });
        },
      });
    },

    // Upload comment image
    uploadCommentImage(filePath) {
      wx.showLoading({
        title: "上传中...",
      });

      const formData = {
        parent_id: this.data.commentId || null,
        post_id: this.properties.selectedPost.id,
        sender_id: this.properties.loggedUser.id,
      };

      wx.uploadFile({
        url: `${config.BACKEND_URL}/post/send_comment`,
        method: "POST",
        header: {
          "Content-Type": "multipart/form-data",
          Authorization: this.properties.loggedUser.token
            ? `Bearer ${this.properties.loggedUser.token}`
            : "",
        },
        filePath: filePath,
        name: "file",
        formData: formData,
        success: (res) => {
          wx.hideLoading();
          const data = JSON.parse(res.data);
          if (data.status === "success") {
            wx.showToast({
              title: "评论发布成功",
              icon: "success",
            });
            this.triggerEvent("commentsent", {
              comments: data.comment,
            });
            this.resetCommentInput();
          } else {
            wx.showToast({
              title: "评论发布失败",
              icon: "error",
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({
            title: "上传失败",
            icon: "error",
          });
        },
      });
    },

    // Send comment
    onSendComment() {
      const { personalComment, commentId, isUpdate } = this.data;
      const { authUser, loggedUser, selectedPost } = this.properties;

      const app = getApp();
      if (isEmpty(authUser)) {
        app.setState("showLoginModal", true);
        return;
      }
      if (!personalComment.trim()) {
        wx.showToast({
          title: "请输入评论内容",
          icon: "error",
        });
        return;
      }
      if (isContainSword(personalComment)) {
        wx.showToast({
          title: "不能使用不当言论",
          icon: "error",
        });
        return;
      }
      wx.showLoading({
        title: isUpdate ? "更新中..." : "发布中...",
      });

      const apiUrl = isUpdate
        ? `${config.BACKEND_URL}/comment/update_my_comment`
        : `${config.BACKEND_URL}/post/send_comment`;

      const requestData = isUpdate
        ? {
            comment_id: commentId,
            new_comment: personalComment,
          }
        : {
            parent_id: commentId,
            post_id: selectedPost.id,
            sender_id: loggedUser.id,
            content: personalComment,
          };

      wx.request({
        url: apiUrl,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          Authorization: loggedUser.token ? `Bearer ${loggedUser.token}` : "",
        },
        data: requestData,
        success: (res) => {
          wx.hideLoading();
          if (res.data.status == "success") {
            wx.showToast({
              title: res.data.msg,
              icon: "success",
            });

            if (isUpdate) {
              this.triggerEvent("commentupdated", {
                comment: res.data.comment,
              });
            } else {
              this.triggerEvent("commentsent", {
                comments: res.data.comment,
              });
            }

            this.resetCommentInput();
          } else {
            wx.showToast({
              title: res.data.msg ? res.data.msg : "评论发布失败",
              icon: "error",
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({
            title: "网络错误",
            icon: "error",
          });
        },
      });
    },

    // Reset comment input
    resetCommentInput() {
      this.setData({
        personalComment: "",
        commentId: null,
        isUpdate: false,
        showEmojiPicker: false,
        replyToComment: null,
      });
    },

    // Cancel reply
    onCancelReply() {
      this.resetCommentInput();
    },

    // Handle like from child components
    onCommentLike(e) {
      this.triggerEvent("like", e.detail);
    },

    // Handle edit from child components
    onCommentEdit(e) {
      const { item } = e.detail;
      this.setData({
        isUpdate: true,
        commentId: item.id,
        personalComment: item.comment_text || "",
      });
    },

    // Handle reply from child components
    onCommentReply(e) {
      const { item } = e.detail;
      const { loggedUser } = this.properties;

      if (!loggedUser) {
        this.triggerEvent("loginrequired");
        return;
      }
      if (loggedUser.id === item.sender_id) {
        wx.showToast({
          title: "不能回复自己的评论",
          icon: "error",
        });
        return;
      }

      this.setData({
        commentId: item.id,
        personalComment: "",
        isUpdate: false,
        showEmojiPicker: false,
      });
    },

    // Handle delete from child components
    onCommentDelete(e) {
      this.triggerEvent("delete", e.detail);
    },

    // Handle image preview from child components
    onImagePreview(e) {
      this.triggerEvent("imagepreview", e.detail);
    },

    // Handle image upload from child components
    onImageUpload(e) {
      this.triggerEvent("commentupdated", e.detail);
    },
  },
});
