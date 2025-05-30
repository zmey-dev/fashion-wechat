// pages/create-media/create-media.js
Page({
  data: {
    // Form data
    title: '',
    content: '',
    allowDownload: false,
    
    // File management
    files: [],
    audio: null,
    audioName: '',
    maxFiles: 10,
    
    // Image annotation system
    selectedImageIndex: null,
    imageDots: {},
    editingDot: null,
    showDotEditor: false,
    
    // UI states
    loading: false,
    imageLoading: false,
    activeTab: 'media', // 'media' or 'form'
    showInstructions: true,
    
    // Update mode
    isUpdateMode: false,
    mediaId: null,
    deletedFiles: [],
    
    // Event related
    eventId: null,
    eventTitle: '',
    mediaCreateType: ''
  },

  onLoad(options) {
    const { eventId, mediaId, mediaCreateType } = options;
    
    this.setData({
      eventId: eventId || null,
      mediaId: mediaId || null,
      mediaCreateType: mediaCreateType || '',
      isUpdateMode: !!mediaId
    });

    if (eventId) {
      this.loadEventInfo(eventId);
    }

    if (mediaId) {
      this.loadExistingPost(mediaId);
    }
  },

  // Load event information
  loadEventInfo(eventId) {
    // Simulate API call to get event info
    wx.request({
      url: `${getApp().globalData.apiBase}/events/${eventId}`,
      method: 'GET',
      success: (res) => {
        if (res.data.status === 'success') {
          this.setData({
            eventTitle: res.data.event.title
          });
        }
      }
    });
  },

  // Load existing post for update
  loadExistingPost(mediaId) {
    wx.showLoading({ title: 'Loading...' });
    
    wx.request({
      url: `${getApp().globalData.apiBase}/posts/${mediaId}`,
      method: 'GET',
      success: (res) => {
        if (res.data.status === 'success') {
          const post = res.data.post;
          
          this.setData({
            title: post.title || '',
            content: post.content || '',
            allowDownload: post.allow_download || false,
            files: post.filenames ? JSON.parse(post.filenames).map(filename => ({
              url: filename,
              isExisting: true
            })) : [],
            imageDots: post.image_dots ? JSON.parse(post.image_dots) : {}
          });
        }
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // Handle media file selection
  chooseMedia() {
    const { files } = this.data;
    const remainingSlots = this.data.maxFiles - files.length;
    
    if (remainingSlots <= 0) {
      wx.showToast({
        title: `最多只能上传 ${this.data.maxFiles} 个文件`,
        icon: 'none'
      });
      return;
    }

    wx.showActionSheet({
      itemList: ['拍摄照片', '从相册选择', '拍摄视频'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.chooseImage('camera');
            break;
          case 1:
            this.chooseImage('album');
            break;
          case 2:
            this.chooseVideo();
            break;
        }
      }
    });
  },

  // Choose images
  chooseImage(sourceType) {
    const { files } = this.data;
    const remainingSlots = this.data.maxFiles - files.length;
    
    wx.chooseMedia({
      count: Math.min(remainingSlots, 9),
      mediaType: ['image'],
      sourceType: [sourceType],
      success: (res) => {
        this.setData({ imageLoading: true });
        
        const newFiles = res.tempFiles.map(file => ({
          url: file.tempFilePath,
          size: file.size,
          type: 'image',
          file: file
        }));

        this.setData({
          files: [...files, ...newFiles],
          imageLoading: false
        });

        wx.showToast({
          title: `已添加 ${newFiles.length} 个文件`,
          icon: 'success'
        });
      },
      fail: () => {
        this.setData({ imageLoading: false });
      }
    });
  },

  // Choose video
  chooseVideo() {
    const { files } = this.data;
    
    if (files.length > 0) {
      wx.showToast({
        title: '视频模式只能上传一个文件',
        icon: 'none'
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      success: (res) => {
        const videoFile = res.tempFiles[0];
        
        this.setData({
          files: [{
            url: videoFile.tempFilePath,
            size: videoFile.size,
            type: 'video',
            file: videoFile
          }]
        });

        wx.showToast({
          title: '视频已添加',
          icon: 'success'
        });
      }
    });
  },

  // Remove file
  removeFile(e) {
    const { index } = e.currentTarget.dataset;
    const { files, imageDots, selectedImageIndex } = this.data;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个文件吗？',
      success: (res) => {
        if (res.confirm) {
          const newFiles = [...files];
          const removedFile = newFiles.splice(index, 1)[0];
          
          // Handle deleted files for update mode
          const deletedFiles = [...this.data.deletedFiles];
          if (removedFile.isExisting) {
            deletedFiles.push(removedFile.url.split('/').pop());
          }

          // Remove associated dots
          const newImageDots = { ...imageDots };
          delete newImageDots[index];

          // Reindex dots
          const reindexedDots = {};
          Object.keys(newImageDots).forEach(key => {
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
            deletedFiles
          });

          wx.showToast({
            title: '文件已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  // Select image for annotation
  selectImage(e) {
    const { index } = e.currentTarget.dataset;
    const file = this.data.files[index];
    
    if (this.isImage(file)) {
      this.setData({
        selectedImageIndex: index,
        activeTab: 'annotation'
      });
    }
  },

  // Check if file is image
  isImage(file) {
    if (!file) return false;
    
    const extensions = ['jpeg', 'png', 'jpg', 'gif', 'svg', 'bmp', 'ico', 'heic'];
    const fileName = file.url || file.tempFilePath || '';
    const extension = fileName.toLowerCase().split('.').pop();
    
    return extensions.includes(extension);
  },

  // Handle image tap for adding dots
  onImageTap(e) {
    const { selectedImageIndex } = this.data;
    if (selectedImageIndex === null) return;

    const { x, y } = e.detail;
    const query = wx.createSelectorQuery();
    
    query.select('#annotation-image').boundingClientRect();
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
    
    const newDot = { x, y, title: '', description: '' };
    const updatedDots = {
      ...imageDots,
      [indexStr]: [...currentDots, newDot]
    };
    
    this.setData({
      imageDots: updatedDots
    });

    wx.showToast({
      title: '标记点已添加',
      icon: 'success'
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
        ...dot
      },
      showDotEditor: true
    });
  },

  // Remove dot
  removeDot(e) {
    const { imageIndex, dotIndex } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个标记点吗？',
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
            imageDots: updatedDots
          });

          wx.showToast({
            title: '标记点已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  // Handle dot editor input
  onDotTitleInput(e) {
    this.setData({
      'editingDot.title': e.detail.value
    });
  },

  onDotDescInput(e) {
    this.setData({
      'editingDot.description': e.detail.value
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
        [indexStr]: currentDots
      },
      showDotEditor: false,
      editingDot: null
    });

    wx.showToast({
      title: '标记点已更新',
      icon: 'success'
    });
  },

  // Cancel dot editing
  cancelDotEdit() {
    this.setData({
      showDotEditor: false,
      editingDot: null
    });
  },

  // Choose audio
  chooseAudio() {
    const { files } = this.data;
    
    if (files.length > 0 && !this.isImage(files[0])) {
      wx.showToast({
        title: '视频模式不支持背景音乐',
        icon: 'none'
      });
      return;
    }

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'wav', 'aac', 'm4a'],
      success: (res) => {
        const audioFile = res.tempFiles[0];
        this.setData({
          audio: audioFile,
          audioName: audioFile.name
        });

        wx.showToast({
          title: '音频已选择',
          icon: 'success'
        });
      }
    });
  },

  // Remove audio
  removeAudio() {
    this.setData({
      audio: null,
      audioName: ''
    });
  },

  // Form input handlers
  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    });
  },

  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  onDownloadToggle() {
    this.setData({
      allowDownload: !this.data.allowDownload
    });
  },

  // Tab switching
  switchTab(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({
      activeTab: tab
    });
  },

  // Back from annotation
  backFromAnnotation() {
    this.setData({
      activeTab: 'media',
      selectedImageIndex: null
    });
  },

  // Toggle instructions
  toggleInstructions() {
    this.setData({
      showInstructions: !this.data.showInstructions
    });
  },

  // Form validation
  validateForm() {
    const { title, content, files } = this.data;
    
    if (!title.trim()) {
      wx.showToast({
        title: '请输入标题',
        icon: 'none'
      });
      return false;
    }
    
    if (!content.trim()) {
      wx.showToast({
        title: '请输入描述',
        icon: 'none'
      });
      return false;
    }
    
    if (files.length === 0) {
      wx.showToast({
        title: '请上传媒体文件',
        icon: 'none'
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
        title: this.data.isUpdateMode ? '更新成功' : '创建成功',
        icon: 'success'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      
    } catch (error) {
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
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
      deletedFiles
    } = this.data;

    const formData = {
      title: title.trim(),
      content: content.trim(),
      allowDownload,
      type: this.isImage(files[0]) ? 'image' : 'video',
      files,
      imageDots,
      audio
    };

    if (eventId && mediaCreateType === 'event') {
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
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${getApp().globalData.apiBase}/posts`,
        filePath: formData.files[0].url,
        name: 'file',
        formData: {
          title: formData.title,
          content: formData.content,
          allowDownload: formData.allowDownload,
          type: formData.type,
          imageDots: JSON.stringify(formData.imageDots),
          eventId: formData.eventId || '',
          userId: getApp().globalData.userId
        },
        success: resolve,
        fail: reject
      });
    });
  },

  // Update existing post
  updatePost(formData) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${getApp().globalData.apiBase}/posts/${formData.mediaId}`,
        method: 'PUT',
        data: formData,
        success: resolve,
        fail: reject
      });
    });
  },

  // Close modal/page
  onClose() {
    wx.navigateBack();
  }
});