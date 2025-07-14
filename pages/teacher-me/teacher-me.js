const { default: config } = require("../../config");
const ucloudUpload = require("../../services/ucloudUpload");

Page({
  data: {
    userInfo: getApp().globalData.userInfo || {},

    // Data states
    students: [],
    selectedStudent: null,
    studentPosts: [],
    university: null,

    // UI states
    currentTab: 0, // 0: students, 1: university, 2: profile, 3: contact
    tabs: ["学生", "大学信息", "个人资料", "联系我们"],
    loading: false,
    hasMore: true,

    // Modal and form states
    showStudentDetails: false,
    showUniversityModal: false,
    showImageModal: false,
    previewImageUrl: "",

    // Faculty & major management - improved structure
    existsFaculties: [],
    existsMajors: [],
    activeFaculty: null,

    // Input states for adding new items
    newFacultyInput: "",
    newMajorInput: "",
    showFacultyInput: false,
    showMajorInput: false,

    // Current faculty majors (for display)
    currentFacultyMajors: [],
    // Validation status
    hasValidationIssues: true,

    // Teacher profile data
    teacherProfile: {
      phone: "",
      // email: "",
      name: "",
      username: "",
      gender: "",
      id_number: "",
      school_position: "",
      credential: "",
      avatar: "",
      credentialName: "",
    },

    // Profile form states
    isEditingProfile: false,
    selectedAvatar: "",
    credentialFile: null,
    credentialFileName: "",
    skipCredential: false,

    // Validation states
    profileErrors: {},
    profileFormValid: false, // Original values for comparison
    // originalEmail: "",
    originalPhone: "",

    // Change tracking
    // emailChanged: false,
    phoneChanged: false,

    // WeChat linking state
    isWechatLinked: false,
    wechatLinking: false,

    // Verification states
    // emailCodeSent: false,
    phoneCodeSent: false,
    // emailVerified: false,
    phoneVerified: false,
    // enteredEmailCode: "",
    enteredPhoneCode: "",
    // sendingEmailCode: false,
    sendingPhoneCode: false,

    // Upload states
    uploadingAvatar: false,
    uploadingCredential: false,

    // Background upload states
    avatarUploading: false,
    avatarUploadProgress: 0,
    avatarUploaded: false,
    avatarUploadError: null,
    avatarUploadUrl: null,

    credentialUploading: false,
    credentialUploadProgress: 0,
    credentialUploaded: false,
    credentialUploadError: null,
    credentialUploadUrl: null,

    // Messages for user feedback
    messages: {
      loading: "加载中...",
      saving: "保存中...",
      noStudents: "没有学生",
      noPosts: "没有帖子",
      errors: {
        loadFailed: "加载失败",
        networkError: "网络错误",
        saveError: "保存失败",
        blockError: "屏蔽失败",
        deleteError: "删除失败",
      },
      confirmations: {
        blockStudent: "您确定要屏蔽这个学生吗？",
        deletePost: "您确定要删除这个帖子吗？",
      },
      success: {
        blocked: "屏蔽成功",
        deleted: "删除成功",
        saved: "保存成功",
      },
    },

    // Contact form data
    contactForm: {
      title: "",
      description: "",
    },
  },
  onLoad: function () {
    const app = getApp();
    this.userInfoHandler = (userInfo) => {
      this.setData({ userInfo });
      this.checkWechatLinkStatus();
    };
    app.subscribe("userInfo", this.userInfoHandler);
    this.setData({
      userInfo: app.globalData.userInfo || {},
    });

    // Load initial data
    this.loadStudents();
    this.loadUniversityInfo();
    this.loadTeacherProfile();
    this.checkWechatLinkStatus(); // Check WeChat link status
  },
  onShow: function () {
    this.loadStudents();
    this.loadUniversityInfo();
    this.loadTeacherProfile();
  },
  onUnload: function () {
    const app = getApp();
    app.unsubscribe("userInfo", this.userInfoHandler);
    this.cleanupProfileResources();
  },

  onPullDownRefresh: function () {
    if (this.data.currentTab === 0) {
      if (this.data.selectedStudent) {
        this.refreshStudentPosts();
      } else {
        this.loadStudents();
      }
    } else if (this.data.currentTab === 1) {
      this.loadUniversityInfo();
    } else if (this.data.currentTab === 2) {
      this.loadTeacherProfile();
    }
    wx.stopPullDownRefresh();
  },

  onReachBottom: function () {
    if (
      this.data.currentTab === 0 &&
      this.data.selectedStudent &&
      this.data.hasMore &&
      !this.data.loading
    ) {
      this.loadMoreStudentPosts();
    }
  },

  // Tab switching
  switchTab: function (e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({
      currentTab: parseInt(tab),
    });
  },

  // ======= Student Management Functions =======

  loadStudents: function () {
    this.setData({ loading: true });

    wx.request({
      url: `${config.BACKEND_URL}/teacher/students`,
      method: "GET",
      header: {
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (res) => {
        if (res.data.status === "success" && res.data.students) {
          this.setData({
            students: res.data.students,
            loading: false,
          });
        } else {
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
        this.setData({ loading: false });
      },
    });
  },

  selectStudent: function (e) {
    const { id } = e.currentTarget.dataset;
    const student = this.data.students.find((s) => s.id === id);

    if (student) {
      this.setData({
        selectedStudent: student,
        studentPosts: [],
        hasMore: true,
      });

      this.loadStudentPosts();
    }
  },

  backToStudentList: function () {
    this.setData({
      selectedStudent: null,
      studentPosts: [],
    });
  },

  loadStudentPosts: function () {
    if (!this.data.selectedStudent) return;

    this.setData({ loading: true });

    const requestData = {
      user_id: this.data.selectedStudent.id,
      scope: "15",
    };

    if (this.data.studentPosts.length > 0) {
      requestData.exist_post_ids = this.data.studentPosts.map(
        (post) => post.id
      );
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts_by_user_id`,
      method: "GET",
      data: requestData,
      header: {
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (res) => {
        if (res.data.status === "success") {
          this.setData({
            studentPosts: res.data.posts || [],
            hasMore: res.data.has_more || false,
            loading: false,
          });
        } else {
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
        this.setData({ loading: false });
      },
    });
  },

  loadMoreStudentPosts: function () {
    if (!this.data.selectedStudent || this.data.loading || !this.data.hasMore)
      return;

    this.setData({ loading: true });

    const requestData = {
      user_id: this.data.selectedStudent.id,
      scope: "15",
    };

    if (this.data.studentPosts.length > 0) {
      requestData.exist_post_ids = this.data.studentPosts.map(
        (post) => post.id
      );
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/get_posts_by_user_id`,
      method: "GET",
      data: requestData,
      header: {
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (res) => {
        if (res.data.status === "success") {
          const newPosts = [
            ...this.data.studentPosts,
            ...(res.data.posts || []),
          ];

          this.setData({
            studentPosts: newPosts,
            hasMore: res.data.has_more || false,
            loading: false,
          });
        } else {
          wx.showToast({
            title: this.data.messages.errors.loadFailed,
            icon: "none",
          });
          this.setData({ loading: false });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
        this.setData({ loading: false });
      },
    });
  },

  refreshStudentPosts: function () {
    if (!this.data.selectedStudent) return;

    this.setData({
      studentPosts: [],
      hasMore: true,
    });

    this.loadStudentPosts();
  },

  blockStudent: function (e) {
    const { id } = e.currentTarget.dataset;

    wx.showModal({
      title: "确认操作",
      content: this.data.messages.confirmations.blockStudent,
      success: (res) => {
        if (res.confirm) {
          this.setData({ loading: true });

          wx.request({
            url: `${config.BACKEND_URL}/teacher/student/block/${id}`,
            method: "POST",
            header: {
              Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
            },
            success: (res) => {
              if (res.data.status === "success") {
                const updatedStudents = this.data.students.filter(
                  (student) => student.id !== id
                );

                this.setData({
                  students: updatedStudents,
                  loading: false,
                });

                if (
                  this.data.selectedStudent &&
                  this.data.selectedStudent.id === id
                ) {
                  this.setData({
                    selectedStudent: null,
                    studentPosts: [],
                  });
                }

                wx.showToast({
                  title: this.data.messages.success.blocked,
                  icon: "success",
                });
              } else {
                wx.showToast({
                  title: this.data.messages.errors.blockError,
                  icon: "none",
                });
                this.setData({ loading: false });
              }
            },
            fail: (err) => {
              wx.showToast({
                title: this.data.messages.errors.networkError,
                icon: "none",
              });
              this.setData({ loading: false });
            },
          });
        }
      },
    });
  },

  deletePost: function (e) {
    const { id } = e.currentTarget.dataset;

    wx.showModal({
      title: "确认操作",
      content: this.data.messages.confirmations.deletePost,
      success: (res) => {
        if (res.confirm) {
          this.setData({ loading: true });

          wx.request({
            url: `${config.BACKEND_URL}/teacher/post/block/${id}`,
            method: "POST",
            header: {
              Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
            },
            success: (res) => {
              if (res.data.status === "success") {
                const updatedPosts = this.data.studentPosts.filter(
                  (post) => post.id !== id
                );

                this.setData({
                  studentPosts: updatedPosts,
                  loading: false,
                });

                wx.showToast({
                  title: this.data.messages.success.deleted,
                  icon: "success",
                });
              } else {
                wx.showToast({
                  title: this.data.messages.errors.deleteError,
                  icon: "none",
                });
                this.setData({ loading: false });
              }
            },
            fail: (err) => {
              wx.showToast({
                title: this.data.messages.errors.networkError,
                icon: "none",
              });
              this.setData({ loading: false });
            },
          });
        }
      },
    });
  },

  viewPost: function (e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?postId=${id}`,
    });
  },

  // ======= University Management Functions =======

  loadUniversityInfo: function () {
    this.setData({ loading: true });

    // Load university info
    wx.request({
      url: `${config.BACKEND_URL}/myuniversity`,
      method: "GET",
      header: {
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (resUni) => {
        if (resUni.data.status === "success" && resUni.data.university) {
          // Process faculties to add hasIssues flag
          const processedUniversity = this.processUniversityData(
            resUni.data.university
          );

          this.setData({
            university: processedUniversity,
          });

          // Set active faculty if available
          if (
            processedUniversity.faculties &&
            processedUniversity.faculties.length > 0
          ) {
            const firstFaculty = processedUniversity.faculties[0];
            const firstFacultyMajors = firstFaculty.majors || [];

            this.setData({
              activeFaculty: firstFaculty.name,
              currentFacultyMajors: firstFacultyMajors,
            });

            // Update validation status
            this.updateValidationStatus();
          }
        }

        // Load available faculties and majors
        this.loadExistsFacultiesAndMajors();
      },
      fail: () => {
        this.setData({ loading: false });
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
    });
  },

  // Process university data to add computed properties
  processUniversityData: function (university) {
    if (!university || !university.faculties) return university;

    // Add hasIssues flag to each faculty
    university.faculties = university.faculties.map((faculty) => ({
      ...faculty,
      hasIssues: !faculty.majors || faculty.majors.length === 0,
    }));

    return university;
  },

  loadExistsFacultiesAndMajors: function () {
    // Load faculties
    wx.request({
      url: `${config.BACKEND_URL}/faculty`,
      method: "GET",
      header: {
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (resFac) => {
        if (resFac.data.status === "success" && resFac.data.faculties) {
          this.setData({ existsFaculties: resFac.data.faculties });
        }

        // Load majors
        wx.request({
          url: `${config.BACKEND_URL}/major`,
          method: "GET",
          header: {
            Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
          },
          success: (resMaj) => {
            if (resMaj.data.status === "success" && resMaj.data.majors) {
              this.setData({
                existsMajors: resMaj.data.majors,
                loading: false,
              });
            } else {
              this.setData({ loading: false });
            }
          },
          fail: () => {
            this.setData({ loading: false });
            wx.showToast({
              title: this.data.messages.errors.networkError,
              icon: "none",
            });
          },
        });
      },
      fail: () => {
        this.setData({ loading: false });
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
      },
    });
  },

  // Select a faculty
  selectFaculty: function (e) {
    const { faculty } = e.currentTarget.dataset;

    // Find majors for the selected faculty directly from data
    const universityFaculties = this.data.university?.faculties || [];
    const selectedFaculty = universityFaculties.find((f) => f.name === faculty);
    const currentMajors = selectedFaculty ? selectedFaculty.majors : [];

    this.setData({
      activeFaculty: faculty,
      currentFacultyMajors: currentMajors,
    });
  },

  // Show/hide faculty input
  toggleFacultyInput: function () {
    this.setData({
      showFacultyInput: !this.data.showFacultyInput,
      newFacultyInput: "",
    });
  },

  // Handle faculty input
  onFacultyInput: function (e) {
    this.setData({
      newFacultyInput: e.detail.value,
    });
  },

  // Add a new faculty
  addFaculty: function () {
    const facultyName = this.data.newFacultyInput.trim();
    if (!facultyName) return;

    const university = this.data.university || { faculties: [] };
    const faculties = university.faculties || [];

    // Check if faculty already exists
    if (faculties.some((f) => f.name === facultyName)) {
      wx.showToast({
        title: "学院已存在",
        icon: "none",
      });
      return;
    }

    // Add new faculty with hasIssues flag
    faculties.push({
      name: facultyName,
      majors: [],
      hasIssues: true, // New faculty has no majors
    });

    university.faculties = faculties;

    this.setData({
      university: university,
      activeFaculty: facultyName,
      showFacultyInput: false,
      newFacultyInput: "",
      currentFacultyMajors: [], // New faculty has no majors initially
    });

    // Update validation status
    this.updateValidationStatus();
  },

  // Delete a faculty
  deleteFaculty: function (e) {
    const { faculty } = e.currentTarget.dataset;
    const university = this.data.university;

    // Remove the faculty
    university.faculties = university.faculties.filter(
      (f) => f.name !== faculty
    );

    // Set new active faculty if needed
    let activeFaculty = this.data.activeFaculty;
    let currentFacultyMajors = this.data.currentFacultyMajors;
    if (activeFaculty === faculty) {
      if (university.faculties.length > 0) {
        activeFaculty = university.faculties[0].name;
        const facultyData = university.faculties.find(
          (f) => f.name === activeFaculty
        );
        currentFacultyMajors = facultyData ? facultyData.majors : [];
      } else {
        activeFaculty = null;
        currentFacultyMajors = [];
      }
    }

    this.setData({
      university: university,
      activeFaculty: activeFaculty,
      currentFacultyMajors: currentFacultyMajors,
    });
  },

  // Show/hide major input
  toggleMajorInput: function () {
    this.setData({
      showMajorInput: !this.data.showMajorInput,
      newMajorInput: "",
    });
  },

  // Handle major input
  onMajorInput: function (e) {
    this.setData({
      newMajorInput: e.detail.value,
    });
  },

  // Add major to active faculty
  addMajor: function () {
    const majorName = this.data.newMajorInput.trim();
    const faculty = this.data.activeFaculty;

    if (!majorName || !faculty) return;

    const university = this.data.university;
    const faculties = university.faculties;

    // Find the faculty and add the major
    const facultyIndex = faculties.findIndex((f) => f.name === faculty);
    if (facultyIndex >= 0) {
      // Check if major already exists in this faculty
      if (faculties[facultyIndex].majors.some((m) => m.name === majorName)) {
        wx.showToast({
          title: "专业已存在",
          icon: "none",
        });
        return;
      }

      // Add the major and update hasIssues flag
      faculties[facultyIndex].majors.push({ name: majorName });
      faculties[facultyIndex].hasIssues = false; // Now has at least one major

      university.faculties = faculties;

      // Update current faculty majors if this is the active faculty
      const activeFacultyData = faculties.find((f) => f.name === faculty);
      const updatedMajors = activeFacultyData ? activeFacultyData.majors : [];

      this.setData({
        university: university,
        showMajorInput: false,
        newMajorInput: "",
        currentFacultyMajors: updatedMajors,
      });

      // Update validation status
      this.updateValidationStatus();
    }
  },

  // Delete a major
  deleteMajor: function (e) {
    const { faculty, major } = e.currentTarget.dataset;

    const university = this.data.university;
    const faculties = university.faculties;

    // Find the faculty and remove the major
    const facultyIndex = faculties.findIndex((f) => f.name === faculty);
    if (facultyIndex >= 0) {
      faculties[facultyIndex].majors = faculties[facultyIndex].majors.filter(
        (m) => m.name !== major
      );

      // Update hasIssues flag
      faculties[facultyIndex].hasIssues =
        faculties[facultyIndex].majors.length === 0;

      university.faculties = faculties;
      // Update current faculty majors if this is the active faculty
      if (faculty === this.data.activeFaculty) {
        const facultyData = faculties.find((f) => f.name === faculty);
        const updatedMajors = facultyData ? facultyData.majors : [];
        this.setData({
          university: university,
          currentFacultyMajors: updatedMajors,
        });
      } else {
        this.setData({ university: university });
      }
    }
  },

  // Get majors for a specific faculty
  getMajorsForFaculty: function (facultyName) {
    if (!this.data.university || !this.data.university.faculties) return [];

    const faculty = this.data.university.faculties.find(
      (f) => f.name === facultyName
    );
    return faculty ? faculty.majors || [] : [];
  },

  // Check if there are validation issues
  hasValidationIssues: function () {
    const faculties = this.data.university?.faculties || [];
    if (faculties.length === 0) return true;

    return faculties.some((faculty) => faculty.hasIssues);
  },

  // Update validation status
  updateValidationStatus: function () {
    this.setData({
      hasValidationIssues: this.hasValidationIssues(),
    });
  },

  // Save university faculty and major data
  saveUniversityData: function () {
    // Validate data
    const university = this.data.university;

    if (
      !university ||
      !university.faculties ||
      university.faculties.length === 0
    ) {
      wx.showToast({
        title: "请至少添加一个学院",
        icon: "none",
      });
      return;
    }

    // Check if any faculty has no majors
    const hasEmptyFaculty = university.faculties.some(
      (faculty) => !faculty.majors || faculty.majors.length === 0
    );

    if (hasEmptyFaculty) {
      wx.showToast({
        title: "请确保每个学院至少有一个专业",
        icon: "none",
      });
      return;
    }

    this.setData({ loading: true });

    wx.request({
      url: `${config.BACKEND_URL}/teacher/university/faculty_major`,
      method: "POST",
      data: {
        faculties: university.faculties,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo.token}`,
      },
      success: (res) => {
        if (res.data.status === "success") {
          wx.showToast({
            title: this.data.messages.success.saved,
            icon: "success",
          });
        } else {
          wx.showToast({
            title: this.data.messages.errors.saveError,
            icon: "none",
          });
        }
        this.setData({ loading: false });
      },
      fail: (err) => {
        wx.showToast({
          title: this.data.messages.errors.networkError,
          icon: "none",
        });
        this.setData({ loading: false });
      },
    });
  },

  // View university contract image
  viewContractImage: function () {
    if (this.data.university && this.data.university.contractName) {
      this.setData({
        showImageModal: true,
        previewImageUrl: this.data.university.contractName,
      });
    }
  },

  // Close image preview modal
  closeImageModal: function () {
    this.setData({
      showImageModal: false,
      previewImageUrl: "",
    });
  },

  // ======= Teacher Profile Management Functions =======

  // Load teacher profile data
  loadTeacherProfile: function () {
    const userInfo = getApp().globalData.userInfo || {};

    // Process phone number (remove +86 prefix if present)
    const processedPhone =
      userInfo.phone && userInfo.phone.startsWith("+86")
        ? userInfo.phone.substring(3)
        : userInfo.phone || "";

    this.setData({
      teacherProfile: {
        phone: processedPhone,
        // email: userInfo.email || "",
        name: userInfo.name || "",
        username: userInfo.username || "",
        gender: userInfo.gender || "",
        id_number: userInfo.id_number || "",
        school_position: userInfo.school_position || "",
        credential: userInfo.credential || "",
        avatar: userInfo.avatar || "",
        credentialName: userInfo.credentialName || "",
      },
      // originalEmail: userInfo.email || "",
      originalPhone: processedPhone,
      // emailVerified: userInfo.email_verified || false,
      phoneVerified: userInfo.phone_verified || false,
    });

    this.validateProfileForm();
  },

  // Toggle edit mode for profile
  toggleProfileEdit: function () {
    this.setData({
      isEditingProfile: !this.data.isEditingProfile,
    });

    // Reset states when entering edit mode
    if (this.data.isEditingProfile) {
      this.setData({
        // emailChanged: false,
        phoneChanged: false,
        // emailCodeSent: false,
        phoneCodeSent: false,
        // enteredEmailCode: "",
        enteredPhoneCode: "",
        profileErrors: {},
      });
    }
  },

  // Handle profile form input changes
  onProfileInputChange: function (e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    // For picker components
    if (e.type === "change") {
      if (field === "gender") {
        const genders = ["", "male", "female"];
        this.setData({
          [`teacherProfile.${field}`]: genders[parseInt(value)],
        });
      }
    } else {
      // For input components
      this.setData({
        [`teacherProfile.${field}`]: value,
      });
    }

    // Check if email or phone is being changed
    // if (field === 'email') {
    //   this.setData({
    //     emailChanged: value !== this.data.originalEmail,
    //   });
    // } else if (field === 'phone') {
    if (field === "phone") {
      this.setData({
        phoneChanged: value !== this.data.originalPhone,
      });
    }

    // Clear error for this field
    const errors = { ...this.data.profileErrors };
    delete errors[field];
    this.setData({ profileErrors: errors });

    this.validateProfileForm();
  },

  // Handle gender selection
  onGenderChange: function (e) {
    const { value } = e.currentTarget.dataset;

    this.setData({
      "teacherProfile.gender": value,
    });

    // Clear error for gender field
    const errors = { ...this.data.profileErrors };
    delete errors.gender;
    this.setData({ profileErrors: errors });

    this.validateProfileForm();
  },
  // Validate profile form
  validateProfileForm: function () {
    const {
      teacherProfile,
      /* emailChanged, */ phoneChanged,
      /* emailVerified, */ phoneVerified,
    } = this.data;
    let formErrors = {};

    if (!teacherProfile.name) formErrors.name = "姓名为必填项";
    if (!teacherProfile.id_number) formErrors.id_number = "身份证号为必填项";
    if (!teacherProfile.school_position)
      formErrors.school_position = "学校职位为必填项";
    if (!teacherProfile.credential) formErrors.credential = "资格证书为必填项";
    if (!teacherProfile.gender) formErrors.gender = "请选择性别";

    // Email validation
    // if (teacherProfile.email && !/\S+@\S+\.\S+/.test(teacherProfile.email)) {
    //   formErrors.email = "邮箱格式不正确";
    // }

    // Phone validation
    if (teacherProfile.phone && !/\d{11}$/.test(teacherProfile.phone)) {
      formErrors.phone = "手机号格式不正确";
    }

    // Only validate phone if it's been changed and not verified
    // if (emailChanged && !emailVerified) {
    //   formErrors.email = "请验证电子邮箱";
    // }

    // Only validate email if it's been changed and not verified
    if (phoneChanged && !phoneVerified) {
      formErrors.phone = "请验证手机号码";
    }

    const isValid = Object.keys(formErrors).length === 0;

    this.setData({
      profileErrors: formErrors,
      profileFormValid: isValid,
    });

    return formErrors;
  },
  // Send email verification code
  // sendEmailVerificationCode: function() {
  //   if (!this.data.emailChanged || !this.data.teacherProfile.email) return;

  //   wx.showLoading({ title: "发送中..." });

  //   wx.request({
  //     url: `${config.BACKEND_URL}/verification/send_email_code`,
  //     method: "POST",
  //     data: {
  //       email: this.data.teacherProfile.email
  //     },
  //     header: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
  //     },
  //     success: (res) => {
  //       if (res.statusCode === 200 && res.data.status === "success") {
  //         wx.showToast({
  //           title: "验证码已发送",
  //           icon: "success"
  //         });
  //       } else {
  //         wx.showToast({
  //           title: res.data?.msg || "发送失败",
  //           icon: "none"
  //         });
  //       }
  //     },
  //     fail: () => {
  //       wx.showToast({
  //         title: "网络错误",
  //         icon: "none"
  //       });
  //     },
  //     complete: () => {
  //       wx.hideLoading();
  //     }
  //   });
  // },
  // Verify email code
  // verifyEmailCode: function() {
  //   if (!this.data.enteredEmailCode || !this.data.teacherProfile.email) {
  //     wx.showToast({
  //       title: "请输入验证码",
  //       icon: "none"
  //     });
  //     return;
  //   }

  //   wx.showLoading({ title: "验证中..." });

  //   wx.request({
  //     url: `${config.BACKEND_URL}/verification/verify_email_code`,
  //     method: "POST",
  //     data: {
  //       email: this.data.teacherProfile.email,
  //       code: this.data.enteredEmailCode
  //     },
  //     header: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
  //     },
  //     success: (res) => {
  //       if (res.statusCode === 200 && res.data.status === "success") {
  //         this.setData({
  //           emailVerified: true,
  //           emailCodeSent: false
  //         });
  //         wx.showToast({
  //           title: "邮箱验证成功",
  //           icon: "success"
  //         });
  //         this.validateProfileForm();
  //       } else {
  //         wx.showToast({
  //           title: res.data?.msg || "验证失败",
  //           icon: "none"
  //         });
  //       }
  //     },
  //     fail: () => {
  //       wx.showToast({
  //         title: "网络错误",
  //         icon: "none"
  //       });
  //     },
  //     complete: () => {
  //       wx.hideLoading();
  //     }
  //   });
  // },
  // Send phone verification code
  sendPhoneVerificationCode: function () {
    if (!this.data.phoneChanged || !this.data.teacherProfile.phone) return;

    wx.showLoading({ title: "发送中..." });

    wx.request({
      url: `${config.BACKEND_URL}/verification/send_phone_sms_code`,
      method: "POST",
      data: {
        phone: "+86" + this.data.teacherProfile.phone,
      },
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApp().globalData.userInfo?.token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.status === "success") {
          wx.showToast({
            title: "验证码已发送",
            icon: "success",
          });
        } else {
          wx.showToast({
            title: res.data?.msg || "发送失败",
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: "网络错误",
          icon: "none",
        });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },
  // Verify phone code
  verifyPhoneCode: function () {
    if (!this.data.enteredPhoneCode || !this.data.teacherProfile.phone) {
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
        phone: "+86" + this.data.teacherProfile.phone,
        code: this.data.enteredPhoneCode,
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
            title: "手机验证成功",
            icon: "success",
          });
          this.validateProfileForm();
        } else {
          wx.showToast({
            title: res.data?.msg || "验证失败",
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: "网络错误",
          icon: "none",
        });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },
  // Handle verification code input
  onEmailOtpInput: function (e) {
    this.setData({
      enteredEmailCode: e.detail.value,
    });
  },

  onPhoneOtpInput: function (e) {
    this.setData({
      enteredPhoneCode: e.detail.value,
    });
  },
  // Upload avatar with background upload
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

  // Upload credential file with background upload
  uploadCredential: function () {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      success: (res) => {
        const file = res.tempFiles[0];

        // Check file type
        const allowedTypes = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
        const fileExtension = file.name.split(".").pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
          wx.showToast({
            title: "请选择PDF、Word或图片文件",
            icon: "none",
          });
          return;
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({
            title: "文件不能超过10MB",
            icon: "none",
          });
          return;
        }

        this.setData({
          credentialFileName: file.name,
          credentialUploading: true,
          credentialUploadProgress: 0,
          credentialUploaded: false,
          credentialUploadError: null,
          credentialUploadUrl: null,
        });

        // Start background upload immediately
        this.uploadCredentialInBackground(file);
      },
      fail: (err) => {
        console.error("选择文件失败:", err);
        if (err.errMsg.includes("cancel")) {
          return;
        }
        wx.showToast({
          title: "文件选择失败",
          icon: "none",
        });
      },
    });
  },

  // View credential file
  viewCredentialFile: function () {
    if (this.data.teacherProfile.credentialName) {
      this.setData({
        showImageModal: true,
        previewImageUrl: this.data.teacherProfile.credentialName,
      });
    }
  },
  // Save profile changes
  saveProfile: function () {
    const errors = this.validateProfileForm();

    if (!this.data.profileFormValid || Object.keys(errors).length > 0) {
      this.setData({ profileErrors: errors });
      wx.showToast({
        title: "请完善所有必填信息",
        icon: "none",
      });
      return;
    }

    // Check if files are still uploading
    if (this.data.avatarUploading || this.data.credentialUploading) {
      wx.showLoading({
        title: "等待文件上传完成...",
        mask: true,
      });

      // Wait for uploads to complete
      this.waitForUploadsToComplete().then(() => {
        wx.hideLoading();
        if (this.data.avatarUploadError || this.data.credentialUploadError) {
          wx.showToast({
            title: "文件上传失败，请重试",
            icon: "none",
            duration: 2000,
          });
        } else {
          this.saveProfileWithUploads();
        }
      });
    } else {
      this.saveProfileWithUploads();
    }
  },

  // Save profile with uploaded file URLs
  saveProfileWithUploads: function () {
    wx.showLoading({
      title: "保存中...",
    });

    // Prepare form data using standard format
    const formData = {
      ...this.data.teacherProfile,
      phone: "+86" + this.data.teacherProfile.phone,
    };

    // Convert avatar to avatar_url for backend
    if (formData.avatar) {
      formData.avatar_url = formData.avatar;
      delete formData.avatar;
    }

    // Add uploaded file URLs (will override existing avatar_url if new upload)
    if (this.data.avatarUploadUrl) {
      formData.avatar_url = this.data.avatarUploadUrl;
    }

    if (this.data.credentialUploadUrl) {
      formData.credential_url = this.data.credentialUploadUrl;
    }

    this.updateProfile(formData);
  },

  // Background upload avatar to UCloud
  async uploadAvatarInBackground(tempFile) {
    console.log("Starting background avatar upload:", tempFile);

    try {
      // Progress callback
      const progressCallback = (progress) => {
        this.setData({
          avatarUploadProgress: progress,
        });
      };

      // Use uploadImageSimple for direct upload without blur
      console.log("Uploading avatar image...");
      const uploadResult = await ucloudUpload.uploadImageSimple(
        tempFile.tempFilePath,
        progressCallback,
        "teacher_avatars" // upload folder
      );

      console.log("Avatar upload result:", uploadResult);

      if (uploadResult && uploadResult.url) {
        this.setData({
          avatarUploading: false,
          avatarUploaded: true,
          avatarUploadUrl: uploadResult.url,
          avatarUploadError: null,
          "teacherProfile.avatar": uploadResult.url,
        });

        wx.showToast({
          title: "头像上传成功",
          icon: "success",
          duration: 1500,
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
        avatarUploadError: error.message || "上传失败",
      });

      wx.showToast({
        title: "头像上传失败",
        icon: "none",
        duration: 2000,
      });
    }
  },

  // Background upload credential to UCloud
  async uploadCredentialInBackground(file) {
    console.log("Starting background credential upload:", file);

    try {
      // Progress callback
      const progressCallback = (progress) => {
        this.setData({
          credentialUploadProgress: progress,
        });
      };

      // Determine file type and use appropriate upload method
      const fileExt = file.name.split(".").pop().toLowerCase();
      let uploadResult;

      if (["jpg", "jpeg", "png"].includes(fileExt)) {
        // Image credential
        uploadResult = await ucloudUpload.uploadImageSimple(
          file.path,
          progressCallback,
          "teacher_credentials"
        );
      } else {
        // Document file - use generic file upload
        const fileForUpload = {
          tempFilePath: file.path,
          name: file.name,
          size: file.size,
          type: "file",
        };

        uploadResult = await ucloudUpload.uploadMedia(
          fileForUpload,
          progressCallback,
          { upload: "teacher_credentials" }
        );
      }

      console.log("Credential upload result:", uploadResult);

      const finalUrl =
        uploadResult.url || uploadResult.uploadUrl || uploadResult.fileUrl;

      if (finalUrl) {
        this.setData({
          credentialUploading: false,
          credentialUploaded: true,
          credentialUploadUrl: finalUrl,
          credentialUploadError: null,
          "teacherProfile.credentialName": finalUrl,
        });

        wx.showToast({
          title: "证书上传成功",
          icon: "success",
          duration: 1500,
        });
      } else {
        throw new Error("上传结果无效");
      }
    } catch (error) {
      console.error("Credential upload failed:", error);

      this.setData({
        credentialUploading: false,
        credentialUploaded: false,
        credentialUploadUrl: null,
        credentialUploadError: error.message || "上传失败",
      });

      wx.showToast({
        title: "证书上传失败",
        icon: "none",
        duration: 2000,
      });
    }
  },

  // Wait for all uploads to complete
  waitForUploadsToComplete() {
    return new Promise((resolve) => {
      const checkInterval = 100;
      const maxWaitTime = 60000; // 60 seconds
      let waitTime = 0;

      const check = () => {
        const avatarDone = !this.data.avatarUploading;
        const credentialDone = !this.data.credentialUploading;

        if (avatarDone && credentialDone) {
          resolve();
        } else if (waitTime >= maxWaitTime) {
          // Timeout - mark any still uploading as failed
          if (this.data.avatarUploading) {
            this.setData({
              avatarUploading: false,
              avatarUploadError: "上传超时",
            });
          }
          if (this.data.credentialUploading) {
            this.setData({
              credentialUploading: false,
              credentialUploadError: "上传超时",
            });
          }
          resolve();
        } else {
          waitTime += checkInterval;
          setTimeout(check, checkInterval);
        }
      };

      check();
    });
  },

  // Update profile using standard endpoint
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
            teacherProfile: {
              ...this.data.teacherProfile,
              ...updatedUserInfo,
            },
            isEditingProfile: false,
            profileErrors: {},
            selectedAvatar:
              updatedUserInfo?.avatar || this.data.teacherProfile.avatar,
            // originalEmail: updatedUserInfo?.email || this.data.teacherProfile.email,
            originalPhone:
              updatedUserInfo?.phone?.replace("+86", "") ||
              this.data.teacherProfile.phone,
            // emailChanged: false,
            phoneChanged: false,
            // enteredEmailCode: "",
            enteredPhoneCode: "",
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
            title: "保存成功",
            icon: "success",
          });
        } else {
          wx.showToast({
            title: res.data?.msg || "保存失败",
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: "网络错误",
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
      profileErrors: {},
      // emailChanged: false,
      phoneChanged: false,
      emailVerified: true,
      phoneVerified: true,
      // enteredEmailCode: "",
      enteredPhoneCode: "",
      selectedAvatar: this.data.teacherProfile.avatar || "",
      credentialFile: null,
      credentialFileName: "",
      skipCredential: false,
    });
    this.loadTeacherProfile(); // Reload original data
  },

  // Handle logout
  handleLogout: function () {
    wx.showModal({
      title: "确认退出",
      content: "您确定要退出登录吗？",
      success: (res) => {
        if (res.confirm) {
          // Clear user data
          const app = getApp();
          app.globalData.userInfo = {};

          // Clear local storage
          wx.removeStorageSync("userInfo");
          wx.removeStorageSync("token");

          // Navigate to login page
          wx.reLaunch({
            url: "/pages/index/index",
          });
        }
      },
    });
  },

  // Phone number validation
  validatePhoneNumber: function (phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  },

  // Email validation
  validateEmail: function (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // ID number validation
  validateIdNumber: function (idNumber) {
    const idRegex =
      /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
    return idRegex.test(idNumber);
  },

  // Enhanced form validation with specific field validation
  validateProfileField: function (field, value) {
    const errors = { ...this.data.profileErrors };

    switch (field) {
      case "name":
        if (!value || value.trim().length < 2) {
          errors.name = "姓名至少需要2个字符";
        } else if (value.trim().length > 20) {
          errors.name = "姓名不能超过20个字符";
        } else {
          delete errors.name;
        }
        break;

      case "phone":
        if (!value) {
          errors.phone = "请输入手机号码";
        } else if (!this.validatePhoneNumber(value)) {
          errors.phone = "请输入有效的手机号码";
        } else {
          delete errors.phone;
        }
        break;

      case "email":
        if (!value) {
          errors.email = "请输入邮箱地址";
        } else if (!this.validateEmail(value)) {
          errors.email = "请输入有效的邮箱地址";
        } else {
          delete errors.email;
        }
        break;

      case "id_number":
        if (!value) {
          errors.id_number = "请输入身份证号";
        } else if (!this.validateIdNumber(value)) {
          errors.id_number = "请输入有效的身份证号";
        } else {
          delete errors.id_number;
        }
        break;

      case "school_position":
        if (!value || value.trim().length === 0) {
          errors.school_position = "请输入学校职位";
        } else {
          delete errors.school_position;
        }
        break;

      case "credential":
        if (!value || value.trim().length === 0) {
          errors.credential = "请输入资格证书";
        } else {
          delete errors.credential;
        }
        break;

      case "gender":
        if (!value || value === "") {
          errors.gender = "请选择性别";
        } else {
          delete errors.gender;
        }
        break;
    }

    this.setData({ profileErrors: errors });
    return Object.keys(errors).length === 0;
  },

  // Check if profile data has been modified
  hasProfileChanges: function () {
    const { teacherProfile, originalEmail, originalPhone } = this.data;
    const originalData = getApp().globalData.userInfo || {};

    return (
      teacherProfile.name !== (originalData.name || "") ||
      // teacherProfile.email !== originalEmail ||
      teacherProfile.phone !== originalPhone ||
      teacherProfile.gender !== (originalData.gender || "") ||
      teacherProfile.id_number !== (originalData.id_number || "") ||
      teacherProfile.school_position !== (originalData.school_position || "") ||
      teacherProfile.credential !== (originalData.credential || "") ||
      this.data.selectedAvatar ||
      this.data.credentialFile
    );
  },
  // Clean up profile resources
  cleanupProfileResources: function () {
    // Revoke any blob URLs created for avatar preview
    if (
      this.data.selectedAvatar &&
      this.data.selectedAvatar.startsWith("blob:")
    ) {
      URL.revokeObjectURL(this.data.selectedAvatar);
    }
  },

  // WeChat linking functionality
  async linkWechat() {
    if (this.data.wechatLinking) return;

    try {
      this.setData({ wechatLinking: true });

      // Get WeChat login code
      const loginResult = await this.promiseWrapper(wx.login);
      if (!loginResult.code) {
        throw new Error("获取微信授权码失败");
      }

      // Send link request to backend
      const response = await this.requestWechatLink(loginResult.code);

      if (response.status === "success") {
        // Update user info with WeChat data
        const app = getApp();
        const updatedUserInfo = { ...this.data.userInfo, ...response.user };
        app.setState("userInfo", updatedUserInfo);
        wx.setStorageSync("userInfo", updatedUserInfo);

        this.setData({
          userInfo: updatedUserInfo,
          isWechatLinked: true,
        });

        wx.showToast({
          title: "微信绑定成功",
          icon: "success",
        });
      } else {
        throw new Error(response.msg || "绑定失败");
      }
    } catch (error) {
      console.error("WeChat linking error:", error);
      wx.showToast({
        title: error.message || "微信绑定失败",
        icon: "none",
      });
    } finally {
      this.setData({ wechatLinking: false });
    }
  },

  async unlinkWechat() {
    try {
      const result = await this.showConfirmDialog(
        "解除绑定",
        "确定要解除微信绑定吗？解除后您将无法使用微信登录。"
      );

      if (!result.confirm) return;

      const response = await this.requestWechatUnlink();

      if (response.status === "success") {
        // Update user info
        const app = getApp();
        const updatedUserInfo = {
          ...this.data.userInfo,
          wechat_openid: null,
          wechat_unionid: null,
        };
        app.setState("userInfo", updatedUserInfo);
        wx.setStorageSync("userInfo", updatedUserInfo);

        this.setData({
          userInfo: updatedUserInfo,
          isWechatLinked: false,
        });

        wx.showToast({
          title: "解除绑定成功",
          icon: "success",
        });
      } else {
        throw new Error(response.msg || "解除绑定失败");
      }
    } catch (error) {
      console.error("WeChat unlinking error:", error);
      wx.showToast({
        title: error.message || "解除绑定失败",
        icon: "none",
      });
    }
  },

  // API calls for WeChat linking
  requestWechatLink(code) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/user/link-wechat`,
        method: "POST",
        data: { code },
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.data.userInfo.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.msg || "请求失败"));
          }
        },
        fail: reject,
      });
    });
  },

  requestWechatUnlink() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${config.BACKEND_URL}/user/unlink-wechat`,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.data.userInfo.token}`,
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.msg || "请求失败"));
          }
        },
        fail: reject,
      });
    });
  },

  // Utility methods
  promiseWrapper(fn, options = {}) {
    return new Promise((resolve, reject) => {
      fn({
        ...options,
        success: resolve,
        fail: reject,
      });
    });
  },

  showConfirmDialog(title, content) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        success: resolve,
      });
    });
  },

  // Check WeChat link status on load
  checkWechatLinkStatus() {
    const { userInfo } = this.data;
    const isLinked = !!userInfo?.wechat_openid;
    this.setData({ isWechatLinked: isLinked });
  },

  // Contact form handlers
  onContactInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`contactForm.${field}`]: value,
    });
  },

  async submitContact() {
    const { title, description } = this.data.contactForm;

    if (!title || !description) {
      wx.showToast({
        title: "请填写标题和描述",
        icon: "none",
      });
      return;
    }

    wx.showLoading({ title: "提交中..." });

    try {
      const res = await wx.request({
        url: config.BASE_URL + "/api/add-contact",
        method: "POST",
        header: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + wx.getStorageSync("token"),
        },
        data: {
          title,
          description,
        },
      });

      if (res.data.status === "success") {
        wx.showToast({
          title: "提交成功",
          icon: "success",
        });

        // Clear form
        this.setData({
          contactForm: {
            title: "",
            description: "",
          },
        });
      } else {
        throw new Error(res.data.message || "提交失败");
      }
    } catch (error) {
      console.error("Submit contact error:", error);
      wx.showToast({
        title: error.message || "提交失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },
});
