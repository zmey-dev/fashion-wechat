// pages/contact/contact.js
const { default: config } = require("../../config");

const app = getApp();

Page({
  data: {
    userInfo: app.globalData.userInfo || {},
    currentPath: "contact",
    title: "",
    description: "",
    images: [],
    maxImages: 4,
    isSubmitting: false,
    // Chinese messages for UI text
    messages: {
      form: {
        titlePlaceholder: "请输入标题",
        descriptionPlaceholder: "请详细描述您的建议或问题",
        submitButton: "提交建议",
        submitting: "提交中...",
      },
      validation: {
        required: "请填写标题和您的建议",
        maxImages: "最多只能上传{max}张图片",
      },
      success: {
        submitted: "您的建议已成功提交！感谢您的反馈",
      },
      errors: {
        submitFailed: "提交失败，请稍后重试",
        uploadFailed: "图片上传失败",
        networkError: "网络错误，请检查网络连接",
        parseFailed: "数据解析失败",
        requestFailed: "请求失败",
      },
      actions: {
        addImage: "添加图片",
        preview: "预览",
        remove: "删除",
        removeAll: "删除所有",
      },
    },
  },

  onLoad: function (options) {
    // Subscribe to user info changes
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    app.subscribe("userInfo", this.userInfoHandler);

    this.setData({
      userInfo: app.globalData.userInfo || {},
    });
  },

  onUnload: function () {
    // Unsubscribe from user info changes
    app.unsubscribe("userInfo", this.userInfoHandler);
  },

  // Handle title input change
  onTitleChange: function (e) {
    this.setData({
      title: e.detail.value,
    });
  },

  // Handle description input change
  onDescriptionChange: function (e) {
    this.setData({
      description: e.detail.value,
    });
  },

  // Choose image from album or camera
  chooseImage: function () {
    const { images, maxImages } = this.data;

    if (images.length >= maxImages) {
      wx.showToast({
        title: this.data.messages.validation.maxImages.replace("{max}", maxImages),
        icon: "none",
      });
      return;
    }

    wx.chooseMedia({
      count: maxImages - images.length,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFiles = res.tempFiles;
        const newImages = [...this.data.images];

        tempFiles.forEach((file) => {
          newImages.push({
            path: file.tempFilePath,
            size: file.size,
          });
        });

        this.setData({
          images: newImages,
        });
      },
    });
  },

  // Preview image
  previewImage: function (e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.images.map((image) => image.path);

    wx.previewImage({
      current: urls[index],
      urls: urls,
    });
  },

  // Remove image
  removeImage: function (e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images.splice(index, 1);

    this.setData({
      images: images,
    });
  },

  // Remove all images
  removeAllImages: function () {
    this.setData({
      images: [],
    });
  },

  // Submit feedback form
  submitFeedback: async function () {
    const { title, description, images, isSubmitting } = this.data;

    // Prevent duplicate submissions
    if (isSubmitting) return;

    // Validate input
    if (!title.trim() || !description.trim()) {
      wx.showToast({
        title: this.data.messages.validation.required,
        icon: "none",
        duration: 2000,
      });
      // Add haptic feedback for error if available
      if (wx.vibrateShort) {
        wx.vibrateShort({ type: "heavy" });
      }
      return;
    }

    // Set submitting state
    this.setData({ isSubmitting: true });

    // Show loading indicator
    wx.showLoading({
      title: this.data.messages.form.submitting,
      mask: true,
    });

    try {
      // Upload images first if any
      let imageUrls = [];
      if (images && images.length > 0) {
        imageUrls = await this.uploadImages(images);
      }

      // Then submit the form with image URLs
      const result = await this.submitForm(title, description, imageUrls);

      // Hide loading indicator
      wx.hideLoading();

      if (result.status === "success") {
        // Reset form after successful submission
        this.setData({
          title: "",
          description: "",
          images: [],
          isSubmitting: false,
        });

        // Show success message
        wx.showToast({
          title: this.data.messages.success.submitted,
          icon: "success",
          duration: 3000,
        });

        // Add haptic feedback for success if available
        if (wx.vibrateShort) {
          wx.vibrateShort({ type: "medium" });
        }
      } else {
        throw new Error(
          result.message || this.data.messages.errors.submitFailed
        );
      }
    } catch (error) {
      // Hide loading indicator
      wx.hideLoading();

      console.error("Submission error:", error);
      this.setData({ isSubmitting: false });

      // Show error message
      const errorMessage =
        error.message || this.data.messages.errors.submitFailed;
      wx.showToast({
        title: errorMessage,
        icon: "none",
        duration: 3000,
      });

      // Add haptic feedback for error if available
      if (wx.vibrateShort) {
        wx.vibrateShort({ type: "heavy" });
      }
    }
  },

  // Upload images and get their URLs
  uploadImages: function (images) {
    if (!images.length) return Promise.resolve([]);

    return new Promise(async (resolve, reject) => {
      try {
        // Create upload promises for each image
        const uploadPromises = images.map((image) => {
          return new Promise((innerResolve, innerReject) => {
            wx.uploadFile({
              url: `${config.BACKEND_URL}/contact/upload_media`,
              filePath: image.path,
              name: "file",
              header: {
                "Content-Type": "multipart/form-data",
                Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
              },
              success: (res) => {
                try {
                  const data = JSON.parse(res.data);
                  if (data.status === "success") {
                    innerResolve(data.url);
                  } else {
                    innerReject(
                      new Error(
                        data.message || this.data.messages.errors.uploadFailed
                      )
                    );
                  }
                } catch (error) {
                  innerReject(new Error(this.data.messages.errors.parseFailed));
                }
              },
              fail: (err) => {
                innerReject(
                  new Error(
                    `${this.data.messages.errors.requestFailed}: ${err.errMsg}`
                  )
                );
              },
            });
          });
        });

        // Wait for all uploads to complete
        const results = await Promise.all(uploadPromises);
        resolve(results.filter((url) => url !== null));
      } catch (error) {
        reject(error);
      }
    });
  },

  // Submit the form data with image URLs
  submitForm: function (title, description, imageUrls) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/contact/create`,
        method: "POST",
        data: {
          title,
          description,
          image_urls: imageUrls,
        },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            resolve(res.data);
          } else {
            wx.showToast({
              title: res.data.msg,
              icon: "none",
              duration: 3000,
            });
            reject(
              new Error(res.data.message || this.data.messages.errors.submitFailed)
            );
          }
        },
        fail: (err) => {
          reject(
            new Error(`${this.data.messages.errors.requestFailed}: ${err.errMsg}`)
          );
        },
      });
    });
  },
});
