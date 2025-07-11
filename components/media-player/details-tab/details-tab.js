Component({
  properties: {
    selectedDot: {
      type: Object,
      value: null,
      observer: function (newVal) {
        if (newVal && newVal.description) {
          this.processDescription(newVal.description);
        } else {
          this.setData({
            descriptionWithLinks: [],
          });
        }
      },
    },
    currentPost: { type: Object, value: null },
    currentPostUser: { type: Object, value: null },
  },

  data: {
    descriptionWithLinks: [],
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
            type: "text",
            text: description.substring(lastIndex, match.index),
          });
        }

        // Add the URL as a clickable link
        nodes.push({
          type: "text",
          text: match[0],
          attrs: {
            style: "color: #4299E1; text-decoration: underline;",
            "data-url": match[0],
          },
        });

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text after the last URL
      if (lastIndex < description.length) {
        nodes.push({
          type: "text",
          text: description.substring(lastIndex),
        });
      }

      this.setData({
        descriptionWithLinks: nodes,
      });
    },

    // Handle tap on the rich-text component
    onLinkTap(e) {
      // Get the tapped position
      const x = e.detail.x || e.touches[0].clientX;
      const y = e.detail.y || e.touches[0].clientY;

      // Check if the description exists
      const description = this.data.selectedDot?.description;
      if (!description) return;

      // Use description as URL directly and copy to clipboard
      wx.setClipboardData({
        data: description,
        success: () => {
          wx.showModal({
            title: "Link Copied",
            content: `Link ${description} has been copied to clipboard. You can open it in your browser.`,
            showCancel: false,
            confirmText: "OK",
          });
        },
        fail: () => {
          wx.showToast({
            title: "Copy Failed",
            icon: "none",
          });
        },
      });
    },
  },
});
