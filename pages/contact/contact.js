// pages/contact/contact.js
const { default: config } = require("../../config");
const ucloudUpload = require("../../services/ucloudUpload");

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
    isLoading: false, // Loading state for submission
    
    // Upload states
    uploadingImages: [],
    imageUploadProgress: {},
    imageUploadErrors: {},
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

        try {
          this.startBackgroundUploads(tempFiles);
        } catch (error) {
        }
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
    this.setData({ 
      isSubmitting: true,
      isLoading: true 
    });
    getApp().showGlobalLoading();

    try {
      // Upload images first if any
      let imageUrls = [];
      if (images && images.length > 0) {
        imageUrls = await this.uploadImages(images);
      }

      // Then submit the form with image URLs
      const result = await this.submitForm(title, description, imageUrls);

      if (result.status === "success") {
        // Reset form after successful submission
        this.setData({
          title: "",
          description: "",
          images: [],
          isSubmitting: false,
          isLoading: false,
        });

        // Show success message
        wx.showToast({
          title: this.data.messages.success.submitted,
          icon: "success",
          duration: 3000,
        });
        getApp().hideGlobalLoading();

        // Add haptic feedback for success if available
        if (wx.vibrateShort) {
          wx.vibrateShort({ type: "medium" });
        }
      } else {
        getApp().hideGlobalLoading();
        throw new Error(
          result.message || this.data.messages.errors.submitFailed
        );
      }
    } catch (error) {
      this.setData({ 
        isSubmitting: false,
        isLoading: false 
      });
      getApp().hideGlobalLoading();

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

  // Upload images using UCloud and get their URLs
  uploadImages: async function (images) {
    if (!images.length) return Promise.resolve([]);


    try {
      const uploadResults = [];
      
      // Check if images are already uploaded in background
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        
        if (image.uploaded && image.uploadResult && image.uploadResult.url) {
          uploadResults.push(image.uploadResult.url);
        } else {
          const uploadId = `${Date.now()}_${i}`;
          
          this.setData({
            uploadingImages: [...this.data.uploadingImages, uploadId],
            [`imageUploadProgress.${uploadId}`]: 0
          });
          
          try {
            // Progress callback
            const progressCallback = (progress) => {
              this.setData({
                [`imageUploadProgress.${uploadId}`]: progress
              });
            };
            
            
            const uploadResult = await ucloudUpload.uploadImageSimple(
              image.path,
              progressCallback,
              'contact_images'
            );
            
            
            if (uploadResult && uploadResult.url) {
              uploadResults.push(uploadResult.url);
              
              // Remove from uploading list
              const updatedUploading = this.data.uploadingImages.filter(id => id !== uploadId);
              this.setData({ uploadingImages: updatedUploading });
              
            } else {
              throw new Error("上传结果无效");
            }
            
            // Add delay between uploads
            if (i < images.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            
            // Remove from uploading list and add error
            const updatedUploading = this.data.uploadingImages.filter(id => id !== uploadId);
            this.setData({
              uploadingImages: updatedUploading,
              [`imageUploadErrors.${uploadId}`]: error.message || "上传失败"
            });
            
            throw new Error(`图片 ${i + 1} 上传失败: ${error.message}`);
          }
        }
      }
      
      return uploadResults;
    } catch (error) {
      throw error;
    }
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

  startBackgroundUploads: async function(tempFiles) {
    
    for (let i = 0; i < tempFiles.length; i++) {
      const file = tempFiles[i];
      const uploadId = `${Date.now()}_${i}`;
      
      
      // Add to uploading list
      this.setData({
        uploadingImages: [...this.data.uploadingImages, uploadId],
        [`imageUploadProgress.${uploadId}`]: 0
      });
      
      try {
        // Progress callback
        const progressCallback = (progress) => {
          this.setData({
            [`imageUploadProgress.${uploadId}`]: progress
          });
        };
        
        // Upload using UCloud
        const uploadResult = await ucloudUpload.uploadImageSimple(
          file.tempFilePath,
          progressCallback,
          'contact_images'
        );
        
        
        if (uploadResult && uploadResult.url) {
          // Update the corresponding image with upload result
          const images = [...this.data.images];
          const imageIndex = images.findIndex(img => img.path === file.tempFilePath);
          if (imageIndex !== -1) {
            images[imageIndex].uploadResult = uploadResult;
            images[imageIndex].uploaded = true;
          }
          
          // Remove from uploading list
          const updatedUploading = this.data.uploadingImages.filter(id => id !== uploadId);
          this.setData({ 
            images: images,
            uploadingImages: updatedUploading 
          });
          
        } else {
          throw new Error("failed upload");
        }
        
        // Add delay between uploads
        if (i < tempFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        
        // Remove from uploading list and add error
        const updatedUploading = this.data.uploadingImages.filter(id => id !== uploadId);
        this.setData({
          uploadingImages: updatedUploading,
          [`imageUploadErrors.${uploadId}`]: error.message || "업로드 실패"
        });
        
        // Show error toast
        wx.showToast({
          title: `图片 ${i + 1} 上传失败`,
          icon: 'none',
          duration: 2000
        });
      }
    }
    
  },
});
