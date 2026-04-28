const { default: config } = require("../../config");
const { isContainSword } = require("../../utils/isContainSword");
const ucloudUpload = require("../../services/ucloudUpload");

const app = getApp();

Page({
  data: {
    categories: [
      { label: "新鲜事", value: "新鲜事" },
      { label: "日常投稿", value: "日常投稿" },
      { label: "二手闲置", value: "二手闲置" },
    ],
    selectedCategory: "",
    campusData: [],
    selectedCampusId: null,
    title: "",
    content: "",
    files: [],
    maxFiles: 10,
    isSubmitting: false,
    canSubmit: false,
    loading: false,
    loadingMessage: "",
    uploadingFiles: [],
  },

  onLoad() {
    ucloudUpload.resetUploadState();
    this.loadCampuses();
  },

  loadCampuses() {
    wx.request({
      url: `${config.BACKEND_URL}/campus`,
      method: "GET",
      success: (res) => {
        if (res.data.status === "success") {
          this.setData({ campusData: res.data.data || [] });
        }
      },
    });
  },

  onClose() {
    wx.navigateBack({ delta: 1 });
  },

  onCategoryTap(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({
      selectedCategory: this.data.selectedCategory === value ? "" : value,
    });
    this.checkCanSubmit();
  },

  onCampusTap(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      selectedCampusId: this.data.selectedCampusId === id ? null : id,
    });
  },

  onTitleInput(e) {
    const value = e.detail.value;
    if (isContainSword(value)) {
      wx.showToast({ title: "请避免使用不当语言", icon: "none" });
      return;
    }
    this.setData({ title: value });
    this.checkCanSubmit();
  },

  onContentInput(e) {
    const value = e.detail.value;
    if (isContainSword(value)) {
      wx.showToast({ title: "请避免使用不当语言", icon: "none" });
      return;
    }
    this.setData({ content: value });
    this.checkCanSubmit();
  },

  checkCanSubmit() {
    const { selectedCategory, title, content } = this.data;
    this.setData({
      canSubmit: selectedCategory && title.trim() && content.trim(),
    });
  },

  isImage(file) {
    return file && file.type === "image";
  },

  onAddMedia() {
    const { files } = this.data;

    if (files.length > 0 && files[0].type === "video") {
      wx.showToast({ title: "视频模式下不能添加更多文件", icon: "none" });
      return;
    }

    const remainingSlots = this.data.maxFiles - files.length;
    if (remainingSlots <= 0) {
      wx.showToast({ title: `最多上传 ${this.data.maxFiles} 个文件`, icon: "none" });
      return;
    }

    wx.chooseMedia({
      count: Math.min(remainingSlots, 9),
      mediaType: ["image", "video"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: (res) => {
        if (!res.tempFiles || res.tempFiles.length === 0) return;

        const currentFiles = this.data.files;

        const newFiles = res.tempFiles.map((file, index) => {
          const isVideo = file.fileType === "video" ||
            (file.tempFilePath && file.tempFilePath.match(/\.(mp4|mov|avi)$/i));

          return {
            url: file.tempFilePath,
            size: file.size || file.fileSize || 0,
            type: isVideo ? "video" : "image",
            file: file,
            thumbnail: file.thumbTempFilePath || "",
            duration: file.duration || 0,
            uploading: true,
            uploaded: false,
            uploadProgress: 0,
            uploadResult: null,
            uploadError: null,
            backgroundUpload: true,
            fileIndex: currentFiles.length + index,
          };
        });

        this.setData({
          files: [...currentFiles, ...newFiles],
          uploadingFiles: [
            ...this.data.uploadingFiles,
            ...newFiles.map((f) => f.fileIndex),
          ],
        });

        this.startSequentialUploads(newFiles, currentFiles.length);
      },
    });
  },

  onRemoveMedia(e) {
    const { index } = e.currentTarget.dataset;
    const files = [...this.data.files];
    files.splice(index, 1);
    this.setData({ files });
  },

  async startSequentialUploads(filesToUpload, startIndex) {
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const fileIndex = startIndex + i;

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await this.uploadFileInBackground(file, fileIndex);
    }
  },

  async uploadFileInBackground(file, fileIndex) {
    let retryCount = 0;
    const maxRetries = 2;

    const attemptUpload = async () => {
      try {
        const tempFilePath = file.file ? file.file.tempFilePath : file.url;
        const thumbnailPath =
          file.thumbnail || (file.file ? file.file.thumbTempFilePath : null);

        let fileName = file.file ? file.file.name : null;

        if (!fileName && tempFilePath) {
          fileName = tempFilePath.split("/").pop();
        }

        if (!fileName) {
          const ext = file.type === "image" ? "jpg" : file.type === "video" ? "mp4" : "mp3";
          fileName = `file_${Date.now()}.${ext}`;
        }

        const fileForUpload = {
          tempFilePath: tempFilePath,
          thumbTempFilePath: thumbnailPath,
          name: fileName,
          size: file.file ? file.file.size : file.size || 0,
          type: file.type,
          duration: file.duration || (file.file ? file.file.duration : 0),
        };

        if (thumbnailPath && file.type === "video") {
          try {
            await new Promise((resolve, reject) => {
              wx.getFileInfo({
                filePath: thumbnailPath,
                success: resolve,
                fail: reject,
              });
            });
          } catch (e) {}
        }

        const uploadResult = await ucloudUpload.uploadMedia(
          fileForUpload,
          (progress) => {
            const files = this.data.files;
            if (files[fileIndex]) {
              files[fileIndex].uploadProgress = progress;
              this.setData({ files });
            }
          }
        );

        const files = this.data.files;
        if (files[fileIndex]) {
          files[fileIndex].uploading = false;
          files[fileIndex].uploaded = true;
          files[fileIndex].uploadResult = uploadResult;

          const uploadingFiles = this.data.uploadingFiles.filter(
            (idx) => idx !== fileIndex
          );
          this.setData({ files, uploadingFiles });
        }
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount)
          );

          const files = this.data.files;
          if (files[fileIndex]) {
            files[fileIndex].uploadProgress = 0;
            files[fileIndex].uploadError = null;
            this.setData({ files });
          }

          return attemptUpload();
        }

        const files = this.data.files;
        if (files[fileIndex]) {
          files[fileIndex].uploading = false;
          files[fileIndex].uploaded = false;
          files[fileIndex].uploadError = error.message || "上传失败";

          const uploadingFiles = this.data.uploadingFiles.filter(
            (idx) => idx !== fileIndex
          );
          this.setData({ files, uploadingFiles });
        }
      }
    };

    await attemptUpload();
  },

  async onSubmit() {
    const { selectedCategory, selectedCampusId, title, content, files } = this.data;
    const userInfo = app.globalData.userInfo;

    if (!userInfo || !userInfo.token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });
    app.showGlobalLoading();

    if (!selectedCategory || !title.trim() || !content.trim()) {
      this.setData({ isSubmitting: false });
      app.hideGlobalLoading();
      wx.showToast({ title: "请填写必填项", icon: "none" });
      return;
    }

    if (isContainSword(title)) {
      this.setData({ isSubmitting: false });
      app.hideGlobalLoading();
      wx.showToast({ title: "标题包含不当语言，请修改后再提交", icon: "none" });
      return;
    }

    if (isContainSword(content)) {
      this.setData({ isSubmitting: false });
      app.hideGlobalLoading();
      wx.showToast({ title: "内容包含不当语言，请修改后再提交", icon: "none" });
      return;
    }

    if (files.length > 0) {
      const uploadingFiles = files.filter((f) => f.uploading);
      if (uploadingFiles.length > 0) {
        this.setData({ loading: true, loadingMessage: "等待文件上传完成..." });
        let waitCount = 0;
        const maxWait = 1200;
        while (this.data.files.some((f) => f.uploading) && waitCount < maxWait) {
          await new Promise((r) => setTimeout(r, 100));
          waitCount++;
        }
        if (waitCount >= maxWait) {
          this.setData({ loading: false, isSubmitting: false });
          app.hideGlobalLoading();
          wx.showToast({ title: "文件上传超时，请检查网络后重试", icon: "none" });
          return;
        }
      }

      const failedFiles = this.data.files.filter((f) => f.uploadError);
      if (failedFiles.length > 0) {
        this.setData({ loading: true, loadingMessage: "重试失败的上传..." });
        const updated = this.data.files.map((f, i) => {
          if (f.uploadError) {
            this.uploadFileInBackground(f, i);
            return { ...f, uploadError: null, uploading: true, uploadProgress: 0 };
          }
          return f;
        });
        this.setData({ files: updated });

        while (this.data.files.some((f) => f.uploading)) {
          await new Promise((r) => setTimeout(r, 100));
        }
        this.setData({ loading: false });
      }

      const stillFailed = this.data.files.filter((f) => f.uploadError);
      if (stillFailed.length > 0) {
        this.setData({ loading: false, isSubmitting: false });
        app.hideGlobalLoading();

        let errorMsg = "文件上传失败，请检查后重试";
        const firstError = stillFailed[0].uploadError;
        if (firstError && (firstError.includes("不受支持") || firstError.includes("不支持"))) {
          errorMsg = firstError;
        }
        wx.showToast({ title: errorMsg, icon: "none" });
        return;
      }
    }

    this.setData({ loading: true, loadingMessage: "发布中..." });

    const fileUrls = [];
    const previewFileUrls = [];

    this.data.files.forEach((fileItem) => {
      if (!fileItem.uploaded || !fileItem.uploadResult) return;

      let fileUrl = null;
      let previewUrl = null;

      if (fileItem.uploadResult.uploadUrl && fileItem.uploadResult.blurUrl) {
        fileUrl = fileItem.uploadResult.uploadUrl;
        previewUrl = fileItem.uploadResult.blurUrl;
      } else if (fileItem.uploadResult.videoUrl && fileItem.uploadResult.thumbnailUrl) {
        fileUrl = fileItem.uploadResult.videoUrl;
        previewUrl = fileItem.uploadResult.thumbnailUrl;
      } else {
        fileUrl = fileItem.uploadResult.url || fileItem.uploadResult.fileUrl ||
          fileItem.uploadResult.videoUrl || fileItem.uploadResult.uploadUrl ||
          fileItem.url;
        previewUrl = fileUrl;
      }

      if (fileUrl) {
        if (!fileUrl.startsWith("http")) {
          fileUrl = `https://xiaoshow.cn-wlcb.ufileos.com/${fileUrl}`;
        }
        if (previewUrl && !previewUrl.startsWith("http")) {
          previewUrl = `https://xiaoshow.cn-wlcb.ufileos.com/${previewUrl}`;
        }
        fileUrls.push(fileUrl);
        previewFileUrls.push(previewUrl || fileUrl);
      }
    });

    let postType = "text";
    if (fileUrls.length > 0) {
      const hasVideo = this.data.files.some((f) => f.type === "video" && f.uploaded);
      postType = hasVideo ? "video" : "image";
    }

    const postData = {
      title: title.trim(),
      content: content.trim(),
      type: postType,
      category: selectedCategory,
    };

    if (fileUrls.length > 0) {
      postData.file_urls = fileUrls;
      postData.preview_file_urls = previewFileUrls;
    }

    if (selectedCampusId) {
      postData.campus_id = selectedCampusId;
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/create`,
      method: "POST",
      data: postData,
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userInfo.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          this.setData({ loading: true, isSubmitting: true });
          wx.showToast({ title: "发布成功", icon: "success", duration: 2000 });

          setTimeout(() => {
            app.globalData.refreshPosts = true;
            wx.redirectTo({ url: "/pages/me/me" });
          }, 1500);
        } else {
          this.setData({ loading: false, isSubmitting: false });
          app.hideGlobalLoading();
          wx.showToast({ title: res.data.msg || "发布失败", icon: "none" });
        }
      },
      fail: (error) => {
        this.setData({ loading: false, isSubmitting: false });
        app.hideGlobalLoading();

        let errorMsg = "提交失败，请检查网络连接后重试";
        const errorStr = error.errMsg || error.message || "";
        if (errorStr.includes("timeout")) {
          errorMsg = "上传超时，请检查网络或减小文件大小";
        } else if (errorStr.includes("network")) {
          errorMsg = "网络连接异常，请检查网络后重试";
        }
        wx.showToast({ title: errorMsg, icon: "none" });
      },
    });
  },
});
