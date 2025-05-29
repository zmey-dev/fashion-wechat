const { default: config } = require("../../../config");

// comment-item.js
Component({
  properties: {
    item: {
      type: Object,
      value: {},
    },
    index: {
      type: Number,
      value: 0,
    },
    loggedUser: {
      type: Object,
      value: {},
    },
    selectedPost: {
      type: Object,
      value: {},
    },
  },

  data: {
    createdTime: "",
  },

  lifetimes: {
    attached() {
      this.formatTime();
    },
  },

  observers: {
    "item.created_at": function (createdAt) {
      this.formatTime();
    },
  },

  methods: {
    // Format timestamp
    formatTime() {
      const { item } = this.properties;
      if (item.created_at) {
        // Using dayjs or similar date formatting library
        // For WeChat mini program, you might need to include a date utility
        const date = new Date(item.created_at);
        const formattedTime = this.formatDate(date);
        this.setData({
          createdTime: formattedTime,
        });
      }
    },

    // Simple date formatter (you can replace with dayjs or moment equivalent)
    formatDate(date) {
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    },

    // Handle image tap for modal display
    onImageTap(e) {
      const { url } = e.currentTarget.dataset;
      this.triggerEvent("imagepreview", {
        url: url,
      });
    },

    // Handle like/unlike actions
    onLikeHandle(e) {
      const { item, type } = e.currentTarget.dataset;
      this.triggerEvent("like", {
        commentId: this.properties.item.id,
        state_flag: type,
      });
    },

    // Handle comment edit
    onCommentEdit(e) {
      const { item, index } = e.currentTarget.dataset;
      this.triggerEvent("edit", {
        item: this.properties.item,
        index: this.properties.index,
      });
    },

    // Handle image edit (file upload)
    onImageEdit(e) {
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
          console.error("Choose image failed:", err);
          wx.showToast({
            title: "Failed to select image",
            icon: "error",
          });
        },
      });
    },

    // Upload comment image
    uploadCommentImage(filePath) {
      wx.showLoading({
        title: "Uploading...",
      });

      wx.uploadFile({
        url: `${config.BACKEND_URL}/comment/update_my_comment`,
        header: {
          "Content-Type": "multipart/form-data",
          Authorization: this.properties.loggedUser.token
            ? `Bearer ${this.properties.loggedUser.token}`
            : "",
        },
        filePath: filePath,
        name: "file",
        formData: {
          comment_id: this.properties.item.id,
        },
        success: (res) => {
          wx.hideLoading();
          const data = JSON.parse(res.data);
          if (data.status=="success") {
            wx.showToast({
              title: "Image updated successfully",
              icon: "success",
            });
            this.triggerEvent("imageupload", {
              id: this.properties.item.id,
              comment: data.comment,
            });
          } else {
            wx.showToast({
              title: "Upload failed",
              icon: "error",
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error("Upload failed:", err);
          wx.showToast({
            title: "Upload failed",
            icon: "error",
          });
        },
      });
    },

    // Handle reply click
    onReplyClick(e) {
      const { item, index } = e.currentTarget.dataset;
      this.triggerEvent("reply", {
        item: this.properties.item,
        index: this.properties.index,
      });
    },

    // Handle comment delete
    onCommentDelete(e) {
      const { id } = e.currentTarget.dataset;
      const that = this;

      wx.showModal({
        title: "Confirm Delete",
        content: "Are you sure you want to delete this comment?",
        confirmText: "Delete",
        confirmColor: "#ef4444",
        success(res) {
          if (res.confirm) {
            that.triggerEvent("delete", {
              commentId: id,
            });
          }
        },
      });
    },
  },
});
