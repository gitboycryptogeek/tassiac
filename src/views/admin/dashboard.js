// src/views/admin/dashboard.js
import { BaseComponent } from '../../utils/BaseComponent.js';

export class AdminDashboardView extends BaseComponent {
  constructor() {
    super();
    this.title = 'Admin Dashboard';
    this.user = this.authService ? this.authService.getUser() : null;
    this.apiService = window.apiService;
    
    // Simplified state management with safe defaults
    this.paymentStats = { revenue: 0, expenses: 0, netBalance: 0 };
    this.userStats = { total: 0, activeLast30Days: 0 };
    this.inquiries = [];
    this.activityLog = [];
    this.currentInquiry = null;
    
    // Loading states - start with false to render immediately
    this.isLoading = false;
    this.error = null;
    
    // API Request Management
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 300;
    
    // Privacy controls
    this.statsAreVisible = false;
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

    this.addBackgroundEffects();
    
    // Add modal to body if not exists
    if (!document.getElementById('inquiry-modal')) {
      document.body.appendChild(this.renderInquiryModal());
    }
    
    if (this.error) {
      container.appendChild(this.renderErrorState());
    } else {
      // Always render the main content - data will load asynchronously
      container.appendChild(this.renderWelcomeSection());
      container.appendChild(this.renderStatsGrid());
      container.appendChild(this.renderActionsSection());
      
      const mainGrid = this.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '30px',
          marginBottom: '40px'
        }
      });
      
      mainGrid.appendChild(this.renderInquiriesSection());
      mainGrid.appendChild(this.renderActivityLogSection());
      container.appendChild(mainGrid);
    }
    
    // Add animation styles
    this.addAnimationStyles();
    
    // Load data after rendering
    this.loadDashboardData();
    
    // Attach event listeners
    setTimeout(() => {
      this.attachEventListeners(container);
    }, 100);
    
    return container;
  }

  renderErrorState() {
    const errorContainer = this.createElement('div', {
      className: 'neo-card',
      style: {
        padding: '40px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(185, 28, 28, 0.05))',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      }
    });
    
    const errorIcon = this.createElement('div', {
      style: {
        fontSize: '48px',
        marginBottom: '16px'
      }
    }, '⚠️');
    
    const errorTitle = this.createElement('h3', {
      style: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#f1f5f9',
        margin: '0 0 8px'
      }
    }, 'Failed to Load Dashboard Data');
    
    const errorMessage = this.createElement('p', {
      style: {
        fontSize: '14px',
        color: '#94a3b8',
        margin: '0 0 20px'
      }
    }, this.error || 'An error occurred while loading the dashboard data.');
    
    const retryButton = this.createElement('button', {
      className: 'futuristic-button',
      style: {
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.1))'
      },
      onClick: () => {
        this.error = null;
        this.loadDashboardData();
        this.updateView();
      }
    }, 'Retry Loading');
    
    errorContainer.appendChild(errorIcon);
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorMessage);
    errorContainer.appendChild(retryButton);
    
    return errorContainer;
  }

  // Simplified data loading that doesn't block rendering
  async loadDashboardData() {
    try {
      // Load data in parallel without blocking the UI
      const promises = [];
      
      // Try the efficient endpoint first, fallback to individual calls
      promises.push(this.loadStatsData());
      promises.push(this.loadInquiriesData());
      promises.push(this.loadActivityData());
      
      await Promise.allSettled(promises);
      
      // Update the UI after data loads
      this.updateDataInUI();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.error = 'Failed to load dashboard data. Please try refreshing the page.';
      this.updateView();
    }
  }

  async loadStatsData() {
    try {
      // Try the efficient endpoint first
      if (this.apiService.getDashboardStats) {
        const dashboardStats = await this.apiService.getDashboardStats();
        if (dashboardStats) {
          this.paymentStats = dashboardStats.paymentStats || { revenue: 0, expenses: 0, netBalance: 0 };
          this.userStats = dashboardStats.userStats || { total: 0, activeLast30Days: 0 };
          return;
        }
      }
    } catch (error) {
      console.log('Dashboard stats endpoint not available, trying individual calls');
    }

    // Fallback to individual API calls
    try {
      const [paymentResponse, userResponse] = await Promise.allSettled([
        this.apiService.getPaymentStats ? this.apiService.getPaymentStats() : Promise.resolve(null),
        this.apiService.getAllUsers ? this.apiService.getAllUsers() : Promise.resolve(null)
      ]);

      if (paymentResponse.status === 'fulfilled' && paymentResponse.value) {
        this.paymentStats = {
          revenue: paymentResponse.value.revenue || 0,
          expenses: paymentResponse.value.expenses || 0,
          netBalance: paymentResponse.value.netBalance || 0
        };
      }

      if (userResponse.status === 'fulfilled' && userResponse.value && userResponse.value.users) {
        const users = userResponse.value.users;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const activeUsers = users.filter(user => {
          const lastLogin = new Date(user.lastLoginAt || user.updatedAt || user.createdAt);
          return lastLogin > thirtyDaysAgo;
        });
        
        this.userStats = {
          total: users.length,
          activeLast30Days: activeUsers.length
        };
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async loadInquiriesData() {
    try {
      if (this.apiService.getAllInquiries) {
        const response = await this.apiService.getAllInquiries({ status: 'PENDING', limit: 5 });
        if (response && response.inquiries) {
          this.inquiries = response.inquiries;
        } else if (response && Array.isArray(response)) {
          this.inquiries = response;
        }
      }
    } catch (error) {
      console.error('Error loading inquiries:', error);
      this.inquiries = [];
    }
  }

  async loadActivityData() {
    try {
      if (this.apiService.getRecentActivity) {
        const response = await this.apiService.getRecentActivity({ limit: 10 });
        if (response && response.activities) {
          this.activityLog = response.activities;
        } else if (response && Array.isArray(response)) {
          this.activityLog = response;
        }
      }
    } catch (error) {
      console.error('Error loading activity:', error);
      this.activityLog = [];
    }
  }

  updateDataInUI() {
    // Update user stats
    const totalUsersValue = document.querySelector('#total-users-chip .chip-value');
    if (totalUsersValue) {
      totalUsersValue.textContent = this.userStats.total.toString();
    }
    
    const activeUsersValue = document.querySelector('#active-users-chip .chip-value');
    if (activeUsersValue) {
      activeUsersValue.textContent = this.userStats.activeLast30Days.toString();
    }

    // Update stat values if visible
    if (this.statsAreVisible) {
      const statValues = document.querySelectorAll('.stat-value');
      const values = [
        this.formatCurrency(this.paymentStats.revenue),
        this.formatCurrency(this.paymentStats.expenses),
        this.formatCurrency(this.paymentStats.netBalance)
      ];
      statValues.forEach((statValue, index) => {
        if (values[index]) {
          statValue.textContent = values[index];
        }
      });
    }

    // Update inquiries section
    this.updateInquiriesSection();
    
    // Update activity section
    this.updateActivitySection();
  }

  updateInquiriesSection() {
    const inquiriesCard = document.querySelector('.inquiries-content');
    if (inquiriesCard) {
      inquiriesCard.innerHTML = '';
      
      if (this.inquiries.length === 0) {
        inquiriesCard.innerHTML = `
          <div style="padding: 50px 20px; text-align: center; color: #94a3b8;">
            <div style="font-size: 48px; margin-bottom: 16px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;">📬</div>
            <h3 style="font-size: 18px; font-weight: 600; color: #f1f5f9; margin: 0 0 8px;">No New Inquiries</h3>
            <p style="font-size: 14px; color: #94a3b8; margin: 0; max-width: 300px; margin: 0 auto;">There are no pending user inquiries at this time. New inquiries will appear here.</p>
          </div>
        `;
      } else {
        const inquiriesList = this.createElement('div', {
          style: { maxHeight: '400px', overflowY: 'auto' }
        });
        
        this.inquiries.forEach((inquiry, index) => {
          const inquiryItem = this.renderInquiryItem(inquiry, index);
          inquiriesList.appendChild(inquiryItem);
        });
        
        inquiriesCard.appendChild(inquiriesList);
      }
    }
  }

  updateActivitySection() {
    const activityCard = document.querySelector('.activity-content');
    if (activityCard) {
      activityCard.innerHTML = '';
      
      if (this.activityLog.length === 0) {
        activityCard.innerHTML = `
          <div style="padding: 50px 20px; text-align: center; color: #94a3b8;">
            <div style="font-size: 48px; margin-bottom: 16px; background: linear-gradient(135deg, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;">📋</div>
            <h3 style="font-size: 18px; font-weight: 600; color: #f1f5f9; margin: 0 0 8px;">No Recent Activity</h3>
            <p style="font-size: 14px; color: #94a3b8; margin: 0; max-width: 300px; margin: 0 auto;">System activity will appear here as actions are performed.</p>
          </div>
        `;
      } else {
        const activityList = this.createElement('div', {
          style: { maxHeight: '400px', overflowY: 'auto' }
        });
        
        this.activityLog.forEach((activity, index) => {
          const activityItem = this.renderActivityItem(activity, index);
          activityList.appendChild(activityItem);
        });
        
        activityCard.appendChild(activityList);
      }
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
    }, `Welcome back, ${this.user?.fullName?.split(' ')[0] || 'Admin'}`);
    
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
    
    const clockIcon = this.createElement('span', {
      style: { fontSize: '16px' }
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
    }, 'Here is the latest overview of your church\'s activities.');
    
    // Status bar with user stats
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
    
    // User stats chips
    const userStatsContainer = this.createElement('div', {
      style: {
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap'
      }
    });
    
    const totalUsersChip = this.createElement('div', {
      id: 'total-users-chip',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '12px',
        background: 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(139, 92, 246, 0.1)',
        fontSize: '14px'
      }
    });
    
    const totalUsersLabel = this.createElement('span', {
      style: { color: '#94a3b8' }
    }, '👥 Registered Users:');
    
    const totalUsersValue = this.createElement('span', {
      className: 'chip-value',
      style: { color: '#8b5cf6', fontWeight: '600' }
    }, this.userStats.total.toString());
    
    totalUsersChip.appendChild(totalUsersLabel);
    totalUsersChip.appendChild(totalUsersValue);
    
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
        border: '1px solid rgba(16, 185, 129, 0.2)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(16, 185, 129, 0.1)',
        fontSize: '14px'
      }
    });
    
    const activeUsersLabel = this.createElement('span', {
      style: { color: '#94a3b8' }
    }, '⚡ Active Users (30d):');
    
    const activeUsersValue = this.createElement('span', {
      className: 'chip-value',
      style: { color: '#10b981', fontWeight: '600' }
    }, this.userStats.activeLast30Days.toString());
    
    activeUsersChip.appendChild(activeUsersLabel);
    activeUsersChip.appendChild(activeUsersValue);
    
    userStatsContainer.appendChild(totalUsersChip);
    userStatsContainer.appendChild(activeUsersChip);
    
    // Logout button
    const logoutButton = this.createElement('button', {
      className: 'futuristic-button',
      id: 'logout-button',
      style: {
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.1))',
        padding: '12px 24px'
      }
    });
    
    const logoutIcon = this.createElement('span', {
      style: {
        fontSize: '16px',
        marginRight: '8px'
      }
    }, '🚪');
    
    const logoutText = document.createTextNode('Logout');
    
    logoutButton.appendChild(logoutIcon);
    logoutButton.appendChild(logoutText);
    
    statusBar.appendChild(userStatsContainer);
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
    
    const statCards = [
      {
        title: 'Total Revenue',
        value: this.formatCurrency(this.paymentStats.revenue),
        icon: '💰',
        color: '#3b82f6',
        id: 'revenue-card',
        gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(29, 78, 216, 0.3))',
        glow: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.4), transparent 70%)'
      },
      {
        title: 'Total Expenses',
        value: this.formatCurrency(this.paymentStats.expenses),
        icon: '📉',
        color: '#ef4444',
        id: 'expenses-card',
        gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.3))',
        glow: 'radial-gradient(circle at top right, rgba(239, 68, 68, 0.4), transparent 70%)'
      },
      {
        title: 'Net Balance',
        value: this.formatCurrency(this.paymentStats.netBalance),
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
      
      const cardGlow = this.createElement('div', {
        className: 'card-glow',
        style: { background: card.glow }
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
      }, card.icon);
      
      const contentContainer = this.createElement('div');
      
      const statTitle = this.createElement('p', {
        style: {
          fontSize: '16px',
          color: '#94a3b8',
          margin: '0 0 8px',
          fontWeight: '500'
        }
      }, card.title);
      
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
      }, this.statsAreVisible ? card.value : '••••••');
      
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
        href: action.link,
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
      
      const actionGlow = this.createElement('div', {
        className: 'card-glow',
        style: {
          background: `radial-gradient(circle at center, rgba(${this.hexToRgb(action.color)}, 0.3), transparent 70%)`
        }
      });
      actionCard.appendChild(actionGlow);
      
      const actionContent = this.createElement('div', {
        style: {
          padding: '25px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          zIndex: '2'
        }
      });
      
      const iconContainer = this.createElement('div', {
        className: 'hologram-icon',
        style: {
          fontSize: '24px',
          background: action.gradient,
          boxShadow: `0 0 15px rgba(${this.hexToRgb(action.color)}, 0.3)`,
          border: `1px solid rgba(${this.hexToRgb(action.color)}, 0.3)`,
          animationDuration: `${3 + Math.random()}s`
        }
      }, action.icon);
      
      const contentContainer = this.createElement('div', {
        style: { marginLeft: '16px' }
      });
      
      const actionTitle = this.createElement('h3', {
        style: {
          fontSize: '18px',
          fontWeight: '600',
          color: '#f1f5f9',
          margin: '0 0 6px'
        }
      }, action.title);
      
      const actionDescription = this.createElement('p', {
        style: {
          fontSize: '14px',
          color: '#94a3b8',
          margin: '0'
        }
      }, action.description);
      
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
      style: { animationDelay: '0.3s' }
    });
    
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
        borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        minHeight: '300px'
      }
    });
    
    const inquiriesGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.3), transparent 70%)'
      }
    });
    inquiriesCard.appendChild(inquiriesGlow);
    
    const inquiriesContent = this.createElement('div', {
      className: 'inquiries-content',
      style: { position: 'relative' }
    });
    
    // Initial empty state
    inquiriesContent.innerHTML = `
      <div style="padding: 50px 20px; text-align: center; color: #94a3b8;">
        <div style="font-size: 48px; margin-bottom: 16px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;">📬</div>
        <h3 style="font-size: 18px; font-weight: 600; color: #f1f5f9; margin: 0 0 8px;">Loading Inquiries...</h3>
        <p style="font-size: 14px; color: #94a3b8; margin: 0; max-width: 300px; margin: 0 auto;">Fetching the latest contact inquiries...</p>
      </div>
    `;
    
    inquiriesCard.appendChild(inquiriesContent);
    inquiriesSection.appendChild(inquiriesTitle);
    inquiriesSection.appendChild(inquiriesCard);
    
    return inquiriesSection;
  }

  renderActivityLogSection() {
    const activitySection = this.createElement('div', {
      className: 'animated-item',
      style: { animationDelay: '0.4s' }
    });
    
    const activityTitle = this.createElement('h2', {
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
    }, 'System Activity Log');
    
    const titleAccent = this.createElement('div', {
      style: {
        position: 'absolute',
        left: '-15px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '6px',
        height: '24px',
        background: 'linear-gradient(to bottom, #f59e0b, #d97706)',
        borderRadius: '3px'
      }
    });
    
    activityTitle.appendChild(titleAccent);
    
    const activityCard = this.createElement('div', {
      className: 'neo-card',
      style: {
        overflow: 'hidden',
        borderTop: '1px solid rgba(245, 158, 11, 0.2)',
        minHeight: '300px'
      }
    });
    
    const activityGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.3), transparent 70%)'
      }
    });
    activityCard.appendChild(activityGlow);
    
    const activityContent = this.createElement('div', {
      className: 'activity-content',
      style: { position: 'relative' }
    });
    
    // Initial empty state
    activityContent.innerHTML = `
      <div style="padding: 50px 20px; text-align: center; color: #94a3b8;">
        <div style="font-size: 48px; margin-bottom: 16px; background: linear-gradient(135deg, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;">📋</div>
        <h3 style="font-size: 18px; font-weight: 600; color: #f1f5f9; margin: 0 0 8px;">Loading Activity...</h3>
        <p style="font-size: 14px; color: #94a3b8; margin: 0; max-width: 300px; margin: 0 auto;">Fetching recent system activity...</p>
      </div>
    `;
    
    activityCard.appendChild(activityContent);
    activitySection.appendChild(activityTitle);
    activitySection.appendChild(activityCard);
    
    return activitySection;
  }

  renderInquiryItem(inquiry, index) {
    const inquiryItem = this.createElement('div', {
      className: 'animated-item inquiry-item',
      'data-inquiry-id': inquiry.id,
      style: {
        padding: '20px',
        borderBottom: index < this.inquiries.length - 1 ? '1px solid rgba(30, 41, 59, 0.8)' : 'none',
        transition: 'all 0.2s ease',
        position: 'relative',
        cursor: 'pointer',
        animationDelay: `${0.8 + (index * 0.1)}s`
      }
    });
    
    inquiryItem.addEventListener('mouseenter', () => {
      inquiryItem.style.background = 'rgba(30, 41, 59, 0.3)';
    });
    
    inquiryItem.addEventListener('mouseleave', () => {
      inquiryItem.style.background = 'transparent';
    });
    
    const urgencyIndicator = this.createElement('div', {
      style: {
        position: 'absolute',
        left: '0',
        top: '0',
        bottom: '0',
        width: '4px',
        background: index % 2 === 0 ? 
          'linear-gradient(to bottom, #8b5cf6, #6d28d9)' : 
          'linear-gradient(to bottom, #10b981, #059669)'
      }
    });
    
    inquiryItem.appendChild(urgencyIndicator);
    
    const inquiryHeader = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }
    });
    
    const userInfo = this.createElement('div', { style: { flex: '1' } });
    
    const inquirySubject = this.createElement('h3', {
      style: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#f1f5f9',
        margin: '0 0 6px'
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
    
    const userIcon = this.createElement('span', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: 'rgba(139, 92, 246, 0.2)',
        fontSize: '10px',
        color: '#a5b4fc'
      }
    }, '👤');
    
    const userName = this.createElement('span', {
      style: { fontWeight: '500' }
    }, inquiry.name || 'Unknown');
    
    senderInfo.appendChild(userIcon);
    senderInfo.appendChild(userName);
    
    userInfo.appendChild(inquirySubject);
    userInfo.appendChild(senderInfo);
    
    const inquiryDate = this.createElement('div', {
      style: {
        fontSize: '12px',
        color: '#94a3b8',
        padding: '4px 8px',
        borderRadius: '8px',
        background: 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }
    });
    
    const clockIcon = this.createElement('span', {
      style: { fontSize: '10px', color: '#a5b4fc' }
    }, '🕒');
    
    const dateText = document.createTextNode(
      inquiry.createdAt ? this.formatActivityTime(inquiry.createdAt) : 'Unknown time'
    );
    
    inquiryDate.appendChild(clockIcon);
    inquiryDate.appendChild(dateText);
    
    inquiryHeader.appendChild(userInfo);
    inquiryHeader.appendChild(inquiryDate);
    
    // Message preview
    const messagePreview = this.createElement('div', {
      style: {
        padding: '10px 12px',
        borderRadius: '8px',
        background: 'rgba(30, 41, 59, 0.4)',
        border: '1px solid rgba(99, 102, 241, 0.1)',
        fontSize: '13px',
        color: '#cbd5e1',
        lineHeight: '1.5',
        marginBottom: '15px',
        maxHeight: '40px',
        overflow: 'hidden',
        position: 'relative'
      }
    });
    
    const messageText = inquiry.message || 'No message content';
    const previewText = messageText.length > 100 ? 
      messageText.substring(0, 100) + '...' : messageText;
    
    messagePreview.textContent = previewText;
    
    // View Details button
    const viewButton = this.createElement('button', {
      className: 'futuristic-button inquiry-view-btn',
      'data-inquiry-id': inquiry.id,
      style: {
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.1))',
        padding: '8px 16px',
        fontSize: '14px'
      }
    });
    
    const viewIcon = this.createElement('span', {
      style: { fontSize: '14px', marginRight: '6px' }
    }, '👁️');
    
    const viewText = document.createTextNode('View Details');
    
    viewButton.appendChild(viewIcon);
    viewButton.appendChild(viewText);
    
    inquiryItem.appendChild(inquiryHeader);
    inquiryItem.appendChild(messagePreview);
    inquiryItem.appendChild(viewButton);
    
    return inquiryItem;
  }

  renderActivityItem(activity, index) {
    const activityItem = this.createElement('div', {
      className: 'animated-item',
      style: {
        padding: '15px 20px',
        borderBottom: index < this.activityLog.length - 1 ? '1px solid rgba(30, 41, 59, 0.8)' : 'none',
        transition: 'all 0.2s ease',
        position: 'relative',
        animationDelay: `${0.8 + (index * 0.1)}s`
      }
    });
    
    activityItem.addEventListener('mouseenter', () => {
      activityItem.style.background = 'rgba(30, 41, 59, 0.3)';
    });
    
    activityItem.addEventListener('mouseleave', () => {
      activityItem.style.background = 'transparent';
    });
    
    const activityHeader = this.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }
    });
    
    const { icon, text } = this.formatActivityLog(activity);
    
    const activityIcon = this.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'rgba(245, 158, 11, 0.2)',
        color: '#fbbf24',
        fontSize: '16px',
        flexShrink: '0'
      }
    }, icon);
    
    const activityContentDiv = this.createElement('div', { style: { flex: '1' } });
    
    const activityText = this.createElement('div', {
      style: {
        fontSize: '14px',
        color: '#f1f5f9',
        fontWeight: '500',
        marginBottom: '4px'
      }
    }, text);
    
    const activityMeta = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: '#94a3b8'
      }
    });
    
    const activityUser = this.createElement('span', {
      style: { fontWeight: '500' }
    }, `By: ${activity.initiator?.fullName || activity.user?.fullName || 'System'}`);
    
    const activityTime = this.createElement('span', {}, 
      activity.createdAt ? this.formatActivityTime(activity.createdAt) : 'Unknown time'
    );
    
    activityMeta.appendChild(activityUser);
    activityMeta.appendChild(activityTime);
    
    activityContentDiv.appendChild(activityText);
    activityContentDiv.appendChild(activityMeta);
    
    activityHeader.appendChild(activityIcon);
    activityHeader.appendChild(activityContentDiv);
    
    activityItem.appendChild(activityHeader);
    
    return activityItem;
  }

  renderInquiryModal() {
    const modal = this.createElement('div', {
      id: 'inquiry-modal',
      className: 'modal-overlay',
      style: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '9999',
        padding: '20px'
      }
    });
    
    const modalContent = this.createElement('div', {
      className: 'neo-card',
      style: {
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        position: 'relative'
      }
    });
    
    const modalGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.3), transparent 70%)'
      }
    });
    modalContent.appendChild(modalGlow);
    
    const modalHeader = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '25px 25px 15px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }
    });
    
    const modalTitle = this.createElement('h2', {
      id: 'modal-title',
      style: {
        fontSize: '22px',
        fontWeight: '600',
        color: '#f1f5f9',
        margin: '0'
      }
    }, 'Contact Inquiry');
    
    const closeButton = this.createElement('button', {
      id: 'modal-close-btn',
      style: {
        background: 'none',
        border: 'none',
        color: '#94a3b8',
        fontSize: '24px',
        cursor: 'pointer',
        padding: '5px',
        borderRadius: '50%',
        width: '35px',
        height: '35px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
      },
      onMouseenter: (e) => {
        e.target.style.background = 'rgba(239, 68, 68, 0.1)';
        e.target.style.color = '#ef4444';
      },
      onMouseleave: (e) => {
        e.target.style.background = 'none';
        e.target.style.color = '#94a3b8';
      }
    }, '×');
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    const modalBody = this.createElement('div', {
      id: 'modal-body',
      style: {
        padding: '25px'
      }
    });
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    
    return modal;
  }

  // Event Handling
  attachEventListeners(container) {
    // Delegate inquiry view button clicks
    container.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.inquiry-view-btn');
      if (viewBtn) {
        e.preventDefault();
        e.stopPropagation();
        const inquiryId = parseInt(viewBtn.dataset.inquiryId);
        this.showInquiryModal(inquiryId);
      }
      
      const logoutBtn = e.target.closest('#logout-button');
      if (logoutBtn) {
        e.preventDefault();
        this.handleLogout();
      }
    });

    // Modal event listeners
    const modal = document.getElementById('inquiry-modal');
    if (modal && !modal.dataset.listenerAttached) {
      modal.dataset.listenerAttached = 'true';
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('#modal-close-btn')) {
          modal.style.display = 'none';
          this.currentInquiry = null;
        }
        
        if (e.target.id === 'mark-resolved-btn') {
          this.resolveCurrentInquiry();
        }
      });
    }
  }

  handleLogout() {
    if (this.authService) {
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
        this.authService.logout();
        window.location.href = '/login';
      });
    }
  }

  showInquiryModal(inquiryId) {
    const inquiry = this.inquiries.find(i => i.id === inquiryId);
    if (!inquiry) return;
    
    this.currentInquiry = inquiry;
    
    const modal = document.getElementById('inquiry-modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 14px; color: #94a3b8; margin-bottom: 4px;">From:</div>
            <div style="font-size: 16px; color: #f1f5f9; font-weight: 500;">${this.escapeHtml(inquiry.name)}</div>
            <div style="font-size: 14px; color: #94a3b8;">${this.escapeHtml(inquiry.email)}</div>
            ${inquiry.phone ? `<div style="font-size: 14px; color: #94a3b8;">${this.escapeHtml(inquiry.phone)}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">Received:</div>
            <div style="font-size: 14px; color: #f1f5f9;">${inquiry.createdAt ? this.formatActivityTime(inquiry.createdAt) : 'Unknown time'}</div>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <div style="font-size: 14px; color: #94a3b8; margin-bottom: 8px;">Subject:</div>
          <div style="font-size: 18px; color: #f1f5f9; font-weight: 600;">${this.escapeHtml(inquiry.subject || 'No Subject')}</div>
        </div>
        
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; color: #94a3b8; margin-bottom: 8px;">Message:</div>
          <div style="padding: 15px; border-radius: 12px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(99, 102, 241, 0.1); font-size: 14px; color: #cbd5e1; line-height: 1.6; white-space: pre-wrap;">${this.escapeHtml(inquiry.message || 'No message content')}</div>
        </div>
        
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <a href="mailto:${inquiry.email}?subject=Re: ${encodeURIComponent(inquiry.subject || 'Your inquiry')}" 
             class="futuristic-button" 
             style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(8, 145, 178, 0.1)); text-decoration: none; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">✉️</span>
            Respond via Email
          </a>
          <button id="mark-resolved-btn" 
                  class="futuristic-button" 
                  style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1)); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">✓</span>
            Mark as Resolved
          </button>
        </div>
      </div>
    `;
    
    modal.style.display = 'flex';
  }

  async resolveCurrentInquiry() {
    if (!this.currentInquiry) return;
    
    const inquiryId = this.currentInquiry.id;
    
    try {
      if (this.apiService.updateInquiryStatus) {
        await this.apiService.updateInquiryStatus(inquiryId, 'RESOLVED');
      }
      
      // Remove from local array
      this.inquiries = this.inquiries.filter(inquiry => inquiry.id !== inquiryId);
      
      // Close modal
      document.getElementById('inquiry-modal').style.display = 'none';
      this.currentInquiry = null;
      
      // Update UI
      this.updateInquiriesSection();
      
      this.showNotification('Inquiry marked as resolved', 'success');
    } catch (error) {
      console.error('Error resolving inquiry:', error);
      this.showNotification('Error resolving inquiry', 'error');
    }
  }

  updateView() {
    // Simple view update that doesn't cause infinite loops
    this.updateDataInUI();
  }

  toggleStatsVisibility() {
    this.statsAreVisible = !this.statsAreVisible;
    
    // Update all eye icons
    const eyeIcons = document.querySelectorAll('.eye-toggle');
    eyeIcons.forEach(icon => {
      icon.textContent = this.statsAreVisible ? '👁️' : '👁️‍🗨️';
    });
    
    // Update all stat values
    const statCards = document.querySelectorAll('.stat-value');
    statCards.forEach((statValue, index) => {
      const values = [
        this.formatCurrency(this.paymentStats.revenue),
        this.formatCurrency(this.paymentStats.expenses),
        this.formatCurrency(this.paymentStats.netBalance)
      ];
      statValue.textContent = this.statsAreVisible ? values[index] : '••••••';
    });
  }

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
    
    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Utility Methods
  formatActivityLog(log) {
    const actionTextMap = {
      'ADMIN_CREATE_USER': 'created a new user',
      'ADMIN_UPDATE_USER': 'updated user profile',
      'ADMIN_DELETE_USER': 'deleted user',
      'USER_LOGIN': 'user logged in',
      'ADMIN_ADD_MANUAL_PAYMENT': 'added a manual payment',
      'ADMIN_ADD_EXPENSE': 'recorded an expense',
      'PAYMENT_CREATED': 'payment was created',
      'USER_REGISTERED': 'new user registered',
      'INQUIRY_SUBMITTED': 'inquiry was submitted',
      'INQUIRY_RESOLVED': 'inquiry was resolved'
    };
    
    const iconMap = {
      'USER': '👤',
      'PAYMENT': '💰',
      'EXPENSE': '📝',
      'LOGIN': '🔑',
      'CREATE': '➕',
      'UPDATE': '✏️',
      'DELETE': '🗑️',
      'INQUIRY': '✉️'
    };
    
    let text = actionTextMap[log.actionType] || log.actionType.replace(/_/g, ' ').toLowerCase();
    
    if (log.actionData?.createdUsername) {
      text += `: ${log.actionData.createdUsername}`;
    }
    
    const iconKey = Object.keys(iconMap).find(key => log.actionType.includes(key));
    const icon = iconMap[iconKey] || '⚙️';
    
    return { icon, text };
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

  formatCurrency(amount, currency = 'KES') {
    if (typeof amount !== 'number') return `${currency} 0.00`;
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  hexToRgb(hex) {
    if (!hex) return '0, 0, 0';
    
    hex = hex.replace('#', '');

    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `${r}, ${g}, ${b}`;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  addBackgroundEffects() {
    // Add futuristic background
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

    // Add particle overlay
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
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
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
          text-decoration: none;
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
        
        .animated-item {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        /* Responsive styles */
        @media (max-width: 768px) {
          .dashboard-container {
            padding: 20px 15px !important;
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
            padding: 15px 10px !important;
          }
          
          h1 {
            font-size: 24px !important;
          }
          
          h2 {
            font-size: 16px !important;
          }
          
          .neo-card {
            padding: 15px !important;
            border-radius: 16px !important;
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
        .animated-item:nth-child(1) { animation-delay: 0.1s; }
        .animated-item:nth-child(2) { animation-delay: 0.2s; }
        .animated-item:nth-child(3) { animation-delay: 0.3s; }
        .animated-item:nth-child(4) { animation-delay: 0.4s; }
        .animated-item:nth-child(5) { animation-delay: 0.5s; }
      `;
      document.head.appendChild(styleElement);
    }
  }
}