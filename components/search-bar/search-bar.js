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
        console.log('searchParams observer - newParams:', newParams, 'oldParams:', oldParams);
        console.log('newParams has content:', !!(newParams && (newParams.search || newParams.university_id)));
        
        // Only call setSearchParams if newParams actually contains search data
        if (newParams && (newParams.search || newParams.university_id)) {
          // Only update if params actually changed
          if (JSON.stringify(newParams) !== JSON.stringify(oldParams)) {
            console.log('Search params changed, calling setSearchParams');
            this.setSearchParams(newParams);
          } else {
            console.log('Search params unchanged, skipping update');
          }
        } else {
          console.log('No search params to apply, keeping current user input');
        }
      }
    }
  },

  data: {
    filter: "",
    selectedUniversity: "",
    selectedUniversityName: "所有大学",
    universities: [],
    filteredUniversities: [], // Filtered university list for display
    universitySearchText: "", // Search text for filtering universities
    showDropdown: false,
    hasFilters: false,
  },

  lifetimes: {
    attached() {
      console.log('=== search-bar attached ===');
      console.log('Initial data state:', {
        filter: this.data.filter,
        selectedUniversity: this.data.selectedUniversity,
        selectedUniversityName: this.data.selectedUniversityName,
        currentPage: this.data.currentPage
      });
      
      // Load universities data when component is attached
      this.loadUniversities();
      // Update discover page status
      this.updateDiscoverPageStatus();
    },

    ready() {
      console.log('=== search-bar ready ===');
      console.log('Ready state:', {
        filter: this.data.filter,
        selectedUniversity: this.data.selectedUniversity,
        selectedUniversityName: this.data.selectedUniversityName,
        universities: this.data.universities.length
      });
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
          const universities = res.data.universities || [];
          this.setData({
            universities: universities,
            filteredUniversities: this.filterUniversities(universities, "")
          });
          // Update university name after loading universities
          this.updateSelectedUniversityName();
          
          // If there's a pending university ID, update the name
          if (this.pendingUniversityId) {
            console.log('Processing pendingUniversityId:', this.pendingUniversityId);
            const university = universities.find(u => u.id == this.pendingUniversityId);
            if (university) {
              console.log('Found pending university:', university.name);
              this.setData({
                selectedUniversityName: university.name
              });
            } else {
              console.log('Pending university not found in loaded universities');
            }
            this.pendingUniversityId = null;
          }
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
      console.log('onFilterInput called with value:', e.detail.value);
      this.setData({
        filter: e.detail.value
      });
      console.log('Filter updated to:', this.data.filter);
    },

    onUniversityTap() {
      this.setData({
        showDropdown: !this.data.showDropdown
      });
    },

    onUniversitySelect(e) {
      const universityId = e.currentTarget.dataset.id || "";
      console.log('onUniversitySelect called with ID:', universityId);
      
      this.setData({
        selectedUniversity: universityId,
        showDropdown: false
      });
      
      // Update university name
      this.updateSelectedUniversityName();
      
      console.log('University selection updated:', {
        selectedUniversity: this.data.selectedUniversity,
        selectedUniversityName: this.data.selectedUniversityName
      });
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
        selectedUniversity: "",
        selectedUniversityName: "所有大学"
      });
    },

    handleSearch() {
      const { filter, selectedUniversity, selectedUniversityName } = this.data;
      
      console.log('handleSearch called with current search-bar state:');
      console.log('  filter:', filter);
      console.log('  selectedUniversity:', selectedUniversity);
      console.log('  selectedUniversityName:', selectedUniversityName);
      
      // Build search parameters
      const params = {};
      if (filter) params.search = filter;
      if (selectedUniversity) params.university_id = selectedUniversity;
      
      console.log('Built search params to emit:', params);
      
      // Always emit search event to app-layout (unified handling)
      this.triggerEvent('search', params);
    },


    onKeyboardConfirm() {
      this.handleSearch();
    },

    // Set search parameters from external source (e.g., pending search)
    setSearchParams(params) {
      console.log('setSearchParams called with:', params);
      console.log('Current universities:', this.data.universities.length);
      console.log('Current state before update:', {
        filter: this.data.filter,
        selectedUniversity: this.data.selectedUniversity,
        selectedUniversityName: this.data.selectedUniversityName
      });
      
      const updateData = {};
      
      // Only update if values are provided, otherwise keep current values
      if (params.search !== undefined) {
        updateData.filter = params.search || "";
        console.log('Setting filter to:', updateData.filter);
      }
      
      if (params.university_id !== undefined) {
        updateData.selectedUniversity = params.university_id || "";
        console.log('Setting selectedUniversity to:', updateData.selectedUniversity);
        
        if (params.university_id) {
          // Find university name if universities are loaded
          if (this.data.universities.length > 0) {
            const university = this.data.universities.find(u => u.id == params.university_id);
            if (university) {
              updateData.selectedUniversityName = university.name;
              console.log('Found university name:', university.name);
            } else {
              console.log('University not found in list for ID:', params.university_id);
              updateData.selectedUniversityName = "所有大学";
            }
          } else {
            // If universities not loaded yet, set a flag to update name later
            this.pendingUniversityId = params.university_id;
            console.log('Universities not loaded, setting pendingUniversityId:', params.university_id);
          }
        } else {
          updateData.selectedUniversityName = "所有大学";
        }
      }
      
      // Update hasFilters
      const hasSearch = (updateData.filter !== undefined ? updateData.filter : this.data.filter);
      const hasUniversity = (updateData.selectedUniversity !== undefined ? updateData.selectedUniversity : this.data.selectedUniversity);
      updateData.hasFilters = !!(hasSearch || hasUniversity);
      
      this.setData(updateData);
      console.log('Search bar updated with final data:', updateData);
      console.log('Current search bar state after update:', {
        filter: this.data.filter,
        selectedUniversity: this.data.selectedUniversity,
        selectedUniversityName: this.data.selectedUniversityName
      });
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
      console.log('University search input:', searchText);
      
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