Component({
  properties: {
    selectedDot: { 
      type: Object, 
      value: null,
      observer: function(newVal) {
        if (newVal && newVal.description) {
          this.processDescription(newVal.description);
        } else {
          this.setData({
            descriptionWithLinks: []
          });
        }
      }
    },
    currentPost: { type: Object, value: null },
    currentPostUser: { type: Object, value: null }
  },

  data: {
    descriptionWithLinks: []
  },

  methods: {
    // Process description text to detect URLs and create rich-text nodes
    processDescription(description) {
      if (!description) {
        this.setData({ descriptionWithLinks: [] });
        return;
      }

      // Regular expression to match URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const nodes = [];
      let lastIndex = 0;
      let match;

      while ((match = urlRegex.exec(description)) !== null) {
        // Add text before the URL
        if (match.index > lastIndex) {
          nodes.push({
            type: 'text',
            text: description.substring(lastIndex, match.index)
          });
        }

        // Add the URL as a clickable link
        nodes.push({
          type: 'text',
          text: match[0],
          attrs: {
            style: 'color: #4299E1; text-decoration: underline;',
            'data-url': match[0]
          }
        });

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text after the last URL
      if (lastIndex < description.length) {
        nodes.push({
          type: 'text',
          text: description.substring(lastIndex)
        });
      }

      this.setData({
        descriptionWithLinks: nodes
      });
    },

    // Handle tap on the rich-text component
    onLinkTap(e) {
      // Get the tapped position
      const x = e.detail.x || e.touches[0].clientX;
      const y = e.detail.y || e.touches[0].clientY;
      
      // Check if the tap was on a URL
      const description = this.data.selectedDot?.description;
      if (!description) return;

      // Find URLs in the description
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = description.match(urlRegex);
      
      if (urls && urls.length > 0) {
        // For simplicity, we'll open the first URL found
        // In a more sophisticated implementation, you would determine which URL was clicked
        const url = urls[0];
        
        // Copy URL to clipboard and show options
        wx.setClipboardData({
          data: url,
          success: () => {
            wx.showModal({
              title: '链接已复制',
              content: `链接 ${url} 已复制到剪贴板。您可以在浏览器中打开它。`,
              showCancel: false,
              confirmText: '好的'
            });
          },
          fail: () => {
            wx.showToast({
              title: '复制失败',
              icon: 'none'
            });
          }
        });
      }
    }
  }
});