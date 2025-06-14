const { default: config } = require("../../config");

Page({
  data: {
    userInfo: getApp().globalData.userInfo || {},
    // Profile form data
    profileForm: {
      phone: "",
      email: "",
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
    // Verification states - original values for comparison
    originalEmail: "",
    originalPhone: "",
    emailChanged: false,
    phoneChanged: false,
    emailVerified: true, // Default to verified
    phoneVerified: true, // Default to verified
    // OTP codes for verification
    emailOtpCode: "",
    phoneOtpCode: "",
    // WeChat linking state
    isWechatLinked: false,
    wechatLinking: false,
    // Chinese messages for UI text
    messages: {
      loading: "加载中...",
      errors: {
        networkError: "网络错误",
        profileUpdateFailed: "资料更新失败",
        verificationFailed: "验证失败",
        otpSendFailed: "验证码发送失败",
      },
      confirmations: {
        logoutTitle: "退出登录",
        logoutContent: "您确定要退出登录吗？",
      },
      success: {
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

    this.loadUniversityInfo();
    this.checkWechatLinkStatus();
  },

  onUnload: function () {
    const app = getApp();
    app.unsubscribe("userInfo", this.userInfoHandler);
  },

  // Initialize profile form with user data
  initializeProfileForm: function (userInfo) {
    const currentYear = new Date().getFullYear();
    const form = {
      phone:
        userInfo?.phone && userInfo.phone.startsWith("+86")
          ? userInfo.phone.substring(3)
          : userInfo?.phone || "",
      email: userInfo?.email || "",
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
      originalEmail: form.email,
      originalPhone: form.phone,
      emailChanged: false,
      phoneChanged: false,
      emailVerified: true,
      phoneVerified: true,
      emailOtpCode: "",
      phoneOtpCode: "",
    });

    return form;
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

          if (this.data.profileForm.faculty) {
            this.updateAvailableMajors(this.data.profileForm.faculty);
          }
        }
      },
      fail: () => {
        console.error("Failed to load university info");
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
    if (field === "email") {
      const emailChanged = value !== this.data.originalEmail;
      this.setData({
        emailChanged,
        emailVerified: !emailChanged,
        emailOtpCode: emailChanged ? "" : this.data.emailOtpCode,
      });
    } else if (field === "phone") {
      const phoneChanged = value !== this.data.originalPhone;
      this.setData({
        phoneChanged,
        phoneVerified: !phoneChanged,
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
      [`profileForm.major`]: "",
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

  // Handle avatar selection
  selectAvatar: function () {
    if (!this.data.isEditingProfile) return;

    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          selectedAvatar: tempFilePath,
          avatarFile: tempFilePath,
        });
      },
      fail: () => {
        wx.showToast({
          title: "选择图片失败",
          icon: "none",
        });
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
    if (this.data.emailChanged && !this.data.emailVerified) {
      errors.email = "请验证邮箱";
    }
    if (this.data.phoneChanged && !this.data.phoneVerified) {
      errors.phone = "请验证手机号";
    }

    // Email validation
    if (profileForm.email && !/\S+@\S+\.\S+/.test(profileForm.email)) {
      errors.email = "邮箱格式不正确";
    }

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
            emailOtpCode: "",
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
      emailOtpCode: "",
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

  // Send email verification code
  sendEmailVerificationCode: function () {
    if (!this.data.emailChanged || !this.data.profileForm.email) return;

    wx.showLoading({ title: "发送中..." });

    wx.request({
      url: `${config.BACKEND_URL}/verification/send_email_code`,
      method: "POST",
      data: {
        email: this.data.profileForm.email,
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
  onEmailOtpInput: function (e) {
    this.setData({
      emailOtpCode: e.detail.value,
    });
  },

  // Handle OTP input for phone
  onPhoneOtpInput: function (e) {
    this.setData({
      phoneOtpCode: e.detail.value,
    });
  },

  // Verify email with OTP code
  verifyEmailCode: function () {
    if (!this.data.emailOtpCode || !this.data.profileForm.email) {
      wx.showToast({
        title: "请输入验证码",
        icon: "none",
      });
      return;
    }

    wx.showLoading({ title: "验证中..." });

    wx.request({
      url: `${config.BACKEND_URL}/verification/verify_email_code`,
      method: "POST",
      data: {
        email: this.data.profileForm.email,
        code: this.data.emailOtpCode,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          this.setData({
            emailVerified: true,
            [`profileErrors.email`]: false,
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

  // WeChat linking functionality
  async linkWechat() {
    if (this.data.wechatLinking) return;

    try {
      this.setData({ wechatLinking: true });

      const loginResult = await this.promiseWrapper(wx.login);
      if (!loginResult.code) {
        throw new Error('获取微信授权码失败');
      }

      const response = await this.requestWechatLink(loginResult.code);
      
      if (response.status === 'success') {
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
});
