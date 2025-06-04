const { default: config } = require("../../config");

Page({
  data: {
    // Form step state
    formStep: 1,
    totalSteps: 3,
    isLoading: false,
    errors: {},
    
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
    
    // Year picker data
    years: [],
    currentYear: new Date().getFullYear(),
    
    // UI messages
    messages: {
      loading: "加载中...",
      stepTitles: ["基本信息", "学生信息", "设置密码"],
      placeholders: {
        name: "姓名",
        email: "电子邮箱",
        phone: "手机号码",
        id_number: "身份证号码",
        password: "密码（至少8个字符）",
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
        passwordLength: "密码长度必须至少为8个字符",
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
        console.error("Failed to load universities");
        // Set default data for testing
        this.setData({
          universities: [
            {
              id: 1,
              name: "北京大学",
              faculties: [
                {
                  name: "计算机学院",
                  id: 1,
                  majors: [
                    { id: 1, name: "计算机科学与技术" },
                    { id: 2, name: "软件工程" }
                  ]
                }
              ]
            }
          ]
        });
      }
    });
  },

  // Handle input changes
  onInputChange: function(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    this.setData({
      [`form.${field}`]: value,
      [`errors.${field}`]: null
    });

    // Handle specific field changes
    if (field === 'email') {
      this.setData({
        emailChanged: true,
        emailVerified: false,
        emailOtpCode: ""
      });
    } else if (field === 'phone') {
      this.setData({
        phoneChanged: true,
        phoneVerified: false,
        phoneOtpCode: ""
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
      wx.showToast({
        title: "请先输入邮箱",
        icon: "none"
      });
      return;
    }

    wx.showLoading({ title: "发送中..." });
    
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
          wx.showToast({
            title: this.data.messages.success.otpSent,
            icon: "success"
          });
        } else {
          wx.showToast({
            title: res.data?.msg || "发送失败",
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
        wx.hideLoading();
      }
    });
  },

  // Send phone verification
  sendPhoneVerification: function() {
    if (!this.data.form.phone) {
      wx.showToast({
        title: "请先输入手机号",
        icon: "none"
      });
      return;
    }

    wx.showLoading({ title: "发送中..." });
    
    wx.request({
      url: `${config.BACKEND_URL}/verification/send_phone_sms_code`,
      method: "POST",
      data: {
        phone: "+86" + this.data.form.phone
      },
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          wx.showToast({
            title: this.data.messages.success.otpSent,
            icon: "success"
          });
        } else {
          wx.showToast({
            title: res.data?.msg || "发送失败",
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
        wx.hideLoading();
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
      wx.showToast({
        title: "请输入验证码",
        icon: "none"
      });
      return;
    }

    wx.showLoading({ title: "验证中..." });
    
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
            [`errors.email`]: null
          });
          wx.showToast({
            title: this.data.messages.success.verificationSuccess,
            icon: "success"
          });
        } else {
          wx.showToast({
            title: res.data?.msg || "验证失败",
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
        wx.hideLoading();
      }
    });
  },

  // Verify phone code
  verifyPhoneCode: function() {
    if (!this.data.phoneOtpCode) {
      wx.showToast({
        title: "请输入验证码",
        icon: "none"
      });
      return;
    }

    wx.showLoading({ title: "验证中..." });
    
    wx.request({
      url: `${config.BACKEND_URL}/verification/verify_phone_sms_code`,
      method: "POST",
      data: {
        phone: "+86" + this.data.form.phone,
        code: this.data.phoneOtpCode
      },
      header: {
        "Content-Type": "application/json"
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          this.setData({ 
            phoneVerified: true,
            [`errors.phone`]: null
          });
          wx.showToast({
            title: this.data.messages.success.verificationSuccess,
            icon: "success"
          });
        } else {
          wx.showToast({
            title: res.data?.msg || "验证失败",
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
        wx.hideLoading();
      }
    });
  },

  // Validation functions following React logic exactly
  validateStep: function() {
    const { form, formStep } = this.data;
    const errors = {};

    if (formStep === 1) {
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
      
    } else if (formStep === 2) {
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
      
    } else if (formStep === 3) {
      // Password validation
      if (!form.password) {
        errors.password = "密码不能为空";
      } else if (form.password.length < 8) {
        errors.password = "密码长度必须至少为8个字符";
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
    } else if (form.password.length < 8) {
      errors.password = "密码长度必须至少为8个字符";
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
    if (!this.validateForm()) {
      return;
    }

    this.setData({ isLoading: true });

    const { form } = this.data;
    
    // Prepare form data exactly like React version
    const formData = {
      name: form.name,
      username: form.school?.name + form.id_number,
      email: form.email,
      phone: "+86" + form.phone,
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
          
          setTimeout(() => {
            wx.navigateBack({
              delta: 1, // 回退前 delta(默认为1) 页面
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
  }
});