const { default: config } = require("../../config");
const ucloudUpload = require("../../services/ucloudUpload");
const { isContainSword } = require("../../utils/isContainSword");

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
    isSubmitting: false,
    uploadingFiles: [],

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

    // Check device info for better compatibility
    const systemInfo = wx.getSystemInfoSync();
    console.log("System info:", systemInfo);
    console.log("Platform:", systemInfo.platform);
    console.log("System:", systemInfo.system);
    console.log("WeChat version:", systemInfo.version);
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
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.userInfo.token}`,
      },
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
      itemList.push("从相册选择视频"); // Add explicit video selection option
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
              this.chooseVideo("camera");
            }
            break;
          case 3:
            if (files.length === 0) {
              this.chooseVideo("album");
            }
            break;
        }
      },
    });
  },

  // Supported file formats
  getSupportedFormats() {
    return {
      images: {
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'ico', 'bmp'],
        maxSize: 200 * 1024 * 1024, // 200MB
        displayText: 'JPG, JPEG, PNG, GIF, HEIC, ICO, BMP'
      },
      videos: {
        extensions: ['mp4', 'mov', 'avi'],
        maxSize: 200 * 1024 * 1024, // 200MB
        displayText: 'MP4, MOV, AVI'
      },
      audio: {
        extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'wma', 'ape', 'm4b', 'amr'],
        maxSize: 50 * 1024 * 1024, // 50MB
        displayText: 'MP3, WAV, AAC, M4A, FLAC, OGG'
      }
    };
  },

  // Validate file type and size
  validateFile(file, type) {
    const supportedFormats = this.getSupportedFormats();
    const formats = supportedFormats[type];
    
    if (!formats) return { valid: false, error: "不支持的文件类型" };

    // Check file size
    if (file.size > formats.maxSize) {
      const maxSizeMB = Math.round(formats.maxSize / (1024 * 1024));
      return { 
        valid: false, 
        error: `文件大小不能超过 ${maxSizeMB}MB` 
      };
    }

    // For images and videos, WeChat's chooseMedia already filters by type
    // For audio, we'll validate in the audio selection function
    
    return { valid: true };
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
      sizeType: ["compressed"],
      success: (res) => {
        // Validate each selected file
        const validFiles = [];
        const invalidFiles = [];

        res.tempFiles.forEach(file => {
          const validation = this.validateFile(file, 'images');
          if (validation.valid) {
            validFiles.push(file);
          } else {
            invalidFiles.push({ file, error: validation.error });
          }
        });

        // Show error for invalid files
        if (invalidFiles.length > 0) {
          const firstError = invalidFiles[0].error;
          wx.showToast({
            title: firstError,
            icon: "none",
            duration: 3000
          });
          
          // If all files are invalid, return early
          if (validFiles.length === 0) {
            return;
          }
        }
        this.setData({ imageLoading: true });

        const newFiles = validFiles.map((file, index) => ({
          url: file.tempFilePath,
          size: file.size,
          type: "image",
          file: file,
          uploading: true, // Start uploading immediately
          uploaded: false,
          uploadProgress: 0,
          uploadResult: null,
          backgroundUpload: true, // Enable background upload
          fileIndex: files.length + index,
        }));

        this.setData({
          files: [...files, ...newFiles],
          imageLoading: false,
          uploadingFiles: [
            ...this.data.uploadingFiles,
            ...newFiles.map((f) => f.fileIndex),
          ],
        });

        wx.showToast({
          title: `${this.data.messages.success.filesAdded} ${newFiles.length} 个文件`,
          icon: "success",
        });

        // Start background upload sequentially
        this.startSequentialUploads(newFiles, files.length);

        console.log("Files added and upload started:", newFiles.length);
      },
      fail: () => {
        this.setData({ imageLoading: false });
      },
    });
  },

  // Choose video
  chooseVideo(sourceType = "album") {
    const { files } = this.data;

    if (files.length > 0) {
      wx.showToast({
        title: this.data.messages.errors.videoLimit,
        icon: "none",
      });
      return;
    }

    // Determine source type array
    const sourceTypes = sourceType === "camera" ? ["camera"] : ["album"];

    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      sourceType: sourceTypes,
      maxDuration: 60, // Add max duration for better compatibility
      camera: "back", // Specify camera for better compatibility
      sizeType: ["original"], // Use original quality for better video quality
      success: (res) => {
        const videoFile = res.tempFiles[0];

        // Validate video file
        const validation = this.validateFile(videoFile, 'videos');
        if (!validation.valid) {
          wx.showToast({
            title: validation.error,
            icon: "none",
            duration: 3000
          });
          return;
        }

        console.log("Video file selected:", videoFile);
        console.log("Video file keys:", Object.keys(videoFile));
        console.log("Thumb temp file path:", videoFile.thumbTempFilePath);
        console.log("Video duration:", videoFile.duration);
        console.log("Video size:", videoFile.size);

        let thumbnailPath = null;

        if (videoFile.thumbTempFilePath) {
          thumbnailPath = videoFile.thumbTempFilePath;
          console.log(
            "Found thumbnail path from wx.chooseMedia:",
            thumbnailPath
          );

          wx.getFileInfo({
            filePath: thumbnailPath,
            success: (fileInfo) => {
              console.log(
                "Thumbnail file verified - size:",
                fileInfo.size,
                "bytes"
              );
              if (fileInfo.size === 0) {
                console.warn("Thumbnail file is empty");
                thumbnailPath = null;
              }
            },
            fail: (error) => {
              console.error("Thumbnail file verification failed:", error);
              thumbnailPath = null;
            },
          });
        } else {
          console.warn("No thumbTempFilePath provided by wx.chooseMedia");
        }

        const newFile = {
          url: videoFile.tempFilePath,
          size: videoFile.size,
          type: "video",
          file: videoFile,
          thumbnail: thumbnailPath,
          duration: videoFile.duration || 0,
          uploading: true,
          uploaded: false,
          uploadProgress: 0,
          uploadResult: null,
          backgroundUpload: true,
          fileIndex: 0,
        };

        this.setData({
          files: [newFile],
          uploadingFiles: [0],
        });

        wx.showToast({
          title: this.data.messages.success.videoAdded,
          icon: "success",
        });

        if (thumbnailPath) {
          console.log("Video added with thumbnail successfully");
        } else {
          console.log(
            "Video added without thumbnail - will generate placeholder"
          );
        }

        // Start background upload with thumbnail
        console.log(
          "Starting sequential upload for video file with thumbnail support"
        );
        this.startSequentialUploads([newFile], 0);

        console.log("Video file added and upload started");
      },
      fail: (error) => {
        console.error("Video selection failed:", error);
        console.error("Error details:", JSON.stringify(error));

        // Provide more specific error messages
        let errorMessage = "视频选择失败";
        if (error.errMsg && error.errMsg.includes("cancel")) {
          errorMessage = "已取消选择";
        } else if (error.errMsg && error.errMsg.includes("permission")) {
          errorMessage = "请允许访问相册权限";
        }

        wx.showToast({
          title: errorMessage,
          icon: "none",
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
    const inputValue = e.detail.value;
    
    // Check for swear words
    if (isContainSword(inputValue)) {
      wx.showToast({
        title: "请避免使用不当语言",
        icon: "none",
        duration: 2000,
      });
      return;
    }
    
    this.setData({
      "editingDot.title": inputValue,
    });
  },

  onDotDescInput(e) {
    const inputValue = e.detail.value;
    
    // Check for swear words
    if (isContainSword(inputValue)) {
      wx.showToast({
        title: "请避免使用不当语言",
        icon: "none",
        duration: 2000,
      });
      return;
    }
    
    this.setData({
      "editingDot.description": inputValue,
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

    // Remove the restriction for video files - now audio can be added to videos too
    // if (files.length > 0 && !this.isImage(files[0])) {
    //   wx.showToast({
    //     title: this.data.messages.errors.videoAudioConflict,
    //     icon: "none",
    //   });
    //   return;
    // }

    // Get system info to determine the best approach
    const systemInfo = wx.getSystemInfoSync();
    const isPC =
      systemInfo.platform === "windows" || systemInfo.platform === "mac";

    console.log(
      "Choosing audio - Platform:",
      systemInfo.platform,
      "isPC:",
      isPC
    );

    // Try chooseMessageFile with all type for better compatibility
    const tryChooseMessageFile = () => {
      wx.chooseMessageFile({
        count: 1,
        type: "all", // Change from "file" to "all" for better mobile compatibility
        success: (res) => {
          const audioFile = res.tempFiles[0];
          console.log("File selected via chooseMessageFile:", audioFile);

          // Check if it's an audio file
          const fileName = audioFile.name || audioFile.path || "";
          const fileExt = fileName.split(".").pop().toLowerCase();
          const validAudioExts = [
            "mp3",
            "wav",
            "aac",
            "m4a",
            "flac",
            "ogg",
            "wma",
            "ape",
            "m4b",
            "amr",
          ];

          if (!validAudioExts.includes(fileExt)) {
            wx.showToast({
              title: "请选择音频文件",
              icon: "none",
            });
            return;
          }

          this.handleAudioSelected(audioFile);
        },
        fail: (err) => {
          console.error("Failed to choose file:", err);

          // Show helpful instructions
          if (!isPC) {
            wx.showModal({
              title: "选择音频文件",
              content:
                '1. 请先将音频文件发送到"文件传输助手"\n2. 然后点击确定，从聊天记录中选择该文件',
              confirmText: "我知道了",
              showCancel: false,
              success: () => {
                // Do nothing, user will try again
              },
            });
          } else {
            wx.showToast({
              title: this.data.messages.errors.chooseAudioFailed,
              icon: "none",
            });
          }
        },
      });
    };

    // Direct to chooseMessageFile for all platforms
    tryChooseMessageFile();
  },

  // Handle audio file selection
  handleAudioSelected(audioFile) {
    console.log("handleAudioSelected called with:", audioFile);

    // Validate audio file using unified validation
    const validation = this.validateFile(audioFile, 'audio');
    if (!validation.valid) {
      wx.showToast({
        title: validation.error,
        icon: "none",
        duration: 3000
      });
      return;
    }

    // Additional check for audio file extension
    const fileName = audioFile.name || audioFile.path || "";
    const fileExt = fileName.split(".").pop().toLowerCase();
    const supportedFormats = this.getSupportedFormats();
    
    if (!supportedFormats.audio.extensions.includes(fileExt)) {
      wx.showToast({
        title: `不支持的音频格式。支持的格式: ${supportedFormats.audio.displayText}`,
        icon: "none",
        duration: 3000
      });
      return;
    }

    console.log("Audio file name:", fileName);
    console.log("Audio file extension:", fileExt);

    const newAudio = {
      ...audioFile,
      uploading: true,
      uploaded: false,
      uploadProgress: 0,
      uploadResult: null,
      backgroundUpload: true,
      file: audioFile, // Ensure we have the file reference
    };

    this.setData({
      audio: newAudio,
      audioName: audioFile.name || "音频文件",
    });

    wx.showToast({
      title: this.data.messages.success.audioSelected,
      icon: "success",
    });

    // Start background upload for audio
    this.uploadAudioInBackground(newAudio);
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
    const inputValue = e.detail.value;
    
    // Check for swear words
    if (isContainSword(inputValue)) {
      wx.showToast({
        title: "请避免使用不当语言",
        icon: "none",
        duration: 2000,
      });
      return;
    }
    
    this.setData({
      title: inputValue,
    });
  },

  onContentInput(e) {
    const inputValue = e.detail.value;
    
    // Check for swear words
    if (isContainSword(inputValue)) {
      wx.showToast({
        title: "请避免使用不当语言",
        icon: "none",
        duration: 2000,
      });
      return;
    }
    
    this.setData({
      content: inputValue,
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
    // Validate form fields
    const { title, content, files, imageDots } = this.data;

    // Check for swear words in title and content
    if (isContainSword(title)) {
      wx.showToast({
        title: "标题包含不当语言，请修改后再上传",
        icon: "none",
        duration: 3000,
      });
      return;
    }

    if (isContainSword(content)) {
      wx.showToast({
        title: "内容包含不当语言，请修改后再上传",
        icon: "none",
        duration: 3000,
      });
      return;
    }

    // Check for swear words in image annotations
    for (const imageIndex in imageDots) {
      const dots = imageDots[imageIndex];
      if (dots && Array.isArray(dots)) {
        for (const dot of dots) {
          if (dot.title && isContainSword(dot.title)) {
            wx.showToast({
              title: "图片标记标题包含不当语言，请修改后再上传",
              icon: "none",
              duration: 3000,
            });
            return;
          }
          if (dot.description && isContainSword(dot.description)) {
            wx.showToast({
              title: "图片标记描述包含不当语言，请修改后再上传",
              icon: "none",
              duration: 3000,
            });
            return;
          }
        }
      }
    }

    if (!title || !title.trim()) {
      wx.showToast({
        title: "请输入标题 (不能只有空格)",
        icon: "none",
      });
      return;
    }

    if (!content || !content.trim()) {
      wx.showToast({
        title: "请输入内容 (不能只有空格)",
        icon: "none",
      });
      return;
    }

    if (!files || files.length === 0) {
      wx.showToast({
        title: "请上传图片或视频",
        icon: "none",
      });
      return;
    }

    // Check if any files are still uploading
    const uploadingFiles = this.data.files.filter((file) => file.uploading);
    const audioUploading = this.data.audio && this.data.audio.uploading;

    if (uploadingFiles.length > 0 || audioUploading) {
      // Show full screen loading overlay
      this.setData({ isSubmitting: true, loading: true });
      wx.showLoading({
        title: "等待文件上传完成...",
        mask: true,
      });

      // Wait for all file uploads to complete
      if (uploadingFiles.length > 0) {
        try {
          while (this.data.files.some((file) => file.uploading)) {
            console.log(
              `Waiting for file uploads... (${
                this.data.files.filter((file) => file.uploading).length
              } still uploading)`
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          console.log("All file uploads completed");
        } catch (error) {
          wx.hideLoading();
          this.setData({ isSubmitting: false, loading: false });
          wx.showToast({
            title: "文件上传过程中发生错误，请重试",
            icon: "none",
          });
          return;
        }
      }

      // Wait for audio upload to complete
      if (audioUploading) {
        console.log("Waiting for audio upload to complete...");
        try {
          while (this.data.audio && this.data.audio.uploading) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          console.log("Audio upload completed");
        } catch (error) {
          wx.hideLoading();
          this.setData({ isSubmitting: false, loading: false });
          wx.showToast({
            title: "音频上传过程中发生错误，请重试",
            icon: "none",
          });
          return;
        }
      }

      wx.hideLoading();
      // Keep loading state active for the actual submission
    }

    // Check for upload errors and retry failed uploads
    const failedFiles = this.data.files.filter((file) => file.uploadError);
    const audioFailed = this.data.audio && this.data.audio.uploadError;

    // Retry failed uploads before final submission
    if (failedFiles.length > 0) {
      console.log(`Retrying ${failedFiles.length} failed file uploads...`);
      try {
        this.setData({ loading: true });
        wx.showLoading({
          title: "重试失败的上传...",
          mask: true,
        });

        // Reset error states and retry uploads
        const updatedFiles = this.data.files.map((file, index) => {
          if (file.uploadError) {
            // Start retry for this file
            this.uploadFileInBackground(file, index);
            return {
              ...file,
              uploadError: null,
              uploading: true,
              uploadProgress: 0,
            };
          }
          return file;
        });
        this.setData({ files: updatedFiles });

        // Wait for retries to complete
        while (this.data.files.some((file) => file.uploading)) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        wx.hideLoading();
      } catch (error) {
        console.error("Failed to retry file uploads:", error);
        wx.hideLoading();
      }
    }

    if (audioFailed) {
      console.log("Retrying failed audio upload...");
      try {
        const updatedAudio = {
          ...this.data.audio,
          uploadError: null,
          uploading: true,
          uploadProgress: 0,
        };
        this.setData({ audio: updatedAudio });
        this.uploadAudioInBackground(updatedAudio);

        // Wait for audio retry to complete
        while (this.data.audio && this.data.audio.uploading) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error("Audio retry failed:", error);
      }
    }

    // Final check for upload errors after retry
    const stillFailedFiles = this.data.files.filter((file) => file.uploadError);
    const audioStillFailed = this.data.audio && this.data.audio.uploadError;

    if (stillFailedFiles.length > 0 || audioStillFailed) {
      this.setData({ loading: false });
      wx.showToast({
        title: "文件上传失败，请检查网络连接后重试",
        icon: "none",
        duration: 3000,
      });
      return;
    }

    // All uploads successful, proceed with form submission
    try {
      this.setData({ loading: true });
      wx.showLoading({
        title: this.data.isUpdateMode
          ? this.data.messages.updating
          : this.data.messages.loading,
        mask: true,
      });

      // Prepare file URLs exactly like web version
      const fileUrls = [];
      const previewFileUrls = [];

      this.data.files.forEach((fileItem) => {
        let fileUrl = null;
        let previewUrl = null;

        if (fileItem.uploaded && fileItem.uploadResult) {
          // For images (use uploadUrl and blurUrl)
          if (
            fileItem.uploadResult.uploadUrl &&
            fileItem.uploadResult.blurUrl
          ) {
            fileUrl = fileItem.uploadResult.uploadUrl;
            previewUrl = fileItem.uploadResult.blurUrl;
          }
          // For videos
          else if (
            fileItem.uploadResult.videoUrl &&
            fileItem.uploadResult.thumbnailUrl
          ) {
            fileUrl = fileItem.uploadResult.videoUrl;
            previewUrl = fileItem.uploadResult.thumbnailUrl;
          }
          // For any other type of result that might have just a single URL
          else {
            fileUrl =
              fileItem.uploadResult.url ||
              fileItem.uploadResult.fileUrl ||
              fileItem.uploadResult.videoUrl ||
              fileItem.uploadResult.uploadUrl ||
              fileItem.url;
            previewUrl = fileUrl;
          }
        } else if (fileItem.url && !fileItem.file) {
          // Existing file (edit mode)
          fileUrl = fileItem.url;
          previewUrl = fileItem.url;
        }

        if (fileUrl) {
          fileUrls.push(fileUrl);
          previewFileUrls.push(previewUrl);
        }
      });

      // Format full URLs with domain and add them to formData
      const formattedFileUrls = fileUrls.map((url) => {
        // Check if the URL already has the domain
        if (url.startsWith("http")) {
          return url;
        }
        // Add domain if needed
        return `https://xiaoshow.cn-wlcb.ufileos.com/${url}`;
      });

      const formattedPreviewUrls = previewFileUrls.map((url) => {
        if (url.startsWith("http")) {
          return url;
        }
        return `https://xiaoshow.cn-wlcb.ufileos.com/${url}`;
      });

      if (formattedFileUrls.length === 0) {
        wx.hideLoading();
        this.setData({ loading: false });
        wx.showToast({
          title: "没有可提交的文件URL，请重新上传文件",
          icon: "none",
        });
        return;
      }

      // Prepare request data for JSON (not FormData like web version)
      const requestData = {
        title: title.trim(),
        content: content.trim(),
        user_id: getApp().globalData.userInfo.id,
        event_id: this.data.eventId || null,
        allowDownload: this.data.allowDownload,
        type: this.isImage(files[0]) ? "image" : "video",
        profile_link: "",
        file_urls: formattedFileUrls, // Send as actual array
        preview_file_urls: formattedPreviewUrls, // Send as actual array
      };

      // Handle image dots - send as array format that backend expects
      if (Object.keys(this.data.imageDots).length > 0) {
        const dotsArray = [];
        Object.keys(this.data.imageDots).forEach((imageIndex) => {
          const dotsForImage = this.data.imageDots[imageIndex];
          dotsArray[parseInt(imageIndex)] = dotsForImage;
        });
        requestData.dots = dotsArray;
      }

      // Handle audio - convert to audio_url if needed
      if (this.data.audio) {
        let audioUrl = null;

        // If it's an object with uploadResult containing audioUrl
        if (
          this.data.audio.uploadResult &&
          this.data.audio.uploadResult.audioUrl
        ) {
          audioUrl = this.data.audio.uploadResult.audioUrl;
        }
        // If it's an object with url property (already uploaded)
        else if (this.data.audio.url && !this.data.audio.file) {
          audioUrl = this.data.audio.url;
        }

        if (audioUrl) {
          // Make sure the URL has the full domain
          if (!audioUrl.startsWith("http")) {
            audioUrl = `https://xiaoshow.cn-wlcb.ufileos.com/${audioUrl}`;
          }
          requestData.audio_url = audioUrl;
        }
      }

      // Event ID if present
      if (this.data.eventId && this.data.mediaCreateType === "event") {
        requestData.event_id = this.data.eventId;
      }

      // For update mode, add additional fields
      if (this.data.isUpdateMode) {
        requestData.post_id = this.data.mediaId;

        // Add deleted files if any (send as actual array)
        if (this.data.deletedFiles && this.data.deletedFiles.length > 0) {
          requestData.deletedFilenames = this.data.deletedFiles;
        }
      }

      // Debug: Log the request data to see what we're sending
      console.log("Request data being sent to backend:", requestData);
      console.log("Request data keys:", Object.keys(requestData));

      // Submit to backend using the same endpoint as web version
      wx.request({
        url: `${config.BACKEND_URL}/post/create`,
        method: "POST",
        data: requestData,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
        },
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200 && res.data.status === "success") {
            wx.showToast({
              title: this.data.isUpdateMode
                ? this.data.messages.success.updateSuccess
                : this.data.messages.success.createSuccess,
              icon: "success",
            });

            setTimeout(() => {
              // Navigate to me page instead of going back
              wx.redirectTo({
                url: `/pages/me/me`,
              });
            }, 500);
          } else {
            wx.showToast({
              title: res.data.msg || this.data.messages.errors.operationFailed,
              icon: "none",
            });
          }
        },
        fail: (error) => {
          wx.hideLoading();
          console.error("Form submission error:", error);
          wx.showToast({
            title: this.data.messages.errors.requestFailed,
            icon: "none",
          });
        },
        complete: () => {
          this.setData({ loading: false, isSubmitting: false });
        },
      });
    } catch (error) {
      wx.hideLoading();
      console.error("Form submission error:", error);
      wx.showToast({
        title: this.data.messages.errors.operationFailed,
        icon: "none",
      });
      this.setData({ loading: false, isSubmitting: false });
    }
  },

  // Close modal/page
  onClose() {
    wx.navigateBack();
  },

  handlePreventClose(e) {},

  // Background upload functions
  async uploadFileInBackground(file, fileIndex) {
    console.log(
      "Starting background upload for file:",
      file,
      "at index:",
      fileIndex
    );
    let retryCount = 0;
    const maxRetries = 2;

    const attemptUpload = async () => {
      try {
        console.log("Attempting upload, retry count:", retryCount);

        // Prepare file object for upload service with proper name handling
        const tempFilePath = file.file ? file.file.tempFilePath : file.url;
        const thumbnailPath =
          file.thumbnail || (file.file ? file.file.thumbTempFilePath : null);

        let fileName = file.file ? file.file.name : null;

        // If no name available, generate one from path
        if (!fileName && tempFilePath) {
          fileName = tempFilePath.split("/").pop();
        }

        // If still no name, generate a default based on type
        if (!fileName) {
          const timestamp = Date.now();
          const extension =
            file.type === "image"
              ? "jpg"
              : file.type === "video"
              ? "mp4"
              : "mp3";
          fileName = `file_${timestamp}.${extension}`;
        }

        const fileForUpload = {
          tempFilePath: tempFilePath,
          thumbTempFilePath: thumbnailPath,
          name: fileName,
          size: file.file ? file.file.size : file.size || 0,
          type: file.type,
          duration: file.duration || (file.file ? file.file.duration : 0),
        };

        console.log("Prepared file for upload:", fileForUpload);
        console.log("Real thumbnail path available:", !!thumbnailPath);

        if (thumbnailPath && file.type === "video") {
          try {
            const thumbInfo = await new Promise((resolve, reject) => {
              wx.getFileInfo({
                filePath: thumbnailPath,
                success: resolve,
                fail: reject,
              });
            });
            console.log(
              "Thumbnail validation - size:",
              thumbInfo.size,
              "bytes"
            );
          } catch (thumbError) {
            console.warn("Thumbnail validation failed:", thumbError);
          }
        }

        const uploadResult = await ucloudUpload.uploadMedia(
          fileForUpload,
          (progress) => {
            // Update progress internally but don't show in UI for background uploads
            console.log("Upload progress:", progress, "%");
            const files = this.data.files;
            if (files[fileIndex]) {
              files[fileIndex].uploadProgress = progress;
              this.setData({ files });
            }
          }
        );

        console.log("Upload successful:", uploadResult);

        // Update file status
        const files = this.data.files;
        if (files[fileIndex]) {
          files[fileIndex].uploading = false;
          files[fileIndex].uploaded = true;
          files[fileIndex].uploadResult = uploadResult;

          // Remove from uploading list
          const uploadingFiles = this.data.uploadingFiles.filter(
            (idx) => idx !== fileIndex
          );
          this.setData({ files, uploadingFiles });

          console.log(`File ${fileIndex} upload completed successfully`);
          if (uploadResult.thumbnailUrl) {
            console.log(
              `Thumbnail uploaded successfully: ${uploadResult.thumbnailUrl}`
            );
          }
        }
      } catch (error) {
        console.error(
          `Upload failed for file ${fileIndex} (attempt ${retryCount + 1}):`,
          error
        );

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying upload for file ${fileIndex}...`);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount)
          );

          // Reset upload state for retry
          const files = this.data.files;
          if (files[fileIndex]) {
            files[fileIndex].uploadProgress = 0;
            files[fileIndex].uploadError = null;
            this.setData({ files });
          }

          return attemptUpload();
        } else {
          // Mark as failed after all retries
          const files = this.data.files;
          if (files[fileIndex]) {
            files[fileIndex].uploading = false;
            files[fileIndex].uploadError = error.message || "上传失败";

            const uploadingFiles = this.data.uploadingFiles.filter(
              (idx) => idx !== fileIndex
            );
            this.setData({ files, uploadingFiles });

            console.error(
              `File ${fileIndex} upload failed permanently:`,
              error.message
            );
          }
        }
      }
    };

    await attemptUpload();
  },

  // Wait for all uploads to complete
  async waitForUploadsToComplete() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const hasUploadingFiles = this.data.files.some(
          (file) => file.uploading
        );
        const audioUploading = this.data.audio && this.data.audio.uploading;

        if (!hasUploadingFiles && !audioUploading) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  },

  // Upload audio in background
  async uploadAudioInBackground(audioFile) {
    let retryCount = 0;
    const maxRetries = 2;

    const attemptUpload = async () => {
      try {
        console.log("Starting audio upload attempt:", retryCount + 1);

        // Prepare audio file for upload with proper name handling
        const tempFilePath = audioFile.path || audioFile.tempFilePath;
        let fileName = audioFile.name;

        // If no name available, generate one from path
        if (!fileName && tempFilePath) {
          fileName = tempFilePath.split("/").pop();
        }

        // If still no name, generate a default
        if (!fileName) {
          const timestamp = Date.now();
          fileName = `audio_${timestamp}.mp3`;
        }

        const audioForUpload = {
          tempFilePath: tempFilePath,
          name: fileName,
          size: audioFile.size || 0,
          type: "audio",
        };

        console.log("Prepared audio for upload:", audioForUpload);

        const uploadResult = await ucloudUpload.uploadMedia(
          audioForUpload,
          (progress) => {
            // Update progress internally but don't show in UI for background uploads
            console.log("Audio upload progress:", progress, "%");
            const audio = this.data.audio;
            if (audio) {
              audio.uploadProgress = progress;
              this.setData({ audio });
            }
          }
        );

        console.log("Audio upload successful:", uploadResult);

        // Update audio status
        const audio = this.data.audio;
        if (audio) {
          audio.uploading = false;
          audio.uploaded = true;
          audio.uploadResult = uploadResult;
          this.setData({ audio });

          console.log("Audio upload completed successfully");
        }
      } catch (error) {
        console.error(
          `Audio upload failed (attempt ${retryCount + 1}):`,
          error
        );

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying audio upload...`);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount)
          );

          // Reset audio state for retry
          const audio = this.data.audio;
          if (audio) {
            audio.uploadProgress = 0;
            audio.uploadError = null;
            this.setData({ audio });
          }

          return attemptUpload();
        } else {
          // Mark as failed after all retries
          const audio = this.data.audio;
          if (audio) {
            audio.uploading = false;
            audio.uploadError = error.message || "上传失败";
            this.setData({ audio });

            console.error("Audio upload failed permanently:", error.message);
          }
        }
      }
    };

    await attemptUpload();
  },

  // Sequential upload manager to prevent connection limit issues
  async startSequentialUploads(files, startIndex) {
    console.log(`Starting sequential uploads for ${files.length} files`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileIndex = startIndex + i;

      console.log(
        `Uploading file ${i + 1}/${files.length} at index ${fileIndex}`
      );

      // Wait a bit before starting each upload to ensure connections are properly closed
      if (i > 0) {
        console.log("Waiting 1000ms before next upload...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Upload the file and wait for it to complete before moving to next
      await this.uploadFileInBackground(file, fileIndex);

      console.log(`File ${i + 1}/${files.length} upload process completed`);
    }

    console.log("All files upload process completed");
  },

  // Handle download toggle switch
  onDownloadToggle: function(e) {
    // Handle both tap event and switch change event
    let allowDownload;
    
    if (e.type === 'tap') {
      // If it's a tap event, toggle the current value
      allowDownload = !this.data.allowDownload;
    } else if (e.detail !== undefined) {
      // If it's a switch change event, use the detail value
      allowDownload = e.detail.value;
    } else {
      // Fallback: toggle current value
      allowDownload = !this.data.allowDownload;
    }
    
    this.setData({
      allowDownload: allowDownload
    });
  },
});
