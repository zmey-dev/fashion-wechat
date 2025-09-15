const { default: config } = require("../../config");

Component({
  properties: {
    currentPage: {
      type: String,
      value: "",
    },
    searchParams: {
      type: Object,
      value: {},
      observer: function(newParams, oldParams) {
        
        // Only call setSearchParams if newParams actually contains search data
        if (newParams && (newParams.search || newParams.university_id)) {
          // Only update if params actually changed
          if (JSON.stringify(newParams) !== JSON.stringify(oldParams)) {
            this.setSearchParams(newParams);
          } else {
          }
        } else {
        }
      }
    },
    autoFocus: {
      type: Boolean,
      value: false
    }
  },

  data: {
    filter: "",
    selectedUniversity: "",
    selectedUniversityName: "全部学校",
    universities: [],
    filteredUniversities: [], // Filtered university list for display
    universitySearchText: "", // Search text for filtering universities
    showDropdown: false,
    hasFilters: false,
  },

  lifetimes: {
    attached() {
      
      // Load universities data when component is attached
      this.loadUniversities();
      // Update discover page status
      this.updateDiscoverPageStatus();
    },

    ready() {
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
      // Load universities on all pages
      if (this.data.universities.length === 0) {
        this.loadUniversities();
      }
    },

    updateSelectedUniversityName() {
      const { selectedUniversity, universities } = this.data;
      let selectedUniversityName = "全部学校";
      
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
          const universities = res.data.universities || [];
          this.setData({
            universities: universities,
            filteredUniversities: this.filterUniversities(universities, "")
          });
          // Update university name after loading universities
          this.updateSelectedUniversityName();
          
          // If there's a pending university ID, update the name
          if (this.pendingUniversityId) {
            const university = universities.find(u => u.id == this.pendingUniversityId);
            if (university) {
              this.setData({
                selectedUniversityName: university.name
              });
            } else {
            }
            this.pendingUniversityId = null;
          }
        }
      } catch (error) {
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
      this.setData({
        showDropdown: !this.data.showDropdown
      });
    },

    onUniversitySelect(e) {
      const universityId = e.currentTarget.dataset.id || "";
      
      this.setData({
        selectedUniversity: universityId,
        showDropdown: false
      });
      
      // Update university name
      this.updateSelectedUniversityName();
      
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
        filter: ""
      });
    },

    handleSearch() {
      const { filter, selectedUniversity, selectedUniversityName } = this.data;
      
      
      // Build search parameters
      const params = {};
      if (filter) params.search = filter;
      if (selectedUniversity) params.university_id = selectedUniversity;
      
      
      // Always emit search event to app-layout (unified handling)
      this.triggerEvent('search', params);
    },


    onKeyboardConfirm() {
      this.handleSearch();
    },

    // Set search parameters from external source (e.g., pending search)
    setSearchParams(params) {
      
      const updateData = {};
      
      // Only update if values are provided, otherwise keep current values
      if (params.search !== undefined) {
        updateData.filter = params.search || "";
      }
      
      if (params.university_id !== undefined) {
        updateData.selectedUniversity = params.university_id || "";
        
        if (params.university_id) {
          // Find university name if universities are loaded
          if (this.data.universities.length > 0) {
            const university = this.data.universities.find(u => u.id == params.university_id);
            if (university) {
              updateData.selectedUniversityName = university.name;
            } else {
              updateData.selectedUniversityName = "全部学校";
            }
          } else {
            // If universities not loaded yet, set a flag to update name later
            this.pendingUniversityId = params.university_id;
          }
        } else {
          updateData.selectedUniversityName = "全部学校";
        }
      }
      
      // Update hasFilters
      const hasSearch = (updateData.filter !== undefined ? updateData.filter : this.data.filter);
      const hasUniversity = (updateData.selectedUniversity !== undefined ? updateData.selectedUniversity : this.data.selectedUniversity);
      updateData.hasFilters = !!(hasSearch || hasUniversity);
      
      this.setData(updateData);
    },

    // Filter universities based on search text (show top 5 results)
    filterUniversities(universities, searchText) {
      if (!searchText) {
        // Show all universities if no search text (but limit to reasonable number)
        return universities.slice(0, 20);
      }
      
      const filtered = universities.filter(university => 
        university.name.toLowerCase().includes(searchText.toLowerCase())
      );
      
      // Return top 5 results
      return filtered.slice(0, 5);
    },

    // Handle university search input
    onUniversitySearchInput(e) {
      const searchText = e.detail.value;
      
      this.setData({
        universitySearchText: searchText,
        filteredUniversities: this.filterUniversities(this.data.universities, searchText)
      });
    },

    // Clear university search
    onClearUniversitySearch() {
      this.setData({
        universitySearchText: "",
        filteredUniversities: this.filterUniversities(this.data.universities, "")
      });
    }
  }
});