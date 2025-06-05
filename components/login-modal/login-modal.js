const { default: config } = require("../../config");

// components/login-modal/login-modal.js
Component({  data: {
    loginType: "email", // 'wechat', 'email', 'phone'
    email: "",
    phone: "",
    password: "",
    verificationCode: "",
    showPassword: false,
    countdown: 0,
    loading: false,
    emailError: "",
    phoneError: "",
    passwordError: "",
    codeError: "",
    wechatError: "",
    generalError: "",
    phoneSuccessMessage: "", // For verification code sent confirmation
    // Add Chinese messages
    messages: {
      // Login type labels
      loginTypes: {
        wechat: "微信登录",
        email: "邮箱登录",
        phone: "手机登录",
      },
      // Form labels
      formLabels: {
        email: "邮箱地址",
        phone: "手机号码",
        password: "密码",
        verificationCode: "验证码",
      },
      // Button texts
      buttons: {
        login: "登录",
        sendCode: "发送验证码",
        resend: "重新发送",
        seconds: "秒",
        register: "立即注册", // Added register button text
      },
      // Error messages
      errors: {
        emailRequired: "请输入邮箱地址",
        emailInvalid: "请输入有效的邮箱地址",
        phoneRequired: "请输入手机号码",
        phoneInvalid: "请输入有效的手机号码",
        passwordRequired: "请输入密码",
        passwordTooShort: "密码至少需要6个字符",
        codeRequired: "请输入验证码",
        codeInvalid: "验证码必须为6位数字",
        wechatLoginFailed: "微信登录失败，请重试",
        emailLoginFailed: "邮箱登录失败，请检查凭据",
        phoneLoginFailed: "手机登录失败，请检查验证码",
        verificationFailed: "验证失败",
      },
      // Status messages
      status: {
        sendingCode: "发送验证码中...",
        codeSent: "验证码已发送",
        sendFailed: "发送失败",
        loginSuccess: "登录成功",
      },
    },
  },
  methods: {
    // Close modal
    closeModal() {
      const app = getApp();
      app.setState("showLoginModal", false);
    },

    // Navigate to register page
    goToRegister() {
      // Close the login modal first
      this.closeModal();

      // Navigate to register page
      wx.navigateTo({
        url: "/pages/register/register",
      });
    },

    // Prevent modal close when clicking inside
    preventClose(e) {},    // Switch login type
    switchLoginType(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({
        loginType: type,
        emailError: "",
        phoneError: "",
        passwordError: "",
        codeError: "",
        wechatError: "",
        generalError: "",
        phoneSuccessMessage: "",
      });
    },// Input handlers
    onEmailInput(e) {
      this.setData({
        email: e.detail.value,
        emailError: "",
        generalError: "", // Clear general error when user starts typing
      });
    },    onPhoneInput(e) {
      this.setData({
        phone: e.detail.value,
        phoneError: "",
        phoneSuccessMessage: "", // Clear success message when user types
        generalError: "", // Clear general error when user starts typing
      });
    },

    onPasswordInput(e) {
      this.setData({
        password: e.detail.value,
        passwordError: "",
        generalError: "", // Clear general error when user starts typing
      });
    },

    onCodeInput(e) {
      this.setData({
        verificationCode: e.detail.value,
        codeError: "",
        generalError: "", // Clear general error when user starts typing
      });
    },    // Toggle password visibility
    togglePassword(e) {
      // 이벤트 버블링 방지
      if (e && e.stopPropagation) {
        e.stopPropagation();
      }
      
      // 현재 상태 확인 및 로그
      const currentState = this.data.showPassword;
      console.log('Toggle password - current state:', currentState);
      
      // 상태 변경
      this.setData({
        showPassword: !currentState,
      }, () => {
        // 상태 변경 완료 후 로그
        console.log('Toggle password - new state:', this.data.showPassword);
      });
      
      // 햅틱 피드백 (선택사항)
      if (wx.vibrateShort) {
        wx.vibrateShort({
          type: 'light'
        });
      }
    },

    // Validation methods
    validateEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },

    validatePhone(phone) {
      const phoneRegex = /\d{11}$/;
      return phoneRegex.test(phone);
    },

    // WeChat login
    async wechatLogin() {
      try {
        this.setData({ loading: true });

        // Get WeChat login code
        const loginResult = await this.promiseWrapper(wx.login);

        if (!loginResult.code) {
          throw new Error("Failed to get WeChat login code");
        }

        // Get user info (requires user authorization)
        const userInfoResult = await this.promiseWrapper(wx.getUserProfile, {
          desc: "登录以访问个性化功能", // Chinese: "Login to access personalized features"
        });

        // Send to backend for authentication
        const authResult = await this.requestLogin({
          type: "wechat",
          code: loginResult.code,
          userInfo: userInfoResult.userInfo,
          signature: userInfoResult.signature,
          rawData: userInfoResult.rawData,
        });        this.handleLoginSuccess(authResult);
      } catch (error) {
        this.handleLoginError(this.data.messages.errors.wechatLoginFailed, "wechat");
      } finally {
        this.setData({ loading: false });
      }
    },

    // Email login
    async emailLogin() {
      const { email, password } = this.data;

      // Validation
      if (!email) {
        this.setData({ emailError: this.data.messages.errors.emailRequired });
        return;
      }

      if (!this.validateEmail(email)) {
        this.setData({ emailError: this.data.messages.errors.emailInvalid });
        return;
      }

      if (!password) {
        this.setData({
          passwordError: this.data.messages.errors.passwordRequired,
        });
        return;
      }

      if (password.length < 6) {
        this.setData({
          passwordError: this.data.messages.errors.passwordTooShort,
        });
        return;
      }

      try {
        this.setData({ loading: true });

        const authResult = await this.requestLogin({
          email,
          password,
        });
        console.log("Email login result:", authResult);

        this.handleLoginSuccess(authResult);
      } catch (error) {
        console.log(error);
        // Clear any existing errors first
        this.setData({
          emailError: "",
          passwordError: "",
        });

        // Set appropriate error based on response
        if (error.message && error.message.includes("email")) {
          this.setData({
            emailError: this.data.messages.errors.emailLoginFailed,
          });
        } else if (error.message && error.message.includes("password")) {
          this.setData({
            passwordError: this.data.messages.errors.emailLoginFailed,
          });
        } else {
          this.setData({
            emailError: this.data.messages.errors.emailLoginFailed,
          });
        }
      } finally {
        this.setData({ loading: false });
      }
    },

    // Phone login
    async phoneLogin() {
      const { phone, verificationCode } = this.data;

      // Validation
      if (!phone) {
        this.setData({ phoneError: this.data.messages.errors.phoneRequired });
        return;
      }

      if (!this.validatePhone(phone)) {
        this.setData({ phoneError: this.data.messages.errors.phoneInvalid });
        return;
      }

      if (!verificationCode) {
        this.setData({ codeError: this.data.messages.errors.codeRequired });
        return;
      }

      if (verificationCode.length !== 6) {
        this.setData({ codeError: this.data.messages.errors.codeInvalid });
        return;
      }

      this.setData({ loading: true });

      wx.request({
        url: `${config.BACKEND_URL}/verification/verify_and_login`,
        method: "POST",
        data: {
          phone: "+86" + phone,
          code: verificationCode,
        },
        header: {
          "Content-Type": "application/json",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === "success") {
            this.handleLoginSuccess(res.data);
          } else {
            // Clear existing errors and set phone-related error
            this.setData({
              phoneError: "",
              codeError: "",
            });

            const errorMessage = res.data.msg || res.data.error || "登录失败";
            if (
              errorMessage.includes("验证码") ||
              errorMessage.includes("code")
            ) {
              this.setData({ codeError: errorMessage });
            } else {
              this.setData({ phoneError: errorMessage });
            }
          }
        },
        fail: (err) => {
          console.error("Phone login request failed:", err);
          this.setData({
            phoneError: "",
            codeError: this.data.messages.errors.phoneLoginFailed,
          });
        },
        complete: () => {
          this.setData({ loading: false });
        },
      });
    },

    // Send verification code
    async sendVerificationCode() {
      const { phone, countdown } = this.data;

      if (!phone) {
        this.setData({ phoneError: this.data.messages.errors.phoneRequired });
        return;
      }

      if (!this.validatePhone(phone)) {
        this.setData({ phoneError: this.data.messages.errors.phoneInvalid });
        return;
      }

      if (countdown > 0) {
        return;
      }      try {
        wx.showLoading({
          title: this.data.messages.status.sendingCode,
          mask: true,
        });
        const data = await this.requestVerificationCode("+86" + phone);
        console.log("Verification code sent:", data);
        // Start countdown
        this.startCountdown();        // Clear any previous errors and show success message
        this.setData({
          phoneError: "",
          codeError: "",
          phoneSuccessMessage: data.msg || this.data.messages.status.codeSent,
        });

        // Clear the success message after 3 seconds
        setTimeout(() => {
          this.setData({
            phoneSuccessMessage: "",
          });
        }, 3000);
      } catch (error) {
        this.setData({
          phoneError: this.data.messages.status.sendFailed,
          phoneSuccessMessage: "", // Clear any success message
        });
      } finally {
        wx.hideLoading();
      }
    },

    // Start countdown timer
    startCountdown() {
      this.setData({ countdown: 60 });

      const timer = setInterval(() => {
        const { countdown } = this.data;
        if (countdown <= 1) {
          clearInterval(timer);
          this.setData({ countdown: 0 });
        } else {
          this.setData({ countdown: countdown - 1 });
        }
      }, 1000);
    },

    // Handle login
    handleLogin() {
      const { loginType } = this.data;

      switch (loginType) {
        case "wechat":
          this.wechatLogin();
          break;
        case "email":
          this.emailLogin();
          break;
        case "phone":
          this.phoneLogin();
          break;
      }
    },    // Handle successful login
    handleLoginSuccess(result) {
      const app = getApp();
      wx.request({
        url: `${config.BACKEND_URL}/user/get_my_follow_users`,
        method: "GET",
        header: {
          Authorization: result?.user.token
            ? `Bearer ${result?.user.token}`
            : "",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            app.setState("followUsers", res.data.users || []);
          } else {
            app.logout();
          }
        },
        fail: (err) => {
          console.error("Error fetching user info:", err);
          app.logout();
        },
      });
      wx.request({
        url: `${config.BACKEND_URL}/user/get_my_followed_users`,
        method: "GET",
        header: {
          Authorization: result?.user.token
            ? `Bearer ${result?.user.token}`
            : "",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            app.setState("followedUsers", res.data.users || []);
          } else {
            app.logout();
          }
        },
        fail: (err) => {
          console.error("Error fetching followed users:", err);
          app.logout();
        },
      });
      wx.request({
        url: `${config.BACKEND_URL}/friend/get_friends`,
        method: "GET",
        header: {
          Authorization: result?.user.token
            ? `Bearer ${result?.user.token}`
            : "",
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            app.setState("friends", res.data.users || []);
          } else {
            app.logout();
          }
        },
        fail: (err) => {
          console.error("Error fetching friends:", err);
          app.logout();
        },
      });
      // Trigger success event
      this.triggerEvent("loginSuccess", result);
      app.setUserInfo(result.user);

      // Close modal and navigate
      this.closeModal();
      wx.redirectTo({
        url: "/pages/index/index",
      });
    },    // Handle login error
    handleLoginError(message, fieldType = null) {
      // Set field-specific error instead of showing toast
      if (fieldType === "email") {
        this.setData({ emailError: message });
      } else if (fieldType === "phone") {
        this.setData({ phoneError: message });
      } else if (fieldType === "password") {
        this.setData({ passwordError: message });
      } else if (fieldType === "code") {
        this.setData({ codeError: message });
      } else if (fieldType === "wechat") {
        this.setData({ wechatError: message });
      } else {
        // For general errors, set general error field or default to email field
        this.setData({ 
          generalError: message,
          emailError: message // Fallback to email field for general errors
        });
      }
    },

    // API request wrapper
    requestLogin(data) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${config.BACKEND_URL}/auth/login`,
          method: "POST",
          data,
          header: {
            "Content-Type": "application/json",
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data.status === "success") {
              resolve(res.data);
            } else {
              reject(
                new Error(res.data.msg || res.data.error || "Login failed")
              );
            }
          },
          fail: reject,
        });
      });
    },

    // Request verification code
    requestVerificationCode(phone) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${config.BACKEND_URL}/verification/send_phone_sms_code`,
          method: "POST",
          data: { phone, is_login: true },
          header: {
            "Content-Type": "application/json",
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data.status === "success") {
              resolve(res.data);
            } else {
              reject(
                new Error(
                  res.data.msg || res.data.message || "Failed to send code"
                )
              );
            }
          },
          fail: reject,
        });
      });
    },

    // Promise wrapper for wx APIs
    promiseWrapper(fn, options = {}) {
      return new Promise((resolve, reject) => {
        fn({
          ...options,
          success: resolve,
          fail: reject,
        });
      });
    },
  },
});
