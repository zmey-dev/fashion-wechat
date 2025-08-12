const { default: config } = require("../../config");

Component({
  properties: {
    currentPage: {
      type: String,
      value: "",
    }
  },

  data: {
    filter: "",
    selectedUniversity: "",
    selectedUniversityName: "所有大学",
    universities: [],
    showDropdown: false,
    isDiscoverPage: false,
    hasFilters: false,
  },

  lifetimes: {
    attached() {
      // Load universities data when component is attached
      this.loadUniversities();
      // Update discover page status
      this.updateDiscoverPageStatus();
    }
  },

  observers: {
    currentPage(newVal) {
      this.updateDiscoverPageStatus();
    },
    'filter, selectedUniversity': function(filter, selectedUniversity) {
      this.setData({
        hasFilters: !!(filter || selectedUniversity)
      });
    },
    'selectedUniversity, universities': function(selectedUniversity, universities) {
      this.updateSelectedUniversityName();
    }
  },

  methods: {
    updateDiscoverPageStatus() {
      const isDiscoverPage = this.data.currentPage === "discover";
      this.setData({ isDiscoverPage });
      
      // Only load universities when on discover page
      if (isDiscoverPage && this.data.universities.length === 0) {
        this.loadUniversities();
      }
    },

    updateSelectedUniversityName() {
      const { selectedUniversity, universities } = this.data;
      let selectedUniversityName = "所有大学";
      
      if (selectedUniversity && universities.length > 0) {
        const university = universities.find(u => u.id == selectedUniversity);
        if (university) {
          selectedUniversityName = university.name;
        }
      }
      
      this.setData({
        selectedUniversityName: selectedUniversityName
      });
    },

    async loadUniversities() {
      try {
        const res = await this.request({
          url: `${config.BACKEND_URL}/university`,
          method: 'GET'
        });

        if (res.statusCode === 200 && res.data.status === "success") {
          this.setData({
            universities: res.data.universities || []
          });
          // Update university name after loading universities
          this.updateSelectedUniversityName();
        }
      } catch (error) {
        console.error("Failed to load universities:", error);
      }
    },

    // Promise wrapper for wx.request
    request(options) {
      return new Promise((resolve, reject) => {
        wx.request({
          ...options,
          success: resolve,
          fail: reject
        });
      });
    },

    onFilterInput(e) {
      this.setData({
        filter: e.detail.value
      });
    },

    onUniversityTap() {
      if (!this.data.isDiscoverPage) return;
      
      this.setData({
        showDropdown: !this.data.showDropdown
      });
    },

    onUniversitySelect(e) {
      if (!this.data.isDiscoverPage) return;
      
      const universityId = e.currentTarget.dataset.id || "";
      this.setData({
        selectedUniversity: universityId,
        showDropdown: false
      });
      
      // Update university name
      this.updateSelectedUniversityName();
      
      // Immediately trigger search with current filter and new university
      this.handleSearch();
    },

    onDropdownMaskTap() {
      this.setData({
        showDropdown: false
      });
    },

    onSearchTap() {
      this.handleSearch();
    },

    onClearTap() {
      this.setData({
        filter: "",
        selectedUniversity: ""
      });
      
      // Only trigger search if on discover page
      if (this.data.isDiscoverPage) {
        this.triggerEvent('search', {
          search: "",
          university_id: ""
        });
      }
    },

    handleSearch() {
      const { filter, selectedUniversity, isDiscoverPage } = this.data;
      
      // Build search parameters
      const params = {};
      if (filter) params.search = filter;
      if (selectedUniversity) params.university_id = selectedUniversity;
      
      if (isDiscoverPage) {
        // If on discover page, emit search event to parent
        this.triggerEvent('search', params);
      } else {
        // If on other pages, navigate to discover page with search params
        this.navigateToDiscover(params);
      }
    },

    navigateToDiscover(params) {
      wx.switchTab({
        url: '/pages/index/index',
        success: () => {
          // Store search params for the discover page to pick up
          if (params.search || params.university_id) {
            getApp().globalData.pendingSearch = params;
          }
        }
      });
    },

    onKeyboardConfirm() {
      this.handleSearch();
    }
  }
});