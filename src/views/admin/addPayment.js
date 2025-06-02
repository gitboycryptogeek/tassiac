// src/views/admin/addPayment.js
import { BaseComponent } from '../../utils/BaseComponent.js';

export class AdminAddPaymentView extends BaseComponent {
  constructor() {
    super();
    this.title = 'Add Payment';
    this.authService = window.authService;
    this.user = this.authService ? this.authService.getUser() : null;
    this.apiService = window.apiService;
    
    // API Request Throttling
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 350;
    this.maxConcurrentRequests = 2;
    this.requestsInLastMinute = 0;
    this.rateLimitResetTime = Date.now() + 60000;
    
    // Data Management
    this.users = [];
    this.specialOfferings = [];
    this.filteredUsers = [];
    this.formData = {
      userId: '',
      amount: '',
      paymentType: 'TITHE',
      description: '',
      paymentMethod: 'MANUAL',
      status: 'COMPLETED',
      titheDistributionSDA: {
        campMeetingExpenses: false,
        welfare: false,
        thanksgiving: false,
        stationFund: false,
        mediaMinistry: false
      },
      paymentDate: this.formatDate(new Date())
    };
    
    // UI State Management
    this.isSubmitting = false;
    this.hasSubmitted = false;
    this.errorMessage = '';
    this.successMessage = '';
    this.userSearchQuery = '';
    this.showUserDropdown = false;
    this.modalVisible = false;
    
    // Rate Limiting Checker
    setInterval(() => {
      if (Date.now() > this.rateLimitResetTime) {
        this.requestsInLastMinute = 0;
        this.rateLimitResetTime = Date.now() + 60000;
      }
    }, 10000);
    
    // Initialize Data
    setTimeout(() => {
      this.initialize();
    }, 100);
  }
  
  async initialize() {
    try {
      await this.loadUsers();
      this.filteredUsers = [...this.users];
    } catch (error) {
      console.error("Failed to load users:", error);
      this.errorMessage = 'Failed to load members. Please check your connection and try again.';
      this.users = [];
      this.filteredUsers = [];
    }
    
    try {
      await this.loadSpecialOfferings();
    } catch (error) {
      console.warn("Could not load special offerings:", error);
      this.specialOfferings = [];
    }
  }
  
  // Enhanced API Request Throttling
  queueApiRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      if (this.requestsInLastMinute >= 60) {
        reject(new Error('Rate limit exceeded. Please try again later.'));
        return;
      }
      
      this.requestsInLastMinute++;
      this.apiRequestQueue.push({
        request: requestFunction,
        resolve,
        reject,
        timestamp: Date.now()
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
    const activeRequests = this.apiRequestQueue.splice(0, this.maxConcurrentRequests);
    
    activeRequests.forEach(requestData => {
      const { request, resolve, reject } = requestData;
      const jitter = Math.random() * 50;
      const delay = this.requestThrottleTime + jitter;
      
      try {
        request()
          .then(result => resolve(result))
          .catch(error => reject(error))
          .finally(() => {
            setTimeout(() => {
              this.processApiRequestQueue();
            }, delay);
          });
      } catch (error) {
        reject(error);
        setTimeout(() => {
          this.processApiRequestQueue();
        }, delay);
      }
    });
  }
  
  async loadUsers() {
    try {
      const response = await this.queueApiRequest(() => 
        this.apiService.getAllUsers()
      );
      this.users = response.users || [];
    } catch (error) {
      console.error('Error loading users:', error);
      this.users = [];
      throw error;
    }
  }

  async loadSpecialOfferings() {
    try {
      console.log('Loading special offerings...');
      
      const response = await this.queueApiRequest(() => 
        this.apiService.getSpecialOfferings({activeOnly: 'false'})
      );
      
      console.log('Special offerings response:', response);
      
      // Handle direct array response or nested response
      let offerings = [];
      if (Array.isArray(response)) {
        offerings = response;
      } else if (response?.specialOfferings) {
        offerings = response.specialOfferings;
      } else if (response?.data?.specialOfferings) {
        offerings = response.data.specialOfferings;
      }
      
      if (offerings && offerings.length > 0) {
        this.specialOfferings = offerings.map(offering => ({
          id: offering.id,
          offeringCode: offering.offeringCode,
          name: offering.name,
          description: offering.description,
          fullDescription: offering.description,
          startDate: offering.startDate,
          endDate: offering.endDate,
          targetAmount: offering.targetAmount || 0,
          currentAmount: offering.currentAmount || 0,
          isActive: offering.isActive,
          customFields: offering.customFields || []
        }));
        
        console.log('Processed special offerings:', this.specialOfferings);
      } else {
        console.log('No special offerings found in response structure');
        this.specialOfferings = [];
      }
      
      this.updateSpecialOfferingsDropdown();
    } catch (error) {
      console.error('Error loading special offerings:', error);
      this.specialOfferings = [];
    }
  }

  updateSpecialOfferingsDropdown() {
    const paymentTypeSelect = document.getElementById('paymentType');
    if (!paymentTypeSelect) return;
    
    let optGroup = paymentTypeSelect.querySelector('optgroup[label="Special Offerings"]');
    if (!optGroup) {
      optGroup = document.createElement('optgroup');
      optGroup.label = 'Special Offerings';
      paymentTypeSelect.appendChild(optGroup);
    }
    
    optGroup.innerHTML = '';
    
    if (!this.specialOfferings || this.specialOfferings.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.disabled = true;
      emptyOption.textContent = 'No special offerings available';
      optGroup.appendChild(emptyOption);
      return;
    }
    
    const sortedOfferings = [...this.specialOfferings].sort((a, b) => {
      return new Date(b.startDate) - new Date(a.startDate);
    });
    
    sortedOfferings.forEach(offering => {
      if (!offering || !offering.offeringCode) {
        console.warn('Invalid special offering found:', offering);
        return;
      }
      
      const optionElement = document.createElement('option');
      // <-- Changed line:
      optionElement.value = `SPECIAL_OFFERING_${offering.id}`;
      optionElement.textContent = offering.name;
      optionElement.dataset.offeringCode = offering.offeringCode;
      optionElement.dataset.description = offering.description || '';
      optionElement.dataset.target = offering.targetAmount || 0;
      
      const now = new Date();
      const endDate = offering.endDate ? new Date(offering.endDate) : null;
      const isActive = offering.isActive && (!endDate || endDate > now);
      optionElement.dataset.active = isActive;
      
      if (!isActive) {
        optionElement.style.color = '#64748b';
        optionElement.textContent += ' (Ended)';
      }
      
      optGroup.appendChild(optionElement);
    });
  }
  
  formatDate(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }
  
  formatCurrency(amount, currency = 'KES') {
    if (typeof amount !== 'number') return `${currency} 0.00`;
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  render() {
    const container = this.createElement('div', {
      className: 'payment-container',
      style: {
        maxWidth: '1300px',
        margin: '0 auto',
        padding: '20px 15px',
        color: '#eef2ff',
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        zIndex: '1'
      }
    });

    const loadingElement = this.createElement('div', {
      className: 'loading-state',
      style: {
        textAlign: 'center',
        padding: '2rem'
      }
    }, 'Loading...');
    
    container.appendChild(loadingElement);

    Promise.resolve().then(async () => {
      try {
        await this.initialize();
        
        container.removeChild(loadingElement);
        
        this.addBackgroundElements();
        this.addStyles();
        container.appendChild(this.renderPageHeader());
        
        if (this.hasSubmitted) {
          container.appendChild(this.renderAlerts());
        }
        
        container.appendChild(this.renderPaymentForm());
        
        document.body.appendChild(this.renderSpecialOfferingModal());
        
        this.attachEventListeners();
      } catch (error) {
        console.error('Error initializing view:', error);
        container.innerHTML = `
          <div class="error-state" style="color: #ef4444; text-align: center; padding: 2rem;">
            Failed to load payment form. Please try refreshing the page.
          </div>
        `;
      }
    });

    return container;
  }
  
  addBackgroundElements() {
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
      className: 'page-header animated-item',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginBottom: '25px'
      }
    });

    const titleContainer = this.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }
    });

    const navLinks = this.createElement('div', {
      className: 'admin-nav-links',
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginTop: '5px'
      }
    });
    
    const pageTitle = this.createElement('h1', {
      style: {
        fontSize: '28px',
        fontWeight: '700',
        margin: '0',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
      }
    }, 'Add Payment');
    
    titleContainer.appendChild(pageTitle);
    
    const navItems = [
      { text: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
      { text: 'Payments', href: '/admin/payments', icon: '💰' },
      { text: 'Expenses', href: '/admin/expenses', icon: '📝' },
      { text: 'Users', href: '/admin/users', icon: '👥' }
    ];
    
    navItems.forEach(item => {
      const link = this.createElement('a', {
        href: item.href,
        style: {
          color: '#94a3b8',
          textDecoration: 'none',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          transition: 'all 0.2s ease'
        },
        onMouseenter: (e) => {
          e.currentTarget.style.color = '#e0e7ff';
        },
        onMouseleave: (e) => {
          e.currentTarget.style.color = '#94a3b8';
        }
      });
      
      const icon = this.createElement('span', {}, item.icon);
      const text = this.createElement('span', {}, item.text);
      
      link.appendChild(icon);
      link.appendChild(text);
      navLinks.appendChild(link);
    });
    
    titleContainer.appendChild(navLinks);
    
    const createSpecialOfferingBtn = this.createElement('button', {
      id: 'create-special-offering-btn',
      className: 'futuristic-button',
      style: {
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))',
        color: '#10b981'
      },
      onClick: () => {
        this.toggleSpecialOfferingModal(true);
      }
    });
    
    const buttonIcon = this.createElement('span', {
      style: {
        fontSize: '16px',
        marginRight: '8px'
      }
    }, '✨');
    
    const buttonText = document.createTextNode('Create Special Offering');
    
    createSpecialOfferingBtn.appendChild(buttonIcon);
    createSpecialOfferingBtn.appendChild(buttonText);
    
    headerSection.appendChild(titleContainer);
    headerSection.appendChild(createSpecialOfferingBtn);
    
    return headerSection;
  }
  
  renderAlerts() {
    const alertContainer = this.createElement('div', {
      className: 'animated-item',
      style: {
        marginBottom: '25px',
        animationDelay: '0.1s'
      }
    });
    
    if (this.successMessage) {
      const alertBox = this.createElement('div', {
        className: 'neo-card',
        style: {
          padding: '20px 25px',
          borderLeft: '4px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }
      });
      
      const successIcon = this.createElement('div', {
        style: {
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: '#10b981',
          flexShrink: '0'
        }
      }, '✓');
      
      const messageContent = this.createElement('div', {
        style: {
          flex: '1'
        }
      });
      
      const messageTitle = this.createElement('h4', {
        style: {
          margin: '0 0 5px',
          color: '#f1f5f9',
          fontSize: '16px',
          fontWeight: '600'
        }
      }, 'Success');
      
      const messageText = this.createElement('p', {
        style: {
          margin: '0',
          color: '#94a3b8',
          fontSize: '14px'
        }
      }, this.successMessage);
      
      messageContent.appendChild(messageTitle);
      messageContent.appendChild(messageText);
      
      alertBox.appendChild(successIcon);
      alertBox.appendChild(messageContent);
      alertContainer.appendChild(alertBox);
    } else if (this.errorMessage) {
      const alertBox = this.createElement('div', {
        className: 'neo-card',
        style: {
          padding: '20px 25px',
          borderLeft: '4px solid #ef4444',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }
      });
      
      const errorIcon = this.createElement('div', {
        style: {
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: '#ef4444',
          flexShrink: '0'
        }
      }, '!');
      
      const messageContent = this.createElement('div', {
        style: {
          flex: '1'
        }
      });
      
      const messageTitle = this.createElement('h4', {
        style: {
          margin: '0 0 5px',
          color: '#f1f5f9',
          fontSize: '16px',
          fontWeight: '600'
        }
      }, 'Error');
      
      const messageText = this.createElement('p', {
        style: {
          margin: '0',
          color: '#94a3b8',
          fontSize: '14px'
        }
      }, this.errorMessage);
      
      messageContent.appendChild(messageTitle);
      messageContent.appendChild(messageText);
      
      alertBox.appendChild(errorIcon);
      alertBox.appendChild(messageContent);
      alertContainer.appendChild(alertBox);
    }
    
    return alertContainer;
  }
  
  renderPaymentForm() {
    const formCard = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        padding: '30px',
        position: 'relative',
        overflow: 'hidden'
      }
    });
    
    const formGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.3), transparent 70%)'
      }
    });
    formCard.appendChild(formGlow);
    
    const formTitle = this.createElement('h2', {
      style: {
        fontSize: '20px',
        fontWeight: '600',
        marginTop: '0',
        marginBottom: '25px',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent'
      }
    }, 'Payment Details');
    
    formCard.appendChild(formTitle);
    
    const form = this.createElement('form', {
      id: 'add-payment-form'
    });
    
    form.appendChild(this.renderFormRow([
      this.renderUserSelectField(),
      this.renderPaymentTypeField()
    ]));
    
    form.appendChild(this.renderFormRow([
      this.renderAmountField(),
      this.renderDateField()
    ]));
    
    form.appendChild(this.renderDescriptionField());
    
    form.appendChild(this.renderTitheDistributionSection());
    
    form.appendChild(this.renderFormActions());
    
    formCard.appendChild(form);
    
    return formCard;
  }
  
  renderFormRow(fields) {
    const formRow = this.createElement('div', {
      className: 'form-row',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }
    });
    
    fields.forEach(field => {
      formRow.appendChild(field);
    });
    
    return formRow;
  }
  
  renderUserSelectField() {
    const fieldGroup = this.createElement('div', {
      className: 'form-group'
    });
    
    const fieldLabel = this.createElement('label', {
      htmlFor: 'userSearch',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Select Member');
    
    const selectContainer = this.createElement('div', {
      className: 'custom-select-container',
      style: {
        position: 'relative'
      }
    });
    
    const userSearch = this.createElement('input', {
      type: 'text',
      id: 'userSearch',
      className: 'futuristic-input',
      placeholder: 'Search member by name or phone...',
      autoComplete: 'off'
    });
    
    const userIdInput = this.createElement('input', {
      type: 'hidden',
      id: 'userId',
      name: 'userId',
      value: this.formData.userId
    });
    
    const userDropdown = this.createElement('div', {
      id: 'userDropdown',
      className: 'custom-select-dropdown',
      style: {
        position: 'absolute',
        top: 'calc(100% + 5px)',
        left: '0',
        width: '100%',
        maxHeight: '250px',
        overflowY: 'auto',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        zIndex: '10',
        display: 'none'
      }
    });
    
    selectContainer.appendChild(userSearch);
    selectContainer.appendChild(userIdInput);
    selectContainer.appendChild(userDropdown);
    
    fieldGroup.appendChild(fieldLabel);
    fieldGroup.appendChild(selectContainer);
    
    return fieldGroup;
  }
  
  renderPaymentTypeField() {
    const fieldGroup = this.createElement('div', {
      className: 'form-group'
    });
    
    const fieldLabel = this.createElement('label', {
      htmlFor: 'paymentType',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Payment Type');
    
    const selectWrapper = this.createElement('div', {
      className: 'select-wrapper',
      style: {
        position: 'relative'
      }
    });
    
    const paymentTypeSelect = this.createElement('select', {
      id: 'paymentType',
      className: 'futuristic-select'
    });
    
    const placeholderOption = this.createElement('option', {
      value: '',
      disabled: true,
      selected: true
    }, 'Select payment type');
    paymentTypeSelect.appendChild(placeholderOption);
    
    const regularOptions = [
      { value: 'TITHE', label: 'Tithe' },
      { value: 'OFFERING', label: 'Offering' },
      { value: 'DONATION', label: 'Donation' },
      { value: 'EXPENSE', label: 'Expense' }
    ];
    
    const basicOptGroup = this.createElement('optgroup', {
      label: 'Standard Payment Types'
    });
    
    regularOptions.forEach(option => {
      const optionElement = this.createElement('option', {
        value: option.value
      }, option.label);
      
      basicOptGroup.appendChild(optionElement);
    });
    
    paymentTypeSelect.appendChild(basicOptGroup);
    
    // Special offerings will be added dynamically via updateSpecialOfferingsDropdown()
    
    const selectArrow = this.createElement('div', {
      className: 'select-arrow',
      style: {
        position: 'absolute',
        top: '50%',
        right: '15px',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        color: '#64748b',
        fontSize: '12px'
      }
    }, '▼');
    
    selectWrapper.appendChild(paymentTypeSelect);
    selectWrapper.appendChild(selectArrow);
    
    fieldGroup.appendChild(fieldLabel);
    fieldGroup.appendChild(selectWrapper);
    
    return fieldGroup;
  }
  
  renderAmountField() {
    const fieldGroup = this.createElement('div', {
      className: 'form-group'
    });
    
    const fieldLabel = this.createElement('label', {
      htmlFor: 'amount',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Amount');
    
    const inputGroup = this.createElement('div', {
      className: 'input-group',
      style: {
        display: 'flex',
        position: 'relative'
      }
    });
    
    const currencyPrefix = this.createElement('div', {
      className: 'input-group-prefix',
      style: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        color: '#94a3b8',
        padding: '0 15px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '12px 0 0 12px',
        borderTop: '1px solid rgba(59, 130, 246, 0.2)',
        borderLeft: '1px solid rgba(59, 130, 246, 0.2)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'KES');
    
    const amountInput = this.createElement('input', {
      type: 'number',
      id: 'amount',
      className: 'futuristic-input',
      style: {
        borderRadius: '0 12px 12px 0'
      },
      placeholder: '0.00',
      min: '0.01',
      step: '0.01',
      required: true
    });
    
    inputGroup.appendChild(currencyPrefix);
    inputGroup.appendChild(amountInput);
    
    fieldGroup.appendChild(fieldLabel);
    fieldGroup.appendChild(inputGroup);
    
    return fieldGroup;
  }
  
  renderDateField() {
    const fieldGroup = this.createElement('div', {
      className: 'form-group'
    });
    
    const fieldLabel = this.createElement('label', {
      htmlFor: 'paymentDate',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Payment Date');
    
    const dateInput = this.createElement('input', {
      type: 'date',
      id: 'paymentDate',
      className: 'futuristic-input',
      value: this.formData.paymentDate,
      required: true
    });
    
    fieldGroup.appendChild(fieldLabel);
    fieldGroup.appendChild(dateInput);
    
    return fieldGroup;
  }
  
  renderDescriptionField() {
    const fieldGroup = this.createElement('div', {
      className: 'form-group',
      style: {
        marginBottom: '25px'
      }
    });
    
    const fieldLabel = this.createElement('label', {
      htmlFor: 'description',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Description');
    
    const descriptionTextarea = this.createElement('textarea', {
      id: 'description',
      className: 'futuristic-textarea',
      rows: '3',
      placeholder: 'Enter payment details...'
    });
    
    fieldGroup.appendChild(fieldLabel);
    fieldGroup.appendChild(descriptionTextarea);
    
    return fieldGroup;
  }
  
  renderTitheDistributionSection() {
    const titheSection = this.createElement('div', {
      id: 'tithe-distribution-section',
      className: 'neo-card',
      style: {
        padding: '25px',
        margin: '30px 0',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        display: 'none'
      }
    });
    
    const sectionTitle = this.createElement('h3', {
      style: {
        fontSize: '18px',
        fontWeight: '600',
        margin: '0 0 20px 0',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent'
      }
    }, 'Tithe Distribution Categories');
    
    titheSection.appendChild(sectionTitle);
    
    const subtitle = this.createElement('p', {
      style: {
        color: '#94a3b8',
        fontSize: '14px',
        marginTop: '0',
        marginBottom: '25px'
      }
    }, 'Select which SDA categories this tithe should be allocated to:');
    
    titheSection.appendChild(subtitle);
    
    const checkboxContainer = this.createElement('div', {
      className: 'tithe-checkbox-container',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '15px'
      }
    });
    
    const titheCategories = [
      { id: 'campMeetingExpenses', label: 'Camp Meeting Expenses' },
      { id: 'welfare', label: 'Welfare' },
      { id: 'thanksgiving', label: 'Thanksgiving' },
      { id: 'stationFund', label: 'Station Fund' },
      { id: 'mediaMinistry', label: 'Media Ministry' }
    ];
    
    titheCategories.forEach(category => {
      const checkboxItem = this.createElement('div', {
        className: 'checkbox-item',
        style: {
          padding: '15px',
          backgroundColor: 'rgba(30, 41, 59, 0.3)',
          borderRadius: '12px',
          border: '1px solid rgba(59, 130, 246, 0.1)',
          transition: 'all 0.2s ease'
        }
      });
      
      const checkboxLabel = this.createElement('label', {
        style: {
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          color: '#e0e7ff',
          fontSize: '14px',
          fontWeight: '500'
        }
      });
      
      const checkbox = this.createElement('input', {
        type: 'checkbox',
        id: category.id,
        name: 'titheDistribution',
        value: category.id,
        style: {
          width: '18px',
          height: '18px',
          marginRight: '12px',
          accentColor: '#3b82f6',
          cursor: 'pointer'
        }
      });
      
      const labelText = document.createTextNode(category.label);
      
      checkboxLabel.appendChild(checkbox);
      checkboxLabel.appendChild(labelText);
      checkboxItem.appendChild(checkboxLabel);
      
      // Add hover effect
      checkboxItem.addEventListener('mouseenter', () => {
        checkboxItem.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        checkboxItem.style.borderColor = 'rgba(59, 130, 246, 0.2)';
      });
      
      checkboxItem.addEventListener('mouseleave', () => {
        checkboxItem.style.backgroundColor = 'rgba(30, 41, 59, 0.3)';
        checkboxItem.style.borderColor = 'rgba(59, 130, 246, 0.1)';
      });
      
      checkboxContainer.appendChild(checkboxItem);
    });
    
    titheSection.appendChild(checkboxContainer);
    
    return titheSection;
  }
  
  renderFormActions() {
    const actionsContainer = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '30px'
      }
    });
    
    const submitButton = this.createElement('button', {
      type: 'submit',
      id: 'submit-payment-btn',
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(3, 105, 161, 0.2)',
        color: '#38bdf8',
        padding: '12px 25px'
      }
    });
    
    const spinner = this.createElement('span', {
      id: 'submit-spinner',
      className: 'spinner',
      style: {
        display: 'none',
        width: '16px',
        height: '16px',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        borderTop: '2px solid #fff',
        borderRadius: '50%',
        marginRight: '8px',
        animation: 'spin 0.75s linear infinite'
      }
    });
    
    const buttonText = document.createTextNode('Add Payment');
    
    submitButton.appendChild(spinner);
    submitButton.appendChild(buttonText);
    
    actionsContainer.appendChild(submitButton);
    
    return actionsContainer;
  }
  
  renderSpecialOfferingModal() {
    const modal = this.createElement('div', {
      id: 'special-offering-modal',
      className: 'modal',
      style: {
        display: 'none',
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(5px)',
        zIndex: '1000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '15px'
      }
    });

    const modalContent = this.createElement('div', {
      className: 'neo-card',
      style: {
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        animation: 'modalFadeIn 0.3s ease-out'
      }
    });
    
    const modalHeader = this.createElement('div', {
      style: {
        padding: '20px 25px',
        borderBottom: '1px solid rgba(30, 41, 59, 0.8)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    });
    
    const modalTitle = this.createElement('h2', {
      style: {
        margin: '0',
        fontSize: '20px',
        fontWeight: '600',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent'
      }
    }, 'Create Special Offering');
    
    const closeButton = this.createElement('button', {
      className: 'close-modal',
      style: {
        background: 'none',
        border: 'none',
        color: '#94a3b8',
        fontSize: '24px',
        cursor: 'pointer',
        padding: '0',
        lineHeight: '1',
        transition: 'color 0.15s ease'
      },
      onMouseenter: (e) => {
        e.currentTarget.style.color = '#e0e7ff';
      },
      onMouseleave: (e) => {
        e.currentTarget.style.color = '#94a3b8';
      },
      onClick: () => {
        this.toggleSpecialOfferingModal(false);
      }
    }, '×');
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    const modalBody = this.createElement('div', {
      style: {
        padding: '25px'
      }
    });
    
    const offeringForm = this.createElement('form', {
      id: 'special-offering-form'
    });
    
    const nameField = this.createElement('div', {
      style: {
        marginBottom: '20px'
      }
    });
    
    const nameLabel = this.createElement('label', {
      htmlFor: 'offeringName',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Offering Name');
    
    const nameInput = this.createElement('input', {
      type: 'text',
      id: 'offeringName',
      className: 'futuristic-input',
      required: true,
      placeholder: 'Enter offering name'
    });
    
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    
    const descriptionField = this.createElement('div', {
      style: {
        marginBottom: '20px'
      }
    });
    
    const descriptionLabel = this.createElement('label', {
      htmlFor: 'offeringDescription',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Description');
    
    const descriptionTextarea = this.createElement('textarea', {
      id: 'offeringDescription',
      className: 'futuristic-textarea',
      rows: '3',
      placeholder: 'Enter offering description'
    });
    
    descriptionField.appendChild(descriptionLabel);
    descriptionField.appendChild(descriptionTextarea);
    
    const dateRow = this.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }
    });
    
    const startDateField = this.createElement('div');
    
    const startDateLabel = this.createElement('label', {
      htmlFor: 'offeringStartDate',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Start Date');
    
    const startDateInput = this.createElement('input', {
      type: 'date',
      id: 'offeringStartDate',
      className: 'futuristic-input',
      required: true,
      value: this.formatDate(new Date())
    });
    
    startDateField.appendChild(startDateLabel);
    startDateField.appendChild(startDateInput);
    
    const endDateField = this.createElement('div');
    
    const endDateLabel = this.createElement('label', {
      htmlFor: 'offeringEndDate',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'End Date (Optional)');
    
    const endDateInput = this.createElement('input', {
      type: 'date',
      id: 'offeringEndDate',
      className: 'futuristic-input'
    });
    
    endDateField.appendChild(endDateLabel);
    endDateField.appendChild(endDateInput);
    
    dateRow.appendChild(startDateField);
    dateRow.appendChild(endDateField);
    
    const targetField = this.createElement('div', {
      style: {
        marginBottom: '25px'
      }
    });
    
    const targetLabel = this.createElement('label', {
      htmlFor: 'offeringTarget',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Target Goal (Optional)');
    
    const targetInput = this.createElement('input', {
      type: 'number',
      id: 'offeringTarget',
      className: 'futuristic-input',
      min: '0',
      step: '0.01',
      placeholder: '0.00'
    });
    
    targetField.appendChild(targetLabel);
    targetField.appendChild(targetInput);
    
    const formActions = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '15px',
        marginTop: '30px'
      }
    });
    
    const cancelButton = this.createElement('button', {
      type: 'button',
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(127, 29, 29, 0.2)',
        color: '#ef4444'
      },
      onClick: () => this.toggleSpecialOfferingModal(false)
    }, 'Cancel');
    
    const submitButton = this.createElement('button', {
      type: 'submit',
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(3, 105, 161, 0.2)',
        color: '#38bdf8'
      }
    }, 'Create Offering');
    
    formActions.appendChild(cancelButton);
    formActions.appendChild(submitButton);
    
    offeringForm.appendChild(nameField);
    offeringForm.appendChild(descriptionField);
    offeringForm.appendChild(dateRow);
    offeringForm.appendChild(targetField);
    offeringForm.appendChild(formActions);
    
    offeringForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      
      // Immediate submission guard
      if (this.isSubmitting) {
        return false;
      }
      
      await this.handleSpecialOfferingSubmit(e);
      return false;
    });
    
    modalBody.appendChild(offeringForm);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.toggleSpecialOfferingModal(false);
      }
    });
    
    return modal;
  }
  
  addStyles() {
    if (!document.getElementById('futuristic-payment-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'futuristic-payment-styles';
      styleElement.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', sans-serif;
          color: #e0e7ff;
          background-color: #0f172a;
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
        
        .futuristic-input, .futuristic-textarea, .futuristic-select {
          width: 100%;
          padding: 15px;
          background-color: rgba(15, 23, 42, 0.5);
          color: #e0e7ff;
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          transition: all 0.2s ease;
          outline: none;
          box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.1) inset;
        }
        
        .futuristic-input:focus, .futuristic-textarea:focus, .futuristic-select:focus {
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 4px 10px -4px rgba(0, 0, 0, 0.1) inset;
        }
        
        .futuristic-input::placeholder, .futuristic-textarea::placeholder {
          color: rgba(148, 163, 184, 0.6);
        }
        
        .futuristic-select {
          appearance: none;
          padding-right: 40px;
        }
        
        .futuristic-textarea {
          resize: vertical;
          min-height: 100px;
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
          font-size: 14px;
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
        
        .custom-select-dropdown {
          max-height: 250px;
          overflow-y: auto;
        }
        
        .dropdown-item {
          padding: 10px 15px;
          color: #e0e7ff;
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
        }
        
        .dropdown-item:hover {
          background-color: rgba(59, 130, 246, 0.1);
        }
        
        .dropdown-item.active {
          background-color: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
        }
        
        .checkbox-item {
          transition: all 0.2s ease;
        }
        
        .checkbox-item:hover {
          background-color: rgba(59, 130, 246, 0.1) !important;
          border-color: rgba(59, 130, 246, 0.2) !important;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
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
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animated-item {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        @media (max-width: 768px) {
          .payment-container {
            padding: 20px 15px;
          }
          
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .neo-card {
            padding: 20px;
          }
          
          .admin-nav-links {
            margin-top: 15px;
            flex-wrap: wrap;
          }
          
          .tithe-checkbox-container {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 480px) {
          .futuristic-input, .futuristic-textarea, .futuristic-select {
            font-size: 16px;
            padding: 12px;
          }
          
          .futuristic-button {
            width: 100%;
            padding: 15px;
            margin-top: 10px;
          }
          
          .modal-content {
            width: 95%;
            max-height: 85vh;
          }
          
          .dropdown-item {
            padding: 12px 15px;
          }
        }
      `;
      document.head.appendChild(styleElement);
    }
  }
  
  renderUserDropdown() {
    const userDropdown = document.getElementById('userDropdown');
    if (!userDropdown) return;
    
    if (this.filteredUsers.length === 0) {
      userDropdown.innerHTML = `<div class="dropdown-item">No members found</div>`;
      return;
    }
    
    userDropdown.innerHTML = this.filteredUsers.map(user => `
      <div class="dropdown-item" data-user-id="${user.id}">
        ${user.fullName} (${user.phone || 'No phone'})
      </div>
    `).join('');
    
    const dropdownItems = userDropdown.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.getAttribute('data-user-id');
        if (!userId) return;
        
        const user = this.users.find(u => u.id.toString() === userId);
        if (user) {
          const userSearchInput = document.getElementById('userSearch');
          const userIdInput = document.getElementById('userId');
          
          userSearchInput.value = `${user.fullName} (${user.phone || 'No phone'})`;
          userIdInput.value = user.id;
          userDropdown.style.display = 'none';
          this.showUserDropdown = false;
        }
      });
    });
  }
  
  toggleUserDropdown(show) {
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) {
      userDropdown.style.display = show ? 'block' : 'none';
      this.showUserDropdown = show;
      
      if (show) {
        this.renderUserDropdown();
      }
    }
  }
  
  toggleSpecialOfferingModal(show) {
    const modal = document.getElementById('special-offering-modal');
    if (modal) {
      modal.style.display = show ? 'flex' : 'none';
      document.body.style.overflow = show ? 'hidden' : '';
      
      if (show) {
        const form = document.getElementById('special-offering-form');
        if (form) form.reset();
        
        const startDateInput = document.getElementById('offeringStartDate');
        if (startDateInput) startDateInput.value = this.formatDate(new Date());
      }
    }
  }
  
  attachEventListeners() {
    const form = document.getElementById('add-payment-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        if (this.isSubmitting) {
          return false;
        }
        
        this.handleSubmit(e);
        return false;
      });
    }
    
    const paymentTypeSelect = document.getElementById('paymentType');
    if (paymentTypeSelect) {
      paymentTypeSelect.addEventListener('change', () => {
        const titheDistributionSection = document.getElementById('tithe-distribution-section');
        
        if (paymentTypeSelect.value === 'TITHE') {
          if (titheDistributionSection) {
            titheDistributionSection.style.display = 'block';
          }
        } else {
          if (titheDistributionSection) {
            titheDistributionSection.style.display = 'none';
          }
        }
      });
    }
    
    const userSearchInput = document.getElementById('userSearch');
    const userDropdown = document.getElementById('userDropdown');
    
    if (userSearchInput && userDropdown) {
      userSearchInput.addEventListener('focus', () => {
        this.toggleUserDropdown(true);
      });
      
      userSearchInput.addEventListener('input', () => {
        this.userSearchQuery = userSearchInput.value.toLowerCase();
        this.filteredUsers = this.users.filter(user => 
          (user.fullName && user.fullName.toLowerCase().includes(this.userSearchQuery)) || 
          (user.phone && user.phone.includes(this.userSearchQuery))
        );
        this.renderUserDropdown();
      });
      
      document.addEventListener('click', (e) => {
        if (!userSearchInput.contains(e.target) && !userDropdown.contains(e.target)) {
          this.toggleUserDropdown(false);
        }
      });
    }
    
    const specialOfferingForm = document.getElementById('special-offering-form');
    if (specialOfferingForm) {
      specialOfferingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSpecialOfferingSubmit(e);
      });
    }
    
    const closeModalButtons = document.querySelectorAll('.close-modal');
    closeModalButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.toggleSpecialOfferingModal(false);
      });
    });
    
    const modal = document.getElementById('special-offering-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.toggleSpecialOfferingModal(false);
        }
      });
    }
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    try {
      if (this.isSubmitting) return;
      this.isSubmitting = true;
      
      const submitBtn = document.getElementById('submit-payment-btn');
      const submitSpinner = document.getElementById('submit-spinner');
      if (submitBtn && submitSpinner) {
        submitBtn.disabled = true;
        submitSpinner.style.display = 'inline-block';
      }
      
      const form = e.target;
      const userId = form.querySelector('#userId').value;
      const paymentType = form.querySelector('#paymentType').value;
      const amount = parseFloat(form.querySelector('#amount').value);
      const description = form.querySelector('#description').value || '';
      const paymentDate = form.querySelector('#paymentDate').value;

      console.log('Form submission data:', {
        userId,
        paymentType,
        amount,
        description,
        paymentDate
      });

      if (!userId) throw new Error('Please select a member');
      if (!paymentType) throw new Error('Please select a payment type');
      if (isNaN(amount) || amount <= 0) throw new Error('Please enter a valid amount');

      let paymentData = {
        userId: parseInt(userId),
        amount: amount,
        paymentType: paymentType,
        description: description,
        paymentDate: paymentDate,
        paymentMethod: 'MANUAL',
        isExpense: paymentType === 'EXPENSE'
      };

      if (paymentType === 'TITHE') {
        const titheDistributionSDA = {
          campMeetingExpenses: false,
          welfare: false,
          thanksgiving: false,
          stationFund: false,
          mediaMinistry: false
        };
        
        const checkboxes = form.querySelectorAll('input[name="titheDistribution"]:checked');
        checkboxes.forEach(checkbox => {
          if (titheDistributionSDA.hasOwnProperty(checkbox.value)) {
            titheDistributionSDA[checkbox.value] = true;
          }
        });
        
        paymentData.titheDistributionSDA = titheDistributionSDA;
        paymentData.paymentType = 'TITHE';
      } else if (paymentType.startsWith('SPECIAL_OFFERING_')) {
        const offeringId = parseInt(paymentType.replace('SPECIAL_OFFERING_', ''), 10);
        if (isNaN(offeringId)) {
          throw new Error('Invalid special offering selection');
        }
        
        const offering = this.specialOfferings.find(o => o.id === offeringId);
        if (!offering) {
          throw new Error('Special offering not found');
        }
        
        paymentData.specialOfferingId = offeringId;
        // Keep original payment type format for server
        paymentData.paymentType = paymentType;
        
        // Add display name to description
        if (description && !description.includes(offering.name)) {
          paymentData.description = `${offering.name} - ${description}`;
        } else if (!description) {
          paymentData.description = offering.name;
        }
      } else if (paymentType === 'EXPENSE') {
        paymentData.isExpense = true;
        paymentData.department = 'General';
      }

      const response = await this.queueApiRequest(() => 
        this.apiService.addManualPayment(paymentData)
      );

      // Payment succeeded - backend logs show successful creation
      this.successMessage = 'Payment processed successfully!';
      this.errorMessage = '';
      this.hasSubmitted = true;

      // Force complete view refresh
      setTimeout(() => {
        window.location.reload();
      }, 1500);

      this.showNotification('Payment processed successfully!', 'success');

    } catch (error) {
      console.error('Payment submission error:', error);
      this.errorMessage = error.message || 'Failed to process payment. Please try again.';
      this.successMessage = '';
      this.hasSubmitted = true;
      this.showNotification(this.errorMessage, 'error');
    } finally {
      this.isSubmitting = false;
      const submitBtn = document.getElementById('submit-payment-btn');
      const submitSpinner = document.getElementById('submit-spinner');
      if (submitBtn && submitSpinner) {
        submitBtn.disabled = false;
        submitSpinner.style.display = 'none';
      }

      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.innerHTML = '';
        appContainer.appendChild(this.render());
      }
    }
  }
  
  async handleSpecialOfferingSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (this.isSubmitting) return;
      this.isSubmitting = true;
      
      const form = e.target;
      
      // Disable submit button immediately
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
      }
      
      const offeringName = form.querySelector('#offeringName').value;
      const offeringDescription = form.querySelector('#offeringDescription').value;
      const startDate = form.querySelector('#offeringStartDate').value;
      const endDate = form.querySelector('#offeringEndDate').value;
      const targetAmount = parseFloat(form.querySelector('#offeringTarget').value) || null;
      
      if (!offeringName) {
        throw new Error('Enter a valid offering name');
      }
      
      const startDateObj = new Date(startDate);
      const endDateObj = endDate ? new Date(endDate) : null;
      
      if (isNaN(startDateObj.getTime())) {
        throw new Error('Enter a valid start date');
      }
      
      if (endDateObj && endDateObj <= startDateObj) {
        throw new Error('End date must be after start date');
      }
      
      const offeringData = {
        name: offeringName,
        description: offeringDescription,
        startDate,
        endDate: endDate || null,
        targetAmount,
        isActive: true
      };
      
      console.log('Submitting offering data:', offeringData);
      
      const response = await this.queueApiRequest(() => 
        this.apiService.createSpecialOffering(offeringData)
      );
      
      console.log('Special offering creation response:', response);
      
      this.successMessage = `Special offering "${offeringName}" created successfully!`;
      this.errorMessage = '';
      form.reset();
      this.toggleSpecialOfferingModal(false);
      this.showNotification(this.successMessage, 'success');

      // Force complete reload to show new offering
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error creating special offering:', error);
      this.errorMessage = error.message || 'Failed to create special offering';
      this.showNotification(this.errorMessage, 'error');
      await this.loadSpecialOfferings();
    } finally {
      this.isSubmitting = false;
      
      // Re-enable submit button
      const form = document.getElementById('special-offering-form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      }
    }
  }
  
  showNotification(message, type = 'success') {
    const existingNotifications = document.querySelectorAll('.futuristic-notification');
    existingNotifications.forEach(notification => {
      document.body.removeChild(notification);
    });
    
    const notification = this.createElement('div', {
      className: 'futuristic-notification',
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
        maxWidth: '90%',
        width: '350px',
        animation: 'fadeIn 0.3s ease-out',
        background: type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
        border: `1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'Inter, sans-serif'
      }
    });
    
    const icon = this.createElement('div', {
      style: {
        flexShrink: '0',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px'
      }
    }, type === 'success' ? '✓' : '!');
    
    const messageText = this.createElement('div', {
      style: {
        flex: '1',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, message);
    
    const closeButton = this.createElement('button', {
      style: {
        background: 'none',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '0',
        lineHeight: '1',
        transition: 'color 0.15s ease',
        marginLeft: 'auto'
      },
      onMouseenter: (e) => {
        e.currentTarget.style.color = '#fff';
      },
      onMouseleave: (e) => {
        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
      },
      onClick: () => {
        if (notification.parentNode) {
          notification.style.animation = 'fadeOut 0.3s ease-out';
          setTimeout(() => {
            if (notification.parentNode) {
              document.body.removeChild(notification);
            }
          }, 300);
        }
      }
    }, '×');
    
    notification.appendChild(icon);
    notification.appendChild(messageText);
    notification.appendChild(closeButton);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 5000);
  }
}