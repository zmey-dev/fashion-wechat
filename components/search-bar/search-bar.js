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
      if (!this.data.isDiscoverPage) return;
      
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
      if (!this.data.isDiscoverPage) return;
      this.handleSearch();
    },

    onClearTap() {
      if (!this.data.isDiscoverPage) return;
      
      this.setData({
        filter: "",
        selectedUniversity: ""
      });
      
      // Trigger search with cleared parameters
      this.triggerEvent('search', {
        search: "",
        university_id: ""
      });
    },

    handleSearch() {
      const { filter, selectedUniversity } = this.data;
      
      // Build search parameters
      const params = {};
      if (filter) params.search = filter;
      if (selectedUniversity) params.university_id = selectedUniversity;
      
      // Emit search event to parent
      this.triggerEvent('search', params);
    },

    onKeyboardConfirm() {
      if (!this.data.isDiscoverPage) return;
      this.handleSearch();
    }
  }
});