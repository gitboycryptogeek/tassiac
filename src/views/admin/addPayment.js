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
    this.paymentBatch = [];
    this.existingBatches = [];
    this.currentBatchId = null;
    this.editingPaymentIndex = null;
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
    this.showBatchSelector = false;
    this.batchProcessingStatus = null;
    
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
  
  // Batch State Persistence Methods
  saveBatchState() {
    try {
      const batchState = {
        currentBatchId: this.currentBatchId,
        paymentBatch: this.paymentBatch,
        timestamp: Date.now()
      };
      localStorage.setItem('currentBatchState', JSON.stringify(batchState));
      console.log('✅ Batch state saved to localStorage');
    } catch (error) {
      console.warn('Failed to save batch state:', error);
    }
  }

  loadBatchState() {
    try {
      const savedState = localStorage.getItem('currentBatchState');
      if (!savedState) return false;

      const batchState = JSON.parse(savedState);
      
      // Check if state is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - batchState.timestamp > maxAge) {
        console.log('Batch state expired, clearing...');
        this.clearBatchState();
        return false;
      }

      this.currentBatchId = batchState.currentBatchId;
      this.paymentBatch = batchState.paymentBatch || [];
      
      console.log('✅ Batch state restored from localStorage:', {
        batchId: this.currentBatchId,
        itemCount: this.paymentBatch.length
      });
      
      return true;
    } catch (error) {
      console.warn('Failed to load batch state:', error);
      this.clearBatchState();
      return false;
    }
  }

  clearBatchState() {
    try {
      localStorage.removeItem('currentBatchState');
      console.log('🗑️ Batch state cleared from localStorage');
    } catch (error) {
      console.warn('Failed to clear batch state:', error);
    }
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

    try {
      await this.loadExistingBatches();
    } catch (error) {
      console.warn("Could not load existing batches:", error);
      this.existingBatches = [];
    }

    // Load saved batch state after all data is loaded
    const hasRestoredState = this.loadBatchState();
    if (hasRestoredState && this.currentBatchId) {
      // Verify the batch still exists and is still PENDING
      await this.validateCurrentBatch();
    }
  }

  async validateCurrentBatch() {
    if (!this.currentBatchId) return;

    try {
      const response = await this.queueApiRequest(() =>
        this.apiService.getBatchPaymentDetails(this.currentBatchId)
      );
      
      const batch = response.batchPayment;
      
      // If batch exists and is still PENDING, keep it as current
      if (batch && batch.status === 'PENDING') {
        console.log('✅ Current batch validated and restored:', batch.batchReference);
        // Update batch selector to reflect current batch
        setTimeout(() => {
          const batchSelector = document.getElementById('batch-selector');
          if (batchSelector) {
            batchSelector.value = this.currentBatchId;
          }
          this.updateBatchView();
          
          // Show notification that batch was restored
          this.showNotification(
            `Batch ${batch.batchReference} restored with ${this.paymentBatch.length} items. Add more items and click "Update Batch" to save changes to server.`, 
            'info'
          );
        }, 500);
      } else {
        // Batch no longer exists or is not PENDING, clear state
        console.log('⚠️ Current batch no longer valid, clearing state');
        this.currentBatchId = null;
        this.paymentBatch = [];
        this.clearBatchState();
      }
    } catch (error) {
      console.warn('Failed to validate current batch:', error);
      // Clear invalid batch state
      this.currentBatchId = null;
      this.paymentBatch = [];
      this.clearBatchState();
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
    } catch (error) {
      console.error('Error loading special offerings:', error);
      this.specialOfferings = [];
    }
  }

  async loadExistingBatches() {
    try {
      const response = await this.queueApiRequest(() => 
        this.apiService.getAllBatchPayments({ status: 'PENDING' })
      );
      
      this.existingBatches = response.batchPayments || [];
      this.updateBatchSelector();
    } catch (error) {
      console.error('Error loading existing batches:', error);
      this.existingBatches = [];
    }
  }

  updateSpecialOfferingsDropdown() {
    const paymentTypeSelect = document.getElementById('paymentType');
    if (!paymentTypeSelect) {
      console.log('Payment type select not found, skipping special offerings update');
      return;
    }
    
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
      console.log('No special offerings to display');
      return;
    }
    
    console.log('Adding special offerings to dropdown:', this.specialOfferings);
    
    const sortedOfferings = [...this.specialOfferings].sort((a, b) => {
      return new Date(b.startDate) - new Date(a.startDate);
    });
    
    sortedOfferings.forEach(offering => {
      if (!offering || !offering.offeringCode) {
        console.warn('Invalid special offering found:', offering);
        return;
      }
      
      const optionElement = document.createElement('option');
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
      
      console.log('Adding special offering option:', {
        id: offering.id,
        name: offering.name,
        value: optionElement.value,
        isActive
      });
      
      optGroup.appendChild(optionElement);
    });
    
    console.log('Special offerings dropdown updated successfully');
  }

  updateBatchSelector() {
    const batchSelect = document.getElementById('batch-selector');
    if (!batchSelect) return;

    // Clear existing options except default
    batchSelect.innerHTML = '<option value="">Create New Batch</option>';

    if (this.existingBatches && this.existingBatches.length > 0) {
      this.existingBatches.forEach(batch => {
        const option = document.createElement('option');
        option.value = batch.id;
        
        let displayText = `Batch ${batch.batchReference} (${this.formatCurrency(batch.totalAmount)})`;
        
        // Add status indicator
        if (batch.status === 'PENDING') {
          displayText += ' - PENDING';
        } else if (batch.status === 'DEPOSITED') {
          displayText += ' - DEPOSITED';
        }
        
        // Mark current batch
        if (batch.id == this.currentBatchId) {
          displayText += ' ← CURRENT';
          option.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
          option.style.color = '#10b981';
        }
        
        option.textContent = displayText;
        batchSelect.appendChild(option);
      });
    }
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
        
        container.appendChild(this.renderBatchSelector());
        container.appendChild(this.renderPaymentForm());
        container.appendChild(this.renderBatchView());
        container.appendChild(this.renderExistingBatchesView());
        
        document.body.appendChild(this.renderSpecialOfferingModal());
        document.body.appendChild(this.renderKcbPaymentModal());
        document.body.appendChild(this.renderBatchDetailsModal());
        
        this.attachEventListeners();
        this.updateExistingBatchesView();
        
        // Update special offerings dropdown after DOM is ready
        this.updateSpecialOfferingsDropdown();
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
          background: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%234f6bff\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
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
    }, 'Batch Payment Management');
    
    titleContainer.appendChild(pageTitle);
    
    const navItems = [
      { text: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
      { text: 'Payments', href: '/admin/payments', icon: '💰' },
      { text: 'Batch History', href: '/admin/batch-payments', icon: '📦' },
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
    
    const buttonsContainer = this.createElement('div', {
      style: {
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap'
      }
    });
    
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
    
    const createButtonIcon = this.createElement('span', {
      style: {
        fontSize: '16px',
        marginRight: '8px'
      }
    }, '✨');
    
    const createButtonText = document.createTextNode('Create Special Offering');
    
    createSpecialOfferingBtn.appendChild(createButtonIcon);
    createSpecialOfferingBtn.appendChild(createButtonText);

    const refreshOfferingsBtn = this.createElement('button', {
      id: 'refresh-offerings-btn',
      className: 'futuristic-button',
      style: {
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))',
        color: '#3b82f6'
      },
      onClick: async () => {
        try {
          await this.loadSpecialOfferings();
          this.updateSpecialOfferingsDropdown();
          this.showNotification('Special offerings refreshed!', 'success');
        } catch (error) {
          this.showNotification('Failed to refresh special offerings.', 'error');
        }
      }
    });
    
    const refreshButtonIcon = this.createElement('span', {
      style: {
        fontSize: '16px',
        marginRight: '8px'
      }
    }, '🔄');
    
    const refreshButtonText = document.createTextNode('Refresh Offerings');
    
    refreshOfferingsBtn.appendChild(refreshButtonIcon);
    refreshOfferingsBtn.appendChild(refreshButtonText);
    
    buttonsContainer.appendChild(createSpecialOfferingBtn);
    buttonsContainer.appendChild(refreshOfferingsBtn);
    
    headerSection.appendChild(titleContainer);
    headerSection.appendChild(buttonsContainer);
    
    return headerSection;
  }

  renderBatchSelector() {
    const selectorCard = this.createElement('div', {
      className: 'neo-card animated-item',
      style: {
        padding: '25px',
        marginBottom: '25px',
        position: 'relative',
        overflow: 'hidden'
      }
    });

    const cardGlow = this.createElement('div', {
      className: 'card-glow',
      style: {
        background: 'radial-gradient(circle at top left, rgba(16, 185, 129, 0.3), transparent 70%)'
      }
    });
    selectorCard.appendChild(cardGlow);

    const selectorTitle = this.createElement('h2', {
      style: {
        fontSize: '18px',
        fontWeight: '600',
        marginTop: '0',
        marginBottom: '20px',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent'
      }
    }, 'Batch Selection');

    const selectorContainer = this.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        flexWrap: 'wrap'
      }
    });

    const batchSelect = this.createElement('select', {
      id: 'batch-selector',
      className: 'futuristic-select',
      style: {
        minWidth: '300px'
      }
    });

    const defaultOption = this.createElement('option', {
      value: ''
    }, 'Create New Batch');
    batchSelect.appendChild(defaultOption);

    const refreshBtn = this.createElement('button', {
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: '#3b82f6',
        padding: '10px 15px'
      },
      onClick: () => this.loadExistingBatches()
    }, '🔄 Refresh');

    selectorContainer.appendChild(batchSelect);
    selectorContainer.appendChild(refreshBtn);

    selectorCard.appendChild(selectorTitle);
    selectorCard.appendChild(selectorContainer);

    return selectorCard;
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

    const amountInfo = this.createElement('div', {
        id: 'tithe-amount-info',
        style: {
            padding: '15px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            borderRadius: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(59, 130, 246, 0.1)',
            fontSize: '14px',
            color: '#94a3b8'
        }
    });
    titheSection.appendChild(amountInfo);
    
    const subtitle = this.createElement('p', {
      style: {
        color: '#94a3b8',
        fontSize: '14px',
        marginTop: '0',
        marginBottom: '25px'
      }
    }, 'Enter amounts for each category. Leave fields blank to distribute the remainder equally.');
    
    titheSection.appendChild(subtitle);
    
    const inputsContainer = this.createElement('div', {
      className: 'tithe-inputs-container',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px'
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
        const inputGroup = this.createElement('div', { className: 'form-group' });

        const fieldLabel = this.createElement('label', {
            htmlFor: `tithe-${category.id}`,
            style: {
                display: 'block',
                marginBottom: '8px',
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: '500'
            }
        }, category.label);

        const input = this.createElement('input', {
            type: 'number',
            id: `tithe-${category.id}`,
            'data-category': category.id,
            className: 'futuristic-input tithe-distribution-input',
            placeholder: '0.00',
            step: '0.01',
            min: '0'
        });
        
        inputGroup.appendChild(fieldLabel);
        inputGroup.appendChild(input);
        inputsContainer.appendChild(inputGroup);
    });
    
    titheSection.appendChild(inputsContainer);
    
    return titheSection;
  }
  
  renderFormActions() {
    const actionsContainer = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '15px',
        marginTop: '30px'
      }
    });

    const cancelButton = this.createElement('button', {
        type: 'button',
        id: 'cancel-edit-btn',
        className: 'futuristic-button',
        style: {
            display: 'none',
            backgroundColor: 'rgba(127, 29, 29, 0.2)',
            color: '#ef4444'
        },
        onClick: () => this.cancelEdit()
    }, 'Cancel Edit');
    actionsContainer.appendChild(cancelButton);
    
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
    
    const buttonTextNode = document.createTextNode(
        this.editingPaymentIndex !== null ? 'Update Batch Item' : 'Add to Batch'
    );
    submitButton.appendChild(spinner);
    submitButton.appendChild(buttonTextNode);
    
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

  renderKcbPaymentModal() {
    const modal = this.createElement('div', {
      id: 'kcb-payment-modal',
      className: 'modal',
      style: {
        display: 'none',
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: '1500',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '15px'
      }
    });

    const modalContent = this.createElement('div', {
      className: 'neo-card',
      style: {
        width: '100%',
        maxWidth: '500px',
        animation: 'modalFadeIn 0.3s ease-out'
      }
    });

    const modalHeader = this.createElement('div', {
      style: {
        padding: '25px',
        textAlign: 'center',
        borderBottom: '1px solid rgba(30, 41, 59, 0.8)'
      }
    });

    const modalTitle = this.createElement('h2', {
      style: {
        margin: '0 0 10px 0',
        fontSize: '24px',
        fontWeight: '600',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent'
      }
    }, 'KCB Payment Processing');

    const modalSubtitle = this.createElement('p', {
      style: {
        margin: '0',
        color: '#94a3b8',
        fontSize: '14px'
      }
    }, 'Complete the payment to process the batch');

    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(modalSubtitle);

    const modalBody = this.createElement('div', {
      style: {
        padding: '25px'
      }
    });

    const kcbForm = this.createElement('form', {
      id: 'kcb-payment-form'
    });

    const phoneField = this.createElement('div', {
      style: { marginBottom: '20px' }
    });

    const phoneLabel = this.createElement('label', {
      htmlFor: 'kcbPhoneNumber',
      style: {
        display: 'block',
        marginBottom: '10px',
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: '500'
      }
    }, 'Phone Number for KCB Payment');

    const phoneInput = this.createElement('input', {
      type: 'tel',
      id: 'kcbPhoneNumber',
      className: 'futuristic-input',
      placeholder: '0712345678',
      required: true
    });

    phoneField.appendChild(phoneLabel);
    phoneField.appendChild(phoneInput);

    const batchInfo = this.createElement('div', {
      id: 'batch-info-display',
      style: {
        padding: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid rgba(59, 130, 246, 0.1)'
      }
    });

    const formActions = this.createElement('div', {
      style: {
        display: 'flex',
        gap: '15px',
        justifyContent: 'flex-end'
      }
    });

    const cancelBtn = this.createElement('button', {
      type: 'button',
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(127, 29, 29, 0.2)',
        color: '#ef4444'
      },
      onClick: () => this.toggleKcbPaymentModal(false)
    }, 'Cancel');

    const processBtn = this.createElement('button', {
      type: 'submit',
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        color: '#10b981'
      }
    });

    const processSpinner = this.createElement('span', {
      id: 'kcb-process-spinner',
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

    processBtn.appendChild(processSpinner);
    processBtn.appendChild(document.createTextNode('Process KCB Payment'));

    formActions.appendChild(cancelBtn);
    formActions.appendChild(processBtn);

    kcbForm.appendChild(phoneField);
    kcbForm.appendChild(batchInfo);
    kcbForm.appendChild(formActions);

    modalBody.appendChild(kcbForm);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);

    return modal;
  }
  
  renderBatchView() {
    const batchContainer = this.createElement('div', {
      id: 'batch-view-container',
      className: 'neo-card animated-item',
      style: {
        marginTop: '30px',
        padding: '30px',
        display: 'none'
      }
    });

    const title = this.createElement('h2', {
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
    }, 'Current Batch');
    batchContainer.appendChild(title);
    
    const tableContainer = this.createElement('div', { style: { overflowX: 'auto' } });
    const table = this.createElement('table', {
      id: 'batch-table',
      style: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }
    });
    
    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 1px solid rgba(59, 130, 246, 0.2);">
          <th style="padding: 12px 15px; text-align: left; color: #94a3b8; font-size: 14px; width: 25%;">Member</th>
          <th style="padding: 12px 15px; text-align: left; color: #94a3b8; font-size: 14px; width: 20%;">Type</th>
          <th style="padding: 12px 15px; text-align: right; color: #94a3b8; font-size: 14px; width: 15%;">Amount</th>
          <th style="padding: 12px 15px; text-align: left; color: #94a3b8; font-size: 14px; width: 25%;">Description</th>
          <th style="padding: 12px 15px; text-align: center; color: #94a3b8; font-size: 14px; width: 15%;">Actions</th>
        </tr>
      </thead>
      <tbody id="batch-items-body"></tbody>
      <tfoot>
        <tr id="batch-total-row" style="border-top: 2px solid rgba(59, 130, 246, 0.3);">
          <td colspan="2" style="padding: 15px; text-align: right; font-weight: 600; font-size: 16px;">Total Batch Amount:</td>
          <td id="batch-total-amount" style="padding: 15px; text-align: right; font-weight: 600; font-size: 16px;"></td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    `;
    tableContainer.appendChild(table);
    batchContainer.appendChild(tableContainer);

    const actionsContainer = this.createElement('div', {
      style: { 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '25px',
        flexWrap: 'wrap',
        gap: '15px'
      }
    });

    const leftActions = this.createElement('div', {
      style: { display: 'flex', gap: '15px' }
    });

    const clearBatchBtn = this.createElement('button', {
      id: 'clear-batch-btn',
      className: 'futuristic-button',
      style: {
        backgroundColor: 'rgba(127, 29, 29, 0.2)',
        color: '#ef4444'
      }
    }, 'Clear Batch');

    leftActions.appendChild(clearBatchBtn);

    const rightActions = this.createElement('div', {
      style: { display: 'flex', gap: '15px' }
    });

    const saveBatchBtn = this.createElement('button', {
      id: 'save-batch-btn',
      className: 'futuristic-button',
      style: {
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))',
        color: '#3b82f6'
      }
    });

    saveBatchBtn.innerHTML = `
      <span id="save-batch-spinner" class="spinner" style="display: none; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.75s linear infinite;"></span>
      Save as Draft
    `;

    const processBatchBtn = this.createElement('button', {
      id: 'process-batch-btn',
      className: 'futuristic-button',
      style: {
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))',
        color: '#10b981'
      }
    });

    processBatchBtn.innerHTML = `
      <span id="batch-spinner" class="spinner" style="display: none; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.75s linear infinite;"></span>
      Process with KCB
    `;

    rightActions.appendChild(saveBatchBtn);
    rightActions.appendChild(processBatchBtn);

    actionsContainer.appendChild(leftActions);
    actionsContainer.appendChild(rightActions);
    batchContainer.appendChild(actionsContainer);

    return batchContainer;
  }

  renderExistingBatchesView() {
    const batchesContainer = this.createElement('div', {
      id: 'existing-batches-container',
      className: 'neo-card animated-item',
      style: {
        marginTop: '30px',
        padding: '30px'
      }
    });

    const title = this.createElement('h2', {
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
    }, 'Existing Batches');

    const batchesGrid = this.createElement('div', {
      id: 'batches-grid',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }
    });

    batchesContainer.appendChild(title);
    batchesContainer.appendChild(batchesGrid);

    return batchesContainer;
  }

  updateBatchView() {
    const batchContainer = document.getElementById('batch-view-container');
    const tbody = document.getElementById('batch-items-body');
    const totalAmountEl = document.getElementById('batch-total-amount');
    const saveBatchBtn = document.getElementById('save-batch-btn');

    if (!batchContainer || !tbody || !totalAmountEl) return;

    if (this.paymentBatch.length === 0) {
      batchContainer.style.display = 'none';
      return;
    }

    batchContainer.style.display = 'block';
    
    // Update title to show current batch status
    const title = batchContainer.querySelector('h2');
    if (title) {
      if (this.currentBatchId) {
        const currentBatch = this.existingBatches.find(b => b.id == this.currentBatchId);
        const batchRef = currentBatch ? currentBatch.batchReference : `ID: ${this.currentBatchId}`;
        title.textContent = `Editing Batch: ${batchRef}`;
        title.style.color = '#10b981'; // Green to indicate it's a saved batch
      } else {
        title.textContent = 'New Batch (Unsaved)';
        title.style.color = '#f59e0b'; // Yellow to indicate it's unsaved
      }
    }

    // Update save button text based on context
    if (saveBatchBtn) {
      if (this.currentBatchId) {
        saveBatchBtn.innerHTML = `
          <span id="save-batch-spinner" class="spinner" style="display: none; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.75s linear infinite;"></span>
          Update Batch
        `;
        saveBatchBtn.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))';
        saveBatchBtn.style.color = '#10b981';
      } else {
        saveBatchBtn.innerHTML = `
          <span id="save-batch-spinner" class="spinner" style="display: none; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; animation: spin 0.75s linear infinite;"></span>
          Save as Draft
        `;
        saveBatchBtn.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))';
        saveBatchBtn.style.color = '#3b82f6';
      }
    }
    
    tbody.innerHTML = '';
    let totalAmount = 0;

    this.paymentBatch.forEach((payment, index) => {
      const user = this.users.find(u => u.id === payment.userId);
      totalAmount += payment.amount;
      const tr = this.createElement('tr', { style: { borderBottom: '1px solid rgba(148, 163, 184, 0.1)' } });

      tr.innerHTML = `
        <td style="padding: 12px 15px; font-size: 14px;">${user ? user.fullName : 'Unknown User'}</td>
        <td style="padding: 12px 15px; font-size: 14px;">${payment.paymentTypeDisplay || payment.paymentType}</td>
        <td style="padding: 12px 15px; text-align: right; font-size: 14px;">${this.formatCurrency(payment.amount)}</td>
        <td style="padding: 12px 15px; font-size: 14px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${payment.description}">${payment.description}</td>
        <td style="padding: 12px 15px; text-align: center;">
          <button class="edit-batch-item" data-index="${index}" style="background:none; border:none; color:#3b82f6; cursor:pointer; font-size: 13px; margin-right: 5px;">Edit</button>
          <button class="remove-batch-item" data-index="${index}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size: 13px;">Remove</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    totalAmountEl.textContent = this.formatCurrency(totalAmount);
  }

  updateExistingBatchesView() {
    const batchesGrid = document.getElementById('batches-grid');
    if (!batchesGrid) return;

    batchesGrid.innerHTML = '';

    if (this.existingBatches.length === 0) {
      const emptyMessage = this.createElement('div', {
        style: {
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '14px',
          gridColumn: '1 / -1'
        }
      }, 'No pending batches found.');
      batchesGrid.appendChild(emptyMessage);
      return;
    }

    this.existingBatches.forEach(batch => {
      const batchCard = this.createElement('div', {
        className: 'batch-card',
        style: {
          padding: '20px',
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '12px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          transition: 'all 0.2s ease'
        }
      });

      const batchHeader = this.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '15px'
        }
      });

      const batchTitle = this.createElement('h3', {
        style: {
          margin: '0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#e0e7ff'
        }
      }, `Batch ${batch.batchReference}`);

      const statusBadge = this.createElement('span', {
        style: {
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: this.getStatusColor(batch.status).bg,
          color: this.getStatusColor(batch.status).text
        }
      }, batch.status);

      batchHeader.appendChild(batchTitle);
      batchHeader.appendChild(statusBadge);

      const batchInfo = this.createElement('div', {
        style: {
          marginBottom: '15px',
          fontSize: '14px',
          color: '#94a3b8'
        }
      });

      batchInfo.innerHTML = `
        <div>Amount: ${this.formatCurrency(batch.totalAmount)}</div>
        <div>Items: ${batch.totalCount}</div>
        <div>Created: ${new Date(batch.createdAt).toLocaleDateString()}</div>
      `;

      const batchActions = this.createElement('div', {
        style: {
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap'
        }
      });

      if (batch.status === 'PENDING') {
        const processBtn = this.createElement('button', {
          className: 'futuristic-button',
          style: {
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            fontSize: '12px',
            padding: '8px 12px'
          },
          onClick: () => this.handleProcessExistingBatch(batch.id)
        }, 'Process');

        const cancelBtn = this.createElement('button', {
          className: 'futuristic-button',
          style: {
            backgroundColor: 'rgba(127, 29, 29, 0.2)',
            color: '#ef4444',
            fontSize: '12px',
            padding: '8px 12px'
          },
          onClick: () => this.handleCancelBatch(batch.id)
        }, 'Cancel');

        batchActions.appendChild(processBtn);
        batchActions.appendChild(cancelBtn);
      } else if (batch.status === 'DEPOSITED') {
        const checkBtn = this.createElement('button', {
          className: 'futuristic-button',
          style: {
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: '#3b82f6',
            fontSize: '12px',
            padding: '8px 12px'
          },
          onClick: () => this.handleCheckBatchStatus(batch.id)
        }, 'Check Status');

        batchActions.appendChild(checkBtn);
      }

      const viewBtn = this.createElement('button', {
        className: 'futuristic-button',
        style: {
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          color: '#3b82f6',
          fontSize: '12px',
          padding: '8px 12px'
        },
        onClick: () => this.handleViewBatchDetails(batch.id)
      }, 'View Details');

      batchActions.appendChild(viewBtn);

      batchCard.appendChild(batchHeader);
      batchCard.appendChild(batchInfo);
      batchCard.appendChild(batchActions);

      batchesGrid.appendChild(batchCard);
    });
  }

  getStatusColor(status) {
    const colors = {
      'PENDING': { bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308' },
      'DEPOSITED': { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
      'COMPLETED': { bg: 'rgba(16, 185, 129, 0.2)', text: '#10b981' },
      'CANCELLED': { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' }
    };
    return colors[status] || colors['PENDING'];
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
        
        .futuristic-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
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
        
        .batch-card:hover {
          transform: translateY(-2px);
          border-color: rgba(59, 130, 246, 0.4);
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

  toggleKcbPaymentModal(show, batchInfo = null) {
    const modal = document.getElementById('kcb-payment-modal');
    if (modal) {
      modal.style.display = show ? 'flex' : 'none';
      document.body.style.overflow = show ? 'hidden' : '';
      
      if (show && batchInfo) {
        const batchInfoDisplay = document.getElementById('batch-info-display');
        if (batchInfoDisplay) {
          let batchInfoHTML = `
            <div style="margin-bottom: 10px;"><strong>Batch Total:</strong> ${this.formatCurrency(batchInfo.totalAmount)}</div>
            <div style="margin-bottom: 10px;"><strong>Payment Count:</strong> ${batchInfo.totalCount}</div>
          `;
          
          if (batchInfo.batchReference) {
            batchInfoHTML = `<div style="margin-bottom: 10px;"><strong>Batch Reference:</strong> ${batchInfo.batchReference}</div>` + batchInfoHTML;
          }
          
          batchInfoHTML += `<div style="color: #94a3b8; font-size: 13px;">This will initiate KCB payment for the entire batch amount</div>`;
          
          batchInfoDisplay.innerHTML = batchInfoHTML;
        }
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

    // Batch selector event listener
    const batchSelector = document.getElementById('batch-selector');
    if (batchSelector) {
      batchSelector.addEventListener('change', async (e) => {
        const selectedBatchId = e.target.value || null;
        
        if (selectedBatchId !== this.currentBatchId) {
          // Check if there are unsaved changes
          if (this.paymentBatch.length > 0) {
            let shouldProceed = true;
            
            if (this.currentBatchId) {
              // Switching from one batch to another - offer to save changes
              shouldProceed = confirm('You have unsaved changes in the current batch. These changes are saved locally but not on the server yet. Do you want to continue switching batches?');
            } else {
              // Switching from new batch to existing - offer to save
              shouldProceed = confirm('You have unsaved items in a new batch. Do you want to continue switching? (Your current items will be lost)');
            }
            
            if (!shouldProceed) {
              // Reset selector to current batch
              batchSelector.value = this.currentBatchId || '';
              return;
            }
          }
          
          // Clear current batch state
          this.paymentBatch = [];
          this.currentBatchId = selectedBatchId;
          
          if (this.currentBatchId) {
            // Load the selected batch for editing
            await this.loadBatchItems(this.currentBatchId);
          } else {
            // Creating new batch
            this.updateBatchView();
            this.showNotification('Started new batch. Add payments and click "Save as Draft" to save.', 'info');
          }
          
          // Save new state
          this.saveBatchState();
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

    const kcbPaymentForm = document.getElementById('kcb-payment-form');
    if (kcbPaymentForm) {
      kcbPaymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleKcbPaymentSubmit(e);
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

    const kcbModal = document.getElementById('kcb-payment-modal');
    if (kcbModal) {
      kcbModal.addEventListener('click', (e) => {
        if (e.target === kcbModal) {
          this.toggleKcbPaymentModal(false);
        }
      });
    }

    const batchDetailsModal = document.getElementById('batch-details-modal');
    if (batchDetailsModal) {
      batchDetailsModal.addEventListener('click', (e) => {
        if (e.target === batchDetailsModal) {
          this.toggleBatchDetailsModal(false);
        }
      });
    }

    const amountInput = document.getElementById('amount');
    if (amountInput) {
        amountInput.addEventListener('input', () => this.updateTitheDistributionState());
    }

    const titheDistributionSection = document.getElementById('tithe-distribution-section');
    if (titheDistributionSection) {
        titheDistributionSection.addEventListener('input', (e) => {
            if (e.target.classList.contains('tithe-distribution-input')) {
                this.updateTitheDistributionState();
            }
        });
    }

    const batchViewContainer = document.getElementById('batch-view-container');
    if(batchViewContainer) {
        batchViewContainer.addEventListener('click', e => {
            if (e.target.classList.contains('edit-batch-item')) {
                const index = e.target.getAttribute('data-index');
                this.handleEditBatchItem(parseInt(index));
            }
            if (e.target.classList.contains('remove-batch-item')) {
                const index = e.target.getAttribute('data-index');
                this.handleRemoveBatchItem(parseInt(index));
            }
        });
    }

    const processBatchBtn = document.getElementById('process-batch-btn');
    if (processBatchBtn) {
        processBatchBtn.addEventListener('click', () => this.handleProcessBatch());
    }

    const saveBatchBtn = document.getElementById('save-batch-btn');
    if (saveBatchBtn) {
        saveBatchBtn.addEventListener('click', () => this.handleSaveBatch());
    }

    const clearBatchBtn = document.getElementById('clear-batch-btn');
    if (clearBatchBtn) {
        clearBatchBtn.addEventListener('click', () => this.handleClearBatch());
    }
  }

  updateTitheDistributionState() {
    const amountInput = document.getElementById('amount');
    const amountInfo = document.getElementById('tithe-amount-info');
    
    if (!amountInput || !amountInfo) return;
    
    const totalAmount = parseFloat(amountInput.value) || 0;
    const titheInputs = document.querySelectorAll('.tithe-distribution-input');
    let distributedTotal = 0;
    
    titheInputs.forEach(input => {
        const value = parseFloat(input.value) || 0;
        distributedTotal += value;
    });
    
    const remaining = totalAmount - distributedTotal;
    
    amountInfo.innerHTML = `
        <div><strong>Total Tithe Amount:</strong> ${this.formatCurrency(totalAmount)}</div>
        <div><strong>Distributed:</strong> ${this.formatCurrency(distributedTotal)}</div>
        <div><strong>Remaining:</strong> ${this.formatCurrency(remaining)}</div>
        ${remaining < 0 ? '<div style="color: #ef4444;">⚠️ Distribution exceeds total amount</div>' : ''}
    `;
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting) return;
    
    this.isSubmitting = true;
    const submitBtn = document.getElementById('submit-payment-btn');
    const spinner = document.getElementById('submit-spinner');
    if (submitBtn && spinner) {
      submitBtn.disabled = true;
      spinner.style.display = 'inline-block';
    }

    try {
      const form = e.target;
      const userId = form.querySelector('#userId').value;
      const paymentTypeSelect = form.querySelector('#paymentType');
      const paymentType = paymentTypeSelect.value;
      const amount = parseFloat(form.querySelector('#amount').value);
      let description = form.querySelector('#description').value || '';
      const paymentDate = form.querySelector('#paymentDate').value;
      
      if (!userId) throw new Error('Please select a member');
      if (!paymentType) throw new Error('Please select a payment type');
      if (isNaN(amount) || amount <= 0) throw new Error('Please enter a valid amount');
      
      // Base payment data
      let paymentData = {
        userId: parseInt(userId),
        amount: amount,
        description: description,
        paymentDate: paymentDate,
        paymentMethod: 'MANUAL',
        paymentTypeDisplay: paymentTypeSelect.options[paymentTypeSelect.selectedIndex].text
      };
      
      // Handle different payment types
      if (paymentType === 'TITHE') {
        paymentData.paymentType = 'TITHE';
        paymentData.isExpense = false;
        
        // Process tithe distribution
        const titheDistributionSDA = {};
        const titheInputs = form.querySelectorAll('.tithe-distribution-input');
        let distributedTotal = 0;
        const emptyFields = [];
        const filledFields = {};

        titheInputs.forEach(input => {
            const categoryId = input.dataset.category;
            const value = parseFloat(input.value);
            if (value > 0) {
                filledFields[categoryId] = value;
                distributedTotal += value;
            } else {
                emptyFields.push(categoryId);
            }
        });

        if (distributedTotal > amount) {
            throw new Error('Tithe distribution total cannot exceed the main tithe amount.');
        }

        Object.assign(titheDistributionSDA, filledFields);

        if (emptyFields.length > 0) {
            const remainingForDistribution = amount - distributedTotal;
            if (remainingForDistribution > 0) {
                const equalShare = remainingForDistribution / emptyFields.length;
                emptyFields.forEach(categoryId => {
                    titheDistributionSDA[categoryId] = parseFloat(equalShare.toFixed(2));
                });
            }
        }
        
        paymentData.titheDistributionSDA = titheDistributionSDA;
        
      } else if (paymentType.startsWith('SPECIAL_OFFERING_')) {
        // Extract the numeric ID from SPECIAL_OFFERING_5 format
        const offeringId = parseInt(paymentType.replace('SPECIAL_OFFERING_', ''), 10);
        
        if (isNaN(offeringId)) {
          throw new Error('Invalid special offering selection');
        }
        
        paymentData.paymentType = offeringId.toString(); // Backend expects string numeric ID
        paymentData.specialOfferingId = offeringId;
        paymentData.isExpense = false;
        
        // Update description with offering name
        const offering = this.specialOfferings.find(o => o.id === offeringId);
        if (offering) {
            if (description && !description.includes(offering.name)) {
                paymentData.description = `${offering.name} - ${description}`;
            } else if (!description) {
                paymentData.description = offering.name;
            }
        }
        
      } else if (paymentType === 'EXPENSE') {
        paymentData.paymentType = 'EXPENSE';
        paymentData.isExpense = true;
        paymentData.department = 'General';
        
      } else {
        // Standard payment types: OFFERING, DONATION
        paymentData.paymentType = paymentType;
        paymentData.isExpense = false;
      }
      
      // Clean the payment data - remove undefined/null fields that backend doesn't expect
      const cleanedPaymentData = this.cleanPaymentData(paymentData);
      
      if (this.editingPaymentIndex !== null) {
        this.paymentBatch[this.editingPaymentIndex] = cleanedPaymentData;
        this.showNotification('Batch item updated successfully!', 'success');
      } else {
        this.paymentBatch.push(cleanedPaymentData);
        this.showNotification('Payment added to batch successfully!', 'success');
      }
      
      // Save batch state to localStorage
      this.saveBatchState();
      
      this.resetForm();
      this.updateBatchView();

    } catch (error) {
      this.showNotification(error.message, 'error');
    } finally {
      this.isSubmitting = false;
      if (submitBtn && spinner) {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
      }
    }
  }

  cleanPaymentData(paymentData) {
    // Create a clean copy with only the necessary fields
    const cleaned = {
      userId: paymentData.userId,
      amount: paymentData.amount,
      paymentType: paymentData.paymentType,
      description: paymentData.description,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      isExpense: paymentData.isExpense
    };

    // Only add optional fields if they have valid values
    if (paymentData.titheDistributionSDA && Object.keys(paymentData.titheDistributionSDA).length > 0) {
      cleaned.titheDistributionSDA = paymentData.titheDistributionSDA;
    }

    if (paymentData.specialOfferingId && paymentData.specialOfferingId > 0) {
      cleaned.specialOfferingId = paymentData.specialOfferingId;
    }

    if (paymentData.department) {
      cleaned.department = paymentData.department;
    }

    // Keep display field for UI purposes
    if (paymentData.paymentTypeDisplay) {
      cleaned.paymentTypeDisplay = paymentData.paymentTypeDisplay;
    }

    return cleaned;
  }
  
  resetForm() {
    const form = document.getElementById('add-payment-form');
    if (form) form.reset();

    document.getElementById('userId').value = '';
    document.getElementById('userSearch').value = '';
    this.editingPaymentIndex = null;

    const submitBtn = document.getElementById('submit-payment-btn');
    if (submitBtn) {
      submitBtn.childNodes[1].nodeValue = 'Add to Batch';
    }
    
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if(cancelBtn) cancelBtn.style.display = 'none';

    const titheSection = document.getElementById('tithe-distribution-section');
    if (titheSection) {
      titheSection.style.display = 'none';
    }
    this.updateTitheDistributionState();
  }

  cancelEdit() {
    this.resetForm();
    this.showNotification('Edit cancelled', 'info');
  }

  handleEditBatchItem(index) {
    if (index < 0 || index >= this.paymentBatch.length) return;

    this.editingPaymentIndex = index;
    const payment = this.paymentBatch[index];
    
    const user = this.users.find(u => u.id === payment.userId);
    if (user) {
        document.getElementById('userSearch').value = `${user.fullName} (${user.phone || 'No phone'})`;
        document.getElementById('userId').value = user.id;
    }

    // Handle payment type selection
    let paymentTypeValue = payment.paymentType;
    
    // Convert numeric special offering IDs back to dropdown format
    if (!isNaN(parseInt(payment.paymentType)) && parseInt(payment.paymentType) > 0 && payment.specialOfferingId) {
      paymentTypeValue = `SPECIAL_OFFERING_${payment.specialOfferingId}`;
    }

    document.getElementById('paymentType').value = paymentTypeValue;
    document.getElementById('amount').value = payment.amount;
    document.getElementById('description').value = payment.description;
    document.getElementById('paymentDate').value = payment.paymentDate;

    // Show/hide tithe section and populate values
    const titheSection = document.getElementById('tithe-distribution-section');
    if (payment.paymentType === 'TITHE' && payment.titheDistributionSDA) {
      titheSection.style.display = 'block';
      
      // Clear all inputs first
      const titheInputs = document.querySelectorAll('.tithe-distribution-input');
      titheInputs.forEach(input => input.value = '');
      
      // Set values from payment data
      for (const [key, value] of Object.entries(payment.titheDistributionSDA)) {
        const input = document.getElementById(`tithe-${key}`);
        if (input) input.value = value;
      }
    } else {
      titheSection.style.display = 'none';
    }
    
    this.updateTitheDistributionState();

    const submitBtn = document.getElementById('submit-payment-btn');
    submitBtn.childNodes[1].nodeValue = 'Update Batch Item';
    document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.showNotification('Editing item. Make changes and click "Update Batch Item".', 'info');
  }

  handleRemoveBatchItem(index) {
    if (index < 0 || index >= this.paymentBatch.length) return;
    this.paymentBatch.splice(index, 1);
    
    // Save updated batch state
    this.saveBatchState();
    
    this.updateBatchView();
    this.showNotification('Item removed from batch.', 'success');
  }

  async handleSaveBatch() {
    if (this.paymentBatch.length === 0) {
      this.showNotification('Batch is empty. Add payments first.', 'error');
      return;
    }
    if (this.isSubmitting) return;
  
    this.isSubmitting = true;
    const saveBtn = document.getElementById('save-batch-btn');
    const spinner = saveBtn ? saveBtn.querySelector('.spinner') : null;
    if (saveBtn && spinner) {
      saveBtn.disabled = true;
      spinner.style.display = 'inline-block';
    }
  
    try {
      let response;
      // If a currentBatchId exists, we are updating an existing batch.
      if (this.currentBatchId) {
        const batchData = {
          payments: this.paymentBatch,
        };
        response = await this.queueApiRequest(() =>
          this.apiService.addItemsToBatch(this.currentBatchId, batchData)
        );
        this.successMessage = 'Successfully added new items to the batch!';
      } else {
        // If no currentBatchId, we are creating a new batch.
        const batchData = {
          payments: this.paymentBatch,
          description: `Draft batch - ${new Date().toLocaleDateString()}`
        };
        response = await this.queueApiRequest(() =>
          this.apiService.createBatchPayment(batchData)
        );
        this.successMessage = 'Batch saved as draft successfully!';
      }
  
      this.paymentBatch = [];
      this.currentBatchId = null;
      this.updateBatchView();
      await this.loadExistingBatches();
      this.updateExistingBatchesView();
      this.showNotification(this.successMessage, 'success');
  
      // Reload special offerings and update dropdown
      await this.loadSpecialOfferings();
      this.updateSpecialOfferingsDropdown();
  
    } catch (error) {
      console.error('Save batch error:', error);
      this.errorMessage = error.message || 'Failed to save batch.';
      this.showNotification(this.errorMessage, 'error');
    } finally {
      this.isSubmitting = false;
      if (saveBtn && spinner) {
        saveBtn.disabled = false;
        spinner.style.display = 'none';
      }
    }
  }

  async handleProcessBatch() {
    if (this.paymentBatch.length === 0) {
      this.showNotification('Batch is empty. Add payments first.', 'error');
      return;
    }

    try {
      // First ensure the batch is saved/updated on the server
      if (!this.currentBatchId) {
        // No batch exists, create one first
        await this.handleSaveBatch();
        
        if (!this.currentBatchId) {
          throw new Error('Failed to create batch for processing');
        }
      } else {
        // Batch exists, ensure it's up to date on server
        console.log('Ensuring batch is up to date before processing...');
        await this.handleSaveBatch();
        
        if (!this.currentBatchId) {
          throw new Error('Failed to update batch for processing');
        }
      }

      // Verify the batch exists and is in PENDING status
      const batchResponse = await this.queueApiRequest(() =>
        this.apiService.getBatchPaymentDetails(this.currentBatchId)
      );
      
      const batch = batchResponse.batchPayment;
      if (!batch) {
        throw new Error('Batch not found on server');
      }
      
      if (batch.status !== 'PENDING') {
        throw new Error(`Cannot process batch. Batch is in ${batch.status} status.`);
      }

      // Show KCB payment modal for the verified batch
      const batchInfo = {
        totalAmount: batch.totalAmount,
        totalCount: batch.totalCount,
        batchReference: batch.batchReference
      };
      
      console.log(`✅ Ready to process batch ${batch.batchReference} (ID: ${this.currentBatchId})`);
      this.toggleKcbPaymentModal(true, batchInfo);

    } catch (error) {
      console.error('Process batch error:', error);
      this.showNotification(error.message || 'Failed to prepare batch for processing.', 'error');
    }
  }

  async handleKcbPaymentSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    const processBtn = e.target.querySelector('button[type="submit"]');
    const spinner = document.getElementById('kcb-process-spinner');
    
    if (processBtn && spinner) {
        processBtn.disabled = true;
        spinner.style.display = 'inline-block';
    }

    try {
        const phoneNumber = document.getElementById('kcbPhoneNumber').value;
        if (!phoneNumber) {
            throw new Error('Please enter a phone number');
        }

        const batchId = this.currentBatchId;
        if (!batchId) {
            throw new Error('No batch selected for processing');
        }

        const depositData = {
            phoneNumber: phoneNumber,
            depositDescription: `Batch payment processing - ${new Date().toLocaleDateString()}`
        };

        const response = await this.queueApiRequest(() =>
            this.apiService.processBatchDeposit(batchId, depositData)
        );

        this.toggleKcbPaymentModal(false);
        this.showNotification('KCB payment initiated! Please complete the payment on your phone.', 'success');
        
        // Clear current batch state since it's now being processed
        this.paymentBatch = [];
        this.currentBatchId = null;
        this.clearBatchState();
        
        this.updateBatchView();
        await this.loadExistingBatches();
        this.updateExistingBatchesView();

        // Reset batch selector
        const batchSelector = document.getElementById('batch-selector');
        if (batchSelector) {
            batchSelector.value = '';
        }

    } catch (error) {
        console.error('KCB payment error:', error);
        this.showNotification(error.message || 'Failed to initiate KCB payment.', 'error');
    } finally {
        this.isSubmitting = false;
        if (processBtn && spinner) {
            processBtn.disabled = false;
            spinner.style.display = 'none';
        }
    }
  }

  handleClearBatch() {
    if (this.paymentBatch.length === 0) return;
    
    if (confirm('Are you sure you want to clear the current batch? This will remove all items.')) {
      this.paymentBatch = [];
      this.currentBatchId = null;
      
      // Clear persistent state
      this.clearBatchState();
      
      this.updateBatchView();
      
      const batchSelector = document.getElementById('batch-selector');
      if (batchSelector) {
          batchSelector.value = '';
      }
      
      this.showNotification('Batch cleared successfully.', 'success');
    }
  }

  async loadBatchItems(batchId) {
    try {
      const response = await this.queueApiRequest(() =>
        this.apiService.getBatchPaymentDetails(batchId)
      );
      
      const batchPayment = response.batchPayment;
      if (batchPayment && batchPayment.payments) {
        // Only load if the batch is still PENDING (editable)
        if (batchPayment.status !== 'PENDING') {
          this.showNotification(`Cannot edit batch in ${batchPayment.status} status. You can only edit PENDING batches.`, 'warning');
          return;
        }

        this.paymentBatch = batchPayment.payments.map(payment => {
          const cleanedPayment = {
            userId: payment.userId,
            amount: payment.amount,
            paymentType: payment.paymentType,
            description: payment.description,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod || 'MANUAL',
            isExpense: payment.isExpense || false,
            paymentTypeDisplay: this.getPaymentTypeDisplay(payment.paymentType)
          };

          // Only add optional fields if they exist and have values
          if (payment.titheDistributionSDA && Object.keys(payment.titheDistributionSDA).length > 0) {
            cleanedPayment.titheDistributionSDA = payment.titheDistributionSDA;
          }

          if (payment.specialOfferingId && payment.specialOfferingId > 0) {
            cleanedPayment.specialOfferingId = payment.specialOfferingId;
          }

          if (payment.department) {
            cleanedPayment.department = payment.department;
          }

          return cleanedPayment;
        });
        
        // Set the current batch ID
        this.currentBatchId = batchId;
        
        // Save the loaded state
        this.saveBatchState();
        
        this.updateBatchView();
        this.showNotification(`Loaded batch ${batchPayment.batchReference} with ${this.paymentBatch.length} items for editing.`, 'success');
        
      } else {
        this.showNotification('No payment data found in this batch.', 'warning');
      }
    } catch (error) {
      console.error('Error loading batch items:', error);
      this.showNotification('Failed to load batch items.', 'error');
    }
  }

  getPaymentTypeDisplay(paymentType) {
    // Handle numeric special offering IDs
    if (!isNaN(parseInt(paymentType)) && parseInt(paymentType) > 0) {
      const offeringId = parseInt(paymentType);
      const offering = this.specialOfferings.find(o => o.id === offeringId);
      return offering ? offering.name : `Special Offering (ID: ${offeringId})`;
    }
    
    // Handle SPECIAL_OFFERING_ prefixed format (legacy)
    if (paymentType && paymentType.startsWith('SPECIAL_OFFERING_')) {
      const offeringId = parseInt(paymentType.replace('SPECIAL_OFFERING_', ''));
      const offering = this.specialOfferings.find(o => o.id === offeringId);
      return offering ? offering.name : 'Special Offering';
    }
    
    const typeMap = {
      'TITHE': 'Tithe',
      'OFFERING': 'Offering', 
      'DONATION': 'Donation',
      'EXPENSE': 'Expense'
    };
    
    return typeMap[paymentType] || paymentType;
  }

  async handleProcessExistingBatch(batchId) {
    try {
      const batchDetails = await this.queueApiRequest(() =>
        this.apiService.getBatchPaymentDetails(batchId)
      );
      
      const batch = batchDetails.batchPayment;
      const batchInfo = {
        totalAmount: batch.totalAmount,
        totalCount: batch.totalCount
      };
      
      this.currentBatchId = batchId;
      this.toggleKcbPaymentModal(true, batchInfo);
      
    } catch (error) {
      console.error('Error processing existing batch:', error);
      this.showNotification('Failed to process batch.', 'error');
    }
  }

  async handleCancelBatch(batchId) {
    if (!confirm('Are you sure you want to cancel this batch? This action cannot be undone.')) {
      return;
    }

    try {
      await this.queueApiRequest(() =>
        this.apiService.cancelBatchPayment(batchId, 'Cancelled by admin')
      );
      
      this.showNotification('Batch cancelled successfully.', 'success');
      await this.loadExistingBatches();
      this.updateExistingBatchesView();
      
    } catch (error) {
      console.error('Error cancelling batch:', error);
      this.showNotification('Failed to cancel batch.', 'error');
    }
  }

  async handleCheckBatchStatus(batchId) {
    try {
      const response = await this.queueApiRequest(() =>
        this.apiService.getBatchPaymentDetails(batchId)
      );
      
      const batch = response.batchPayment;
      let statusMessage = `Batch Status: ${batch.status}`;
      
      if (batch.status === 'DEPOSITED') {
        statusMessage += '\nKCB payment has been initiated. ';
        if (batch.kcbTransactionId) {
          statusMessage += `Transaction ID: ${batch.kcbTransactionId}`;
        }
        statusMessage += '\n\nIf payment was completed, you can try to complete the batch.';
        
        if (confirm(statusMessage + '\n\nWould you like to try completing this batch?')) {
          await this.handleCompleteBatch(batchId);
        }
      } else {
        alert(statusMessage);
      }
      
    } catch (error) {
      console.error('Error checking batch status:', error);
      this.showNotification('Failed to check batch status.', 'error');
    }
  }

  async handleCompleteBatch(batchId) {
    try {
      await this.queueApiRequest(() =>
        this.apiService.completeBatchPayment(batchId)
      );
      
      this.showNotification('Batch completed successfully! All payments processed.', 'success');
      await this.loadExistingBatches();
      this.updateExistingBatchesView();
      
    } catch (error) {
      console.error('Error completing batch:', error);
      this.showNotification('Failed to complete batch. Payment may still be pending.', 'error');
    }
  }

  renderBatchDetailsModal() {
    const modal = this.createElement('div', {
      id: 'batch-details-modal',
      className: 'modal',
      style: {
        display: 'none',
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: '2000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '15px'
      }
    });

    const modalContent = this.createElement('div', {
      className: 'neo-card',
      style: {
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflowY: 'auto',
        animation: 'modalFadeIn 0.3s ease-out'
      }
    });

    const modalHeader = this.createElement('div', {
      style: {
        padding: '25px',
        borderBottom: '1px solid rgba(30, 41, 59, 0.8)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    });

    const modalTitle = this.createElement('h2', {
      id: 'batch-details-title',
      style: {
        margin: '0',
        fontSize: '24px',
        fontWeight: '600',
        background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent'
      }
    }, 'Batch Details');

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
        this.toggleBatchDetailsModal(false);
      }
    }, '×');

    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);

    const modalBody = this.createElement('div', {
      id: 'batch-details-content',
      style: {
        padding: '25px'
      }
    });

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.toggleBatchDetailsModal(false);
      }
    });

    return modal;
  }

  toggleBatchDetailsModal(show, batchData = null) {
    const modal = document.getElementById('batch-details-modal');
    if (modal) {
      modal.style.display = show ? 'flex' : 'none';
      document.body.style.overflow = show ? 'hidden' : '';
      
      if (show && batchData) {
        this.renderBatchDetailsContent(batchData);
      }
    }
  }

  renderBatchDetailsContent(batchData) {
    const content = document.getElementById('batch-details-content');
    const title = document.getElementById('batch-details-title');
    
    if (!content || !title) return;

    title.textContent = `Batch ${batchData.batchReference}`;

    content.innerHTML = '';

    // Batch Summary Card
    const summaryCard = this.createElement('div', {
      className: 'neo-card',
      style: {
        padding: '20px',
        marginBottom: '25px',
        backgroundColor: 'rgba(15, 23, 42, 0.5)'
      }
    });

    const summaryTitle = this.createElement('h3', {
      style: {
        margin: '0 0 20px 0',
        fontSize: '18px',
        fontWeight: '600',
        color: '#e0e7ff'
      }
    }, 'Batch Summary');

    const summaryGrid = this.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px'
      }
    });

    const summaryItems = [
      { label: 'Reference', value: batchData.batchReference },
      { label: 'Status', value: batchData.status, isStatus: true },
      { label: 'Total Amount', value: this.formatCurrency(batchData.totalAmount) },
      { label: 'Payment Count', value: batchData.totalCount },
      { label: 'Created', value: new Date(batchData.createdAt).toLocaleDateString() },
      { label: 'Creator', value: batchData.creator?.fullName || 'Unknown' }
    ];

    if (batchData.depositedAt) {
      summaryItems.push({ label: 'Deposited', value: new Date(batchData.depositedAt).toLocaleDateString() });
    }

    if (batchData.kcbTransactionId) {
      summaryItems.push({ label: 'KCB Transaction', value: batchData.kcbTransactionId });
    }

    summaryItems.forEach(item => {
      const itemDiv = this.createElement('div');
      
      const label = this.createElement('div', {
        style: {
          fontSize: '12px',
          color: '#94a3b8',
          marginBottom: '5px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }
      }, item.label);

      const value = this.createElement('div', {
        style: {
          fontSize: '14px',
          fontWeight: '600',
          color: item.isStatus ? this.getStatusColor(item.value).text : '#e0e7ff'
        }
      }, item.value);

      if (item.isStatus) {
        value.style.backgroundColor = this.getStatusColor(item.value).bg;
        value.style.padding = '4px 8px';
        value.style.borderRadius = '6px';
        value.style.textAlign = 'center';
      }

      itemDiv.appendChild(label);
      itemDiv.appendChild(value);
      summaryGrid.appendChild(itemDiv);
    });

    summaryCard.appendChild(summaryTitle);
    summaryCard.appendChild(summaryGrid);
    content.appendChild(summaryCard);

    // Payments Table
    if (batchData.payments && batchData.payments.length > 0) {
      const paymentsCard = this.createElement('div', {
        className: 'neo-card',
        style: {
          padding: '20px',
          marginBottom: '25px',
          backgroundColor: 'rgba(15, 23, 42, 0.5)'
        }
      });

      const paymentsTitle = this.createElement('h3', {
        style: {
          margin: '0 0 20px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#e0e7ff'
        }
      }, 'Individual Payments');

      const tableContainer = this.createElement('div', {
        style: { overflowX: 'auto' }
      });

      const table = this.createElement('table', {
        style: {
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px'
        }
      });

      table.innerHTML = `
        <thead>
          <tr style="border-bottom: 1px solid rgba(59, 130, 246, 0.2);">
            <th style="padding: 12px 15px; text-align: left; color: #94a3b8; font-weight: 500;">Member</th>
            <th style="padding: 12px 15px; text-align: left; color: #94a3b8; font-weight: 500;">Type</th>
            <th style="padding: 12px 15px; text-align: right; color: #94a3b8; font-weight: 500;">Amount</th>
            <th style="padding: 12px 15px; text-align: left; color: #94a3b8; font-weight: 500;">Description</th>
            <th style="padding: 12px 15px; text-align: center; color: #94a3b8; font-weight: 500;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${batchData.payments.map(payment => `
            <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
              <td style="padding: 12px 15px;">${payment.user?.fullName || 'Unknown'}</td>
              <td style="padding: 12px 15px;">${this.getPaymentTypeDisplay(payment.paymentType)}</td>
              <td style="padding: 12px 15px; text-align: right;">${this.formatCurrency(payment.amount)}</td>
              <td style="padding: 12px 15px; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${payment.description}">${payment.description}</td>
              <td style="padding: 12px 15px; text-align: center;">
                <span style="padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; background-color: ${this.getStatusColor(payment.status).bg}; color: ${this.getStatusColor(payment.status).text};">
                  ${payment.status}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      `;

      tableContainer.appendChild(table);
      paymentsCard.appendChild(paymentsTitle);
      paymentsCard.appendChild(tableContainer);
      content.appendChild(paymentsCard);
    }

    // Action Buttons
    const actionsCard = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '15px',
        flexWrap: 'wrap',
        padding: '20px 0'
      }
    });

    // Add actions based on batch status
    if (batchData.status === 'PENDING') {
      const processBtn = this.createElement('button', {
        className: 'futuristic-button',
        style: {
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          color: '#10b981'
        },
        onClick: () => {
          this.toggleBatchDetailsModal(false);
          this.handleProcessExistingBatch(batchData.id);
        }
      }, '🏦 Process with KCB');

      const editBtn = this.createElement('button', {
        className: 'futuristic-button',
        style: {
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          color: '#3b82f6'
        },
        onClick: () => {
          this.toggleBatchDetailsModal(false);
          this.loadBatchForEditing(batchData.id);
        }
      }, '✏️ Edit Batch');

      const cancelBtn = this.createElement('button', {
        className: 'futuristic-button',
        style: {
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          color: '#ef4444'
        },
        onClick: () => {
          this.toggleBatchDetailsModal(false);
          this.handleCancelBatch(batchData.id);
        }
      }, '❌ Cancel Batch');

      actionsCard.appendChild(processBtn);
      actionsCard.appendChild(editBtn);
      actionsCard.appendChild(cancelBtn);

    } else if (batchData.status === 'DEPOSITED') {
      const checkStatusBtn = this.createElement('button', {
        className: 'futuristic-button',
        style: {
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          color: '#3b82f6'
        },
        onClick: () => {
          this.toggleBatchDetailsModal(false);
          this.handleCheckBatchStatus(batchData.id);
        }
      }, '🔄 Check Status');

      const completeBtn = this.createElement('button', {
        className: 'futuristic-button',
        style: {
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          color: '#10b981'
        },
        onClick: () => {
          this.toggleBatchDetailsModal(false);
          this.handleCompleteBatch(batchData.id);
        }
      }, '✅ Complete Batch');

      actionsCard.appendChild(checkStatusBtn);
      actionsCard.appendChild(completeBtn);

    } else if (batchData.status === 'COMPLETED') {
      const viewReceiptsBtn = this.createElement('button', {
        className: 'futuristic-button',
        style: {
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          color: '#10b981'
        },
        onClick: () => {
          this.toggleBatchDetailsModal(false);
          this.handleViewBatchReceipts(batchData.id);
        }
      }, '📄 View Receipts');

      actionsCard.appendChild(viewReceiptsBtn);
    }

    content.appendChild(actionsCard);
  }

  async handleViewBatchDetails(batchId) {
    try {
      // Show loading state
      this.toggleBatchDetailsModal(true, { 
        batchReference: 'Loading...', 
        status: 'LOADING',
        totalAmount: 0,
        totalCount: 0,
        createdAt: new Date().toISOString(),
        payments: []
      });

      const response = await this.queueApiRequest(() =>
        this.apiService.getBatchPaymentDetails(batchId)
      );
      
      const batchData = response.batchPayment;
      this.renderBatchDetailsContent(batchData);
      
    } catch (error) {
      console.error('Error fetching batch details:', error);
      this.toggleBatchDetailsModal(false);
      this.showNotification('Failed to load batch details.', 'error');
    }
  }

  async loadBatchForEditing(batchId) {
    try {
      // Set the batch selector to this batch
      const batchSelector = document.getElementById('batch-selector');
      if (batchSelector) {
        batchSelector.value = batchId;
        this.currentBatchId = batchId;
      }

      // Load the batch items
      await this.loadBatchItems(batchId);
      
      // Save the updated batch state
      this.saveBatchState();
      
      // Scroll to the form
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (error) {
      console.error('Error loading batch for editing:', error);
      this.showNotification('Failed to load batch for editing.', 'error');
    }
  }

  async handleViewBatchReceipts(batchId) {
    try {
      const response = await this.queueApiRequest(() =>
        this.apiService.getBatchPaymentDetails(batchId)
      );
      
      const batch = response.batchPayment;
      if (batch.payments && batch.payments.length > 0) {
        // Download receipts for each payment that has one
        let receiptCount = 0;
        for (const payment of batch.payments) {
          if (payment.receiptNumber) {
            try {
              await this.apiService.downloadReceipt(payment.id);
              receiptCount++;
              // Add small delay between downloads
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              console.warn(`Failed to download receipt for payment ${payment.id}:`, error);
            }
          }
        }
        
        if (receiptCount > 0) {
          this.showNotification(`Downloaded ${receiptCount} receipts.`, 'success');
        } else {
          this.showNotification('No receipts available for this batch.', 'warning');
        }
      } else {
        this.showNotification('No payments found in this batch.', 'warning');
      }
      
    } catch (error) {
      console.error('Error downloading receipts:', error);
      this.showNotification('Failed to download receipts.', 'error');
    }
  }

  async handleSpecialOfferingSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (this.isSubmitting) return;
      this.isSubmitting = true;
      
      const form = e.target;
      
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

      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error creating special offering:', error);
      this.errorMessage = error.message || 'Failed to create special offering';
      this.showNotification(this.errorMessage, 'error');
    } finally {
      this.isSubmitting = false;
      
      const form = document.getElementById('special-offering-form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      }
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = this.createElement('div', {
      className: 'notification',
      style: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '12px',
        color: '#ffffff',
        fontWeight: '500',
        fontSize: '14px',
        zIndex: '10000',
        maxWidth: '400px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        animation: 'slideInRight 0.3s ease-out',
        cursor: 'pointer'
      }
    });

    // Set background color based on type
    const colors = {
      'success': 'rgba(16, 185, 129, 0.9)',
      'error': 'rgba(239, 68, 68, 0.9)',
      'warning': 'rgba(245, 158, 11, 0.9)',
      'info': 'rgba(59, 130, 246, 0.9)'
    };

    notification.style.background = colors[type] || colors['info'];
    notification.textContent = message;

    // Add click to dismiss
    notification.addEventListener('click', () => {
      notification.remove();
    });

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }
    }, 5000);

    // Add animation styles if not already present
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }
}