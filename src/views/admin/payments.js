// src/views/admin/payments.js
import { BaseComponent } from '../../utils/BaseComponent.js';

export class AdminPaymentsView extends BaseComponent {
  constructor() {
    super();
    this.title = 'Payment Management';
    this.user = this.authService ? this.authService.getUser() : null;
    this.apiService = window.apiService;
    this.payments = [];
    this.specialOfferings = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalPayments = 0;
    this.isLoading = true;
    this.error = null;
    this.success = null;
    this.filters = {
      startDate: '',
      endDate: '',
      paymentType: '',
      userId: '',
      specialOffering: ''
    };
    this.selectedPayment = null;
    
    // API Request Management - Adding throttling to match dashboard
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 300; // ms between API calls
    
    // Data Cache System
    this.paymentCache = {};
    this.specialOfferingsCache = null;
    this.lastFetchTime = null;
    this.CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes
    this.SMS_STATUS = { sending: false, error: null, success: null };
    
    // Debounce timer for filters
    this.filterDebounceTimer = null;
    this.FILTER_DEBOUNCE_DELAY = 500; // ms
    
    // State flag to prevent double rendering
    this.isRendering = false;

    // Add sorting configuration
    this.sortConfig = {
      field: 'id',
      direction: 'desc'
    };
    
    // Add responsive breakpoints
    this.breakpoints = {
      mobile: 768,
      tablet: 1024
    };
    
    // Add viewport tracking
    this.viewport = {
      width: window.innerWidth,
      isMobile: window.innerWidth < 768,
      isTablet: window.innerWidth >= 768 && window.innerWidth < 1024
    };
    
    // Add loading optimization
    this.pageSize = this.viewport.isMobile ? 10 : 20;
    this.lazyLoadThreshold = 500;

    // Add resize handler binding after method definition 
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }
  
  handleResize() {
    const width = window.innerWidth;
    this.viewport = {
        width,
        isMobile: width < this.breakpoints.mobile,
        isTablet: width >= this.breakpoints.mobile && width < this.breakpoints.tablet
    };
    
    // Update page size based on viewport
    this.pageSize = this.viewport.isMobile ? 10 : 20;
    
    // Trigger re-render if needed
    if (this.isRendered) {
        this.updateView();
    }
  }

  async render() {
    // Prevent re-entry during rendering
    if (this.isRendering) {
      console.log('Render already in progress, skipping');
      return;
    }
    
    this.isRendering = true;
    console.log('Rendering AdminPaymentsView');
    
    try {
      // Check if user is admin
      if (!this.authService.isAdmin()) {
        this.isRendering = false;
        return this.renderUnauthorized();
      }
      
      // Add the futuristic background and particle overlay to match dashboard
      this.addBackgroundEffects();
      
      // Create container
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

      // Add navigation at the very top
      container.appendChild(this.renderTopNavigation());
      
      // Add page title
      container.appendChild(this.renderPageHeader());
      
      // Show error or success messages if any
      if (this.error) {
        container.appendChild(this.renderAlert('error', this.error));
      }
      
      
      if (this.success) {
        container.appendChild(this.renderAlert('success', this.success));
      }
      
      // Filters card with enhanced UI to match dashboard
      container.appendChild(this.renderFiltersCard());
      
      // Track if data fetch was initiated
      let fetchInitiated = false;
      
      // Payments table or loading indicator
      if (this.isLoading) {
        container.appendChild(this.renderLoading());
        
        // Only fetch if we don't have an in-progress fetch
        if (!this._fetchInProgress) {
          // Set flag before fetching to prevent duplicate requests
          this._fetchInProgress = true;
          fetchInitiated = true;
          
          // Fetch data without awaiting to prevent blocking render
          this.fetchPayments(this.currentPage);
          this.fetchSpecialOfferings();
        }
      } else {
        container.appendChild(this.renderPaymentsTable());
      }
      
      // Payment detail modal (hidden initially)
      container.appendChild(this.renderPaymentDetailModal());
      
      // SMS Status Modal
      container.appendChild(this.renderSmsStatusModal());
      
      // Add required styles
      this.addGlobalStyles();
      this.addAnimationStyles();
      
      // Attach event listeners after the DOM is ready
      setTimeout(() => {
        this.attachEventListeners();
      }, 0);
      
      // Reset rendering flag before returning
      this.isRendering = false;
      
      console.log('Render complete');
      return container;
    } catch (error) {
      console.error('Render error:', error);
      this.isRendering = false;
      return this.renderError(error);
    }
  }
  
  addBackgroundEffects() {
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
  }
  
  renderPageHeader() {
    const headerSection = this.createElement('div', {
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
    const headerGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.3), transparent 70%)'
      }
    });
    headerSection.appendChild(headerGlow);
    
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
      headerSection.appendChild(particle);
    }
    
    const headerContent = this.createElement('div', {
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
    
    // Improved header title with better visibility
    const headerTitle = this.createElement('h1', {
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
    }, 'Payment Management');
    
    // Add export buttons
    const exportButtonsGroup = this.createElement('div', {
      style: {
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap'
      }
    });
    
    // Export as CSV button
    const exportCsvButton = this.createFuturisticButton('Export as CSV', '#10b981', () => this.exportPayments('csv'));
    exportCsvButton.prepend(this.createSvgIcon('csv'));
    
    // Export as PDF button
    const exportPdfButton = this.createFuturisticButton('Export as PDF', '#ef4444', () => this.exportPayments('pdf'));
    exportPdfButton.prepend(this.createSvgIcon('pdf'));
    
    // Export filtered results button
    const exportFilteredButton = this.createFuturisticButton('Export Filtered Results', '#4f46e5', () => this.exportFilteredResults());
    exportFilteredButton.prepend(this.createSvgIcon('filter'));
    
    exportButtonsGroup.appendChild(exportCsvButton);
    exportButtonsGroup.appendChild(exportPdfButton);
    exportButtonsGroup.appendChild(exportFilteredButton);
    
    headerContent.appendChild(headerTitle);
    headerContent.appendChild(exportButtonsGroup);
    
    headerSection.appendChild(headerContent);
    
    return headerSection;
  }
  
  createFuturisticButton(text, color, onClick) {
    const hexColor = color || '#3b82f6';
    const button = this.createElement('button', {
      className: 'futuristic-button',
      style: {
        background: `linear-gradient(135deg, rgba(${this.hexToRgb(hexColor)}, 0.2), rgba(${this.hexToRgb(hexColor)}, 0.1))`,
        border: `1px solid rgba(${this.hexToRgb(hexColor)}, 0.3)`,
      },
      onClick: onClick
    }, text);
    
    return button;
  }
  
  createSvgIcon(type) {
    const iconWrapper = this.createElement('span', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '8px'
      }
    });
    
    let svgContent = '';
    
    switch(type) {
      case 'csv':
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <line x1="10" y1="9" x2="8" y2="9"></line>
          </svg>
        `;
        break;
      case 'pdf':
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M9 15H7v-2h2v2z"></path>
            <path d="M13 15h-2v-2h2v2z"></path>
            <path d="M17 15h-2v-2h2v2z"></path>
          </svg>
        `;
        break;
      case 'filter':
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
        `;
        break;
      case 'eye':
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
        break;
      case 'sms':
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        `;
        break;
      case 'download':
        svgContent = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        `;
        break;
      default:
        svgContent = '';
    }
    
    iconWrapper.innerHTML = svgContent;
    return iconWrapper;
  }
  
  renderAlert(type, message) {
    const alertConfig = {
      success: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        color: '#10b981',
        icon: `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        `
      },
      error: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        color: '#ef4444',
        icon: `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        `
      }
    };
    
    const config = alertConfig[type];
    
    const alertElement = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        backgroundColor: config.backgroundColor,
        borderLeft: `4px solid ${config.color}`,
        animation: 'fadeIn 0.3s ease-out'
      }
    });
    
    const iconSpan = this.createElement('span', {
      style: {
        color: config.color,
        flexShrink: 0,
        marginTop: '2px'
      }
    });
    
    iconSpan.innerHTML = config.icon;
    
    const messageSpan = this.createElement('span', {
      style: {
        color: '#f1f5f9',
        fontSize: '14px',
        lineHeight: '1.6'
      }
    }, message);
    
    alertElement.appendChild(iconSpan);
    alertElement.appendChild(messageSpan);
    
    return alertElement;
  }
  
  renderFiltersCard() {
    const filtersCard = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        marginBottom: '24px',
        animationDelay: '0.1s',
        overflow: 'hidden'
      }
    });
    
    // Add glow effect
    const filtersGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.2), transparent 70%)'
      }
    });
    filtersCard.appendChild(filtersGlow);
    
    const filtersHeader = this.createElement('div', {
      style: {
        padding: '16px 24px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    });
    
    const filtersTitle = this.createElement('h2', {
      style: {
        fontSize: '18px',
        fontWeight: '600',
        margin: '0',
        color: '#f1f5f9',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }
    }, 'Filter Payments');
    
    // Add filter icon
    const filterTitleIcon = this.createElement('span');
    filterTitleIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
    `;
    
    filtersTitle.prepend(filterTitleIcon);
    filtersHeader.appendChild(filtersTitle);
    filtersCard.appendChild(filtersHeader);
    
    const filtersContent = this.createElement('div', {
      style: {
        padding: '24px'
      }
    });
    
    const filtersForm = this.createElement('form', {
      id: 'payment-filters-form',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '20px'
      }
    });
    
    // Date range filters
    const startDateGroup = this.createFormGroup('Start Date', 'startDate', 'date');
    const startDateInput = startDateGroup.querySelector('input');
    startDateInput.value = this.filters.startDate;
    
    const endDateGroup = this.createFormGroup('End Date', 'endDate', 'date');
    const endDateInput = endDateGroup.querySelector('input');
    endDateInput.value = this.filters.endDate;
    
    // Payment type filter
    const paymentTypeGroup = this.createFormGroup('Payment Type', 'paymentType', 'select');
    const paymentTypeSelect = paymentTypeGroup.querySelector('select');
    
    // Add default option
    const defaultOption = this.createElement('option', {
      value: ''
    }, 'All Types');
    paymentTypeSelect.appendChild(defaultOption);
    
    // Add payment type options
    const paymentTypes = [
      { value: 'TITHE', label: 'Tithe' },
      { value: 'OFFERING', label: 'Offering' },
      { value: 'DONATION', label: 'Donation' },
      { value: 'EXPENSE', label: 'Expense' },
      { value: 'SPECIAL', label: 'Special Offerings' }
    ];
    
    paymentTypes.forEach(type => {
      const option = this.createElement('option', {
        value: type.value,
        selected: this.filters.paymentType === type.value
      }, type.label);
      paymentTypeSelect.appendChild(option);
    });
    
    // Special offerings dropdown (only visible when payment type is SPECIAL)
    const specialOfferingGroup = this.createFormGroup('Special Offering', 'specialOffering', 'select');
    specialOfferingGroup.style.display = this.filters.paymentType === 'SPECIAL' ? 'block' : 'none';
    
    const specialOfferingSelect = specialOfferingGroup.querySelector('select');
    
    // Add default option
    const allSpecialOption = this.createElement('option', {
      value: ''
    }, 'All Special Offerings');
    specialOfferingSelect.appendChild(allSpecialOption);
    
    // Will be populated after loading special offerings
    
    // Form actions
    const formActions = this.createElement('div', {
      style: {
        gridColumn: '1 / -1',
        display: 'flex',
        gap: '15px',
        justifyContent: 'flex-end',
        marginTop: '10px'
      }
    });
    
    const resetButton = this.createFuturisticButton('Reset Filters', '#64748b', () => this.resetFilters());
    
    const applyButton = this.createElement('button', {
      type: 'submit',
      className: 'futuristic-button',
      style: {
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(79, 70, 229, 0.1))',
        border: '1px solid rgba(79, 70, 229, 0.3)'
      }
    }, 'Apply Filters');
    
    formActions.appendChild(resetButton);
    formActions.appendChild(applyButton);
    
    // Assemble the filters form
    filtersForm.appendChild(startDateGroup);
    filtersForm.appendChild(endDateGroup);
    filtersForm.appendChild(paymentTypeGroup);
    filtersForm.appendChild(specialOfferingGroup);
    filtersForm.appendChild(formActions);
    
    filtersContent.appendChild(filtersForm);
    filtersCard.appendChild(filtersContent);
    
    return filtersCard;
  }
  
  createFormGroup(label, id, type) {
    const formGroup = this.createElement('div');
    
    const formLabel = this.createElement('label', {
      htmlFor: id,
      style: {
        display: 'block',
        fontSize: '14px',
        fontWeight: '500',
        color: '#94a3b8',
        marginBottom: '8px'
      }
    }, label);
    
    let inputElement;
    
    if (type === 'select') {
      inputElement = this.createElement('select', {
        id: id,
        name: id,
        className: 'form-control'
      });
    } else {
      inputElement = this.createElement('input', {
        id: id,
        name: id,
        type: type,
        className: 'form-control'
      });
    }
    
    formGroup.appendChild(formLabel);
    formGroup.appendChild(inputElement);
    
    return formGroup;
  }
  
  renderPaymentsTable() {
    const tableCard = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        animationDelay: '0.2s',
        overflow: 'hidden'
      }
    });
    
    // Add glow effect
    const tableGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.2), transparent 70%)'
      }
    });
    tableCard.appendChild(tableGlow);
    
    const tableHeader = this.createElement('div', {
      style: {
        padding: '16px 24px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    });
    
    const tableTitle = this.createElement('h2', {
      style: {
        fontSize: '18px',
        fontWeight: '600',
        margin: '0',
        color: '#f1f5f9',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }
    }, 'Payment Records');
    
    // Add payment icon
    const paymentIcon = this.createElement('span');
    paymentIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
        <line x1="1" y1="10" x2="23" y2="10"></line>
      </svg>
    `;
    
    tableTitle.prepend(paymentIcon);
    
    const paymentCount = this.createElement('span', {
      style: {
        fontSize: '14px',
        color: '#94a3b8'
      }
    }, `${this.totalPayments.toLocaleString()} total records`);
    
    tableHeader.appendChild(tableTitle);
    tableHeader.appendChild(paymentCount);
    
    tableCard.appendChild(tableHeader);
    
    // If no payments found
    if (this.payments.length === 0) {
      const emptyState = this.createElement('div', {
        style: {
          padding: '60px 20px',
          textAlign: 'center'
        }
      });
      
      const emptyIcon = this.createElement('div', {
        style: {
          margin: '0 auto 20px',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      });
      
      emptyIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 15h8"></path>
          <path d="M9 9h.01"></path>
          <path d="M15 9h.01"></path>
        </svg>
      `;
      
      const emptyText = this.createElement('h3', {
        style: {
          fontSize: '22px',
          fontWeight: '600',
          margin: '0 0 10px 0',
          color: '#f1f5f9'
        }
      }, 'No payments found');
      
      const emptySubtext = this.createElement('p', {
        style: {
          fontSize: '16px',
          color: '#94a3b8',
          margin: '0 0 30px 0',
          maxWidth: '500px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }
      }, 'Try adjusting your filters or add a new payment to get started');
      
      const addPaymentButton = this.createElement('a', {
        href: '/admin/add-payment',
        className: 'futuristic-button',
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(79, 70, 229, 0.1))',
          border: '1px solid rgba(79, 70, 229, 0.3)'
        }
      }, 'Add New Payment');
      
      // Add plus icon
      const plusIcon = this.createElement('span');
      plusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      `;
      
      addPaymentButton.prepend(plusIcon);
      
      emptyState.appendChild(emptyIcon);
      emptyState.appendChild(emptyText);
      emptyState.appendChild(emptySubtext);
      emptyState.appendChild(addPaymentButton);
      
      tableCard.appendChild(emptyState);
      
      return tableCard;
    }
    
    // Table container
    const tableContainer = this.createElement('div', {
      style: {
        overflowX: 'auto',
        padding: '0 10px'
      },
      className: 'payment-table-wrapper'
    });
    
    // Create table
    const table = this.createElement('table', {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        borderSpacing: '0',
        fontSize: '14px'
      }
    });
    
    // Table headers
    const thead = this.createElement('thead', {
      style: {
        background: 'rgba(30, 41, 59, 0.6)'
      }
    });
    
    const headerRow = this.createElement('tr');
    
    const headers = [
      'ID', 'Date', 'User', 'Type', 'Method', 'Amount', 'Status', 'Actions'
    ];
    
    headers.forEach(header => {
      const th = this.createElement('th', {
        style: {
          padding: '14px 16px',
          textAlign: header === 'Amount' ? 'right' : 'left',
          fontSize: '13px',
          fontWeight: '600',
          color: '#94a3b8',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          whiteSpace: 'nowrap'
        }
      }, header);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = this.createElement('tbody');
    
    this.payments.forEach((payment, index) => {
      const row = this.createElement('tr', {
        style: {
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          background: index % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'transparent',
          transition: 'background-color 0.2s ease'
        }
      });
      
      // Hover effect for rows
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(30, 41, 59, 0.5)';
      });
      
      row.addEventListener('mouseleave', () => {
        row.style.background = index % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'transparent';
      });
      
      // ID cell
      const idCell = this.createElement('td', {
        style: {
          padding: '14px 16px',
          fontSize: '14px',
          color: '#94a3b8'
        }
      }, payment.id);
      
      // Date cell
      const dateCell = this.createElement('td', {
        style: {
          padding: '14px 16px',
          fontSize: '14px',
          color: '#94a3b8'
        }
      });
      
      const paymentDate = new Date(payment.paymentDate);
      dateCell.textContent = this.formatDate(paymentDate);
      
      // User cell
      const userCell = this.createElement('td', {
        style: {
          padding: '14px 16px',
          fontSize: '14px'
        }
      });
      
      if (payment.User) {
        const userName = this.createElement('div', {
          style: {
            fontWeight: '500',
            color: '#f1f5f9'
          }
        }, payment.User.fullName);
        
        const userPhone = this.createElement('div', {
          style: {
            fontSize: '13px',
            color: '#94a3b8'
          }
        }, payment.User.phone);
        
        userCell.appendChild(userName);
        userCell.appendChild(userPhone);
      } else {
        userCell.textContent = 'Unknown User';
        userCell.style.color = '#94a3b8';
      }
      
      // Type cell
      const typeCell = this.createElement('td', {
        style: {
          padding: '14px 16px'
        }
      });
      
      const paymentTypeBadge = this.createPaymentTypeBadge(payment);
      typeCell.appendChild(paymentTypeBadge);
      
      // Method cell
      const methodCell = this.createElement('td', {
        style: {
          padding: '14px 16px',
          fontSize: '14px',
          color: '#94a3b8'
        }
      }, payment.paymentMethod);
      
      // Amount cell
      const amountCell = this.createElement('td', {
        style: {
          padding: '14px 16px',
          textAlign: 'right',
          fontSize: '14px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap'
        }
      });
      
      const amount = payment.isExpense 
        ? `-KES ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `KES ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      amountCell.textContent = amount;
      
      if (payment.isExpense) {
        amountCell.style.color = '#ef4444';
      } else {
        amountCell.style.color = '#10b981';
      }
      
      // Status cell
      const statusCell = this.createElement('td', {
        style: {
          padding: '14px 16px'
        }
      });
      
      const statusBadge = this.createElement('span', {
        style: {
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: payment.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.2)' : 
                          payment.status === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : 
                          'rgba(239, 68, 68, 0.2)',
          color: payment.status === 'COMPLETED' ? '#10b981' : 
                 payment.status === 'PENDING' ? '#f59e0b' : 
                 '#ef4444'
        }
      }, payment.status);
      
      statusCell.appendChild(statusBadge);
      
      // Actions cell
      const actionsCell = this.createElement('td', {
        style: {
          padding: '14px 16px'
        }
      });
      
      const actionsContainer = this.createElement('div', {
        style: {
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }
      });
      
      // View details button
      const viewButton = this.createElement('button', {
        className: 'action-button view-payment-btn',
        'data-id': payment.id,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          background: 'rgba(59, 130, 246, 0.2)',
          color: '#3b82f6',
          border: 'none',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }
      }, 'View');
      
      // Add view icon
      viewButton.prepend(this.createSvgIcon('eye'));
      
      actionsContainer.appendChild(viewButton);
      
      // Add SMS button if user has phone
      if (payment.User && payment.User.phone) {
        const smsButton = this.createElement('button', {
          className: 'action-button send-sms-btn',
          'data-id': payment.id,
          'data-phone': payment.User.phone,
          'data-name': payment.User.fullName,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'rgba(139, 92, 246, 0.2)',
            color: '#8b5cf6',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }
        }, 'SMS');
        
        // Add SMS icon
        smsButton.prepend(this.createSvgIcon('sms'));
        
        actionsContainer.appendChild(smsButton);
      }
      
      actionsCell.appendChild(actionsContainer);
      
      // Add all cells to row
      row.appendChild(idCell);
      row.appendChild(dateCell);
      row.appendChild(userCell);
      row.appendChild(typeCell);
      row.appendChild(methodCell);
      row.appendChild(amountCell);
      row.appendChild(statusCell);
      row.appendChild(actionsCell);
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    tableCard.appendChild(tableContainer);
    
    // Pagination
    if (this.totalPages > 1) {
      const paginationContainer = this.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'center',
          padding: '16px',
          borderTop: '1px solid rgba(148, 163, 184, 0.1)'
        }
      });
      
      // Previous button
      const prevButton = this.createElement('a', {
        className: `pagination-item ${this.currentPage === 1 ? 'disabled' : ''}`,
        'data-page': this.currentPage - 1
      });
      prevButton.textContent = '« Previous';
      paginationContainer.appendChild(prevButton);
      
      // Page numbers - FIXED IMPLEMENTATION
      const startPage = Math.max(1, this.currentPage - 2);
      const endPage = Math.min(startPage + 4, this.totalPages);
      
      for (let i = startPage; i <= endPage; i++) {
        const pageLink = this.createElement('a', {
          className: `pagination-item ${i === this.currentPage ? 'active' : ''}`,
          'data-page': i
        });
        pageLink.textContent = i.toString();
        paginationContainer.appendChild(pageLink);
      }
      
      // Next button
      const nextButton = this.createElement('a', {
        className: `pagination-item ${this.currentPage === this.totalPages ? 'disabled' : ''}`,
        'data-page': this.currentPage + 1
      });
      nextButton.textContent = 'Next »';
      paginationContainer.appendChild(nextButton);
      
      tableCard.appendChild(paginationContainer);
    }
    
    return tableCard;
  }
  
  createPaymentTypeBadge(payment) {
    // Get proper payment type name for special offerings
    const isSpecial = typeof payment.paymentType === 'string' && payment.paymentType.startsWith('SPECIAL_');
    
    let typeName = '';
    
    if (isSpecial) {
      // Find the special offering by type from our cached list
      const specialOffering = this.specialOfferings.find(o => 
        o.paymentType === payment.paymentType || 
        o.offeringType === payment.paymentType ||
        (o.id && payment.paymentType.includes(o.id))
      );
      
      if (specialOffering) {
        // Use the name or description, with fallbacks
        if (specialOffering.name) {
          typeName = `Special: ${specialOffering.name.substring(0, 15)}${specialOffering.name.length > 15 ? '...' : ''}`;
        } else if (specialOffering.description) {
          typeName = `Special: ${specialOffering.description.substring(0, 15)}${specialOffering.description.length > 15 ? '...' : ''}`;
        } else {
          // Use the better formatter
          typeName = this.getFriendlySpecialOfferingName(payment.paymentType);
        }
      } else {
        // Use the better formatter if no match found
        typeName = this.getFriendlySpecialOfferingName(payment.paymentType);
      }
    } else {
      typeName = this.formatPaymentType(payment.paymentType);
    }
    
    const paymentTypeBadge = this.createElement('span', {
      style: {
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '500'
      }
    });
    
    // Set the text content separately to avoid "Invalid child" errors
    paymentTypeBadge.textContent = typeName;
    
    // Color the badge based on payment type
    if (payment.paymentType === 'TITHE') {
      paymentTypeBadge.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
      paymentTypeBadge.style.color = '#3b82f6';
    } else if (payment.paymentType === 'OFFERING') {
      paymentTypeBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
      paymentTypeBadge.style.color = '#10b981';
    } else if (payment.paymentType === 'DONATION') {
      paymentTypeBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
      paymentTypeBadge.style.color = '#f59e0b';
    } else if (payment.paymentType === 'EXPENSE' || payment.isExpense) {
      paymentTypeBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      paymentTypeBadge.style.color = '#ef4444';
    } else if (isSpecial) {
      paymentTypeBadge.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
      paymentTypeBadge.style.color = '#8b5cf6';
    } else {
      paymentTypeBadge.style.backgroundColor = 'rgba(100, 116, 139, 0.2)';
      paymentTypeBadge.style.color = '#94a3b8';
    }
    
    return paymentTypeBadge;
  }
  
  getFriendlySpecialOfferingName(paymentType) {
    // First check if we have this special offering in our cache
    const specialOffering = this.specialOfferings.find(o => 
      o.paymentType === paymentType || 
      o.offeringType === paymentType
    );
    
    // If we found it in our cache, return its proper name
    if (specialOffering) {
      if (specialOffering.name) return specialOffering.name;
      if (specialOffering.description) return specialOffering.description;
    }
    
    // Clean up the type string for display
    let displayName = "Special Offering";
    
    // Extract a meaningful name from the type
    if (paymentType && paymentType.startsWith('SPECIAL_')) {
      // Get just the unique part without the SPECIAL_ prefix
      const uniquePart = paymentType.replace('SPECIAL_', '');
      
      // If we have a specialOffering object with a name/description, use that
      if (specialOffering && (specialOffering.name || specialOffering.description)) {
        return specialOffering.name || specialOffering.description;
      }
      
      // Otherwise, format the ID part nicely
      if (uniquePart.length > 8) {
        // Try to parse to see if it's a date-based ID
        if (uniquePart.includes('-')) {
          const parts = uniquePart.split('-');
          if (parts.length >= 2) {
            // If it looks like a date pattern
            return `${displayName} (${parts[0]})`;
          }
        }
        // If it's just long, truncate with ellipsis
        return `${displayName} ${uniquePart.substring(0, 8)}...`;
      }
      
      // For shorter IDs, show the full thing
      return `${displayName} ${uniquePart}`;
    }
    
    // Fallback
    return displayName;
  }
  
  renderPaymentDetailModal() {
    const modalBackdrop = this.createElement('div', {
      id: 'payment-detail-modal',
      className: 'modal-backdrop',
      style: {
        display: 'none',
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: '1000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        overflow: 'auto',
        backdropFilter: 'blur(5px)'
      }
    });
    
    const modalContent = this.createElement('div', {
      className: 'modal-content neo-card',
      style: {
        position: 'relative',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        margin: 'auto',
        animation: 'slideIn 0.3s ease-out'
      }
    });
    
    // Add glow effect
    const modalGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.3), transparent 70%)'
      }
    });
    modalContent.appendChild(modalGlow);
    
    // Modal header
    const modalHeader = this.createElement('div', {
      style: {
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative'
      }
    });
    
    const modalTitle = this.createElement('h3', {
      id: 'modal-title',
      style: {
        margin: '0',
        fontSize: '20px',
        fontWeight: '600',
        color: '#f1f5f9'
      }
    }, 'Payment Details');
    
    const closeButton = this.createElement('button', {
      className: 'close-modal',
      style: {
        background: 'none',
        border: 'none',
        color: '#94a3b8',
        cursor: 'pointer',
        padding: '0',
        lineHeight: '1',
        opacity: '0.8',
        transition: 'all 0.2s ease'
      }
    });
    
    closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    
    // Hover effect
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.opacity = '1';
      closeButton.style.color = '#f1f5f9';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.opacity = '0.8';
      closeButton.style.color = '#94a3b8';
    });
    
    closeButton.addEventListener('click', () => {
      modalBackdrop.style.display = 'none';
    });
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Modal body
    const modalBody = this.createElement('div', {
      id: 'modal-body',
      style: {
        padding: '24px'
      }
    });
    
    // Loading placeholder
    const loadingPlaceholder = this.createElement('div', {
      style: {
        textAlign: 'center',
        padding: '40px 0'
      }
    });
    
    const spinner = this.createElement('div', {
      className: 'loading-spinner',
      style: {
        marginBottom: '16px'
      }
    });
    
    const loadingText = this.createElement('div', {
      style: {
        color: '#94a3b8'
      }
    }, 'Loading payment details...');
    
    loadingPlaceholder.appendChild(spinner);
    loadingPlaceholder.appendChild(loadingText);
    
    modalBody.appendChild(loadingPlaceholder);
    
    // Modal footer
    const modalFooter = this.createElement('div', {
      style: {
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '15px',
        position: 'relative'
      }
    });
    
    const closeModalButton = this.createFuturisticButton('Close', '#64748b', () => {
      modalBackdrop.style.display = 'none';
    });
    
    const downloadButton = this.createElement('button', {
      id: 'modal-download-btn',
      className: 'futuristic-button',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }
    }, 'Download PDF');
    
    // Add download icon
    downloadButton.prepend(this.createSvgIcon('download'));
    
    // Send SMS button
    const sendSmsButton = this.createElement('button', {
      id: 'modal-sms-btn',
      className: 'futuristic-button',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.1))',
        border: '1px solid rgba(139, 92, 246, 0.3)'
      }
    }, 'Send SMS');
    
    // Add SMS icon
    sendSmsButton.prepend(this.createSvgIcon('sms'));
    
    modalFooter.appendChild(closeModalButton);
    modalFooter.appendChild(sendSmsButton);
    modalFooter.appendChild(downloadButton);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    
    modalBackdrop.appendChild(modalContent);
    
    return modalBackdrop;
  }
  
  renderSmsStatusModal() {
    const smsStatusModal = this.createElement('div', {
      id: 'sms-status-modal',
      style: {
        display: 'none',
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '2000',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        maxWidth: '350px',
        width: '100%',
        animation: 'slideIn 0.3s ease-out'
      },
      className: 'neo-card'
    });
    
    return smsStatusModal;
  }
  
  renderLoading() {
    const loadingContainer = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 0',
        animationDelay: '0.2s'
      }
    });
    
    // Add glow effect
    const loadingGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.2), transparent 70%)'
      }
    });
    loadingContainer.appendChild(loadingGlow);
    
    const spinner = this.createElement('div', {
      className: 'loading-spinner',
      style: {
        width: '50px',
        height: '50px',
        marginBottom: '20px'
      }
    });
    
    const loadingText = this.createElement('div', {
      style: {
        color: '#94a3b8',
        fontSize: '18px',
        fontWeight: '500'
      }
    }, 'Loading payment data...');
    
    loadingContainer.appendChild(spinner);
    loadingContainer.appendChild(loadingText);
    
    return loadingContainer;
  }
  
  renderError(error) {
    const errorContainer = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        padding: '30px',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease-out'
      }
    });
    
    // Add glow effect
    const errorGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.3), transparent 70%)'
      }
    });
    errorContainer.appendChild(errorGlow);
    
    const errorIcon = this.createElement('div', {
      style: {
        margin: '0 auto 24px',
        width: '60px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444'
      }
    });
    
    errorIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
    
    const errorTitle = this.createElement('h2', {
      style: {
        fontSize: '24px',
        fontWeight: '600',
        color: '#f1f5f9',
        margin: '0 0 16px'
      }
    }, 'Error Loading Payments');
    
    const errorMessage = this.createElement('p', {
      style: {
        fontSize: '16px',
        color: '#94a3b8',
        margin: '0 0 30px',
        maxWidth: '600px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }
    }, error.message || 'An unexpected error occurred. Please try again later.');
    
    const retryButton = this.createFuturisticButton('Retry', '#ef4444', () => {
      this.isLoading = true;
      this.error = null;
      this.updateView();
    });
    
    // Add retry icon
    const retryIcon = this.createElement('span');
    retryIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 2v6h6"></path>
        <path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
      </svg>
    `;
    
    retryButton.prepend(retryIcon);
    
    errorContainer.appendChild(errorIcon);
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorMessage);
    errorContainer.appendChild(retryButton);
    
    return errorContainer;
  }
  
  renderUnauthorized() {
    const unauthorizedContainer = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        maxWidth: '800px',
        margin: '40px auto',
        padding: '40px 30px',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease-out'
      }
    });
    
    // Add glow effect
    const unauthorizedGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.3), transparent 70%)'
      }
    });
    unauthorizedContainer.appendChild(unauthorizedGlow);
    
    const unauthorizedIcon = this.createElement('div', {
      style: {
        margin: '0 auto 24px',
        width: '80px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444'
      }
    });
    
    unauthorizedIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    `;
    
    const unauthorizedTitle = this.createElement('h2', {
      style: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#f1f5f9',
        margin: '0 0 16px',
        background: 'linear-gradient(to right, #ffffff, #fee2e2)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent'
      }
    }, 'Access Denied');
    
    const unauthorizedMessage = this.createElement('p', {
      style: {
        fontSize: '16px',
        color: '#94a3b8',
        margin: '0 0 40px',
        maxWidth: '600px',
        marginLeft: 'auto',
        marginRight: 'auto',
        lineHeight: '1.6'
      }
    }, 'You do not have permission to access this page. Only administrators can manage payments.');
    
    const homeButton = this.createElement('a', {
      href: '/dashboard',
      className: 'futuristic-button',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 24px',
        fontSize: '16px',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(79, 70, 229, 0.1))',
        border: '1px solid rgba(79, 70, 229, 0.3)'
      }
    }, 'Go to Dashboard');
    
    // Add home icon
    const homeIcon = this.createElement('span');
    homeIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    `;
    
    homeButton.prepend(homeIcon);
    
    unauthorizedContainer.appendChild(unauthorizedIcon);
    unauthorizedContainer.appendChild(unauthorizedTitle);
    unauthorizedContainer.appendChild(unauthorizedMessage);
    unauthorizedContainer.appendChild(homeButton);
    
    return unauthorizedContainer;
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
    return this.paymentCache[key] && 
           (Date.now() - this.paymentCache[key].timestamp < this.CACHE_LIFETIME);
  }
  
  async fetchPayments(page = 1) {
    try {
      if (this.isLoading) {
        this._fetchInProgress = true;
      }
      
      const cacheKey = this.generateCacheKey(page);
      if (this.isCacheValid(cacheKey)) {
        console.log('Using cached payment data');
        this.payments = this.paymentCache[cacheKey].payments;
        this.totalPages = this.paymentCache[cacheKey].totalPages;
        this.totalPayments = this.paymentCache[cacheKey].total;
        this.currentPage = page;
        this.isLoading = false;
        
        if (this._fetchInProgress) {
          this._fetchInProgress = false;
          this.updateView();
        }
        return;
      }
      
      const params = new URLSearchParams();
      params.append('page', page || this.currentPage);
      
      Object.entries(this.filters).forEach(([key, value]) => {
        if (value) {
          if (key === 'specialOffering' && this.filters.paymentType === 'SPECIAL') {
            params.append('paymentType', value);
          } else if (key !== 'specialOffering') {
            params.append(key, value);
          }
        }
      });
      
      console.log('Fetching payment data from API');
      const response = await this.queueApiRequest(() => this.apiService.get(`/payment/all?${params.toString()}`));
      
      if (response) {
        this.payments = response.payments || [];
        this.totalPages = response.totalPages || 1;
        this.totalPayments = response.total || 0;
        this.currentPage = page || this.currentPage;
        
        // IMPROVED SORTING: More robust date comparison with fallbacks
        this.payments.sort((a, b) => {
          // First, try paymentDate (primary date field)
          const aDate = a.paymentDate ? new Date(a.paymentDate) : null;
          const bDate = b.paymentDate ? new Date(b.paymentDate) : null;
          
          // If both have valid paymentDate, compare them
          if (aDate && bDate) {
            return bDate - aDate; // Descending order (newest first)
          }
          
          // Fallback to createdAt if available
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          
          // Fallback to updatedAt if available
          if (a.updatedAt && b.updatedAt) {
            return new Date(b.updatedAt) - new Date(a.updatedAt);
          }
          
          // Last resort: compare IDs (newer IDs are typically higher)
          return b.id - a.id;
        });
        
        this.paymentCache[cacheKey] = {
          payments: this.payments,
          totalPages: this.totalPages,
          total: this.totalPayments,
          timestamp: Date.now()
        };
        
        console.log(`Loaded ${this.payments.length} payments successfully`);
      }
      
      this.isLoading = false;
      
      if (this._fetchInProgress) {
        this._fetchInProgress = false;
        this.updateView();
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      this.error = 'Failed to load payments. Please try again.';
      this.isLoading = false;
      this._fetchInProgress = false;
      this.updateView();
    }
  }
  
  
  // Generate a cache key based on current filters and page
  generateCacheKey(page) {
    const filterValues = Object.values(this.filters).join('-');
    return `payments-${page}-${filterValues}`;
  }
  
  async fetchSpecialOfferings() {
    try {
      // Try to use cache if available
      if (this.specialOfferingsCache && 
          (Date.now() - this.specialOfferingsCache.timestamp < this.CACHE_LIFETIME)) {
        this.specialOfferings = this.specialOfferingsCache.data;
        return;
      }
      
      // Get special offerings for dropdown and naming
      const response = await this.queueApiRequest(() => this.apiService.getSpecialOfferings());
      
      if (response && response.specialOfferings) {
        this.specialOfferings = response.specialOfferings;
      } else {
        this.specialOfferings = [];
      }
      
      // Cache the results
      this.specialOfferingsCache = {
        data: this.specialOfferings,
        timestamp: Date.now()
      };
      
      // Update special offerings dropdown
      const container = document.getElementById('payment-filters-form');
      if (container) {
        const select = container.querySelector('select[name="specialOffering"]');
        if (select) {
          // Clear existing options except the first one
          while (select.options.length > 1) {
            select.remove(1);
          }
          
          // Add options for each special offering
          this.specialOfferings.forEach(offering => {
            const offeringName = offering.name || offering.description || this.getFriendlySpecialOfferingName(offering.offeringType || offering.paymentType || '');
            
            const option = document.createElement('option');
            option.value = offering.offeringType || offering.paymentType;
            option.textContent = offeringName;
            select.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error('Error fetching special offerings:', error);
    }
  }
  
  async viewPaymentDetails(paymentId) {
    try {
      const modal = document.getElementById('payment-detail-modal');
      const modalBody = document.getElementById('modal-body');
      const downloadBtn = document.getElementById('modal-download-btn');
      const sendSmsBtn = document.getElementById('modal-sms-btn');
      
      if (!modal || !modalBody) return;
      
      // Show modal with loading state
      modal.style.display = 'flex';
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px 0;">
          <div class="loading-spinner" style="margin-bottom: 16px;"></div>
          <div style="color: #94a3b8;">Loading payment details...</div>
        </div>
      `;
      
      // Check if we already have the payment data
      let payment = this.payments.find(p => p.id === parseInt(paymentId));
      
      // If not found in current page, fetch it
      if (!payment) {
        const response = await this.queueApiRequest(() => this.apiService.get(`/payment/${paymentId}`));
        
        if (!response || !response.payment) {
          throw new Error('Payment details not found');
        }
        
        payment = response.payment;
      }
      
      this.selectedPayment = payment;
      
      // Update modal title to include payment type
      const modalTitle = document.getElementById('modal-title');
      if (modalTitle) {
        const isSpecial = payment.paymentType && payment.paymentType.startsWith('SPECIAL_');
        let paymentTypeName = this.formatPaymentType(payment.paymentType);
        
        // For special offerings, use the description instead of the type code
        if (isSpecial) {
          const specialOffering = this.specialOfferings.find(o => o.paymentType === payment.paymentType || o.offeringType === payment.paymentType);
          if (specialOffering && (specialOffering.name || specialOffering.description)) {
            paymentTypeName = `Special: ${specialOffering.name || specialOffering.description}`;
          } else {
            paymentTypeName = this.getFriendlySpecialOfferingName(payment.paymentType);
          }
        }
        
        modalTitle.textContent = `${paymentTypeName} Payment Details`;
      }
      
      // Show or hide download button based on receipt availability
      downloadBtn.style.display = 'flex';
      downloadBtn.onclick = () => this.downloadPdf(payment);
      
      // Show or hide SMS button based on user phone availability
      if (payment.User && payment.User.phone) {
        sendSmsBtn.style.display = 'flex';
        sendSmsBtn.onclick = () => this.sendSms(payment.User.phone, payment.User.fullName, payment);
      } else {
        sendSmsBtn.style.display = 'none';
      }
      
      // Render payment details
      modalBody.innerHTML = this.renderPaymentDetailsContent(payment);
      
    } catch (error) {
      console.error('Error fetching payment details:', error);
      
      const modalBody = document.getElementById('modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 40px 0; color: #ef4444;">
            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 20px;">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v4"></path>
              <path d="M12 16h.01"></path>
            </svg>
            <p style="font-weight: 600; margin-bottom: 8px; font-size: 18px;">Error loading payment details</p>
            <p style="color: #94a3b8;">${error.message}</p>
          </div>
        `;
      }
    }
  }
  
  // Continuing from the previous code block...

  renderPaymentDetailsContent(payment) {
    // Start with an empty html string
    let html = '';
    
    // Basic payment details grid
    html += `
      <div style="padding: 20px 0;">
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;" class="payment-details-grid">
    `;
    
    // User information
    if (payment.User) {
      html += `
        <!-- User Information -->
        <div class="neo-card" style="overflow: hidden; padding: 20px; background: rgba(30, 41, 59, 0.5);">
          <h4 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            User Information
          </h4>
          <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
            <div>
              <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Name</div>
              <div style="font-size: 15px; font-weight: 500; color: #f1f5f9;">${payment.User.fullName}</div>
            </div>
            <div>
              <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Phone</div>
              <div style="font-size: 15px; color: #f1f5f9;">${payment.User.phone}</div>
            </div>
            ${payment.User.email ? `
            <div>
              <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Email</div>
              <div style="font-size: 15px; color: #f1f5f9;">${payment.User.email}</div>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    // Payment information
    html += `
      <!-- Payment Information -->
      <div class="neo-card" style="overflow: hidden; padding: 20px; background: rgba(30, 41, 59, 0.5);">
        <h4 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          Payment Information
        </h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Payment ID</div>
            <div style="font-size: 15px; color: #f1f5f9;">${payment.id}</div>
          </div>
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Date</div>
            <div style="font-size: 15px; color: #f1f5f9;">${this.formatDate(new Date(payment.paymentDate))}</div>
          </div>
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Type</div>
            <div style="font-size: 15px; color: #f1f5f9;">
              ${this.formatPaymentType(payment.paymentType)}
            </div>
          </div>
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Method</div>
            <div style="font-size: 15px; color: #f1f5f9;">${payment.paymentMethod}</div>
          </div>
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Status</div>
            <div style="font-size: 15px; color: 
              ${payment.status === 'COMPLETED' ? '#10b981' : 
                payment.status === 'PENDING' ? '#f59e0b' : 
                '#ef4444'};">
              ${payment.status}
            </div>
          </div>
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Receipt</div>
            <div style="font-size: 15px; color: #f1f5f9;">${payment.receiptNumber || 'N/A'}</div>
          </div>
        </div>
      </div>
    `;
    
    // Amount information
    html += `
      <!-- Amount Information -->
      <div class="neo-card" style="overflow: hidden; padding: 20px; background: rgba(30, 41, 59, 0.5);">
        <h4 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          Amount Information
        </h4>
        <div style="display: grid; grid-template-columns: 1fr; gap: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 15px; color: #f1f5f9;">Amount</div>
            <div style="font-size: 18px; font-weight: 600; color: ${payment.isExpense ? '#ef4444' : '#10b981'}; font-family: monospace;">
              ${payment.isExpense ? '-' : ''}KES ${parseFloat(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          ${payment.platformFee ? `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 15px; color: #94a3b8;">Platform Fee</div>
            <div style="font-size: 15px; color: #f1f5f9; font-family: monospace;">
              KES ${parseFloat(payment.platformFee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          ` : ''}
          
          ${payment.description ? `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(148, 163, 184, 0.1);">
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 4px;">Description</div>
            <div style="font-size: 15px; color: #f1f5f9; line-height: 1.5;">${payment.description}</div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Handle tithe distribution
    if (payment.titheDistribution && payment.paymentType === 'TITHE') {
      html += `
        <!-- Tithe Distribution -->
        <div class="neo-card" style="overflow: hidden; grid-column: 1 / -1; background: rgba(30, 41, 59, 0.5);">
          <div style="padding: 14px 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              Tithe Distribution
            </h4>
          </div>
          <div style="padding: 16px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">
      `;
      
      let total = 0;
      Object.entries(payment.titheDistribution).forEach(([key, value]) => {
        if (key !== 'otherSpecification' && value > 0) {
          const formattedKey = key.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
          
          total += parseFloat(value);
          
          html += `
            <div>
              <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">${formattedKey}</div>
              <div style="font-size: 15px; font-weight: 500; color: #3b82f6; font-family: monospace;">
                KES ${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          `;
        }
      });
      
      if (payment.titheDistribution.other > 0) {
        const otherLabel = payment.titheDistribution.otherSpecification 
          ? `Other (${payment.titheDistribution.otherSpecification})` 
          : 'Other';
        
        html += `
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">${otherLabel}</div>
            <div style="font-size: 15px; font-weight: 500; color: #3b82f6; font-family: monospace;">
              KES ${parseFloat(payment.titheDistribution.other).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        `;
      }
      
      html += `
              <div style="grid-column: 1 / -1; border-top: 1px solid rgba(148, 163, 184, 0.1); padding-top: 16px; margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-size: 15px; font-weight: 600; color: #f1f5f9;">Total Distribution</div>
                  <div style="font-size: 15px; font-weight: 600; color: #3b82f6;">KES ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    // Add department info for expenses
    if (payment.isExpense && payment.department) {
      html += `
        <!-- Department Information -->
        <div class="neo-card" style="overflow: hidden; grid-column: 1 / -1; background: rgba(30, 41, 59, 0.5);">
          <div style="padding: 14px 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
              Department Information
            </h4>
          </div>
          <div style="padding: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="background: ${this.getDepartmentColor(payment.department)}; width: 10px; height: 10px; border-radius: 50%;"></div>
              <div>
                <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Department</div>
                <div style="font-size: 14px; font-weight: 500; color: #f1f5f9;">${this.formatDepartment(payment.department)}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    // Add special offering info
    const isSpecialOffering = payment.paymentType && payment.paymentType.startsWith('SPECIAL_');
    if (isSpecialOffering) {
      // Try to find the special offering in our list
      const specialOffering = this.specialOfferings.find(o => o.paymentType === payment.paymentType || o.offeringType === payment.paymentType);
      const offeringName = specialOffering ? specialOffering.name || specialOffering.description : this.getFriendlySpecialOfferingName(payment.paymentType);
      
      let fullDescription = specialOffering?.description || payment.description || '';
      let customFields = [];
      
      try {
        if (payment.customFields) {
          const parsedFields = typeof payment.customFields === 'string'
            ? JSON.parse(payment.customFields)
            : payment.customFields;
            
          if (parsedFields.fields) {
            customFields = parsedFields.fields;
          }
          
          if (parsedFields.fullDescription) {
            fullDescription = parsedFields.fullDescription;
          }
        } else if (specialOffering && specialOffering.customFields) {
          const parsedFields = typeof specialOffering.customFields === 'string'
            ? JSON.parse(specialOffering.customFields)
            : specialOffering.customFields;
            
          customFields = parsedFields.fields || [];
          
          if (parsedFields.fullDescription) {
            fullDescription = parsedFields.fullDescription;
          }
        }
      } catch (e) {
        console.error('Error parsing custom fields:', e);
      }
      
      html += `
        <!-- Special Offering Information -->
        <div class="neo-card" style="overflow: hidden; grid-column: 1 / -1; background: rgba(30, 41, 59, 0.5);">
          <div style="padding: 14px 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"></polyline>
                <rect x="2" y="7" width="20" height="5"></rect>
                <line x1="12" y1="22" x2="12" y2="7"></line>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
              </svg>
              Special Offering Details
            </h4>
          </div>
          <div style="padding: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px;">
              <div>
                <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Offering Name</div>
                <div style="font-size: 14px; font-weight: 500; color: #f1f5f9;">${offeringName}</div>
              </div>
      `;
      
      // If there's a target goal and end date, show it
      if (payment.targetGoal || specialOffering?.targetGoal) {
        const targetGoal = payment.targetGoal || specialOffering?.targetGoal || 0;
        html += `
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Target Goal</div>
            <div style="font-size: 14px; font-weight: 500; color: #f1f5f9;">KES ${parseFloat(targetGoal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        `;
      }
      
      // If there's an end date, show it
      if (payment.endDate || specialOffering?.endDate) {
        const endDate = payment.endDate || specialOffering?.endDate;
        html += `
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">End Date</div>
            <div style="font-size: 14px; color: #f1f5f9;">${new Date(endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        `;
      }
      
      // Add description if we have it
      if (fullDescription) {
        html += `
          <div style="grid-column: 1 / -1; margin-top: 8px;">
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Description</div>
            <div style="font-size: 14px; color: #f1f5f9; line-height: 1.5;">${fullDescription}</div>
          </div>
        `;
      }
      
      // If we have custom fields, display them
      if (customFields && customFields.length > 0) {
        html += `
          </div>
          <div style="margin-top: 16px; border-top: 1px solid rgba(148, 163, 184, 0.1); padding-top: 12px;">
            <div style="font-size: 14px; color: #f1f5f9; font-weight: 500; margin-bottom: 10px;">Custom Fields</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px;">
        `;
        
        customFields.forEach(field => {
          html += `
            <div style="background: rgba(15, 23, 42, 0.4); padding: 10px; border-radius: 6px;">
              <div style="font-size: 13px; color: #8b5cf6; margin-bottom: 2px;">${field.name}</div>
              <div style="font-size: 14px; color: #f1f5f9;">${field.description || 'N/A'}</div>
            </div>
          `;
        });
        
        html += `
            </div>
        `;
      }
      
      html += `
            </div>
          </div>
        </div>
      `;
    }
    
    // Add transaction details section if available
    if (payment.transactionId || payment.reference || payment.platformFee) {
      html += `
        <!-- Transaction Details -->
        <div class="neo-card" style="overflow: hidden; grid-column: 1 / -1; background: rgba(30, 41, 59, 0.5);">
          <div style="padding: 14px 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Transaction Details
            </h4>
          </div>
          <div style="padding: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px;">
      `;
      
      if (payment.transactionId) {
        html += `
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Transaction ID</div>
            <div style="font-size: 14px; color: #f1f5f9;">${payment.transactionId}</div>
          </div>
        `;
      }
      
      if (payment.reference) {
        html += `
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Reference</div>
            <div style="font-size: 14px; color: #f1f5f9;">${payment.reference}</div>
          </div>
        `;
      }
      
      if (payment.platformFee) {
        html += `
          <div>
            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Platform Fee</div>
            <div style="font-size: 14px; color: #f1f5f9;">KES ${parseFloat(payment.platformFee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        `;
      }
      
      html += `
            </div>
          </div>
        </div>
      `;
    }
    
    // Close the grid container
    html += `</div></div>`;
    
    return html;
  }
  
  async downloadPdf(payment) {
    try {
      if (!payment) return;
      
      // Show downloading status
      this.success = 'Generating PDF for download...';
      this.updateView();
      
      // Frontend PDF generation using the browser's built-in functionality
      await this.generatePdfInBrowser(payment);
      
      this.success = 'PDF generated successfully';
      setTimeout(() => {
        this.success = null;
        this.updateView();
      }, 3000);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      this.error = 'Failed to generate PDF: ' + error.message;
      this.updateView();
      
      setTimeout(() => {
        this.error = null;
        this.updateView();
      }, 5000);
    }
  }
  
  async generatePdfInBrowser(payment) {
    // Create a new window to hold the printable content
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
    }
    
    // Get user info
    const user = payment.User || { fullName: 'Unknown User', phone: 'N/A', email: 'N/A' };
    
    // Format payment type nicely
    let paymentTypeName = payment.paymentType;
    if (payment.paymentType.startsWith('SPECIAL_')) {
      const specialOffering = this.specialOfferings.find(o => 
        o.paymentType === payment.paymentType || o.offeringType === payment.paymentType
      );
      
      if (specialOffering) {
        paymentTypeName = specialOffering.name || specialOffering.description || this.getFriendlySpecialOfferingName(payment.paymentType);
      } else {
        paymentTypeName = this.getFriendlySpecialOfferingName(payment.paymentType);
      }
    } else {
      paymentTypeName = this.formatPaymentType(payment.paymentType);
    }
    
    // Generate HTML content for printing
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${payment.receiptNumber || payment.id}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .receipt-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 10px;
          }
          .receipt-header h1 {
            color: #4f46e5;
            margin: 0;
            font-size: 28px;
          }
          .receipt-header h2 {
            font-size: 20px;
            margin: 5px 0;
            color: #666;
          }
          .receipt-section {
            margin-bottom: 25px;
          }
          .receipt-section h3 {
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            color: #4f46e5;
          }
          .section-content {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          }
          .detail-item {
            margin-bottom: 8px;
          }
          .detail-label {
            font-weight: bold;
            color: #666;
            font-size: 14px;
          }
          .detail-value {
            font-size: 16px;
          }
          .amount {
            font-weight: bold;
            color: ${payment.isExpense ? '#ef4444' : '#10b981'};
            font-size: 18px;
          }
          .receipt-footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          .signature-line {
            margin-top: 50px;
            border-top: 1px solid #000;
            width: 200px;
            display: inline-block;
            text-align: center;
          }
          @media print {
            body {
              padding: 0;
              font-size: 12pt;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>TASSIAC CHURCH</h1>
          <h2>Official Payment Receipt</h2>
        </div>
        
        <div class="receipt-section">
          <h3>Receipt Information</h3>
          <div class="section-content">
            <div class="detail-item">
              <div class="detail-label">Receipt Number</div>
              <div class="detail-value">${payment.receiptNumber || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Payment ID</div>
              <div class="detail-value">${payment.id}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Date</div>
              <div class="detail-value">${new Date(payment.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Status</div>
              <div class="detail-value">${payment.status}</div>
            </div>
          </div>
        </div>
        
        <div class="receipt-section">
          <h3>User Information</h3>
          <div class="section-content">
            <div class="detail-item">
              <div class="detail-label">Name</div>
              <div class="detail-value">${user.fullName}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Phone</div>
              <div class="detail-value">${user.phone}</div>
            </div>
            ${user.email ? `
            <div class="detail-item">
              <div class="detail-label">Email</div>
              <div class="detail-value">${user.email}</div>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div class="receipt-section">
          <h3>Payment Details</h3>
          <div class="section-content">
            <div class="detail-item">
              <div class="detail-label">Payment Type</div>
              <div class="detail-value">${paymentTypeName}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Payment Method</div>
              <div class="detail-value">${payment.paymentMethod}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Amount</div>
              <div class="detail-value amount">
                ${payment.isExpense ? '-' : ''}KES ${parseFloat(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            ${payment.platformFee ? `
            <div class="detail-item">
              <div class="detail-label">Platform Fee</div>
              <div class="detail-value">
                KES ${parseFloat(payment.platformFee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            ` : ''}
          </div>
          
          ${payment.description ? `
          <div style="margin-top: 15px;">
            <div class="detail-label">Description</div>
            <div class="detail-value">${payment.description}</div>
          </div>
          ` : ''}
        </div>
        
        ${payment.transactionId || payment.reference ? `
        <div class="receipt-section">
          <h3>Transaction Information</h3>
          <div class="section-content">
            ${payment.transactionId ? `
            <div class="detail-item">
              <div class="detail-label">Transaction ID</div>
              <div class="detail-value">${payment.transactionId}</div>
            </div>
            ` : ''}
            ${payment.reference ? `
            <div class="detail-item">
              <div class="detail-label">Reference</div>
              <div class="detail-value">${payment.reference}</div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}
        
        ${payment.titheDistribution && payment.paymentType === 'TITHE' ? `
        <div class="receipt-section">
          <h3>Tithe Distribution</h3>
          <div class="section-content">
            ${Object.entries(payment.titheDistribution)
              .filter(([key, value]) => key !== 'otherSpecification' && value > 0)
              .map(([key, value]) => {
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                return `
                <div class="detail-item">
                  <div class="detail-label">${formattedKey}</div>
                  <div class="detail-value">KES ${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                `;
              }).join('')}
            ${payment.titheDistribution.other > 0 ? `
            <div class="detail-item">
              <div class="detail-label">
                ${payment.titheDistribution.otherSpecification ? 
                  `Other (${payment.titheDistribution.otherSpecification})` : 'Other'}
              </div>
              <div class="detail-value">KES ${parseFloat(payment.titheDistribution.other).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}
        
        <div class="receipt-footer">
          <p>Thank you for your contribution to TASSIAC Church.</p>
          <p>This is an official receipt. Please keep it for your records.</p>
          
          <div class="signature-line">
            <div>Authorized Signature</div>
          </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print();" style="padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
            Print Receipt
          </button>
          &nbsp;
          <button onclick="window.close();" style="padding: 10px 20px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
            Close
          </button>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Automatically trigger print when content is loaded
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.focus();
      }, 300);
    };
  }
  
  async sendSms(phoneNumber, name, payment) {
    try {
      // Show sending status
      const smsStatusModal = document.getElementById('sms-status-modal');
      if (smsStatusModal) {
        smsStatusModal.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        smsStatusModal.style.borderLeft = '4px solid #3b82f6';
        smsStatusModal.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 20px; height: 20px; border: 2px solid rgba(59, 130, 246, 0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div>
              <div style="font-weight: 600; color: #3b82f6; margin-bottom: 4px;">Sending SMS</div>
              <div style="font-size: 13px; color: #f1f5f9;">Sending message to ${name} at ${phoneNumber}...</div>
            </div>
          </div>
        `;
        smsStatusModal.style.display = 'block';
        
        // Auto hide after 10 seconds if no response
        setTimeout(() => {
          if (smsStatusModal.style.display === 'block' && !this.SMS_STATUS.success && !this.SMS_STATUS.error) {
            smsStatusModal.style.display = 'none';
          }
        }, 10000);
      }
      
      this.SMS_STATUS = { sending: true, error: null, success: null };
      
      // Format the payment for SMS message
      const paymentType = this.formatPaymentType(payment.paymentType);
      const amount = payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const date = new Date(payment.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const receiptNumber = payment.receiptNumber || 'N/A';
      
      // Create message
      const message = `Dear ${name}, your ${paymentType} payment of KES ${amount} on ${date} has been recorded. Receipt: ${receiptNumber}. Thank you for your contribution to TASSIAC Church.`;
      
      // Send SMS via API
      const response = await this.queueApiRequest(() => this.apiService.post('/notifications/send-sms', {
        phone: phoneNumber,
        message: message
      }));
      
      if (response && response.success) {
        // Show success message
        this.SMS_STATUS = { sending: false, error: null, success: true };
        
        if (smsStatusModal) {
          smsStatusModal.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
          smsStatusModal.style.borderLeft = '4px solid #10b981';
          smsStatusModal.innerHTML = `
            <div style="display: flex; align-items: start; gap: 10px;">
              <div style="color: #10b981;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div>
                <div style="font-weight: 600; color: #10b981; margin-bottom: 4px;">SMS Sent Successfully</div>
                <div style="font-size: 13px; color: #f1f5f9;">Message sent to ${name} at ${phoneNumber}.</div>
              </div>
              <button style="margin-left: auto; background: none; border: none; cursor: pointer; font-size: 18px; color: #10b981;" onclick="document.getElementById('sms-status-modal').style.display = 'none';">×</button>
            </div>
          `;
          
          // Auto hide after 5 seconds
          setTimeout(() => {
            smsStatusModal.style.display = 'none';
          }, 5000);
        }
      } else {
        throw new Error(response?.message || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      this.SMS_STATUS = { sending: false, error: error.message, success: null };
      
      // Show error message
      const smsStatusModal = document.getElementById('sms-status-modal');
      if (smsStatusModal) {
        smsStatusModal.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        smsStatusModal.style.borderLeft = '4px solid #ef4444';
        smsStatusModal.innerHTML = `
          <div style="display: flex; align-items: start; gap: 10px;">
            <div style="color: #ef4444;">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div>
              <div style="font-weight: 600; color: #ef4444; margin-bottom: 4px;">SMS Failed to Send</div>
              <div style="font-size: 13px; color: #f1f5f9;">${error.message}</div>
            </div>
            <button style="margin-left: auto; background: none; border: none; cursor: pointer; font-size: 18px; color: #ef4444;" onclick="document.getElementById('sms-status-modal').style.display = 'none';">×</button>
          </div>
        `;
        
        // Auto hide after 8 seconds
        setTimeout(() => {
          smsStatusModal.style.display = 'none';
        }, 8000);
      }
    }
  }
  
  formatPaymentType(type) {
    if (!type) return 'Unknown';
    
    if (type.startsWith('SPECIAL_')) {
      // Extract the special offering name from the payment type
      const offeringId = type.replace('SPECIAL_', '');
      const specialOffering = this.specialOfferings.find(o => 
        o.paymentType === type || 
        o.offeringType === type || 
        (o.id && type.includes(o.id))
      );
      
      if (specialOffering && (specialOffering.name || specialOffering.description)) {
        return `Special: ${specialOffering.name || specialOffering.description}`;
      }
      
      // Clean up the ID for display if no name found
      return `Special Offering ${offeringId.substring(0, 6)}`;
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
        return type;
    }
  }
  
  formatDepartment(department) {
    if (!department) return 'Unknown';
    
    // Convert department ID to readable name
    const departments = {
      'MUSIC': 'Music Ministry',
      'CHILDREN': 'Children\'s Ministry',
      'COMMUNICATION': 'Communication',
      'EDUCATION': 'Education',
      'FAMILY': 'Family Ministries',
      'HEALTH': 'Health Ministries',
      'MINISTERIAL': 'Ministerial Association',
      'PLANNED_GIVING': 'Planned Giving & Trust Services',
      'TREASURY': 'Treasury',
      'PUBLIC_AFFAIRS': 'Public Affairs & Religious Liberty',
      'PUBLISHING': 'Publishing',
      'SABBATH_SCHOOL': 'Sabbath School & Personal Ministries',
      'WOMEN': 'Women\'s Ministries',
      'YOUTH': 'Youth Ministries',
      'OTHER': 'Other',
      'MAINTENANCE': 'Maintenance',
      'DEVELOPMENT': 'Development'
    };
    
    return departments[department] || department;
  }
  
  getDepartmentColor(department) {
    const colorMap = {
      'MUSIC': '#3b82f6',        // Blue
      'MAINTENANCE': '#ef4444',  // Red
      'EDUCATION': '#8b5cf6',    // Purple
      'CHILDREN': '#10b981',     // Green
      'YOUTH': '#f59e0b',        // Amber
      'HEALTH': '#06b6d4',       // Cyan
      'COMMUNICATION': '#ec4899', // Pink
      'FAMILY': '#f97316',       // Orange
      'TREASURY': '#14b8a6',     // Teal
      'DEVELOPMENT': '#0ea5e9',  // Sky Blue
      'MINISTERIAL': '#8b5cf6',  // Purple
      'PLANNED_GIVING': '#14b8a6', // Teal
      'PUBLIC_AFFAIRS': '#6366f1', // Indigo
      'PUBLISHING': '#f43f5e',   // Rose
      'SABBATH_SCHOOL': '#0284c7', // Light Blue
      'WOMEN': '#d946ef',        // Fuchsia
      'OTHER': '#64748b'         // Slate
    };
    
    return colorMap[department] || '#64748b';
  }
  
  hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Handle shorthand hex
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r}, ${g}, ${b}`;
  }
  
  formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  exportPayments(format) {
    // Build query parameters including current filters
    const params = new URLSearchParams();
    
    Object.entries(this.filters).forEach(([key, value]) => {
      if (value) {
        if (key === 'specialOffering' && this.filters.paymentType === 'SPECIAL') {
          params.append('paymentType', value);
        } else if (key !== 'specialOffering') {
          params.append(key, value);
        }
      }
    });
    
    params.append('format', format);
    
    // Generate a filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `payments_export_${timestamp}.${format}`;
    
    // Build the URL and trigger download
    const url = `/api/payment/export?${params.toString()}`;
    window.open(url, '_blank');
  }
  
  exportFilteredResults() {
    // Use the current filters to export as PDF
    this.exportPayments('pdf');
  }
  
  resetFilters() {
    this.filters = {
      startDate: '',
      endDate: '',
      paymentType: '',
      userId: '',
      specialOffering: ''
    };
    
    this.currentPage = 1;
    
    const form = document.getElementById('payment-filters-form');
    if (form) {
      form.reset();
      
      // Hide special offering dropdown
      const specialOfferingGroup = form.querySelector('[name="specialOffering"]').parentNode;
      specialOfferingGroup.style.display = 'none';
    }
    
    this.isLoading = true;
    this.updateView();
  }
  
  applyFiltersWithDebounce() {
    // Clear any existing timer
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
    }
    
    // Set a new timer
    this.filterDebounceTimer = setTimeout(() => {
      this.currentPage = 1;
      this.isLoading = true;
      this.updateView();
    }, this.FILTER_DEBOUNCE_DELAY);
  }
  
  attachEventListeners() {
    // Filters form
    const filtersForm = document.getElementById('payment-filters-form');
    if (filtersForm) {
      filtersForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(filtersForm);
        
        this.filters = {
          startDate: formData.get('startDate') || '',
          endDate: formData.get('endDate') || '',
          paymentType: formData.get('paymentType') || '',
          userId: formData.get('userId') || '',
          specialOffering: formData.get('specialOffering') || ''
        };
        
        this.currentPage = 1;
        this.isLoading = true;
        this.updateView();
      });
      
      // Payment type change handler
      const paymentTypeSelect = filtersForm.querySelector('[name="paymentType"]');
      const specialOfferingGroup = filtersForm.querySelector('[name="specialOffering"]')?.parentNode;
      
      if (paymentTypeSelect && specialOfferingGroup) {
        paymentTypeSelect.addEventListener('change', () => {
          specialOfferingGroup.style.display = paymentTypeSelect.value === 'SPECIAL' ? 'block' : 'none';
        });
      }
    }
    
    // Pagination links
    const paginationLinks = document.querySelectorAll('.pagination-item');
    paginationLinks.forEach(link => {
      if (!link.classList.contains('disabled')) {
        link.addEventListener('click', () => {
          const page = parseInt(link.dataset.page);
          if (page && page !== this.currentPage) {
            this.fetchPayments(page);
          }
        });
      }
    });
    
    // View payment buttons
    const viewButtons = document.querySelectorAll('.view-payment-btn');
    viewButtons.forEach(button => {
      button.addEventListener('click', () => {
        const paymentId = button.dataset.id;
        this.viewPaymentDetails(paymentId);
      });
    });
    
    // SMS buttons
    const smsButtons = document.querySelectorAll('.send-sms-btn');
    smsButtons.forEach(button => {
      button.addEventListener('click', () => {
        const paymentId = button.dataset.id;
        const phone = button.dataset.phone;
        const name = button.dataset.name;
        
        // Find the payment
        const payment = this.payments.find(p => p.id === parseInt(paymentId));
        if (payment && phone) {
          this.sendSms(phone, name, payment);
        }
      });
    });
    
    // Modal close when clicking outside
    const modal = document.getElementById('payment-detail-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
      
      // Close on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
          modal.style.display = 'none';
        }
      });
    }
  }
  
  updateView() {
    // Prevent updateView while already rendering
    if (this.isRendering) {
      console.log('Cannot update view: rendering in progress');
      return;
    }
    
    const appContainer = document.getElementById('app');
    if (appContainer) {
      console.log('Updating view, isLoading:', this.isLoading);
      
      // Clear existing content
      appContainer.innerHTML = '';
      
      // Render new content
      this.render().then(content => {
        if (content) {
          appContainer.appendChild(content);
        }
      }).catch(error => {
        console.error('Error in updateView:', error);
        // Make sure rendering flag is reset on error
        this.isRendering = false;
      });
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
          font-family: 'Inter', system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
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
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          box-shadow: 0 4px 24px -8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1) inset;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        
        .neo-card:hover {
          box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.2) inset;
        }
        
        .card-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 16px;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }
        
        .neo-card:hover .card-glow {
          opacity: 0.15;
        }
        
        .futuristic-button {
          position: relative;
          color: #e0e7ff;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
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
        
        .form-control {
          width: 100%;
          padding: 10px 12px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          color: #f1f5f9;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        
        .form-control:focus {
          border-color: #4f46e5;
          outline: none;
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
        }
        
        .form-control::placeholder {
          color: #64748b;
        }
        
        select.form-control {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 36px;
        }
        
        .pagination-item {
          cursor: pointer;
          padding: 8px 12px;
          margin: 0 4px;
          border-radius: 8px;
          display: inline-block;
          transition: all 0.2s;
          font-size: 14px;
          color: #94a3b8;
          background: rgba(30, 41, 59, 0.4);
        }
        
        .pagination-item:hover {
          background: rgba(79, 70, 229, 0.2);
          color: #f1f5f9;
        }
        
        .pagination-item.active {
          background: #4f46e5;
          color: white;
          font-weight: 500;
        }
        
        .pagination-item.disabled {
          opacity: 0.5;
          pointer-events: none;
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
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .loading-spinner {
          display: inline-block;
          width: 40px;
          height: 40px;
          border: 3px solid rgba(79, 70, 229, 0.2);
          border-top-color: #4f46e5;
          border-radius: 50%;
          animation: spin 1s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
        }
        
        .animated-item {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        @media (max-width: 768px) {
          .payment-details-grid {
            grid-template-columns: 1fr !important;
          }
          
          .payment-table-wrapper {
            margin: 0 -10px;
          }
          
          #admin-nav-menu {
            position: static;
            margin: 20px;
            width: auto;
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
      `;
      document.head.appendChild(styleElement);
    }
  }

  renderTopNavigation() {
    const nav = document.createElement('nav');
    nav.className = 'admin-top-nav';
    nav.style.cssText = 'padding: 1rem; border-bottom: 1px solid rgba(148, 163, 184, 0.1); background: rgba(30, 41, 59, 0.5);';
    
    const links = [
      { path: '/admin/dashboard', text: 'Dashboard', icon: '📊' },
      { path: '/admin/payments', text: 'Payments', icon: '💰', active: true },
      { path: '/admin/users', text: 'Users', icon: '👥' },
      { path: '/admin/expenses', text: 'Expenses', icon: '📉' }
    ];
    
    const navContent = document.createElement('div');
    navContent.style.cssText = 'max-width: 1200px; margin: 0 auto; display: flex; gap: 1rem;';
    
    links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.path;
      a.className = `nav-link ${link.active ? 'active' : ''}`;
      a.style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        color: ${link.active ? '#fff' : '#94a3b8'};
        text-decoration: none;
        border-radius: 0.5rem;
        background: ${link.active ? 'rgba(79, 70, 229, 0.2)' : 'transparent'};
        transition: all 0.2s;
      `;
      
      a.innerHTML = `${link.icon} ${link.text}`;
      
      // Hover effect
      a.addEventListener('mouseenter', () => {
        if (!link.active) {
          a.style.background = 'rgba(30, 41, 59, 0.5)';
          a.style.color = '#fff';
        }
      });
      
      a.addEventListener('mouseleave', () => {
        if (!link.active) {
          a.style.background = 'transparent';
          a.style.color = '#94a3b8';
        }
      });
      
      navContent.appendChild(a);
    });
    
    nav.appendChild(navContent);
    return nav;
  }
} // End of class AdminPaymentsView