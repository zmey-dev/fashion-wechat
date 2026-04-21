const { default: config } = require("../../config");
const { isContainSword } = require("../../utils/isContainSword");
const ucloudUpload = require("../../services/ucloudUpload");

const app = getApp();

Page({
  data: {
    categories: [
      { label: "新鲜事", value: "新鲜事" },
      { label: "日常投稿", value: "日常投稿" },
      { label: "二手闲置", value: "二手闲置" },
    ],
    selectedCategory: "",
    campusData: [],
    selectedCampusId: null,
    title: "",
    content: "",
    mediaFiles: [],
    isSubmitting: false,
    canSubmit: false,
  },

  onLoad() {
    this.loadCampuses();
  },

  loadCampuses() {
    wx.request({
      url: `${config.BACKEND_URL}/campus`,
      method: "GET",
      success: (res) => {
        if (res.data.status === "success") {
          this.setData({ campusData: res.data.data || [] });
        }
      },
    });
  },

  onClose() {
    wx.navigateBack({ delta: 1 });
  },

  onCategoryTap(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({
      selectedCategory: this.data.selectedCategory === value ? "" : value,
    });
    this.checkCanSubmit();
  },

  onCampusTap(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      selectedCampusId: this.data.selectedCampusId === id ? null : id,
    });
  },

  onTitleInput(e) {
    const value = e.detail.value;
    if (isContainSword(value)) {
      wx.showToast({ title: "请避免使用不当语言", icon: "none" });
      return;
    }
    this.setData({ title: value });
    this.checkCanSubmit();
  },

  onContentInput(e) {
    const value = e.detail.value;
    if (isContainSword(value)) {
      wx.showToast({ title: "请避免使用不当语言", icon: "none" });
      return;
    }
    this.setData({ content: value });
    this.checkCanSubmit();
  },

  checkCanSubmit() {
    const { selectedCategory, title, content } = this.data;
    this.setData({
      canSubmit: selectedCategory && title.trim() && content.trim(),
    });
  },

  onAddMedia() {
    const remaining = 10 - this.data.mediaFiles.length;
    wx.chooseMedia({
      count: remaining,
      mediaType: ["image", "video"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const newFiles = res.tempFiles.map((file) => ({
          tempFilePath: file.tempFilePath,
          type: file.fileType || (file.tempFilePath.match(/\.(mp4|mov|avi)$/i) ? "video" : "image"),
          size: file.size,
          thumbTempFilePath: file.thumbTempFilePath || "",
          uploaded: false,
          url: "",
          previewUrl: "",
        }));
        this.setData({
          mediaFiles: [...this.data.mediaFiles, ...newFiles],
        });
      },
    });
  },

  onRemoveMedia(e) {
    const { index } = e.currentTarget.dataset;
    const files = [...this.data.mediaFiles];
    files.splice(index, 1);
    this.setData({ mediaFiles: files });
  },

  async uploadAllMedia() {
    const files = this.data.mediaFiles;
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.uploaded && file.url) {
        results.push(file);
        continue;
      }

      try {
        const uploadResult = await ucloudUpload.uploadMedia(file);
        results.push({
          ...file,
          uploaded: true,
          url: uploadResult.url,
          previewUrl: uploadResult.previewUrl || uploadResult.blurUrl || uploadResult.url,
        });
      } catch (err) {
        wx.showToast({ title: `第${i + 1}个文件上传失败`, icon: "none" });
        return null;
      }
    }

    return results;
  },

  async onSubmit() {
    const { selectedCategory, selectedCampusId, title, content, mediaFiles } = this.data;
    const userInfo = app.globalData.userInfo;

    if (!userInfo || !userInfo.token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    if (!selectedCategory || !title.trim() || !content.trim()) {
      wx.showToast({ title: "请填写必填项", icon: "none" });
      return;
    }

    this.setData({ isSubmitting: true });

    let fileUrls = [];
    let previewFileUrls = [];
    let postType = "text";

    if (mediaFiles.length > 0) {
      const uploaded = await this.uploadAllMedia();
      if (!uploaded) {
        this.setData({ isSubmitting: false });
        return;
      }

      const hasVideo = uploaded.some((f) => f.type === "video");
      postType = hasVideo ? "video" : "image";
      fileUrls = uploaded.map((f) => f.url);
      previewFileUrls = uploaded.map((f) => f.previewUrl);
    }

    const postData = {
      title: title.trim(),
      content: content.trim(),
      type: postType,
      category: selectedCategory,
      file_urls: fileUrls.length > 0 ? fileUrls : undefined,
      preview_file_urls: previewFileUrls.length > 0 ? previewFileUrls : undefined,
    };

    if (selectedCampusId) {
      postData.campus_id = selectedCampusId;
    }

    wx.request({
      url: `${config.BACKEND_URL}/post/create`,
      method: "POST",
      data: postData,
      header: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userInfo.token}`,
      },
      success: (res) => {
        if (res.data.status === "success") {
          wx.showToast({ title: "发布成功", icon: "success" });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.data.msg || "发布失败",
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({ title: "网络错误", icon: "none" });
      },
      complete: () => {
        this.setData({ isSubmitting: false });
      },
    });
  },
});
