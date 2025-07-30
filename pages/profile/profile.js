const { default: config } = require("../../config");
const ucloudUpload = require("../../services/ucloudUpload");

Page({
  data: {
    userInfo: getApp().globalData.userInfo || {},
    // Profile form data
    profileForm: {
      phone: "",
      email: "",
      name: "",
      nickname: "",
      gender: "",
      id_number: "",
      student_number: "",
      faculty: "",
      major: "",
      class: "",
      admissionYear: new Date().getFullYear(),
      birthday: "",
    },
    // University data
    university: null,
    faculties: [],
    availableMajors: [],
    majorIndex: -1,
    // Profile editing state
    isEditingProfile: false,
    facultyIndex: -1,
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
    
    // Countdown for SMS resend
    phoneCountdown: 0,
    emailCountdown: 0,
    
    // Verification messages
    emailVerificationMessage: "",
    emailVerificationError: "",
    phoneVerificationMessage: "",
    phoneVerificationError: "",
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
      nickname: userInfo?.nickname || "",
      gender: userInfo?.gender || "",
      id_number: userInfo?.id_number || "",
      student_number: userInfo?.student_number || "",
      faculty: userInfo?.faculty || "",
      major: userInfo?.major || "",
      class: userInfo?.class || "",
      admissionYear:
        userInfo?.admission_year || userInfo?.admissionYear || currentYear,
      birthday: userInfo?.birthday || "",
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
          const faculties = university?.faculties || [];
          
          // Find faculty index
          let facultyIndex = -1;
          if (this.data.profileForm.faculty) {
            facultyIndex = faculties.findIndex(
              (faculty) => faculty.name === this.data.profileForm.faculty
            );
          }
          
          this.setData({
            university,
            faculties,
            facultyIndex,
          });

          if (this.data.profileForm.faculty) {
            this.updateAvailableMajors(this.data.profileForm.faculty);
          } else {
            this.setData({ majorIndex: -1 });
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
        this.setData({ facultyIndex: selectedIndex });
      }
    } else if (field === "major") {
      const selectedIndex = parseInt(value);
      if (this.data.availableMajors[selectedIndex]) {
        value = this.data.availableMajors[selectedIndex].name;
        this.setData({ majorIndex: selectedIndex });
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

    const availableMajors = selectedFaculty ? selectedFaculty.majors || [] : [];
    let majorIndex = -1;
    let currentMajor = this.data.profileForm.major;
    
    // If user already has a major, try to find it in the new faculty
    if (currentMajor) {
      majorIndex = availableMajors.findIndex(
        (major) => major.name === currentMajor
      );
      
      // If major not found in new faculty, clear it
      if (majorIndex === -1) {
        currentMajor = "";
      }
    }

    this.setData({
      availableMajors,
      majorIndex,
      [`profileForm.major`]: currentMajor,
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

    // All fields are now required
    if (!profileForm.name) errors.name = "姓名为必填项";
    if (!profileForm.email) errors.email = "邮箱为必填项";
    if (!profileForm.phone) errors.phone = "手机号为必填项";
    
    // Validate nickname (required field)
    if (!profileForm.nickname) {
      errors.nickname = "昵称为必填项";
    } else if (profileForm.nickname.length > 50) {
      errors.nickname = "昵称不能超过50个字符";
    }
    
    if (!profileForm.gender) errors.gender = "性别为必填项";
    if (!profileForm.id_number) errors.id_number = "身份证号为必填项";
    if (!profileForm.student_number) errors.student_number = "学号为必填项";
    if (!profileForm.faculty) errors.faculty = "学院为必填项";
    if (!profileForm.major) errors.major = "专业为必填项";
    if (!profileForm.class) errors.class = "班级为必填项";
    if (!profileForm.admissionYear) errors.admissionYear = "入学年份为必填项";
    if (!profileForm.birthday) errors.birthday = "生日为必填项";

    // Verify phone if it's been changed
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

  // Scroll to first error field
  scrollToErrorField: function(errorKey) {
    // Create a mapping of error keys to selector IDs
    const fieldMap = {
      name: 'name-field',
      nickname: 'nickname-field',
      phone: 'phone-field',
      email: 'email-field',
      gender: 'gender-field',
      id_number: 'id-number-field',
      student_number: 'student-number-field',
      faculty: 'faculty-field',
      major: 'major-field',
      class: 'class-field',
      admissionYear: 'admission-year-field',
      birthday: 'birthday-field'
    };

    const selector = fieldMap[errorKey];
    if (selector) {
      // Create a query to get the element position
      const query = wx.createSelectorQuery();
      query.select(`#${selector}`).boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec((res) => {
        if (res[0] && res[1]) {
          // Scroll to the element with some offset
          wx.pageScrollTo({
            scrollTop: res[0].top + res[1].scrollTop - 100,
            duration: 300
          });
        }
      });
    }
  },

  // Save profile changes
  saveProfile: function () {
    try {
      // Prevent duplicate saves
      if (this.isSaving) {
        wx.showToast({
          title: "正在保存中，请稍候...",
          icon: "none",
          duration: 1500
        });
        return;
      }

      // Validate token first
      const userInfo = getApp().globalData.userInfo;
      if (!userInfo || !userInfo.token) {
        wx.showToast({
          title: "登录状态已过期，请重新登录",
          icon: "none",
          duration: 2000
        });
        // Redirect to login or refresh token
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/register/register' });
        }, 2000);
        return;
      }

      // Form validation
      const errors = this.validateProfileForm();
      if (Object.keys(errors).length > 0) {
        this.setData({ profileErrors: errors });
        
        // Show error toast with detailed message
        const firstError = Object.values(errors)[0];
        const firstErrorKey = Object.keys(errors)[0];
        wx.showToast({
          title: `保存失败: ${firstError}`,
          icon: 'none',
          duration: 3000
        });
        
        // Scroll to first error field
        this.scrollToErrorField(firstErrorKey);
        return;
      }

      // Check required data integrity
      if (!this.data.profileForm.phone || !this.data.profileForm.name) {
        wx.showToast({
          title: "保存失败: 缺少必要信息",
          icon: "none",
          duration: 2000
        });
        return;
      }

      // Set saving flag
      this.isSaving = true;

      // Check if avatar is still uploading
      if (this.data.avatarUploading) {
        wx.showLoading({
          title: "等待头像上传完成...",
          mask: true,
        });
        
        // Wait for upload to complete with timeout
        this.waitForAvatarUpload()
          .then(() => {
            wx.hideLoading();
            if (this.data.avatarUploadError) {
              wx.showToast({
                title: `头像上传失败: ${this.data.avatarUploadError}`,
                icon: "none",
                duration: 2000,
              });
              this.isSaving = false;
            } else if (this.data.avatarUploadUrl) {
              this.saveProfileWithAvatar();
            } else {
              wx.showToast({
                title: "头像上传失败，请重新选择头像",
                icon: "none",
                duration: 2000,
              });
              this.isSaving = false;
            }
          })
          .catch((error) => {
            wx.hideLoading();
            wx.showToast({
              title: `头像上传超时: ${error.message || '请重试'}`,
              icon: "none",
              duration: 2000,
            });
            this.isSaving = false;
          });
      } else {
        this.saveProfileWithAvatar();
      }
    } catch (error) {
      this.isSaving = false;
      wx.showToast({
        title: `保存失败: ${error.message || '未知错误'}`,
        icon: "none",
        duration: 2000
      });
    }
  },
  
  // Save profile with avatar URL
  saveProfileWithAvatar: function () {
    try {
      wx.showLoading({
        title: "保存中...",
        mask: true
      });

      // Validate data before sending
      if (!this.data.profileForm.phone) {
        throw new Error("手机号不能为空");
      }

      if (!this.data.profileForm.name) {
        throw new Error("姓名不能为空");
      }

      // Prepare form data with validation
      const formData = {
        ...this.data.profileForm,
        phone: this.data.profileForm.phone.startsWith("+86") 
          ? this.data.profileForm.phone 
          : "+86" + this.data.profileForm.phone,
        admission_year: this.data.profileForm.admissionYear,
        birthday: this.data.profileForm.birthday,
      };
      
      // Validate phone format after adding prefix
      if (!/^\+86\d{11}$/.test(formData.phone)) {
        throw new Error("手机号格式不正确");
      }
      
      // Add avatar URL if uploaded
      if (this.data.avatarUploadUrl) {
        formData.avatar_url = this.data.avatarUploadUrl;
      }

      this.updateProfile(formData);
    } catch (error) {
      wx.hideLoading();
      this.isSaving = false;
      wx.showToast({
        title: `数据准备失败: ${error.message}`,
        icon: "none",
        duration: 2000
      });
    }
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
        'avatars'  // upload folder
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

  // Update profile
  updateProfile: function (formData) {
    const requestTimeout = 15000; // 15 second timeout
    let timeoutId;

    // Set up timeout
    timeoutId = setTimeout(() => {
      wx.hideLoading();
      this.isSaving = false;
      wx.showToast({
        title: "请求超时，请检查网络连接",
        icon: "none",
        duration: 3000
      });
    }, requestTimeout);

    wx.request({
      url: `${config.BACKEND_URL}/user/update_user`,
      method: "POST",
      data: formData,
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      timeout: requestTimeout,
      success: (res) => {
        clearTimeout(timeoutId);
        
        try {
          // Check response status
          if (res.statusCode === 401) {
            wx.showToast({
              title: "登录已过期，请重新登录",
              icon: "none",
              duration: 2000
            });
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/register/register' });
            }, 2000);
            return;
          }

          if (res.statusCode === 422) {
            const errorMsg = res.data?.message || "数据验证失败";
            wx.showToast({
              title: `保存失败: ${errorMsg}`,
              icon: "none",
              duration: 3000
            });
            return;
          }

          if (res.statusCode !== 200) {
            wx.showToast({
              title: `服务器错误 (${res.statusCode}): ${res.data?.message || '请稍后重试'}`,
              icon: "none",
              duration: 3000
            });
            return;
          }

          // Check response data
          if (!res.data || res.data.status !== "success") {
            wx.showToast({
              title: `保存失败: ${res.data?.message || res.data?.msg || '服务器返回异常'}`,
              icon: "none",
              duration: 3000
            });
            return;
          }

          // Success case
          const updatedUserInfo = res.data.user;
          if (!updatedUserInfo) {
            wx.showToast({
              title: "保存失败: 服务器未返回用户信息",
              icon: "none",
              duration: 2000
            });
            return;
          }

          // Update local state
          this.setData({
            userInfo: { ...this.data.userInfo, ...updatedUserInfo },
            isEditingProfile: false,
            profileErrors: {},
            avatarFile: null,
            selectedAvatar: updatedUserInfo?.avatar || "",
            emailOtpCode: "",
            phoneOtpCode: "",
          });

          // Update global state
          const mergedUserInfo = { ...this.data.userInfo, ...updatedUserInfo };
          getApp().setState("userInfo", mergedUserInfo);
          wx.setStorageSync("userInfo", mergedUserInfo);

          // Show success message
          wx.showToast({
            title: "保存成功！",
            icon: "success",
            duration: 2000
          });

        } catch (error) {
          wx.showToast({
            title: `处理响应失败: ${error.message}`,
            icon: "none",
            duration: 2000
          });
        }
      },
      fail: (error) => {
        clearTimeout(timeoutId);
        
        let errorMessage = "网络连接失败";
        if (error.errMsg) {
          if (error.errMsg.includes("timeout")) {
            errorMessage = "请求超时，请检查网络";
          } else if (error.errMsg.includes("fail")) {
            errorMessage = "网络请求失败，请重试";
          } else {
            errorMessage = `网络错误: ${error.errMsg}`;
          }
        }
        
        wx.showToast({
          title: errorMessage,
          icon: "none",
          duration: 3000
        });
      },
      complete: () => {
        clearTimeout(timeoutId);
        wx.hideLoading();
        this.isSaving = false;
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
      // emailOtpCode: "",
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

    // Check if countdown is active
    if (this.data.emailCountdown > 0) {
      return;
    }

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
          // Always start countdown regardless of alert or new code
          this.startEmailCountdown();
          
          // Check if it's an alert (existing code) or new code sent
          if (res.data.alert) {
            // Display alert in green
            this.setData({
              emailVerificationMessage: res.data.alert,
              emailVerificationError: ""
            });
            // Clear success message after 8 seconds
            setTimeout(() => {
              this.setData({ emailVerificationMessage: "" });
            }, 8000);
          } else {
            // Normal success - new code sent
            this.setData({
              emailVerificationMessage: res.data?.msg || "验证码已发送到您的邮箱",
              emailVerificationError: ""
            });
            // Clear success message after 5 seconds
            setTimeout(() => {
              this.setData({ emailVerificationMessage: "" });
            }, 5000);
          }
        } else {
          this.setData({
            emailVerificationError: res.data?.msg || "验证码发送失败，请检查邮箱地址",
            emailVerificationMessage: ""
          });
        }
      },
      fail: () => {
        this.setData({
          emailVerificationError: "网络错误，请稍后重试",
          emailVerificationMessage: ""
        });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },

  // Start email countdown timer
  startEmailCountdown: function() {
    this.setData({ emailCountdown: 60 });

    const timer = setInterval(() => {
      const { emailCountdown } = this.data;
      if (emailCountdown <= 1) {
        clearInterval(timer);
        this.setData({ emailCountdown: 0 });
      } else {
        this.setData({ emailCountdown: emailCountdown - 1 });
      }
    }, 1000);
  },

  // Start countdown timer
  startCountdown: function() {
    this.setData({ phoneCountdown: 60 });

    const timer = setInterval(() => {
      const { phoneCountdown } = this.data;
      if (phoneCountdown <= 1) {
        clearInterval(timer);
        this.setData({ phoneCountdown: 0 });
      } else {
        this.setData({ phoneCountdown: phoneCountdown - 1 });
      }
    }, 1000);
  },

  // Send phone verification code
  sendPhoneVerificationCode: function () {
    if (!this.data.phoneChanged || !this.data.profileForm.phone) return;

    // Check if countdown is active
    if (this.data.phoneCountdown > 0) {
      return;
    }

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
          // Always start countdown regardless of alert or new code
          this.startCountdown();
          
          // Check if it's an alert (existing code) or new code sent
          if (res.data.alert) {
            // Display alert in green
            this.setData({
              phoneSuccessMessage: res.data.alert,
              phoneErrorMessage: ""
            });
            // Clear success message after 8 seconds
            setTimeout(() => {
              this.setData({ phoneSuccessMessage: "" });
            }, 8000);
          } else {
            // Normal success - new code sent
            this.setData({
              phoneSuccessMessage: res.data?.msg || this.data.messages.success.otpSent,
              phoneErrorMessage: ""
            });
            // Clear success message after 5 seconds
            setTimeout(() => {
              this.setData({ phoneSuccessMessage: "" });
            }, 5000);
          }
        } else {
          this.setData({
            phoneErrorMessage: res.data?.msg || this.data.messages.errors.otpSendFailed,
            phoneSuccessMessage: ""
          });
        }
      },
      fail: () => {
        this.setData({
          phoneErrorMessage: this.data.messages.errors.networkError,
          phoneSuccessMessage: ""
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
            emailVerificationMessage: "邮箱验证成功！",
            emailVerificationError: ""
          });
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.setData({ emailVerificationMessage: "" });
          }, 3000);
        } else {
          this.setData({
            emailVerificationError: res.data?.msg || "验证码错误或已过期",
            emailVerificationMessage: ""
          });
        }
      },
      fail: () => {
        this.setData({
          emailVerificationError: "网络错误，请稍后重试",
          emailVerificationMessage: ""
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
