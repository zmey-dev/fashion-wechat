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
    showSidebar: false,
  },

  onLoad: function (options) {
    // Subscribe to sidebar state changes
    this.sidebarHandler = (showSidebar) => {
      this.setData({ showSidebar });
    };
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    app.subscribe("userInfo", this.userInfoHandler);
    app.subscribe("showSidebar", this.sidebarHandler);
    this.setData({
      showSidebar: app.globalData.showSidebar || false,
      userInfo: app.globalData.userInfo || {},
    });
  },

  onUnload: function () {
    app.unsubscribe("showSidebar", this.sidebarHandler);
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
        title: `最多只能上传${maxImages}张图片`,
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
        title: "请填写标题和您的建议",
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
      title: "提交中...",
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
          title: "您的建议已成功提交！感谢您的反馈",
          icon: "success",
          duration: 3000,
        });

        // Add haptic feedback for success if available
        if (wx.vibrateShort) {
          wx.vibrateShort({ type: "medium" });
        }
      } else {
        throw new Error(result.message || "提交失败");
      }
    } catch (error) {
      // Hide loading indicator
      wx.hideLoading();

      console.error("Submission error:", error);
      this.setData({ isSubmitting: false });

      // Show error message
      const errorMessage = error.message || "提交失败，请稍后重试";
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
                      new Error(data.message || "Image upload failed")
                    );
                  }
                } catch (error) {
                  innerReject(new Error("Failed to parse upload response"));
                }
              },
              fail: (err) => {
                innerReject(new Error(`Upload request failed: ${err.errMsg}`));
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
            reject(new Error(res.data.message || "Form submission failed"));
          }
        },
        fail: (err) => {
          reject(new Error(`Request failed: ${err.errMsg}`));
        },
      });
    });
  },
});
