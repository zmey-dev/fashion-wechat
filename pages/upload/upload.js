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
    isLoading: false,
    loadingMessage: "",
    imageLoading: false,
    activeTab: "media", // 'media' or 'form'
    showInstructions: true,
    uploadingFiles: [],
    isSubmitting: false, // Prevent duplicate submissions

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
        uploadFailed: "文件上传失败",  // "File upload failed"
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
    this.setData({
      isLoading: true
    });

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
        this.setData({
          isLoading: false
        });
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
        duration: 2000
      });
      return;
    }

    const remainingSlots = this.data.maxFiles - files.length;
    if (remainingSlots <= 0) {
      wx.showToast({
        title: `${this.data.messages.errors.maxFilesLimit} ${this.data.maxFiles} 个文件`,
        icon: "none",
        duration: 2000
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

  // Validate file type and size - STRICT MODE
  validateFile(file, type) {
    const supportedFormats = this.getSupportedFormats();
    const formats = supportedFormats[type];
    
    if (!formats) return { valid: false, error: "该文件格式不受支持，请选择其他文件" };  // "This file format is not supported, please choose another file"

    // Check file size - handle different file object structures
    // WeChat's chooseMedia may return size in different ways
    const fileSize = file.size || file.fileSize || 0;
    
    if (fileSize > 0 && fileSize > formats.maxSize) {
      const maxSizeMB = Math.round(formats.maxSize / (1024 * 1024));
      return { 
        valid: false, 
        error: `文件大小不能超过 ${maxSizeMB}MB` 
      };
    }

    // Get file extension from the path
    const filePath = file.tempFilePath || file.url || '';
    const fileName = filePath.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    // STRICT: Check file extension against allowed list
    if (!formats.extensions.includes(fileExtension)) {
      return { 
        valid: false, 
        error: `该文件格式 (.${fileExtension}) 不受支持。本平台仅支持: ${formats.displayText}`  // "This file format (.ext) is not supported. This platform only supports: ..." 
      };
    }
    
    // Explicitly block dangerous extensions
    const dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'dll', 'com', 'scr',
                                 'msi', 'jar', 'app', 'deb', 'dmg', 'pkg', 'run',
                                 'html', 'htm', 'js', 'jsx', 'ts', 'tsx', 'css', 'php',
                                 'py', 'rb', 'go', 'java', 'c', 'cpp', 'h', 'swift',
                                 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
                                 'zip', 'rar', 'tar', 'gz', '7z', 'iso',
                                 'webm', 'mkv', 'flv', 'wmv', 'm4v', '3gp', 'mpeg'];
    
    if (dangerousExtensions.includes(fileExtension)) {
      return { 
        valid: false, 
        error: `该文件格式 (.${fileExtension}) 不受支持或存在安全风险。本平台仅允许上传图片、视频和音频文件。`  // "This file format (.ext) is not supported or poses a security risk. This platform only allows uploading images, videos and audio files." 
      };
    }
    
    // Additional validation for specific types
    if (type === 'images') {
      // Only allow specific image formats
      const allowedImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'bmp'];
      if (!allowedImageExtensions.includes(fileExtension)) {
        return { 
          valid: false, 
          error: `不支持的图片格式 (.${fileExtension})。仅支持: JPG, PNG, GIF, HEIC, BMP` 
        };
      }
    } else if (type === 'videos') {
      // Only allow specific video formats
      const allowedVideoExtensions = ['mp4', 'mov', 'avi'];
      if (!allowedVideoExtensions.includes(fileExtension)) {
        return { 
          valid: false, 
          error: `不支持的视频格式 (.${fileExtension})。仅支持: MP4, MOV, AVI` 
        };
      }
    } else if (type === 'audio') {
      // Only allow specific audio formats
      const allowedAudioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'];
      if (!allowedAudioExtensions.includes(fileExtension)) {
        return { 
          valid: false, 
          error: `不支持的音频格式 (.${fileExtension})。仅支持: MP3, WAV, AAC, M4A, FLAC, OGG` 
        };
      }
    }
    
    return { valid: true };
  },

  // Choose images
  chooseImage(sourceType) {
    const { files } = this.data;

    if (files.length > 0 && files[0].type === "video") {
      wx.showToast({
        title: this.data.messages.errors.videoImageConflict,
        icon: "none",
        duration: 2000
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
        if (!res.tempFiles || res.tempFiles.length === 0) {
          wx.showToast({
            title: "无法选择该图片",  // "Unable to select this image"
            icon: "none",
            duration: 2000
          });
          return;
        }
        
        // Validate each selected file
        const validFiles = [];
        const invalidFiles = [];

        res.tempFiles.forEach(file => {
          if (!file) {

            return;
          }
          // Ensure file has size property for validation
          if (!file.size && file.fileSize) {
            file.size = file.fileSize;
          }
          
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
            duration: 2000
          });
          
          // If all files are invalid, return early
          if (validFiles.length === 0) {
            return;
          }
        }
        this.setData({ imageLoading: true });

        const newFiles = validFiles.map((file, index) => ({
          url: file.tempFilePath,
          size: file.size || file.fileSize || 0,
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
          duration: 2000
        });

        // Start background upload sequentially
        this.startSequentialUploads(newFiles, files.length);

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
        duration: 2000
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
        if (!res.tempFiles || res.tempFiles.length === 0) {
          wx.showToast({
            title: "无法选择该视频",  // "Unable to select this video"
            icon: "none",
            duration: 2000
          });
          return;
        }
        
        const videoFile = res.tempFiles[0];
        
        if (!videoFile) {
          wx.showToast({
            title: "视频文件无效",
            icon: "none",
            duration: 2000
          });
          return;
        }
        
        // Ensure video file has size property for validation
        if (videoFile && !videoFile.size && videoFile.fileSize) {
          videoFile.size = videoFile.fileSize;
        }

        // Validate video file
        const validation = this.validateFile(videoFile, 'videos');
        if (!validation.valid) {
          wx.showToast({
            title: validation.error,
            icon: "none",
            duration: 2000
          });
          return;
        }


        let thumbnailPath = null;

        if (videoFile.thumbTempFilePath) {
          thumbnailPath = videoFile.thumbTempFilePath;

          wx.getFileInfo({
            filePath: thumbnailPath,
            success: (fileInfo) => {
              if (fileInfo.size === 0) {
                thumbnailPath = null;
              }
            },
            fail: (error) => {

              thumbnailPath = null;
            },
          });
        } else {
        }

        const newFile = {
          url: videoFile.tempFilePath,
          size: videoFile.size || videoFile.fileSize || 0,
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
          duration: 2000
        });

        if (thumbnailPath) {
        } else {

        }

        // Start background upload with thumbnail
          
        this.startSequentialUploads([newFile], 0);

      },
      fail: (error) => {



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
          duration: 2000
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
            duration: 2000
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
      duration: 2000
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
            duration: 2000
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
        duration: 2000
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
        duration: 2000
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
      duration: 2000
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

      

    // Try chooseMessageFile with all type for better compatibility
    const tryChooseMessageFile = () => {
      wx.chooseMessageFile({
        count: 1,
        type: "all", // Change from "file" to "all" for better mobile compatibility
        success: (res) => {
          const audioFile = res.tempFiles[0];


          // STRICT: Check if it's an audio file
          const fileName = audioFile.name || audioFile.path || "";
          const fileExt = fileName.split(".").pop().toLowerCase();
          
          // STRICT: Only allow specific safe audio formats
          const validAudioExts = [
            "mp3",
            "wav",
            "aac",
            "m4a",
            "flac",
            "ogg"
            // Removed: "wma", "ape", "m4b", "amr" - less common/potentially problematic
          ];
          
          // Explicitly block dangerous extensions
          const dangerousExts = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'dll', 'com', 'scr',
                                 'msi', 'jar', 'app', 'deb', 'dmg', 'pkg', 'run',
                                 'html', 'htm', 'js', 'jsx', 'ts', 'tsx', 'css', 'php',
                                 'py', 'rb', 'go', 'java', 'c', 'cpp', 'h', 'swift'];
          
          if (dangerousExts.includes(fileExt)) {
            wx.showToast({
              title: `危险文件类型 (.${fileExt}) 被拒绝`,
              icon: "none",
              duration: 2000
            });
            return;
          }

          if (!validAudioExts.includes(fileExt)) {
            wx.showToast({
              title: `不支持的音频格式 (.${fileExt})。仅支持: MP3, WAV, AAC, M4A, FLAC, OGG`,
              icon: "none",
              duration: 2000
            });
            return;
          }

          this.handleAudioSelected(audioFile);
        },
        fail: (err) => {


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
              duration: 2000
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

    
    // Ensure audio file has size property for validation
    if (!audioFile.size) {
      if (audioFile.fileSize) {
        audioFile.size = audioFile.fileSize;
      } else {
        // Try to get file size using wx.getFileInfo
        const filePath = audioFile.path || audioFile.tempFilePath;
        if (filePath) {
          wx.getFileInfo({
            filePath: filePath,
            success: (info) => {
              audioFile.size = info.size;
            },
            fail: () => {
              audioFile.size = 0;
            }
          });
        }
      }
    }

    // Validate audio file using unified validation
    const validation = this.validateFile(audioFile, 'audio');
    if (!validation.valid) {
      wx.showToast({
        title: validation.error,
        icon: "none",
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
        duration: 2000
      });
      return;
    }




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
      duration: 2000
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
        duration: 2000
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
        duration: 2000
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
        duration: 2000
      });
      return false;
    }

    if (!content.trim()) {
      wx.showToast({
        title: this.data.messages.errors.contentRequired,
        icon: "none",
        duration: 2000
      });
      return false;
    }

    if (files.length === 0) {
      wx.showToast({
        title: this.data.messages.errors.filesRequired,
        icon: "none",
        duration: 2000
      });
      return false;
    }

    return true;
  },

  // Submit form
  async submitForm(e) {
    // Prevent duplicate submissions
    if (this.data.isSubmitting) {

      return;
    }
    
    // Set submitting flag immediately
    this.setData({ isSubmitting: true });
    
    // Show global loading immediately
    const app = getApp();
    app.showGlobalLoading();

    // Validate form fields
    const { title, content, files, imageDots } = this.data;

    // Check for swear words in title and content
    if (isContainSword(title)) {
      this.setData({ isSubmitting: false });
      app.hideGlobalLoading();
      wx.showToast({
        title: "标题包含不当语言，请修改后再上传",
        icon: "none",
        duration: 2000
      });
      return;
    }

    if (isContainSword(content)) {
      this.setData({ isSubmitting: false });
      app.hideGlobalLoading();
      wx.showToast({
        title: "内容包含不当语言，请修改后再上传",
        icon: "none",
        duration: 2000
      });
      return;
    }

    // Check for swear words in image annotations
    for (const imageIndex in imageDots) {
      const dots = imageDots[imageIndex];
      if (dots && Array.isArray(dots)) {
        for (const dot of dots) {
          if (dot.title && isContainSword(dot.title)) {
            this.setData({ isSubmitting: false });
            app.hideGlobalLoading();
            wx.showToast({
              title: "图片标记标题包含不当语言，请修改后再上传",
              icon: "none",
              duration: 2000
            });
            return;
          }
          if (dot.description && isContainSword(dot.description)) {
            this.setData({ isSubmitting: false });
            app.hideGlobalLoading();
            wx.showToast({
              title: "图片标记描述包含不当语言，请修改后再上传",
              icon: "none",
              duration: 2000
            });
            return;
          }
        }
      }
    }

    if (!title || !title.trim()) {
      this.setData({ isSubmitting: false });
      app.hideGlobalLoading();
      wx.showToast({
        title: "请输入标题 (不能只有空格)",
        icon: "none",
        duration: 2000
      });
      return;
    }

    if (!content || !content.trim()) {
      this.setData({ isSubmitting: false });
      app.hideGlobalLoading();
      wx.showToast({
        title: "请输入内容 (不能只有空格)",
        icon: "none",
        duration: 2000
      });
      return;
    }

    if (!files || files.length === 0) {
      this.setData({ isSubmitting: false });
      app.hideGlobalLoading();
      wx.showToast({
        title: "请上传图片或视频",
        icon: "none",
        duration: 2000
      });
      return;
    }

    // Check if any files are still uploading
    const uploadingFiles = this.data.files.filter((file) => file.uploading);
    const audioUploading = this.data.audio && this.data.audio.uploading;

    if (uploadingFiles.length > 0 || audioUploading) {
      // Show full screen loading overlay
      this.setData({ 
        loading: true,
        loadingMessage: "等待文件上传完成..."
      });
      // App loading already shown at the beginning

      // Wait for all file uploads to complete with timeout
      if (uploadingFiles.length > 0) {
        try {
          let waitCount = 0;
          const maxWait = 1200; // Maximum 120 seconds (1200 * 100ms)
          
          while (this.data.files.some((file) => file.uploading) && waitCount < maxWait) {
              
            await new Promise((resolve) => setTimeout(resolve, 100));
            waitCount++;
          }
          
          if (waitCount >= maxWait) {
            this.setData({ loading: false });
            app.hideGlobalLoading();
            wx.showToast({
              title: "文件上传超时，请检查网络后重试",
              icon: "none",
              duration: 2000
            });
            return;
          }
          

        } catch (error) {
          this.setData({ loading: false });
          app.hideGlobalLoading();
          wx.showToast({
            title: "文件上传过程中发生错误，请重试",
            icon: "none",
            duration: 2000
          });
          return;
        }
      }

      // Wait for audio upload to complete with timeout
      if (audioUploading) {

        try {
          let audioWaitCount = 0;
          const maxAudioWait = 600; // Maximum 60 seconds for audio
          
          while (this.data.audio && this.data.audio.uploading && audioWaitCount < maxAudioWait) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            audioWaitCount++;
          }
          
          if (audioWaitCount >= maxAudioWait) {
            this.setData({ loading: false, isSubmitting: false });
            app.hideGlobalLoading();
            wx.showToast({
              title: "音频上传超时，请重试",
              icon: "none",
              duration: 2000
            });
            return;
          }
          

        } catch (error) {
          this.setData({ loading: false, isSubmitting: false });
          app.hideGlobalLoading();
          wx.showToast({
            title: "音频上传过程中发生错误，请重试",
            icon: "none",
            duration: 2000
          });
          return;
        }
      }

      // Keep loading state active for the actual submission
    }

    // Check for upload errors and retry failed uploads
    const failedFiles = this.data.files.filter((file) => file.uploadError);
    const audioFailed = this.data.audio && this.data.audio.uploadError;

    // Retry failed uploads before final submission
    if (failedFiles.length > 0) {

      try {
        this.setData({ loading: true });
        this.setData({ 
          loading: true,
          loadingMessage: "重试失败的上传..." 
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

        this.setData({ loading: false });
      } catch (error) {

        this.setData({ loading: false });
      }
    }

    if (audioFailed) {

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

      }
    }

    // Final check for upload errors after retry
    const stillFailedFiles = this.data.files.filter((file) => file.uploadError);
    const audioStillFailed = this.data.audio && this.data.audio.uploadError;

    if (stillFailedFiles.length > 0 || audioStillFailed) {
      this.setData({ loading: false, isSubmitting: false });
      
      // Show specific error message based on error type
      let errorMsg = "文件上传失败";
      if (stillFailedFiles.length > 0) {
        const firstError = stillFailedFiles[0].uploadError;
        if (firstError && (firstError.includes('不受支持') || firstError.includes('不支持'))) {
          errorMsg = firstError;
        } else if (firstError && firstError.includes('编码')) {
          errorMsg = "视频文件编码格式不支持，请转换为标准 H.264 编码后重试";
        } else if (firstError && firstError.includes('格式')) {
          errorMsg = "文件格式不受支持，请选择其他文件";
        } else if (firstError && firstError.includes('网络')) {
          errorMsg = "网络连接异常，请检查网络后重试";
        } else if (firstError && firstError.includes('超时')) {
          errorMsg = "上传超时，请检查网络或减小文件大小";
        } else {
          errorMsg = "文件上传失败，请检查文件格式或网络连接后重试";
        }
      }
      
      if (audioStillFailed && this.data.audio.uploadError) {
        const audioError = this.data.audio.uploadError;
        if (audioError && (audioError.includes('不受支持') || audioError.includes('不支持'))) {
          errorMsg = audioError;
        }
      }
      
      app.hideGlobalLoading();
      wx.showToast({
        title: errorMsg,
        icon: "none",
        duration: 2000
      });
      return;
    }

    // All uploads successful, proceed with form submission
    try {
      this.setData({ loading: true });
      this.setData({ 
        loading: true,
        loadingMessage: this.data.isUpdateMode
          ? this.data.messages.updating
          : this.data.messages.loading
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
        this.setData({ loading: false, isSubmitting: false });
        app.hideGlobalLoading();
        wx.showToast({
          title: "没有可提交的文件URL，请重新上传文件",
          icon: "none",
          duration: 2000
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



      // App loading already shown at the beginning of submitForm

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
          if (res.statusCode === 200 && res.data.status === "success") {
            // Save redirect info before resetting form
            const isEventPost = this.data.eventId || requestData.event_id;
            const eventIdForRedirect = this.data.eventId || requestData.event_id;
            const wasUpdateMode = this.data.isUpdateMode;
            
            // Reset form immediately after success
            this.resetForm();
            
            // Keep loading state active to prevent re-submission (after resetForm)
            this.setData({ loading: true, isSubmitting: true });
            
            wx.showToast({
              title: wasUpdateMode
                ? this.data.messages.success.updateSuccess
                : this.data.messages.success.createSuccess,
              icon: "success",
              duration: 2000
            });

            // Delay before redirect, keep loading bar active
            setTimeout(() => {
              // Debug: Check values


              
              // DO NOT hide loading bar on success - let the new page handle it
              // app.hideGlobalLoading(); // Removed to keep loading bar active
              
              // Set refresh flag for posts
              const app = getApp();
              app.globalData.refreshPosts = true;

              // Check if this is an event post
              if (isEventPost) {
                // Navigate back to the event detail page
                wx.redirectTo({
                  url: `/pages/event-detail/event-detail?eventId=${eventIdForRedirect}`,
                });
              } else {
                // Navigate to me page for regular posts
                wx.redirectTo({
                  url: `/pages/me/me`,
                });
              }
            }, 1500);
          } else {
            // On failure, stop loading
            this.setData({ loading: false, isSubmitting: false });
            app.hideGlobalLoading();
            wx.showToast({
              title: res.data.msg || this.data.messages.errors.operationFailed,
              icon: "none",
              duration: 2000
            });
          }
        },
        fail: (error) => {
          this.setData({ loading: false, isSubmitting: false });
          app.hideGlobalLoading();

          
          // Show specific error message based on error type
          let errorMsg = this.data.messages.errors.requestFailed;
          const errorStr = error.errMsg || error.message || '';
          
          if (errorStr.includes('timeout') || errorStr.includes('超时')) {
            errorMsg = "上传超时，请检查网络或减小文件大小";
          } else if (errorStr.includes('network') || errorStr.includes('网络')) {
            errorMsg = "网络连接异常，请检查网络后重试";
          } else if (errorStr.includes('fail')) {
            errorMsg = "提交失败，请检查网络连接后重试";
          }
          
          wx.showToast({
            title: errorMsg,
            icon: "none",
            duration: 2000
          });
        },
        complete: () => {
          // Don't hide loading or reset loading state here
          // It will be handled in success or fail callbacks
        },
      });
    } catch (error) {
      this.setData({ loading: false });

      
      // Show specific error message based on error type  
      const errorMsg = error.message || '';
      if (errorMsg.includes('不受支持') || errorMsg.includes('不支持')) {
        wx.showToast({
          title: errorMsg,
          icon: "none",
          duration: 2000
        });
      } else if (errorMsg.includes('编码')) {
        wx.showToast({
          title: "视频文件编码格式不支持，请转换为标准 H.264 编码后重试",
          icon: "none",
          duration: 2000
        });
      } else if (errorMsg.includes('格式')) {
        wx.showToast({
          title: "文件格式不受支持，请选择其他文件",
          icon: "none",
          duration: 2000
        });
      } else if (errorMsg.includes('网络')) {
        wx.showToast({
          title: "网络连接异常，请检查网络后重试",
          icon: "none",
          duration: 2000
        });
      } else if (errorMsg.includes('超时')) {
        wx.showToast({
          title: "上传超时，请检查网络或减小文件大小",
          icon: "none",
          duration: 2000
        });
      } else {
        wx.showToast({
          title: this.data.messages.errors.operationFailed,
          icon: "none",
          duration: 2000,
        });
      }
      
      this.setData({ loading: false, isSubmitting: false });
      app.hideGlobalLoading();
    } finally {
      // Don't do anything here - loading state is managed in success/fail/catch blocks
    }
  },

  // Reset form to initial state
  resetForm() {
    this.setData({
      title: "",
      content: "",
      files: [],
      audio: null,
      audioName: "",
      selectedImageIndex: null,
      imageDots: {},
      editingDot: null,
      showDotEditor: false,
      loading: false,
      isLoading: false,
      loadingMessage: "",
      imageLoading: false,
      activeTab: "media",
      uploadingFiles: [],
      deletedFiles: [],
      thumbnailCapture: null,
      isSubmitting: false
    });
  },

  // Close modal/page
  onClose() {
    wx.navigateBack();
  },

  handlePreventClose(e) {},

  // Background upload functions
  async uploadFileInBackground(file, fileIndex) {
      
    let retryCount = 0;
    const maxRetries = 2;

    const attemptUpload = async () => {
      try {


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




        if (thumbnailPath && file.type === "video") {
          try {
            const thumbInfo = await new Promise((resolve, reject) => {
              wx.getFileInfo({
                filePath: thumbnailPath,
                success: resolve,
                fail: reject,
              });
            });
          } catch (thumbError) {

          }
        }

        const uploadResult = await ucloudUpload.uploadMedia(
          fileForUpload,
          (progress) => {
            // Update progress internally but don't show in UI for background uploads

            const files = this.data.files;
            if (files[fileIndex]) {
              files[fileIndex].uploadProgress = progress;
              this.setData({ files });
            }
          }
        );



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


          if (uploadResult.thumbnailUrl) {
             
          }
        }
      } catch (error) {
          

        if (retryCount < maxRetries) {
          retryCount++;

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
            // Set specific error message based on error type
            let errorMsg = error.message || "文件上传失败";
            if (errorMsg.includes('不受支持') || errorMsg.includes('不支持') || 
                errorMsg.includes('安全风险') || errorMsg.includes('禁止')) {
              // Format error - keep original message
              files[fileIndex].uploadError = errorMsg;
            } else if (errorMsg.includes('codec') || errorMsg.includes('编码')) {
              files[fileIndex].uploadError = "视频文件编码格式不支持，请转换为标准 H.264 编码后重试";
            } else if (errorMsg.includes('network') || errorMsg.includes('网络')) {
              files[fileIndex].uploadError = "网络连接异常，请检查网络后重试";
            } else if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
              files[fileIndex].uploadError = "上传超时，请检查网络或减小文件大小";
            } else {
              files[fileIndex].uploadError = "文件上传失败，请检查文件格式后重试";
            }

            const uploadingFiles = this.data.uploadingFiles.filter(
              (idx) => idx !== fileIndex
            );
            this.setData({ files, uploadingFiles });

              
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



        const uploadResult = await ucloudUpload.uploadMedia(
          audioForUpload,
          (progress) => {
            // Update progress internally but don't show in UI for background uploads

            const audio = this.data.audio;
            if (audio) {
              audio.uploadProgress = progress;
              this.setData({ audio });
            }
          }
        );



        // Update audio status
        const audio = this.data.audio;
        if (audio) {
          audio.uploading = false;
          audio.uploaded = true;
          audio.uploadResult = uploadResult;
          this.setData({ audio });


        }
      } catch (error) {
         

        if (retryCount < maxRetries) {
          retryCount++;

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
            audio.uploadError = error.message || "音频文件上传失败，请重试";  // "Audio file upload failed, please try again"
            this.setData({ audio });


          }
        }
      }
    };

    await attemptUpload();
  },

  // Sequential upload manager to prevent connection limit issues
  async startSequentialUploads(files, startIndex) {


    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileIndex = startIndex + i;

      // Wait a bit before starting each upload to ensure connections are properly closed
      if (i > 0) {

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Upload the file and wait for it to complete before moving to next
      await this.uploadFileInBackground(file, fileIndex);


    }


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
