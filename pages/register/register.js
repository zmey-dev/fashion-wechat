const { default: config } = require("../../config");

Page({
  // Utility function to ensure phone has +86 prefix
  ensureCountryCode: function(phoneNumber) {
    if (!phoneNumber) return phoneNumber;
    
    // Remove all spaces and non-digit characters except + 
    const cleaned = phoneNumber.replace(/[^\d+]/g, "");
    
    // If already starts with +86, return as is
    if (cleaned.startsWith('+86')) {
      return cleaned;
    }
    
    // If starts with 86, add + prefix
    if (cleaned.startsWith('86') && cleaned.length === 13) {
      return '+' + cleaned;
    }
    
    // If it's just the phone number (11 digits), add +86
    if (cleaned.length === 11 && !cleaned.startsWith('86')) {
      return '+86' + cleaned;
    }
    
    // If starts with +86 but user typed it, just return
    return cleaned.startsWith('+86') ? cleaned : '+86' + cleaned.replace(/^\+?86?/, '');
  },

  // Generate default student ID
  generateDefaultStudentId: function() {
    // Get current date in YYYYMMDD format
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;
    
    // Get current timestamp in milliseconds
    const timestamp = Date.now();
    
    // Extract the last 9 digits of the timestamp to keep the ID reasonably short
    const timestampSuffix = String(timestamp).slice(-9);
    
    return `xs${dateString}${timestampSuffix}`;
  },

  data: {
    // Form step state
    formStep: 1,
    totalSteps: 3,
    isLoading: false,
    loadingMessage: "",
    errors: {},
    termsAgreed: false,
    
    // Universities data
    universities: [],
    
    // Form data following React structure exactly
    form: {
      // Basic info
      name: "",
      username: "",
      email: "",
      phone: "",
      id_number: "",
      password: "",
      password_confirmation: "",
      
      // Student specific fields
      school: null,
      student_number: "",
      class: "",
      attend_year: "",
      faculty: null,
      major: null,
    },
    
    // Available options for dropdowns
    availableFaculties: [],
    availableMajors: [],
    
    // Verification states
    emailVerified: false,
    phoneVerified: false,
    emailOtpCode: "",
    phoneOtpCode: "",
    emailChanged: false,
    phoneChanged: false,
    
    // Verification messages
    emailVerificationMessage: "",
    phoneVerificationMessage: "",
    emailVerificationError: "",
    phoneVerificationError: "",
    
    // Countdown for SMS resend
    phoneCountdown: 0,
    emailCountdown: 0,
    
    // Year picker data
    years: [],
    currentYear: new Date().getFullYear(),
      // UI messages
    messages: {
      loading: "加载中...",
      stepTitles: ["学生信息", "基本信息", "设置密码"],
      placeholders: {
        name: "姓名",
        email: "电子邮箱",
        phone: "手机号码",
        id_number: "身份证号码",
        password: "密码（至少6个字符）",
        password_confirmation: "确认密码",
        school: "学校名称",
        student_number: "学号",
        class: "班级",
        attend_year: "入学年份",
        faculty: "学院",
        major: "专业"
      },
      errors: {
        required: "不能为空",
        emailFormat: "请输入有效的电子邮箱地址",
        phoneFormat: "手机号码格式不正确",
        passwordLength: "密码长度必须至少为6个字符",
        passwordMismatch: "两次输入的密码不一致",
        yearInvalid: "请输入有效的年份",
        networkError: "网络错误",
        registerFailed: "注册失败"
      },
      success: {
        otpSent: "验证码已发送",
        verificationSuccess: "验证成功",
        registerSuccess: "注册成功"
      }
    }
  },
  onLoad: function(options) {
    // Check if already logged in
    const userInfo = getApp().globalData.userInfo;
    if (userInfo?.token) {
      wx.reLaunch({
        url: "/pages/index/index"
      });
      return;
    }
    
    // Check if coming from WeChat login
    if (options.from === 'wechat') {
      this.setData({
        fromWeChat: true
      });
      
      // Show WeChat registration message
      wx.showToast({
        title: '请完成微信账号注册',
        icon: 'none',
        duration: 2000
      });
    }
    
    this.initializeYears();
    this.loadUniversities();
  },

  // Initialize years array for picker
  initializeYears: function() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2018; year <= currentYear; year++) {
      years.push(year);
    }
    this.setData({ 
      years,
      currentYear,
      [`form.attend_year`]: currentYear
    });
  },

  // Load universities data
  loadUniversities: function() {
    wx.request({
      url: `${config.BACKEND_URL}/university`,
      method: "GET",
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success" && res.data.universities) {
          const universities = res.data.universities.map(university => ({
            id: university.id,
            name: university.name,
            faculties: university.faculties.map(faculty => ({
              name: faculty.name,
              id: faculty.id,
              majors: faculty.majors.map(major => ({
                id: major.id,
                name: major.name
              }))
            }))
          }));
              this.setData({ universities });
        }
      },
      fail: () => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none"
        });
      }
    });
  },

  // Handle input changes
  onInputChange: function(e) {
    const { field } = e.currentTarget.dataset;
    let value = e.detail.value;
    
    // Remove spaces from phone input
    if (field === 'phone') {
      value = value.replace(/\s/g, "");
    }
    
    this.setData({
      [`form.${field}`]: value,
      [`errors.${field}`]: null
    });

    // Handle specific field changes
    if (field === 'email') {
      this.setData({
        emailChanged: true,
        emailVerified: false,
        emailOtpCode: "",
        emailVerificationMessage: "",
        emailVerificationError: ""
      });
    } else if (field === 'phone') {
      this.setData({
        phoneChanged: true,
        phoneVerified: false,
        phoneOtpCode: "",
        phoneVerificationMessage: "",
        phoneVerificationError: ""
      });
    }
  },

  // Handle school selection
  onSchoolChange: function(e) {
    const selectedIndex = parseInt(e.detail.value);
    const selectedSchool = this.data.universities[selectedIndex];
    
    this.setData({
      [`form.school`]: selectedSchool,
      [`form.faculty`]: null,
      [`form.major`]: null,
      availableFaculties: selectedSchool?.faculties || [],
      availableMajors: [],
      [`errors.school`]: null
    });
  },

  // Handle faculty selection
  onFacultyChange: function(e) {
    const selectedIndex = parseInt(e.detail.value);
    const selectedFaculty = this.data.availableFaculties[selectedIndex];
    
    this.setData({
      [`form.faculty`]: selectedFaculty,
      [`form.major`]: null,
      availableMajors: selectedFaculty?.majors || [],
      [`errors.faculty`]: null
    });
  },

  // Handle major selection
  onMajorChange: function(e) {
    const selectedIndex = parseInt(e.detail.value);
    const selectedMajor = this.data.availableMajors[selectedIndex];
    
    this.setData({
      [`form.major`]: selectedMajor,
      [`errors.major`]: null
    });
  },

  // Handle year selection
  onYearChange: function(e) {
    const selectedYear = this.data.years[parseInt(e.detail.value)];
    this.setData({
      [`form.attend_year`]: selectedYear,
      [`errors.attend_year`]: null
    });
  },

  // Send email verification
  sendEmailVerification: function() {
    if (!this.data.form.email) {
      this.setData({
        emailVerificationError: "请先输入邮箱地址",
        emailVerificationMessage: ""
      });
      return;
    }

    // Check if countdown is active
    if (this.data.emailCountdown > 0) {
      return;
    }

    this.setData({
      isLoading: true,
      loadingMessage: "发送中..."
    });
    
    wx.request({
      url: `${config.BACKEND_URL}/verification/send_email_code`,
      method: "POST",
      data: {
        email: this.data.form.email
      },
      header: {
        "Content-Type": "application/json"
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
            emailVerificationError: res.data?.msg || res.data?.error || "验证码发送失败，请检查邮箱地址",
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
        this.setData({
          isLoading: false
        });
      }
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

  // Send phone verification
  sendPhoneVerification: function() {
    if (!this.data.form.phone) {
      this.setData({
        phoneVerificationError: "请先输入手机号码",
        phoneVerificationMessage: ""
      });
      return;
    }

    // Check if countdown is active
    if (this.data.phoneCountdown > 0) {
      return;
    }

    this.setData({
      isLoading: true,
      loadingMessage: "发送中..."
    });
    
    wx.request({
      url: `${config.BACKEND_URL}/verification/send_phone_sms_code`,
      method: "POST",
      data: {
        phone: this.ensureCountryCode(this.data.form.phone)
      },
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          // Always start countdown regardless of alert or new code
          this.startCountdown();
          
          // Check if it's an alert (existing code) or new code sent
          if (res.data.alert) {
            // Display alert in green
            this.setData({
              phoneVerificationMessage: res.data.alert,
              phoneVerificationError: ""
            });
            // Clear success message after 8 seconds
            setTimeout(() => {
              this.setData({ phoneVerificationMessage: "" });
            }, 8000);
          } else {
            // Normal success - new code sent
            this.setData({
              phoneVerificationMessage: res.data?.msg || "验证码已发送到您的手机",
              phoneVerificationError: ""
            });
            // Clear success message after 5 seconds
            setTimeout(() => {
              this.setData({ phoneVerificationMessage: "" });
            }, 5000);
          }
        } else {
          this.setData({
            phoneVerificationError: res.data?.msg || res.data?.error || "验证码发送失败，请检查手机号码",
            phoneVerificationMessage: ""
          });
        }
      },
      fail: () => {
        this.setData({
          phoneVerificationError: "网络错误，请稍后重试",
          phoneVerificationMessage: ""
        });
      },
      complete: () => {
        this.setData({
          isLoading: false
        });
      }
    });
  },

  // Handle OTP input
  onEmailOtpInput: function(e) {
    this.setData({
      emailOtpCode: e.detail.value
    });
  },

  onPhoneOtpInput: function(e) {
    this.setData({
      phoneOtpCode: e.detail.value
    });
  },

  // Verify email code
  verifyEmailCode: function() {
    if (!this.data.emailOtpCode) {
      this.setData({
        emailVerificationError: "请输入验证码",
        emailVerificationMessage: ""
      });
      return;
    }

    this.setData({
      isLoading: true,
      loadingMessage: "验证中..."
    });
    
    wx.request({
      url: `${config.BACKEND_URL}/verification/verify_email_code`,
      method: "POST",
      data: {
        email: this.data.form.email,
        code: this.data.emailOtpCode
      },
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          this.setData({ 
            emailVerified: true,
            [`errors.email`]: null,
            emailVerificationMessage: "邮箱验证成功！",
            emailVerificationError: ""
          });
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.setData({ emailVerificationMessage: "" });
          }, 3000);
        } else {
          this.setData({
            emailVerificationError: res.data?.msg || res.data?.error || "验证码错误或已过期",
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
        this.setData({
          isLoading: false
        });
      }
    });
  },

  // Verify phone code
  verifyPhoneCode: function() {
    if (!this.data.phoneOtpCode) {
      this.setData({
        phoneVerificationError: "请输入验证码",
        phoneVerificationMessage: ""
      });
      return;
    }

    this.setData({
      isLoading: true,
      loadingMessage: "验证中..."
    });
    
    wx.request({
      url: `${config.BACKEND_URL}/verification/verify_phone_sms_code`,
      method: "POST",
      data: {
        phone: this.ensureCountryCode(this.data.form.phone),
        code: this.data.phoneOtpCode
      },
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          this.setData({ 
            phoneVerified: true,
            [`errors.phone`]: null,
            phoneVerificationMessage: "手机号验证成功！",
            phoneVerificationError: ""
          });
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.setData({ phoneVerificationMessage: "" });
          }, 3000);
        } else {
          this.setData({
            phoneVerificationError: res.data?.msg || res.data?.error || "验证码错误或已过期",
            phoneVerificationMessage: ""
          });
        }
      },
      fail: () => {
        this.setData({
          phoneVerificationError: "网络错误，请稍后重试",
          phoneVerificationMessage: ""
        });
      },
      complete: () => {
        this.setData({
          isLoading: false
        });
      }
    });
  },
  // Validation functions following React logic exactly
  validateStep: function() {
    const { form, formStep } = this.data;
    const errors = {};

    if (formStep === 1) {
      // Student info validation
      if (!form.school) errors.school = "学校名称不能为空";
      if (!form.student_number) errors.student_number = "学号不能为空";
      if (!form.class) errors.class = "班级不能为空";
      if (!form.faculty) errors.faculty = "院系不能为空";
      if (!form.major) errors.major = "专业不能为空";
      if (!form.attend_year) {
        errors.attend_year = "入学年份不能为空";
      } else if (
        isNaN(form.attend_year) ||
        parseInt(form.attend_year) < 1900 ||
        parseInt(form.attend_year) > new Date().getFullYear()
      ) {
        errors.attend_year = "请输入有效的年份";
      }
      
    } else if (formStep === 2) {
      // Basic info validation
      if (!form.name.trim()) errors.name = "姓名不能为空";
      
      if (!form.email.trim()) {
        errors.email = "电子邮箱不能为空";
      } else if (!/\S+@\S+\.\S+/.test(form.email)) {
        errors.email = "请输入有效的电子邮箱地址";
      } else if (this.data.emailChanged && !this.data.emailVerified) {
        errors.email = "请验证邮箱";
      }
      
      if (!form.phone.trim()) {
        errors.phone = "手机号码不能为空";
      } else if (this.data.phoneChanged && !this.data.phoneVerified) {
        errors.phone = "请验证手机号";
      }
      
      if (!form.id_number.trim()) errors.id_number = "身份证号码不能为空";
      
    } else if (formStep === 3) {
      // Password validation
      if (!form.password) {
        errors.password = "密码不能为空";
      } else if (form.password.length < 6) {
        errors.password = "密码长度必须至少为6个字符";
      }
      
      if (form.password !== form.password_confirmation) {
        errors.password_confirmation = "两次输入的密码不一致";
      }
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  // Complete form validation
  validateForm: function() {
    const { form } = this.data;
    const errors = {};

    // Basic info
    if (!form.name.trim()) errors.name = "姓名不能为空";
    
    if (!form.email.trim()) {
      errors.email = "电子邮箱不能为空";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errors.email = "请输入有效的电子邮箱地址";
    } else if (this.data.emailChanged && !this.data.emailVerified) {
      errors.email = "请验证邮箱";
    }
    
    if (!form.phone.trim()) {
      errors.phone = "手机号码不能为空";
    } else if (this.data.phoneChanged && !this.data.phoneVerified) {
      errors.phone = "请验证手机号";
    }

    // Password
    if (!form.password) {
      errors.password = "密码不能为空";
    } else if (form.password.length < 6) {
      errors.password = "密码长度必须至少为6个字符";
    }

    if (form.password !== form.password_confirmation) {
      errors.password_confirmation = "两次输入的密码不一致";
    }

    // Student info
    if (!form.school) errors.school = "学校名称不能为空";
    if (!form.attend_year) {
      errors.attend_year = "入学年份不能为空";
    } else if (
      isNaN(form.attend_year) ||
      parseInt(form.attend_year) < 1900 ||
      parseInt(form.attend_year) > new Date().getFullYear()
    ) {
      errors.attend_year = "请输入有效的年份";
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  // Step navigation
  nextStep: function() {
    if (this.validateStep()) {
      this.setData({
        formStep: this.data.formStep + 1
      });
    }
  },

  prevStep: function() {
    this.setData({
      formStep: this.data.formStep - 1
    });
  },
  // Handle form submission
  handleSubmit: function() {
    // Check if terms are agreed
    if (!this.data.termsAgreed) {
      wx.showToast({
        title: "请先同意用户协议和隐私政策",
        icon: "none",
        duration: 2000
      });
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.setData({ isLoading: true });

    const { form } = this.data;
    const app = getApp();
    
    // Check if this is WeChat registration
    const wechatData = app.globalData.wechatRegistrationData;
    const isWechatRegistration = this.data.fromWeChat && wechatData;
    
    if (isWechatRegistration) {
      this.handleWechatRegistration(form, wechatData);
    } else {
      this.handleNormalRegistration(form);
    }
  },

  // Handle normal registration
  handleNormalRegistration: function(form) {
    // Generate default student ID instead of using id_number
    const studentId = this.generateDefaultStudentId();
    
    // Prepare form data exactly like React version
    const formData = {
      name: form.name,
      username: studentId,
      email: form.email,
      phone: this.ensureCountryCode(form.phone),
      id_number: form.id_number,
      password: form.password,
      password_confirmation: form.password_confirmation,
      student_number: form.student_number,
      university_id: form.school?.id,
      class: form.class,
      attend_year: form.attend_year,
      faculty: form.faculty?.name,
      major: form.major?.name
    };

    wx.request({
      url: `${config.BACKEND_URL}/auth/register`,
      method: "POST",
      data: formData,
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        this.handleRegistrationResponse(res);
      },
      fail: () => {
        this.handleRegistrationError();
      },
      complete: () => {
        this.setData({ isLoading: false });
      }
    });
  },

  // Handle WeChat registration with fresh code
  handleWechatRegistration: function(form, wechatData) {
    // Get fresh WeChat code for registration
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          // Generate default student ID instead of using id_number
          const studentId = this.generateDefaultStudentId();
          
          const formData = {
            wechat_code: loginRes.code,
            name: form.name,
            username: studentId,
            email: form.email,
            phone: this.ensureCountryCode(form.phone),
            id_number: form.id_number,
            password: form.password,
            password_confirmation: form.password_confirmation,
            student_number: form.student_number,
            university_id: form.school?.id,
            class: form.class,
            attend_year: form.attend_year,
            faculty: form.faculty?.name,
            major: form.major?.name
          };

          wx.request({
            url: `${config.BACKEND_URL}/auth/wechat-register`,
            method: "POST",
            data: formData,
            header: {
              "Content-Type": "application/json"
            },
            success: (res) => {
              this.handleRegistrationResponse(res);
            },
            fail: () => {
              this.handleRegistrationError();
            },
            complete: () => {
              this.setData({ isLoading: false });
            }
          });
        } else {
          this.handleRegistrationError();
        }
      },
      fail: () => {
        this.handleRegistrationError();
      }
    });
  },

  // Handle registration response
  handleRegistrationResponse: function(res) {
    if (res.statusCode === 200 && res.data.status === "success") {
      // Clear WeChat registration data
      const app = getApp();
      if (app.globalData.wechatRegistrationData) {
        delete app.globalData.wechatRegistrationData;
      }

      wx.showToast({
        title: this.data.messages.success.registerSuccess,
        icon: "success"
      });
      
      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
          success: function(res){
            // success
          },
          fail: function() {
            // fail
          },
          complete: function() {
            // complete
          }
        })
      }, 1500);
    } else {
      wx.showToast({
        title: res.data?.msg || res.data?.error || this.data.messages.errors.registerFailed,
        icon: "none"
      });
      this.setData({ isLoading: false });
    }
  },

  // Handle registration error
  handleRegistrationError: function() {
    wx.showToast({
      title: this.data.messages.errors.networkError,
      icon: "none"
    });
    this.setData({ isLoading: false });
  },

  // Legacy method (kept for compatibility)
  submitForm: function() {
    // Generate default student ID
    const studentId = this.generateDefaultStudentId();
    
    // Prepare form data exactly like React version
    const formData = {
      name: form.name,
      username: studentId,
      email: form.email,
      phone: this.ensureCountryCode(form.phone),
      id_number: form.id_number,
      password: form.password,
      password_confirmation: form.password_confirmation,
      university_id: form.school?.id,
      student_number: form.student_number,
      class: form.class,
      attend_year: form.attend_year,
      faculty: form.faculty?.name,
      major: form.major?.name
    };

    wx.request({
      url: `${config.BACKEND_URL}/auth/register`,
      method: "POST",
      data: formData,
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          wx.showToast({
            title: this.data.messages.success.registerSuccess,
            icon: "success"
          });
          
          setTimeout(() => {            wx.navigateBack({
              delta: 1, // Go back delta (default 1) pages
              success: function(res){
                // success
              },
              fail: function() {
                // fail
              },
              complete: function() {
                // complete
              }
            })
          }, 1500);
        } else {
          wx.showToast({
            title: res.data?.msg || this.data.messages.errors.registerFailed,
            icon: "none"
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none"
        });
      },
      complete: () => {
        this.setData({ isLoading: false });
      }
    });
  },

  // Navigate to login
  goToLogin: function() {
    wx.redirectTo({
      url: "/pages/login/login"
    });
  },

  // Navigate to terms page
  goToTerms: function() {
    wx.navigateTo({
      url: "/pages/terms/terms"
    });
  },

  // Navigate to privacy page
  goToPrivacy: function() {
    wx.navigateTo({
      url: "/pages/privacy/privacy"
    });
  },

  // Handle agreement checkbox change
  onAgreeChange: function(e) {
    this.setData({
      termsAgreed: e.detail.value.length > 0
    });
  }
});