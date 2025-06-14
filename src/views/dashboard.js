// src/views/dashboard.js
export class DashboardView {
  constructor() {
    this.apiService = window.apiService;
    this.authService = window.authService;
    this.user = this.authService.getUser();
    
    // Core state management
    this.paymentStats = {
      totalContributed: 0,
      thisMonthContributed: 0,
      lastPaymentDate: null
    };
    this.specialOfferings = [];
    this.userPayments = [];
    this.userContributionsByOffering = new Map(); // Track user contributions per offering
    this.showingAllOfferings = false; // Track if showing all or limited offerings
    
    // Loading states
    this.isLoadingStats = true;
    this.isLoadingSpecial = true;
    this.isLoadingPayments = true;
    
    // Request throttling configuration
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 300; // ms between API calls
    
    // Error tracking
    this.error = null;

    // Device detection for responsive design
    this.isMobile = window.innerWidth < 768;
    this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    
    // Add resize event listener for responsive updates
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  
  // Device detection handler
  handleResize() {
    this.isMobile = window.innerWidth < 768;
    this.isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    
    // Update layout if dashboard is already rendered
    const container = document.getElementById('dashboard-container');
    if (container) {
      this.updateLayoutForDevice(container);
    }
  }
  
  updateLayoutForDevice(container) {
    const statsGrid = document.querySelector('#dashboard-container .stats-grid');
    const actionsGrid = document.querySelector('#dashboard-container .actions-grid');
    const specialGrid = document.getElementById('special-offerings-grid');
    
    if (this.isMobile) {
      if (statsGrid) statsGrid.style.gridTemplateColumns = 'repeat(1, 1fr)';
      if (actionsGrid) actionsGrid.style.gridTemplateColumns = 'repeat(1, 1fr)';
      if (specialGrid) specialGrid.style.gridTemplateColumns = 'repeat(1, 1fr)';
    } else if (this.isTablet) {
      if (statsGrid) statsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      if (actionsGrid) actionsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      if (specialGrid) specialGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else {
      if (statsGrid) statsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      if (actionsGrid) actionsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      if (specialGrid) specialGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    }
  }
  
  // Enhanced API Request Throttling
  queueApiRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      // Unique request ID for tracking
      const requestId = Date.now() + Math.random().toString(36).substring(2, 10);
      
      this.apiRequestQueue.push({
        id: requestId,
        request: requestFunction,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
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
    const requestItem = this.apiRequestQueue.shift();
    
    try {
      requestItem.request()
        .then(result => {
          requestItem.resolve(result);
        })
        .catch(error => {
          // Retry logic for network errors or 5xx responses
          if ((error.name === 'TypeError' || (error.response && error.response.status >= 500)) && 
              requestItem.retryCount < requestItem.maxRetries) {
            
            requestItem.retryCount++;
            
            // Exponential backoff: 300ms, 900ms, 2.7s
            const backoffTime = this.requestThrottleTime * Math.pow(3, requestItem.retryCount - 1);
            
            // Add back to queue with increased delay for retry
            setTimeout(() => {
              this.apiRequestQueue.push(requestItem);
              // Process next request immediately
              this.processApiRequestQueue();
            }, backoffTime);
          } else {
            requestItem.reject(error);
          }
        })
        .finally(() => {
          setTimeout(() => {
            this.processApiRequestQueue();
          }, this.requestThrottleTime);
        });
    } catch (error) {
      requestItem.reject(error);
      setTimeout(() => {
        this.processApiRequestQueue();
      }, this.requestThrottleTime);
    }
  }
  
  async render() {
    const container = document.createElement('div');
    container.id = 'dashboard-container';
    
    try {
      // Add modern styling and background effects
      this.addGlobalStyles();
      this.addBackgroundEffects();
      
      // Main container styling with improved responsiveness
      container.className = 'dashboard-container';
      container.style.maxWidth = '1300px';
      container.style.margin = '0 auto';
      container.style.padding = this.isMobile ? '20px 10px' : '30px 20px';
      container.style.color = '#eef2ff';
      container.style.fontFamily = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      container.style.position = 'relative';
      container.style.zIndex = '1';
      
      // Welcome section with futuristic design
      container.appendChild(this.renderWelcomeSection());
      
      // Stats Grid with glowing effects
      container.appendChild(this.renderStatsGrid());
      
      // Quick Actions section with holographic icons
      container.appendChild(this.renderActionsSection());
      
      // Special Offerings section (limited to 3)
      container.appendChild(this.renderSpecialOfferingsSection());
      
      // User Payments History section
      container.appendChild(this.renderPaymentsHistorySection());
      
      // Initialize data fetching with improved parallel loading
      setTimeout(() => {
        this.fetchDashboardData();
      }, 100);
      
      setTimeout(() => {
        const animatedItems = document.querySelectorAll('.animated-item');
        animatedItems.forEach(item => {
          item.style.opacity = '1';
        });
      }, 1000);
      
      // Apply device-specific layouts
      this.updateLayoutForDevice(container);
      
    } catch (error) {
      this.showErrorMessage(container, error.message);
    }
    
    return container;
  }
  
  showErrorMessage(container, message) {
    const errorMessage = document.createElement('div');
    errorMessage.style.color = '#EF4444';
    errorMessage.style.padding = '20px';
    errorMessage.style.textAlign = 'center';
    errorMessage.style.background = 'rgba(30, 41, 59, 0.7)';
    errorMessage.style.borderRadius = '12px';
    errorMessage.style.backdropFilter = 'blur(10px)';
    errorMessage.style.margin = '20px 0';
    errorMessage.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    errorMessage.textContent = `Error loading dashboard: ${message}`;
    
    container.appendChild(errorMessage);
  }
  
  // IMPROVED: Parallel data fetching for better performance
  async fetchDashboardData() {
    try {
      const userId = this.user?.id;
      if (!userId) {
        throw new Error('User ID not available');
      }

      // Fetch all data in parallel for better performance
      const dataFetches = [
        this.queueApiRequest(() => this.apiService.getUserPayments(userId, { limit: 1000 })),
        this.queueApiRequest(() => this.apiService.getSpecialOfferings({ activeOnly: true }))
      ];

      const [paymentsResponse, offeringsResponse] = await Promise.allSettled(dataFetches);

      // Handle payments data
      if (paymentsResponse.status === 'fulfilled' && paymentsResponse.value?.payments) {
        this.userPayments = paymentsResponse.value.payments;
        this.calculatePaymentStats(this.userPayments);
        this.isLoadingStats = false;
        this.isLoadingPayments = false;
        this.updateStatsUI();
        this.updatePaymentsUI();
      } else {
        console.error('Failed to fetch payments:', paymentsResponse.reason);
        this.isLoadingStats = false;
        this.isLoadingPayments = false;
        this.updateStatsUI();
        this.updatePaymentsUI();
      }

      // Handle special offerings data
      if (offeringsResponse.status === 'fulfilled' && offeringsResponse.value?.specialOfferings) {
        // Store ALL offerings but initially show only 3
        const allOfferings = this.sortByNewestFirst(offeringsResponse.value.specialOfferings);
        this.allSpecialOfferings = allOfferings; // Store all offerings
        this.specialOfferings = allOfferings.slice(0, 3); // Initially show only 3
        
        // Calculate user contributions for ALL offerings
        this.calculateUserContributionsPerOffering();
        
        // Enrich with progress data for all offerings
        await this.enrichSpecialOfferingsWithProgress();
        this.isLoadingSpecial = false;
        this.updateSpecialOfferingsUI();
      } else {
        console.error('Failed to fetch special offerings:', offeringsResponse.reason);
        this.specialOfferings = [];
        this.allSpecialOfferings = [];
        this.isLoadingSpecial = false;
        this.updateSpecialOfferingsUI();
      }

    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      this.showNotification('Failed to load some dashboard data', 'error');
      
      // Set loading states to false
      this.isLoadingStats = false;
      this.isLoadingSpecial = false;
      this.isLoadingPayments = false;
      
      // Update UI with error states
      this.updateStatsUI();
      this.updateSpecialOfferingsUI();
      this.updatePaymentsUI();
    }
  }

  // NEW: Calculate user's contributions per offering
  calculateUserContributionsPerOffering() {
    this.userContributionsByOffering.clear();
    
    if (!this.userPayments || !this.allSpecialOfferings) return;

    this.allSpecialOfferings.forEach(offering => {
      const userContributions = this.userPayments.filter(payment => 
        payment.status === 'COMPLETED' && 
        payment.paymentType === `SPECIAL_${offering.offeringType}` &&
        !payment.isExpense && 
        !payment.isTemplate
      );

      const totalUserContribution = userContributions.reduce(
        (sum, payment) => sum + parseFloat(payment.amount || 0), 
        0
      );

      this.userContributionsByOffering.set(offering.offeringType, {
        amount: totalUserContribution,
        count: userContributions.length,
        payments: userContributions
      });
    });
  }
  
  async enrichSpecialOfferingsWithProgress() {
    if (!this.allSpecialOfferings?.length) return;

    const progressFetches = this.allSpecialOfferings.map(async (offering) => {
      if (offering.targetGoal && offering.targetGoal > 0) {
        try {
          const progress = await this.queueApiRequest(() => 
            this.apiService.getSpecialOfferingProgress(offering.offeringType)
          );
          
          return {
            ...offering,
            percentage: progress.percentage || 0,
            totalContributed: progress.totalContributed || 0,
            remainingAmount: progress.remainingAmount || offering.targetGoal
          };
        } catch (err) {
          console.error(`Failed to fetch progress for ${offering.offeringType}:`, err);
          return {
            ...offering,
            percentage: 0,
            totalContributed: 0,
            remainingAmount: offering.targetGoal || 0
          };
        }
      }
      return offering;
    });
    
    this.allSpecialOfferings = await Promise.all(progressFetches);
    
    // Update the displayed offerings based on current view
    if (this.showingAllOfferings) {
      this.specialOfferings = [...this.allSpecialOfferings];
    } else {
      this.specialOfferings = this.allSpecialOfferings.slice(0, 3);
    }
  }
  
  calculatePaymentStats(payments) {
    if (!payments?.length) return;
    
    const completedPayments = payments.filter(payment => {
      const isSpecialOffering = payment.paymentType?.startsWith('SPECIAL_');
      const isValidType = payment.paymentType === 'TITHE' || 
                         payment.paymentType === 'OFFERING' || 
                         isSpecialOffering;
      
      return payment.status === 'COMPLETED' && 
             !payment.isExpense && 
             !payment.isTemplate && 
             isValidType;
    });
  
    // Calculate total including special offerings
    this.paymentStats.totalContributed = completedPayments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount || 0), 
      0
    );
  
    // Calculate this month's contributions including special offerings
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    this.paymentStats.thisMonthContributed = completedPayments
      .filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate.getMonth() === thisMonth && 
               paymentDate.getFullYear() === thisYear;
      })
      .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      
    // Update last payment date
    if (completedPayments.length) {
      this.paymentStats.lastPaymentDate = this.sortByNewestFirst(completedPayments)[0].paymentDate;
    }
  }
  
  // NEW: Toggle between showing 3 and all offerings
  toggleOfferingsView() {
    this.showingAllOfferings = !this.showingAllOfferings;
    
    if (this.showingAllOfferings) {
      this.specialOfferings = [...this.allSpecialOfferings];
    } else {
      this.specialOfferings = this.allSpecialOfferings.slice(0, 3);
    }
    
    // Update the UI
    this.updateSpecialOfferingsUI();
    
    // Update button text and icon
    const toggleBtn = document.getElementById('toggle-offerings-btn');
    if (toggleBtn) {
      const arrowIcon = toggleBtn.querySelector('span');
      toggleBtn.childNodes[0].textContent = this.showingAllOfferings ? 'Show Less' : `See All (${this.allSpecialOfferings?.length || 0})`;
      if (arrowIcon) {
        arrowIcon.textContent = this.showingAllOfferings ? '↑' : '↓';
      }
    }
  }
  
  sortByNewestFirst(items) {
    return [...items].sort((a, b) => {
      // First try using createdAt timestamp for most accurate sorting
      const timeA = new Date(a.createdAt || a.paymentDate || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.paymentDate || b.timestamp || 0).getTime();
      
      // If timestamps are equal (rare but possible), use ID as secondary sort
      if (timeA === timeB) {
        return (b.id || 0) - (a.id || 0); // Higher IDs are typically newer
      }
      
      return timeB - timeA; // Newest first
    });
  }
  
  renderWelcomeSection() {
    const welcomeSection = document.createElement('div');
    welcomeSection.id = 'welcome-section';
    welcomeSection.className = 'neo-card animated-item';
    welcomeSection.style.marginBottom = '40px';
    welcomeSection.style.padding = this.isMobile ? '20px' : '30px';
    welcomeSection.style.position = 'relative';
    welcomeSection.style.overflow = 'hidden';
    welcomeSection.style.animation = 'fadeIn 0.6s ease-out forwards';
    welcomeSection.style.opacity = '1';
    
    // Add glow effect
    const welcomeGlow = document.createElement('div');
    welcomeGlow.className = 'card-glow';
    welcomeGlow.style.background = 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.3), transparent 70%)';
    welcomeSection.appendChild(welcomeGlow);
    
    // Add floating particles for desktop only (performance)
    if (!this.isMobile) {
      this.addFloatingParticles(welcomeSection, 5);
    }
    
    const welcomeHeader = document.createElement('div');
    welcomeHeader.style.display = 'flex';
    welcomeHeader.style.justifyContent = 'space-between';
    welcomeHeader.style.alignItems = this.isMobile ? 'flex-start' : 'center';
    welcomeHeader.style.flexDirection = this.isMobile ? 'column' : 'row';
    welcomeHeader.style.gap = '20px';
    welcomeHeader.style.position = 'relative';
    welcomeHeader.style.zIndex = '2';
    
    // Enhanced welcome title with better visibility
    const welcomeTitle = document.createElement('h1');
    welcomeTitle.style.fontSize = this.isMobile ? '24px' : '32px';
    welcomeTitle.style.fontWeight = '700';
    welcomeTitle.style.margin = '0';
    welcomeTitle.style.color = '#ffffff';
    welcomeTitle.style.textShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
    welcomeTitle.textContent = `Welcome, ${this.user?.fullName || 'Contributor'}`;
    
    // Container for right side elements (date + logout)
    const rightContainer = document.createElement('div');
    rightContainer.style.display = 'flex';
    rightContainer.style.flexDirection = this.isMobile ? 'row' : 'column';
    rightContainer.style.gap = '10px';
    rightContainer.style.alignItems = this.isMobile ? 'center' : 'flex-end';
    rightContainer.style.width = this.isMobile ? '100%' : 'auto';
    rightContainer.style.justifyContent = this.isMobile ? 'space-between' : 'flex-start';
    
    // Enhanced date display for better visibility
    const dateDisplay = document.createElement('div');
    dateDisplay.style.fontSize = '14px';
    dateDisplay.style.padding = '10px 20px';
    dateDisplay.style.borderRadius = '16px';
    dateDisplay.style.background = 'rgba(30, 41, 59, 0.7)';
    dateDisplay.style.backdropFilter = 'blur(10px)';
    dateDisplay.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    dateDisplay.style.color = '#ffffff';
    dateDisplay.style.whiteSpace = this.isMobile ? 'nowrap' : 'normal';
    dateDisplay.style.overflow = 'hidden';
    dateDisplay.style.textOverflow = 'ellipsis';
    
    const dateText = document.createElement('span');
    dateText.style.display = 'flex';
    dateText.style.alignItems = 'center';
    dateText.style.gap = '8px';
    
    // Clock icon
    const clockIcon = document.createElement('span');
    clockIcon.style.fontSize = '16px';
    clockIcon.textContent = '🕒';
    
    // Simpler date format for mobile
    const dateOptions = this.isMobile 
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      
    const dateContent = document.createTextNode(new Date().toLocaleDateString('en-US', dateOptions));
    
    dateText.appendChild(clockIcon);
    dateText.appendChild(dateContent);
    dateDisplay.appendChild(dateText);
    
    // Logout button
    const logoutButton = document.createElement('button');
    logoutButton.textContent = 'Logout';
    logoutButton.className = 'futuristic-button';
    logoutButton.style.padding = '10px 16px';
    logoutButton.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))';
    logoutButton.style.borderRadius = '8px';
    logoutButton.style.color = '#ffffff';
    logoutButton.style.fontWeight = '500';
    logoutButton.style.display = 'flex';
    logoutButton.style.alignItems = 'center';
    logoutButton.style.gap = '6px';
    
    // Add logout icon
    const logoutIcon = document.createElement('span');
    logoutIcon.textContent = '🚪';
    logoutIcon.style.fontSize = '16px';
    
    logoutButton.prepend(logoutIcon);
    
    // Add logout functionality with security checks
    logoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      // Show confirmation modal for better UX
      this.showConfirmationDialog(
        'Logout Confirmation', 
        'Are you sure you want to logout?',
        () => {
          if (this.authService) {
            this.authService.logout();
          } else if (window.authService) {
            window.authService.logout();
          } else {
            // Fallback logout with extra security
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            
            // Clear any cookies by setting to expired
            document.cookie.split(";").forEach(cookie => {
              document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
            });
            
            window.location.href = '/login';
          }
        }
      );
    });
    
    // Add elements to right container
    rightContainer.appendChild(dateDisplay);
    rightContainer.appendChild(logoutButton);
    
    welcomeHeader.appendChild(welcomeTitle);
    welcomeHeader.appendChild(rightContainer);
    
    // Improved welcome subtitle with better visibility
    const welcomeSubtitle = document.createElement('p');
    welcomeSubtitle.style.marginTop = '15px';
    welcomeSubtitle.style.marginBottom = '25px';
    welcomeSubtitle.style.fontSize = '16px';
    welcomeSubtitle.style.color = '#e2e8f0';
    welcomeSubtitle.style.maxWidth = '600px';
    welcomeSubtitle.style.lineHeight = '1.5';
    welcomeSubtitle.style.textShadow = '0 1px 4px rgba(0, 0, 0, 0.3)';
    welcomeSubtitle.textContent = 'Track your contributions and explore special offerings with our interactive dashboard';
    
    welcomeSection.appendChild(welcomeHeader);
    welcomeSection.appendChild(welcomeSubtitle);
    
    return welcomeSection;
  }
  
  addFloatingParticles(container, count = 5) {
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = `${Math.random() * 6 + 2}px`;
      particle.style.height = `${Math.random() * 6 + 2}px`;
      particle.style.borderRadius = '50%';
      particle.style.background = 'rgba(45, 212, 191, 0.3)';
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.right = `${Math.random() * 30}%`;
      particle.style.animation = `float ${Math.random() * 4 + 3}s ease-in-out infinite`;
      particle.style.animationDelay = `${Math.random() * 2}s`;
      particle.style.opacity = Math.random() * 0.5 + 0.2;
      particle.style.zIndex = '1';
      container.appendChild(particle);
    }
  }
  
  renderStatsGrid() {
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';
    statsGrid.style.display = 'grid';
    statsGrid.style.gridTemplateColumns = this.isMobile 
      ? 'repeat(1, 1fr)' 
      : this.isTablet 
        ? 'repeat(2, 1fr)' 
        : 'repeat(3, 1fr)';
    statsGrid.style.gap = '25px';
    statsGrid.style.marginBottom = '40px';
    
    // Create stat cards
    const statCards = [
      {
        title: 'Total Contributions',
        value: this.isLoadingStats ? '...' : this.formatCurrency(this.paymentStats.totalContributed),
        icon: '💰',
        color: '#06b6d4',
        id: 'total-contributions',
        gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(8, 145, 178, 0.3))',
        glow: 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.4), transparent 70%)'
      },
      {
        title: 'This Month',
        value: this.isLoadingStats ? '...' : this.formatCurrency(this.paymentStats.thisMonthContributed),
        icon: '📅',
        color: '#10b981',
        id: 'this-month',
        gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(4, 120, 87, 0.3))',
        glow: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.4), transparent 70%)'
      },
      {
        title: 'Last Contribution',
        value: this.isLoadingStats ? '...' : (this.paymentStats.lastPaymentDate ? new Date(this.paymentStats.lastPaymentDate).toLocaleDateString() : 'No payments yet'),
        icon: '🕒',
        color: '#0ea5e9',
        id: 'last-contribution',
        gradient: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(2, 132, 199, 0.3))',
        glow: 'radial-gradient(circle at top right, rgba(14, 165, 233, 0.4), transparent 70%)'
      }
    ];
    
    statCards.forEach((card, index) => {
      const statCard = document.createElement('div');
      statCard.className = 'neo-card animated-item';
      statCard.id = card.id;
      statCard.style.padding = '24px';
      statCard.style.display = 'flex';
      statCard.style.alignItems = 'center';
      statCard.style.position = 'relative';
      statCard.style.cursor = 'pointer';
      statCard.style.animationDelay = `${0.1 * (index + 1)}s`;
      
      // Add glow effect
      const cardGlow = document.createElement('div');
      cardGlow.className = 'card-glow';
      cardGlow.style.background = card.glow;
      statCard.appendChild(cardGlow);
      
      const iconContainer = document.createElement('div');
      iconContainer.className = 'hologram-icon';
      iconContainer.style.width = '60px';
      iconContainer.style.height = '60px';
      iconContainer.style.borderRadius = '16px';
      iconContainer.style.background = card.gradient;
      iconContainer.style.display = 'flex';
      iconContainer.style.alignItems = 'center';
      iconContainer.style.justifyContent = 'center';
      iconContainer.style.marginRight = '20px';
      iconContainer.style.fontSize = '28px';
      iconContainer.style.boxShadow = `0 0 15px rgba(${this.hexToRgb(card.color)}, 0.3)`;
      iconContainer.style.border = `1px solid rgba(${this.hexToRgb(card.color)}, 0.3)`;
      iconContainer.style.flexShrink = '0';
      iconContainer.textContent = card.icon || '';
      
      const contentContainer = document.createElement('div');
      
      const statTitle = document.createElement('p');
      statTitle.style.fontSize = '16px';
      statTitle.style.color = '#e2e8f0';
      statTitle.style.margin = '0 0 8px';
      statTitle.style.fontWeight = '500';
      statTitle.textContent = card.title || 'Stats';
      
      const statValue = document.createElement('h3');
      statValue.className = 'stat-value';
      statValue.style.fontSize = '26px';
      statValue.style.fontWeight = '700';
      statValue.style.color = '#ffffff';
      statValue.style.margin = '0';
      statValue.style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
      statValue.textContent = card.value || '0';
      
      contentContainer.appendChild(statTitle);
      contentContainer.appendChild(statValue);
      
      statCard.appendChild(iconContainer);
      statCard.appendChild(contentContainer);
      
      // Add click event to show detailed breakdown
      statCard.addEventListener('click', () => {
        if (card.id === 'total-contributions') {
          this.showTotalContributionsBreakdown();
        } else if (card.id === 'this-month') {
          this.showMonthlyContributionsBreakdown();
        } else if (card.id === 'last-contribution') {
          if (this.paymentStats.lastPaymentDate) {
            this.showLastContributionDetails();
          }
        }
      });
      
      statsGrid.appendChild(statCard);
    });
    
    return statsGrid;
  }
  
  // New methods for stat card details
  
  showTotalContributionsBreakdown() {
    if (!this.userPayments || this.userPayments.length === 0) {
      this.showNotification('No payment data available for breakdown', 'warning');
      return;
    }
    
    // Filter and prepare data
    const paymentsByType = {};
    const completedPayments = this.userPayments.filter(p => 
      p.status === 'COMPLETED' && 
      p.isExpense !== true && 
      p.isTemplate !== true
    );
    
    completedPayments.forEach(payment => {
      const type = this.formatPaymentType(payment.paymentType);
      
      if (!paymentsByType[type]) {
        paymentsByType[type] = {
          count: 0,
          total: 0
        };
      }
      
      paymentsByType[type].count++;
      paymentsByType[type].total += parseFloat(payment.amount || 0);
    });
    
    // Create breakdown for modal
    const breakdownContent = document.createElement('div');
    breakdownContent.style.display = 'flex';
    breakdownContent.style.flexDirection = 'column';
    breakdownContent.style.gap = '15px';
    
    const totalAmount = document.createElement('h3');
    totalAmount.style.margin = '0 0 15px';
    totalAmount.style.color = '#ffffff';
    totalAmount.style.textAlign = 'center';
    totalAmount.textContent = `Total: ${this.formatCurrency(this.paymentStats.totalContributed)}`;
    breakdownContent.appendChild(totalAmount);
    
    // Add export as PDF button
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export Report';
    exportButton.className = 'futuristic-button';
    exportButton.style.marginBottom = '20px';
    exportButton.style.alignSelf = 'center';
    exportButton.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))';
    
    exportButton.addEventListener('click', () => {
      this.generateContributionsReport(completedPayments, 'Total Contributions');
    });
    
    breakdownContent.appendChild(exportButton);
    
    // Create chart container
    const chartContainer = document.createElement('div');
    chartContainer.style.height = '200px';
    chartContainer.style.marginBottom = '20px';
    breakdownContent.appendChild(chartContainer);
    
    // Create table of breakdown
    const breakdownTable = document.createElement('table');
    breakdownTable.style.width = '100%';
    breakdownTable.style.borderCollapse = 'collapse';
    
    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Payment Type', 'Count', 'Amount', 'Percentage'];
    headers.forEach(header => {
      const th = document.createElement('th');
      th.style.padding = '10px';
      th.style.textAlign = header === 'Payment Type' ? 'left' : 'right';
      th.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      th.textContent = header;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    breakdownTable.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    Object.entries(paymentsByType).forEach(([type, data]) => {
      const percentage = (data.total / this.paymentStats.totalContributed) * 100;
      
      const row = document.createElement('tr');
      
      const typeCell = document.createElement('td');
      typeCell.style.padding = '12px 10px';
      typeCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      typeCell.textContent = type;
      
      const countCell = document.createElement('td');
      countCell.style.padding = '12px 10px';
      countCell.style.textAlign = 'right';
      countCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      countCell.textContent = data.count;
      
      const amountCell = document.createElement('td');
      amountCell.style.padding = '12px 10px';
      amountCell.style.textAlign = 'right';
      amountCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      amountCell.textContent = this.formatCurrency(data.total);
      
      const percentageCell = document.createElement('td');
      percentageCell.style.padding = '12px 10px';
      percentageCell.style.textAlign = 'right';
      percentageCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      percentageCell.textContent = `${percentage.toFixed(1)}%`;
      
      row.appendChild(typeCell);
      row.appendChild(countCell);
      row.appendChild(amountCell);
      row.appendChild(percentageCell);
      
      tbody.appendChild(row);
    });
    
    breakdownTable.appendChild(tbody);
    breakdownContent.appendChild(breakdownTable);
    
    this.showModal('Contribution Breakdown', breakdownContent);
    
    // Create pie chart using canvas
    setTimeout(() => {
      this.renderPieChart(chartContainer, paymentsByType);
    }, 100);
  }
  
  renderPieChart(container, data) {
    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // Calculate total for percentages
    const total = Object.values(data).reduce((sum, item) => sum + item.total, 0);
    
    // Set up colors
    const colors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4'  // cyan
    ];
    
    // Draw pie chart
    let startAngle = 0;
    let colorIndex = 0;
    
    // Create an array from the data for easier sorting
    const dataArray = Object.entries(data).map(([label, values]) => ({
      label,
      ...values
    }));
    
    // Sort by amount (largest first)
    dataArray.sort((a, b) => b.total - a.total);
    
    // Center point
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;
    
    // Create a legend array to display later
    const legendItems = [];
    
    // Draw pie segments
    dataArray.forEach(item => {
      const value = item.total;
      const percentage = (value / total) * 100;
      const sliceAngle = (percentage / 100) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      
      // Select color
      const color = colors[colorIndex % colors.length];
      colorIndex++;
      
      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      
      // Fill with color
      ctx.fillStyle = color;
      ctx.fill();
      
      // Store for legend
      legendItems.push({
        label: item.label,
        color,
        percentage
      });
      
      // Update start angle for next slice
      startAngle = endAngle;
    });
    
    // Draw legends
    const legendX = 10;
    let legendY = 25;
    
    legendItems.forEach(item => {
      // Color box
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, legendY - 10, 15, 15);
      
      // Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(`${item.label} (${item.percentage.toFixed(1)}%)`, legendX + 20, legendY);
      
      legendY += 20;
    });
  }
  
  showMonthlyContributionsBreakdown() {
    if (!this.userPayments || this.userPayments.length === 0) {
      this.showNotification('No payment data available for breakdown', 'warning');
      return;
    }
    
    // Get current month data
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    const thisMonthPayments = this.userPayments.filter(payment => {
      if (payment.status !== 'COMPLETED' || payment.isExpense === true || payment.isTemplate === true) {
        return false;
      }
      
      const paymentDate = new Date(payment.paymentDate);
      return paymentDate.getMonth() === thisMonth && 
             paymentDate.getFullYear() === thisYear;
    });
    
    // Create modal content
    const content = document.createElement('div');
    
    const monthHeader = document.createElement('h3');
    monthHeader.style.textAlign = 'center';
    monthHeader.style.margin = '0 0 20px';
    monthHeader.textContent = `${now.toLocaleString('default', { month: 'long' })} ${thisYear} Contributions`;
    content.appendChild(monthHeader);
    
    const totalAmount = document.createElement('h4');
    totalAmount.style.textAlign = 'center';
    totalAmount.style.margin = '0 0 20px';
    totalAmount.textContent = `Total: ${this.formatCurrency(this.paymentStats.thisMonthContributed)}`;
    content.appendChild(totalAmount);
    
    // Add export button
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export Report';
    exportButton.className = 'futuristic-button';
    exportButton.style.marginBottom = '20px';
    exportButton.style.display = 'block';
    exportButton.style.margin = '0 auto 20px';
    
    exportButton.addEventListener('click', () => {
      this.generateContributionsReport(
        thisMonthPayments, 
        `Contributions for ${now.toLocaleString('default', { month: 'long' })} ${thisYear}`
      );
    });
    
    content.appendChild(exportButton);
    
    // Create table of this month's payments
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    
    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    ['Date', 'Type', 'Description', 'Amount'].forEach(header => {
      const th = document.createElement('th');
      th.style.padding = '10px';
      th.style.textAlign = header === 'Amount' ? 'right' : 'left';
      th.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      th.textContent = header;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    this.sortByNewestFirst(thisMonthPayments)
      .forEach(payment => {
        const row = document.createElement('tr');
        
        // Date cell
        const dateCell = document.createElement('td');
        dateCell.style.padding = '10px';
        dateCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        dateCell.textContent = new Date(payment.paymentDate).toLocaleDateString();
        
        // Type cell
        const typeCell = document.createElement('td');
        typeCell.style.padding = '10px';
        typeCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        typeCell.textContent = this.formatPaymentType(payment.paymentType);
        
        // Description cell
        const descCell = document.createElement('td');
        descCell.style.padding = '10px';
        descCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        descCell.textContent = payment.description || '-';
        
        // Amount cell
        const amountCell = document.createElement('td');
        amountCell.style.padding = '10px';
        amountCell.style.textAlign = 'right';
        amountCell.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        amountCell.style.fontWeight = '600';
        amountCell.textContent = this.formatCurrency(payment.amount);
        
        row.appendChild(dateCell);
        row.appendChild(typeCell);
        row.appendChild(descCell);
        row.appendChild(amountCell);
        
        tbody.appendChild(row);
      });
    
    table.appendChild(tbody);
    content.appendChild(table);
    
    this.showModal(`${now.toLocaleString('default', { month: 'long' })} Contributions`, content);
  }
  
  showLastContributionDetails() {
    if (!this.userPayments || this.userPayments.length === 0) {
      this.showNotification('No payment data available', 'warning');
      return;
    }
    
    // Find last payment
    const completedPayments = this.userPayments.filter(p => 
      p.status === 'COMPLETED' && 
      p.isExpense !== true && 
      p.isTemplate !== true
    );
    
    if (completedPayments.length === 0) {
      this.showNotification('No completed payments found', 'warning');
      return;
    }
    
    // Sort by date descending
    const sortedPayments = this.sortByNewestFirst(completedPayments);
    
    // Get the most recent payment
    const lastPayment = sortedPayments[0];
    
    // Show payment details
    this.showPaymentDetails(lastPayment);
  }

  // IMPROVED: Simple HTML/CSS report generation (no external dependencies)
  generateContributionsReport(payments, title) {
    try {
      // Create a simple HTML report that can be printed or saved
      const reportContent = this.createHTMLReport(payments, title);
      
      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(reportContent);
      printWindow.document.close();
      
      // Auto-focus and prompt for print
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
      
      this.showNotification('Report generated successfully! Use your browser to save as PDF.', 'success');
    } catch (error) {
      console.error('Report generation error:', error);
      this.showNotification('Failed to generate report. Please try again.', 'error');
    }
  }

  createHTMLReport(payments, title) {
    const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <title>${title}</title>
          <style>
              body { 
                  font-family: Arial, sans-serif; 
                  margin: 20px; 
                  color: #333;
                  background: #fff;
              }
              .header { 
                  text-align: center; 
                  margin-bottom: 30px; 
                  border-bottom: 2px solid #333;
                  padding-bottom: 20px;
              }
              .header h1 { 
                  color: #1a365d; 
                  margin: 0;
                  font-size: 24px;
              }
              .header h2 { 
                  color: #2d3748; 
                  margin: 5px 0;
                  font-size: 18px;
              }
              .info { 
                  margin: 20px 0; 
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
              }
              .info-item {
                  background: #f7fafc;
                  padding: 10px;
                  border-radius: 5px;
              }
              .total { 
                  font-size: 18px; 
                  font-weight: bold; 
                  color: #1a365d;
                  text-align: center;
                  margin: 20px 0;
                  padding: 15px;
                  background: #e6fffa;
                  border-radius: 8px;
              }
              table { 
                  width: 100%; 
                  border-collapse: collapse; 
                  margin: 20px 0;
              }
              th, td { 
                  border: 1px solid #ddd; 
                  padding: 12px; 
                  text-align: left; 
              }
              th { 
                  background: #1a365d; 
                  color: white;
                  font-weight: bold;
              }
              tr:nth-child(even) { 
                  background: #f8f9fa; 
              }
              .amount { 
                  text-align: right; 
                  font-weight: bold;
              }
              .footer {
                  margin-top: 40px;
                  text-align: center;
                  color: #666;
                  font-size: 12px;
                  border-top: 1px solid #ddd;
                  padding-top: 20px;
              }
              @media print {
                  body { margin: 0; }
                  .no-print { display: none; }
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>TASSIAC CHURCH</h1>
              <h2>${title}</h2>
          </div>
          
          <div class="info">
              <div class="info-item">
                  <strong>Contributor:</strong> ${this.user?.fullName || 'Unknown'}
              </div>
              <div class="info-item">
                  <strong>Generated:</strong> ${new Date().toLocaleString()}
              </div>
              <div class="info-item">
                  <strong>Number of Payments:</strong> ${payments.length}
              </div>
              <div class="info-item">
                  <strong>Period:</strong> ${this.getDateRange(payments)}
              </div>
          </div>
          
          <div class="total">
              Total Amount: ${this.formatCurrency(totalAmount)}
          </div>
          
          <table>
              <thead>
                  <tr>
                      <th>Date</th>
                      <th>Payment Type</th>
                      <th>Method</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                  </tr>
              </thead>
              <tbody>
                  ${payments.map(payment => `
                      <tr>
                          <td>${new Date(payment.paymentDate).toLocaleDateString()}</td>
                          <td>${this.formatPaymentType(payment.paymentType)}</td>
                          <td>${payment.paymentMethod || '-'}</td>
                          <td>${payment.description || '-'}</td>
                          <td class="amount">${this.formatCurrency(payment.amount)}</td>
                          <td>${payment.status}</td>
                      </tr>
                  `).join('')}
              </tbody>
          </table>
          
          <div class="footer">
              <p>TASSIAC CHURCH - Official Report</p>
              <p>This is an automatically generated report. Please keep for your records.</p>
          </div>
      </body>
      </html>
    `;
  }

  getDateRange(payments) {
    if (!payments.length) return 'No data';
    
    const dates = payments.map(p => new Date(p.paymentDate)).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    
    if (earliest.toDateString() === latest.toDateString()) {
      return earliest.toLocaleDateString();
    }
    
    return `${earliest.toLocaleDateString()} - ${latest.toLocaleDateString()}`;
  }
  
  renderActionsSection() {
    const actionsSection = document.createElement('div');
    actionsSection.className = 'animated-item';
    actionsSection.style.marginBottom = '40px';
    actionsSection.style.animationDelay = '0.5s';
    
    // Improved section title visibility
    const actionsTitle = document.createElement('h2');
    actionsTitle.style.fontSize = '20px';
    actionsTitle.style.fontWeight = '600';
    actionsTitle.style.color = '#ffffff';
    actionsTitle.style.marginBottom = '20px';
    actionsTitle.style.position = 'relative';
    actionsTitle.style.marginLeft = '15px';
    actionsTitle.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    actionsTitle.textContent = 'Quick Actions';
    
    // Add a small accent bar to the left of the title
    const titleAccent = document.createElement('div');
    titleAccent.style.position = 'absolute';
    titleAccent.style.left = '-15px';
    titleAccent.style.top = '50%';
    titleAccent.style.transform = 'translateY(-50%)';
    titleAccent.style.width = '6px';
    titleAccent.style.height = '24px';
    titleAccent.style.background = 'linear-gradient(to bottom, #10b981, #0ea5e9)';
    titleAccent.style.borderRadius = '3px';
    
    actionsTitle.appendChild(titleAccent);
    
    const actionsGrid = document.createElement('div');
    actionsGrid.className = 'actions-grid';
    actionsGrid.style.display = 'grid';
    actionsGrid.style.gridTemplateColumns = this.isMobile 
      ? 'repeat(1, 1fr)' 
      : this.isTablet 
        ? 'repeat(2, 1fr)' 
        : 'repeat(3, 1fr)';
    actionsGrid.style.gap = '20px';
    
    const actions = [
      {
        title: 'Make Payment',
        description: 'Contribute tithe, offering, or donation',
        icon: '💸',
        link: '/make-payment',
        color: '#06b6d4',
        gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1))',
        onClick: () => { window.location.href = '/make-payment'; }
      },
      {
        title: 'View Profile',
        description: 'Update your personal information',
        icon: '👤',
        link: '/profile',
        color: '#10b981',
        gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))',
        onClick: () => { window.location.href = '/profile'; }
      },
      {
        title: 'Contact Us',
        description: 'Get in touch with the church',
        icon: '📞',
        link: '/contact',
        color: '#0ea5e9',
        gradient: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(14, 165, 233, 0.1))',
        onClick: () => { window.location.href = '/contact'; }
      }
    ];
    
    actions.forEach((action, index) => {
      const actionCard = document.createElement('a');
      actionCard.href = action.link || '#';
      actionCard.className = 'neo-card animated-item';
      actionCard.style.padding = '0';
      actionCard.style.textDecoration = 'none';
      actionCard.style.position = 'relative';
      actionCard.style.overflow = 'hidden';
      actionCard.style.animationDelay = `${0.6 + (index * 0.1)}s`;
      actionCard.style.borderTop = `1px solid rgba(${this.hexToRgb(action.color)}, 0.2)`;
      
      // Add glow effect
      const actionGlow = document.createElement('div');
      actionGlow.className = 'card-glow';
      actionGlow.style.background = `radial-gradient(circle at center, rgba(${this.hexToRgb(action.color)}, 0.3), transparent 70%)`;
      actionCard.appendChild(actionGlow);
      
      // Add content with hover overlay
      const actionContent = document.createElement('div');
      actionContent.style.padding = '25px';
      actionContent.style.display = 'flex';
      actionContent.style.alignItems = 'center';
      actionContent.style.position = 'relative';
      actionContent.style.zIndex = '2';
      
      // Futuristic floating icon
      const iconContainer = document.createElement('div');
      iconContainer.className = 'hologram-icon';
      iconContainer.style.fontSize = '24px';
      iconContainer.style.background = action.gradient;
      iconContainer.style.boxShadow = `0 0 15px rgba(${this.hexToRgb(action.color)}, 0.3)`;
      iconContainer.style.border = `1px solid rgba(${this.hexToRgb(action.color)}, 0.3)`;
      iconContainer.style.animationDuration = `${3 + Math.random()}s`;
      iconContainer.textContent = action.icon || '';
      
      const contentContainer = document.createElement('div');
      contentContainer.style.marginLeft = '16px';
      
      const actionTitle = document.createElement('h3');
      actionTitle.style.fontSize = '18px';
      actionTitle.style.fontWeight = '600';
      actionTitle.style.color = '#ffffff';
      actionTitle.style.margin = '0 0 6px';
      actionTitle.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
      actionTitle.textContent = action.title || 'Action';
      
      const actionDescription = document.createElement('p');
      actionDescription.style.fontSize = '14px';
      actionDescription.style.color = '#e2e8f0';
      actionDescription.style.margin = '0';
      actionDescription.textContent = action.description || '';
      
      // Arrow indicator
      const arrowIcon = document.createElement('div');
      arrowIcon.style.position = 'absolute';
      arrowIcon.style.top = '50%';
      arrowIcon.style.right = '20px';
      arrowIcon.style.transform = 'translateY(-50%)';
      arrowIcon.style.width = '24px';
      arrowIcon.style.height = '24px';
      arrowIcon.style.borderRadius = '50%';
      arrowIcon.style.background = 'rgba(30, 41, 59, 0.4)';
      arrowIcon.style.display = 'flex';
      arrowIcon.style.alignItems = 'center';
      arrowIcon.style.justifyContent = 'center';
      arrowIcon.style.color = '#e2e8f0';
      arrowIcon.style.fontSize = '14px';
      arrowIcon.style.transition = 'all 0.3s ease';
      arrowIcon.textContent = '→';
      
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
        arrowIcon.style.color = '#e2e8f0';
        arrowIcon.style.transform = 'translateY(-50%) translateX(0)';
      });
      
      // Add custom click handler with preventDefault
      if (action.onClick) {
        actionCard.addEventListener('click', (e) => {
          e.preventDefault();
          action.onClick();
        });
      }
      
      actionCard.appendChild(actionContent);
      actionsGrid.appendChild(actionCard);
    });
    
    actionsSection.appendChild(actionsTitle);
    actionsSection.appendChild(actionsGrid);
    
    return actionsSection;
  }
  
  // UPDATED: Limit to 3 offerings with "See All" button
  renderSpecialOfferingsSection() {
    const specialSection = document.createElement('div');
    specialSection.className = 'animated-item';
    specialSection.id = 'special-offerings-section';
    specialSection.style.marginBottom = '40px';
    specialSection.style.animationDelay = '0.6s';
    
    // Section header with title and "See All" button
    const sectionHeader = document.createElement('div');
    sectionHeader.style.display = 'flex';
    sectionHeader.style.justifyContent = 'space-between';
    sectionHeader.style.alignItems = 'center';
    sectionHeader.style.marginBottom = '20px';
    sectionHeader.style.flexWrap = 'wrap';
    sectionHeader.style.gap = '15px';
    
    // Improved section title visibility
    const specialTitle = document.createElement('h2');
    specialTitle.style.fontSize = '20px';
    specialTitle.style.fontWeight = '600';
    specialTitle.style.color = '#ffffff';
    specialTitle.style.margin = '0';
    specialTitle.style.position = 'relative';
    specialTitle.style.marginLeft = '15px';
    specialTitle.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    specialTitle.textContent = 'Special Offerings';
    
    // Add a small accent bar to the left of the title
    const titleAccent = document.createElement('div');
    titleAccent.style.position = 'absolute';
    titleAccent.style.left = '-15px';
    titleAccent.style.top = '50%';
    titleAccent.style.transform = 'translateY(-50%)';
    titleAccent.style.width = '6px';
    titleAccent.style.height = '24px';
    titleAccent.style.background = 'linear-gradient(to bottom, #f59e0b, #d97706)';
    titleAccent.style.borderRadius = '3px';
    
    specialTitle.appendChild(titleAccent);
    
    // NEW: Toggle button for showing all offerings
    const seeAllButton = document.createElement('button');
    seeAllButton.id = 'toggle-offerings-btn';
    seeAllButton.textContent = this.showingAllOfferings ? 'Show Less' : `See All (${this.allSpecialOfferings?.length || 0})`;
    seeAllButton.className = 'futuristic-button';
    seeAllButton.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))';
    seeAllButton.style.color = '#ffffff';
    seeAllButton.style.padding = '10px 20px';
    seeAllButton.style.fontSize = '14px';
    seeAllButton.style.display = 'flex';
    seeAllButton.style.alignItems = 'center';
    seeAllButton.style.gap = '8px';
    
    // Add arrow icon
    const arrowIcon = document.createElement('span');
    arrowIcon.textContent = this.showingAllOfferings ? '↑' : '↓';
    arrowIcon.style.fontSize = '16px';
    seeAllButton.appendChild(arrowIcon);
    
    seeAllButton.addEventListener('click', () => {
      this.toggleOfferingsView();
    });
    
    sectionHeader.appendChild(specialTitle);
    sectionHeader.appendChild(seeAllButton);
    
    const specialGrid = document.createElement('div');
    specialGrid.id = 'special-offerings-grid';
    specialGrid.style.display = 'grid';
    specialGrid.style.gridTemplateColumns = this.isMobile 
      ? 'repeat(1, 1fr)' 
      : this.isTablet 
        ? 'repeat(2, 1fr)' 
        : 'repeat(auto-fill, minmax(320px, 1fr))';
    specialGrid.style.gap = '20px';
    
    // Loading state for special offerings
    if (this.isLoadingSpecial) {
      const loadingDiv = document.createElement('div');
      loadingDiv.style.gridColumn = '1 / -1';
      loadingDiv.style.display = 'flex';
      loadingDiv.style.justifyContent = 'center';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.padding = '40px 0';
      
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      
      loadingDiv.appendChild(spinner);
      specialGrid.appendChild(loadingDiv);
    } else if (!this.specialOfferings || this.specialOfferings.length === 0) {
      const emptyState = this.createEmptyState(
        'No Special Offerings Available',
        'There are no special offerings at this time. Please check back later.'
      );
      specialGrid.appendChild(emptyState);
    } else {
      // Render special offerings (limited to 3)
      this.specialOfferings.forEach((offering, index) => {
        const offeringCard = this.createOfferingCard(offering, index);
        specialGrid.appendChild(offeringCard);
      });
    }
    
    specialSection.appendChild(sectionHeader);
    specialSection.appendChild(specialGrid);
    
    return specialSection;
  }
  
  createEmptyState(title, message) {
    const emptyState = document.createElement('div');
    emptyState.className = 'neo-card';
    emptyState.style.gridColumn = '1 / -1';
    emptyState.style.padding = '30px';
    emptyState.style.textAlign = 'center';
    
    const emptyIcon = document.createElement('div');
    emptyIcon.textContent = '🔍';
    emptyIcon.style.fontSize = '32px';
    emptyIcon.style.marginBottom = '12px';
    
    const emptyTitle = document.createElement('h3');
    emptyTitle.textContent = title;
    emptyTitle.style.fontSize = '18px';
    emptyTitle.style.fontWeight = '600';
    emptyTitle.style.color = '#ffffff';
    emptyTitle.style.margin = '0 0 8px';
    
    const emptyText = document.createElement('p');
    emptyText.textContent = message;
    emptyText.style.fontSize = '14px';
    emptyText.style.color = '#e2e8f0';
    emptyText.style.margin = '0';
    
    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(emptyTitle);
    emptyState.appendChild(emptyText);
    
    return emptyState;
  }
  
  // UPDATED: Enhanced offering card with user contribution tracking
  createOfferingCard(offering, index) {
    const offeringCard = document.createElement('div');
    offeringCard.className = 'neo-card animated-item';
    offeringCard.style.overflow = 'hidden';
    offeringCard.style.animationDelay = `${0.7 + (index * 0.1)}s`;
    offeringCard.style.display = 'flex';
    offeringCard.style.flexDirection = 'column';
    
    // Use name from description if no specific name
    const offeringName = offering.name || offering.description || this.formatSpecialOfferingName(offering.offeringType);
    
    // Calculate progress status for color coding
    let statusColor = '#f59e0b'; // Default amber
    let statusText = 'In Progress';
    
    if (offering.targetGoal && offering.targetGoal > 0) {
      const percentage = offering.percentage || 0;
      
      if (percentage >= 100) {
        statusColor = '#10b981'; // Green for completed
        statusText = 'Target Reached';
      } else if (percentage >= 75) {
        statusColor = '#22c55e'; // Light green for near completion
        statusText = 'Nearly Complete';
      } else if (percentage >= 50) {
        statusColor = '#f59e0b'; // Amber for halfway
        statusText = 'Halfway';
      } else if (percentage >= 25) {
        statusColor = '#fb923c'; // Orange for started
        statusText = 'In Progress';
      } else {
        statusColor = '#ef4444'; // Red for just started
        statusText = 'Just Started';
      }
    } else {
      statusColor = '#0ea5e9'; // Blue for no target
      statusText = 'Ongoing';
    }
    
    // Card header with special offering type
    const offeringHeader = document.createElement('div');
    offeringHeader.style.background = `linear-gradient(135deg, ${statusColor}40, ${statusColor}20)`;
    offeringHeader.style.padding = '16px 20px';
    offeringHeader.style.color = '#ffffff';
    offeringHeader.style.display = 'flex';
    offeringHeader.style.justifyContent = 'space-between';
    offeringHeader.style.alignItems = 'center';
    offeringHeader.style.flexWrap = 'wrap';
    offeringHeader.style.gap = '10px';
    offeringHeader.style.borderBottom = `1px solid ${statusColor}30`;
    
    const offeringType = document.createElement('h3');
    offeringType.className = 'offering-title';
    offeringType.textContent = offeringName;
    offeringType.style.margin = '0';
    offeringType.style.fontSize = '16px';
    offeringType.style.fontWeight = '600';
    offeringType.style.color = '#ffffff';
    offeringType.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
    offeringType.style.flex = '1';
    
    const endDateDisplay = offering.endDate ? new Date(offering.endDate).toLocaleDateString() : 'Ongoing';
    const endDateBadge = document.createElement('span');
    endDateBadge.textContent = `${offering.endDate ? 'Ends:' : ''} ${endDateDisplay}`;
    endDateBadge.style.fontSize = '12px';
    endDateBadge.style.backgroundColor = `${statusColor}30`;
    endDateBadge.style.padding = '4px 8px';
    endDateBadge.style.borderRadius = '20px';
    endDateBadge.style.color = statusColor;
    endDateBadge.style.whiteSpace = 'nowrap';
    
    offeringHeader.appendChild(offeringType);
    offeringHeader.appendChild(endDateBadge);
    
    // Card body with details and progress
    const offeringBody = document.createElement('div');
    offeringBody.style.padding = '20px';
    offeringBody.style.flex = '1';
    offeringBody.style.display = 'flex';
    offeringBody.style.flexDirection = 'column';
    
    // If there's a description and it's different from the name
    if (offering.description && offering.description !== offeringName) {
      const description = document.createElement('p');
      description.textContent = offering.description;
      description.style.fontSize = '14px';
      description.style.color = '#e2e8f0';
      description.style.margin = '0 0 16px';
      description.style.lineHeight = '1.5';
      offeringBody.appendChild(description);
    }
    
    // Add status badge for all offerings
    const statusBadge = document.createElement('div');
    statusBadge.style.display = 'inline-block';
    statusBadge.style.padding = '5px 10px';
    statusBadge.style.borderRadius = '8px';
    statusBadge.style.background = `${statusColor}20`;
    statusBadge.style.color = statusColor;
    statusBadge.style.fontSize = '12px';
    statusBadge.style.fontWeight = '600';
    statusBadge.style.marginBottom = '12px';
    statusBadge.style.alignSelf = 'flex-start';
    statusBadge.textContent = statusText;
    offeringBody.appendChild(statusBadge);
    
    // NEW: Enhanced target goal and progress section
    if (offering.targetGoal && offering.targetGoal > 0) {
      const progressSection = document.createElement('div');
      progressSection.style.marginBottom = '16px';
      progressSection.style.marginTop = '12px';
      progressSection.style.background = 'rgba(30, 41, 59, 0.3)';
      progressSection.style.borderRadius = '12px';
      progressSection.style.padding = '16px';
      progressSection.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      
      // Target goal header
      const goalHeader = document.createElement('div');
      goalHeader.style.display = 'flex';
      goalHeader.style.justifyContent = 'space-between';
      goalHeader.style.alignItems = 'center';
      goalHeader.style.marginBottom = '12px';
      
      const goalLabel = document.createElement('span');
      goalLabel.style.fontSize = '14px';
      goalLabel.style.color = '#e2e8f0';
      goalLabel.style.fontWeight = '600';
      goalLabel.textContent = 'Funding Goal';
      
      const goalAmount = document.createElement('span');
      goalAmount.style.fontSize = '16px';
      goalAmount.style.color = '#ffffff';
      goalAmount.style.fontWeight = '700';
      goalAmount.textContent = this.formatCurrency(offering.targetGoal);
      
      goalHeader.appendChild(goalLabel);
      goalHeader.appendChild(goalAmount);
      progressSection.appendChild(goalHeader);
      
      // Calculate progress values
      const totalContributed = offering.totalContributed || 0;
      const remainingAmount = Math.max(0, offering.targetGoal - totalContributed);
      const percentage = Math.min(100, Math.round((totalContributed / offering.targetGoal) * 100));
      
      // Progress bar
      const progressTrack = document.createElement('div');
      progressTrack.style.height = '10px';
      progressTrack.style.backgroundColor = '#1e293b';
      progressTrack.style.borderRadius = '5px';
      progressTrack.style.overflow = 'hidden';
      progressTrack.style.marginBottom = '12px';
      progressTrack.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      
      const progressFill = document.createElement('div');
      progressFill.style.height = '100%';
      progressFill.style.width = `${percentage}%`;
      progressFill.style.background = `linear-gradient(to right, ${statusColor}90, ${statusColor})`;
      progressFill.style.boxShadow = `0 0 15px ${statusColor}60`;
      progressFill.style.borderRadius = '5px';
      progressFill.style.transition = 'width 1.5s ease-in-out';
      
      progressTrack.appendChild(progressFill);
      progressSection.appendChild(progressTrack);
      
      // Progress details grid
      const progressGrid = document.createElement('div');
      progressGrid.style.display = 'grid';
      progressGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      progressGrid.style.gap = '12px';
      progressGrid.style.textAlign = 'center';
      
      // Total contributed
      const totalContributedBox = document.createElement('div');
      totalContributedBox.style.background = 'rgba(16, 185, 129, 0.1)';
      totalContributedBox.style.padding = '8px';
      totalContributedBox.style.borderRadius = '8px';
      totalContributedBox.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      
      const totalLabel = document.createElement('div');
      totalLabel.style.fontSize = '11px';
      totalLabel.style.color = '#10b981';
      totalLabel.style.fontWeight = '600';
      totalLabel.style.marginBottom = '4px';
      totalLabel.textContent = 'RAISED';
      
      const totalValue = document.createElement('div');
      totalValue.style.fontSize = '14px';
      totalValue.style.color = '#ffffff';
      totalValue.style.fontWeight = '700';
      totalValue.textContent = this.formatCurrency(totalContributed);
      
      totalContributedBox.appendChild(totalLabel);
      totalContributedBox.appendChild(totalValue);
      
      // Remaining amount
      const remainingBox = document.createElement('div');
      remainingBox.style.background = 'rgba(245, 158, 11, 0.1)';
      remainingBox.style.padding = '8px';
      remainingBox.style.borderRadius = '8px';
      remainingBox.style.border = '1px solid rgba(245, 158, 11, 0.3)';
      
      const remainingLabel = document.createElement('div');
      remainingLabel.style.fontSize = '11px';
      remainingLabel.style.color = '#f59e0b';
      remainingLabel.style.fontWeight = '600';
      remainingLabel.style.marginBottom = '4px';
      remainingLabel.textContent = 'REMAINING';
      
      const remainingValue = document.createElement('div');
      remainingValue.style.fontSize = '14px';
      remainingValue.style.color = '#ffffff';
      remainingValue.style.fontWeight = '700';
      remainingValue.textContent = this.formatCurrency(remainingAmount);
      
      remainingBox.appendChild(remainingLabel);
      remainingBox.appendChild(remainingValue);
      
      // Progress percentage
      const percentageBox = document.createElement('div');
      percentageBox.style.background = `rgba(${this.hexToRgb(statusColor)}, 0.1)`;
      percentageBox.style.padding = '8px';
      percentageBox.style.borderRadius = '8px';
      percentageBox.style.border = `1px solid rgba(${this.hexToRgb(statusColor)}, 0.3)`;
      
      const percentageLabel = document.createElement('div');
      percentageLabel.style.fontSize = '11px';
      percentageLabel.style.color = statusColor;
      percentageLabel.style.fontWeight = '600';
      percentageLabel.style.marginBottom = '4px';
      percentageLabel.textContent = 'PROGRESS';
      
      const percentageValue = document.createElement('div');
      percentageValue.style.fontSize = '14px';
      percentageValue.style.color = '#ffffff';
      percentageValue.style.fontWeight = '700';
      percentageValue.textContent = `${percentage}%`;
      
      percentageBox.appendChild(percentageLabel);
      percentageBox.appendChild(percentageValue);
      
      progressGrid.appendChild(totalContributedBox);
      progressGrid.appendChild(remainingBox);
      progressGrid.appendChild(percentageBox);
      
      progressSection.appendChild(progressGrid);
      offeringBody.appendChild(progressSection);
    }
    
    // NEW: Enhanced user's personal contribution section
    const userContribution = this.userContributionsByOffering.get(offering.offeringType);
    const userContributionSection = document.createElement('div');
    userContributionSection.style.background = 'rgba(59, 130, 246, 0.1)';
    userContributionSection.style.borderRadius = '12px';
    userContributionSection.style.padding = '16px';
    userContributionSection.style.marginTop = '16px';
    userContributionSection.style.border = '1px solid rgba(59, 130, 246, 0.3)';
    userContributionSection.style.position = 'relative';
    userContributionSection.style.overflow = 'hidden';
    
    // Add subtle glow effect
    const userGlow = document.createElement('div');
    userGlow.style.position = 'absolute';
    userGlow.style.top = '0';
    userGlow.style.left = '0';
    userGlow.style.right = '0';
    userGlow.style.bottom = '0';
    userGlow.style.background = 'radial-gradient(circle at top left, rgba(59, 130, 246, 0.2), transparent 60%)';
    userGlow.style.pointerEvents = 'none';
    userContributionSection.appendChild(userGlow);
    
    const userHeader = document.createElement('div');
    userHeader.style.display = 'flex';
    userHeader.style.alignItems = 'center';
    userHeader.style.marginBottom = '12px';
    userHeader.style.position = 'relative';
    userHeader.style.zIndex = '2';
    
    const userIcon = document.createElement('span');
    userIcon.textContent = '👤';
    userIcon.style.fontSize = '18px';
    userIcon.style.marginRight = '8px';
    
    const userContributionTitle = document.createElement('h4');
    userContributionTitle.textContent = 'Your Contribution';
    userContributionTitle.style.fontSize = '16px';
    userContributionTitle.style.fontWeight = '700';
    userContributionTitle.style.color = '#ffffff';
    userContributionTitle.style.margin = '0';
    userContributionTitle.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
    
    userHeader.appendChild(userIcon);
    userHeader.appendChild(userContributionTitle);
    
    const userContent = document.createElement('div');
    userContent.style.position = 'relative';
    userContent.style.zIndex = '2';
    
    if (userContribution && userContribution.amount > 0) {
      // User has contributed
      const userAmount = document.createElement('div');
      userAmount.style.fontSize = '20px';
      userAmount.style.fontWeight = '800';
      userAmount.style.color = '#3b82f6';
      userAmount.style.marginBottom = '8px';
      userAmount.style.textShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
      userAmount.textContent = this.formatCurrency(userContribution.amount);
      
      const userStats = document.createElement('div');
      userStats.style.display = 'flex';
      userStats.style.justifyContent = 'space-between';
      userStats.style.alignItems = 'center';
      
      const paymentCount = document.createElement('span');
      paymentCount.style.fontSize = '13px';
      paymentCount.style.color = '#cbd5e1';
      paymentCount.textContent = `${userContribution.count} payment${userContribution.count !== 1 ? 's' : ''}`;
      
      // Calculate user's percentage of total if goal exists
      let userPercentage = '';
      if (offering.targetGoal && offering.targetGoal > 0) {
        const userPercent = (userContribution.amount / offering.targetGoal) * 100;
        userPercentage = `${userPercent.toFixed(1)}% of goal`;
      }
      
      const userPercentageSpan = document.createElement('span');
      userPercentageSpan.style.fontSize = '13px';
      userPercentageSpan.style.color = '#3b82f6';
      userPercentageSpan.style.fontWeight = '600';
      userPercentageSpan.textContent = userPercentage;
      
      userStats.appendChild(paymentCount);
      if (userPercentage) {
        userStats.appendChild(userPercentageSpan);
      }
      
      userContent.appendChild(userAmount);
      userContent.appendChild(userStats);
    } else {
      // User hasn't contributed yet
      const noContributionText = document.createElement('div');
      noContributionText.style.textAlign = 'center';
      noContributionText.style.color = '#94a3b8';
      noContributionText.style.fontSize = '14px';
      noContributionText.style.fontStyle = 'italic';
      noContributionText.style.padding = '8px 0';
      noContributionText.textContent = 'You haven\'t contributed to this offering yet';
      
      userContent.appendChild(noContributionText);
    }
    
    userContributionSection.appendChild(userHeader);
    userContributionSection.appendChild(userContent);
    
    offeringBody.appendChild(userContributionSection);
    
    // Custom fields if available
    if (offering.customFields) {
      try {
        let customFields = offering.customFields;
        
        // Parse customFields if it's a string
        if (typeof customFields === 'string') {
          customFields = JSON.parse(customFields);
        }
        
        // Check if customFields contains a fields array
        if (customFields.fields) {
          customFields = customFields.fields;
        }
        
        if (customFields && Array.isArray(customFields) && customFields.length > 0) {
          const customFieldsContainer = document.createElement('div');
          customFieldsContainer.style.marginTop = '16px';
          customFieldsContainer.style.padding = '12px';
          customFieldsContainer.style.background = 'rgba(30, 41, 59, 0.4)';
          customFieldsContainer.style.borderRadius = '8px';
          
          const customFieldsTitle = document.createElement('h4');
          customFieldsTitle.textContent = 'Additional Information';
          customFieldsTitle.style.fontSize = '14px';
          customFieldsTitle.style.fontWeight = '600';
          customFieldsTitle.style.color = '#ffffff';
          customFieldsTitle.style.margin = '0 0 8px';
          customFieldsTitle.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.2)';
          
          customFieldsContainer.appendChild(customFieldsTitle);
          
          customFields.forEach(field => {
            if (field.label && field.value) {
              const fieldRow = document.createElement('div');
              fieldRow.style.fontSize = '13px';
              fieldRow.style.marginBottom = '6px';
              fieldRow.style.display = 'flex';
              
              const fieldName = document.createElement('span');
              fieldName.textContent = field.label + ': ';
              fieldName.style.fontWeight = '500';
              fieldName.style.color = '#e2e8f0';
              fieldName.style.flexBasis = '40%';
              
              const fieldValue = document.createElement('span');
              fieldValue.textContent = field.value;
              fieldValue.style.color = '#cbd5e1';
              fieldValue.style.flexBasis = '60%';
              
              fieldRow.appendChild(fieldName);
              fieldRow.appendChild(fieldValue);
              
              customFieldsContainer.appendChild(fieldRow);
            }
          });
          
          offeringBody.appendChild(customFieldsContainer);
        }
      } catch (error) {
        // Silently continue on custom fields parsing error
      }
    }
    
    // Action button (moved to bottom)
    const actionContainer = document.createElement('div');
    actionContainer.style.marginTop = 'auto';
    actionContainer.style.paddingTop = '16px';
    
    const actionButton = document.createElement('a');
    actionButton.href = `/make-payment?type=${offering.offeringType}`;
    actionButton.textContent = 'Contribute Now';
    actionButton.className = 'futuristic-button';
    actionButton.style.display = 'block';
    actionButton.style.width = '100%';
    actionButton.style.padding = '12px 16px';
    actionButton.style.background = `linear-gradient(135deg, ${statusColor}30, ${statusColor}15)`;
    actionButton.style.color = '#ffffff';
    actionButton.style.textAlign = 'center';
    actionButton.style.textDecoration = 'none';
    
    actionContainer.appendChild(actionButton);
    offeringBody.appendChild(actionContainer);
    
    // Assemble the card
    offeringCard.appendChild(offeringHeader);
    offeringCard.appendChild(offeringBody);
    
    return offeringCard;
  }
  
  renderPaymentsHistorySection() {
    const paymentHistorySection = document.createElement('div');
    paymentHistorySection.className = 'animated-item';
    paymentHistorySection.style.marginBottom = '40px';
    paymentHistorySection.style.animationDelay = '0.7s';
    
    // Improved section title visibility
    const historyTitle = document.createElement('h2');
    historyTitle.style.fontSize = '20px';
    historyTitle.style.fontWeight = '600';
    historyTitle.style.color = '#ffffff';
    historyTitle.style.marginBottom = '20px';
    historyTitle.style.position = 'relative';
    historyTitle.style.marginLeft = '15px';
    historyTitle.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    historyTitle.textContent = 'Payment History';
    
    // Add a small accent bar to the left of the title
    const titleAccent = document.createElement('div');
    titleAccent.style.position = 'absolute';
    titleAccent.style.left = '-15px';
    titleAccent.style.top = '50%';
    titleAccent.style.transform = 'translateY(-50%)';
    titleAccent.style.width = '6px';
    titleAccent.style.height = '24px';
    titleAccent.style.background = 'linear-gradient(to bottom, #3b82f6, #60a5fa)';
    titleAccent.style.borderRadius = '3px';
    
    historyTitle.appendChild(titleAccent);
    
    const paymentHistoryCard = document.createElement('div');
    paymentHistoryCard.className = 'neo-card';
    paymentHistoryCard.style.overflow = 'hidden';
    
    // Add glow effect
    const historyGlow = document.createElement('div');
    historyGlow.className = 'card-glow';
    historyGlow.style.background = 'radial-gradient(circle at center, rgba(59, 130, 246, 0.3), transparent 70%)';
    paymentHistoryCard.appendChild(historyGlow);
    
    // Section tabs for filtering
    const tabsContainer = document.createElement('div');
    tabsContainer.style.padding = '20px 20px 0';
    tabsContainer.style.display = 'flex';
    tabsContainer.style.borderBottom = '1px solid rgba(30, 41, 59, 0.6)';
    tabsContainer.style.overflowX = 'auto';
    tabsContainer.style.whiteSpace = 'nowrap';
    
    const tabs = [
      { id: 'all', label: 'All Payments', active: true },
      { id: 'completed', label: 'Completed', active: false },
      { id: 'pending', label: 'Pending', active: false },
      { id: 'tithe', label: 'Tithe', active: false },
      { id: 'offering', label: 'Offering', active: false },
      { id: 'special', label: 'Special', active: false }
    ];
    
    tabs.forEach(tab => {
      const tabButton = document.createElement('button');
      tabButton.id = `tab-${tab.id}`;
      tabButton.textContent = tab.label;
      tabButton.style.background = 'transparent';
      tabButton.style.border = 'none';
      tabButton.style.padding = '10px 20px';
      tabButton.style.fontSize = '14px';
      tabButton.style.fontWeight = tab.active ? '600' : '400';
      tabButton.style.color = tab.active ? '#3b82f6' : '#e2e8f0';
      tabButton.style.borderBottom = tab.active ? '2px solid #3b82f6' : '2px solid transparent';
      tabButton.style.cursor = 'pointer';
      tabButton.style.transition = 'all 0.3s ease';
      tabButton.style.position = 'relative';
      tabButton.style.marginRight = '5px';
      
      // Add click event to filter payments
      tabButton.addEventListener('click', () => {
        this.filterPaymentHistory(tab.id);
        
        // Update active tab styling
        document.querySelectorAll('[id^="tab-"]').forEach(btn => {
          btn.style.fontWeight = '400';
          btn.style.color = '#e2e8f0';
          btn.style.borderBottom = '2px solid transparent';
        });
        
        tabButton.style.fontWeight = '600';
        tabButton.style.color = '#3b82f6';
        tabButton.style.borderBottom = '2px solid #3b82f6';
      });
      
      tabsContainer.appendChild(tabButton);
    });
    
    // Add search and export button
    const actionsRow = document.createElement('div');
    actionsRow.style.padding = '10px 20px';
    actionsRow.style.display = 'flex';
    actionsRow.style.justifyContent = 'space-between';
    actionsRow.style.alignItems = 'center';
    actionsRow.style.flexWrap = 'wrap';
    actionsRow.style.gap = '10px';
    
    // Search input
    const searchContainer = document.createElement('div');
    searchContainer.style.position = 'relative';
    searchContainer.style.flex = '1';
    searchContainer.style.minWidth = this.isMobile ? '100%' : '200px';
    
    const searchIcon = document.createElement('div');
    searchIcon.textContent = '🔍';
    searchIcon.style.position = 'absolute';
    searchIcon.style.left = '10px';
    searchIcon.style.top = '50%';
    searchIcon.style.transform = 'translateY(-50%)';
    searchIcon.style.fontSize = '14px';
    searchIcon.style.pointerEvents = 'none';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search payments...';
    searchInput.style.width = '100%';
    searchInput.style.padding = '8px 10px 8px 30px';
    searchInput.style.background = 'rgba(30, 41, 59, 0.4)';
    searchInput.style.border = '1px solid rgba(30, 41, 59, 0.6)';
    searchInput.style.borderRadius = '8px';
    searchInput.style.color = '#e2e8f0';
    searchInput.style.fontSize = '14px';
    
    searchInput.addEventListener('input', (e) => {
      this.searchPayments(e.target.value);
    });
    
    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(searchInput);
    
    // Export button
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export Report';
    exportButton.className = 'futuristic-button';
    exportButton.style.padding = '8px 16px';
    exportButton.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))';
    
    exportButton.addEventListener('click', () => {
      const paymentsContainer = document.getElementById('payments-table-container');
      const activeTab = document.querySelector('[id^="tab-"][style*="border-bottom: 2px solid rgb(59, 130, 246)"]');
      const tabText = activeTab ? activeTab.textContent : 'All';
      
      // Get the currently displayed payments based on active filter
      let displayedPayments;
      if (this.filteredPayments) {
        displayedPayments = this.filteredPayments;
      } else {
        // Apply current filter
        const activeFilter = activeTab ? activeTab.id.replace('tab-', '') : 'all';
        displayedPayments = this.filterPaymentsArray(activeFilter);
      }
      
      if (displayedPayments && displayedPayments.length > 0) {
        this.generateContributionsReport(displayedPayments, `${tabText} Payment History`);
      } else {
        this.showNotification('No payments to export', 'warning');
      }
    });
    
    actionsRow.appendChild(searchContainer);
    actionsRow.appendChild(exportButton);
    
    // Table container
    const tableContainer = document.createElement('div');
    tableContainer.style.padding = '20px';
    tableContainer.id = 'payments-table-container';
    
    // Loading state for payments
    if (this.isLoadingPayments) {
      const loadingDiv = document.createElement('div');
      loadingDiv.style.display = 'flex';
      loadingDiv.style.justifyContent = 'center';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.padding = '40px 0';
      
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      
      loadingDiv.appendChild(spinner);
      tableContainer.appendChild(loadingDiv);
    } else if (!this.userPayments || this.userPayments.length === 0) {
      const emptyState = this.createEmptyState(
        'No Payments Yet',
        'You have not made any payments yet. Start contributing to see your payment history here.'
      );
      
      const makePaymentButton = document.createElement('a');
      makePaymentButton.href = '/make-payment';
      makePaymentButton.textContent = 'Make Your First Payment';
      makePaymentButton.className = 'futuristic-button';
      makePaymentButton.style.display = 'inline-block';
      makePaymentButton.style.marginTop = '15px';
      
      emptyState.appendChild(makePaymentButton);
      tableContainer.appendChild(emptyState);
    } else {
      // Create responsive payment history table/cards
      this.renderPaymentTable(tableContainer, this.userPayments);
    }
    
    paymentHistoryCard.appendChild(tabsContainer);
    paymentHistoryCard.appendChild(actionsRow);
    paymentHistoryCard.appendChild(tableContainer);
    
    paymentHistorySection.appendChild(historyTitle);
    paymentHistorySection.appendChild(paymentHistoryCard);
    
    return paymentHistorySection;
  }
  
  renderPaymentTable(container, payments) {
    // Clear previous content
    container.innerHTML = '';
    
    // Sort payments by date and time (newest first) - crucial for correct display
    const sortedPayments = this.sortByNewestFirst(payments);
    
    // Get paginated data if needed
    let displayedPayments = sortedPayments;
    if (sortedPayments.length > 10) {
      this.currentPage = this.currentPage || 1;
      const startIdx = (this.currentPage - 1) * 10;
      const endIdx = startIdx + 10;
      displayedPayments = sortedPayments.slice(startIdx, endIdx);
    }
    
    // Responsive design - use cards for mobile, table for desktop
    if (this.isMobile) {
      this.renderPaymentCards(container, displayedPayments);
    } else {
      this.renderPaymentTableView(container, displayedPayments);
    }
    
    // Add pagination controls if many payments
    this.renderPaginationControls(container, sortedPayments);
  }
  
  renderPaginationControls(container, payments) {
    if (payments.length <= 10) return;
    
    const paginationContainer = document.createElement('div');
    paginationContainer.style.display = 'flex';
    paginationContainer.style.justifyContent = 'center';
    paginationContainer.style.marginTop = '20px';
    paginationContainer.style.gap = '5px';
    
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-button';
    prevButton.textContent = '←';
    prevButton.style.background = 'rgba(59, 130, 246, 0.2)';
    prevButton.style.border = 'none';
    prevButton.style.borderRadius = '6px';
    prevButton.style.padding = '5px 10px';
    prevButton.style.color = '#e2e8f0';
    prevButton.style.cursor = 'pointer';
    
    const pageInfo = document.createElement('span');
    pageInfo.textContent = 'Page 1 of 3';
    pageInfo.style.padding = '5px 10px';
    pageInfo.style.color = '#e2e8f0';
    
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-button';
    nextButton.textContent = '→';
    nextButton.style.background = 'rgba(59, 130, 246, 0.2)';
    nextButton.style.border = 'none';
    nextButton.style.borderRadius = '6px';
    nextButton.style.padding = '5px 10px';
    nextButton.style.color = '#e2e8f0';
    nextButton.style.cursor = 'pointer';
    
    // Set up pagination state and controls
    this.currentPage = this.currentPage || 1;
    const totalPages = Math.ceil(payments.length / 10);
    pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    
    // Add pagination event handlers
    prevButton.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.updatePagination(container, payments, totalPages);
      }
    });
    
    nextButton.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.updatePagination(container, payments, totalPages);
      }
    });
    
    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(nextButton);
    
    container.appendChild(paginationContainer);
  }
  
  updatePagination(container, payments, totalPages) {
    // Update page info text
    const pageInfo = container.querySelector('.pagination-button + span');
    if (pageInfo) {
      pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }
    
    // Get paginated data
    const startIdx = (this.currentPage - 1) * 10;
    const endIdx = startIdx + 10;
    const pagedPayments = payments.slice(startIdx, endIdx);
    
    // Clear and rerender table/cards
    const tableContainer = container.querySelector('table') || container.querySelector('.payment-cards-container');
    if (tableContainer) {
      tableContainer.remove();
    }
    
    // Render new page
    if (this.isMobile) {
      this.renderPaymentCards(container, pagedPayments, false);
    } else {
      this.renderPaymentTableView(container, pagedPayments, false);
    }
    
    // Move pagination to the end
    const paginationContainer = container.querySelector('.pagination-button').parentNode;
    container.appendChild(paginationContainer);
  }
  
  renderPaymentTableView(container, payments) {
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    
    // Table header
    const thead = document.createElement('thead');
    thead.style.position = 'sticky';
    thead.style.top = '0';
    thead.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    thead.style.backdropFilter = 'blur(10px)';
    
    const headerRow = document.createElement('tr');
    
    const headers = ['Date', 'Type', 'Amount', 'Status', 'Actions'];
    
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      th.style.padding = '12px 16px';
      th.style.textAlign = headerText === 'Amount' ? 'right' : 'left';
      th.style.fontSize = '12px';
      th.style.fontWeight = '600';
      th.style.textTransform = 'uppercase';
      th.style.color = '#94a3b8';
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    
    // Get paginated data if needed
    let displayedPayments = payments;
    
    // NO PAYMENTS CASE
    if (displayedPayments.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 5;
      emptyCell.style.padding = '40px 20px';
      emptyCell.style.textAlign = 'center';
      emptyCell.style.color = '#94a3b8';
      emptyCell.textContent = 'No payments found matching the selected filter.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      // Show all payments that are NOT templates
      displayedPayments.forEach(payment => {
        // CRITICAL: Skip template records - we only want to show actual payments
        if (payment.isTemplate === true || payment.isTemplate === 1 || payment.isTemplate === 'true') {
          return;
        }
        
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(30, 41, 59, 0.6)';
        row.style.transition = 'background-color 0.2s ease';
        
        // Add hover effect
        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
        });
        
        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = 'transparent';
        });
        
        // Date cell
        const dateCell = document.createElement('td');
        dateCell.style.padding = '16px';
        dateCell.style.fontSize = '14px';
        dateCell.style.color = '#e2e8f0';
        
        const paymentDate = new Date(payment.paymentDate);
        dateCell.textContent = paymentDate.toLocaleDateString();
        
        // Type cell
        const typeCell = document.createElement('td');
        typeCell.style.padding = '16px';
        typeCell.style.fontSize = '14px';
        typeCell.style.color = '#ffffff';
        typeCell.style.fontWeight = '500';
        
        // CRUCIAL FIX: Clearly identify special offerings for users
        if (payment.paymentType && payment.paymentType.startsWith('SPECIAL_')) {
          typeCell.textContent = this.formatSpecialOfferingName(payment.paymentType);
        } else {
          typeCell.textContent = this.formatPaymentType(payment.paymentType || 'Unknown');
        }
        
        // Amount cell
        const amountCell = document.createElement('td');
        amountCell.style.padding = '16px';
        amountCell.style.fontSize = '14px';
        amountCell.style.color = '#ffffff';
        amountCell.style.fontWeight = '500';
        amountCell.style.textAlign = 'right';
        
        amountCell.textContent = this.formatCurrency(payment.amount);
        
        // Status cell
        const statusCell = document.createElement('td');
        statusCell.style.padding = '16px';
        
        const statusBadge = document.createElement('span');
        statusBadge.style.padding = '4px 8px';
        statusBadge.style.borderRadius = '9999px';
        statusBadge.style.fontSize = '12px';
        statusBadge.style.fontWeight = '500';
        
        if (payment.status === 'COMPLETED') {
          statusBadge.textContent = 'Completed';
          statusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
          statusBadge.style.color = '#10b981';
        } else if (payment.status === 'PENDING') {
          statusBadge.textContent = 'Pending';
          statusBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
          statusBadge.style.color = '#f59e0b';
        } else if (payment.status === 'FAILED') {
          statusBadge.textContent = 'Failed';
          statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
          statusBadge.style.color = '#ef4444';
        } else {
          statusBadge.textContent = payment.status || 'Unknown';
          statusBadge.style.backgroundColor = 'rgba(100, 116, 139, 0.2)';
          statusBadge.style.color = '#64748b';
        }
        
        statusCell.appendChild(statusBadge);
        
        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.style.padding = '16px';
        
        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '8px';
        
        if (payment.status === 'COMPLETED') {
          // View button
          const viewButton = document.createElement('button');
          viewButton.textContent = 'View';
          viewButton.className = 'action-button';
          viewButton.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
          viewButton.style.color = '#3b82f6';
          
          viewButton.addEventListener('click', () => {
            this.showPaymentDetails(payment);
          });
          
          // Download button
          const downloadButton = document.createElement('button');
          downloadButton.textContent = 'Receipt';
          downloadButton.className = 'action-button';
          downloadButton.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
          downloadButton.style.color = '#10b981';
          
          downloadButton.addEventListener('click', () => {
            this.downloadReceipt(payment);
          });
          
          actionsContainer.appendChild(viewButton);
          actionsContainer.appendChild(downloadButton);
        } else {
          // Just view details for non-completed payments
          const viewButton = document.createElement('button');
          viewButton.textContent = 'View';
          viewButton.className = 'action-button';
          viewButton.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
          viewButton.style.color = '#3b82f6';
          
          viewButton.addEventListener('click', () => {
            this.showPaymentDetails(payment);
          });
          
          actionsContainer.appendChild(viewButton);
        }
        
        actionsCell.appendChild(actionsContainer);
        
        // Add cells to row
        row.appendChild(dateCell);
        row.appendChild(typeCell);
        row.appendChild(amountCell);
        row.appendChild(statusCell);
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
      });
    }
    
    table.appendChild(tbody);
    
    // Responsive container with horizontal scroll for small screens
    const tableScrollContainer = document.createElement('div');
    tableScrollContainer.style.overflowX = 'auto';
    tableScrollContainer.style.width = '100%';
    tableScrollContainer.appendChild(table);
    
    container.appendChild(tableScrollContainer);
  }
  
  renderPaymentCards(container, payments, includePagination = true) {
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'payment-cards-container';
    cardsContainer.style.display = 'flex';
    cardsContainer.style.flexDirection = 'column';
    cardsContainer.style.gap = '15px';
    
    // Get paginated data if needed
    let displayedPayments = payments;
    
    displayedPayments.forEach(payment => {
      // Skip template records
      if (payment.isTemplate === true || payment.isTemplate === 1 || payment.isTemplate === 'true') {
        return;
      }
      
      const card = document.createElement('div');
      card.className = 'payment-card';
      card.style.background = 'rgba(30, 41, 59, 0.4)';
      card.style.borderRadius = '12px';
      card.style.padding = '15px';
      card.style.border = '1px solid rgba(59, 130, 246, 0.1)';
      
      // Header with date and status
      const cardHeader = document.createElement('div');
      cardHeader.style.display = 'flex';
      cardHeader.style.justifyContent = 'space-between';
      cardHeader.style.alignItems = 'center';
      cardHeader.style.marginBottom = '10px';
      
      const dateText = document.createElement('span');
      dateText.style.fontSize = '14px';
      dateText.style.color = '#e2e8f0';
      dateText.textContent = new Date(payment.paymentDate).toLocaleDateString();
      
      const statusBadge = document.createElement('span');
      statusBadge.style.padding = '4px 8px';
      statusBadge.style.borderRadius = '9999px';
      statusBadge.style.fontSize = '12px';
      statusBadge.style.fontWeight = '500';
      
      if (payment.status === 'COMPLETED') {
        statusBadge.textContent = 'Completed';
        statusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
        statusBadge.style.color = '#10b981';
      } else if (payment.status === 'PENDING') {
        statusBadge.textContent = 'Pending';
        statusBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
        statusBadge.style.color = '#f59e0b';
      } else if (payment.status === 'FAILED') {
        statusBadge.textContent = 'Failed';
        statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        statusBadge.style.color = '#ef4444';
      } else {
        statusBadge.textContent = payment.status || 'Unknown';
        statusBadge.style.backgroundColor = 'rgba(100, 116, 139, 0.2)';
        statusBadge.style.color = '#64748b';
      }
      
      cardHeader.appendChild(dateText);
      cardHeader.appendChild(statusBadge);
      
      // Payment details
      const cardBody = document.createElement('div');
      
      // Payment type with icon
      const paymentType = document.createElement('div');
      paymentType.style.display = 'flex';
      paymentType.style.alignItems = 'center';
      paymentType.style.marginBottom = '10px';
      
      const paymentTypeIcon = document.createElement('span');
      paymentTypeIcon.style.width = '30px';
      paymentTypeIcon.style.height = '30px';
      paymentTypeIcon.style.borderRadius = '50%';
      paymentTypeIcon.style.background = 'rgba(59, 130, 246, 0.2)';
      paymentTypeIcon.style.display = 'flex';
      paymentTypeIcon.style.alignItems = 'center';
      paymentTypeIcon.style.justifyContent = 'center';
      paymentTypeIcon.style.marginRight = '10px';
      paymentTypeIcon.style.fontSize = '14px';
      
      if (payment.paymentType && payment.paymentType.startsWith('SPECIAL_')) {
        paymentTypeIcon.textContent = '✨';
      } else if (payment.paymentType === 'TITHE') {
        paymentTypeIcon.textContent = '📝';
      } else if (payment.paymentType === 'OFFERING') {
        paymentTypeIcon.textContent = '🎁';
      } else {
        paymentTypeIcon.textContent = '💰';
      }
      
      const paymentTypeText = document.createElement('span');
      paymentTypeText.style.fontSize = '16px';
      paymentTypeText.style.fontWeight = '600';
      paymentTypeText.style.color = '#ffffff';
      
      if (payment.paymentType && payment.paymentType.startsWith('SPECIAL_')) {
        paymentTypeText.textContent = this.formatSpecialOfferingName(payment.paymentType);
      } else {
        paymentTypeText.textContent = this.formatPaymentType(payment.paymentType || 'Unknown');
      }
      
      paymentType.appendChild(paymentTypeIcon);
      paymentType.appendChild(paymentTypeText);
      
      // Amount
      const amountText = document.createElement('div');
      amountText.className = 'amount-text';
      amountText.style.fontSize = '20px';
      amountText.style.fontWeight = '700';
      amountText.style.color = '#ffffff';
      amountText.style.margin = '10px 0';
      amountText.textContent = this.formatCurrency(payment.amount);
      
      // Description if available
      if (payment.description) {
        const descriptionText = document.createElement('div');
        descriptionText.style.fontSize = '14px';
        descriptionText.style.color = '#e2e8f0';
        descriptionText.style.margin = '5px 0 10px';
        descriptionText.style.wordBreak = 'break-word';
        
        // Truncate long descriptions
        const maxLength = 60;
        const displayText = payment.description.length > maxLength ? 
          payment.description.slice(0, maxLength) + '...' : 
          payment.description;
          
        descriptionText.textContent = displayText;
        cardBody.appendChild(descriptionText);
      }
      
      cardBody.appendChild(paymentType);
      cardBody.appendChild(amountText);
      
      // Actions
      const cardActions = document.createElement('div');
      cardActions.style.display = 'flex';
      cardActions.style.gap = '8px';
      cardActions.style.marginTop = '15px';
      cardActions.style.justifyContent = 'flex-end';
      
      if (payment.status === 'COMPLETED') {
        // View button
        const viewButton = document.createElement('button');
        viewButton.textContent = 'View';
        viewButton.className = 'action-button';
        viewButton.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        viewButton.style.color = '#3b82f6';
        
        viewButton.addEventListener('click', () => {
          this.showPaymentDetails(payment);
        });
        
        // Download button
        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Receipt';
        downloadButton.className = 'action-button';
        downloadButton.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
        downloadButton.style.color = '#10b981';
        
        downloadButton.addEventListener('click', () => {
          this.downloadReceipt(payment);
        });
        
        cardActions.appendChild(viewButton);
        cardActions.appendChild(downloadButton);
      } else {
        // Just view details for non-completed payments
        const viewButton = document.createElement('button');
        viewButton.textContent = 'View';
        viewButton.className = 'action-button';
        viewButton.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        viewButton.style.color = '#3b82f6';
        
        viewButton.addEventListener('click', () => {
          this.showPaymentDetails(payment);
        });
        
        cardActions.appendChild(viewButton);
      }
      
      // Assemble card
      card.appendChild(cardHeader);
      card.appendChild(cardBody);
      card.appendChild(cardActions);
      
      cardsContainer.appendChild(card);
    });
    
    container.appendChild(cardsContainer);
  }
  
  filterPaymentHistory(filter) {
    this.currentPage = 1; // Reset to first page on filter change
    
    const filteredPayments = this.filterPaymentsArray(filter);
    
    const container = document.getElementById('payments-table-container');
    if (container) {
      this.renderPaymentTable(container, filteredPayments);
    }
  }
  
  filterPaymentsArray(filter) {
    if (!this.userPayments?.length) return [];
    
    // Remove templates and validate payment types
    let filteredPayments = this.userPayments.filter(p => {
      return !p.isTemplate && this.validatePaymentType(p.paymentType);
    });
    
    switch(filter) {
      case 'special':
        return filteredPayments.filter(payment => 
          payment.paymentType?.startsWith('SPECIAL_')
        );
      case 'completed':
        return filteredPayments.filter(payment => payment.status === 'COMPLETED');
      case 'pending':
        return filteredPayments.filter(payment => payment.status === 'PENDING');
      case 'tithe':
        return filteredPayments.filter(payment => payment.paymentType === 'TITHE');
      case 'offering':
        return filteredPayments.filter(payment => payment.paymentType === 'OFFERING');
      default:
        return filteredPayments;
    }
  }
  
  searchPayments(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      this.filteredPayments = null;
      const activeTab = document.querySelector('[id^="tab-"][style*="border-bottom: 2px solid rgb(59, 130, 246)"]');
      const activeFilter = activeTab ? activeTab.id.replace('tab-', '') : 'all';
      this.filterPaymentHistory(activeFilter);
      return;
    }
    
    searchTerm = searchTerm.toLowerCase().trim();
    
    // Get base payments (apply current tab filter first)
    const activeTab = document.querySelector('[id^="tab-"][style*="border-bottom: 2px solid rgb(59, 130, 246)"]');
    const activeFilter = activeTab ? activeTab.id.replace('tab-', '') : 'all';
    const basePayments = this.filterPaymentsArray(activeFilter);
    
    // Apply search filter - ENSURE special offering payments are included
    this.filteredPayments = basePayments.filter(payment => {
      // Special handling for special offering payments
      if (payment.paymentType && payment.paymentType.startsWith('SPECIAL_')) {
        const formattedName = this.formatSpecialOfferingName(payment.paymentType);
        if (formattedName.toLowerCase().includes(searchTerm)) {
          return true;
        }
      }
      
      // Search in various fields
      return (
        (payment.description && payment.description.toLowerCase().includes(searchTerm)) ||
        (payment.paymentType && payment.paymentType.toLowerCase().includes(searchTerm)) ||
        (this.formatPaymentType(payment.paymentType).toLowerCase().includes(searchTerm)) ||
        (payment.amount && payment.amount.toString().includes(searchTerm)) ||
        (payment.receiptNumber && payment.receiptNumber.toLowerCase().includes(searchTerm)) ||
        (payment.status && payment.status.toLowerCase().includes(searchTerm)) ||
        (payment.paymentMethod && payment.paymentMethod.toLowerCase().includes(searchTerm))
      );
    });
    
    // Update table with filtered results
    const container = document.getElementById('payments-table-container');
    if (container) {
      this.renderPaymentTable(container, this.filteredPayments);
    }
  }
  
  async showPaymentDetails(payment) {
    if (!payment) return;
    
    // Get additional details if available
    if (payment.id && !payment.receiptData) {
      try {
        const receiptInfo = await this.queueApiRequest(() => 
          this.apiService.getReceiptById(payment.id)
        );
        
        if (receiptInfo && receiptInfo.receiptData) {
          payment.receiptData = receiptInfo.receiptData;
        }
      } catch (error) {
        // Continue with available data
      }
    }
    
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-overlay';
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.width = '100%';
    modalContainer.style.height = '100%';
    modalContainer.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
    modalContainer.style.backdropFilter = 'blur(8px)';
    modalContainer.style.zIndex = '1000';
    modalContainer.style.display = 'flex';
    modalContainer.style.justifyContent = 'center';
    modalContainer.style.alignItems = 'center';
    modalContainer.style.padding = '20px';
    modalContainer.style.animation = 'fadeIn 0.3s ease-out';
    
    // Modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'neo-card';
    modalContent.style.width = '100%';
    modalContent.style.maxWidth = '550px';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.overflowY = 'auto';
    modalContent.style.position = 'relative';
    modalContent.style.animation = 'scaleIn 0.3s ease-out';
    
    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.padding = '20px';
    modalHeader.style.borderBottom = '1px solid rgba(30, 41, 59, 0.6)';
    modalHeader.style.display = 'flex';
    modalHeader.style.justifyContent = 'space-between';
    modalHeader.style.alignItems = 'center';
    
    const modalTitle = document.createElement('h3');
    modalTitle.textContent = 'Payment Details';
    modalTitle.style.fontSize = '20px';
    modalTitle.style.fontWeight = '600';
    modalTitle.style.color = '#ffffff';
    modalTitle.style.margin = '0';
    modalTitle.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.fontWeight = '600';
    closeButton.style.color = '#e2e8f0';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0';
    closeButton.style.width = '30px';
    closeButton.style.height = '30px';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.style.borderRadius = '50%';
    closeButton.style.transition = 'all 0.2s ease';
    
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
      closeButton.style.color = '#ffffff';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent';
      closeButton.style.color = '#e2e8f0';
    });
    
    closeButton.addEventListener('click', () => {
      modalContainer.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(modalContainer);
      }, 300);
    });
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Modal body
    const modalBody = document.createElement('div');
    modalBody.style.padding = '20px';
    
    // Payment summary - highlighted box
    const paymentSummary = document.createElement('div');
    paymentSummary.style.background = 'rgba(30, 41, 59, 0.4)';
    paymentSummary.style.borderRadius = '12px';
    paymentSummary.style.padding = '20px';
    paymentSummary.style.marginBottom = '20px';
    paymentSummary.style.textAlign = 'center';
    
    // Payment amount
    const amountText = document.createElement('div');
    amountText.style.fontSize = '28px';
    amountText.style.fontWeight = '700';
    amountText.style.color = '#ffffff';
    amountText.style.margin = '0 0 5px';
    amountText.textContent = this.formatCurrency(payment.amount);
    
    // Payment type
    const typeText = document.createElement('div');
    typeText.style.fontSize = '16px';
    typeText.style.fontWeight = '600';
    typeText.style.color = '#e2e8f0';
    
    if (payment.paymentType && payment.paymentType.startsWith('SPECIAL_')) {
      typeText.textContent = this.formatSpecialOfferingName(payment.paymentType);
    } else {
      typeText.textContent = this.formatPaymentType(payment.paymentType || 'Unknown');
    }
    
    // Status badge
    const statusBadge = document.createElement('span');
    statusBadge.style.display = 'inline-block';
    statusBadge.style.padding = '4px 12px';
    statusBadge.style.borderRadius = '9999px';
    statusBadge.style.fontSize = '14px';
    statusBadge.style.fontWeight = '500';
    statusBadge.style.marginTop = '10px';
    
    if (payment.status === 'COMPLETED') {
      statusBadge.textContent = 'Completed';
      statusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
      statusBadge.style.color = '#10b981';
    } else if (payment.status === 'PENDING') {
      statusBadge.textContent = 'Pending';
      statusBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
      statusBadge.style.color = '#f59e0b';
    } else if (payment.status === 'FAILED') {
      statusBadge.textContent = 'Failed';
      statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      statusBadge.style.color = '#ef4444';
    } else {
      statusBadge.textContent = payment.status || 'Unknown';
      statusBadge.style.backgroundColor = 'rgba(100, 116, 139, 0.2)';
      statusBadge.style.color = '#64748b';
    }
    
    paymentSummary.appendChild(amountText);
    paymentSummary.appendChild(typeText);
    paymentSummary.appendChild(statusBadge);
    
    // Payment details
    const detailsList = document.createElement('div');
    detailsList.style.display = 'grid';
    detailsList.style.gap = '12px';
    
    const details = [
      { label: 'Payment ID', value: payment.id || 'N/A' },
      { label: 'Date', value: new Date(payment.paymentDate).toLocaleDateString() },
      { label: 'Time', value: new Date(payment.paymentDate).toLocaleTimeString() },
      { label: 'Payment Method', value: payment.paymentMethod || 'N/A' },
      { label: 'Transaction Reference', value: payment.transactionReference || payment.reference || 'N/A' },
      { label: 'Receipt Number', value: payment.receiptNumber || 'N/A' },
      { label: 'Description', value: payment.description || 'No description provided' }
    ];
    
    details.forEach(detail => {
      const detailItem = document.createElement('div');
      detailItem.style.display = 'flex';
      detailItem.style.justifyContent = 'space-between';
      detailItem.style.borderBottom = '1px solid rgba(30, 41, 59, 0.4)';
      detailItem.style.paddingBottom = '8px';
      
      const detailLabel = document.createElement('span');
      detailLabel.textContent = detail.label;
      detailLabel.style.color = '#e2e8f0';
      detailLabel.style.fontWeight = '500';
      
      const detailValue = document.createElement('span');
      detailValue.textContent = detail.value;
      detailValue.style.color = '#ffffff';
      detailValue.style.fontWeight = '400';
      detailValue.style.wordBreak = 'break-word';
      detailValue.style.textAlign = 'right';
      detailValue.style.maxWidth = '60%';
      
      detailItem.appendChild(detailLabel);
      detailItem.appendChild(detailValue);
      
      detailsList.appendChild(detailItem);
    });
    
    // Add tithe distribution if applicable
    if (payment.paymentType === 'TITHE' && payment.titheDistribution) {
      const titheDistribution = document.createElement('div');
      titheDistribution.style.marginTop = '20px';
      titheDistribution.style.background = 'rgba(30, 41, 59, 0.4)';
      titheDistribution.style.borderRadius = '12px';
      titheDistribution.style.padding = '15px';
      
      const titheTitle = document.createElement('h4');
      titheTitle.textContent = 'Tithe Distribution';
      titheTitle.style.margin = '0 0 10px';
      titheTitle.style.color = '#ffffff';
      titheTitle.style.fontSize = '16px';
      
      titheDistribution.appendChild(titheTitle);
      
      // Create tithe distribution table
      const titheDetails = document.createElement('div');
      titheDetails.style.display = 'grid';
      titheDetails.style.gap = '8px';
      
      try {
        const distribution = typeof payment.titheDistribution === 'string'
          ? JSON.parse(payment.titheDistribution)
          : payment.titheDistribution;
          
        if (distribution) {
          Object.keys(distribution).forEach(key => {
            if (key !== 'otherSpecification' && distribution[key] > 0) {
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.justifyContent = 'space-between';
              
              const label = document.createElement('span');
              label.textContent = this.formatTitheCategory(key);
              label.style.color = '#e2e8f0';
              
              const value = document.createElement('span');
              value.textContent = this.formatCurrency(distribution[key]);
              value.style.color = '#ffffff';
              
              row.appendChild(label);
              row.appendChild(value);
              titheDetails.appendChild(row);
            }
          });
          
          // Add other specification if applicable
          if (distribution.other > 0 && distribution.otherSpecification) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            
            const label = document.createElement('span');
            label.textContent = `Other (${distribution.otherSpecification})`;
            label.style.color = '#e2e8f0';
            
            const value = document.createElement('span');
            value.textContent = this.formatCurrency(distribution.other);
            value.style.color = '#ffffff';
            
            row.appendChild(label);
            row.appendChild(value);
            titheDetails.appendChild(row);
          }
        }
      } catch (error) {
        // Add fallback display
        const errorText = document.createElement('p');
        errorText.textContent = 'Error displaying tithe distribution';
        errorText.style.color = '#ef4444';
        titheDetails.appendChild(errorText);
      }
      
      titheDistribution.appendChild(titheDetails);
      modalBody.appendChild(titheDistribution);
    }
    
    modalBody.appendChild(paymentSummary);
    modalBody.appendChild(detailsList);
    
    // Modal footer with actions
    const modalFooter = document.createElement('div');
    modalFooter.style.padding = '20px';
    modalFooter.style.borderTop = '1px solid rgba(30, 41, 59, 0.6)';
    modalFooter.style.display = 'flex';
    modalFooter.style.justifyContent = 'flex-end';
    modalFooter.style.gap = '10px';
    
    if (payment.status === 'COMPLETED') {
      // Download Receipt button
      const downloadButton = document.createElement('button');
      downloadButton.textContent = 'Download Receipt';
      downloadButton.className = 'futuristic-button';
      downloadButton.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))';
      
      downloadButton.addEventListener('click', () => {
        this.downloadReceipt(payment);
      });
      
      modalFooter.appendChild(downloadButton);
    }
    
    // Close button
    const closeModalButton = document.createElement('button');
    closeModalButton.textContent = 'Close';
    closeModalButton.className = 'futuristic-button';
    closeModalButton.style.background = 'linear-gradient(135deg, rgba(100, 116, 139, 0.2), rgba(100, 116, 139, 0.1))';
    
    closeModalButton.addEventListener('click', () => {
      modalContainer.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(modalContainer);
      }, 300);
    });
    
    modalFooter.appendChild(closeModalButton);
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    
    modalContainer.appendChild(modalContent);
    document.body.appendChild(modalContainer);
    
    // Close modal when clicking outside
    modalContainer.addEventListener('click', (event) => {
      if (event.target === modalContainer) {
        modalContainer.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
          document.body.removeChild(modalContainer);
        }, 300);
      }
    });
  }
  
  async downloadReceipt(payment) {
    try {
      // Show loading notification
      this.showNotification('Generating receipt...', 'info');
      
      if (payment.id) {
        // Try to download from server first
        try {
          await this.queueApiRequest(() =>
            this.apiService.downloadReceipt(payment.id)
          );
          
          this.showNotification('Receipt downloaded successfully', 'success');
          return;
        } catch (serverError) {
          // Continue with client-side generation
          console.log('Server download failed, generating client-side receipt');
        }
      }
      
      // Client-side HTML report generation
      this.generatePaymentReport(payment);
      
    } catch (error) {
      console.error('Receipt download error:', error);
      this.showNotification('Failed to download receipt', 'error');
    }
  }

  generatePaymentReport(payment) {
    try {
      const reportContent = this.createPaymentReceiptHTML(payment);
      
      // Open in new window for printing/saving
      const printWindow = window.open('', '_blank');
      printWindow.document.write(reportContent);
      printWindow.document.close();
      
      // Auto-focus and prompt for print
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
      
      this.showNotification('Receipt generated successfully! Use your browser to save as PDF.', 'success');
    } catch (error) {
      console.error('Receipt generation error:', error);
      this.showNotification('Failed to generate receipt. Please try again.', 'error');
    }
  }

  createPaymentReceiptHTML(payment) {
    const paymentType = payment.paymentType && payment.paymentType.startsWith('SPECIAL_') 
      ? this.formatSpecialOfferingName(payment.paymentType)
      : this.formatPaymentType(payment.paymentType || 'Unknown');

    return `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Payment Receipt - ${payment.receiptNumber || payment.id}</title>
          <style>
              body { 
                  font-family: Arial, sans-serif; 
                  margin: 20px; 
                  color: #333;
                  background: #fff;
                  line-height: 1.6;
              }
              .header { 
                  text-align: center; 
                  margin-bottom: 30px; 
                  border-bottom: 3px solid #1a365d;
                  padding-bottom: 20px;
              }
              .header h1 { 
                  color: #1a365d; 
                  margin: 0;
                  font-size: 28px;
              }
              .header h2 { 
                  color: #2d3748; 
                  margin: 5px 0;
                  font-size: 20px;
              }
              .receipt-info {
                  background: #f7fafc;
                  padding: 15px;
                  border-radius: 8px;
                  margin: 20px 0;
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 10px;
              }
              .amount-highlight { 
                  font-size: 24px; 
                  font-weight: bold; 
                  color: #1a365d;
                  text-align: center;
                  margin: 20px 0;
                  padding: 20px;
                  background: #e6fffa;
                  border-radius: 8px;
                  border: 2px solid #38b2ac;
              }
              .details-section {
                  margin: 20px 0;
              }
              .details-section h3 {
                  color: #1a365d;
                  border-bottom: 2px solid #e2e8f0;
                  padding-bottom: 5px;
              }
              .detail-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 8px 0;
                  border-bottom: 1px solid #e2e8f0;
              }
              .detail-label {
                  font-weight: bold;
                  color: #4a5568;
              }
              .detail-value {
                  color: #1a202c;
              }
              .status-badge {
                  display: inline-block;
                  padding: 5px 15px;
                  border-radius: 20px;
                  font-weight: bold;
                  font-size: 14px;
              }
              .status-completed {
                  background: #c6f6d5;
                  color: #22543d;
              }
              .status-pending {
                  background: #fefcbf;
                  color: #744210;
              }
              .status-failed {
                  background: #fed7d7;
                  color: #742a2a;
              }
              .footer {
                  margin-top: 40px;
                  text-align: center;
                  color: #666;
                  font-size: 12px;
                  border-top: 2px solid #e2e8f0;
                  padding-top: 20px;
              }
              .signature-area {
                  margin-top: 40px;
                  display: flex;
                  justify-content: space-between;
              }
              .signature-box {
                  text-align: center;
                  width: 200px;
              }
              .signature-line {
                  border-top: 1px solid #333;
                  margin-top: 30px;
                  padding-top: 5px;
                  font-size: 12px;
              }
              @media print {
                  body { margin: 0; }
                  .no-print { display: none; }
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>TASSIAC CHURCH</h1>
              <h2>OFFICIAL PAYMENT RECEIPT</h2>
          </div>
          
          <div class="receipt-info">
              <div><strong>Receipt Number:</strong> ${payment.receiptNumber || payment.id || 'N/A'}</div>
              <div><strong>Date:</strong> ${new Date(payment.paymentDate).toLocaleDateString()}</div>
              <div><strong>Time:</strong> ${new Date(payment.paymentDate).toLocaleTimeString()}</div>
              <div><strong>Status:</strong> 
                  <span class="status-badge status-${payment.status?.toLowerCase() || 'unknown'}">
                      ${payment.status || 'Unknown'}
                  </span>
              </div>
          </div>
          
          <div class="amount-highlight">
              Amount: ${this.formatCurrency(payment.amount)}
          </div>
          
          <div class="details-section">
              <h3>Contributor Information</h3>
              <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${this.user?.fullName || 'Unknown'}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${this.user?.phone || 'N/A'}</span>
              </div>
              ${this.user?.email ? `
              <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${this.user.email}</span>
              </div>` : ''}
          </div>
          
          <div class="details-section">
              <h3>Payment Information</h3>
              <div class="detail-row">
                  <span class="detail-label">Payment Type:</span>
                  <span class="detail-value">${paymentType}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Payment Method:</span>
                  <span class="detail-value">${payment.paymentMethod || 'N/A'}</span>
              </div>
              ${payment.transactionReference || payment.reference ? `
              <div class="detail-row">
                  <span class="detail-label">Transaction Reference:</span>
                  <span class="detail-value">${payment.transactionReference || payment.reference}</span>
              </div>` : ''}
              ${payment.description ? `
              <div class="detail-row">
                  <span class="detail-label">Description:</span>
                  <span class="detail-value">${payment.description}</span>
              </div>` : ''}
          </div>
          
          ${payment.paymentType === 'TITHE' && payment.titheDistribution ? this.createTitheDistributionHTML(payment.titheDistribution) : ''}
          
          <div class="signature-area">
              <div class="signature-box">
                  <div class="signature-line">Authorized Signature</div>
              </div>
              <div class="signature-box">
                  <div class="signature-line">Date</div>
              </div>
          </div>
          
          <div class="footer">
              <p><strong>TASSIAC CHURCH</strong></p>
              <p>Thank you for your contribution. This is an official receipt.</p>
              <p>Please keep this receipt for your records.</p>
              <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
      </body>
      </html>
    `;
  }

  createTitheDistributionHTML(titheDistribution) {
    try {
      const distribution = typeof titheDistribution === 'string'
        ? JSON.parse(titheDistribution)
        : titheDistribution;

      if (!distribution) return '';

      let html = `
        <div class="details-section">
            <h3>Tithe Distribution</h3>
      `;

      Object.keys(distribution).forEach(key => {
        if (key !== 'otherSpecification' && distribution[key] > 0) {
          html += `
            <div class="detail-row">
                <span class="detail-label">${this.formatTitheCategory(key)}:</span>
                <span class="detail-value">${this.formatCurrency(distribution[key])}</span>
            </div>
          `;
        }
      });

      // Add other specification if applicable
      if (distribution.other > 0 && distribution.otherSpecification) {
        html += `
          <div class="detail-row">
              <span class="detail-label">Other (${distribution.otherSpecification}):</span>
              <span class="detail-value">${this.formatCurrency(distribution.other)}</span>
          </div>
        `;
      }

      html += '</div>';
      return html;
    } catch (error) {
      return '';
    }
  }
  
  // UI Update Methods
  updateStatsUI() {
    // Update total contributions stat
    const totalContributionsElement = document.querySelector('#total-contributions .stat-value');
    if (totalContributionsElement) {
      totalContributionsElement.textContent = this.formatCurrency(this.paymentStats.totalContributed);
    }
    
    // Update this month contributions stat
    const thisMonthElement = document.querySelector('#this-month .stat-value');
    if (thisMonthElement) {
      thisMonthElement.textContent = this.formatCurrency(this.paymentStats.thisMonthContributed);
    }
    
    // Update last contribution date
    const lastContributionElement = document.querySelector('#last-contribution .stat-value');
    if (lastContributionElement) {
      lastContributionElement.textContent = this.paymentStats.lastPaymentDate
        ? new Date(this.paymentStats.lastPaymentDate).toLocaleDateString()
        : 'No payments yet';
    }
  }
  
  updateSpecialOfferingsUI() {
    const specialOfferingsGrid = document.getElementById('special-offerings-grid');
    if (specialOfferingsGrid && !this.isLoadingSpecial) {
      // Clear existing content
      specialOfferingsGrid.innerHTML = '';
      
      if (!this.specialOfferings || this.specialOfferings.length === 0) {
        const emptyState = this.createEmptyState(
          'No Special Offerings Available',
          'There are no special offerings at this time. Please check back later.'
        );
        specialOfferingsGrid.appendChild(emptyState);
      } else {
        // Re-render all offerings with updated data
        this.specialOfferings.forEach((offering, index) => {
          const offeringCard = this.createOfferingCard(offering, index);
          specialOfferingsGrid.appendChild(offeringCard);
        });
      }
      
      // Update toggle button visibility and text
      const toggleBtn = document.getElementById('toggle-offerings-btn');
      if (toggleBtn && this.allSpecialOfferings) {
        if (this.allSpecialOfferings.length <= 3) {
          // Hide button if 3 or fewer offerings
          toggleBtn.style.display = 'none';
        } else {
          // Show button and update text
          toggleBtn.style.display = 'flex';
          const arrowIcon = toggleBtn.querySelector('span');
          toggleBtn.childNodes[0].textContent = this.showingAllOfferings ? 'Show Less' : `See All (${this.allSpecialOfferings.length})`;
          if (arrowIcon) {
            arrowIcon.textContent = this.showingAllOfferings ? '↑' : '↓';
          }
        }
      }
    }
  }
  
  updatePaymentsUI() {
    const paymentsContainer = document.getElementById('payments-table-container');
    if (paymentsContainer && !this.isLoadingPayments) {
      // Get current active tab
      const activeTab = document.querySelector('[id^="tab-"][style*="border-bottom: 2px solid rgb(59, 130, 246)"]');
      const filter = activeTab ? activeTab.id.replace('tab-', '') : 'all';
      
      this.filterPaymentHistory(filter);
    }
  }
  
  // Helper Methods and UI Components
  
  showNotification(message, type = 'info') {
    // Get color based on notification type
    let bgColor, textColor, borderColor, icon;
    switch (type) {
      case 'success':
        bgColor = 'rgba(16, 185, 129, 0.9)';
        textColor = '#ecfdf5';
        borderColor = 'rgba(16, 185, 129, 0.5)';
        icon = '✓';
        break;
      case 'error':
        bgColor = 'rgba(239, 68, 68, 0.9)';
        textColor = '#fef2f2';
        borderColor = 'rgba(239, 68, 68, 0.5)';
        icon = '✗';
        break;
      case 'warning':
        bgColor = 'rgba(245, 158, 11, 0.9)';
        textColor = '#fffbeb';
        borderColor = 'rgba(245, 158, 11, 0.5)';
        icon = '⚠';
        break;
      default: // info
        bgColor = 'rgba(59, 130, 246, 0.9)';
        textColor = '#eff6ff';
        borderColor = 'rgba(59, 130, 246, 0.5)';
        icon = 'ℹ';
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px 20px 15px 45px';
    notification.style.borderRadius = '12px';
    notification.style.background = bgColor;
    notification.style.color = textColor;
    notification.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.2)';
    notification.style.backdropFilter = 'blur(10px)';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '300px';
    notification.style.animation = 'fadeIn 0.3s ease-out';
    notification.style.border = `1px solid ${borderColor}`;
    notification.style.position = 'relative';
    notification.textContent = message;
    
    // Add icon
    const iconElement = document.createElement('span');
    iconElement.textContent = icon;
    iconElement.style.position = 'absolute';
    iconElement.style.left = '15px';
    iconElement.style.top = '50%';
    iconElement.style.transform = 'translateY(-50%)';
    iconElement.style.fontSize = '18px';
    notification.appendChild(iconElement);
    
    // Add close button
    const closeButton = document.createElement('span');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '10px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '18px';
    closeButton.style.opacity = '0.7';
    closeButton.addEventListener('click', () => {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    });
    notification.appendChild(closeButton);
    
    document.body.appendChild(notification);
    
    // Remove notification after delay
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 5000);
  }
  
  showModal(title, content) {
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-overlay';
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.width = '100%';
    modalContainer.style.height = '100%';
    modalContainer.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
    modalContainer.style.backdropFilter = 'blur(8px)';
    modalContainer.style.zIndex = '1000';
    modalContainer.style.display = 'flex';
    modalContainer.style.justifyContent = 'center';
    modalContainer.style.alignItems = 'center';
    modalContainer.style.padding = '20px';
    modalContainer.style.animation = 'fadeIn 0.3s ease-out';
    
    // Modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'neo-card';
    modalContent.style.width = '100%';
    modalContent.style.maxWidth = '550px';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.overflowY = 'auto';
    modalContent.style.position = 'relative';
    modalContent.style.animation = 'scaleIn 0.3s ease-out';
    
    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.padding = '20px';
    modalHeader.style.borderBottom = '1px solid rgba(30, 41, 59, 0.6)';
    modalHeader.style.display = 'flex';
    modalHeader.style.justifyContent = 'space-between';
    modalHeader.style.alignItems = 'center';
    
    const modalTitle = document.createElement('h3');
    modalTitle.textContent = title;
    modalTitle.style.fontSize = '20px';
    modalTitle.style.fontWeight = '600';
    modalTitle.style.color = '#ffffff';
    modalTitle.style.margin = '0';
    modalTitle.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.fontWeight = '600';
    closeButton.style.color = '#e2e8f0';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0';
    closeButton.style.width = '30px';
    closeButton.style.height = '30px';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.style.borderRadius = '50%';
    closeButton.style.transition = 'all 0.2s ease';
    
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
      closeButton.style.color = '#ffffff';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent';
      closeButton.style.color = '#e2e8f0';
    });
    
    closeButton.addEventListener('click', () => {
      modalContainer.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(modalContainer);
      }, 300);
    });
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Modal body
    const modalBody = document.createElement('div');
    modalBody.style.padding = '20px';
    
    if (typeof content === 'string') {
      modalBody.innerHTML = content;
    } else {
      modalBody.appendChild(content);
    }
    
    // Modal footer
    const modalFooter = document.createElement('div');
    modalFooter.style.padding = '20px';
    modalFooter.style.borderTop = '1px solid rgba(30, 41, 59, 0.6)';
    modalFooter.style.display = 'flex';
    modalFooter.style.justifyContent = 'flex-end';
    
    // Close button
    const closeModalButton = document.createElement('button');
    closeModalButton.textContent = 'Close';
    closeModalButton.className = 'futuristic-button';
    closeModalButton.style.background = 'linear-gradient(135deg, rgba(100, 116, 139, 0.2), rgba(100, 116, 139, 0.1))';
    
    closeModalButton.addEventListener('click', () => {
      modalContainer.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(modalContainer);
      }, 300);
    });
    
    modalFooter.appendChild(closeModalButton);
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    
    modalContainer.appendChild(modalContent);
    document.body.appendChild(modalContainer);
    
    // Close modal when clicking outside
    modalContainer.addEventListener('click', (event) => {
      if (event.target === modalContainer) {
        modalContainer.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
          document.body.removeChild(modalContainer);
        }, 300);
      }
    });
  }
  
  showConfirmationDialog(title, message, confirmCallback) {
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-overlay';
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.width = '100%';
    modalContainer.style.height = '100%';
    modalContainer.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
    modalContainer.style.backdropFilter = 'blur(8px)';
    modalContainer.style.zIndex = '1000';
    modalContainer.style.display = 'flex';
    modalContainer.style.justifyContent = 'center';
    modalContainer.style.alignItems = 'center';
    modalContainer.style.padding = '20px';
    modalContainer.style.animation = 'fadeIn 0.3s ease-out';
    
    // Modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'neo-card';
    modalContent.style.width = '100%';
    modalContent.style.maxWidth = '450px';
    modalContent.style.position = 'relative';
    modalContent.style.animation = 'scaleIn 0.3s ease-out';
    
    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.padding = '20px';
    modalHeader.style.borderBottom = '1px solid rgba(30, 41, 59, 0.6)';
    
    const modalTitle = document.createElement('h3');
    modalTitle.textContent = title;
    modalTitle.style.fontSize = '20px';
    modalTitle.style.fontWeight = '600';
    modalTitle.style.color = '#ffffff';
    modalTitle.style.margin = '0';
    modalTitle.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
    
    modalHeader.appendChild(modalTitle);
    
    // Modal body
    const modalBody = document.createElement('div');
    modalBody.style.padding = '20px';
    
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.style.fontSize = '16px';
    messageElement.style.color = '#e2e8f0';
    messageElement.style.margin = '0';
    
    modalBody.appendChild(messageElement);
    
    // Modal footer
    const modalFooter = document.createElement('div');
    modalFooter.style.padding = '20px';
    modalFooter.style.borderTop = '1px solid rgba(30, 41, 59, 0.6)';
    modalFooter.style.display = 'flex';
    modalFooter.style.justifyContent = 'flex-end';
    modalFooter.style.gap = '10px';
    
    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'futuristic-button';
    cancelButton.style.background = 'linear-gradient(135deg, rgba(100, 116, 139, 0.2), rgba(100, 116, 139, 0.1))';
    
    cancelButton.addEventListener('click', () => {
      modalContainer.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(modalContainer);
      }, 300);
    });
    
    // Confirm button
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirm';
    confirmButton.className = 'futuristic-button';
    confirmButton.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))';
    
    confirmButton.addEventListener('click', () => {
      modalContainer.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(modalContainer);
        // Execute the callback after modal is closed
        if (typeof confirmCallback === 'function') {
          confirmCallback();
        }
      }, 300);
    });
    
    modalFooter.appendChild(cancelButton);
    modalFooter.appendChild(confirmButton);
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    
    modalContainer.appendChild(modalContent);
    document.body.appendChild(modalContainer);
  }
  
  // Additional Utility Methods
  
  formatCurrency(amount, currency = 'KES') {
    if (typeof amount !== 'number' && typeof amount !== 'string') {
      return `${currency} 0.00`;
    }
    
    // Convert to number if string
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount)) {
      return `${currency} 0.00`;
    }
    
    return `${currency} ${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  formatPaymentType(type) {
    if (!type) return 'Unknown';
    
    if (type.startsWith('SPECIAL_')) {
      return this.formatSpecialOfferingName(type);
    }
    
    switch (type) {
      case 'TITHE':
        return 'Tithe';
      case 'OFFERING':
        return 'Offering';
      case 'DONATION':
        return 'Donation';
      case 'EXPENSE':
        return 'Expense';
      case 'OTHER':
        return 'Other';
      default:
        // Convert snake_case to Title Case
        return type.split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
    }
  }
  
  formatSpecialOfferingName(type) {
    if (!type?.startsWith('SPECIAL_')) {
      return 'Unknown Offering';
    }
    
    const name = type.replace('SPECIAL_', '');
    const validTypes = [
      'BUILDING', 'MISSION', 'CHARITY', 'YOUTH', 
      'EDUCATION', 'EQUIPMENT', 'COMMUNITY', 'OTHER'
    ];
    
    return validTypes.includes(name) 
      ? this.getSpecialOfferingLabel(name)
      : name.split('_')
           .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
           .join(' ');
  }
  
  getSpecialOfferingLabel(name) {
    const labels = {
      'BUILDING': 'Building Fund',
      'MISSION': 'Mission Trip',
      'CHARITY': 'Charity Drive',
      'YOUTH': 'Youth Program',
      'EDUCATION': 'Education Fund',
      'EQUIPMENT': 'Equipment Purchase',
      'COMMUNITY': 'Community Outreach',
      'OTHER': 'Special Offering'
    };
    return labels[name] || name;
  }
  
  formatTitheCategory(key) {
    switch (key) {
      case 'local':
        return 'Local Church';
      case 'conference':
        return 'Conference';
      case 'union':
        return 'Union';
      case 'division':
        return 'Division';
      case 'generalConference':
        return 'General Conference';
      case 'special':
        return 'Special Offering';
      case 'other':
        return 'Other';
      default:
        // Convert camelCase or snake_case to Title Case
        return key
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .replace(/^./, str => str.toUpperCase())
          .trim();
    }
  }
  
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
  
  validatePaymentType(type) {
    if (!type) return false;
    
    const validTypes = [
      'TITHE',
      'OFFERING',
      'DONATION',
      'EXPENSE',
      'OTHER'
    ];
    
    // Check if it's a special offering
    if (type.startsWith('SPECIAL_')) {
      const specialType = type.replace('SPECIAL_', '');
      const validSpecialTypes = [
        'BUILDING',
        'MISSION',
        'CHARITY',
        'YOUTH',
        'EDUCATION',
        'EQUIPMENT',
        'COMMUNITY',
        'OTHER'
      ];
      return validSpecialTypes.includes(specialType);
    }
    
    return validTypes.includes(type);
  }
  
  // Add global styles
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
        
        /* IMPROVED TEXT VISIBILITY */
        h1, h2, h3, h4, h5, h6 {
          color: #ffffff;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          letter-spacing: 0.02em;
        }
        
        p, span, div {
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        
        /* Increase contrast for card content */
        .neo-card {
          background: rgba(15, 23, 42, 0.75);
        }
        
        /* Higher contrast for important text */
        .stat-value, .amount-text, .offering-title {
          color: #ffffff !important;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4) !important;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.5);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.8);
        }
        
        .neo-card {
          position: relative;
          backdrop-filter: blur(16px);
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
            0 8px 20px -6px rgba(6, 182, 212, 0.2);
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
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); animation-fill-mode: forwards; }
        }

        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(10px); }
        }
        
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        
        .futuristic-button {
          position: relative;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1));
          color: #ffffff;
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
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.2));
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
        
        .action-button {
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
        }
        
        .action-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }
        
        .hologram-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.1));
          border-radius: 12px;
          font-size: 24px;
          position: relative;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
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
            rgba(6, 182, 212, 0.5), 
            rgba(6, 182, 212, 0), 
            rgba(6, 182, 212, 0.5));
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
          border-top-color: #06b6d4;
          border-left-color: #06b6d4;
          animation: spinner 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
        }
        
        @keyframes spinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .animated-item {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
          animation-fill-mode: forwards;
        }
        
        @media (max-width: 768px) {
          .dashboard-container {
            padding: 20px 10px;
          }
          
          h1 {
            font-size: 24px !important;
          }
          
          h2 {
            font-size: 18px !important;
          }
          
          .payment-card {
            margin-bottom: 15px;
          }
        }
      `;
      document.head.appendChild(styleElement);
    }
  }
  
  // Add futuristic background effects
  addBackgroundEffects() {
    // Add gradient background (only if not already present)
    if (!document.querySelector('.gradient-background')) {
      const gradientBackground = document.createElement('div');
      gradientBackground.className = 'gradient-background';
      gradientBackground.style.position = 'fixed';
      gradientBackground.style.top = '0';
      gradientBackground.style.left = '0';
      gradientBackground.style.width = '100%';
      gradientBackground.style.height = '100%';
      gradientBackground.style.background = 'linear-gradient(125deg, #0f172a 0%, #0f766e 40%, #0f172a 100%)';
      gradientBackground.style.backgroundSize = '400% 400%';
      gradientBackground.style.zIndex = '-2';
      gradientBackground.style.animation = 'gradientBG 15s ease infinite';
      document.body.appendChild(gradientBackground);
    }
    
    // Add particle overlay for visual depth
    if (!document.querySelector('.particle-overlay')) {
      const particleOverlay = document.createElement('div');
      particleOverlay.className = 'particle-overlay';
      particleOverlay.style.position = 'fixed';
      particleOverlay.style.top = '0';
      particleOverlay.style.left = '0';
      particleOverlay.style.width = '100%';
      particleOverlay.style.height = '100%';
      particleOverlay.style.background = 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%2306b6d4\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")';
      particleOverlay.style.backgroundSize = '100px 100px';
      particleOverlay.style.backgroundRepeat = 'repeat';
      particleOverlay.style.zIndex = '-1';
      particleOverlay.style.animation = 'floatParticles 150s linear infinite';
      document.body.appendChild(particleOverlay);
    }
    
    // Add lens flares for depth and visual interest
    const flares = [
      { top: '15%', left: '85%', size: '300px', color: 'rgba(6, 182, 212, 0.15)', id: 'lens-flare-1' },
      { top: '75%', left: '15%', size: '250px', color: 'rgba(16, 185, 129, 0.1)', id: 'lens-flare-2' }
    ];
    
    flares.forEach(flare => {
      if (!document.getElementById(flare.id)) {
        const lensFlare = document.createElement('div');
        lensFlare.id = flare.id;
        lensFlare.style.position = 'fixed';
        lensFlare.style.top = flare.top;
        lensFlare.style.left = flare.left;
        lensFlare.style.width = flare.size;
        lensFlare.style.height = flare.size;
        lensFlare.style.borderRadius = '50%';
        lensFlare.style.background = `radial-gradient(circle at center, ${flare.color}, transparent 70%)`;
        lensFlare.style.pointerEvents = 'none';
        lensFlare.style.zIndex = '-1';
        document.body.appendChild(lensFlare);
      }
    });
  }
  
  // Destroy method for cleanup
  destroy() {
    // Remove event listeners to prevent memory leaks
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Remove background elements from DOM
    const bgElements = [
      '.gradient-background',
      '.particle-overlay',
      '#lens-flare-1',
      '#lens-flare-2'
    ];
    
    bgElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    return true;
  }
}

export default DashboardView;