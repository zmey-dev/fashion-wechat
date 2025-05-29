const { default: config } = require("../../../config");

// components/report-modal/report-modal.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false,
    },
    // 要举报的帖子ID
    postId: {
      type: String,
      value: "",
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    // 举报原因列表
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

    // 表单数据
    selectedReason: "",
    description: "",
    images: [],
    maxImages: 4,

    // UI状态
    isSubmitting: false,
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 处理原因选择
    onReasonChange(e) {
      this.setData({
        selectedReason: e.detail.value,
      });
      this.addHapticFeedback("light");
    },

    // 处理描述输入
    onDescriptionInput(e) {
      this.setData({
        description: e.detail.value,
      });
    },

    // 处理图片上传
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
          }));

          this.setData({
            images: [...images, ...newImages],
          });

          this.addHapticFeedback("light");
        },
        fail: (err) => {
          console.error("选择图片失败:", err);
          wx.showToast({
            title: "选择图片失败",
            icon: "none",
          });
        },
      });
    },

    // 删除图片
    onRemoveImage(e) {
      const { index } = e.currentTarget.dataset;
      const { images } = this.data;

      images.splice(index, 1);
      this.setData({
        images,
      });

      this.addHapticFeedback("medium");
    },

    // 替换图片
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
          };

          this.setData({
            images,
          });

          this.addHapticFeedback("light");
        },
        fail: (err) => {
          console.error("替换图片失败:", err);
        },
      });
    },

    // 提交举报
    async onSubmit() {
      const { selectedReason, description, images, isSubmitting } = this.data;
      const { postId } = this.properties;

      // 防止重复提交
      if (isSubmitting) return;

      // 验证
      if (!postId || !selectedReason || !description.trim()) {
        wx.showToast({
          title: "请填写完整信息",
          icon: "none",
          duration: 2000,
        });
        this.addHapticFeedback("heavy");
        return;
      }

      // 设置提交状态
      this.setData({ isSubmitting: true });

      // 显示加载动画
      wx.showLoading({
        title: "提交中...",
        mask: true,
      });

      try {
        // 初始化表单数据
        const formData = {
          post_id: postId,
          reason: selectedReason,
          description: description.trim(),
          image_urls: []
        };

        // 处理图片上传
        if (images && images.length > 0) {
          // 将所有图片上传包装为Promise数组
          const uploadPromises = images.map((image) => {
            if (!image.tempFilePath) return Promise.resolve(null);
            
            return new Promise((resolve, reject) => {
              wx.uploadFile({
                url: config.BACKEND_URL + "/report/upload_media",
                filePath: image.tempFilePath,
                name: "file",
                header: {
                  "content-type": "multipart/form-data",
                  Authorization: "Bearer " + getApp().globalData.userInfo.token,
                },
                success: (res) => {
                  try {
                    const data = JSON.parse(res.data);
                    if (data.status === "success") {
                      resolve(data.url);
                    } else {
                      reject(new Error(data.message || "图片上传失败"));
                    }
                  } catch (error) {
                    reject(new Error("解析上传响应失败"));
                  }
                },
                fail: (err) => {
                  reject(new Error("图片上传请求失败:" + err.errMsg));
                }
              });
            });
          });

          // 等待所有图片上传完成
          const uploadedUrls = await Promise.all(uploadPromises);
          formData.image_urls = uploadedUrls.filter(url => url !== null);
        }

        // 所有图片上传完成后，提交举报
        const result = await this.submitReport(formData);

        wx.hideLoading();

        if (result.status === "success") {
          // 成功反馈
          wx.showToast({
            title: "举报提交成功",
            icon: "success",
            duration: 2000,
          });

          this.addHapticFeedback("heavy");

          // 触发成功事件
          this.triggerEvent("success", {
            message: "举报提交成功",
            data: result,
          });

          // 延迟关闭，让用户看到成功提示
          setTimeout(() => {
            this.resetForm();
            this.triggerEvent("close");
          }, 1500);
        } else {
          throw new Error(result.message || "提交失败");
        }
      } catch (error) {
        wx.hideLoading();
        console.error("提交举报错误:", error);

        const errorMessage = error.message || "网络错误，请重试";
        wx.showToast({
          title: errorMessage,
          icon: "none",
          duration: 3000,
        });

        this.addHapticFeedback("heavy");

        // 触发失败事件
        this.triggerEvent("error", {
          error: error,
          message: errorMessage,
        });
      } finally {
        // 重置提交状态
        this.setData({ isSubmitting: false });
      }
    },

    // 提交举报到服务器
    submitReport(data) {
      return new Promise((resolve, reject) => {
        const app = getApp();
        wx.request({
          url: config.BACKEND_URL + "/report/create",
          method: "POST",
          data: data,
          header: {
            "content-type": "application/json",
            // 可以添加认证头部
            Authorization: "Bearer " + app.globalData.userInfo.token,
          },
          success: (res) => {
            resolve(res.data);
          },
          fail: reject,
        });
      });
    },

    // 重置表单
    resetForm() {
      this.setData({
        selectedReason: "",
        description: "",
        images: [],
        isSubmitting: false,
      });
    },

    // 关闭弹窗
    onClose() {
      // 如果正在提交，询问用户是否确认关闭
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
        return;
      }

      // 如果有未保存的内容，询问用户
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
      this.triggerEvent("close");
    },

    // 阻止冒泡
    preventBubble() {
      // 空函数，用于阻止事件冒泡
    },

    // 添加触觉反馈
    addHapticFeedback(type = "light") {
      if (wx.vibrateShort) {
        wx.vibrateShort({
          type: type, // light, medium, heavy
        });
      }
    },
  },

  /**
   * 监听器
   */
  observers: {
    visible: function (visible) {
      if (visible) {
        // 弹窗显示时的逻辑
        this.addHapticFeedback("light");
      } else {
        // 弹窗隐藏时重置表单
        this.resetForm();
      }
    },
  },
});
