// src/views/payments/makePayments.js
export { MakePaymentsView as default, MakePaymentsView as MakePaymentView };

class MakePaymentsView {
  constructor() {
    this.apiService = window.apiService;
    this.authService = window.authService;
    this.user = this.authService.getUser();
    
    // Payment state
    this.paymentType = 'TITHE'; // Default payment type
    this.specialOfferingType = '';
    this.amount = 0;
    this.phoneNumber = this.user?.phoneNumber || '';
    this.titheDistribution = {
      GENERAL: 100, // Default 100% to general
      MUSIC: 0,
      CHILDREN: 0,
      YOUTH: 0,
      EDUCATION: 0,
      MAINTENANCE: 0,
      DEVELOPMENT: 0,
      OTHER: 0
    };
    
    // UI state
    this.isLoading = false;
    this.specialOfferings = [];
    this.isLoadingSpecial = true;
    this.error = null;
    this.success = null;
    
    // API throttling configuration
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 300; // ms between API calls
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
  
  async render() {
    const container = document.createElement('div');
    
    try {
      // Add modern styling and background effects
      this.addGlobalStyles();
      this.addBackgroundEffects();
      
      // Main container styling - futuristic layout
      container.className = 'make-payments-container';
      container.style.maxWidth = '1300px';
      container.style.margin = '0 auto';
      container.style.padding = '30px 20px';
      container.style.color = '#eef2ff';
      container.style.fontFamily = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      container.style.position = 'relative';
      container.style.zIndex = '1';
      
      // Navigation bar
      container.appendChild(this.renderNavigation());
      
      // Payment form container
      container.appendChild(this.renderPaymentForm());
      
      // Initialize data fetching
      setTimeout(() => {
        this.fetchSpecialOfferings();
      }, 100);
      
    } catch (error) {
      console.error('Error rendering MakePayments view:', error);
      
      const errorMessage = document.createElement('div');
      errorMessage.style.color = '#EF4444';
      errorMessage.style.padding = '20px';
      errorMessage.style.textAlign = 'center';
      errorMessage.style.background = 'rgba(30, 41, 59, 0.7)';
      errorMessage.style.borderRadius = '12px';
      errorMessage.style.backdropFilter = 'blur(10px)';
      errorMessage.style.margin = '20px 0';
      errorMessage.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      errorMessage.textContent = `Error loading payment page: ${error.message}`;
      
      container.appendChild(errorMessage);
    }
    
    return container;
  }
  
  async fetchSpecialOfferings() {
    this.isLoadingSpecial = true;
    
    try {
      // Get all special offerings
      const response = await this.queueApiRequest(() => 
        this.apiService.getSpecialOfferings(true) // Get active offerings only
      );
      
      if (response && response.specialOfferings) {
        // Sort by creation date, most recent first
        this.specialOfferings = response.specialOfferings.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.startDate || 0);
          const dateB = new Date(b.createdAt || b.startDate || 0);
          return dateB - dateA; // Most recent first
        });
        
        console.log('Special offerings loaded:', this.specialOfferings.length);
      }
    } catch (error) {
      console.error('Error fetching special offerings:', error);
      this.error = 'Failed to load special offerings data.';
      
      // Try alternative endpoint if the first one fails
      try {
        const altResponse = await this.queueApiRequest(() => 
          this.apiService.get('/payment/special-offerings')
        );
        
        if (altResponse && altResponse.specialOfferings) {
          this.specialOfferings = altResponse.specialOfferings;
          console.log('Special offerings loaded from alternative endpoint:', this.specialOfferings.length);
        }
      } catch (altError) {
        console.error('Alternative special offerings endpoint also failed:', altError);
      }
    } finally {
      this.isLoadingSpecial = false;
      this.updateSpecialOfferingsUI();
    }
  }
  
  renderNavigation() {
    const navSection = document.createElement('div');
    navSection.className = 'neo-card animated-item';
    navSection.style.marginBottom = '30px';
    navSection.style.padding = '15px 30px';
    navSection.style.display = 'flex';
    navSection.style.justifyContent = 'space-between';
    navSection.style.alignItems = 'center';
    navSection.style.position = 'relative';
    navSection.style.overflow = 'hidden';
    
    // Add glow effect
    const navGlow = document.createElement('div');
    navGlow.className = 'card-glow';
    navGlow.style.background = 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.3), transparent 70%)';
    navSection.appendChild(navGlow);
    
    // Logo/Title
    const logoContainer = document.createElement('div');
    logoContainer.style.display = 'flex';
    logoContainer.style.alignItems = 'center';
    
    const logoIcon = document.createElement('div');
    logoIcon.className = 'hologram-icon';
    logoIcon.style.width = '40px';
    logoIcon.style.height = '40px';
    logoIcon.style.fontSize = '20px';
    logoIcon.style.marginRight = '15px';
    logoIcon.textContent = '💸';
    
    const logoText = document.createElement('h1');
    logoText.style.fontSize = '22px';
    logoText.style.fontWeight = '700';
    logoText.style.margin = '0';
    logoText.style.color = '#ffffff';
    logoText.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    logoText.textContent = 'Make Payment';
    
    logoContainer.appendChild(logoIcon);
    logoContainer.appendChild(logoText);
    
    // Navigation links
    const navLinks = document.createElement('div');
    navLinks.style.display = 'flex';
    navLinks.style.gap = '15px';
    
    // Mobile menu button (visible on small screens)
    const mobileMenuButton = document.createElement('button');
    mobileMenuButton.className = 'mobile-menu-button';
    mobileMenuButton.style.display = 'none';
    mobileMenuButton.style.background = 'transparent';
    mobileMenuButton.style.border = 'none';
    mobileMenuButton.style.fontSize = '24px';
    mobileMenuButton.style.color = '#ffffff';
    mobileMenuButton.style.cursor = 'pointer';
    mobileMenuButton.textContent = '☰';
    
    // Links
    const links = [
      { text: 'Dashboard', href: '/dashboard' },
      { text: 'About', href: '/about' },
      { text: 'Contact', href: '/contact' }
    ];
    
    links.forEach(link => {
      const navLink = document.createElement('a');
      navLink.href = link.href;
      navLink.style.color = '#ffffff';
      navLink.style.textDecoration = 'none';
      navLink.style.fontSize = '16px';
      navLink.style.fontWeight = '500';
      navLink.style.padding = '8px 15px';
      navLink.style.borderRadius = '12px';
      navLink.style.transition = 'all 0.3s ease';
      navLink.textContent = link.text;
      
      // Hover effects
      navLink.addEventListener('mouseenter', () => {
        navLink.style.backgroundColor = 'rgba(6, 182, 212, 0.2)';
      });
      
      navLink.addEventListener('mouseleave', () => {
        navLink.style.backgroundColor = 'transparent';
      });
      
      navLinks.appendChild(navLink);
    });
    
    // Add mobile menu functionality
    mobileMenuButton.addEventListener('click', () => {
      // Toggle mobile menu visibility
      const mobileMenu = document.querySelector('.mobile-menu');
      if (mobileMenu) {
        mobileMenu.style.display = mobileMenu.style.display === 'flex' ? 'none' : 'flex';
      }
    });
    
    navSection.appendChild(logoContainer);
    navSection.appendChild(navLinks);
    navSection.appendChild(mobileMenuButton);
    
    // Create mobile menu (hidden by default)
    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';
    mobileMenu.style.display = 'none';
    mobileMenu.style.position = 'absolute';
    mobileMenu.style.top = '100%';
    mobileMenu.style.left = '0';
    mobileMenu.style.right = '0';
    mobileMenu.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
    mobileMenu.style.backdropFilter = 'blur(10px)';
    mobileMenu.style.borderRadius = '0 0 12px 12px';
    mobileMenu.style.flexDirection = 'column';
    mobileMenu.style.padding = '15px';
    mobileMenu.style.zIndex = '100';
    
    links.forEach(link => {
      const mobileLink = document.createElement('a');
      mobileLink.href = link.href;
      mobileLink.style.color = '#ffffff';
      mobileLink.style.textDecoration = 'none';
      mobileLink.style.fontSize = '16px';
      mobileLink.style.fontWeight = '500';
      mobileLink.style.padding = '12px 15px';
      mobileLink.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      mobileLink.textContent = link.text;
      
      mobileMenu.appendChild(mobileLink);
    });
    
    navSection.appendChild(mobileMenu);
    
    return navSection;
  }
  
  renderPaymentForm() {
    const formSection = document.createElement('div');
    formSection.className = 'neo-card animated-item';
    formSection.style.animationDelay = '0.2s';
    formSection.style.padding = '0';
    formSection.style.overflow = 'hidden';
    formSection.style.position = 'relative';
    
    // Add glow effect
    const formGlow = document.createElement('div');
    formGlow.className = 'card-glow';
    formGlow.style.background = 'radial-gradient(circle at center, rgba(6, 182, 212, 0.3), transparent 70%)';
    formSection.appendChild(formGlow);
    
    // Form header
    const formHeader = document.createElement('div');
    formHeader.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(8, 145, 178, 0.1))';
    formHeader.style.padding = '25px 30px';
    formHeader.style.borderBottom = '1px solid rgba(6, 182, 212, 0.1)';
    
    const formTitle = document.createElement('h2');
    formTitle.style.fontSize = '24px';
    formTitle.style.fontWeight = '700';
    formTitle.style.margin = '0';
    formTitle.style.color = '#ffffff';
    formTitle.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
    formTitle.textContent = 'Make Your Contribution';
    
    const formSubtitle = document.createElement('p');
    formSubtitle.style.fontSize = '16px';
    formSubtitle.style.color = '#e2e8f0';
    formSubtitle.style.margin = '10px 0 0';
    formSubtitle.textContent = 'Select payment type and enter amount to contribute';
    
    formHeader.appendChild(formTitle);
    formHeader.appendChild(formSubtitle);
    
    // Form content - two columns on desktop, single column on mobile
    const formContent = document.createElement('div');
    formContent.style.padding = '30px';
    formContent.style.display = 'grid';
    formContent.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    formContent.style.gap = '30px';
    
    // Left column - payment type and amount
    const leftColumn = document.createElement('div');
    
    // Payment type selection
    const paymentTypeSection = document.createElement('div');
    paymentTypeSection.style.marginBottom = '30px';
    
    const paymentTypeLabel = document.createElement('label');
    paymentTypeLabel.style.display = 'block';
    paymentTypeLabel.style.fontSize = '16px';
    paymentTypeLabel.style.fontWeight = '600';
    paymentTypeLabel.style.color = '#ffffff';
    paymentTypeLabel.style.marginBottom = '12px';
    paymentTypeLabel.textContent = 'Payment Type';
    
    const paymentTypeGrid = document.createElement('div');
    paymentTypeGrid.style.display = 'grid';
    paymentTypeGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
    paymentTypeGrid.style.gap = '15px';
    
    const paymentTypes = [
      { id: 'TITHE', name: 'Tithe', icon: '📝' },
      { id: 'OFFERING', name: 'Offering', icon: '🎁' },
      { id: 'DONATION', name: 'Donation', icon: '💝' },
      { id: 'SPECIAL', name: 'Special Offering', icon: '✨' }
    ];
    
    paymentTypes.forEach(type => {
      const typeCard = document.createElement('div');
      typeCard.className = 'payment-type-card';
      typeCard.dataset.type = type.id;
      typeCard.style.background = this.paymentType === type.id ? 
        'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.1))' :
        'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(30, 41, 59, 0.2))';
      typeCard.style.borderRadius = '12px';
      typeCard.style.padding = '15px';
      typeCard.style.textAlign = 'center';
      typeCard.style.cursor = 'pointer';
      typeCard.style.transition = 'all 0.3s ease';
      typeCard.style.border = this.paymentType === type.id ?
        '1px solid rgba(6, 182, 212, 0.3)' :
        '1px solid rgba(30, 41, 59, 0.6)';
      
      const typeIcon = document.createElement('div');
      typeIcon.style.fontSize = '24px';
      typeIcon.style.marginBottom = '8px';
      typeIcon.textContent = type.icon;
      
      const typeName = document.createElement('div');
      typeName.style.fontSize = '14px';
      typeName.style.fontWeight = '600';
      typeName.style.color = this.paymentType === type.id ? '#ffffff' : '#e2e8f0';
      typeName.textContent = type.name;
      
      // Add selection functionality
      typeCard.addEventListener('click', () => {
        this.setPaymentType(type.id);
      });
      
      typeCard.appendChild(typeIcon);
      typeCard.appendChild(typeName);
      
      paymentTypeGrid.appendChild(typeCard);
    });
    
    paymentTypeSection.appendChild(paymentTypeLabel);
    paymentTypeSection.appendChild(paymentTypeGrid);
    
    // Special offering selection (initially hidden)
    const specialOfferingSection = document.createElement('div');
    specialOfferingSection.id = 'special-offering-section';
    specialOfferingSection.style.marginBottom = '30px';
    specialOfferingSection.style.display = this.paymentType === 'SPECIAL' ? 'block' : 'none';
    
    const specialOfferingLabel = document.createElement('label');
    specialOfferingLabel.style.display = 'block';
    specialOfferingLabel.style.fontSize = '16px';
    specialOfferingLabel.style.fontWeight = '600';
    specialOfferingLabel.style.color = '#ffffff';
    specialOfferingLabel.style.marginBottom = '12px';
    specialOfferingLabel.textContent = 'Select Special Offering';
    
    const specialOfferingContainer = document.createElement('div');
    specialOfferingContainer.id = 'special-offerings-container';
    specialOfferingContainer.style.display = 'flex';
    specialOfferingContainer.style.flexDirection = 'column';
    specialOfferingContainer.style.gap = '12px';
    
    // Loading state will be populated in updateSpecialOfferingsUI
    if (this.isLoadingSpecial) {
      const loadingDiv = document.createElement('div');
      loadingDiv.style.display = 'flex';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.justifyContent = 'center';
      loadingDiv.style.padding = '20px 0';
      
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      spinner.style.width = '30px';
      spinner.style.height = '30px';
      
      loadingDiv.appendChild(spinner);
      specialOfferingContainer.appendChild(loadingDiv);
    }
    
    specialOfferingSection.appendChild(specialOfferingLabel);
    specialOfferingSection.appendChild(specialOfferingContainer);
    
    // Amount input
    const amountSection = document.createElement('div');
    amountSection.style.marginBottom = '30px';
    
    const amountLabel = document.createElement('label');
    amountLabel.style.display = 'block';
    amountLabel.style.fontSize = '16px';
    amountLabel.style.fontWeight = '600';
    amountLabel.style.color = '#ffffff';
    amountLabel.style.marginBottom = '12px';
    amountLabel.textContent = 'Amount (KES)';
    
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '1';
    amountInput.id = 'amount-input';
    amountInput.placeholder = 'Enter amount';
    amountInput.className = 'futuristic-input';
    amountInput.style.width = '100%';
    amountInput.style.padding = '15px';
    amountInput.style.background = 'rgba(15, 23, 42, 0.6)';
    amountInput.style.border = '1px solid rgba(6, 182, 212, 0.3)';
    amountInput.style.borderRadius = '12px';
    amountInput.style.color = '#ffffff';
    amountInput.style.fontSize = '16px';
    amountInput.style.transition = 'all 0.3s ease';
    
    // Add event listener for amount input
    amountInput.addEventListener('input', (e) => {
      this.amount = parseFloat(e.target.value) || 0;
      this.updateTitheDistributionAmounts();
    });
    
    // Focus effect
    amountInput.addEventListener('focus', () => {
      amountInput.style.boxShadow = '0 0 0 2px rgba(6, 182, 212, 0.3)';
      amountInput.style.border = '1px solid rgba(6, 182, 212, 0.5)';
    });
    
    amountInput.addEventListener('blur', () => {
      amountInput.style.boxShadow = 'none';
      amountInput.style.border = '1px solid rgba(6, 182, 212, 0.3)';
    });
    
    // Phone number input
    const phoneSection = document.createElement('div');
    phoneSection.style.marginBottom = '30px';
    
    const phoneLabel = document.createElement('label');
    phoneLabel.style.display = 'block';
    phoneLabel.style.fontSize = '16px';
    phoneLabel.style.fontWeight = '600';
    phoneLabel.style.color = '#ffffff';
    phoneLabel.style.marginBottom = '12px';
    phoneLabel.textContent = 'Phone Number (M-Pesa)';
    
    const phoneInput = document.createElement('input');
    phoneInput.type = 'tel';
    phoneInput.id = 'phone-input';
    phoneInput.placeholder = 'e.g. 254712345678';
    phoneInput.value = this.phoneNumber;
    phoneInput.className = 'futuristic-input';
    phoneInput.style.width = '100%';
    phoneInput.style.padding = '15px';
    phoneInput.style.background = 'rgba(15, 23, 42, 0.6)';
    phoneInput.style.border = '1px solid rgba(6, 182, 212, 0.3)';
    phoneInput.style.borderRadius = '12px';
    phoneInput.style.color = '#ffffff';
    phoneInput.style.fontSize = '16px';
    phoneInput.style.transition = 'all 0.3s ease';
    
    // Add event listener for phone input
    phoneInput.addEventListener('input', (e) => {
      this.phoneNumber = e.target.value;
    });
    
    // Focus effect
    phoneInput.addEventListener('focus', () => {
      phoneInput.style.boxShadow = '0 0 0 2px rgba(6, 182, 212, 0.3)';
      phoneInput.style.border = '1px solid rgba(6, 182, 212, 0.5)';
    });
    
    phoneInput.addEventListener('blur', () => {
      phoneInput.style.boxShadow = 'none';
      phoneInput.style.border = '1px solid rgba(6, 182, 212, 0.3)';
    });
    
    amountSection.appendChild(amountLabel);
    amountSection.appendChild(amountInput);
    
    phoneSection.appendChild(phoneLabel);
    phoneSection.appendChild(phoneInput);
    
    leftColumn.appendChild(paymentTypeSection);
    leftColumn.appendChild(specialOfferingSection);
    leftColumn.appendChild(amountSection);
    leftColumn.appendChild(phoneSection);
    
    // Right column - tithe distribution (only for tithe)
    const rightColumn = document.createElement('div');
    
    // Tithe distribution section
    const titheDistributionSection = document.createElement('div');
    titheDistributionSection.id = 'tithe-distribution-section';
    titheDistributionSection.style.display = this.paymentType === 'TITHE' ? 'block' : 'none';
    
    const titheLabel = document.createElement('div');
    titheLabel.style.fontSize = '16px';
    titheLabel.style.fontWeight = '600';
    titheLabel.style.color = '#ffffff';
    titheLabel.style.marginBottom = '12px';
    titheLabel.textContent = 'Tithe Distribution';
    
    // Distribution instructions
    const distributionInstructions = document.createElement('p');
    distributionInstructions.style.fontSize = '14px';
    distributionInstructions.style.color = '#e2e8f0';
    distributionInstructions.style.marginBottom = '20px';
    distributionInstructions.textContent = 'Adjust percentages (total must be 100%). By default, 100% goes to General Fund.';
    
    // Distribution graph
    const distributionGraph = document.createElement('div');
    distributionGraph.className = 'distribution-graph';
    distributionGraph.style.marginBottom = '20px';
    distributionGraph.style.height = '20px';
    distributionGraph.style.borderRadius = '10px';
    distributionGraph.style.background = 'rgba(15, 23, 42, 0.6)';
    distributionGraph.style.position = 'relative';
    distributionGraph.style.overflow = 'hidden';
    
    // Distribution sliders
    const distributionSliders = document.createElement('div');
    distributionSliders.className = 'distribution-sliders';
    distributionSliders.style.display = 'flex';
    distributionSliders.style.flexDirection = 'column';
    distributionSliders.style.gap = '15px';
    
    const departmentColors = {
      GENERAL: '#06b6d4',
      MUSIC: '#8b5cf6',
      CHILDREN: '#10b981',
      YOUTH: '#f59e0b',
      EDUCATION: '#3b82f6',
      MAINTENANCE: '#ef4444',
      DEVELOPMENT: '#ec4899',
      OTHER: '#64748b'
    };
    
    // Create distribution bars for graph
    Object.entries(this.titheDistribution).forEach(([dept, percentage]) => {
      if (percentage > 0) {
        const distributionBar = document.createElement('div');
        distributionBar.className = `distribution-bar ${dept.toLowerCase()}`;
        distributionBar.style.position = 'absolute';
        distributionBar.style.top = '0';
        distributionBar.style.left = '0';
        distributionBar.style.height = '100%';
        distributionBar.style.width = `${percentage}%`;
        distributionBar.style.background = departmentColors[dept] || '#64748b';
        distributionBar.style.transition = 'all 0.3s ease';
        
        distributionGraph.appendChild(distributionBar);
      }
    });
    
    // Create department sliders
    Object.entries(this.titheDistribution).forEach(([dept, percentage]) => {
      const sliderContainer = document.createElement('div');
      sliderContainer.style.position = 'relative';
      
      const sliderHeader = document.createElement('div');
      sliderHeader.style.display = 'flex';
      sliderHeader.style.justifyContent = 'space-between';
      sliderHeader.style.alignItems = 'center';
      sliderHeader.style.marginBottom = '5px';
      
      const deptLabel = document.createElement('label');
      deptLabel.style.fontSize = '14px';
      deptLabel.style.fontWeight = '500';
      deptLabel.style.color = '#e2e8f0';
      deptLabel.textContent = this.formatDepartment(dept);
      
      const percentageDisplay = document.createElement('span');
      percentageDisplay.className = `percentage-display ${dept.toLowerCase()}`;
      percentageDisplay.style.fontSize = '14px';
      percentageDisplay.style.fontWeight = '600';
      percentageDisplay.style.color = departmentColors[dept] || '#64748b';
      percentageDisplay.textContent = `${percentage}%`;
      
      // Amount display for current department
      const amountDisplay = document.createElement('span');
      amountDisplay.className = `amount-display ${dept.toLowerCase()}`;
      amountDisplay.style.fontSize = '14px';
      amountDisplay.style.color = '#94a3b8';
      amountDisplay.style.marginLeft = '10px';
      amountDisplay.textContent = `(KES 0.00)`;
      
      const percentageWrapper = document.createElement('div');
      percentageWrapper.style.display = 'flex';
      percentageWrapper.style.alignItems = 'center';
      percentageWrapper.appendChild(percentageDisplay);
      percentageWrapper.appendChild(amountDisplay);
      
      sliderHeader.appendChild(deptLabel);
      sliderHeader.appendChild(percentageWrapper);
      
      const sliderInput = document.createElement('input');
      sliderInput.type = 'range';
      sliderInput.min = '0';
      sliderInput.max = '100';
      sliderInput.value = percentage;
      sliderInput.className = `distribution-slider ${dept.toLowerCase()}`;
      sliderInput.style.width = '100%';
      sliderInput.style.accentColor = departmentColors[dept] || '#64748b';
      
      // Add event listener for slider input
      sliderInput.addEventListener('input', (e) => {
        this.adjustTitheDistribution(dept, parseInt(e.target.value));
      });
      
      sliderContainer.appendChild(sliderHeader);
      sliderContainer.appendChild(sliderInput);
      
      distributionSliders.appendChild(sliderContainer);
    });
    
    // Total percentage display
    const totalDisplay = document.createElement('div');
    totalDisplay.style.display = 'flex';
    totalDisplay.style.justifyContent = 'space-between';
    totalDisplay.style.alignItems = 'center';
    totalDisplay.style.marginTop = '15px';
    totalDisplay.style.padding = '10px';
    totalDisplay.style.background = 'rgba(15, 23, 42, 0.6)';
    totalDisplay.style.borderRadius = '8px';
    
    const totalLabel = document.createElement('span');
    totalLabel.style.fontSize = '14px';
    totalLabel.style.fontWeight = '600';
    totalLabel.style.color = '#ffffff';
    totalLabel.textContent = 'Total';
    
    const totalPercentage = document.createElement('span');
    totalPercentage.id = 'total-percentage';
    totalPercentage.style.fontSize = '16px';
    totalPercentage.style.fontWeight = '700';
    const totalPercent = Object.values(this.titheDistribution).reduce((sum, val) => sum + val, 0);
    totalPercentage.style.color = totalPercent === 100 ? '#10b981' : '#ef4444';
    totalPercentage.textContent = `${totalPercent}%`;
    
    totalDisplay.appendChild(totalLabel);
    totalDisplay.appendChild(totalPercentage);
    
    // Equal distribution button
    const equalDistributionButton = document.createElement('button');
    equalDistributionButton.className = 'futuristic-button';
    equalDistributionButton.style.width = '100%';
    equalDistributionButton.style.marginTop = '15px';
    equalDistributionButton.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1))';
    equalDistributionButton.textContent = 'Distribute Equally';
    
    equalDistributionButton.addEventListener('click', () => {
      this.distributeEqually();
    });
    
    titheDistributionSection.appendChild(titheLabel);
    titheDistributionSection.appendChild(distributionInstructions);
    titheDistributionSection.appendChild(distributionGraph);
    titheDistributionSection.appendChild(distributionSliders);
    titheDistributionSection.appendChild(totalDisplay);
    titheDistributionSection.appendChild(equalDistributionButton);
    
    rightColumn.appendChild(titheDistributionSection);
    
    // Payment notes
    const notesSection = document.createElement('div');
    notesSection.style.marginTop = '20px';
    
    const notesLabel = document.createElement('label');
    notesLabel.style.display = 'block';
    notesLabel.style.fontSize = '16px';
    notesLabel.style.fontWeight = '600';
    notesLabel.style.color = '#ffffff';
    notesLabel.style.marginBottom = '12px';
    notesLabel.textContent = 'Notes (Optional)';
    
    const notesTextarea = document.createElement('textarea');
    notesTextarea.id = 'notes-input';
    notesTextarea.placeholder = 'Add any additional information...';
    notesTextarea.className = 'futuristic-input';
    notesTextarea.style.width = '100%';
    notesTextarea.style.padding = '15px';
    notesTextarea.style.background = 'rgba(15, 23, 42, 0.6)';
    notesTextarea.style.border = '1px solid rgba(6, 182, 212, 0.3)';
    notesTextarea.style.borderRadius = '12px';
    notesTextarea.style.color = '#ffffff';
    notesTextarea.style.fontSize = '16px';
    notesTextarea.style.resize = 'vertical';
    notesTextarea.style.minHeight = '100px';
    notesTextarea.style.transition = 'all 0.3s ease';
    
    // Focus effect
    notesTextarea.addEventListener('focus', () => {
      notesTextarea.style.boxShadow = '0 0 0 2px rgba(6, 182, 212, 0.3)';
      notesTextarea.style.border = '1px solid rgba(6, 182, 212, 0.5)';
    });
    
    notesTextarea.addEventListener('blur', () => {
      notesTextarea.style.boxShadow = 'none';
      notesTextarea.style.border = '1px solid rgba(6, 182, 212, 0.3)';
    });
    
    notesSection.appendChild(notesLabel);
    notesSection.appendChild(notesTextarea);
    
    // Payment button is common for both columns on mobile
    const paymentButton = document.createElement('button');
    paymentButton.id = 'payment-button';
    paymentButton.className = 'futuristic-button';
    paymentButton.style.width = '100%';
    paymentButton.style.padding = '18px';
    paymentButton.style.marginTop = '30px';
    paymentButton.style.fontSize = '18px';
    paymentButton.style.fontWeight = '600';
    paymentButton.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.8), rgba(8, 145, 178, 0.6))';
    paymentButton.textContent = 'Make Payment';
    
    // Add payment event
    paymentButton.addEventListener('click', () => {
      this.processPayment();
    });
    
    rightColumn.appendChild(notesSection);
    
    // Add columns to form
    formContent.appendChild(leftColumn);
    formContent.appendChild(rightColumn);
    
    // Error/success message area
    const messageArea = document.createElement('div');
    messageArea.id = 'message-area';
    messageArea.style.marginTop = '20px';
    messageArea.style.display = 'none';
    
    // Payment button container (for uniform center alignment on mobile)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.textAlign = 'center';
    
    buttonContainer.appendChild(paymentButton);
    
    // Assemble form
    formSection.appendChild(formHeader);
    formSection.appendChild(formContent);
    formSection.appendChild(messageArea);
    formSection.appendChild(buttonContainer);
    
    return formSection;
  }
  
  setPaymentType(type) {
    this.paymentType = type;
    
    // Update UI
    const paymentTypeCards = document.querySelectorAll('.payment-type-card');
    paymentTypeCards.forEach(card => {
      if (card.dataset.type === type) {
        card.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.1))';
        card.style.border = '1px solid rgba(6, 182, 212, 0.3)';
        const typeName = card.querySelector('div:last-child');
        if (typeName) typeName.style.color = '#ffffff';
      } else {
        card.style.background = 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(30, 41, 59, 0.2))';
        card.style.border = '1px solid rgba(30, 41, 59, 0.6)';
        const typeName = card.querySelector('div:last-child');
        if (typeName) typeName.style.color = '#e2e8f0';
      }
    });
    
    // Show/hide tithe distribution section
    const titheDistributionSection = document.getElementById('tithe-distribution-section');
    if (titheDistributionSection) {
      titheDistributionSection.style.display = type === 'TITHE' ? 'block' : 'none';
    }
    
    // Show/hide special offering section
    const specialOfferingSection = document.getElementById('special-offering-section');
    if (specialOfferingSection) {
      specialOfferingSection.style.display = type === 'SPECIAL' ? 'block' : 'none';
    }
    
    // Update special offerings list if needed
    if (type === 'SPECIAL' && !this.isLoadingSpecial) {
      this.updateSpecialOfferingsUI();
    }
  }
  
  updateSpecialOfferingsUI() {
    const specialOfferingsContainer = document.getElementById('special-offerings-container');
    if (!specialOfferingsContainer) return;
    
    // Clear previous content
    specialOfferingsContainer.innerHTML = '';
    
    if (this.isLoadingSpecial) {
      // Show loading spinner
      const loadingDiv = document.createElement('div');
      loadingDiv.style.display = 'flex';
      loadingDiv.style.alignItems = 'center';
      loadingDiv.style.justifyContent = 'center';
      loadingDiv.style.padding = '20px 0';
      
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      spinner.style.width = '30px';
      spinner.style.height = '30px';
      
      loadingDiv.appendChild(spinner);
      specialOfferingsContainer.appendChild(loadingDiv);
    } else if (!this.specialOfferings || this.specialOfferings.length === 0) {
      // Show empty state
      const emptyMessage = document.createElement('div');
      emptyMessage.style.background = 'rgba(15, 23, 42, 0.6)';
      emptyMessage.style.padding = '15px';
      emptyMessage.style.borderRadius = '10px';
      emptyMessage.style.textAlign = 'center';
      emptyMessage.style.color = '#e2e8f0';
      emptyMessage.textContent = 'No special offerings available at this time.';
      
      specialOfferingsContainer.appendChild(emptyMessage);
    } else {
      // Create special offering options with custom designs
      this.specialOfferings.forEach((offering, index) => {
        const offeringName = offering.name || offering.description || this.formatSpecialOfferingName(offering.offeringType);
        
        // Calculate progress percentage if available
        let progressPercentage = 0;
        if (offering.targetGoal && offering.totalContributed) {
          progressPercentage = Math.min(100, Math.round((offering.totalContributed / offering.targetGoal) * 100));
        }
        
        // Determine color based on offering type or progress
        let offeringColor = this.getOfferingColor(offering.offeringType);
        
        // Create offering card
        const offeringCard = document.createElement('div');
        offeringCard.className = 'special-offering-card';
        offeringCard.dataset.type = offering.offeringType;
        offeringCard.style.background = this.specialOfferingType === offering.offeringType ?
          `linear-gradient(135deg, ${offeringColor}40, ${offeringColor}20)` :
          'linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(30, 41, 59, 0.4))';
        offeringCard.style.border = this.specialOfferingType === offering.offeringType ?
          `1px solid ${offeringColor}40` :
          '1px solid rgba(30, 41, 59, 0.8)';
        offeringCard.style.borderRadius = '12px';
        offeringCard.style.padding = '15px';
        offeringCard.style.cursor = 'pointer';
        offeringCard.style.transition = 'all 0.3s ease';
        offeringCard.style.position = 'relative';
        offeringCard.style.overflow = 'hidden';
        
        // Inner content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.style.position = 'relative';
        contentWrapper.style.zIndex = '2';
        
        // Offering icon and name
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'space-between';
        headerRow.style.alignItems = 'center';
        headerRow.style.marginBottom = '10px';
        
        const iconNameDiv = document.createElement('div');
        iconNameDiv.style.display = 'flex';
        iconNameDiv.style.alignItems = 'center';
        iconNameDiv.style.gap = '8px';
        
        const offeringIcon = document.createElement('span');
        offeringIcon.style.fontSize = '18px';
        offeringIcon.textContent = '✨';
        
        const nameText = document.createElement('span');
        nameText.style.fontSize = '15px';
        nameText.style.fontWeight = '600';
        nameText.style.color = this.specialOfferingType === offering.offeringType ? '#ffffff' : '#e2e8f0';
        nameText.textContent = offeringName;
        
        iconNameDiv.appendChild(offeringIcon);
        iconNameDiv.appendChild(nameText);
        
        // End date if available
        let endDateText = null;
        if (offering.endDate) {
          const endDate = new Date(offering.endDate);
          const formattedDate = endDate.toLocaleDateString();
          
          endDateText = document.createElement('span');
          endDateText.style.fontSize = '12px';
          endDateText.style.color = '#94a3b8';
          endDateText.textContent = `Ends: ${formattedDate}`;
        }
        
        headerRow.appendChild(iconNameDiv);
        if (endDateText) headerRow.appendChild(endDateText);
        
        // Progress bar if there's a target goal
        let progressElement = null;
        if (offering.targetGoal && offering.targetGoal > 0) {
          progressElement = document.createElement('div');
          progressElement.style.marginTop = '8px';
          
          const progressBar = document.createElement('div');
          progressBar.style.height = '6px';
          progressBar.style.background = 'rgba(15, 23, 42, 0.5)';
          progressBar.style.borderRadius = '3px';
          progressBar.style.overflow = 'hidden';
          
          const progressFill = document.createElement('div');
          progressFill.style.height = '100%';
          progressFill.style.width = `${progressPercentage}%`;
          progressFill.style.background = offeringColor;
          progressFill.style.borderRadius = '3px';
          
          const progressText = document.createElement('div');
          progressText.style.display = 'flex';
          progressText.style.justifyContent = 'space-between';
          progressText.style.fontSize = '12px';
          progressText.style.marginTop = '4px';
          
          const percentText = document.createElement('span');
          percentText.style.color = offeringColor;
          percentText.textContent = `${progressPercentage}%`;
          
          const amountText = document.createElement('span');
          amountText.style.color = '#94a3b8';
          amountText.textContent = `KES ${offering.totalContributed?.toLocaleString() || 0} / ${offering.targetGoal.toLocaleString()}`;
          
          progressText.appendChild(percentText);
          progressText.appendChild(amountText);
          
          progressBar.appendChild(progressFill);
          progressElement.appendChild(progressBar);
          progressElement.appendChild(progressText);
        }
        
        // Add selection functionality
        offeringCard.addEventListener('click', () => {
          this.selectSpecialOffering(offering.offeringType);
        });
        
        // Assemble offering card
        contentWrapper.appendChild(headerRow);
        if (progressElement) contentWrapper.appendChild(progressElement);
        offeringCard.appendChild(contentWrapper);
        
        // Add subtle glow effect on bottom right
        const glowEffect = document.createElement('div');
        glowEffect.style.position = 'absolute';
        glowEffect.style.bottom = '-20px';
        glowEffect.style.right = '-20px';
        glowEffect.style.width = '100px';
        glowEffect.style.height = '100px';
        glowEffect.style.borderRadius = '50%';
        glowEffect.style.background = `radial-gradient(circle, ${offeringColor}30 0%, transparent 70%)`;
        glowEffect.style.opacity = this.specialOfferingType === offering.offeringType ? '1' : '0.5';
        glowEffect.style.transition = 'all 0.3s ease';
        
        offeringCard.appendChild(glowEffect);
        
        specialOfferingsContainer.appendChild(offeringCard);
      });
    }
  }
  
  selectSpecialOffering(offeringType) {
    this.specialOfferingType = offeringType;
    
    // Update UI
    const offeringCards = document.querySelectorAll('.special-offering-card');
    offeringCards.forEach(card => {
      const type = card.dataset.type;
      const color = this.getOfferingColor(type);
      
      if (type === offeringType) {
        card.style.background = `linear-gradient(135deg, ${color}40, ${color}20)`;
        card.style.border = `1px solid ${color}40`;
        const nameText = card.querySelector('div > div > span:last-child');
        if (nameText) nameText.style.color = '#ffffff';
        
        // Enhance glow effect
        const glow = card.querySelector('div:last-child');
        if (glow) glow.style.opacity = '1';
      } else {
        card.style.background = 'linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(30, 41, 59, 0.4))';
        card.style.border = '1px solid rgba(30, 41, 59, 0.8)';
        const nameText = card.querySelector('div > div > span:last-child');
        if (nameText) nameText.style.color = '#e2e8f0';
        
        // Reduce glow effect
        const glow = card.querySelector('div:last-child');
        if (glow) glow.style.opacity = '0.5';
      }
    });
  }
  
  adjustTitheDistribution(department, percentage) {
    // Store previous value for adjustment
    const previousValue = this.titheDistribution[department];
    
    // Update the value for this department
    this.titheDistribution[department] = percentage;
    
    // Calculate new total
    const total = Object.values(this.titheDistribution).reduce((sum, val) => sum + val, 0);
    
    // If total exceeds 100%, adjust other departments
    if (total > 100) {
      const excess = total - 100;
      const diff = percentage - previousValue;
      
      // If this is an increase, reduce other departments proportionally
      if (diff > 0) {
        // Get other departments that have non-zero values
        const otherDepts = Object.keys(this.titheDistribution).filter(dept => 
          dept !== department && this.titheDistribution[dept] > 0
        );
        
        if (otherDepts.length > 0) {
          // Calculate how much to reduce each department
          const totalOtherValues = otherDepts.reduce((sum, dept) => sum + this.titheDistribution[dept], 0);
          
          // Reduce each department proportionally
          otherDepts.forEach(dept => {
            const proportion = this.titheDistribution[dept] / totalOtherValues;
            const reduction = Math.min(this.titheDistribution[dept], Math.round(excess * proportion));
            this.titheDistribution[dept] -= reduction;
          });
        } else {
          // If no other departments have values, reduce this one
          this.titheDistribution[department] = 100;
        }
      }
    }
    
    // Update the UI to reflect changes
    this.updateTitheDistributionUI();
    this.updateTitheDistributionAmounts();
  }
  
  distributeEqually() {
    // Calculate equal share (handle rounding)
    const departments = Object.keys(this.titheDistribution);
    const equalShare = Math.floor(100 / departments.length);
    const remainder = 100 - (equalShare * departments.length);
    
    // Set equal values for all departments
    departments.forEach((dept, index) => {
      // Add remainder to the first department to ensure total is exactly 100%
      this.titheDistribution[dept] = (index === 0) ? equalShare + remainder : equalShare;
    });
    
    // Update UI
    this.updateTitheDistributionUI();
    this.updateTitheDistributionAmounts();
  }
  
  updateTitheDistributionUI() {
    // Update sliders and percentage displays
    Object.entries(this.titheDistribution).forEach(([dept, percentage]) => {
      // Update slider value
      const slider = document.querySelector(`.distribution-slider.${dept.toLowerCase()}`);
      if (slider) slider.value = percentage;
      
      // Update percentage display
      const percentageDisplay = document.querySelector(`.percentage-display.${dept.toLowerCase()}`);
      if (percentageDisplay) percentageDisplay.textContent = `${percentage}%`;
      
      // Update distribution bar
      const distributionBar = document.querySelector(`.distribution-bar.${dept.toLowerCase()}`);
      if (distributionBar) {
        // If percentage is 0, hide the bar
        if (percentage === 0) {
          distributionBar.style.display = 'none';
        } else {
          distributionBar.style.display = 'block';
          
          // Calculate positions for bars based on cumulative percentages
          let cumulativePercentage = 0;
          Object.entries(this.titheDistribution).forEach(([d, p]) => {
            if (d === dept) return; // Skip current department
            if (this.getDepartmentOrder(d) < this.getDepartmentOrder(dept)) {
              cumulativePercentage += p;
            }
          });
          
          distributionBar.style.left = `${cumulativePercentage}%`;
          distributionBar.style.width = `${percentage}%`;
        }
      }
    });
    
    // Update total percentage
    const totalPercent = Object.values(this.titheDistribution).reduce((sum, val) => sum + val, 0);
    const totalPercentageDisplay = document.getElementById('total-percentage');
    if (totalPercentageDisplay) {
      totalPercentageDisplay.textContent = `${totalPercent}%`;
      totalPercentageDisplay.style.color = totalPercent === 100 ? '#10b981' : '#ef4444';
    }
  }
  
  updateTitheDistributionAmounts() {
    // Only update if amount is set and tithe is selected
    if (this.paymentType === 'TITHE' && this.amount > 0) {
      Object.entries(this.titheDistribution).forEach(([dept, percentage]) => {
        const deptAmount = (this.amount * percentage / 100).toFixed(2);
        
        // Update amount display
        const amountDisplay = document.querySelector(`.amount-display.${dept.toLowerCase()}`);
        if (amountDisplay) {
          amountDisplay.textContent = `(KES ${deptAmount})`;
        }
      });
    }
  }
  
  getDepartmentOrder(department) {
    // Define the order for positioning bars in the distribution graph
    const order = {
      GENERAL: 1,
      MUSIC: 2,
      CHILDREN: 3,
      YOUTH: 4,
      EDUCATION: 5,
      MAINTENANCE: 6,
      DEVELOPMENT: 7,
      OTHER: 8
    };
    
    return order[department] || 999;
  }
  
  getOfferingColor(offeringType) {
    // Extract the offering type for special offerings
    const type = offeringType.startsWith('SPECIAL_') ? offeringType.split('_')[1] : offeringType;
    
    // Color palette for different offerings
    const colors = {
      BUILDING: '#8b5cf6', // Purple
      MISSION: '#06b6d4', // Cyan
      CHARITY: '#10b981', // Green
      YOUTH: '#f59e0b', // Amber
      EDUCATION: '#3b82f6', // Blue
      EQUIPMENT: '#ef4444', // Red
      COMMUNITY: '#ec4899', // Pink
      DEVELOPMENT: '#0ea5e9', // Sky blue
      OTHER: '#64748b', // Slate
      DEFAULT: '#06b6d4' // Default cyan
    };
    
    return colors[type] || colors.DEFAULT;
  }
  
  async processPayment() {
    try {
      // Validate input
      if (!this.validatePayment()) {
        return;
      }
      
      // Show loading state
      this.setPaymentButtonLoading(true);
      
      // Prepare payment data
      const paymentData = this.preparePaymentData();
      
      // Call API to initiate payment
      const response = await this.queueApiRequest(() => 
        this.apiService.initiatePayment(paymentData)
      );
      
      // Check response
      if (response && response.success) {
        // Handle successful initiation - show prompt message
        this.showMessage('Payment initiated. Check your phone for the M-Pesa prompt.', 'success');
        
        // Poll for payment status
        this.pollPaymentStatus(response.checkoutRequestId);
      } else {
        throw new Error(response?.message || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      this.showMessage(`Payment failed: ${error.message}`, 'error');
      this.setPaymentButtonLoading(false);
    }
  }
  
  validatePayment() {
    // Clear previous messages
    this.clearMessages();
    
    // Validate amount
    if (!this.amount || this.amount <= 0) {
      this.showMessage('Please enter a valid amount', 'error');
      return false;
    }
    
    // Validate phone number
    if (!this.phoneNumber || !this.validatePhoneNumber(this.phoneNumber)) {
      this.showMessage('Please enter a valid phone number starting with 254', 'error');
      return false;
    }
    
    // Validate special offering selection
    if (this.paymentType === 'SPECIAL' && !this.specialOfferingType) {
      this.showMessage('Please select a special offering', 'error');
      return false;
    }
    
    // Validate tithe distribution for tithe payments
    if (this.paymentType === 'TITHE') {
      const totalPercent = Object.values(this.titheDistribution).reduce((sum, val) => sum + val, 0);
      if (totalPercent !== 100) {
        this.showMessage('Tithe distribution must total exactly 100%', 'error');
        return false;
      }
    }
    
    return true;
  }
  
  validatePhoneNumber(phone) {
    // Basic validation for Kenyan phone numbers
    const phoneRegex = /^254\d{9}$/;
    return phoneRegex.test(phone);
  }
  
  preparePaymentData() {
    // Get notes if any
    const notesInput = document.getElementById('notes-input');
    const notes = notesInput ? notesInput.value : '';
    
    // Basic payment data
    const paymentData = {
      amount: this.amount,
      phoneNumber: this.phoneNumber,
      paymentMethod: 'MPESA',
      description: notes || `${this.formatPaymentType(this.paymentType)} payment`,
      paymentType: this.paymentType
    };
    
    // Add special offering type if applicable
    if (this.paymentType === 'SPECIAL' && this.specialOfferingType) {
      paymentData.paymentType = this.specialOfferingType;
    }
    
    // Add tithe distribution if applicable
    if (this.paymentType === 'TITHE') {
      paymentData.titheDistribution = { ...this.titheDistribution };
    }
    
    return paymentData;
  }
  
  async pollPaymentStatus(checkoutRequestId, attempts = 0) {
    // Maximum polling attempts (30 seconds * 10 attempts = 5 minutes)
    const maxAttempts = 10;
    
    if (attempts >= maxAttempts) {
      this.showMessage('Payment status check timed out. Please check your M-Pesa messages.', 'info');
      this.setPaymentButtonLoading(false);
      return;
    }
    
    try {
      // Wait 30 seconds before checking (typical M-Pesa processing time)
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Check payment status
      const statusResponse = await this.queueApiRequest(() => 
        this.apiService.get(`/payment/status/${checkoutRequestId}`)
      );
      
      if (statusResponse && statusResponse.success) {
        if (statusResponse.status === 'COMPLETED') {
          // Payment successful
          this.showMessage('Payment successful! Thank you for your contribution.', 'success');
          this.setPaymentButtonLoading(false);
          
          // Reset form
          this.resetForm();
        } else if (statusResponse.status === 'FAILED' || statusResponse.status === 'CANCELLED') {
          // Payment failed
          this.showMessage(`Payment ${statusResponse.status.toLowerCase()}: ${statusResponse.resultDescription || 'Transaction was not completed'}`, 'error');
          this.setPaymentButtonLoading(false);
        } else {
          // Still pending, continue polling
          console.log(`Payment still processing, attempt ${attempts + 1} of ${maxAttempts}`);
          this.pollPaymentStatus(checkoutRequestId, attempts + 1);
        }
      } else {
        // Error getting status, continue polling
        console.warn('Error checking payment status, retrying...');
        this.pollPaymentStatus(checkoutRequestId, attempts + 1);
      }
    } catch (error) {
      console.error('Error polling payment status:', error);
      this.pollPaymentStatus(checkoutRequestId, attempts + 1);
    }
  }
  
  resetForm() {
    // Reset state
    this.amount = 0;
    this.specialOfferingType = '';
    
    // Reset form fields
    const amountInput = document.getElementById('amount-input');
    if (amountInput) amountInput.value = '';
    
    const notesInput = document.getElementById('notes-input');
    if (notesInput) notesInput.value = '';
    
    // Reset tithe distribution to default
    this.titheDistribution = {
      GENERAL: 100,
      MUSIC: 0,
      CHILDREN: 0,
      YOUTH: 0,
      EDUCATION: 0,
      MAINTENANCE: 0,
      DEVELOPMENT: 0,
      OTHER: 0
    };
    
    // Update UI
    this.updateTitheDistributionUI();
    
    // Reset special offering selection
    const offeringCards = document.querySelectorAll('.special-offering-card');
    offeringCards.forEach(card => {
      card.style.background = 'linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(30, 41, 59, 0.4))';
      card.style.border = '1px solid rgba(30, 41, 59, 0.8)';
      const nameText = card.querySelector('div > div > span:last-child');
      if (nameText) nameText.style.color = '#e2e8f0';
      
      const glow = card.querySelector('div:last-child');
      if (glow) glow.style.opacity = '0.5';
    });
  }
  
  setPaymentButtonLoading(isLoading) {
    const paymentButton = document.getElementById('payment-button');
    if (!paymentButton) return;
    
    if (isLoading) {
      paymentButton.disabled = true;
      paymentButton.innerHTML = '<div class="button-spinner"></div> Processing...';
      paymentButton.style.opacity = '0.8';
    } else {
      paymentButton.disabled = false;
      paymentButton.innerHTML = 'Make Payment';
      paymentButton.style.opacity = '1';
    }
  }
  
  showMessage(message, type = 'info') {
    const messageArea = document.getElementById('message-area');
    if (!messageArea) return;
    
    // Set background color based on message type
    let bgColor, textColor, borderColor;
    switch (type) {
      case 'success':
        bgColor = 'rgba(16, 185, 129, 0.2)';
        textColor = '#10b981';
        borderColor = 'rgba(16, 185, 129, 0.3)';
        break;
      case 'error':
        bgColor = 'rgba(239, 68, 68, 0.2)';
        textColor = '#ef4444';
        borderColor = 'rgba(239, 68, 68, 0.3)';
        break;
      case 'warning':
        bgColor = 'rgba(245, 158, 11, 0.2)';
        textColor = '#f59e0b';
        borderColor = 'rgba(245, 158, 11, 0.3)';
        break;
      default: // info
        bgColor = 'rgba(59, 130, 246, 0.2)';
        textColor = '#3b82f6';
        borderColor = 'rgba(59, 130, 246, 0.3)';
    }
    
    // Set styles
    messageArea.style.display = 'block';
    messageArea.style.padding = '15px 20px';
    messageArea.style.borderRadius = '10px';
    messageArea.style.background = bgColor;
    messageArea.style.color = textColor;
    messageArea.style.border = `1px solid ${borderColor}`;
    messageArea.textContent = message;
  }
  
  clearMessages() {
    const messageArea = document.getElementById('message-area');
    if (messageArea) {
      messageArea.style.display = 'none';
      messageArea.textContent = '';
    }
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
      case 'SPECIAL':
        return 'Special Offering';
      default:
        return type;
    }
  }
  
  formatSpecialOfferingName(type) {
    if (!type) return 'Unknown';
    
    if (!type.startsWith('SPECIAL_')) {
      return type;
    }
    
    const name = type.replace('SPECIAL_', '');
    
    // Handle common special offering types
    switch (name) {
      case 'BUILDING':
        return 'Building Fund';
      case 'MISSION':
        return 'Mission Trip';
      case 'CHARITY':
        return 'Charity Drive';
      case 'YOUTH':
        return 'Youth Program';
      case 'EDUCATION':
        return 'Education Fund';
      case 'EQUIPMENT':
        return 'Equipment Purchase';
      case 'COMMUNITY':
        return 'Community Outreach';
      case 'DEVELOPMENT':
        return 'Development Program';
      case 'OTHER':
        return 'Special Offering';
      default:
        // Convert SNAKE_CASE to Title Case
        return name.split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
    }
  }
  
  formatDepartment(department) {
    if (!department) return 'Unknown';

    switch (department) {
      case 'GENERAL':
        return 'General Fund';
      case 'MUSIC':
        return 'Music Ministry';
      case 'CHILDREN':
        return 'Children\'s Ministry';
      case 'YOUTH':
        return 'Youth Ministry';
      case 'EDUCATION':
        return 'Education';
      case 'MAINTENANCE':
        return 'Maintenance';
      case 'DEVELOPMENT':
        return 'Development';
      case 'OTHER':
        return 'Other';
      default:
        return department;
    }
  }
  
  addGlobalStyles() {
    if (!document.getElementById('make-payments-global-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'make-payments-global-styles';
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
          background: rgba(6, 182, 212, 0.5);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.8);
        }
        
        .neo-card {
          position: relative;
          backdrop-filter: blur(16px);
          background: rgba(15, 23, 42, 0.75);
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
        
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
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
        
        .futuristic-button:not(:disabled):hover {
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.2));
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        }
        
        .futuristic-button:not(:disabled):hover::before {
          left: 100%;
        }
        
        .futuristic-button:not(:disabled):active {
          transform: translateY(1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) inset;
        }
        
        .futuristic-input {
          transition: all 0.3s ease;
        }
        
        .futuristic-input:focus {
          outline: none;
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
        
        .animated-item {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: rgba(15, 23, 42, 0.6);
          height: 6px;
          border-radius: 3px;
          margin: 10px 0;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
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
        
        .button-spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          position: relative;
        }
        
        .button-spinner:after {
          content: " ";
          display: block;
          width: 16px;
          height: 16px;
          margin: 2px;
          border-radius: 50%;
          border: 2px solid transparent;
          border-top-color: #ffffff;
          border-left-color: #ffffff;
          animation: spinner 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
        }
        
        /* Mobile responsive styles */
        @media (max-width: 768px) {
          .mobile-menu-button {
            display: block !important;
          }
          
          .mobile-menu {
            display: none;
          }
          
          nav div:nth-child(2) {
            display: none;
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
    
    // Add particle overlay (only if not already present)
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
    
    // Add additional lens flares/highlights
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
}