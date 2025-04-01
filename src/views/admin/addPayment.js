// src/views/admin/futuristicAddPayment.js
import { BaseComponent } from '../../utils/BaseComponent.js';

export class AdminAddPaymentView extends BaseComponent {
  constructor() {
    super();
    this.title = 'Add Payment';
    this.authService = window.authService;
    this.user = this.authService ? this.authService.getUser() : null;
    this.apiService = window.apiService;
    
    // API Request Throttling - Enhanced for robust security
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 350; // Slightly increased for better stability
    this.maxConcurrentRequests = 2; // Limit concurrent requests
    this.requestsInLastMinute = 0;
    this.rateLimitResetTime = Date.now() + 60000;
    
    // User Data Management
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
      titheDistribution: {
        localChurchBudget: 0,
        worldMissionBudget: 0,
        churchDevelopment: 0,
        thanksgivingOffering: 0,
        thirteenthSabbath: 0,
        other: 0,
        otherSpecification: ''
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
  
  // Enhanced API Request Throttling with rate limiting
  queueApiRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      // Rate limiting
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
    
    // Process only up to maxConcurrentRequests
    const activeRequests = this.apiRequestQueue.splice(0, this.maxConcurrentRequests);
    
    activeRequests.forEach(requestData => {
      const { request, resolve, reject } = requestData;
      
      // Add jitter to prevent synchronized requests
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
      const response = await this.queueApiRequest(() => this.apiService.getAllUsers());
      this.users = response.users || [];
    } catch (error) {
      console.error('Error loading users:', error);
      this.users = [];
      throw error;
    }
  }

  async loadSpecialOfferings() {
    try {
      console.log('Attempting to load special offerings...');
      
      // Show a loading indicator if desired
      const paymentTypeSelect = document.getElementById('paymentType');
      if (paymentTypeSelect) {
        const optGroup = paymentTypeSelect.querySelector('optgroup[label="Special Offerings"]');
        if (optGroup) {
          optGroup.innerHTML = '<option value="" disabled>Loading...</option>';
        }
      }
      
      // Use the enhanced API service to get special offerings
      const response = await this.queueApiRequest(() => this.apiService.getSpecialOfferings(false));
      
      console.log('Special offerings response:', response);
      
      // Process and store the offerings
      if (response && response.specialOfferings && response.specialOfferings.length > 0) {
        this.specialOfferings = response.specialOfferings.map(offering => ({
          id: offering.id || offering.offeringType.replace('SPECIAL_', ''),
          paymentType: offering.offeringType,
          description: offering.name || 'Special Offering',
          fullDescription: offering.description || offering.name || '',
          descriptionSummary: offering.name || 'Special Offering',
          startDate: offering.startDate,
          endDate: offering.endDate || null,
          targetGoal: parseFloat(offering.targetGoal || 0),
          customFields: Array.isArray(offering.customFields) ? offering.customFields : [],
          isTemplate: true // Always mark as template in our client-side data model
        }));
        
        console.log('Processed special offerings:', this.specialOfferings);
      } else {
        console.log('No special offerings found or empty response');
        this.specialOfferings = [];
      }
      
      // Update the dropdown with the loaded offerings
      this.updateSpecialOfferingsDropdown();
    } catch (error) {
      console.error('Error loading special offerings:', error);
      this.specialOfferings = []; // Ensure we have an empty array on error
    }
  }
  // New method to update the dropdown
  updateSpecialOfferingsDropdown() {
    const paymentTypeSelect = document.getElementById('paymentType');
    if (!paymentTypeSelect) return;
    
    // Find or create the special offerings optgroup
    let optGroup = paymentTypeSelect.querySelector('optgroup[label="Special Offerings"]');
    if (!optGroup) {
      optGroup = document.createElement('optgroup');
      optGroup.label = 'Special Offerings';
      paymentTypeSelect.appendChild(optGroup);
    }
    
    // Clear existing options
    optGroup.innerHTML = '';
    
    // Handle empty array
    if (!this.specialOfferings || this.specialOfferings.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.disabled = true;
      emptyOption.textContent = 'No special offerings available';
      optGroup.appendChild(emptyOption);
      return;
    }
    
    // Sort offerings by date (most recent first)
    const sortedOfferings = [...this.specialOfferings].sort((a, b) => {
      return new Date(b.startDate) - new Date(a.startDate);
    });
    
    console.log('Sorted offerings for dropdown:', sortedOfferings);
    
    // Add each offering as an option
    sortedOfferings.forEach(offering => {
      // Skip invalid offerings
      if (!offering || !offering.paymentType) {
        console.warn('Invalid special offering found:', offering);
        return;
      }
      
      const offeringName = offering.description || offering.name || 'Special Offering';
      console.log('Adding offering to dropdown:', offering.paymentType, offeringName);
      
      const optionElement = document.createElement('option');
      optionElement.value = offering.paymentType;
      optionElement.textContent = offeringName;
      optionElement.dataset.description = offering.fullDescription || offering.description || offeringName;
      optionElement.dataset.target = offering.targetGoal || 0;
      
      // Add data attributes for active status
      const now = new Date();
      const endDate = offering.endDate ? new Date(offering.endDate) : null;
      const isActive = !endDate || endDate > now;
      optionElement.dataset.active = isActive;
      
      // Visually mark inactive offerings
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
  
  // Update the render method to support async initialization
  render() {
    // Create container before async operations
    const container = this.createElement('div', {
      className: 'payment-container',
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

    // Add loading state
    const loadingElement = this.createElement('div', {
      className: 'loading-state',
      style: {
        textAlign: 'center',
        padding: '2rem'
      }
    }, 'Loading...');
    
    container.appendChild(loadingElement);

    // Initialize data after render
    Promise.resolve().then(async () => {
      try {
        await this.initialize();
        
        // Remove loading state
        container.removeChild(loadingElement);
        
        // Add the rest of the content
        this.addBackgroundElements();
        this.addStyles();
        container.appendChild(this.renderPageHeader());
        
        if (this.hasSubmitted) {
          container.appendChild(this.renderAlerts());
        }
        
        container.appendChild(this.renderPaymentForm());
        
        // Add modal to document.body
        document.body.appendChild(this.renderSpecialOfferingModal());
        
        // Attach event listeners
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
  
  renderUnauthorized() {
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
        animation: 'fadeIn 0.5s ease-out',
        textAlign: 'center'
      }
    });
    
    const unauthorizedMessage = this.createElement('p', {
      style: {
        fontSize: '18px',
        fontWeight: '500',
        margin: '0 0 20px 0'
      }
    }, 'Unauthorized access. Please log in with an admin account.');
    
    const loginButton = this.createElement('button', {
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        color: '#fff',
        margin: '0 auto'
      },
      onClick: () => {
        window.location.href = '/login';
      }
    }, 'Go to Login');
    
    unauthorizedDiv.appendChild(unauthorizedMessage);
    unauthorizedDiv.appendChild(loginButton);
    
    return unauthorizedDiv;
  }
  
  addBackgroundElements() {
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
      className: 'page-header animated-item',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '15px'
      }
    });
    
    // Left side: Page title with gradient
    const titleContainer = this.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column'
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
    
    // Admin navigation links
    const navLinks = this.createElement('div', {
      className: 'admin-nav-links',
      style: {
        display: 'flex',
        gap: '15px',
        marginTop: '10px'
      }
    });
    
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
    
    // Right side: Create Special Offering button with futuristic style
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
      
      // Success icon
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
      
      // Error icon
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
    
    // Add glow effect
    const formGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.3), transparent 70%)'
      }
    });
    formCard.appendChild(formGlow);
    
    // Form title with gradient text
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
    
    // Create form element
    const form = this.createElement('form', {
      id: 'add-payment-form'
    });
    
    // User selection and payment type row
    form.appendChild(this.renderFormRow([
      this.renderUserSelectField(),
      this.renderPaymentTypeField()
    ]));
    
    // Amount and date row
    form.appendChild(this.renderFormRow([
      this.renderAmountField(),
      this.renderDateField()
    ]));
    
    // Description field
    form.appendChild(this.renderDescriptionField());
    
    // Tithe distribution section (initially hidden)
    form.appendChild(this.renderTitheDistributionSection());
    
    // Form actions
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
        gap: '20px',
        marginBottom: '25px'
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
    
    // Label with floating effect
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
    
    // Custom select container
    const selectContainer = this.createElement('div', {
      className: 'custom-select-container',
      style: {
        position: 'relative'
      }
    });
    
    // Input with futuristic styling
    const userSearch = this.createElement('input', {
      type: 'text',
      id: 'userSearch',
      className: 'futuristic-input',
      placeholder: 'Search member by name or phone...',
      autoComplete: 'off'
    });
    
    // Hidden input for the selected user ID
    const userIdInput = this.createElement('input', {
      type: 'hidden',
      id: 'userId',
      name: 'userId',
      value: this.formData.userId
    });
    
    // Dropdown for results
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
    
    // Label
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
    
    // Styled select wrapper
    const selectWrapper = this.createElement('div', {
      className: 'select-wrapper',
      style: {
        position: 'relative'
      }
    });
    
    // Select element with futuristic styling
    const paymentTypeSelect = this.createElement('select', {
      id: 'paymentType',
      className: 'futuristic-select'
    });
    
    // Add initial placeholder option
    const placeholderOption = this.createElement('option', {
      value: '',
      disabled: true,
      selected: true
    }, 'Select payment type');
    paymentTypeSelect.appendChild(placeholderOption);
    
    // Regular payment options
    const regularOptions = [
      { value: 'TITHE', label: 'Tithe' },
      { value: 'OFFERING', label: 'Offering' },
      { value: 'DONATION', label: 'Donation' },
      { value: 'OTHER', label: 'Other' }
    ];
    
    // Create basic offerings optgroup
    const basicOptGroup = this.createElement('optgroup', {
      label: 'Standard Payment Types'
    });
    
    // Add regular options
    regularOptions.forEach(option => {
      const optionElement = this.createElement('option', {
        value: option.value
      }, option.label);
      
      basicOptGroup.appendChild(optionElement);
    });
    
    paymentTypeSelect.appendChild(basicOptGroup);
    
    // Add special offerings if available
    if (this.specialOfferings && this.specialOfferings.length > 0) {
      // Create optgroup
      const optGroup = this.createElement('optgroup', {
        label: 'Special Offerings'
      });
      
      console.log('Adding special offerings to dropdown:', this.specialOfferings.length);
      
      // Add each special offering
      this.specialOfferings.forEach(offering => {
        // Ensure we have a valid offering with paymentType
        if (!offering || !offering.paymentType) {
          console.warn('Invalid special offering found:', offering);
          return;
        }
        
        const offeringName = offering.description || offering.name || 'Special Offering';
        console.log('Adding offering to dropdown:', offering.paymentType, offeringName);
        
        const optionElement = this.createElement('option', {
          value: offering.paymentType,
          'data-description': offering.fullDescription || offering.description || offeringName,
          'data-target': offering.targetGoal || 0
        }, offeringName);
        
        optGroup.appendChild(optionElement);
      });
      
      // Only add the optgroup if it has children
      if (optGroup.childNodes.length > 0) {
        paymentTypeSelect.appendChild(optGroup);
      }
    }
    
    // Down arrow icon for select
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
    
    // Create a div for special offering info that will appear when a special offering is selected
    const specialOfferingInfo = this.createElement('div', {
      id: 'special-offering-info',
      style: {
        marginTop: '10px',
        padding: '12px 15px',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
        borderLeft: '3px solid #3b82f6',
        display: 'none'
      }
    });
    
    const offeringTitle = this.createElement('div', {
      id: 'offering-title',
      style: {
        fontWeight: '600',
        marginBottom: '5px',
        color: '#e0e7ff'
      }
    }, '');
    
    const offeringDescription = this.createElement('div', {
      id: 'offering-description',
      style: {
        fontSize: '13px',
        color: '#94a3b8',
        marginBottom: '8px'
      }
    }, '');
    
    const offeringProgress = this.createElement('div', {
      style: {
        marginTop: '10px'
      }
    });
    
    const progressLabel = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#94a3b8',
        marginBottom: '5px'
      }
    });
    
    const progressLabelText = this.createElement('span', {}, 'Progress:');
    const progressValue = this.createElement('span', {
      id: 'offering-progress-value'
    }, '0%');
    
    progressLabel.appendChild(progressLabelText);
    progressLabel.appendChild(progressValue);
    
    const progressBar = this.createElement('div', {
      style: {
        height: '6px',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '3px',
        overflow: 'hidden'
      }
    });
    
    const progressFill = this.createElement('div', {
      id: 'offering-progress-fill',
      style: {
        height: '100%',
        width: '0%',
        backgroundColor: '#3b82f6',
        borderRadius: '3px',
        transition: 'width 0.5s ease'
      }
    });
    
    progressBar.appendChild(progressFill);
    
    offeringProgress.appendChild(progressLabel);
    offeringProgress.appendChild(progressBar);
    
    specialOfferingInfo.appendChild(offeringTitle);
    specialOfferingInfo.appendChild(offeringDescription);
    specialOfferingInfo.appendChild(offeringProgress);
    
    fieldGroup.appendChild(specialOfferingInfo);
    
    return fieldGroup;
  }
  
  renderAmountField() {
    const fieldGroup = this.createElement('div', {
      className: 'form-group'
    });
    
    // Label
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
    
    // Input group with currency
    const inputGroup = this.createElement('div', {
      className: 'input-group',
      style: {
        display: 'flex',
        position: 'relative'
      }
    });
    
    // Currency prefix
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
    
    // Amount input with futuristic styling
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
    
    // Label
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
    
    // Date input with futuristic styling
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
    
    // Label
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
    
    // Textarea with futuristic styling
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
    
    // Title
    const titleRow = this.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }
    });
    
    const sectionTitle = this.createElement('h3', {
      style: {
        fontSize: '18px',
        fontWeight: '600',
        margin: '0',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent'
      }
    }, 'Tithe Distribution');
    
    // Even distribution toggle
    const distributionToggle = this.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center'
      }
    });
    
    const toggleLabel = this.createElement('span', {
      style: {
        color: '#94a3b8',
        fontSize: '14px',
        marginRight: '10px'
      }
    }, 'Even Distribution');
    
    const toggleSwitch = this.createElement('label', {
      className: 'toggle-switch',
      style: {
        position: 'relative',
        display: 'inline-block',
        width: '46px',
        height: '24px',
        margin: '0'
      }
    });
    
    const toggleInput = this.createElement('input', {
      type: 'checkbox',
      id: 'evenDistribution',
      style: {
        opacity: '0',
        width: '0',
        height: '0'
      }
    });
    
    const toggleSlider = this.createElement('span', {
      className: 'toggle-slider',
      style: {
        position: 'absolute',
        cursor: 'pointer',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        transition: '.4s',
        borderRadius: '24px',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }
    });
    
    // Add the toggle slider "knob"
    const toggleKnob = this.createElement('span', {
      style: {
        position: 'absolute',
        content: '""',
        height: '18px',
        width: '18px',
        left: '3px',
        bottom: '2px',
        backgroundColor: '#94a3b8',
        transition: '.4s',
        borderRadius: '50%'
      }
    });
    toggleSlider.appendChild(toggleKnob);
    
    const equalPercent = this.createElement('span', {
      id: 'tithe-equal-percent',
      style: {
        color: '#3b82f6',
        fontSize: '14px',
        fontWeight: '500',
        marginLeft: '10px'
      }
    }, '16.67% each');
    
    toggleSwitch.appendChild(toggleInput);
    toggleSwitch.appendChild(toggleSlider);
    
    distributionToggle.appendChild(toggleLabel);
    distributionToggle.appendChild(toggleSwitch);
    distributionToggle.appendChild(equalPercent);
    
    titleRow.appendChild(sectionTitle);
    titleRow.appendChild(distributionToggle);
    
    titheSection.appendChild(titleRow);
    
    // Subtitle
    const subtitle = this.createElement('p', {
      style: {
        color: '#94a3b8',
        fontSize: '14px',
        marginTop: '0',
        marginBottom: '25px'
      }
    }, 'Specify how the tithe should be distributed:');
    
    titheSection.appendChild(subtitle);
    
    // Tithe category sliders
    const categoriesContainer = this.createElement('div', {
      className: 'tithe-category-sliders',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }
    });
    
    // Define the tithe categories
    const titheCategories = [
      { id: 'localChurchBudget', label: 'Local Church Budget' },
      { id: 'worldMissionBudget', label: 'World Mission Budget' },
      { id: 'churchDevelopment', label: 'Church Development' },
      { id: 'thanksgivingOffering', label: 'Thanksgiving Offering' },
      { id: 'thirteenthSabbath', label: '13th Sabbath Offering' },
      { id: 'other', label: 'Other' }
    ];
    
    // Create sliders for each category
    titheCategories.forEach((category, index) => {
      const categoryItem = this.createElement('div', {
        className: 'tithe-category',
        style: {
          marginBottom: '15px',
          paddingBottom: index < titheCategories.length - 1 ? '15px' : '0',
          borderBottom: index < titheCategories.length - 1 ? '1px solid rgba(30, 41, 59, 0.8)' : 'none'
        }
      });
      
      // Header with label and values
      const categoryHeader = this.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px'
        }
      });
      
      // Category label
      const categoryLabel = this.createElement('label', {
        htmlFor: category.id,
        style: {
          color: '#e0e7ff',
          fontSize: '14px',
          fontWeight: '500',
          margin: '0'
        }
      }, category.label);
      
      // Value displays
      const valueDisplay = this.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }
      });
      
      // Amount display
      const amountDisplay = this.createElement('span', {
        id: `${category.id}-amount`,
        style: {
          color: '#3b82f6',
          fontSize: '14px',
          fontWeight: '500'
        }
      }, 'KES 0.00');
      
      // Percentage display
      const percentDisplay = this.createElement('span', {
        id: `${category.id}-percent`,
        style: {
          color: '#94a3b8',
          fontSize: '14px',
          fontWeight: '500',
          width: '50px',
          textAlign: 'right'
        }
      }, '0%');
      
      valueDisplay.appendChild(amountDisplay);
      valueDisplay.appendChild(percentDisplay);
      
      categoryHeader.appendChild(categoryLabel);
      categoryHeader.appendChild(valueDisplay);
      
      // Slider with glow effect
      const sliderContainer = this.createElement('div', {
        style: {
          position: 'relative',
          marginTop: '15px',
          marginBottom: '5px'
        }
      });
      
      // Slider background track
      const sliderTrack = this.createElement('div', {
        style: {
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          left: '0',
          right: '0',
          height: '6px',
          backgroundColor: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '3px',
          overflow: 'hidden'
        }
      });
      
      // Actual range input
      const sliderInput = this.createElement('input', {
        type: 'range',
        id: `${category.id}-slider`,
        className: 'neo-slider',
        min: '0',
        max: '100',
        value: '16.67',
        style: {
          width: '100%',
          margin: '0',
          height: '30px',
          appearance: 'none',
          background: 'transparent',
          outline: 'none',
          position: 'relative',
          zIndex: '2'
        }
      });
      
      sliderContainer.appendChild(sliderTrack);
      sliderContainer.appendChild(sliderInput);
      
      // Hidden numerical input
      const hiddenInput = this.createElement('input', {
        type: 'number',
        id: category.id,
        className: 'tithe-input',
        value: '0',
        step: '0.01',
        min: '0',
        style: {
          display: 'none'
        }
      });
      
      categoryItem.appendChild(categoryHeader);
      categoryItem.appendChild(sliderContainer);
      categoryItem.appendChild(hiddenInput);
      
      // Special case for "Other" category
      if (category.id === 'other') {
        const otherSpecification = this.createElement('div', {
          style: {
            marginTop: '15px'
          }
        });
        
        const otherLabel = this.createElement('label', {
          htmlFor: 'otherSpecification',
          style: {
            display: 'block',
            color: '#94a3b8',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '10px'
          }
        }, 'Other Specification');
        
        const otherInput = this.createElement('input', {
          type: 'text',
          id: 'otherSpecification',
          className: 'futuristic-input',
          placeholder: 'Specify other tithe allocation',
          style: {
            marginTop: '5px'
          }
        });
        
        otherSpecification.appendChild(otherLabel);
        otherSpecification.appendChild(otherInput);
        categoryItem.appendChild(otherSpecification);
      }
      
      categoriesContainer.appendChild(categoryItem);
    });
    
    titheSection.appendChild(categoriesContainer);
    
    // Totals section
    const totalsSection = this.createElement('div', {
      className: 'tithe-totals',
      style: {
        marginTop: '30px',
        borderTop: '1px solid rgba(30, 41, 59, 0.8)',
        paddingTop: '20px',
        textAlign: 'right'
      }
    });
    
    // Total distribution
    const totalDistribution = this.createElement('div', {
      style: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#e0e7ff',
        marginBottom: '8px'
      }
    });
    
    const totalLabel = document.createTextNode('Total Distribution: ');
    const totalValue = this.createElement('span', {
      id: 'tithe-total',
      style: {
        color: '#3b82f6'
      }
    }, 'KES 0.00');
    
    totalDistribution.appendChild(totalLabel);
    totalDistribution.appendChild(totalValue);
    
    // Remaining amount
    const remainingAmount = this.createElement('div', {
      id: 'tithe-remaining',
      style: {
        fontSize: '14px',
        color: '#94a3b8'
      }
    });
    
    const remainingLabel = document.createTextNode('Remaining to allocate: ');
    const remainingValue = this.createElement('span', {
      id: 'remaining-amount',
      style: {
        fontWeight: '600',
        color: '#ef4444'
      }
    }, 'KES 0.00');
    
    remainingAmount.appendChild(remainingLabel);
    remainingAmount.appendChild(remainingValue);
    
    totalsSection.appendChild(totalDistribution);
    totalsSection.appendChild(remainingAmount);
    
    titheSection.appendChild(totalsSection);
    
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
    
    // Submit button with spinner
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
    
    // Spinner (hidden by default)
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
    // Modal background
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
        justifyContent: 'center'
      }
    });
    
    // Modal content
    const modalContent = this.createElement('div', {
      className: 'neo-card',
      style: {
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        animation: 'modalFadeIn 0.3s ease-out'
      }
    });
    
    // Modal header
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
    
    // Modal body
    const modalBody = this.createElement('div', {
      style: {
        padding: '25px'
      }
    });
    
    // Create form for special offering
    const offeringForm = this.createElement('form', {
      id: 'special-offering-form'
    });
    
    // Offering name field
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
      required: true
    });
    
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    
    // Description field
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
      required: true
    });
    
    descriptionField.appendChild(descriptionLabel);
    descriptionField.appendChild(descriptionTextarea);
    
    // Date fields in a row
    const dateRow = this.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }
    });
    
    // Start date
    const startDateField = this.createElement('div');
    
    const startDateLabel = this.createElement('label', {
      htmlFor: 'startDate',
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
      id: 'startDate',
      className: 'futuristic-input',
      value: this.formatDate(new Date()),
      required: true
    });
    
    startDateField.appendChild(startDateLabel);
    startDateField.appendChild(startDateInput);
    
    // End date
    const endDateField = this.createElement('div');
    
    const endDateLabel = this.createElement('label', {
      htmlFor: 'endDate',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'End Date');
    
    // Calculate default end date (30 days from now)
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 30);
    
    const endDateInput = this.createElement('input', {
      type: 'date',
      id: 'endDate',
      className: 'futuristic-input',
      value: this.formatDate(defaultEndDate),
      required: true
    });
    
    endDateField.appendChild(endDateLabel);
    endDateField.appendChild(endDateInput);
    
    dateRow.appendChild(startDateField);
    dateRow.appendChild(endDateField);
    
    // Target goal field
    const goalField = this.createElement('div', {
      style: {
        marginBottom: '20px'
      }
    });
    
    const goalLabel = this.createElement('label', {
      htmlFor: 'targetGoal',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Target Goal (optional)');
    
    // Input group with currency
    const goalInputGroup = this.createElement('div', {
      style: {
        display: 'flex',
        position: 'relative'
      }
    });
    
    // Currency prefix
    const goalCurrencyPrefix = this.createElement('div', {
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
    
    const goalInput = this.createElement('input', {
      type: 'number',
      id: 'targetGoal',
      className: 'futuristic-input',
      style: {
        borderRadius: '0 12px 12px 0'
      },
      placeholder: '0.00',
      min: '0',
      step: '0.01'
    });
    
    goalInputGroup.appendChild(goalCurrencyPrefix);
    goalInputGroup.appendChild(goalInput);
    
    goalField.appendChild(goalLabel);
    goalField.appendChild(goalInputGroup);
    
    // Custom fields section
    const customFieldsSection = this.createElement('div', {
      style: {
        marginBottom: '10px'
      }
    });
    
    const customFieldsLabel = this.createElement('label', {
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Custom Fields (optional)');
    
    const customFieldsDescription = this.createElement('p', {
      style: {
        color: '#64748b',
        fontSize: '13px',
        margin: '0 0 15px'
      }
    }, 'Add any custom fields needed for this offering (e.g., T-shirt size, age group)');
    
    const customFieldsContainer = this.createElement('div', {
      id: 'custom-fields-container'
    });
    
    const addCustomFieldBtn = this.createElement('button', {
      type: 'button',
      id: 'add-custom-field-btn',
      style: {
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        color: '#94a3b8',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '13px',
        cursor: 'pointer',
        marginTop: '15px',
        transition: 'all 0.15s ease'
      },
      onMouseenter: (e) => {
        e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
        e.currentTarget.style.color = '#e0e7ff';
      },
      onMouseleave: (e) => {
        e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
        e.currentTarget.style.color = '#94a3b8';
      },
      onClick: () => {
        this.addCustomField();
      }
    });
    
    const btnIcon = this.createElement('span', {
      style: {
        marginRight: '5px'
      }
    }, '+');
    
    const btnText = document.createTextNode('Add Custom Field');
    
    addCustomFieldBtn.appendChild(btnIcon);
    addCustomFieldBtn.appendChild(btnText);
    
    customFieldsSection.appendChild(customFieldsLabel);
    customFieldsSection.appendChild(customFieldsDescription);
    customFieldsSection.appendChild(customFieldsContainer);
    customFieldsSection.appendChild(addCustomFieldBtn);
    
    // Add all fields to the form
    offeringForm.appendChild(nameField);
    offeringForm.appendChild(descriptionField);
    offeringForm.appendChild(dateRow);
    offeringForm.appendChild(goalField);
    offeringForm.appendChild(customFieldsSection);
    
    modalBody.appendChild(offeringForm);
    
    // Modal footer
    const modalFooter = this.createElement('div', {
      style: {
        padding: '15px 25px',
        borderTop: '1px solid rgba(30, 41, 59, 0.8)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '15px'
      }
    });
    
    // Cancel button
    const cancelButton = this.createElement('button', {
      type: 'button',
      className: 'futuristic-button close-modal',
      style: {
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        color: '#94a3b8'
      },
      onClick: () => {
        this.toggleSpecialOfferingModal(false);
      }
    }, 'Cancel');
    
    // Create button
    const createButton = this.createElement('button', {
      type: 'submit',
      form: 'special-offering-form',
      id: 'create-offering-btn',
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        color: '#10b981'
      }
    });
    
    // Spinner for create button
    const offeringSpinner = this.createElement('span', {
      id: 'offering-spinner',
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
    
    const createButtonText = document.createTextNode('Create Special Offering');
    
    createButton.appendChild(offeringSpinner);
    createButton.appendChild(createButtonText);
    
    modalFooter.appendChild(cancelButton);
    modalFooter.appendChild(createButton);
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    
    modal.appendChild(modalContent);
    
    return modal;
  }
  
  addStyles() {
    if (!document.getElementById('futuristic-payment-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'futuristic-payment-styles';
      styleElement.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        /* Global styles */
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
        
        /* Neo card design */
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
        
        /* Form elements */
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
        
        /* Range slider styling */
        .neo-slider {
          appearance: none;
          width: 100%;
          height: 30px;
          cursor: pointer;
        }
        
        .neo-slider::-webkit-slider-thumb {
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          border: 2px solid rgba(15, 23, 42, 0.8);
          transition: all 0.2s ease;
        }
        
        .neo-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.7);
        }
        
        .neo-slider::-webkit-slider-thumb:active {
          transform: scale(0.95);
        }
        
        .neo-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          border: 2px solid rgba(15, 23, 42, 0.8);
          transition: all 0.2s ease;
        }
        
        .neo-slider::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.7);
        }
        
        .neo-slider::-moz-range-thumb:active {
          transform: scale(0.95);
        }
        
        /* Toggle switch */
        input:checked + .toggle-slider {
          background-color: rgba(59, 130, 246, 0.4);
          border-color: rgba(59, 130, 246, 0.4);
        }
        
        input:checked + .toggle-slider > span {
          transform: translateX(22px);
          background-color: #3b82f6;
        }
        
        /* Buttons */
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
        
        /* Custom select dropdown */
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
        
        /* Animations */
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
        
        /* Responsive design */
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
        }
        
        /* Mobile device optimizations */
        @media (max-width: 480px) {
          .futuristic-input, .futuristic-textarea, .futuristic-select {
            font-size: 16px; /* Prevents zooming on iOS */
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
          
          /* Make form elements touch-friendly */
          .neo-slider::-webkit-slider-thumb {
            width: 26px;
            height: 26px;
          }
          
          .neo-slider::-moz-range-thumb {
            width: 26px;
            height: 26px;
          }
          
          /* Ensure adequate spacing for touch targets */
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
    
    // Add click event listeners to dropdown items
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
  
  initializeTitheDistribution() {
    const titheFields = [
      'localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
      'thanksgivingOffering', 'thirteenthSabbath', 'other'
    ];
    
    // Apply even distribution initially
    const equalPercent = 100 / titheFields.length;
    
    titheFields.forEach(field => {
      const slider = document.getElementById(`${field}-slider`);
      if (slider) {
        slider.value = equalPercent;
        this.updateSliderValue(field, equalPercent);
      }
    });
    
    this.updateTitheDistribution();
  }
  
  applyEvenDistribution() {
    const titheFields = [
      'localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
      'thanksgivingOffering', 'thirteenthSabbath', 'other'
    ];
    
    // Calculate equal percentage with precision control
    const equalPercent = Math.floor((100 / titheFields.length) * 10) / 10; // 16.6
    
    // Apply equal percentage to first 5 fields
    for (let i = 0; i < titheFields.length - 1; i++) {
      const field = titheFields[i];
      const slider = document.getElementById(`${field}-slider`);
      if (slider) {
        slider.value = equalPercent;
        this.updateSliderValue(field, equalPercent);
      }
    }
    
    // Calculate the remainder for the last field to ensure total is exactly 100%
    const remainingPercent = 100 - (equalPercent * (titheFields.length - 1));
    
    // Apply to the last field
    const lastField = titheFields[titheFields.length - 1];
    const lastSlider = document.getElementById(`${lastField}-slider`);
    if (lastSlider) {
      lastSlider.value = remainingPercent;
      this.updateSliderValue(lastField, remainingPercent);
    }
    
    // Update the tithe equal percent display
    const equalPercentElement = document.getElementById('tithe-equal-percent');
    if (equalPercentElement) {
      equalPercentElement.textContent = `~${equalPercent}% each`;
    }
    
    this.updateTitheTotal();
  }
  
  // Also fix the initializeTitheDistribution method
  initializeTitheDistribution() {
    // Simply delegate to applyEvenDistribution which now has the correct logic
    this.applyEvenDistribution();
  }
  
  
  updateSliderValue(field, percent) {
    const slider = document.getElementById(`${field}-slider`);
    const input = document.getElementById(field);
    const percentElement = document.getElementById(`${field}-percent`);
    const amountElement = document.getElementById(`${field}-amount`);
    
    if (!slider || !input || !percentElement || !amountElement) return;
    
    // Round percent to 1 decimal place to avoid tiny floating point errors
    const roundedPercent = Math.round(percent * 10) / 10;
    
    // Update the slider value
    slider.value = roundedPercent;
    
    // Update the percent display
    percentElement.textContent = `${roundedPercent.toFixed(1)}%`;
    
    // Update the amount based on total amount and percentage
    const amountInput = document.getElementById('amount');
    const totalAmount = parseFloat(amountInput.value) || 0;
    
    // Calculate amount with precise decimal handling to avoid floating point errors
    const amount = Math.round((totalAmount * (roundedPercent / 100)) * 100) / 100;
    
    // Update the amount display
    amountElement.textContent = `KES ${amount.toFixed(2)}`;
    
    // Update the hidden input value
    input.value = amount;
    
    // Recalculate totals
    this.updateTitheTotal();
  }
  
  updateTitheDistribution() {
    const titheFields = [
      'localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
      'thanksgivingOffering', 'thirteenthSabbath', 'other'
    ];
    
    const amountInput = document.getElementById('amount');
    const totalAmount = parseFloat(amountInput.value) || 0;
    
    // Apply current percentages to the new amount
    titheFields.forEach(field => {
      const slider = document.getElementById(`${field}-slider`);
      if (slider) {
        const percent = parseFloat(slider.value);
        
        // Calculate amount with precise rounding
        const amount = Math.round((totalAmount * (percent / 100)) * 100) / 100;
        
        const amountElement = document.getElementById(`${field}-amount`);
        const input = document.getElementById(field);
        
        if (amountElement) {
          amountElement.textContent = `KES ${amount.toFixed(2)}`;
        }
        
        if (input) {
          input.value = amount;
        }
      }
    });
    
    this.updateTitheTotal();
  }
  
  updateTitheTotal() {
    const titheFields = [
      'localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
      'thanksgivingOffering', 'thirteenthSabbath', 'other'
    ];
    
    let total = 0;
    let totalPercentage = 0;
    
    titheFields.forEach(field => {
      const input = document.getElementById(field);
      const slider = document.getElementById(`${field}-slider`);
      
      if (input && slider) {
        total += parseFloat(input.value) || 0;
        totalPercentage += parseFloat(slider.value) || 0;
      }
    });
    
    // Round values to avoid floating point issues
    total = Math.round(total * 100) / 100;
    totalPercentage = Math.round(totalPercentage * 100) / 100;
    
    const titheTotalElement = document.getElementById('tithe-total');
    const amountInput = document.getElementById('amount');
    const totalAmount = parseFloat(amountInput.value) || 0;
    const titheRemainingElement = document.getElementById('tithe-remaining');
    
    if (titheTotalElement) {
      titheTotalElement.textContent = `KES ${total.toFixed(2)}`;
    }
    
    if (titheRemainingElement) {
      // Calculate remaining with precise rounding
      const remaining = Math.round((totalAmount - total) * 100) / 100;
      
      // Check if percentages add up to 100%
      const percentageMessage = Math.abs(totalPercentage - 100) > 0.1 ? 
  `<span style="color: #ef4444; display: block; margin-top: 5px;">Percentages must add up to 100% (currently: ${totalPercentage.toFixed(1)}%)</span>` : '';
      
      if (Math.abs(remaining) < 0.01 && Math.abs(totalPercentage - 100) < 0.1) {
        // Fully allocated (within rounding error) and percentages correct
        titheRemainingElement.innerHTML = `
          <span style="color: #10b981; font-weight: 500;">✓ Fully allocated</span>
        `;
      } else if (remaining < 0) {
        // Over-allocated
        titheRemainingElement.innerHTML = `
          <span style="color: #ef4444;">Overallocated by: KES ${Math.abs(remaining).toFixed(2)}</span>
          ${percentageMessage}
        `;
      } else {
        // Under-allocated
        titheRemainingElement.innerHTML = `
          Remaining to allocate: <span id="remaining-amount" style="font-weight: 600; color: #ef4444;">KES ${remaining.toFixed(2)}</span>
          ${percentageMessage}
        `;
      }
    }
  }
  
  redistributeRemainingAmount(changedField, amountDifference) {
    const titheFields = [
      'localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
      'thanksgivingOffering', 'thirteenthSabbath', 'other'
    ];
    
    // Get all fields except the changed one
    const otherFields = titheFields.filter(field => field !== changedField);
    
    // Get current values of all fields
    const currentValues = {};
    titheFields.forEach(field => {
      const slider = document.getElementById(`${field}-slider`);
      if (slider) {
        currentValues[field] = parseFloat(slider.value) || 0;
      }
    });
    
    // Get the new value for the changed field
    const changedSlider = document.getElementById(`${changedField}-slider`);
    const newChangedValue = parseFloat(changedSlider.value) || 0;
    
    // Calculate total percentage after the change
    let totalPercentage = newChangedValue;
    otherFields.forEach(field => {
      totalPercentage += currentValues[field];
    });
    
    // If total is 100%, we're done
    if (Math.abs(totalPercentage - 100) < 0.1) {
      this.updateSliderValue(changedField, newChangedValue);
      return;
    }
    
    // First, update the changed field with its new value
    this.updateSliderValue(changedField, newChangedValue);
    
    // Calculate how much to adjust other fields
    const adjustment = 100 - totalPercentage;
    
    // Count fields with non-zero values
    const nonZeroFields = otherFields.filter(field => currentValues[field] > 0);
    
    if (nonZeroFields.length === 0) {
      // If no other fields have values, distribute evenly
      const perField = adjustment / otherFields.length;
      otherFields.forEach(field => {
        this.updateSliderValue(field, Math.max(0, currentValues[field] + perField));
      });
    } else {
      // Distribute proportionally among non-zero fields
      const totalNonZero = nonZeroFields.reduce((sum, field) => sum + currentValues[field], 0);
      
      if (totalNonZero > 0) {
        nonZeroFields.forEach(field => {
          const proportion = currentValues[field] / totalNonZero;
          const newValue = Math.max(0, currentValues[field] + (adjustment * proportion));
          this.updateSliderValue(field, newValue);
        });
      } else {
        // Fallback to even distribution
        const perField = adjustment / nonZeroFields.length;
        nonZeroFields.forEach(field => {
          this.updateSliderValue(field, Math.max(0, currentValues[field] + perField));
        });
      }
    }
    
    // Final adjustment to ensure exactly 100%
    this.finalizeDistribution();
  }
  
  // Add this new method to ensure the total is exactly 100%
  finalizeDistribution() {
    const titheFields = [
      'localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
      'thanksgivingOffering', 'thirteenthSabbath', 'other'
    ];
    
    // Calculate current total
    let total = 0;
    const values = {};
    
    titheFields.forEach(field => {
      const slider = document.getElementById(`${field}-slider`);
      if (slider) {
        const value = parseFloat(slider.value) || 0;
        values[field] = value;
        total += value;
      }
    });
    
    // If we're already at 100%, do nothing
    if (Math.abs(total - 100) < 0.1) {
      return;
    }
    
    // Find the field with the largest value to adjust
    let largestField = titheFields[0];
    let largestValue = values[largestField];
    
    titheFields.forEach(field => {
      if (values[field] > largestValue) {
        largestValue = values[field];
        largestField = field;
      }
    });
    
    // Adjust the largest field to make total exactly 100%
    const adjustment = 100 - total;
    const newValue = Math.max(0, values[largestField] + adjustment);
    
    // Update the largest field
    const slider = document.getElementById(`${largestField}-slider`);
    slider.value = newValue;
    this.updateSliderValue(largestField, newValue);
  }
  
  getCurrentTitheDistribution() {
    const titheFields = [
      'localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
      'thanksgivingOffering', 'thirteenthSabbath', 'other'
    ];
    
    const distribution = {};
    
    titheFields.forEach(field => {
      const input = document.getElementById(field);
      if (input) {
        distribution[field] = parseFloat(input.value) || 0;
      }
    });
    
    return distribution;
  }
  
  toggleSpecialOfferingModal(show) {
    const modal = document.getElementById('special-offering-modal');
    if (modal) {
      modal.style.display = show ? 'flex' : 'none';
      document.body.style.overflow = show ? 'hidden' : '';
      
      if (show) {
        // Reset form
        const form = document.getElementById('special-offering-form');
        if (form) form.reset();
        
        // Clear custom fields
        const container = document.getElementById('custom-fields-container');
        if (container) container.innerHTML = '';
        
        // Set default dates
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (startDateInput) startDateInput.value = this.formatDate(new Date());
        if (endDateInput) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30); // 30 days from now
          endDateInput.value = this.formatDate(endDate);
        }
      }
    }
  }
  
  addCustomField() {
    const container = document.getElementById('custom-fields-container');
    if (container) {
      const fieldId = `custom-field-${Date.now()}`;
      
      // Create field container
      const fieldContainer = this.createElement('div', {
        id: fieldId,
        className: 'custom-field',
        style: {
          marginBottom: '15px',
          position: 'relative'
        }
      });
      
      // Create field row with flex layout
      const fieldRow = this.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: '10px',
          alignItems: 'flex-start'
        }
      });
      
      // Field name input
      const nameContainer = this.createElement('div');
      const nameInput = this.createElement('input', {
        type: 'text',
        className: 'futuristic-input',
        name: 'customFieldName[]',
        placeholder: 'Field name',
        required: true,
        style: {
          marginBottom: '0'
        }
      });
      nameContainer.appendChild(nameInput);
      
      // Field description input
      const descContainer = this.createElement('div');
      const descInput = this.createElement('input', {
        type: 'text',
        className: 'futuristic-input',
        name: 'customFieldDescription[]',
        placeholder: 'Field description',
        style: {
          marginBottom: '0'
        }
      });
      descContainer.appendChild(descInput);
      
      // Remove button
      const removeContainer = this.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center'
        }
      });
      
      const removeButton = this.createElement('button', {
        type: 'button',
        className: 'remove-field',
        'data-field-id': fieldId,
        style: {
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          cursor: 'pointer',
          fontSize: '18px',
          padding: '0',
          transition: 'all 0.2s ease'
        },
        onMouseenter: (e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
        },
        onMouseleave: (e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
        },
        onClick: () => {
          document.getElementById(fieldId).remove();
        }
      }, '×');
      
      removeContainer.appendChild(removeButton);
      
      // Add all elements to the row
      fieldRow.appendChild(nameContainer);
      fieldRow.appendChild(descContainer);
      fieldRow.appendChild(removeContainer);
      
      // Add row to the container
      fieldContainer.appendChild(fieldRow);
      
      // Add field to the document
      container.appendChild(fieldContainer);
    }
  }
  
  getCustomFields() {
    const customFields = [];
    const customFieldNames = document.querySelectorAll('input[name="customFieldName[]"]');
    const customFieldDescriptions = document.querySelectorAll('input[name="customFieldDescription[]"]');
    
    for (let i = 0; i < customFieldNames.length; i++) {
      const name = customFieldNames[i].value.trim();
      if (name) {
        customFields.push({
          name,
          description: customFieldDescriptions[i]?.value.trim() || '',
          required: false
        });
      }
    }
    
    return customFields;
  }
  
  attachEventListeners() {
    // Form submission
    const form = document.getElementById('add-payment-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
    
    // Payment type change
    const paymentTypeSelect = document.getElementById('paymentType');
    if (paymentTypeSelect) {
      paymentTypeSelect.addEventListener('change', async () => {
        const titheDistributionSection = document.getElementById('tithe-distribution-section');
        const specialOfferingInfo = document.getElementById('special-offering-info');
        
        // Clear any previous special offering info
        if (specialOfferingInfo) {
          specialOfferingInfo.style.display = 'none';
        }
        
        // Handle different payment types
        if (paymentTypeSelect.value === 'TITHE') {
          // Show tithe distribution section for tithe payments
          if (titheDistributionSection) {
            titheDistributionSection.style.display = 'block';
            this.initializeTitheDistribution();
          }
        } else if (paymentTypeSelect.value === '') {
          // Handle the placeholder option - hide all special sections
          if (titheDistributionSection) {
            titheDistributionSection.style.display = 'none';
          }
        } else if (paymentTypeSelect.value.startsWith('SPECIAL_')) {
          // It's a special offering - hide tithe section
          if (titheDistributionSection) {
            titheDistributionSection.style.display = 'none';
          }
          
          // Show special offering info section
          if (specialOfferingInfo) {
            // Get the selected option
            const selectedOption = paymentTypeSelect.options[paymentTypeSelect.selectedIndex];
            const offeringTitle = document.getElementById('offering-title');
            const offeringDescription = document.getElementById('offering-description');
            const offeringProgressValue = document.getElementById('offering-progress-value');
            const offeringProgressFill = document.getElementById('offering-progress-fill');
            
            if (offeringTitle && offeringDescription) {
              offeringTitle.textContent = selectedOption.textContent;
              offeringDescription.textContent = selectedOption.getAttribute('data-description') || '';
            }
            
            // Load progress data for this special offering
            try {
              const offeringType = paymentTypeSelect.value;
              const progressData = await this.queueApiRequest(() => 
                this.apiService.getSpecialOfferingProgress(offeringType)
              );
              
              if (progressData && offeringProgressValue && offeringProgressFill) {
                const percent = Math.min(100, Math.round(progressData.percentage || 0));
                offeringProgressValue.textContent = `${percent}% (${this.formatCurrency(progressData.totalContributed || 0)} of ${this.formatCurrency(progressData.targetGoal || 0)})`;
                offeringProgressFill.style.width = `${percent}%`;
              }
            } catch (error) {
              console.warn('Could not load special offering progress:', error);
              // Set a default state even if we couldn't load progress
              if (offeringProgressValue && offeringProgressFill) {
                offeringProgressValue.textContent = '0%';
                offeringProgressFill.style.width = '0%';
              }
            }
            
            specialOfferingInfo.style.display = 'block';
          }
        } else {
          // For all other payment types, hide special sections
          if (titheDistributionSection) {
            titheDistributionSection.style.display = 'none';
          }
        }
      });
    }
    
    // User search
    const userSearchInput = document.getElementById('userSearch');
    const userDropdown = document.getElementById('userDropdown');
    
    if (userSearchInput && userDropdown) {
      // Show dropdown on focus
      userSearchInput.addEventListener('focus', () => {
        this.toggleUserDropdown(true);
      });
      
      // Filter users on input
      userSearchInput.addEventListener('input', () => {
        this.userSearchQuery = userSearchInput.value.toLowerCase();
        this.filteredUsers = this.users.filter(user => 
          (user.fullName && user.fullName.toLowerCase().includes(this.userSearchQuery)) || 
          (user.phone && user.phone.includes(this.userSearchQuery))
        );
        this.renderUserDropdown();
      });
      
      // Hide dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!userSearchInput.contains(e.target) && !userDropdown.contains(e.target)) {
          this.toggleUserDropdown(false);
        }
      });
    }
    
    // Amount input
    const amountInput = document.getElementById('amount');
    if (amountInput) {
      amountInput.addEventListener('input', () => {
        const paymentTypeSelect = document.getElementById('paymentType');
        if (paymentTypeSelect.value === 'TITHE') {
          this.updateTitheDistribution();
        }
      });
    }
    
    // Special Offering form
    const specialOfferingForm = document.getElementById('special-offering-form');
    if (specialOfferingForm) {
      specialOfferingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSpecialOfferingSubmit(e);
      });
    }
    
    // Close modal buttons
    const closeModalButtons = document.querySelectorAll('.close-modal');
    closeModalButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.toggleSpecialOfferingModal(false);
      });
    });
    
    // Modal click outside to close
    const modal = document.getElementById('special-offering-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.toggleSpecialOfferingModal(false);
        }
      });
    }
    
    // Even distribution toggle
    const evenDistributionToggle = document.getElementById('evenDistribution');
    if (evenDistributionToggle) {
      evenDistributionToggle.addEventListener('change', () => {
        if (evenDistributionToggle.checked) {
          this.applyEvenDistribution();
        }
      });
      
      // Set up tithe sliders
      const titheFields = [
        'localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
        'thanksgivingOffering', 'thirteenthSabbath', 'other'
      ];
      
      titheFields.forEach(field => {
        const slider = document.getElementById(`${field}-slider`);
        if (slider) {
          slider.addEventListener('input', () => {
            // Save current distribution before changes
            const prevDistribution = this.getCurrentTitheDistribution();
            
            // Get the new value for this field
            const newPercent = parseFloat(slider.value);
            const totalAmount = parseFloat(document.getElementById('amount').value) || 0;
            const newAmount = Math.round((totalAmount * (newPercent / 100)) * 100) / 100;
            
            // Get the old value for this field
            const oldAmount = prevDistribution[field] || 0;
            
            // Calculate difference to distribute among other fields
            const amountDifference = newAmount - oldAmount;
            
            // Check if there's a meaningful difference to adjust
            if (Math.abs(amountDifference) > 0.01) {
              this.redistributeRemainingAmount(field, amountDifference);
            } else {
              // Just update this field if the difference is negligible
              this.updateSliderValue(field, newPercent);
            }
            
            // Turn off even distribution when a slider is manually adjusted
            const evenDistributionToggle = document.getElementById('evenDistribution');
            if (evenDistributionToggle && evenDistributionToggle.checked) {
              evenDistributionToggle.checked = false;
            }
          });
        }
      });
    }
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    try {
      // Prevent double submission
      if (this.isSubmitting) return;
      this.isSubmitting = true;
      
      // Update submit button state
      const submitBtn = document.getElementById('submit-payment-btn');
      const submitSpinner = document.getElementById('submit-spinner');
      if (submitBtn && submitSpinner) {
        submitBtn.disabled = true;
        submitSpinner.style.display = 'inline-block';
      }
      
      // Get form values
      const form = e.target;
      const userId = form.querySelector('#userId').value;
      const paymentType = form.querySelector('#paymentType').value;
      const amount = parseFloat(form.querySelector('#amount').value);
      const description = form.querySelector('#description').value || '';
      const paymentDate = form.querySelector('#paymentDate').value;

      // Validate required fields
      if (!userId) {
        throw new Error('Please select a member');
      }
      
      if (!paymentType) {
        throw new Error('Please select a payment type');
      }
      
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Create base payment data
      const paymentData = {
        userId: userId, // Use selected user's ID, not admin's
        amount: amount,
        paymentType: paymentType,
        description: description,
        paymentDate: paymentDate,
        paymentMethod: 'MANUAL',
        status: 'COMPLETED',
        addedBy: this.user.id, // Track admin who added the payment
        isTemplate: false
      };

      // Handle tithe distribution if applicable
      if (paymentType === 'TITHE') {
        const titheDistribution = {};
        const fields = ['localChurchBudget', 'worldMissionBudget', 'churchDevelopment', 
                       'thanksgivingOffering', 'thirteenthSabbath', 'other'];
        
        fields.forEach(field => {
          const input = document.getElementById(field);
          if (input) {
            titheDistribution[field] = parseFloat(input.value) || 0;
          }
        });

        // Add other specification if present
        const otherSpec = document.getElementById('otherSpecification');
        if (otherSpec && otherSpec.value) {
          titheDistribution.otherSpecification = otherSpec.value;
        }

        paymentData.titheDistribution = titheDistribution;
      }

      let response;
      
      // Use appropriate API endpoint based on payment type
      if (paymentType.startsWith('SPECIAL_')) {
        response = await this.queueApiRequest(() => 
          this.apiService.post(`/special-offerings/${paymentType}/payment`, {
            userId: userId,
            amount: amount,
            description: description,
            paymentDate: paymentDate
          })
        );
      } else {
        response = await this.queueApiRequest(() => 
          this.apiService.post('/payment/manual', paymentData)
        );
      }

      // Handle successful payment
      console.log('Payment added successfully:', response);
      
      // Reset form
      form.reset();
      
      // Reset special sections
      const titheSection = document.getElementById('tithe-distribution-section');
      if (titheSection) titheSection.style.display = 'none';
      
      const specialInfo = document.getElementById('special-offering-info');
      if (specialInfo) specialInfo.style.display = 'none';
      
      // Clear user selection
      const userSearch = document.getElementById('userSearch');
      if (userSearch) userSearch.value = '';
      
      // Reset payment type
      const paymentTypeSelect = document.getElementById('paymentType');
      if (paymentTypeSelect) paymentTypeSelect.selectedIndex = 0;

      // Show success message
      this.successMessage = `Payment added successfully! Receipt Number: ${response.receiptNumber || 'Generated'}`;
      this.errorMessage = '';
      this.hasSubmitted = true;
      
      // Show notification
      this.showNotification(this.successMessage, 'success');

      // Refresh view
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.innerHTML = '';
        appContainer.appendChild(this.render());
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      this.errorMessage = error.message || 'Failed to add payment. Please try again.';
      this.successMessage = '';
      this.hasSubmitted = true;
      
      // Show error notification
      this.showNotification(this.errorMessage, 'error');
    } finally {
      // Reset submission state
      this.isSubmitting = false;
      
      // Reset button state
      const submitBtn = document.getElementById('submit-payment-btn');
      const submitSpinner = document.getElementById('submit-spinner');
      if (submitBtn && submitSpinner) {
        submitBtn.disabled = false;
        submitSpinner.style.display = 'none';
      }
    }
  }
  
  async handleSpecialOfferingSubmit(e) {
    e.preventDefault();
    
    try {
      // Prevent double submission
      if (this.isSubmitting) return;
      this.isSubmitting = true;
      
      // Update submit button
      const submitBtn = document.getElementById('create-offering-btn');
      const offeringSpinner = document.getElementById('offering-spinner');
      if (submitBtn && offeringSpinner) {
        submitBtn.disabled = true;
        offeringSpinner.style.display = 'inline-block';
      }
      
      const form = e.target;
      
      // Generate a unique ID for the special offering
      const timestamp = Date.now();
      const offeringId = `SO${timestamp}`;
      
      // Get form values
      const offeringName = form.querySelector('#offeringName').value;
      const offeringDescription = form.querySelector('#offeringDescription').value;
      const startDate = form.querySelector('#startDate').value;
      const endDate = form.querySelector('#endDate').value;
      const targetGoal = parseFloat(form.querySelector('#targetGoal').value) || 0;
      
      // Validate offering name
      if (!offeringName) {
        throw new Error('Enter a valid offering name');
      }
      
      // Validate dates
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (isNaN(startDateObj.getTime())) {
        throw new Error('Enter a valid start date');
      }
      
      if (isNaN(endDateObj.getTime())) {
        throw new Error('Enter a valid end date');
      }
      
      if (endDateObj < startDateObj) {
        throw new Error('End date must be after start date');
      }
      
      // Get custom fields
      const customFields = this.getCustomFields();
      
      // Log what we're trying to create
      console.log('Creating special offering:', { 
        offeringType: `SPECIAL_${offeringId}`,
        name: offeringName,
        description: offeringDescription,
        startDate,
        endDate,
        targetGoal,
        customFields
      });
      
      // Create the offering data object
      const offeringData = {
        offeringType: `SPECIAL_${offeringId}`,
        name: offeringName,
        description: offeringDescription,
        startDate,
        endDate,
        targetGoal,
        customFields
      };
      
      // Use the dedicated special offering endpoint through apiService
      const response = await this.queueApiRequest(() => 
        this.apiService.createSpecialOffering(offeringData)
      );
      
      console.log('Special offering created successfully:', response);
      
      // Set success message
      this.successMessage = `Special offering "${offeringName}" created successfully!`;
      this.errorMessage = '';
      
      // Close the modal
      this.toggleSpecialOfferingModal(false);
      
      // Reset form
      form.reset();
      
      // Update state
      this.hasSubmitted = true;
      this.isSubmitting = false;
      
      // Reset UI
      if (submitBtn && offeringSpinner) {
        submitBtn.disabled = false;
        offeringSpinner.style.display = 'none';
      }
      
      // Show success notification
      this.showNotification(this.successMessage, 'success');
      
      // ENHANCED RELOAD LOGIC: Directly add the new offering to the local array
      // with correct structure matching what the API would return
      const newOffering = {
        id: offeringId,
        offeringType: `SPECIAL_${offeringId}`,
        paymentType: `SPECIAL_${offeringId}`,
        name: offeringName,
        description: offeringDescription,
        fullDescription: offeringDescription,
        descriptionSummary: offeringName,
        startDate: startDate,
        endDate: endDate,
        targetGoal: targetGoal,
        customFields: customFields,
        isTemplate: true // Explicitly mark as a template
      };
      
      // Add to local array
      if (!this.specialOfferings) this.specialOfferings = [];
      this.specialOfferings.push(newOffering);
      
      // Reload special offerings with a delay to allow server processing
      setTimeout(async () => {
        try {
          await this.loadSpecialOfferings();
          console.log('Reloaded special offerings after creation:', this.specialOfferings);
          
          // Update the dropdown with the refreshed offerings
          this.updateSpecialOfferingsDropdown();
          
          // Refresh the view
          const appContainer = document.getElementById('app');
          if (appContainer) {
            appContainer.innerHTML = '';
            appContainer.appendChild(this.render());
          }
        } catch (error) {
          console.warn("Could not reload special offerings:", error);
          
          // Add new offering to dropdown anyway
          this.updateSpecialOfferingsDropdown();
          
          // Refresh the view
          const appContainer = document.getElementById('app');
          if (appContainer) {
            appContainer.innerHTML = '';
            appContainer.appendChild(this.render());
          }
        }
      }, 1000);
    } catch (error) {
      console.error('Error creating special offering:', error);
      
      // Set error message
      this.errorMessage = error.message || 'Failed to create special offering. Try again.';
      this.successMessage = '';
      
      // Update state
      this.hasSubmitted = true;
      this.isSubmitting = false;
      
      // Reset UI
      const submitBtn = document.getElementById('create-offering-btn');
      const offeringSpinner = document.getElementById('offering-spinner');
      if (submitBtn && offeringSpinner) {
        submitBtn.disabled = false;
        offeringSpinner.style.display = 'none';
      }
      
      // Show error notification
      this.showNotification(this.errorMessage, 'error');
      
      // Close the modal
      this.toggleSpecialOfferingModal(false);
      
      // Refresh the view to show the error message
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.innerHTML = '';
        appContainer.appendChild(this.render());
      }
    }
  }
  
  // Show a notification toast
  showNotification(message, type = 'success') {
    // Remove any existing notifications
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
        background: type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 
                     type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(59, 130, 246, 0.9)',
        border: `1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 
                                 type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'Inter, sans-serif'
      }
    });
    
    // Icon
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
    
    // Message text
    const messageText = this.createElement('div', {
      style: {
        flex: '1',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, message);
    
    // Close button
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
    
    // Auto-remove the notification after 5 seconds
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

async function handleRoute() {
  try {
    const path = window.location.pathname;
    const view = await resolveView(path);
    
    if (!view) {
      throw new Error('View not found');
    }
    
    const appContainer = document.getElementById('app');
    if (appContainer) {
      // Clear existing content
      appContainer.innerHTML = '';
      // Render new view
      appContainer.appendChild(view.render());
    }
  } catch (error) {
    console.error('Route handling error:', error);
    // Show error view or fallback content
    const errorView = createErrorView(error);
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = '';
      appContainer.appendChild(errorView);
    }
  }
}

function createErrorView(error) {
  const errorContainer = document.createElement('div');
  errorContainer.style.cssText = `
    padding: 2rem;
    margin: 2rem auto;
    max-width: 600px;
    text-align: center;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(239, 68, 68, 0.2);
  `;

  const errorTitle = document.createElement('h2');
  errorTitle.textContent = 'Something went wrong';
  errorTitle.style.color = '#ef4444';

  const errorMessage = document.createElement('p');
  errorMessage.textContent = error.message || 'An unexpected error occurred';
  errorMessage.style.color = '#94a3b8';

  const retryButton = document.createElement('button');
  retryButton.textContent = 'Retry';
  retryButton.onclick = () => window.location.reload();
  retryButton.style.cssText = `
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: rgba(239, 68, 68, 0.2);
    border: none;
    border-radius: 6px;
    color: #ef4444;
    cursor: pointer;
  `;

  errorContainer.appendChild(errorTitle);
  errorContainer.appendChild(errorMessage);
  errorContainer.appendChild(retryButton);

  return errorContainer;
}

// Initialize the app with error handling
async function init() {
  try {
    await handleRoute();
    // Add event listener for route changes
    window.addEventListener('popstate', handleRoute);
  } catch (error) {
    console.error('Initialization error:', error);
  }
}