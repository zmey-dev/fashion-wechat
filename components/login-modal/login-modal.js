const { default: config } = require("../../config");

Component({
  data: {
    loginType: "wechat",
    loginIdentifier: "", // For username/phone login
    phone: "",
    password: "",
    verificationCode: "",
    showPassword: false,
    countdown: 0,
    loading: false,
    loadingMessage: "",
    termsAgreed: false,
    loginIdentifierError: "", // For username/phone login errors
    phoneError: "",
    passwordError: "",
    codeError: "",
    wechatError: "",
    generalError: "",
    phoneSuccessMessage: "",
    messages: {
      loginTypes: {
        wechat: "微信登录",
        password: "密码登录",
        phone: "手机验证码",
      },
      formLabels: {
        loginIdentifier: "用户名/电话号码/电子邮件", // Username or phone
        phone: "手机号码",
        password: "密码",
        verificationCode: "验证码",
      },
      buttons: {
        login: "登录",
        sendCode: "发送验证码",
        resend: "重新发送",
        seconds: "秒",
        register: "立即注册",
        wechatLogin: "微信登录",
      },
      errors: {
        emailRequired: "请输入邮箱地址",
        emailInvalid: "请输入有效的邮箱地址",
        phoneRequired: "请输入手机号码",
        phoneInvalid: "请输入有效的手机号码",
        passwordRequired: "请输入密码",
        passwordTooShort: "密码至少需要6个字符",
        codeRequired: "请输入验证码",
        codeInvalid: "验证码必须为6位数字",
        emailCodeRequired: "请输入邮箱验证码",
        emailCodeInvalid: "邮箱验证码必须为6位数字",
        wechatLoginFailed: "微信登录失败，请重试",
        emailLoginFailed: "邮箱登录失败，请检查验证码",
        phoneLoginFailed: "手机登录失败，请检查验证码",
        verificationFailed: "验证失败",
      },
      status: {
        sendingCode: "发送验证码中...",
        codeSent: "验证码已发送",
        sendFailed: "发送失败",
        loginSuccess: "登录成功",
      },
    },
  },
  methods: {
    // Utility function to ensure phone has +86 prefix
    ensureCountryCode(phoneNumber) {
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

    closeModal() {
      const app = getApp();
      app.setState("showLoginModal", false);
    },

    goToRegister() {
      const { termsAgreed } = this.data;
      
      // Check if terms are agreed
      if (!termsAgreed) {
        wx.showModal({
          title: "用户协议和隐私政策",
          content: '请阅读并同意"用户协议"和"隐私政策"后进行登录。',
          showCancel: false,
          confirmText: "确认",
          success: (res) => {
            // User clicked confirm - just close the modal
          }
        });
        return;
      }
      
      this.closeModal();
      wx.navigateTo({
        url: "/pages/register/register",
      });
    },

    goToForgotPassword() {
      this.closeModal();
      wx.navigateTo({
        url: "/pages/forgot-password/forgot-password",
      });
    },

    goToTerms() {
      wx.navigateTo({
        url: "/pages/terms/terms",
      });
    },

    goToPrivacy() {
      wx.navigateTo({
        url: "/pages/privacy/privacy",
      });
    },

    preventClose(e) {},

    onAgreeChange(e) {
      this.setData({
        termsAgreed: e.detail.value.length > 0
      });
    },

    switchLoginType(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({
        loginType: type,
        emailError: "",
        loginIdentifierError: "",
        phoneError: "",
        passwordError: "",
        codeError: "",
        emailCodeError: "",
        wechatError: "",
        generalError: "",
        phoneSuccessMessage: "",
        emailSuccessMessage: "",
      });
    },

    onLoginIdentifierInput(e) {
      this.setData({
        loginIdentifier: e.detail.value,
        loginIdentifierError: "",
        generalError: "",
      });
    },


    onPhoneInput(e) {
      this.setData({
        phone: e.detail.value.replace(/\s/g, ""),
        phoneError: "",
        phoneSuccessMessage: "",
        generalError: "",
      });
    },

    onPasswordInput(e) {
      this.setData({
        password: e.detail.value,
        passwordError: "",
        generalError: "",
      });
    },

    onCodeInput(e) {
      this.setData({
        verificationCode: e.detail.value,
        codeError: "",
        generalError: "",
      });
    },

    togglePassword(e) {
      if (e && e.stopPropagation) {
        e.stopPropagation();
      }

      const currentState = this.data.showPassword;

      this.setData({
        showPassword: !currentState,
      });

      if (wx.vibrateShort) {
        wx.vibrateShort({
          type: "light",
        });
      }
    },

    // Validation methods

    validatePhone(phone) {
      const phoneRegex = /\d{11}$/;
      return phoneRegex.test(phone);
    },
    
    async wechatLogin() {
      try {
        this.setData({ loading: true, wechatError: "" });

        const loginResult = await this.promiseWrapper(wx.login);

        if (!loginResult.code) {
          throw new Error("Failed to get WeChat login code");
        }

        const authResult = await this.requestWechatLogin({
          code: loginResult.code,
        });

        // Check if registration is required
        if (authResult.status === "registration_required") {
          this.handleRegistrationRequired(authResult);
          return;
        }

        this.handleLoginSuccess(authResult);
      } catch (error) {
        
        // Extract more specific error message
        let errorMessage = this.data.messages.errors.wechatLoginFailed;
        if (error.message) {
          if (error.message.includes("invalid code")) {
            errorMessage = "微信授权码已过期，请重试";
          } else if (error.message.includes("WeChat")) {
            errorMessage = error.message;
          }
        }
        
        this.handleLoginError(errorMessage, "wechat");
      } finally {
        this.setData({ loading: false });
      }
    },



    async passwordLogin() {
      const { loginIdentifier, password } = this.data;

      if (!loginIdentifier) {
        this.setData({ loginIdentifierError: "请输入用户名或手机号" });
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

        // Check if login_identifier is a phone number and ensure +86 prefix
        let processedIdentifier = loginIdentifier.trim();
        
        // Check if it's a phone number (contains only digits, +, or spaces)
        const phoneRegex = /^[\d\s+]+$/;
        if (phoneRegex.test(processedIdentifier) && processedIdentifier.replace(/\D/g, "").length >= 11) {
          processedIdentifier = this.ensureCountryCode(processedIdentifier);
        }

        const authResult = await this.requestLogin({
          login_identifier: processedIdentifier,
          password: password,
        });

        this.handleLoginSuccess(authResult);
      } catch (error) {
        this.setData({
          loginIdentifierError: "",
          passwordError: "",
        });

        // set field-specific error based on error message
        if (error.message && error.message.includes("password")) {
          this.setData({
            passwordError: "密码错误",
          });
        } else {
          this.setData({
            loginIdentifierError: "用户名和密码不匹配 请重新输入。",
          });
        }
      } finally {
        this.setData({ loading: false });
      }
    },

    async phoneLogin() {
      const { phone, verificationCode } = this.data;

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
          phone: this.ensureCountryCode(phone),
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
      }
      try {
        this.setData({
          loading: true,
          loadingMessage: this.data.messages.status.sendingCode
        });
        const data = await this.requestVerificationCode(this.ensureCountryCode(phone));
        // Always start countdown regardless of alert or new code
        this.startCountdown();
        
        // Check if it's an alert (existing code) or new code sent
        if (data.alert) {
          // Show alert message
          this.setData({
            phoneError: "",
            codeError: "",
            phoneSuccessMessage: data.alert,
          });
          // Clear the success message after 8 seconds
          setTimeout(() => {
            this.setData({
              phoneSuccessMessage: "",
            });
          }, 8000);
        } else {
          // Normal success - new code sent
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
        }
      } catch (error) {
        this.setData({
          phoneError: this.data.messages.status.sendFailed,
          phoneSuccessMessage: "", // Clear any success message
        });
      } finally {
        this.setData({
          loading: false
        });
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
      const { loginType, termsAgreed } = this.data;

      // Check if terms are agreed
      if (!termsAgreed) {
        wx.showModal({
          title: "用户协议和隐私政策",
          content: '请阅读并同意"用户协议"和"隐私政策"后进行登录。',
          showCancel: false,
          confirmText: "确认",
          success: (res) => {
            // User clicked confirm - just close the modal
          }
        });
        return;
      }

      switch (loginType) {
        case "wechat":
          this.wechatLogin();
          break;
        case "password":
          this.passwordLogin();
          break;
        case "phone":
          this.phoneLogin();
          break;
      }
    }, // Handle successful login
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
          app.logout();
        },
      });
      // Trigger success event
      this.triggerEvent("loginSuccess", result);
      app.setUserInfo(result.user);

      // Close modal and navigate
      this.closeModal();
      
      // Check if there's a pending page navigation
      if (app.globalData.pendingPageNavigation) {
        const { page, path } = app.globalData.pendingPageNavigation;
        // Clear the pending navigation
        app.globalData.pendingPageNavigation = null;
        
        // Navigate to the intended page
        if (page === "upload") {
          // Special handling for upload page
          wx.redirectTo({
            url: "/pages/upload/upload",
          });
        } else if (path) {
          wx.redirectTo({
            url: path,
          });
        } else {
          // Fallback to index if no path is specified
          wx.redirectTo({
            url: "/pages/index/index",
          });
        }
      } else {
        // Default to index page if no pending navigation
        wx.redirectTo({
          url: "/pages/index/index",
        });
      }
    },    // Handle registration required for WeChat users
    handleRegistrationRequired(result) {

      // Show error message immediately in the modal
      this.setData({ 
        wechatError: result.msg || "该微信账号尚未注册，请先完成注册"
      });

      // Store WeChat data for registration
      const app = getApp();
      app.globalData.wechatRegistrationData = {
        wechat_openid: result.data.wechat_openid,
        wechat_unionid: result.data.wechat_unionid,
      };

      // Show message and redirect to registration after a short delay
      setTimeout(() => {
        wx.showModal({
          title: "需要注册",
          content: result.msg || "该微信账号尚未注册，请先完成注册",
          showCancel: true,
          cancelText: "取消",
          confirmText: "去注册",
          success: (res) => {
            if (res.confirm) {
              this.closeModal();
              wx.navigateTo({
                url: "/pages/terms/terms?from=wechat",
              });
            } else {
              // Clear error when user cancels
              this.setData({ wechatError: "" });
            }
          },
        });
      }, 1000);
    },

    // Handle login error
    handleLoginError(message, fieldType = null) {
      // Set field-specific error instead of showing toast
      if (fieldType === "phone") {
        this.setData({ phoneError: message });
      } else if (fieldType === "loginIdentifier") {
        this.setData({ loginIdentifierError: message });
      } else if (fieldType === "password") {
        this.setData({ passwordError: message });
      } else if (fieldType === "code") {
        this.setData({ codeError: message });
      } else if (fieldType === "email") {
        this.setData({ emailError: message });
      } else if (fieldType === "emailCode") {
        this.setData({ emailCodeError: message });
      } else if (fieldType === "wechat") {
        this.setData({ wechatError: message });
      } else {
        // For general errors, set general error field
        this.setData({
          generalError: message,
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
    },    // WeChat login API request
    requestWechatLogin(data) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${config.BACKEND_URL}/auth/wechat-login`,
          method: "POST",
          data,
          header: {
            "Content-Type": "application/json",
          },
          success: (res) => {
            if (res.statusCode === 200) {
              // Handle both success and registration_required cases
              if (res.data.status === "success" || res.data.status === "registration_required") {
                resolve(res.data);
              } else {
                reject(
                  new Error(
                    res.data.msg || res.data.error || "WeChat login failed"
                  )
                );
              }
            } else {
              reject(
                new Error(
                  res.data.msg || res.data.error || "WeChat login failed"
                )
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

    // Request email verification code
    requestEmailVerificationCode(email) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${config.BACKEND_URL}/verification/send_email_code`,
          method: "POST",
          data: { email, is_login: true },
          header: {
            "Content-Type": "application/json",
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data.status === "success") {
              resolve(res.data);
            } else {
              reject(
                new Error(
                  res.data.msg || res.data.message || "Failed to send email code"
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
