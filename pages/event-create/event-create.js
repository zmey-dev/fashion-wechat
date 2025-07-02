// Event creation page
const { default: config } = require("../../config");
const ucloudUpload = require("../../services/ucloudUpload");

Page({
  data: {
    // Form data
    title: "",
    posterImage: null,
    posterImageUrl: null,
    posterUploadUrl: null, // Store the final uploaded URL
    startDate: new Date(),
    endDate: null,
    allowOtherSchool: true,
    allowLimit: false,
    limit: "",
    description: "",
    // UI state
    isUploading: false,
    eventId: null,
    
    // Background upload state
    posterUploading: false,
    posterUploadProgress: 0,
    posterUploaded: false,
    posterUploadError: null,

    // Display data
    startDateDisplay: "选择开始时间",
    endDateDisplay: "选择结束时间",
    universityName: "北京大学",

    // Calendar state
    showStartCalendar: false,
    showEndCalendar: false,
    currentCalendarType: "",
    calendarData: {
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth() + 1,
      calendarDates: [],
    },

    // Editor state
    formats: {
      bold: false,
      italic: false,
      underline: false,
    },
  },
  onLoad(options) {
    const { eventId } = options;
    // Set navigation bar
    wx.setNavigationBarTitle({
      title: eventId ? "编辑活动" : "创建活动",
    });

    if (eventId) {
      this.setData({ eventId });
      this.loadEventData(eventId);
    } else {
      // Initialize end date (7 days from now) only for new events
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      this.setData({
        endDate,
        endDateDisplay: this.formatDateDisplay(endDate),
      });
      // Load draft for new events
      this.loadDraft();
    }

    // Initialize calendar
    this.initCalendar();

    // Get user info
    this.getUserInfo();
  },

  onShow() {
    if(this.data.eventId) {
      // If editing an existing event, reload data to ensure latest info
      this.loadEventData(this.data.eventId);
    }
    this.initCalendar();
  },
  // Get user information
  getUserInfo() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;

    if (userInfo && userInfo.university) {
      this.setData({
        universityName:
          userInfo.university.name || userInfo.university || "北京大学",
      });
    }
  }, // Load existing event data for editing
  loadEventData(eventId) {
    wx.showLoading({
      title: "加载中...",
      mask: true,
    });

    this.loadEventFromAPI(eventId, {
      success: (eventData) => {
        // Parse dates correctly to avoid timezone issues
        const startDateParts = eventData.start_date.split("-");
        const endDateParts = eventData.end_date.split("-");
        const startDate = new Date(
          parseInt(startDateParts[0]),
          parseInt(startDateParts[1]) - 1,
          parseInt(startDateParts[2])
        );
        const endDate = new Date(
          parseInt(endDateParts[0]),
          parseInt(endDateParts[1]) - 1,
          parseInt(endDateParts[2])
        );
        this.setData({
          title: eventData.title,
          posterImageUrl: eventData.poster_image,
          posterUploadUrl: eventData.poster_image, // Set uploaded URL for existing poster
          posterUploaded: true, // Mark as already uploaded
          startDate: startDate,
          endDate: endDate,
          allowOtherSchool: eventData.allow_other_school,
          allowLimit: eventData.allow_limit,
          limit: eventData.limit ? eventData.limit.toString() : "",
          description: eventData.description,
          startDateDisplay: this.formatDateDisplay(startDate),
          endDateDisplay: this.formatDateDisplay(endDate),
        });
        // Set editor content after data is loaded
        setTimeout(() => {
          if (this.editorCtx && eventData.description) {
            this.editorCtx.setContents({
              html: eventData.description,
              success: () => {
                console.log("Editor content set successfully");
              },
              fail: (error) => {
                console.error("Failed to set editor content:", error);
              },
            });
          }
        }, 1000); // Increased timeout to 1000ms

        // Update calendar to show the correct month for start date
        this.setData({
          "calendarData.currentYear": startDate.getFullYear(),
          "calendarData.currentMonth": startDate.getMonth() + 1,
          "calendarData.calendarDates": this.generateCalendarDates(
            startDate.getFullYear(),
            startDate.getMonth() + 1
          ),
        });

        wx.hideLoading();

        wx.showToast({
          title: "活动信息加载完成",
          icon: "success",
          duration: 1500,
        });
      },
      fail: (error) => {
        wx.hideLoading();
        wx.showToast({
          title: "加载活动信息失败",
          icon: "none",
          duration: 2000,
        });
        console.error("加载活动信息失败:", error);
      },
    });
  },
  // Navigation handlers
  onBack() {
    if (this.hasUnsavedChanges()) {
      wx.showModal({
        title: "提示",
        content: "您有未保存的更改，确定要离开吗？",
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        },
      });
    } else {
      wx.navigateBack();
    }
  }, // Check if there are unsaved changes
  hasUnsavedChanges() {
    // If editing existing event, check if any field has been modified
    if (this.data.eventId) {
      // In a real app, you would compare with original data
      // For now, consider any non-empty field as changed
      return (
        this.data.title.trim() !== "" || this.data.description.trim() !== ""
      );
    }

    // For new events, check if any field has content
    return (
      this.data.title.trim() !== "" ||
      this.data.description.trim() !== "" ||
      this.data.posterImageUrl !== null
    );
  },

  // Form input handlers
  onTitleInput(e) {
    this.setData({
      title: e.detail.value,
    });
  },

  onLimitInput(e) {
    this.setData({
      limit: e.detail.value,
    });
  },

  // Switch handlers
  onSchoolSwitchChange(e) {
    this.setData({
      allowOtherSchool: e.detail.value,
    });
  },

  onLimitSwitchChange(e) {
    this.setData({
      allowLimit: e.detail.value,
    });

    if (!e.detail.value) {
      this.setData({ limit: "" });
    }
  },

  // Image upload
  triggerFileInput() {
    const that = this;

    wx.showActionSheet({
      itemList: ["从相册选择", "拍照"],
      success(res) {
        const sourceType = res.tapIndex === 0 ? ["album"] : ["camera"];

        wx.chooseMedia({
          count: 1,
          mediaType: ["image"],
          sourceType: sourceType,
          camera: "back",
          success: (res) => {
            const tempFile = res.tempFiles[0];
            // Check file size (max 5MB)
            if (tempFile.size > 5 * 1024 * 1024) {
              wx.showToast({
                title: "图片不能超过5MB",
                icon: "none",
              });
              return;
            }

            that.setData({
              posterImage: tempFile,
              posterImageUrl: tempFile.tempFilePath,
              posterUploading: true,
              posterUploadProgress: 0,
              posterUploaded: false,
              posterUploadError: null,
              posterUploadUrl: null,
            });

            // Start background upload immediately
            that.uploadPosterInBackground(tempFile);
          },
          fail: (err) => {
            console.error("选择图片失败:", err);
            if (err.errMsg.includes("cancel")) {
              return;
            }
            wx.showToast({
              title: "图片选择失败",
              icon: "none",
            });
          },
        });
      },
    });
  },

  // Calendar handlers
  showStartCalendar() {
    this.setData({
      showStartCalendar: true,
      showEndCalendar: false,
      currentCalendarType: "start",
    });
  },

  showEndCalendar() {
    this.setData({
      showStartCalendar: false,
      showEndCalendar: true,
      currentCalendarType: "end",
    });
  },

  closeCalendar() {
    this.setData({
      showStartCalendar: false,
      showEndCalendar: false,
      currentCalendarType: "",
    });
  },

  // Calendar navigation
  prevMonth() {
    let { currentYear, currentMonth } = this.data.calendarData;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }

    this.setData({
      "calendarData.currentYear": currentYear,
      "calendarData.currentMonth": currentMonth,
      "calendarData.calendarDates": this.generateCalendarDates(
        currentYear,
        currentMonth
      ),
    });
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data.calendarData;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }

    this.setData({
      "calendarData.currentYear": currentYear,
      "calendarData.currentMonth": currentMonth,
      "calendarData.calendarDates": this.generateCalendarDates(
        currentYear,
        currentMonth
      ),
    });
  }, // Calendar date selection
  selectCalendarDate(e) {
    const { date } = e.currentTarget.dataset;
    // Fix timezone issue by parsing date components separately
    const dateParts = date.split("-");
    const selectedDate = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prevent selecting past dates
    if (selectedDate < today) {
      wx.showToast({
        title: "不能选择过去的日期",
        icon: "none",
      });
      return;
    }

    const displayDate = this.formatDateDisplay(selectedDate);
    if (this.data.currentCalendarType === "start") {
      // If start date is after end date, reset end date
      if (this.data.endDate && selectedDate >= this.data.endDate) {
        const newEndDate = new Date(selectedDate);
        newEndDate.setDate(newEndDate.getDate() + 1);
        this.setData({
          startDate: selectedDate,
          startDateDisplay: displayDate,
          endDate: newEndDate,
          endDateDisplay: this.formatDateDisplay(newEndDate),
        });
      } else {
        this.setData({
          startDate: selectedDate,
          startDateDisplay: displayDate,
        });
      }
    } else if (this.data.currentCalendarType === "end") {
      // End date must be after start date
      if (selectedDate <= this.data.startDate) {
        wx.showToast({
          title: "结束时间必须晚于开始时间",
          icon: "none",
        });
        return;
      }
      this.setData({
        endDate: selectedDate,
        endDateDisplay: displayDate,
      });
    }

    // Close calendar after selection
    this.closeCalendar();
  },

  confirmCalendarDate() {
    this.closeCalendar();
  },

  // Initialize calendar
  initCalendar() {
    const today = new Date();
    const calendarDates = this.generateCalendarDates(
      today.getFullYear(),
      today.getMonth() + 1
    );

    this.setData({
      "calendarData.calendarDates": calendarDates,
    });
  },
  // Generate calendar dates
  generateCalendarDates(year, month) {
    const dates = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Previous month days
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month - 1, -firstDayOfWeek + i + 1);
      dates.push({
        day: prevMonthDay.getDate(),
        fullDate: this.formatDateString(prevMonthDay),
        isOtherMonth: true,
        isToday: false,
        isSelected: false,
      });
    }

    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const isToday = this.isSameDate(currentDate, today);
      dates.push({
        day,
        fullDate: this.formatDateString(currentDate),
        isOtherMonth: false,
        isToday,
        isSelected: false,
      });
    }

    // Next month days
    const totalCells = 42;
    const remainingCells = totalCells - dates.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthDay = new Date(year, month, i);
      dates.push({
        day: i,
        fullDate: this.formatDateString(nextMonthDay),
        isOtherMonth: true,
        isToday: false,
        isSelected: false,
      });
    }

    return dates;
  },

  // Rich text editor handlers
  onEditorReady() {
    const that = this;
    wx.createSelectorQuery()
      .select("#editor")
      .context(function (res) {
        that.editorCtx = res.context;

        // If there's already description content loaded from API, set it in the editor
        if (that.data.description) {
          that.editorCtx.setContents({
            html: that.data.description,
            success: () => {
              console.log("Editor content set successfully");
            },
            fail: (error) => {
              console.error("Failed to set editor content:", error);
            },
          });
        }
      })
      .exec();
  },

  onEditorFormat(e) {
    const { name, value } = e.currentTarget.dataset;
    if (!this.editorCtx) return;

    this.editorCtx.format(name, value);
    let formats = this.data.formats;
    if (name === "align") {
      // Handle alignment
    } else {
      formats[name] = !formats[name];
    }
    this.setData({ formats });
  },

  onEditorInput(e) {
    const { html, text } = e.detail;
    // Add white color style to the HTML content
    let styledHtml = html || text;
    if (styledHtml && !styledHtml.includes('color:')) {
      // Wrap content in a div with white color if no color is specified
      styledHtml = `<div style="color: #ffffff;">${styledHtml}</div>`;
    }
    this.setData({
      description: styledHtml,
    });
  },

  // Form validation
  validateForm() {
    const {
      title,
      startDate,
      endDate,
      allowLimit,
      limit,
      description,
      posterImage,
      posterImageUrl,
      eventId,
    } = this.data;

    if (!title.trim()) {
      this.showError("请输入活动标题");
      return false;
    }

    if (title.trim().length < 2) {
      this.showError("活动标题至少需要2个字符");
      return false;
    }

    // For new events, poster is required; for updates, it's optional if already exists
    if (!posterImage && !posterImageUrl && !eventId) {
      this.showError("请上传活动海报");
      return false;
    }

    if (startDate >= endDate) {
      this.showError("结束时间必须晚于开始时间");
      return false;
    }

    if (allowLimit) {
      if (!limit || parseInt(limit) < 1) {
        this.showError("请设置正确的人数上限");
        return false;
      }
      if (parseInt(limit) > 10000) {
        this.showError("人数上限不能超过10000");
        return false;
      }
    }

    if (!description.trim()) {
      this.showError("请输入活动说明");
      return false;
    }

    return true;
  },

  showError(message) {
    wx.showToast({
      title: message,
      icon: "none",
      duration: 2000,
    });
  },

  // Form submission
  handleSubmit() {
    if (!this.validateForm()) return;

    this.setData({ isUploading: true });

    const { eventId } = this.data;
    const isUpdate = !!eventId;

    wx.showLoading({
      title: isUpdate ? "更新中..." : "发布中...",
      mask: true,
    });

    // Prepare form data
    const formData = {
      title: this.data.title.trim(),
      description: this.data.description.trim(),
      start_date: this.formatDateString(this.data.startDate),
      end_date: this.formatDateString(this.data.endDate),
      allow_other_school: this.data.allowOtherSchool,
      allow_limit: this.data.allowLimit,
      limit: this.data.allowLimit ? parseInt(this.data.limit) : null,
    };

    // Handle image upload
    if (this.data.posterImage) {
      // Check if image is still uploading
      if (this.data.posterUploading) {
        wx.showLoading({
          title: "等待图片上传完成...",
          mask: true,
        });
        
        // Wait for upload to complete
        this.waitForPosterUpload().then(() => {
          wx.hideLoading();
          if (this.data.posterUploadUrl) {
            formData.poster_url = this.data.posterUploadUrl;
            this.submitEvent(formData, isUpdate);
          } else {
            wx.showToast({
              title: "图片上传失败，请重试",
              icon: "none",
              duration: 2000,
            });
            this.setData({ isUploading: false });
          }
        });
      } else if (this.data.posterUploadUrl) {
        // Image already uploaded
        formData.poster_url = this.data.posterUploadUrl;
        this.submitEvent(formData, isUpdate);
      } else {
        // Upload failed or not started
        wx.showToast({
          title: "请重新选择图片",
          icon: "none",
          duration: 2000,
        });
        this.setData({ isUploading: false });
      }
    } else if (this.data.posterImageUrl || this.data.posterUploadUrl) {
      // Use existing image URL (from edit mode) or previously uploaded URL
      formData.poster_url = this.data.posterUploadUrl || this.data.posterImageUrl;
      this.submitEvent(formData, isUpdate);
    } else {
      // No image case (should not happen due to validation, but just in case)
      this.submitEventToAPI(formData, isUpdate, {
        success: () => {
          wx.hideLoading();

          if (!isUpdate) {
            wx.removeStorageSync("eventDraft");
          }

          wx.showToast({
            title: isUpdate ? "修改成功" : "发布成功",
            icon: "success",
            duration: 2000,
          });

          setTimeout(() => {
            wx.navigateBack();
          }, 2000);

          this.setData({ isUploading: false });
        },
        fail: (error) => {
          wx.hideLoading();
          wx.showToast({
            title: isUpdate ? "修改失败" : "发布失败",
            icon: "none",
            duration: 2000,
          });
          console.error("提交活动失败:", error);
          this.setData({ isUploading: false });
        },
      });
    }
  },

  // Background upload poster to UCloud
  async uploadPosterInBackground(tempFile) {
    console.log("Starting background poster upload:", tempFile);
    
    try {
      // Progress callback
      const progressCallback = (progress) => {
        this.setData({
          posterUploadProgress: progress
        });
      };
      
      // Use uploadImageSimple for direct upload without blur
      console.log("Uploading poster image...");
      const uploadResult = await ucloudUpload.uploadImageSimple(
        tempFile.tempFilePath,
        progressCallback,
        'event_posters'  // upload folder
      );
      
      console.log("Poster upload result:", uploadResult);
      
      if (uploadResult && uploadResult.url) {
        this.setData({
          posterUploading: false,
          posterUploaded: true,
          posterUploadUrl: uploadResult.url,
          posterUploadError: null
        });
        
        wx.showToast({
          title: "海报上传成功",
          icon: "success",
          duration: 1500
        });
      } else {
        throw new Error("上传结果无效");
      }
    } catch (error) {
      console.error("Poster upload failed:", error);
      
      this.setData({
        posterUploading: false,
        posterUploaded: false,
        posterUploadUrl: null,
        posterUploadError: error.message || "上传失败"
      });
      
      wx.showToast({
        title: "海报上传失败",
        icon: "none",
        duration: 2000
      });
    }
  },
  
  // Wait for poster upload to complete
  waitForPosterUpload() {
    return new Promise((resolve) => {
      const checkInterval = 100;
      const maxWaitTime = 30000; // 30 seconds
      let waitTime = 0;
      
      const check = () => {
        if (this.data.posterUploaded || this.data.posterUploadError) {
          resolve();
        } else if (waitTime >= maxWaitTime) {
          this.setData({
            posterUploading: false,
            posterUploadError: "上传超时"
          });
          resolve();
        } else {
          waitTime += checkInterval;
          setTimeout(check, checkInterval);
        }
      };
      
      check();
    });
  },
  
  // Submit event after upload complete
  submitEvent(formData, isUpdate) {
    this.submitEventToAPI(formData, isUpdate, {
      success: () => {
        wx.hideLoading();
        
        if (!isUpdate) {
          wx.removeStorageSync("eventDraft");
        }
        
        wx.showToast({
          title: isUpdate ? "修改成功" : "发布成功",
          icon: "success",
          duration: 2000,
        });
        
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
        
        this.setData({ isUploading: false });
      },
      fail: (error) => {
        wx.hideLoading();
        wx.showToast({
          title: isUpdate ? "修改失败" : "发布失败",
          icon: "none",
          duration: 2000,
        });
        console.error("提交活动失败:", error);
        this.setData({ isUploading: false });
      },
    });
  },

  loadEventFromAPI(eventId, callbacks) {
    wx.request({
      url: `${config.BACKEND_URL}/teacher/event/${eventId}`,
      method: "GET",
      header: {
        Authorization: `Bearer ${getApp().globalData.userInfo?.token || ""}`,
        "Content-Type": "application/json",
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          if (callbacks.success) {
            callbacks.success(res.data.event);
          }
        } else {
          if (callbacks.fail) {
            callbacks.fail(new Error("Failed to load event data"));
          }
        }
      },
      fail: (error) => {
        console.error("Load event API error:", error);
        if (callbacks.fail) {
          callbacks.fail(error);
        }
      },
    });
  },

  submitEventToAPI(formData, isUpdate, callbacks) {
    const url = isUpdate
      ? `${config.BACKEND_URL}/teacher/event/${this.data.eventId}`
      : `${config.BACKEND_URL}/teacher/event`;

    wx.request({
      url: url,
      method: "POST",
      data: formData,
      header: {
        Authorization: `Bearer ${getApp().globalData.userInfo?.token || ""}`,
        "Content-Type": "application/json",
      },
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          if (callbacks.success) {
            callbacks.success(res.data);
          }
        } else {
          if (callbacks.fail) {
            callbacks.fail(
              new Error(
                isUpdate ? "Failed to update event" : "Failed to create event"
              )
            );
          }
        }
      },
      fail: (error) => {
        console.error("Submit event API error:", error);
        if (callbacks.fail) {
          callbacks.fail(error);
        }
      },
    });
  },

  // Utility functions
  formatDateDisplay(date) {
    if (!date) return "请选择日期";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const targetDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    if (targetDate.getTime() === today.getTime()) {
      return "今天";
    } else if (targetDate.getTime() === tomorrow.getTime()) {
      return "明天";
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      const weekday = weekdays[date.getDay()];
      return `${month}月${day}日 ${weekday}`;
    }
  },

  formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  isSameDate(date1, date2) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  },
  // Page lifecycle
  onShow() {
    // Refresh calendar when returning from other pages
    this.initCalendar();
  },

  onHide() {
    // Auto save draft when hiding page
    this.saveDraft();
  },

  onUnload() {
    // Clean up when page unloads
    this.saveDraft();
  },

  // Auto save draft
  saveDraft() {
    // Only save draft for new events, not when editing existing ones
    if (!this.data.eventId && this.hasUnsavedChanges()) {
      wx.setStorageSync("eventDraft", {
        title: this.data.title,
        description: this.data.description,
        allowOtherSchool: this.data.allowOtherSchool,
        allowLimit: this.data.allowLimit,
        limit: this.data.limit,
        timestamp: Date.now(),
      });
    }
  },

  // Load draft
  loadDraft() {
    try {
      const draft = wx.getStorageSync("eventDraft");
      if (draft && Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
        // 24 hours
        wx.showModal({
          title: "提示",
          content: "发现未完成的活动草稿，是否恢复？",
          success: (res) => {
            if (res.confirm) {
              this.setData({
                title: draft.title || "",
                description: draft.description || "",
                allowOtherSchool: draft.allowOtherSchool,
                allowLimit: draft.allowLimit,
                limit: draft.limit || "",
              });
            }
            wx.removeStorageSync("eventDraft");
          },
        });
      }
    } catch (e) {
      console.error("加载草稿失败:", e);
    }
  },
});
