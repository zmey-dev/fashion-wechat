const { default: config } = require("../../config");

Page({
  data: {
    currentPath: "upload",
    userInfo: getApp().globalData.userInfo || {},

    // Form data
    title: "",
    content: "",
    allowDownload: false,

    // File management
    files: [],
    audio: null,
    audioName: "",
    maxFiles: 10,

    // Image annotation system
    selectedImageIndex: null,
    imageDots: {},
    editingDot: null,
    showDotEditor: false,

    // UI states
    loading: false,
    imageLoading: false,
    activeTab: "media", // 'media' or 'form'
    showInstructions: true,

    // Update mode
    isUpdateMode: false,
    mediaId: null,
    deletedFiles: [],

    // Event related
    eventId: null,
    eventTitle: "",
    mediaCreateType: "",

    // Chinese messages for UI text
    messages: {
      loading: "上传中...",
      updating: "更新中...",
      errors: {
        titleRequired: "请输入标题",
        contentRequired: "请输入描述",
        filesRequired: "请上传媒体文件",
        videoLimit: "视频模式只能上传一个文件",
        maxFilesLimit: "最多只能上传",
        videoImageConflict: "视频模式不能添加图片",
        videoAudioConflict: "视频模式不支持背景音乐",
        audioOnly: "只能选择音频文件",
        audioSizeLimit: "音频文件不能超过10MB",
        chooseAudioFailed: "选择音频失败",
        operationFailed: "操作失败，请重试",
        uploadFailed: "上传失败",
        createFailed: "创建失败",
        updateFailed: "更新失败",
        requestFailed: "请求失败",
        parseFailed: "响应解析失败",
      },
      success: {
        filesAdded: "已添加",
        videoAdded: "视频已添加",
        audioSelected: "音频已选择",
        fileDeleted: "文件已删除",
        dotAdded: "标记点已添加",
        dotDeleted: "标记点已删除",
        dotUpdated: "标记点已更新",
        createSuccess: "创建成功",
        updateSuccess: "更新成功",
      },
      confirmations: {
        deleteFileTitle: "确认删除",
        deleteFileContent: "确定要删除这个文件吗？",
        deleteDotTitle: "确认删除",
        deleteDotContent: "确定要删除这个标记点吗？",
      },
      actions: {
        takePhoto: "拍摄照片",
        selectFromAlbum: "从相册选择",
        takeVideo: "拍摄视频",
      },
    },
  },

  onLoad: function (options) {
    const app = getApp();

    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
    };
    app.subscribe("userInfo", this.userInfoHandler);
    this.setData({
      userInfo: app.globalData.userInfo || {},
    });
    const { eventId, mediaId, mediaCreateType } = options;

    this.setData({
      eventId: eventId || null,
      mediaId: mediaId || null,
      mediaCreateType: mediaCreateType || "",
      isUpdateMode: !!mediaId,
    });

    if (eventId) {
      this.loadEventInfo(eventId);
    }

    if (mediaId) {
      this.loadExistingPost(mediaId);
    }
  },

  onUnload: function () {
    const app = getApp();
    app.unsubscribe("userInfo", this.userInfoHandler);
  },

  // Load event information
  loadEventInfo(eventId) {
    // Simulate API call to get event info
    wx.request({
      url: `${config.BACKEND_URL}/event/${eventId}`,
      method: "GET",
      success: (res) => {
        if (res.data.status === "success") {
          this.setData({
            eventTitle: res.data.event.title,
          });
        }
      },
    });
  },

  // Load existing post for update
  loadExistingPost(mediaId) {
    wx.showLoading({ title: this.data.messages.loading });

    wx.request({
      url: `${getApp().globalData.apiBase}/posts/${mediaId}`,
      method: "GET",
      success: (res) => {
        if (res.data.status === "success") {
          const post = res.data.post;

          this.setData({
            title: post.title || "",
            content: post.content || "",
            allowDownload: post.allow_download || false,
            files: post.filenames
              ? JSON.parse(post.filenames).map((filename) => ({
                  url: filename,
                  isExisting: true,
                }))
              : [],
            imageDots: post.image_dots ? JSON.parse(post.image_dots) : {},
          });
        }
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },

  // Handle media file selection
  chooseMedia() {
    const { files } = this.data;

    if (files.length > 0 && files[0].type === "video") {
      wx.showToast({
        title: this.data.messages.errors.videoLimit,
        icon: "none",
      });
      return;
    }

    const remainingSlots = this.data.maxFiles - files.length;
    if (remainingSlots <= 0) {
      wx.showToast({
        title: `${this.data.messages.errors.maxFilesLimit} ${this.data.maxFiles} 个文件`,
        icon: "none",
      });
      return;
    }

    const itemList = [
      this.data.messages.actions.takePhoto,
      this.data.messages.actions.selectFromAlbum,
    ];
    if (files.length === 0) {
      itemList.push(this.data.messages.actions.takeVideo);
    }

    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.chooseImage("camera");
            break;
          case 1:
            this.chooseImage("album");
            break;
          case 2:
            if (files.length === 0) {
              this.chooseVideo();
            }
            break;
        }
      },
    });
  },

  // Choose images
  chooseImage(sourceType) {
    const { files } = this.data;

    if (files.length > 0 && files[0].type === "video") {
      wx.showToast({
        title: this.data.messages.errors.videoImageConflict,
        icon: "none",
      });
      return;
    }

    const remainingSlots = this.data.maxFiles - files.length;

    wx.chooseMedia({
      count: Math.min(remainingSlots, 9),
      mediaType: ["image"],
      sourceType: [sourceType],
      success: (res) => {
        this.setData({ imageLoading: true });

        const newFiles = res.tempFiles.map((file) => ({
          url: file.tempFilePath,
          size: file.size,
          type: "image",
          file: file,
        }));

        this.setData({
          files: [...files, ...newFiles],
          imageLoading: false,
        });

        wx.showToast({
          title: `${this.data.messages.success.filesAdded} ${newFiles.length} 个文件`,
          icon: "success",
        });
      },
      fail: () => {
        this.setData({ imageLoading: false });
      },
    });
  },

  // Choose video
  chooseVideo() {
    const { files } = this.data;

    if (files.length > 0) {
      wx.showToast({
        title: this.data.messages.errors.videoLimit,
        icon: "none",
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      success: (res) => {
        const videoFile = res.tempFiles[0];

        this.setData({
          files: [
            {
              url: videoFile.tempFilePath,
              size: videoFile.size,
              type: "video",
              file: videoFile,
            },
          ],
        });

        wx.showToast({
          title: this.data.messages.success.videoAdded,
          icon: "success",
        });
      },
    });
  },

  // Remove file
  removeFile(e) {
    const { index } = e.currentTarget.dataset;
    const { files, imageDots, selectedImageIndex } = this.data;

    wx.showModal({
      title: this.data.messages.confirmations.deleteFileTitle,
      content: this.data.messages.confirmations.deleteFileContent,
      success: (res) => {
        if (res.confirm) {
          const newFiles = [...files];
          const removedFile = newFiles.splice(index, 1)[0];

          // Handle deleted files for update mode
          const deletedFiles = [...this.data.deletedFiles];
          if (removedFile.isExisting) {
            deletedFiles.push(removedFile.url.split("/").pop());
          }

          // Remove associated dots
          const newImageDots = { ...imageDots };
          delete newImageDots[index];

          // Reindex dots
          const reindexedDots = {};
          Object.keys(newImageDots).forEach((key) => {
            const numKey = parseInt(key);
            if (numKey > index) {
              reindexedDots[numKey - 1] = newImageDots[key];
            } else {
              reindexedDots[key] = newImageDots[key];
            }
          });

          // Reset selected image if necessary
          let newSelectedIndex = selectedImageIndex;
          if (selectedImageIndex === index) {
            newSelectedIndex = null;
          } else if (selectedImageIndex > index) {
            newSelectedIndex = selectedImageIndex - 1;
          }

          this.setData({
            files: newFiles,
            imageDots: reindexedDots,
            selectedImageIndex: newSelectedIndex,
            deletedFiles,
          });

          wx.showToast({
            title: this.data.messages.success.fileDeleted,
            icon: "success",
          });
        }
      },
    });
  },

  // Select image for annotation
  selectImage(e) {
    const { index } = e.currentTarget.dataset;
    const file = this.data.files[index];

    if (this.isImage(file)) {
      this.setData({
        selectedImageIndex: index,
        activeTab: "annotation",
      });
    }
  },

  // Check if file is image
  isImage(file) {
    if (!file) return false;

    const extensions = [
      "jpeg",
      "png",
      "jpg",
      "gif",
      "svg",
      "bmp",
      "ico",
      "heic",
    ];
    const fileName = file.url || file.tempFilePath || "";
    const extension = fileName.toLowerCase().split(".").pop();

    return extensions.includes(extension);
  },

  // Handle image tap for adding dots
  onImageTap(e) {
    const { selectedImageIndex } = this.data;
    if (selectedImageIndex === null) return;

    const className = e.target.dataset.class || "";
    if (className.includes("dot") || className.includes("remove")) {
      return;
    }

    const { x, y } = e.detail;
    const query = wx.createSelectorQuery();

    query.select("#annotation-image").boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        const rect = res[0];
        const relativeX = (x - rect.left) / rect.width;
        const relativeY = (y - rect.top) / rect.height;

        this.addDot(relativeX, relativeY);
      }
    });
  },

  // Add dot to image
  addDot(x, y) {
    const { selectedImageIndex, imageDots } = this.data;
    const indexStr = selectedImageIndex.toString();
    const currentDots = imageDots[indexStr] || [];

    const newDot = { x, y, title: "", description: "" };
    const updatedDots = {
      ...imageDots,
      [indexStr]: [...currentDots, newDot],
    };

    this.setData({
      imageDots: updatedDots,
    });

    wx.showToast({
      title: this.data.messages.success.dotAdded,
      icon: "success",
    });
  },

  // Edit dot
  editDot(e) {
    const { imageIndex, dotIndex } = e.currentTarget.dataset;
    const dot = this.data.imageDots[imageIndex][dotIndex];

    this.setData({
      editingDot: {
        imageIndex: parseInt(imageIndex),
        dotIndex: parseInt(dotIndex),
        ...dot,
      },
      showDotEditor: true,
    });
  },

  // Remove dot
  removeDot(e) {
    const { imageIndex, dotIndex } = e.currentTarget.dataset;

    wx.showModal({
      title: this.data.messages.confirmations.deleteDotTitle,
      content: this.data.messages.confirmations.deleteDotContent,
      success: (res) => {
        if (res.confirm) {
          const { imageDots } = this.data;
          const indexStr = imageIndex.toString();
          const currentDots = [...imageDots[indexStr]];

          currentDots.splice(dotIndex, 1);

          const updatedDots = { ...imageDots };
          if (currentDots.length === 0) {
            delete updatedDots[indexStr];
          } else {
            updatedDots[indexStr] = currentDots;
          }

          this.setData({
            imageDots: updatedDots,
          });

          wx.showToast({
            title: this.data.messages.success.dotDeleted,
            icon: "success",
          });
        }
      },
    });
  },

  // Handle dot editor input
  onDotTitleInput(e) {
    this.setData({
      "editingDot.title": e.detail.value,
    });
  },

  onDotDescInput(e) {
    this.setData({
      "editingDot.description": e.detail.value,
    });
  },

  // Save dot changes
  saveDot() {
    const { editingDot, imageDots } = this.data;
    const { imageIndex, dotIndex, title, description, x, y } = editingDot;

    const indexStr = imageIndex.toString();
    const currentDots = [...imageDots[indexStr]];
    currentDots[dotIndex] = { x, y, title, description };

    this.setData({
      imageDots: {
        ...imageDots,
        [indexStr]: currentDots,
      },
      showDotEditor: false,
      editingDot: null,
    });

    wx.showToast({
      title: this.data.messages.success.dotUpdated,
      icon: "success",
    });
  },

  // Cancel dot editing
  cancelDotEdit() {
    this.setData({
      showDotEditor: false,
      editingDot: null,
    });
  },

  // Choose audio
  chooseAudio() {
    const { files } = this.data;

    if (files.length > 0 && !this.isImage(files[0])) {
      wx.showToast({
        title: this.data.messages.errors.videoAudioConflict,
        icon: "none",
      });
      return;
    }

    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["mp3", "wav", "aac", "m4a"],
      success: (res) => {
        const audioFile = res.tempFiles[0];

        const fileName = audioFile.name || audioFile.path;
        const fileExt = fileName.split(".").pop().toLowerCase();
        const validAudioExts = ["mp3", "wav", "aac", "m4a", "flac", "ogg"];

        if (!validAudioExts.includes(fileExt)) {
          wx.showToast({
            title: this.data.messages.errors.audioOnly,
            icon: "none",
          });
          return;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (audioFile.size > maxSize) {
          wx.showToast({
            title: this.data.messages.errors.audioSizeLimit,
            icon: "none",
          });
          return;
        }

        this.setData({
          audio: audioFile,
          audioName: audioFile.name || "音频文件",
        });

        wx.showToast({
          title: this.data.messages.success.audioSelected,
          icon: "success",
        });
      },
      fail: (err) => {
        console.error("Failed to choose audio file:", err);
        wx.showToast({
          title: this.data.messages.errors.chooseAudioFailed,
          icon: "none",
        });
      },
    });
  },

  // Remove audio
  removeAudio() {
    this.setData({
      audio: null,
      audioName: "",
    });
  },

  // Form input handlers
  onTitleInput(e) {
    this.setData({
      title: e.detail.value,
    });
  },

  onContentInput(e) {
    this.setData({
      content: e.detail.value,
    });
  },

  onDownloadToggle() {
    this.setData({
      allowDownload: !this.data.allowDownload,
    });
  },

  // Tab switching
  switchTab(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({
      activeTab: tab,
    });
  },

  // Back from annotation
  backFromAnnotation() {
    this.setData({
      activeTab: "media",
      selectedImageIndex: null,
    });
  },

  // Toggle instructions
  toggleInstructions() {
    this.setData({
      showInstructions: !this.data.showInstructions,
    });
  },

  // Form validation
  validateForm() {
    const { title, content, files } = this.data;

    if (!title.trim()) {
      wx.showToast({
        title: this.data.messages.errors.titleRequired,
        icon: "none",
      });
      return false;
    }

    if (!content.trim()) {
      wx.showToast({
        title: this.data.messages.errors.contentRequired,
        icon: "none",
      });
      return false;
    }

    if (files.length === 0) {
      wx.showToast({
        title: this.data.messages.errors.filesRequired,
        icon: "none",
      });
      return false;
    }

    return true;
  },

  // Submit form
  async submitForm() {
    if (!this.validateForm()) return;

    this.setData({ loading: true });

    try {
      const formData = this.prepareFormData();

      if (this.data.isUpdateMode) {
        await this.updatePost(formData);
      } else {
        await this.createPost(formData);
      }

      wx.showToast({
        title: this.data.isUpdateMode
          ? this.data.messages.success.updateSuccess
          : this.data.messages.success.createSuccess,
        icon: "success",
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error("Form submission error:", error);
      wx.showToast({
        title: this.data.messages.errors.operationFailed,
        icon: "none",
      });
    } finally {
      this.setData({ loading: false }); // Ensure loading state is reset
    }
  },

  // Prepare form data for submission
  prepareFormData() {
    const {
      title,
      content,
      files,
      audio,
      allowDownload,
      imageDots,
      eventId,
      mediaCreateType,
      mediaId,
      deletedFiles,
    } = this.data;

    const formData = {
      title: title.trim(),
      content: content.trim(),
      allowDownload,
      type: this.isImage(files[0]) ? "image" : "video",
      files,
      imageDots,
      audio,
    };

    if (eventId) {
      formData.eventId = eventId;
    }

    if (this.data.isUpdateMode) {
      formData.mediaId = mediaId;
      formData.deletedFiles = deletedFiles;
    }

    return formData;
  },

  // Create new post
  createPost(formData) {
    return new Promise(async (resolve, reject) => {
      try {
        wx.showLoading({ title: this.data.messages.loading, mask: true });

        let audioUrl = null;
        if (formData.audio) {
          audioUrl = await this.uploadAudioFile(formData.audio);
        }

        wx.request({
          url: `${config.BACKEND_URL}/post/create`,
          method: "POST",
          data: {
            title: formData.title,
            content: formData.content,
            allowDownload: formData.allowDownload,
            type: formData.type,
            image_dots: JSON.stringify(formData.imageDots),
            audio_url: audioUrl,
            event_id: formData.eventId || null,
          },
          header: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
          },
          success: async (res) => {
            if (res.statusCode === 200 && res.data.status === "success") {
              const filesWithDots = formData.files.map((file, index) => {
                const dots = formData.imageDots[index.toString()] || [];
                return {
                  ...file,
                  dots: dots,
                  post_id: res.data.post_id,
                };
              });

              await this.uploadAllFiles(filesWithDots);
              wx.hideLoading();
              resolve(res.data); // Add this to properly resolve the promise
            } else {
              wx.hideLoading(); // Add this to hide loading when request fails
              reject(new Error(res.data.msg || this.data.messages.errors.createFailed));
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error("Request failed:", err);
            reject(new Error(`${this.data.messages.errors.requestFailed}: ${err.errMsg}`));
          },
        });
      } catch (error) {
        wx.hideLoading();
        console.error("Error in createPost:", error);
        reject(error);
      }
    });
  },

  uploadAllFiles(files) {
    if (!files.length) return Promise.resolve([]);

    return Promise.all(
      files.map((file, index) => {
        if (file.isExisting) {
          return Promise.resolve(file.media_id || file.url);
        }
        return this.uploadSingleFile(file);
      })
    );
  },

  uploadSingleFile(file) {
    return new Promise((resolve, reject) => {
      const formData = {
        type: file.type || "image",
        post_id: file.post_id || null,
      };

      if (file.dots && file.dots.length > 0) {
        formData.dots = JSON.stringify(file.dots);
      } else {
        formData.dots = JSON.stringify([]);
      }

      wx.uploadFile({
        url: `${config.BACKEND_URL}/post/upload_media`,
        filePath: file.url,
        name: "file",
        formData: formData,
        header: {
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        success: (res) => {
          try {
            console.log("Upload response:", res.data);
            const data = JSON.parse(res.data);
            if (data.status === "success") {
              resolve(data.media_id);
            } else {
              console.error("Media upload failed:", data.msg);
              reject(new Error(data.msg || this.data.messages.errors.uploadFailed));
            }
          } catch (error) {
            console.error("Failed to parse upload response:", error);
            reject(new Error(this.data.messages.errors.parseFailed));
          }
        },
        fail: (err) => {
          console.error("Upload request failed:", err);
          wx.hideLoading();
          reject(new Error(`${this.data.messages.errors.requestFailed}: ${err.errMsg}`));
        },
      });
    });
  },

  uploadAudioFile(audioFile) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${config.BACKEND_URL}/post/upload_audio`,
        filePath: audioFile.path || audioFile.tempFilePath,
        name: "audio",
        header: {
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.status === "success") {
              resolve(data.audio_url);
            } else {
              reject(new Error(data.msg || this.data.messages.errors.uploadFailed));
            }
          } catch (error) {
            reject(new Error(this.data.messages.errors.parseFailed));
          }
        },
        fail: (err) => {
          reject(new Error(`${this.data.messages.errors.requestFailed}: ${err.errMsg}`));
        },
      });
    });
  },

  // Update existing post
  updatePost(formData) {
    return new Promise(async (resolve, reject) => {
      try {
        wx.showLoading({ title: this.data.messages.updating, mask: true });

        const newFiles = formData.files.filter((file) => !file.isExisting);
        const uploadedNewFiles = await this.uploadAllFiles(newFiles);

        const existingFiles = formData.files
          .filter((file) => file.isExisting)
          .map((file) => file.url);

        const allFiles = [...existingFiles, ...uploadedNewFiles];

        let audioUrl = null;
        if (formData.audio) {
          if (formData.audio.isExisting) {
            audioUrl = formData.audio.url;
          } else {
            audioUrl = await this.uploadAudioFile(formData.audio);
          }
        }

        wx.request({
          url: `${getApp().globalData.apiBase}/posts/${formData.mediaId}`,
          method: "PUT",
          data: {
            title: formData.title,
            content: formData.content,
            allow_download: formData.allowDownload,
            type: formData.type,
            filenames: JSON.stringify(allFiles),
            image_dots: JSON.stringify(formData.imageDots),
            audio_url: audioUrl,
            deleted_files: formData.deletedFiles || [],
          },
          header: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
          },
          success: (res) => {
            wx.hideLoading();
            if (res.statusCode === 200 && res.data.status === "success") {
              resolve(res.data);
            } else {
              reject(new Error(res.data.message || this.data.messages.errors.updateFailed));
            }
          },
          fail: (err) => {
            wx.hideLoading();
            reject(new Error(`${this.data.messages.errors.requestFailed}: ${err.errMsg}`));
          },
        });
      } catch (error) {
        wx.hideLoading();
        reject(error);
      }
    });
  },

  // Close modal/page
  onClose() {
    wx.navigateBack();
  },

  handlePreventClose(e) {},
});
