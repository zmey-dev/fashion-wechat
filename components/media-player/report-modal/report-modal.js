const { default: config } = require("../../../config");
const ucloudUpload = require("../../../services/ucloudUpload");

// components/report-modal/report-modal.js
Component({
  /**
   * Component properties list
   */
  properties: {
    // Whether to show modal
    visible: {
      type: Boolean,
      value: false,
    },
    // Post ID to report
    postId: {
      type: String,
      value: "",
    },
  },

  /**
   * Component initial data
   */
  data: {
    // Report reason list
    reasons: [
      { title: "色情低俗", value: "色情低俗", icon: "🔞" },
      { title: "违法违规", value: "违法违规", icon: "⚠️" },
      { title: "政治敏感", value: "政治敏感", icon: "🏛️" },
      { title: "不实信息", value: "不实信息", icon: "❌" },
      { title: "违规营销", value: "违规营销", icon: "📢" },
      { title: "危害人身安全", value: "危害人身安全", icon: "🚨" },
      { title: "未成年相关", value: "未成年相关", icon: "👶" },
      { title: "侵犯权益", value: "侵犯权益", icon: "⚖️" },
      { title: "其他", value: "其他", icon: "📝" },
    ],

    // Form data
    selectedReason: "",
    description: "",
    images: [],
    maxImages: 4,

    // UI state
    isSubmitting: false,
    isLoading: false, // Loading state for processing
    loadingMessage: "",
    
    // Upload states
    uploadingImages: [],
    imageUploadProgress: {},
    imageUploadErrors: {},},

  /**
   * Component methods list
   */  methods: {
    // Handle reason selection
    onReasonChange(e) {
      this.setData({
        selectedReason: e.detail.value,
      });
      this.addHapticFeedback("light");
    },

    // Handle description input
    onDescriptionInput(e) {
      this.setData({
        description: e.detail.value,
      });
    },

    // Handle image upload
    onChooseImage() {
      const { images, maxImages } = this.data;
      const remainingSlots = maxImages - images.length;

      if (remainingSlots <= 0) {
        wx.showToast({
          title: "最多只能上传4张图片",
          icon: "none",
        });
        return;
      }

      wx.chooseMedia({
        count: remainingSlots,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        maxDuration: 30,
        camera: "back",
        success: (res) => {
          const newImages = res.tempFiles.map((file) => ({
            tempFilePath: file.tempFilePath,
            size: file.size,
            uploaded: false,
            uploadResult: null
          }));

          this.setData({
            images: [...images, ...newImages],
          });

          this.addHapticFeedback("light");
          
          // Start background upload immediately
          this.startBackgroundUploads(res.tempFiles);
        },
        fail: (err) => {
          wx.showToast({
            title: "选择图片失败",
            icon: "none",
          });
        },
      });    },

    // Remove image
    onRemoveImage(e) {
      const { index } = e.currentTarget.dataset;
      const { images } = this.data;

      images.splice(index, 1);
      this.setData({
        images,
      });

      this.addHapticFeedback("medium");
    },

    // Replace image
    onReplaceImage(e) {
      const { index } = e.currentTarget.dataset;

      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        success: (res) => {
          const { images } = this.data;
          images[index] = {
            tempFilePath: res.tempFiles[0].tempFilePath,
            size: res.tempFiles[0].size,
            uploaded: false,
            uploadResult: null
          };

          this.setData({
            images,
          });

          this.addHapticFeedback("light");
          
          // Start background upload for replaced image
          this.startBackgroundUploads([res.tempFiles[0]], index);
        },
        fail: (err) => {
        },
      });    },

    // Submit report
    async onSubmit() {
      const { selectedReason, description, images, isSubmitting } = this.data;
      const { postId } = this.properties;

      // Prevent duplicate submission
      if (isSubmitting) return;

      // Validation
      if (!postId || !selectedReason || !description.trim()) {
        wx.showToast({
          title: "请填写完整信息",
          icon: "none",
          duration: 2000,
        });
        this.addHapticFeedback("heavy");
        return;
      }

      // Set submission state
      this.setData({ 
        isSubmitting: true,
        isLoading: true,
        loadingMessage: "提交中..."
      });

      try {        // Initialize form data
        const formData = {
          post_id: postId,
          reason: selectedReason,
          description: description.trim(),
          image_urls: []
        };

        // Handle image URLs from already uploaded images
        if (images && images.length > 0) {
          const imageUrls = [];
          
          for (let i = 0; i < images.length; i++) {
            const image = images[i];
            
            if (image.uploaded && image.uploadResult && image.uploadResult.url) {
              // Use already uploaded URL
              imageUrls.push(image.uploadResult.url);
            } else if (image.tempFilePath) {
              // Need to upload now (fallback)
              this.setData({
                loadingMessage: `上传图片 ${i + 1}/${images.length}...`
              });
              
              try {
                const uploadResult = await ucloudUpload.uploadImageSimple(
                  image.tempFilePath,
                  null,
                  'report_images'
                );
                
                if (uploadResult && uploadResult.url) {
                  imageUrls.push(uploadResult.url);
                } else {
                  throw new Error("上传失败");
                }
              } catch (error) {
                throw new Error(`图片${i + 1}上传失败: ${error.message}`);
              }
            }
          }
          
          formData.image_urls = imageUrls;
        }

        // After all images uploaded, submit report
        const result = await this.submitReport(formData);

        this.setData({ 
          isLoading: false,
          loadingMessage: ""
        });

        if (result.status === "success") {
          // Success feedback
          wx.showToast({
            title: "举报提交成功",
            icon: "success",
            duration: 2000,
          });

          this.addHapticFeedback("heavy");          // Trigger success event
          this.triggerEvent("success", {
            message: "举报提交成功",
            data: result,
          });

          // Delay close to let user see success message
          setTimeout(() => {
            this.resetForm();
            this.triggerEvent("close");
          }, 1500);
        } else {
          throw new Error(result.message || "提交失败");
        }
      } catch (error) {
        this.setData({ 
          isLoading: false,
          loadingMessage: ""
        });

        const errorMessage = error.message || "网络错误，请重试";
        wx.showToast({
          title: errorMessage,
          icon: "none",
          duration: 3000,
        });

        this.addHapticFeedback("heavy");        // Trigger error event
        this.triggerEvent("error", {
          error: error,
          message: errorMessage,
        });
      } finally {
        // Reset submission state
        this.setData({ 
          isSubmitting: false,
          isLoading: false,
          loadingMessage: ""
        });
      }
    },

    // Submit report to server
    submitReport(data) {
      return new Promise((resolve, reject) => {
        const app = getApp();
        wx.request({
          url: config.BACKEND_URL + "/report/create",
          method: "POST",
          data: data,
          header: {
            "content-type": "application/json",
            // Can add authentication headers
            Authorization: "Bearer " + app.globalData.userInfo.token,
          },
          success: (res) => {
            resolve(res.data);
          },
          fail: reject,
        });
      });    },

    // Reset form
    resetForm() {
      this.setData({
        selectedReason: "",
        description: "",
        images: [],
        isSubmitting: false,
        isLoading: false,
        loadingMessage: "",
      });
    },

    // Close modal
    onClose() {
      // If submitting, ask user to confirm close
      if (this.data.isSubmitting) {
        wx.showModal({
          title: "提示",
          content: "正在提交举报，确定要关闭吗？",
          success: (res) => {
            if (res.confirm) {
              this.resetForm();
              this.triggerEvent("close");
            }
          },
        });
        return;      }

      // If there's unsaved content, ask user
      const { selectedReason, description, images } = this.data;
      if (selectedReason || description.trim() || images.length > 0) {
        wx.showModal({
          title: "提示",
          content: "有未保存的内容，确定要关闭吗？",
          success: (res) => {
            if (res.confirm) {
              this.resetForm();
              this.triggerEvent("close");
            }
          },
        });
        return;
      }

      this.resetForm();
      this.triggerEvent("close");    },

    // Prevent bubbling
    preventBubble() {
      // Empty function to prevent event bubbling
    },

    // Add haptic feedback
    addHapticFeedback(type = "light") {
      if (wx.vibrateShort) {
        wx.vibrateShort({
          type: type, // light, medium, heavy
        });
      }
    },
    
    // Start background uploads immediately after image selection
    async startBackgroundUploads(tempFiles, replaceIndex = null) {
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
            'report_images'
          );
          
          if (uploadResult && uploadResult.url) {
            // Update the corresponding image with upload result
            const images = [...this.data.images];
            if (replaceIndex !== null) {
              // For replaced images
              images[replaceIndex].uploadResult = uploadResult;
              images[replaceIndex].uploaded = true;
            } else {
              // For new images
              const imageIndex = images.findIndex(img => img.tempFilePath === file.tempFilePath);
              if (imageIndex !== -1) {
                images[imageIndex].uploadResult = uploadResult;
                images[imageIndex].uploaded = true;
              }
            }
            
            // Remove from uploading list
            const updatedUploading = this.data.uploadingImages.filter(id => id !== uploadId);
            this.setData({ 
              images: images,
              uploadingImages: updatedUploading 
            });
          } else {
            throw new Error("上传结果无效");
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
            [`imageUploadErrors.${uploadId}`]: error.message || "上传失败"
          });
          
          // Show error toast
          wx.showToast({
            title: `图片 ${i + 1} 上传失败`,
            icon: 'none',
            duration: 2000
          });
        }
      }
    },  },

  /**
   * Observers
   */  observers: {
    visible: function (visible) {
      if (visible) {
        // Logic when modal is shown
        this.addHapticFeedback("light");
      } else {
        // Reset form when modal is hidden
        this.resetForm();
      }
    },
  },
});
