// event.js
Page({
  data: {
    currentEventIndex: 0,
    showRulesModal: false,
    selectedEvent: null,
    events: [
      {
        id: 1,
        title: "Photography Contest 2025",
        poster_image: "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=800&h=600&fit=crop",
        start_date: "2025-06-01",
        end_date: "2025-06-30",
        students_count: 128,
        limit: 200,
        allow_limit: true,
        allow_other_school: true,
        description: "Join our annual photography contest and showcase your creative vision. This competition is open to all photography enthusiasts who want to display their artistic talent and compete for prestigious awards.",
        user: {
          university: {
            name: "Beijing University"
          }
        }
      },
      {
        id: 2,
        title: "Digital Art Exhibition",
        poster_image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop",
        start_date: "2025-07-01",
        end_date: "2025-07-15",
        students_count: 85,
        limit: 150,
        allow_limit: true,
        allow_other_school: false,
        description: "Experience cutting-edge digital artworks from talented students. Witness the intersection of technology and creativity in this comprehensive exhibition featuring interactive installations and digital masterpieces.",
        user: {
          university: {
            name: "Tsinghua University"
          }
        }
      },
      {
        id: 3,
        title: "International Music Festival",
        poster_image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop",
        start_date: "2025-08-01",
        end_date: "2025-08-03",
        students_count: 256,
        limit: 300,
        allow_limit: true,
        allow_other_school: true,
        description: "Three days of exceptional musical performances featuring student orchestras, jazz ensembles, and contemporary bands. Experience diverse musical genres and cultural exchanges through this prestigious festival.",
        user: {
          university: {
            name: "Shanghai University"
          }
        }
      }
    ],
    pastEvents: [
      {
        id: 4,
        title: "Spring Dance Competition",
        poster_image: "https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=400&h=300&fit=crop",
        students_count: 95,
        limit: 120,
        allow_limit: true,
        end_date: "2025-04-15",
        user: {
          university: {
            name: "Beijing University"
          }
        }
      },
      {
        id: 5,
        title: "Literature Reading Festival",
        poster_image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop",
        students_count: 67,
        limit: 80,
        allow_limit: true,
        end_date: "2025-03-20",
        user: {
          university: {
            name: "Tsinghua University"
          }
        }
      }
    ]
  },

  onLoad(options) {
    // Initialize selected event
    if (this.data.events.length > 0) {
      this.setData({
        selectedEvent: this.data.events[0]
      });
    }
  },

  // Handle swiper change
  onSwiperChange(e) {
    const currentIndex = e.detail.current;
    this.setData({
      currentEventIndex: currentIndex,
      selectedEvent: this.data.events[currentIndex]
    });
  },

  // Handle event card selection
  onEventSelect(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentEventIndex: index,
      selectedEvent: this.data.events[index]
    });
  },

  // Handle participate button
  onParticipate() {
    const event = this.data.selectedEvent;
    if (!event) return;

    // Check if event is full
    if (event.allow_limit && event.students_count >= event.limit) {
      wx.showToast({
        title: 'Event is at full capacity',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // Show rules modal
    this.setData({
      showRulesModal: true
    });
  },

  // Close rules modal
  onCloseRulesModal() {
    this.setData({
      showRulesModal: false
    });
  },

  // Handle rules agreement
  onAgreeRules() {
    this.setData({
      showRulesModal: false
    });
    
    // Navigate to event detail page
    wx.navigateTo({
      url: `/pages/event-detail/event-detail?eventId=${this.data.selectedEvent.id}`
    });
  },

  // Format date function
  formatDate(dateString) {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
});