// components/search-bar/search-bar.js
Component({
  properties: {},
  
  data: {
    searchValue: ''
  },
  
  methods: {
    onInput: function(e) {
      this.setData({
        searchValue: e.detail.value
      });
    },
    
    onSearch: function(e) {
      const value = this.data.searchValue;
      if (value.trim()) {
        this.triggerEvent('search', { value });
        
        // Navigate to search results page
        wx.navigateTo({
          url: `/pages/search/search?keyword=${encodeURIComponent(value)}`
        });
      }
    },
    
    onClear: function() {
      this.setData({
        searchValue: ''
      });
    }
  }
});