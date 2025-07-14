const { default: config } = require("../../config");
const ucloudUpload = require("../../services/ucloudUpload");

Page({  data: {
    userInfo: getApp().globalData.userInfo || {},
    posts: [],
    loading: false,
    hasMore: true,
    currentTab: 0,
    tabs: ["作品", "喜欢", "收藏", "历史", "联系我们"], // Added contact tab
    age: 0,
    // WeChat linking state
    isWechatLinked: false,
    wechatLinking: false,
    // Profile form data
    profileForm: {
      phone: "",
      // email: "",
      name: "",
      gender: "",
      id_number: "",
      student_number: "",
      faculty: "",
      major: "",
      class: "",
      admissionYear: new Date().getFullYear(),
    },
    // University data
    university: null,
    faculties: [],
    availableMajors: [],
    // Profile editing state
    isEditingProfile: false,
    profileErrors: {},
    // Avatar handling
    selectedAvatar: "",
    avatarFile: null,
    
    // Avatar upload states
    avatarUploading: false,
    avatarUploadProgress: 0,
    avatarUploaded: false,
    avatarUploadError: null,
    avatarUploadUrl: null,
    // Contact form data
    contactForm: {
      title: "",
      description: ""
    },
    // Verification states - original values for comparison
    // originalEmail: "",
    originalPhone: "",
    // emailChanged: false,
    phoneChanged: false,
    // emailVerified: true, // Default to verified
    phoneVerified: true, // Default to verified
    // OTP codes for verification
    // emailOtpCode: ""
    phoneOtpCode: "",
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        loadFailed: "加载失败",
        networkError: "网络错误",
        profileUpdateFailed: "资料更新失败",
        verificationFailed: "验证失败",
        otpSendFailed: "验证码发送失败",
      },
      confirmations: {
        deleteTitle: "删除确认",
        deleteContent: "您确定要删除这个帖子吗？",
        logoutTitle: "退出登录",
        logoutContent: "您确定要退出登录吗？",
      },
      success: {
        deleteSuccess: "删除成功",
        profileUpdateSuccess: "资料更新成功",
        logoutSuccess: "退出成功",
        otpSent: "验证码已发送",
        verificationSuccess: "验证成功",
      },
    },
  },
  onLoad: function (options) {
    const app = getApp();
    this.userInfoHandler = (userInfo) => {
      this.setData({
        userInfo,
        profileForm: this.initializeProfileForm(userInfo),
        selectedAvatar: userInfo?.avatar || "",
      });
      this.checkWechatLinkStatus();
    };
    app.subscribe("userInfo", this.userInfoHandler);

    const userInfo = app.globalData.userInfo || {};
    this.setData({
      userInfo,
      profileForm: this.initializeProfileForm(userInfo),
      selectedAvatar: userInfo?.avatar || "",
    });

    this.calculateAge();
    this.loadPosts();
    this.loadUniversityInfo(); // Load university info including faculties
    this.checkWechatLinkStatus(); // Check WeChat link status
  },

  onUnload: function () {
    const app = getApp();
    app.unsubscribe("userInfo", this.userInfoHandler);
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMorePosts();
    }
  },
  onPullDownRefresh() {
    // Load posts for all tabs since profile tab is removed
    this.refreshPosts();
    wx.stopPullDownRefresh();
  },

  // Initialize profile form with user data
  initializeProfileForm: function (userInfo) {
    const currentYear = new Date().getFullYear();
    const form = {
      phone:
        userInfo?.phone && userInfo.phone.startsWith("+86")
          ? userInfo.phone.substring(3)
          : userInfo?.phone || "",
      // email: userInfo?.email || "",
      name: userInfo?.name || "",
      gender: userInfo?.gender || "",
      id_number: userInfo?.id_number || "",
      student_number: userInfo?.student_number || "",
      faculty: userInfo?.faculty || "",
      major: userInfo?.major || "",
      class: userInfo?.class || "",
      admissionYear:
        userInfo?.admission_year || userInfo?.admissionYear || currentYear,
    };

    // Store original values for verification comparison
    this.setData({
      // originalEmail: form.email,
      originalPhone: form.phone,
      // emailChanged: false,
      phoneChanged: false,
      // emailVerified: true, // Start as verified since unchanged
      phoneVerified: true,
      // emailOtpCode: ""
      phoneOtpCode: "",
    });

    return form;
  },

  // Calculate user age
  calculateAge() {
    if (!this.data.userInfo?.birthday) return;

    const birthday = new Date(this.data.userInfo.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > birthday.getMonth() ||
      (today.getMonth() === birthday.getMonth() &&
        today.getDate() >= birthday.getDate());

    if (!hasHadBirthdayThisYear) {
      age -= 1;
    }

    this.setData({ age });
  },  // Handle tab change
  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentTab: parseInt(index),
      posts: [],
    });

    // Load posts for all tabs since profile tab is removed
    this.loadPosts();
  },

  // Navigate to Profile Page
  navigateToProfile: function() {
    wx.navigateTo({
      url: '/pages/profile/profile',
      fail: (error) => {
        console.error('Failed to navigate to profile page:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // Load university information including faculties
  loadUniversityInfo: function () {
    wx.request({
      url: `${config.BACKEND_URL}/myuniversity`,
      method: "GET",
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          const university = res.data.university;
          this.setData({
            university,
            faculties: university?.faculties || [],
          });

          // Update available majors if faculty is already selected
          if (this.data.profileForm.faculty) {
            this.updateAvailableMajors(this.data.profileForm.faculty);
          }
        }
      },
      fail: () => {
        console.error("Failed to load university info");
        // Set some default data for testing
        this.setData({
          faculties: [
            {
              name: "计算机学院",
              majors: [
                { name: "计算机科学与技术" },
                { name: "软件工程" },
                { name: "网络工程" },
              ],
            },
            {
              name: "商学院",
              majors: [
                { name: "工商管理" },
                { name: "市场营销" },
                { name: "会计学" },
              ],
            },
          ],
        });
      },
    });
  },

  // Handle profile form input changes
  onProfileInputChange: function (e) {
    const { field } = e.currentTarget.dataset;
    let value = e.detail.value;

    // Handle picker values
    if (field === "faculty") {
      const selectedIndex = parseInt(value);
      if (this.data.faculties[selectedIndex]) {
        value = this.data.faculties[selectedIndex].name;
      }
    } else if (field === "major") {
      const selectedIndex = parseInt(value);
      if (this.data.availableMajors[selectedIndex]) {
        value = this.data.availableMajors[selectedIndex].name;
      }
    } else if (field === "admissionYear") {
      value = new Date(value).getFullYear();
    }

    this.setData({
      [`profileForm.${field}`]: value,
      [`profileErrors.${field}`]: false,
    });

    // Check if email or phone changed
    // if (field === "email") {
    //   const emailChanged = value !== this.data.originalEmail;
    //   this.setData({
    //     emailChanged,
    //     emailVerified: !emailChanged, // Auto-verify if unchanged
    //     emailOtpCode: emailChanged ? "" : this.data.emailOtpCode,
    //   });
    // } else if (field === "phone") {
    if (field === "phone") {
      const phoneChanged = value !== this.data.originalPhone;
      this.setData({
        phoneChanged,
        phoneVerified: !phoneChanged, // Auto-verify if unchanged
        phoneOtpCode: phoneChanged ? "" : this.data.phoneOtpCode,
      });
    }

    // Update available majors when faculty changes
    if (field === "faculty") {
      this.updateAvailableMajors(value);
    }
  },

  // Update available majors based on selected faculty
  updateAvailableMajors: function (facultyName) {
    const selectedFaculty = this.data.faculties.find(
      (faculty) => faculty.name === facultyName
    );

    this.setData({
      availableMajors: selectedFaculty ? selectedFaculty.majors || [] : [],
      [`profileForm.major`]: "", // Reset major when faculty changes
    });
  },

  // Handle gender selection
  onGenderChange: function (e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({
      [`profileForm.gender`]: gender,
      [`profileErrors.gender`]: false,
    });
  },

  // Handle avatar selection with background upload
  selectAvatar: function () {
    if (!this.data.isEditingProfile) return;

    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
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
        
        this.setData({
          selectedAvatar: tempFile.tempFilePath,
          avatarFile: tempFile,
          avatarUploading: true,
          avatarUploadProgress: 0,
          avatarUploaded: false,
          avatarUploadError: null,
          avatarUploadUrl: null,
        });
        
        // Start background upload immediately
        this.uploadAvatarInBackground(tempFile);
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

  // Send email verification code
  // sendEmailVerificationCode: function () {
  //   if (!this.data.emailChanged || !this.data.profileForm.email) return;

  //   wx.showLoading({ title: "发送中..." });

  //   wx.request({
  //     url: `${config.BACKEND_URL}/verification/send_email_code`,
  //     method: "POST",
  //     data: {
  //       email: this.data.profileForm.email,
  //     },
  //     header: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
  //     },
  //     success: (res) => {
  //       if (res.statusCode === 200 && res.data.status === "success") {
  //         wx.showToast({
  //           title: this.data.messages.success.otpSent,
  //           icon: "success",
  //         });
  //       } else {
  //         wx.showToast({
  //           title: res.data?.msg || this.data.messages.errors.otpSendFailed,
  //           icon: "none",
  //         });
  //       }
  //     },
  //     fail: () => {
  //       wx.showToast({
  //         title: this.data.messages.errors.networkError,
  //         icon: "none",
  //       });
  //     },
  //     complete: () => {
  //       wx.hideLoading();
  //     },
  //   });
  // },

  // Send phone verification code
  sendPhoneVerificationCode: function () {
    if (!this.data.phoneChanged || !this.data.profileForm.phone) return;

    wx.showLoading({ title: "发送中..." });

    wx.request({
      url: `${config.BACKEND_URL}/verification/send_phone_sms_code`,
      method: "POST",
      data: {
        phone: "+86" + this.data.profileForm.phone,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          wx.showToast({
            title: this.data.messages.success.otpSent,
            icon: "success",
          });
        } else {
          wx.showToast({
            title: res.data?.msg || this.data.messages.errors.otpSendFailed,
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },

  // Handle OTP input for email
  // onEmailOtpInput: function (e) {
  //   this.setData({
  //     emailOtpCode: e.detail.value,
  //   });
  // },

  // Handle OTP input for phone
  onPhoneOtpInput: function (e) {
    this.setData({
      phoneOtpCode: e.detail.value,
    });
  },

  // Verify email with OTP code
  // verifyEmailCode: function () {
  //   if (!this.data.emailOtpCode || !this.data.profileForm.email) {
  //     wx.showToast({
  //       title: "请输入验证码",
  //       icon: "none",
  //     });
  //     return;
  //   }

  //   wx.showLoading({ title: "验证中..." });

  //   wx.request({
  //     url: `${config.BACKEND_URL}/verification/verify_email_code`,
  //     method: "POST",
  //     data: {
  //       email: this.data.profileForm.email,
  //       code: this.data.emailOtpCode,
  //     },
  //     header: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
  //     },
  //     success: (res) => {
  //       if (res.statusCode === 200 && res.data.status === "success") {
  //         this.setData({
  //           emailVerified: true,
  //           [`profileErrors.email`]: false,
  //         });
  //         wx.showToast({
  //           title: this.data.messages.success.verificationSuccess,
  //           icon: "success",
  //         });
  //       } else {
  //         wx.showToast({
  //           title:
  //             res.data?.msg || this.data.messages.errors.verificationFailed,
  //           icon: "none",
  //         });
  //       }
  //     },
  //     fail: () => {
  //       wx.showToast({
  //         title: this.data.messages.errors.networkError,
  //         icon: "none",
  //       });
  //     },
  //     complete: () => {
  //       wx.hideLoading();
  //     },
  //   });
  // },

  // Verify phone with OTP code
  verifyPhoneCode: function () {
    if (!this.data.phoneOtpCode || !this.data.profileForm.phone) {
      wx.showToast({
        title: "请输入验证码",
        icon: "none",
      });
      return;
    }

    wx.showLoading({ title: "验证中..." });

    wx.request({
      url: `${config.BACKEND_URL}/verification/verify_phone_sms_code`,
      method: "POST",
      data: {
        phone: "+86" + this.data.profileForm.phone,
        code: this.data.phoneOtpCode,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          this.setData({
            phoneVerified: true,
            [`profileErrors.phone`]: false,
          });
          wx.showToast({
            title: this.data.messages.success.verificationSuccess,
            icon: "success",
          });
        } else {
          wx.showToast({
            title:
              res.data?.msg || this.data.messages.errors.verificationFailed,
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },

  // Toggle profile editing mode
  toggleProfileEdit: function () {
    this.setData({
      isEditingProfile: !this.data.isEditingProfile,
      profileErrors: {},
    });
  },

  // Validate profile form
  validateProfileForm: function () {
    const { profileForm } = this.data;
    let errors = {};

    if (!profileForm.name) errors.name = "姓名为必填项";
    if (!profileForm.gender) errors.gender = "性别为必填项";
    if (!profileForm.id_number) errors.id_number = "身份证号为必填项";
    if (!profileForm.student_number) errors.student_number = "学号为必填项";
    if (!profileForm.faculty) errors.faculty = "学院为必填项";
    if (!profileForm.major) errors.major = "专业为必填项";
    if (!profileForm.class) errors.class = "班级为必填项";

    // Only validate changed email/phone if verification is required
    // if (this.data.emailChanged && !this.data.emailVerified) {
    //   errors.email = "请验证邮箱";
    // }
    if (this.data.phoneChanged && !this.data.phoneVerified) {
      errors.phone = "请验证手机号";
    }

    // Email validation
    // if (profileForm.email && !/\S+@\S+\.\S+/.test(profileForm.email)) {
    //   errors.email = "邮箱格式不正确";
    // }

    // Phone validation
    if (profileForm.phone && !/\d{11}$/.test(profileForm.phone)) {
      errors.phone = "手机号格式不正确";
    }

    return errors;
  },

  // Save profile changes
  saveProfile: function () {
    const errors = this.validateProfileForm();

    if (Object.keys(errors).length > 0) {
      this.setData({ profileErrors: errors });
      return;
    }

    wx.showLoading({
      title: "保存中...",
    });

    // Prepare form data
    const formData = {
      ...this.data.profileForm,
      phone: "+86" + this.data.profileForm.phone,
      admission_year: this.data.profileForm.admissionYear,
    };

    // If avatar was changed, handle file upload separately
    if (this.data.avatarFile) {
      this.uploadAvatarAndUpdateProfile(formData);
    } else {
      this.updateProfile(formData);
    }
  },

  // Upload avatar and update profile
  uploadAvatarAndUpdateProfile: function (formData) {
    wx.uploadFile({
      url: `${config.BACKEND_URL}/user/upload_avatar`,
      filePath: this.data.avatarFile,
      name: "avatar",
      header: {
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        const data = JSON.parse(res.data);
        if (data.status === "success") {
          formData.avatar_url = data.avatar_url;
          this.updateProfile(formData);
        } else {
          wx.hideLoading();
          wx.showToast({
            title: "头像上传失败",
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: "头像上传失败",
          icon: "none",
        });
      },
    });
  },

  // Update profile
  updateProfile: function (formData) {
    wx.request({
      url: `${config.BACKEND_URL}/user/update_user`,
      method: "POST",
      data: formData,
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          const updatedUserInfo = res.data.user;

          this.setData({
            userInfo: { ...this.data.userInfo, ...updatedUserInfo },
            isEditingProfile: false,
            profileErrors: {},
            avatarFile: null,
            selectedAvatar: updatedUserInfo?.avatar || "",
            // emailOtpCode: ""
            phoneOtpCode: "",
          });

          getApp().setState("userInfo", {
            ...this.data.userInfo,
            ...updatedUserInfo,
          });
          wx.setStorageSync("userInfo", {
            ...this.data.userInfo,
            ...updatedUserInfo,
          });

          wx.showToast({
            title: this.data.messages.success.profileUpdateSuccess,
            icon: "success",
          });
        } else {
          wx.showToast({
            title:
              res.data?.msg || this.data.messages.errors.profileUpdateFailed,
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },

  // Cancel profile editing
  cancelProfileEdit: function () {
    this.setData({
      isEditingProfile: false,
      profileForm: this.initializeProfileForm(this.data.userInfo),
      profileErrors: {},
      selectedAvatar: this.data.userInfo?.avatar || "",
      avatarFile: null,
      // emailOtpCode: ""
      phoneOtpCode: "",
    });
  },

  // Handle logout
  handleLogout: function () {
    wx.showModal({
      title: this.data.messages.confirmations.logoutTitle,
      content: this.data.messages.confirmations.logoutContent,
      success: (res) => {
        if (res.confirm) {
          this.performLogout();
        }
      },
    });
  },

  // Perform logout
  performLogout: function () {
    wx.showLoading({
      title: "退出中...",
    });

    // Clear local storage
    wx.removeStorageSync("userInfo");

    // Clear global data
    getApp().setState("userInfo", null);

    // Disconnect socket if exists
    if (getApp().globalData.socketManager) {
      getApp().globalData.socketManager.disconnect();
    }

    // Clear this page's data
    this.setData({
      userInfo: {},
      posts: [],
      profileForm: this.initializeProfileForm({}),
    });

    wx.hideLoading();

    wx.showToast({
      title: this.data.messages.success.logoutSuccess,
      icon: "success",
    });

    // Navigate to login or home page after a delay
    setTimeout(() => {
      wx.reLaunch({
        url: "/pages/index/index",
      });
    }, 1500);
  },
  // Load posts based on current tab
  async loadPosts() {
    this.setData({ loading: true });

    try {
      wx.request({
        url: `${config.BACKEND_URL}/post/get_posts?scope=15&${
          this.data.currentTab == 0 && "user_id="
        }${this.data.currentTab == 0 ? this.data.userInfo?.id : ""}&isLike=${
          this.data.currentTab == 1
        }&isFavorite=${this.data.currentTab == 2}&isHistory=${
          this.data.currentTab == 3
        }`,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
        },
        method: "GET",
        success: (res) => {
          if (res.data && res.data.status === "success") {
            this.setData({
              posts: this.data.posts.concat(res.data.posts),
              loading: false,
              hasMore: res.data.has_more || false,
            });
          } else {
            this.setData({ hasMore: false, loading: false });
          }
        },
        fail: () => {
          this.setData({ loading: false });
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        },
      });
    } catch (error) {
      console.error("Failed to load posts:", error);
      this.setData({ loading: false });
    }
  },
  // Load more posts for pagination
  async loadMorePosts() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const requestData = {
        scope: "15",
      };

      // Add user_id for user posts tab
      if (this.data.currentTab == 0) {
        requestData.user_id = this.data.userInfo?.id;
      }

      // Add filter parameters
      requestData.isLike = this.data.currentTab == 1;
      requestData.isFavorite = this.data.currentTab == 2;
      requestData.isHistory = this.data.currentTab == 3;

      // Add exist_post_ids for pagination
      if (this.data.posts.length > 0) {
        requestData.exist_post_ids = this.data.posts.map((post) => post.id);
      }

      // Convert to query string
      const queryParams = new URLSearchParams();
      Object.keys(requestData).forEach((key) => {
        if (Array.isArray(requestData[key])) {
          requestData[key].forEach((item) => queryParams.append(key, item));
        } else {
          queryParams.append(key, requestData[key]);
        }
      });

      wx.request({
        url: `${config.BACKEND_URL}/post/get_posts?${queryParams.toString()}`,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
        },
        method: "GET",
        success: (res) => {
          if (res.data && res.data.status === "success") {
            this.setData({
              posts: this.data.posts.concat(res.data.posts || []),
              loading: false,
              hasMore: res.data.has_more || false,
            });
          } else {
            this.setData({ hasMore: false, loading: false });
          }
        },
        fail: () => {
          this.setData({ loading: false });
        },
      });
    } catch (error) {
      this.setData({ loading: false });
    }
  },

  // Refresh posts
  async refreshPosts() {
    this.setData({ posts: [] });
    await this.loadPosts();
    wx.stopPullDownRefresh();
  },

  // Handle delete post confirmation
  onDeletePost(e) {
    const postId = e.currentTarget.dataset.id;

    wx.showModal({
      title: this.data.messages.confirmations.deleteTitle,
      content: this.data.messages.confirmations.deleteContent,
      success: (res) => {
        if (res.confirm) {
          this.deletePost(postId);
        }
      },
    });
  },

  // Delete post
  deletePost(postId) {
    try {
      wx.request({
        url: `${config.BACKEND_URL}/post/delete_my_post?id=${postId}`,
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
        },
        method: "DELETE",
        success: (res) => {
          if (res.data && res.data.status === "success") {
            const posts = this.data.posts.filter((post) => post.id !== postId);
            this.setData({ posts });

            wx.showToast({
              title: this.data.messages.success.deleteSuccess,
              icon: "success",
            });
          } else {
            if (res.data.msg)
              wx.showToast({
                title: res.data.msg,
                icon: "error",
              });
          }
        },
        fail: () => {
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
        },
      });
    } catch (error) {
      console.error("Error deleting post:", error);
      wx.showToast({
        title: this.data.messages.errors.loadFailed,
        icon: "none",
      });
    }
  },

  // Scroll to top
  scrollToTop() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300,
    });
  },
  onPostTap: function (e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?postId=${postId}`,
    });
  },

  // WeChat linking functionality
  async linkWechat() {
    if (this.data.wechatLinking) return;

    try {
      this.setData({ wechatLinking: true });

      // Get WeChat login code
      const loginResult = await this.promiseWrapper(wx.login);
      if (!loginResult.code) {
        throw new Error('获取微信授权码失败');
      }

      // Send link request to backend
      const response = await this.requestWechatLink(loginResult.code);
      
      if (response.status === 'success') {
        // Update user info with WeChat data
        const app = getApp();
        const updatedUserInfo = { ...this.data.userInfo, ...response.user };
        app.setUserInfo(updatedUserInfo);
        
        this.setData({ 
          userInfo: updatedUserInfo,
          isWechatLinked: true 
        });
        
        wx.showToast({
          title: '微信绑定成功',
          icon: 'success'
        });
      } else {
        throw new Error(response.msg || '绑定失败');
      }
    } catch (error) {
      console.error('WeChat linking error:', error);
      wx.showToast({
        title: error.message || '微信绑定失败',
        icon: 'none'
      });
    } finally {
      this.setData({ wechatLinking: false });
    }
  },

  async unlinkWechat() {
    try {
      const result = await this.showConfirmDialog(
        '解除绑定',
        '确定要解除微信绑定吗？解除后您将无法使用微信登录。'
      );
      
      if (!result.confirm) return;

      const response = await this.requestWechatUnlink();
      
      if (response.status === 'success') {
        // Update user info
        const app = getApp();
        const updatedUserInfo = { 
          ...this.data.userInfo, 
          wechat_openid: null,
          wechat_unionid: null 
        };
        app.setUserInfo(updatedUserInfo);
        
        this.setData({ 
          userInfo: updatedUserInfo,
          isWechatLinked: false 
        });
        
        wx.showToast({
          title: '解除绑定成功',
          icon: 'success'
        });
      } else {
        throw new Error(response.msg || '解除绑定失败');
      }
    } catch (error) {
      console.error('WeChat unlinking error:', error);
      wx.showToast({
        title: error.message || '解除绑定失败',
        icon: 'none'
      });
    }
  },

  // API calls for WeChat linking
  requestWechatLink(code) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/user/link-wechat`,
        method: 'POST',
        data: { code },
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.data.userInfo.token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.msg || '请求失败'));
          }
        },
        fail: reject
      });
    });
  },

  requestWechatUnlink() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/user/unlink-wechat`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.data.userInfo.token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.msg || '请求失败'));
          }
        },
        fail: reject
      });
    });
  },

  // Utility methods
  promiseWrapper(fn, options = {}) {
    return new Promise((resolve, reject) => {
      fn({
        ...options,
        success: resolve,
        fail: reject
      });
    });
  },

  showConfirmDialog(title, content) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        success: resolve
      });
    });
  },

  // Check WeChat link status on load
  checkWechatLinkStatus() {
    const { userInfo } = this.data;
    const isLinked = !!(userInfo?.wechat_openid);
    this.setData({ isWechatLinked: isLinked });
  },

  // Navigate to Profile Page
  navigateToProfile: function() {
    wx.navigateTo({
      url: '/pages/profile/profile',
      fail: (error) => {
        console.error('Failed to navigate to profile page:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  // Background upload avatar to UCloud
  async uploadAvatarInBackground(tempFile) {
    console.log("Starting background avatar upload:", tempFile);
    
    try {
      // Progress callback
      const progressCallback = (progress) => {
        this.setData({
          avatarUploadProgress: progress
        });
      };
      
      // Use uploadImageSimple for direct upload without blur
      console.log("Uploading avatar image...");
      const uploadResult = await ucloudUpload.uploadImageSimple(
        tempFile.tempFilePath,
        progressCallback,
        'student_avatars'  // upload folder
      );
      
      console.log("Avatar upload result:", uploadResult);
      
      if (uploadResult && uploadResult.url) {
        this.setData({
          avatarUploading: false,
          avatarUploaded: true,
          avatarUploadUrl: uploadResult.url,
          avatarUploadError: null
        });
        
        wx.showToast({
          title: "头像上传成功",
          icon: "success",
          duration: 1500
        });
      } else {
        throw new Error("上传结果无效");
      }
    } catch (error) {
      console.error("Avatar upload failed:", error);
      
      this.setData({
        avatarUploading: false,
        avatarUploaded: false,
        avatarUploadUrl: null,
        avatarUploadError: error.message || "上传失败"
      });
      
      wx.showToast({
        title: "头像上传失败",
        icon: "none",
        duration: 2000
      });
    }
  },
  
  // Wait for avatar upload to complete
  waitForAvatarUpload() {
    return new Promise((resolve) => {
      const checkInterval = 100;
      const maxWaitTime = 30000; // 30 seconds
      let waitTime = 0;
      
      const check = () => {
        if (this.data.avatarUploaded || this.data.avatarUploadError) {
          resolve();
        } else if (waitTime >= maxWaitTime) {
          this.setData({
            avatarUploading: false,
            avatarUploadError: "上传超时"
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

  // Contact form handlers
  onContactInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`contactForm.${field}`]: value
    });
  },

  async submitContact() {
    const { title, description } = this.data.contactForm;
    
    if (!title || !description) {
      wx.showToast({
        title: '请填写标题和描述',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    try {
      const res = await wx.request({
        url: config.BASE_URL + '/api/add-contact',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + wx.getStorageSync('token')
        },
        data: {
          title,
          description
        }
      });

      if (res.data.status === 'success') {
        wx.showToast({
          title: '提交成功',
          icon: 'success'
        });
        
        // Clear form
        this.setData({
          contactForm: {
            title: '',
            description: ''
          }
        });
      } else {
        throw new Error(res.data.message || '提交失败');
      }
    } catch (error) {
      console.error('Submit contact error:', error);
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },
});
