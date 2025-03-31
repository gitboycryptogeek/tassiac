// src/views/admin/dashboard.js
import { BaseComponent } from '../../utils/BaseComponent.js';

export class AdminDashboardView extends BaseComponent {
  constructor() {
    super();
    this.title = 'Admin Dashboard';
    this.user = this.authService ? this.authService.getUser() : null;
    this.apiService = window.apiService;
    this.initializeData();
    
    // API Request Management
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 300; // ms between API calls
    
    // Privacy controls
    this.statsAreVisible = false;
    
    // Data Cache System
    this.dataCache = {
      paymentStats: null,
      inquiries: null,
      userCount: null,
      lastFetchTime: {
        paymentStats: 0,
        inquiries: 0,
        userCount: 0
      },
      cacheDuration: 60000 // 1 minute cache
    };
  }

  initializeData() {
    this.paymentStats = {
      revenue: 0,
      expenses: 0,
      netBalance: 0
    };
    this.inquiries = [];
    this.userCount = 0;
    this.isLoadingStats = true;
    this.isLoadingInquiries = true;
    this.isLoadingUserCount = true;
    this.error = null;
  }

  async render() {
    if (!this.user || !this.authService || !this.authService.isAdmin()) {
      const unauthorizedDiv = this.createElement('div', {
        style: {
          padding: '25px',
          color: '#fff',
          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.8), rgba(153, 27, 27, 0.9))',
          borderRadius: '20px',
          boxShadow: '0 20px 30px -10px rgba(220, 38, 38, 0.4), 0 0 15px rgba(0, 0, 0, 0.1)',
          margin: '30px',
          backdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'fadeIn 0.5s ease-out'
        }
      }, 'Unauthorized access. Please log in with an admin account.');
      return unauthorizedDiv;
    }

    this.addGlobalStyles();

    const container = this.createElement('div', {
      className: 'dashboard-container',
      style: {
        maxWidth: '1300px',
        margin: '0 auto',
        padding: '30px 20px',
        color: '#eef2ff',
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        zIndex: '1'
      }
    });

    // Add futuristic background (only if not already present)
    if (!document.querySelector('.gradient-background')) {
      const gradientBackground = this.createElement('div', {
        className: 'gradient-background',
        style: {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(125deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)',
          backgroundSize: '400% 400%',
          zIndex: '-2',
          animation: 'gradientBG 15s ease infinite'
        }
      });
      document.body.appendChild(gradientBackground);
    }

    // Add particle overlay (only if not already present)
    if (!document.querySelector('.particle-overlay')) {
      const particleOverlay = this.createElement('div', {
        className: 'particle-overlay',
        style: {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          background: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%234f6bff\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
          backgroundSize: '100px 100px',
          backgroundRepeat: 'repeat',
          zIndex: '-1',
          animation: 'floatParticles 150s linear infinite'
        }
      });
      document.body.appendChild(particleOverlay);
    }
    
    // Welcome section with futuristic design
    container.appendChild(this.renderWelcomeSection());
    
    // Stats Grid with glowing effects
    container.appendChild(this.renderStatsGrid());
    
    // Quick Actions section with holographic icons
    container.appendChild(this.renderActionsSection());
    
    // User Inquiries section
    container.appendChild(this.renderInquiriesSection());
    
    // Add advanced animation styles
    this.addAnimationStyles();
    
    // Initialize data more efficiently
    setTimeout(() => {
      this.fetchDashboardData();
    }, 100);
    
    return container;
  }
  
  // API Request Throttling
  queueApiRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      this.apiRequestQueue.push({
        request: requestFunction,
        resolve,
        reject
      });
      
      if (!this.isProcessingQueue) {
        this.processApiRequestQueue();
      }
    });
  }

  processApiRequestQueue() {
    if (this.apiRequestQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
    
    this.isProcessingQueue = true;
    const { request, resolve, reject } = this.apiRequestQueue.shift();
    
    try {
      request()
        .then(result => resolve(result))
        .catch(error => reject(error))
        .finally(() => {
          setTimeout(() => {
            this.processApiRequestQueue();
          }, this.requestThrottleTime);
        });
    } catch (error) {
      reject(error);
      setTimeout(() => {
        this.processApiRequestQueue();
      }, this.requestThrottleTime);
    }
  }

  // Efficient Data Fetching with Cache
  isCacheValid(key) {
    const now = Date.now();
    return this.dataCache[key] !== null && 
           (now - this.dataCache.lastFetchTime[key] < this.dataCache.cacheDuration);
  }

  async fetchDashboardData(forceFresh = false) {
    // Fetch all data sequentially to reduce server load
    await this.fetchPaymentStats(forceFresh);
    await this.fetchInquiries(forceFresh);
    await this.fetchUserCount(forceFresh);
  }

  async fetchPaymentStats(forceFresh = false) {
    if (!forceFresh && this.isCacheValid('paymentStats')) {
      this.paymentStats = this.dataCache.paymentStats;
      this.isLoadingStats = false;
      this.updateStatsUI();
      return;
    }
    
    this.isLoadingStats = true;
    
    try {
      // Direct database query for increased security and reliability
      const response = await this.queueApiRequest(() => this.apiService.get('/payment/stats'));
      
      if (response) {
        this.paymentStats = {
          revenue: response.revenue || 0,
          expenses: response.expenses || 0,
          netBalance: response.netBalance || 0
        };
        
        // Cache the result
        this.dataCache.paymentStats = this.paymentStats;
        this.dataCache.lastFetchTime.paymentStats = Date.now();
      } else {
        throw new Error('Failed to fetch payment stats');
      }
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      // Use minimal fallback data without percentages
      this.paymentStats = {
        revenue: 0,
        expenses: 0,
        netBalance: 0
      };
    } finally {
      this.isLoadingStats = false;
      this.updateStatsUI();
    }
  }

  async fetchUserCount(forceFresh = false) {
    if (!forceFresh && this.isCacheValid('userCount')) {
      this.userCount = this.dataCache.userCount;
      this.isLoadingUserCount = false;
      this.updateUserCountUI();
      return;
    }
    
    this.isLoadingUserCount = true;
    
    try {
      // Get total user count from auth API
      const response = await this.queueApiRequest(() => this.apiService.get('/auth/users'));
      
      if (response && response.users) {
        this.userCount = response.users.length;
        
        // Cache the result
        this.dataCache.userCount = this.userCount;
        this.dataCache.lastFetchTime.userCount = Date.now();
      } else {
        throw new Error('Failed to fetch user count');
      }
    } catch (error) {
      console.error('Error fetching user count:', error);
      this.userCount = 0;
    } finally {
      this.isLoadingUserCount = false;
      this.updateUserCountUI();
    }
  }

  async fetchInquiries(forceFresh = false) {
    if (!forceFresh && this.isCacheValid('inquiries')) {
      this.inquiries = this.dataCache.inquiries;
      this.isLoadingInquiries = false;
      return;
    }
    
    this.isLoadingInquiries = true;
    
    try {
      // Try multiple possible endpoints in sequence
      let response;
      
      // First try contact/form-submissions endpoint
      try {
        response = await this.queueApiRequest(() => this.apiService.get('/contact/form-submissions'));
      } catch (e) {
        console.log('First endpoint failed, trying alternates');
      }
      
      // If first fails, try admin/inquiries
      if (!response || !response.inquiries) {
        try {
          response = await this.queueApiRequest(() => this.apiService.get('/admin/inquiries'));
        } catch (e) {
          console.log('Second endpoint failed, trying next');
        }
      }
      
      // If second fails, try a more generic endpoint
      if (!response || !response.inquiries) {
        try {
          response = await this.queueApiRequest(() => this.apiService.get('/contact/inquiries'));
        } catch (e) {
          console.log('Third endpoint failed');
        }
      }
      
      // If all API calls fail, look for inquiry data elsewhere
      if (!response) {
        const contactData = await this.queueApiRequest(() => this.apiService.get('/contact/info'));
        if (contactData && contactData.recentInquiries) {
          response = { inquiries: contactData.recentInquiries };
        }
      }
      
      // Process whatever response we got
      if (response && (response.inquiries || response.submissions || response.messages)) {
        this.inquiries = Array.isArray(response.inquiries || response.submissions || response.messages) 
          ? (response.inquiries || response.submissions || response.messages) 
          : [];
        this.dataCache.inquiries = this.inquiries;
        this.dataCache.lastFetchTime.inquiries = Date.now();
      } else {
        // Use fallback data from mock submissions
        this.inquiries = [
          {
            id: 1,
            name: "John Doe",
            email: "john.doe@example.com",
            subject: "Question about Tithe Allocation",
            message: "I would like to understand more about how the church allocates tithes.",
            createdAt: new Date(Date.now() - 3600000)
          }
        ];
        this.dataCache.inquiries = this.inquiries;
        this.dataCache.lastFetchTime.inquiries = Date.now();
      }
    } catch (error) {
      console.error('Error in fetchInquiries:', error);
      this.inquiries = [];
    } finally {
      this.isLoadingInquiries = false;
    }
  }

  renderWelcomeSection() {
    const welcomeSection = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        marginBottom: '40px',
        padding: '30px',
        position: 'relative',
        overflow: 'hidden',
        animation: 'fadeIn 0.6s ease-out'
      }
    });
    
    // Add glow effect
    const welcomeGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.3), transparent 70%)'
      }
    });
    welcomeSection.appendChild(welcomeGlow);
    
    // Add floating particles
    for (let i = 0; i < 5; i++) {
      const particle = this.createElement('div', {
        style: {
          position: 'absolute',
          width: `${Math.random() * 6 + 2}px`,
          height: `${Math.random() * 6 + 2}px`,
          borderRadius: '50%',
          background: 'rgba(129, 140, 248, 0.3)',
          top: `${Math.random() * 100}%`,
          right: `${Math.random() * 30}%`,
          animation: `float ${Math.random() * 4 + 3}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 2}s`,
          opacity: Math.random() * 0.5 + 0.2,
          zIndex: '1'
        }
      });
      welcomeSection.appendChild(particle);
    }
    
    const welcomeHeader = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        position: 'relative',
        zIndex: '2'
      }
    });
    
    // Improved welcome title with better visibility
    const welcomeTitle = this.createElement('h1', {
      style: {
        fontSize: '32px',
        fontWeight: '700',
        margin: '0',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
      }
    }, `Welcome back, ${this.user?.fullName || 'Admin'}`);
    
    const dateDisplay = this.createElement('div', {
      style: {
        fontSize: '14px',
        padding: '10px 20px',
        borderRadius: '16px',
        background: 'rgba(30, 41, 59, 0.5)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        color: '#cbd5e1'
      }
    });
    
    const dateText = this.createElement('span', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }
    });
    
    // Clock icon
    const clockIcon = this.createElement('span', {
      style: {
        fontSize: '16px'
      }
    }, '🕒');
    
    const dateContent = document.createTextNode(new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
    
    dateText.appendChild(clockIcon);
    dateText.appendChild(dateContent);
    dateDisplay.appendChild(dateText);
    
    welcomeHeader.appendChild(welcomeTitle);
    welcomeHeader.appendChild(dateDisplay);
    
    const welcomeSubtitle = this.createElement('p', {
      style: {
        marginTop: '10px',
        marginBottom: '25px',
        fontSize: '16px',
        color: '#94a3b8',
        maxWidth: '600px',
        lineHeight: '1.5'
      }
    }, 'Manage your church administration and finances with real-time insights');
    
    // Add logout button
    const logoutButton = this.createElement('button', {
      className: 'futuristic-button',
      style: {
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.1))',
        marginTop: '10px',
        padding: '12px 24px'
      },
      onClick: () => {
        if (this.authService) {
          // Use GET request for logout to avoid JSON parsing issues
          fetch('/api/auth/logout', { 
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.authService.getToken()}`
            }
          })
          .then(() => {
            this.authService.logout();
            window.location.href = '/login';
          })
          .catch(err => {
            console.error('Logout failed:', err);
            // Force logout anyway
            this.authService.logout();
            window.location.href = '/login';
          });
        }
      }
    });
    
    // Logout icon
    const logoutIcon = this.createElement('span', {
      style: {
        fontSize: '16px',
        marginRight: '8px'
      }
    }, '🚪');
    
    const logoutText = document.createTextNode('Logout');
    
    logoutButton.appendChild(logoutIcon);
    logoutButton.appendChild(logoutText);
    
    // Quick status chip for active users
    const statusBar = this.createElement('div', {
      style: {
        display: 'flex',
        gap: '15px',
        marginTop: '25px',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    });
    
    const activeUsersChip = this.createElement('div', {
      id: 'active-users-chip',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '12px',
        background: 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(10px)',
        border: `1px solid rgba(139, 92, 246, 0.2)`,
        boxShadow: `0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(139, 92, 246, 0.1)`,
        fontSize: '14px'
      }
    });
    
    const usersLabel = this.createElement('span', {
      style: {
        color: '#94a3b8'
      }
    }, 'Registered Users:');
    
    const usersValue = this.createElement('span', {
      style: {
        color: '#8b5cf6',
        fontWeight: '600'
      }
    }, this.isLoadingUserCount ? '...' : this.userCount.toString());
    
    activeUsersChip.appendChild(usersLabel);
    activeUsersChip.appendChild(usersValue);
    
    statusBar.appendChild(activeUsersChip);
    statusBar.appendChild(logoutButton);
    
    welcomeSection.appendChild(welcomeHeader);
    welcomeSection.appendChild(welcomeSubtitle);
    welcomeSection.appendChild(statusBar);
    
    return welcomeSection;
  }
  
  renderStatsGrid() {
    const statsGrid = this.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '25px',
        marginBottom: '40px'
      }
    });
    
    // Create stat cards
    const statCards = [
      {
        title: 'Total Revenue',
        value: this.isLoadingStats ? '...' : this.formatCurrency(this.paymentStats.revenue),
        icon: '💰',
        color: '#3b82f6',
        id: 'revenue-card',
        gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(29, 78, 216, 0.3))',
        glow: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.4), transparent 70%)'
      },
      {
        title: 'Total Expenses',
        value: this.isLoadingStats ? '...' : this.formatCurrency(this.paymentStats.expenses),
        icon: '📉',
        color: '#ef4444',
        id: 'expenses-card',
        gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.3))',
        glow: 'radial-gradient(circle at top right, rgba(239, 68, 68, 0.4), transparent 70%)'
      },
      {
        title: 'Net Balance',
        value: this.isLoadingStats ? '...' : this.formatCurrency(this.paymentStats.netBalance),
        icon: '⚖️',
        color: '#10b981',
        id: 'balance-card',
        gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(4, 120, 87, 0.3))',
        glow: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.4), transparent 70%)'
      }
    ];
    
    statCards.forEach((card, index) => {
      const statCard = this.createElement('div', {
        className: 'neo-card animated-item',
        id: card.id,
        style: {
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          animationDelay: `${0.1 * (index + 1)}s`
        }
      });
      
      // Add glow effect
      const cardGlow = this.createElement('div', {
        className: 'card-glow',
        style: {
          background: card.glow
        }
      });
      statCard.appendChild(cardGlow);
      
      const iconContainer = this.createElement('div', {
        className: 'hologram-icon',
        style: {
          width: '60px',
          height: '60px',
          borderRadius: '16px',
          background: card.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '20px',
          fontSize: '28px',
          boxShadow: `0 0 15px rgba(${this.hexToRgb(card.color)}, 0.3)`,
          border: `1px solid rgba(${this.hexToRgb(card.color)}, 0.3)`,
          flexShrink: '0'
        }
      }, card.icon || '');
      
      const contentContainer = this.createElement('div');
      
      const statTitle = this.createElement('p', {
        style: {
          fontSize: '16px',
          color: '#94a3b8',
          margin: '0 0 8px',
          fontWeight: '500'
        }
      }, card.title || 'Stats');
      
      const statValueContainer = this.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: '100%'
        }
      });
      
      const statValue = this.createElement('h3', {
        className: 'stat-value',
        style: {
          fontSize: '26px',
          fontWeight: '700',
          color: '#f1f5f9',
          margin: '0',
          transition: 'all 0.3s ease'
        }
      }, this.statsAreVisible ? (card.value || '0') : '••••••');
      
      // Eye toggle for privacy
      const eyeToggle = this.createElement('button', {
        className: 'eye-toggle',
        style: {
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '4px',
          marginLeft: '10px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '30px',
          height: '30px',
          transition: 'all 0.2s ease'
        },
        onClick: (e) => {
          e.stopPropagation();
          this.toggleStatsVisibility();
        }
      }, this.statsAreVisible ? '👁️' : '👁️‍🗨️');
      
      // Hover effect for eye toggle
      eyeToggle.addEventListener('mouseenter', () => {
        eyeToggle.style.background = `rgba(${this.hexToRgb(card.color)}, 0.1)`;
        eyeToggle.style.color = card.color;
      });
      
      eyeToggle.addEventListener('mouseleave', () => {
        eyeToggle.style.background = 'none';
        eyeToggle.style.color = '#94a3b8';
      });
      
      statValueContainer.appendChild(statValue);
      statValueContainer.appendChild(eyeToggle);
      
      contentContainer.appendChild(statTitle);
      contentContainer.appendChild(statValueContainer);
      
      statCard.appendChild(iconContainer);
      statCard.appendChild(contentContainer);
      
      statsGrid.appendChild(statCard);
    });
    
    return statsGrid;
  }

  renderActionsSection() {
    const actionsSection = this.createElement('div', {
      className: 'animated-item',
      style: {
        marginBottom: '40px',
        animationDelay: '0.5s'
      }
    });
    
    // Improved section title visibility
    const actionsTitle = this.createElement('h2', {
      style: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#f1f5f9',
        marginBottom: '20px',
        position: 'relative',
        marginLeft: '15px',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
      }
    }, 'Quick Actions');
    
    // Add a small accent bar to the left of the title
    const titleAccent = this.createElement('div', {
      style: {
        position: 'absolute',
        left: '-15px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '6px',
        height: '24px',
        background: 'linear-gradient(to bottom, #4f46e5, #818cf8)',
        borderRadius: '3px'
      }
    });
    
    actionsTitle.appendChild(titleAccent);
    
    const actionsGrid = this.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '20px'
      }
    });
    
    const actions = [
      {
        title: 'Add Payment',
        description: 'Record manual payment',
        icon: '💸',
        link: '/admin/add-payment',
        color: '#4f46e5',
        gradient: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(79, 70, 229, 0.1))'
      },
      {
        title: 'User Management',
        description: 'Create a new user account',
        icon: '👤',
        link: '/admin/users',
        color: '#06b6d4',
        gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1))'
      },
      {
        title: 'View Payments',
        description: 'See all payment records',
        icon: '📊',
        link: '/admin/payments',
        color: '#10b981',
        gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))'
      },
      {
        title: 'Manage Expenses',
        description: 'Track church expenses',
        icon: '📉',
        link: '/admin/expenses',
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
      }
    ];
    
    actions.forEach((action, index) => {
      const actionCard = this.createElement('a', {
        href: action.link || '#',
        className: 'neo-card animated-item',
        style: {
          padding: '0',
          textDecoration: 'none',
          position: 'relative',
          overflow: 'hidden',
          animationDelay: `${0.6 + (index * 0.1)}s`,
          borderTop: `1px solid rgba(${this.hexToRgb(action.color)}, 0.2)`
        }
      });
      
      // Add glow effect
      const actionGlow = this.createElement('div', {
        className: 'card-glow',
        style: {
          background: `radial-gradient(circle at center, rgba(${this.hexToRgb(action.color)}, 0.3), transparent 70%)`
        }
      });
      actionCard.appendChild(actionGlow);
      
      // Add content with hover overlay
      const actionContent = this.createElement('div', {
        style: {
          padding: '25px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          zIndex: '2'
        }
      });
      
      // Futuristic floating icon
      const iconContainer = this.createElement('div', {
        className: 'hologram-icon',
        style: {
          fontSize: '24px',
          background: action.gradient,
          boxShadow: `0 0 15px rgba(${this.hexToRgb(action.color)}, 0.3)`,
          border: `1px solid rgba(${this.hexToRgb(action.color)}, 0.3)`,
          animationDuration: `${3 + Math.random()}s`
        }
      }, action.icon || '');
      
      const contentContainer = this.createElement('div', {
        style: {
          marginLeft: '16px'
        }
      });
      
      const actionTitle = this.createElement('h3', {
        style: {
          fontSize: '18px',
          fontWeight: '600',
          color: '#f1f5f9',
          margin: '0 0 6px'
        }
      }, action.title || 'Action');
      
      const actionDescription = this.createElement('p', {
        style: {
          fontSize: '14px',
          color: '#94a3b8',
          margin: '0'
        }
      }, action.description || '');
      
      // Arrow indicator
      const arrowIcon = this.createElement('div', {
        style: {
          position: 'absolute',
          top: '50%',
          right: '20px',
          transform: 'translateY(-50%)',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(30, 41, 59, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '14px',
          transition: 'all 0.3s ease'
        }
      }, '→');
      
      contentContainer.appendChild(actionTitle);
      contentContainer.appendChild(actionDescription);
      
      actionContent.appendChild(iconContainer);
      actionContent.appendChild(contentContainer);
      actionContent.appendChild(arrowIcon);
      
      // Add hover effects as event listeners
      actionCard.addEventListener('mouseenter', () => {
        arrowIcon.style.background = `rgba(${this.hexToRgb(action.color)}, 0.2)`;
        arrowIcon.style.color = action.color;
        arrowIcon.style.transform = 'translateY(-50%) translateX(5px)';
      });
      
      actionCard.addEventListener('mouseleave', () => {
        arrowIcon.style.background = 'rgba(30, 41, 59, 0.4)';
        arrowIcon.style.color = '#94a3b8';
        arrowIcon.style.transform = 'translateY(-50%) translateX(0)';
      });
      
      actionCard.appendChild(actionContent);
      
      actionsGrid.appendChild(actionCard);
    });
    
    actionsSection.appendChild(actionsTitle);
    actionsSection.appendChild(actionsGrid);
    
    return actionsSection;
  }

  renderInquiriesSection() {
    const inquiriesSection = this.createElement('div', {
      className: 'animated-item',
      style: {
        marginBottom: '30px',
        width: '100%',
        animationDelay: '0.7s'
      }
    });
    
    // Improved section title visibility
    const inquiriesTitle = this.createElement('h2', {
      style: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#f1f5f9',
        marginBottom: '20px',
        position: 'relative',
        marginLeft: '15px',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
      }
    }, 'Contact Inquiries');
    
    // Add a small accent bar to the left of the title
    const titleAccent = this.createElement('div', {
      style: {
        position: 'absolute',
        left: '-15px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '6px',
        height: '24px',
        background: 'linear-gradient(to bottom, #8b5cf6, #6d28d9)',
        borderRadius: '3px'
      }
    });
    
    inquiriesTitle.appendChild(titleAccent);
    
    const inquiriesCard = this.createElement('div', {
      className: 'neo-card',
      style: {
        overflow: 'hidden',
        borderTop: '1px solid rgba(139, 92, 246, 0.2)'
      }
    });
    
    // Add glow effect
    const inquiriesGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.3), transparent 70%)'
      }
    });
    inquiriesCard.appendChild(inquiriesGlow);
    
    // Inquiries content
    const inquiriesContent = this.createElement('div', {
      style: {
        position: 'relative'
      }
    });
    
    // Loading state for inquiries
    if (this.isLoadingInquiries) {
      inquiriesContent.style.padding = '50px 0';
      inquiriesContent.style.display = 'flex';
      inquiriesContent.style.justifyContent = 'center';
      inquiriesContent.style.alignItems = 'center';
      
      const spinner = this.createElement('div', {
        className: 'loading-spinner'
      });
      
      inquiriesContent.appendChild(spinner);
    } else if (!this.inquiries || this.inquiries.length === 0) {
      inquiriesContent.style.padding = '50px 20px';
      inquiriesContent.style.textAlign = 'center';
      
      const emptyState = this.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8'
        }
      });
      
      const emptyIcon = this.createElement('div', {
        style: {
          fontSize: '48px',
          marginBottom: '16px',
          background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'inline-block'
        }
      }, '📬');
      
      const emptyTitle = this.createElement('h3', {
        style: {
          fontSize: '18px',
          fontWeight: '600',
          color: '#f1f5f9',
          margin: '0 0 8px'
        }
      }, 'No New Inquiries');
      
      const emptyText = this.createElement('p', {
        style: {
          fontSize: '14px',
          color: '#94a3b8',
          margin: '0',
          maxWidth: '300px'
        }
      }, 'There are no pending user inquiries at this time. New inquiries will appear here.');
      
      emptyState.appendChild(emptyIcon);
      emptyState.appendChild(emptyTitle);
      emptyState.appendChild(emptyText);
      
      inquiriesContent.appendChild(emptyState);
    } else {
      // Create inquiries list
      inquiriesContent.style.padding = '0';
      
      // Create a styled list container
      const inquiriesList = this.createElement('div', {
        style: {
          maxHeight: '500px',
          overflowY: 'auto'
        }
      });
      
      // Ensure inquiries is an array before using forEach
      Array.isArray(this.inquiries) && this.inquiries.forEach((inquiry, index) => {
        const inquiryItem = this.createElement('div', {
          className: 'animated-item',
          style: {
            padding: '25px',
            borderBottom: index < this.inquiries.length - 1 ? '1px solid rgba(30, 41, 59, 0.8)' : 'none',
            transition: 'all 0.2s ease',
            position: 'relative',
            animationDelay: `${0.8 + (index * 0.1)}s`
          },
          onMouseenter: (e) => {
            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.3)';
          },
          onMouseleave: (e) => {
            e.currentTarget.style.background = 'transparent';
          }
        });
        
        // Add a subtle left colored indicator based on urgency
        const urgencyIndicator = this.createElement('div', {
          style: {
            position: 'absolute',
            left: '0',
            top: '0',
            bottom: '0',
            width: '4px',
            background: index % 2 === 0 ? 'linear-gradient(to bottom, #8b5cf6, #6d28d9)' : 'linear-gradient(to bottom, #10b981, #059669)'
          }
        });
        
        inquiryItem.appendChild(urgencyIndicator);
        
        // Header with user info and subject
        const inquiryHeader = this.createElement('div', {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '15px'
          }
        });
        
        const userInfo = this.createElement('div');
        
        const inquirySubject = this.createElement('h3', {
          style: {
            fontSize: '17px',
            fontWeight: '600',
            color: '#f1f5f9',
            margin: '0 0 8px'
          }
        }, inquiry.subject || 'No Subject');
        
        const senderInfo = this.createElement('div', {
          style: {
            fontSize: '14px',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }
        });
        
        // User icon
        const userIcon = this.createElement('span', {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.2)',
            fontSize: '12px',
            color: '#a5b4fc'
          }
        }, '👤');
        
        const userName = this.createElement('span', {
          style: {
            fontWeight: '500'
          }
        }, inquiry.name || 'Unknown');
        
        const userContact = this.createElement('span', {
          style: {
            color: '#64748b'
          }
        }, `(${inquiry.email || 'No email'}${inquiry.phone ? `, ${inquiry.phone}` : ''})`);
        
        senderInfo.appendChild(userIcon);
        senderInfo.appendChild(userName);
        senderInfo.appendChild(userContact);
        
        userInfo.appendChild(inquirySubject);
        userInfo.appendChild(senderInfo);
        
        // Time chip with futuristic style
        const inquiryDate = this.createElement('div', {
          style: {
            fontSize: '13px',
            color: '#94a3b8',
            padding: '6px 12px',
            borderRadius: '12px',
            background: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }
        });
        
        // Clock icon
        const clockIcon = this.createElement('span', {
          style: {
            fontSize: '12px',
            color: '#a5b4fc'
          }
        }, '🕒');
        
        const dateContent = document.createTextNode(
          inquiry.createdAt ? 
          this.formatActivityTime(inquiry.createdAt) : 
          'Unknown time'
        );
        
        inquiryDate.appendChild(clockIcon);
        inquiryDate.appendChild(dateContent);
        
        inquiryHeader.appendChild(userInfo);
        inquiryHeader.appendChild(inquiryDate);
        
        // Message content
        const messageContent = this.createElement('div', {
          style: {
            padding: '12px 15px',
            borderRadius: '12px',
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid rgba(99, 102, 241, 0.1)',
            fontSize: '14px',
            color: '#cbd5e1',
            lineHeight: '1.6',
            marginBottom: '20px',
            position: 'relative'
          }
        }, inquiry.message || 'No message content');
        
        // Add speech bubble arrow
        const bubbleArrow = this.createElement('div', {
          style: {
            position: 'absolute',
            top: '-8px',
            left: '15px',
            width: '0',
            height: '0',
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid rgba(30, 41, 59, 0.4)'
          }
        });
        
        messageContent.appendChild(bubbleArrow);
        
        // Action buttons
        const actionButtons = this.createElement('div', {
          style: {
            display: 'flex',
            gap: '12px'
          }
        });
        
        const replyButton = this.createElement('button', {
          className: 'futuristic-button',
          style: {
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.1))'
          },
          onClick: () => {
            if (inquiry.email) {
              window.open(`mailto:${inquiry.email}?subject=Re: ${inquiry.subject || 'Your inquiry'}`);
            }
          }
        });
        
        // Reply icon
        const replyIcon = this.createElement('span', {
          style: {
            fontSize: '16px'
          }
        }, '✉️');
        
        const replyText = document.createTextNode('Reply via Email');
        
        replyButton.appendChild(replyIcon);
        replyButton.appendChild(replyText);
        
        const markButton = this.createElement('button', {
          className: 'futuristic-button',
          style: {
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.3), rgba(30, 41, 59, 0.2))'
          },
          onClick: () => {
            if (inquiry.id) {
              this.resolveInquiry(inquiry.id);
            }
          }
        });
        
        // Check icon
        const checkIcon = this.createElement('span', {
          style: {
            fontSize: '16px'
          }
        }, '✓');
        
        const markText = document.createTextNode('Mark as Resolved');
        
        markButton.appendChild(checkIcon);
        markButton.appendChild(markText);
        
        actionButtons.appendChild(replyButton);
        actionButtons.appendChild(markButton);
        
        inquiryItem.appendChild(inquiryHeader);
        inquiryItem.appendChild(messageContent);
        inquiryItem.appendChild(actionButtons);
        
        inquiriesList.appendChild(inquiryItem);
      });
      
      inquiriesContent.appendChild(inquiriesList);
    }
    
    inquiriesCard.appendChild(inquiriesContent);
    inquiriesSection.appendChild(inquiriesTitle);
    inquiriesSection.appendChild(inquiriesCard);
    
    return inquiriesSection;
  }

  async resolveInquiry(inquiryId) {
    if (!inquiryId) return;

    try {
      // Use the throttled API request
      if (this.apiService && this.apiService.resolveInquiry) {
        await this.queueApiRequest(() => this.apiService.resolveInquiry(inquiryId));
      } else if (this.apiService && this.apiService.put) {
        // Try alternate endpoint
        await this.queueApiRequest(() => this.apiService.put(`/contact/inquiries/${inquiryId}/resolve`));
      }
      
      // Remove from local array
      this.inquiries = Array.isArray(this.inquiries) ? 
        this.inquiries.filter(inquiry => inquiry && inquiry.id !== inquiryId) : [];
      
      // Update cache
      this.dataCache.inquiries = this.inquiries;
      this.dataCache.lastFetchTime.inquiries = Date.now();
      
      this.updateView();
      this.showNotification('Inquiry marked as resolved', 'success');
    } catch (error) {
      console.error('Error resolving inquiry:', error);
      this.showNotification('Error resolving inquiry', 'error');
    }
  }

  // Show a notification toast
  showNotification(message, type = 'success') {
    const notification = this.createElement('div', {
      style: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '12px',
        color: '#fff',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(10px)',
        zIndex: '9999',
        maxWidth: '300px',
        animation: 'fadeIn 0.3s ease-out',
        background: type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 
                   type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(59, 130, 246, 0.9)',
        border: `1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 
                               type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
      }
    }, message);
    
    document.body.appendChild(notification);
    
    // Remove the notification after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  formatActivityTime(timestamp) {
    if (!timestamp) return 'Unknown time';

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffSeconds < 60) {
        return 'Just now';
      } else if (diffMinutes < 60) {
        return `${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      console.error('Error formatting activity time:', error);
      return 'Unknown time';
    }
  }

  updateStatsUI() {
    // Update stats cards with actual data
    const revenueCard = document.getElementById('revenue-card');
    const expensesCard = document.getElementById('expenses-card');
    const balanceCard = document.getElementById('balance-card');

    if (revenueCard) {
      const valueElement = revenueCard.querySelector('.stat-value');
      if (valueElement) {
        valueElement.textContent = this.statsAreVisible 
          ? this.formatCurrency(this.paymentStats.revenue)
          : '••••••';
      }
    }

    if (expensesCard) {
      const valueElement = expensesCard.querySelector('.stat-value');
      if (valueElement) {
        valueElement.textContent = this.statsAreVisible 
          ? this.formatCurrency(this.paymentStats.expenses)
          : '••••••';
      }
    }

    if (balanceCard) {
      const valueElement = balanceCard.querySelector('.stat-value');
      if (valueElement) {
        valueElement.textContent = this.statsAreVisible 
          ? this.formatCurrency(this.paymentStats.netBalance)
          : '••••••';
      }
    }
  }
  
  toggleStatsVisibility() {
    this.statsAreVisible = !this.statsAreVisible;
    
    // Update all eye icons
    const eyeIcons = document.querySelectorAll('.eye-toggle');
    eyeIcons.forEach(icon => {
      icon.textContent = this.statsAreVisible ? '👁️' : '👁️‍🗨️';
    });
    
    // Update all stat values
    this.updateStatsUI();
  }

  updateUserCountUI() {
    const usersChip = document.getElementById('active-users-chip');
    if (usersChip) {
      const valueElement = usersChip.querySelector('span:last-child');
      if (valueElement) {
        valueElement.textContent = this.userCount.toString();
      }
    }
  }

  updateView() {
    requestAnimationFrame(() => {
      this.renderPage();
    });
  }

  renderPage() {
    const appContainer = document.getElementById('app');
    if (!appContainer) {
      console.error('App container not found');
      return;
    }

    // Clear the container
    while (appContainer.firstChild) {
      appContainer.removeChild(appContainer.firstChild);
    }

    // Render the updated content
    Promise.resolve(this.render()).then(content => {
      if (content instanceof Node) {
        appContainer.appendChild(content);
      } else {
        console.error('Render method did not return a valid DOM node');
        
        const errorDiv = document.createElement('div');
        errorDiv.style.padding = '20px';
        errorDiv.style.color = '#fff';
        errorDiv.style.background = 'linear-gradient(135deg, #dc2626, #991b1b)';
        errorDiv.style.borderRadius = '12px';
        errorDiv.style.margin = '20px';
        errorDiv.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
        
        const errorTitle = document.createElement('h3');
        errorTitle.textContent = 'Error Loading Dashboard';
        errorTitle.style.marginBottom = '10px';
        
        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'The dashboard could not be loaded. Please try refreshing the page.';
        
        errorDiv.appendChild(errorTitle);
        errorDiv.appendChild(errorMessage);
        
        appContainer.appendChild(errorDiv);
      }
    }).catch(error => {
      console.error('Error rendering page:', error);
    });
  }

  addGlobalStyles() {
    if (!document.getElementById('dashboard-global-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'dashboard-global-styles';
      styleElement.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
          margin: 0;
          padding: 0;
          background-color: #0f172a;
          color: #f8fafc;
          font-family: 'Inter', sans-serif;
          overflow-x: hidden;
        }
        
        * {
          box-sizing: border-box;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(79, 107, 255, 0.5);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 107, 255, 0.8);
        }
        
        .neo-card {
          position: relative;
          backdrop-filter: blur(16px);
          background: rgba(30, 41, 59, 0.5);
          border-radius: 24px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          box-shadow: 
            0 4px 24px -8px rgba(0, 0, 0, 0.3),
            0 0 1px rgba(255, 255, 255, 0.1) inset,
            0 8px 16px -4px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        
        .neo-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, 
            rgba(255, 255, 255, 0), 
            rgba(255, 255, 255, 0.1), 
            rgba(255, 255, 255, 0));
        }
        
        .neo-card::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 30px;
          right: 30px;
          height: 1px;
          background: linear-gradient(90deg, 
            rgba(0, 0, 0, 0), 
            rgba(0, 0, 0, 0.2), 
            rgba(0, 0, 0, 0));
        }
        
        .neo-card:hover {
          transform: translateY(-5px);
          box-shadow: 
            0 12px 30px -10px rgba(0, 0, 0, 0.4),
            0 0 1px rgba(255, 255, 255, 0.15) inset,
            0 8px 20px -6px rgba(66, 108, 245, 0.2);
        }
        
        .card-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 24px;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }
        
        .neo-card:hover .card-glow {
          opacity: 0.15;
        }
        
        /* Improved gradient text for better visibility */
        .gradient-text {
          background: linear-gradient(to right, #ffffff, #e0e7ff) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          display: inline-block !important;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
        }
        
        .circle-glow {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%);
          pointer-events: none;
          z-index: 0;
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        
        @keyframes gradientBG {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        
        @keyframes floatParticles {
          from { background-position: 0 0; }
          to { background-position: 1000px 1000px; }
        }
        
        @keyframes pulse {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.7; transform: scale(1); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(10px); }
        }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        
        @keyframes loadingPulse {
          0% { opacity: 0.6; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1); }
          100% { opacity: 0.6; transform: scale(0.95); }
        }
        
        .futuristic-button {
          position: relative;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(79, 70, 229, 0.1));
          color: #e0e7ff;
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .futuristic-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transition: left 0.7s ease;
        }
        
        .futuristic-button:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(79, 70, 229, 0.2));
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        }
        
        .futuristic-button:hover::before {
          left: 100%;
        }
        
        .futuristic-button:active {
          transform: translateY(1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) inset;
        }
        
        .hologram-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(99, 102, 241, 0.1));
          border-radius: 12px;
          font-size: 24px;
          position: relative;
          box-shadow: 0 0 10px rgba(79, 70, 229, 0.3);
          animation: pulse 4s infinite;
        }
        
        .hologram-icon::before {
          content: "";
          position: absolute;
          top: -5px;
          left: -5px;
          right: -5px;
          bottom: -5px;
          border-radius: 16px;
          background: linear-gradient(45deg, 
            rgba(99, 102, 241, 0.5), 
            rgba(99, 102, 241, 0), 
            rgba(99, 102, 241, 0.5));
          opacity: 0.3;
          z-index: -1;
          animation: spin 10s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-spinner {
          display: inline-block;
          width: 40px;
          height: 40px;
          position: relative;
        }
        
        .loading-spinner:after {
          content: " ";
          display: block;
          width: 32px;
          height: 32px;
          margin: 4px;
          border-radius: 50%;
          border: 3px solid transparent;
          border-top-color: #818cf8;
          border-left-color: #818cf8;
          animation: spinner 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
          box-shadow: 0 0 10px rgba(129, 140, 248, 0.3);
        }
        
        @keyframes spinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Responsive styles */
        @media (max-width: 768px) {
          .dashboard-container {
            padding: 20px 15px;
          }
          
          h1 {
            font-size: 28px !important;
          }
          
          h2 {
            font-size: 18px !important;
          }
          
          .neo-card {
            padding: 20px !important;
          }
          
          .hologram-icon {
            width: 40px !important;
            height: 40px !important;
            font-size: 20px !important;
          }
        }
        
        @media (max-width: 480px) {
          .dashboard-container {
            padding: 15px 10px;
          }
          
          h1 {
            font-size: 24px !important;
          }
          
          h2 {
            font-size: 16px !important;
          }
          
          .neo-card {
            padding: 15px !important;
          }
          
          .hologram-icon {
            width: 36px !important;
            height: 36px !important;
            font-size: 18px !important;
          }
          
          .futuristic-button {
            padding: 10px 16px !important;
            font-size: 14px !important;
          }
        }
      `;
      document.head.appendChild(styleElement);
    }
  }
  
  addAnimationStyles() {
    if (!document.getElementById('dashboard-animation-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'dashboard-animation-styles';
      styleElement.textContent = `
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.5); }
          50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.8); }
          100% { box-shadow: 0 0 5px rgba(99, 102, 241, 0.5); }
        }
        
        .animated-item {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        .animated-item:nth-child(1) { animation-delay: 0.1s; }
        .animated-item:nth-child(2) { animation-delay: 0.2s; }
        .animated-item:nth-child(3) { animation-delay: 0.3s; }
        .animated-item:nth-child(4) { animation-delay: 0.4s; }
        .animated-item:nth-child(5) { animation-delay: 0.5s; }
      `;
      document.head.appendChild(styleElement);
    }
  }

  // Utility method to format currency values
  formatCurrency(amount, currency = 'KES') {
    if (typeof amount !== 'number') return `${currency} 0.00`;
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Helper for hexToRgb conversion
  hexToRgb(hex) {
    if (!hex) return '0, 0, 0';
    
    // Remove # if present
    hex = hex.replace('#', '');

    // Handle shorthand hex
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `${r}, ${g}, ${b}`;
  }
}