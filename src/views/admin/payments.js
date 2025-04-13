// src/views/admin/payments.js
import { BaseComponent } from '../../utils/BaseComponent.js';

export class AdminPaymentsView extends BaseComponent {
  constructor() {
    super();
    
    // Add responsive breakpoints first
    this.breakpoints = {
      mobile: 768,
      tablet: 1024,
      desktop: 1280
    };
    
    // Add security measures
    this.sanitizeInput = (input) => {
      return input.replace(/[<>]/g, ''); // Basic XSS prevention
    };

    this.validateToken = () => {
      const token = this.authService.getToken();
      if (!token || this.isTokenExpired(token)) {
        window.location.href = '/login';
        return false;
      }
      return true;
    };

    this.isTokenExpired = (token) => {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        return payload.exp * 1000 < Date.now();
      } catch (e) {
        return true;
      }
    };
    
    // Add authService initialization
    this.authService = window.authService;
    if (!this.authService) {
      throw new Error('AuthService not initialized');
    }

    this.title = 'Transaction Management';
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
    
    // SMS Management
    this.smsStatus = new Map(); // Track SMS sent status
    this.batchSmsInProgress = false;
    this.batchSmsQueue = [];
    this.batchSize = 10; // Process 10 SMS at a time
    
    // API Request Management with improved security
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 300; // ms between API calls
    this.maxRequestRetries = 3;
    this.requestTimeout = 30000; // 30 seconds
    
    // Data Cache System with versioning
    this.paymentCache = {};
    this.specialOfferingsCache = null;
    this.lastFetchTime = null;
    this.CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes
    this.cacheVersion = '1.0';
    this.SMS_STATUS = { sending: false, error: null, success: null };
    
    // Initialize viewport and responsive handling
    this.viewport = this.getViewportSize();
    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    this.resizeObserver.observe(document.body);

    // Add sorting configuration with proper timestamp handling
    this.sortConfig = {
      field: 'id',
      direction: 'desc',
      getSortValue: (item) => {
        if (this.sortConfig.field === 'paymentDate') {
          return new Date(item.paymentDate).getTime();
        }
        return item[this.sortConfig.field];
      }
    };
    
    // Add loading optimization
    this.pageSize = this.getOptimalPageSize();
    this.lazyLoadThreshold = 500;

    // Add resize handler binding after method definition 
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }
  
  // Update viewport size calculator
  getViewportSize() {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    return {
      width: vw,
      isMobile: vw < this.breakpoints.mobile,
      isTablet: vw >= this.breakpoints.mobile && vw < this.breakpoints.tablet,
      isDesktop: vw >= this.breakpoints.tablet
    };
  }

  // Update page size based on viewport
  getOptimalPageSize() {
    const viewport = this.getViewportSize();
    if (viewport.isMobile) return 10;
    if (viewport.isTablet) return 15;
    return 20;
  }

  // Add security for API calls
  secureApiCall(call) {
    if (!this.validateToken()) return Promise.reject(new Error('Invalid session'));
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      call()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  handleResize() {
    const width = window.innerWidth;
    this.viewport = {
        width,
        isMobile: width < this.breakpoints.mobile,
        isTablet: width >= this.breakpoints.mobile && width < this.breakpoints.tablet,
        isDesktop: width >= this.breakpoints.tablet
    };
    
    // Update page size based on viewport
    this.pageSize = this.getOptimalPageSize();
    
    // Trigger re-render if needed
    if (this.isRendered) {
        this.updateView();
    }
  }

  async render() {
    const container = document.createElement('div');
    container.className = 'transaction-management-container';
    
    // Add responsive form
    const form = this.createFilterForm();
    
    // Add loading state
    const loadingState = this.isLoading ? 
      '<div class="loading-spinner">Loading...</div>' : '';
    
    // Add error/success messages
    const messages = this.createMessageElements();
    
    // Construct main content
    container.innerHTML = `
      <div class="page-header">
        <h1>Transaction Management</h1>
        ${this.viewport.isMobile ? '<div class="mobile-actions"></div>' : ''}
      </div>
      ${loadingState}
      ${messages}
    `;
    
    container.appendChild(form);
    
    if (!this.isLoading) {
      container.appendChild(this.renderPaymentsTable());
      container.appendChild(this.createPagination());
    }
    
    // Add responsive styles
    this.addResponsiveStyles();
    
    return container;
  }

  createFilterForm() {
    const form = document.createElement('form');
    form.className = 'filter-form';
    form.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label for="startDate">Start Date</label>
          <input type="date" id="startDate" value="${this.filters.startDate}">
        </div>
        <div class="form-group">
          <label for="endDate">End Date</label>
          <input type="date" id="endDate" value="${this.filters.endDate}">
        </div>
        <div class="form-group">
          <label for="paymentType">Payment Type</label>
          <select id="paymentType">
            <option value="">All Types</option>
            ${this.getPaymentTypeOptions()}
          </select>
        </div>
        <div class="form-group">
          <label for="specialOffering">Special Offering</label>
          <select id="specialOffering">
            <option value="">All Offerings</option>
            ${this.getSpecialOfferingOptions()}
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="primary-btn">Apply Filters</button>
        <button type="button" class="secondary-btn" id="resetFilters">Reset</button>
      </div>
    `;
    
    form.addEventListener('submit', this.handleFilterSubmit.bind(this));
    form.querySelector('#resetFilters').addEventListener('click', this.handleFilterReset.bind(this));
    
    return form;
  }

  handleFilterSubmit(event) {
    event.preventDefault();
    this.isLoading = true;
    this.currentPage = 1;
    
    const formData = new FormData(event.target);
    this.filters = {
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      paymentType: formData.get('paymentType'),
      specialOffering: formData.get('specialOffering')
    };
    
    this.loadPayments();
  }

  async loadPayments() {
    try {
      const response = await this.secureApiCall(() => 
        this.apiService.get('/api/payments', {
          params: {
            ...this.filters,
            page: this.currentPage,
            pageSize: this.getOptimalPageSize(),
            sortBy: 'id',
            sortOrder: 'desc'
          }
        })
      );
      
      this.payments = response.data.payments;
      this.totalPages = response.data.totalPages;
      this.totalPayments = response.data.total;
    } catch (error) {
      this.error = 'Failed to load transactions. Please try again.';
      console.error('Load payments error:', error);
    } finally {
      this.isLoading = false;
      this.updateView();
    }
  }

  async handleBatchSms(payments) {
    if (this.batchSmsInProgress) {
      this.error = 'Batch SMS sending is already in progress';
      this.updateView();
      return;
    }

    this.batchSmsInProgress = true;
    this.SMS_STATUS.sending = true;
    this.error = null;
    this.success = null;
    this.updateView();

    try {
      for (let i = 0; i < payments.length; i += this.batchSize) {
        const batch = payments.slice(i, i + this.batchSize);
        await Promise.all(batch.map(payment => this.sendSingleSms(payment)));
        await new Promise(resolve => setTimeout(resolve, 1000)); // Prevent rate limiting
      }
      this.success = `Successfully sent ${payments.length} SMS messages`;
    } catch (error) {
      this.error = `Failed to send batch SMS: ${error.message}`;
      console.error('Batch SMS error:', error);
    } finally {
      this.batchSmsInProgress = false;
      this.SMS_STATUS.sending = false;
      this.updateView();
    }
  }

  async sendSingleSms(payment) {
    if (this.smsStatus.get(payment.id) === 'Sent') {
      return;
    }

    try {
      await this.secureApiCall(() => 
        this.apiService.post('/api/payments/send-sms', {
          paymentId: payment.id,
          type: 'payment_confirmation'
        })
      );
      this.smsStatus.set(payment.id, 'Sent');
    } catch (error) {
      this.smsStatus.set(payment.id, 'Failed');
      throw error;
    }
  }

  async handleViewPayment(paymentId) {
    try {
      const payment = this.payments.find(p => p.id === paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      this.selectedPayment = payment;
      this.showPaymentDetails(payment);
    } catch (error) {
      this.error = `Failed to view payment: ${error.message}`;
      console.error('View payment error:', error);
    }
  }

  showPaymentDetails(payment) {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    
    const offeringInfo = payment.specialOffering ? 
      this.specialOfferings.find(so => so.id === payment.specialOffering) : null;
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Transaction Details</h2>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <span class="label">Transaction ID:</span>
            <span class="value">${payment.id}</span>
          </div>
          <div class="detail-row">
            <span class="label">Date:</span>
            <span class="value">${new Date(payment.paymentDate).toLocaleString()}</span>
          </div>
          <div class="detail-row">
            <span class="label">Amount:</span>
            <span class="value">${payment.amount.toLocaleString()}</span>
          </div>
          <div class="detail-row">
            <span class="label">Type:</span>
            <span class="value">${this.getPaymentTypeName(payment)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Description:</span>
            <span class="value">${this.sanitizeInput(this.getPaymentDescription(payment))}</span>
          </div>
          ${offeringInfo ? `
            <div class="detail-row">
              <span class="label">Receipt Number:</span>
              <span class="value">${offeringInfo.receiptNumber || 'N/A'}</span>
            </div>
          ` : ''}
          <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value status-badge ${payment.status.toLowerCase()}">${payment.status}</span>
          </div>
          <div class="detail-row">
            <span class="label">SMS Status:</span>
            <span class="value sms-status ${(this.smsStatus.get(payment.id) || 'not-sent').toLowerCase().replace(' ', '-')}">
              ${this.smsStatus.get(payment.id) || 'Not Sent'}
            </span>
          </div>
        </div>
        <div class="modal-footer">
          ${this.smsStatus.get(payment.id) !== 'Sent' ? `
            <button class="send-sms-btn" data-id="${payment.id}">Send SMS</button>
          ` : ''}
          <button class="close-btn">Close</button>
        </div>
      </div>
    `;

    // Add modal styles
    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
      .payment-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }

      .modal-content {
        background: rgba(30, 41, 59, 0.95);
        border-radius: 8px;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
      }

      .modal-header {
        padding: 16px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .modal-body {
        padding: 16px;
      }

      .modal-footer {
        padding: 16px;
        border-top: 1px solid rgba(148, 163, 184, 0.1);
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      }

      .detail-row:last-child {
        border-bottom: none;
      }

      .label {
        color: #94a3b8;
        font-weight: 500;
      }

      .value {
        color: #e2e8f0;
      }

      @media (max-width: 768px) {
        .modal-content {
          width: 95%;
        }

        .detail-row {
          flex-direction: column;
          gap: 4px;
        }

        .value {
          padding-left: 16px;
        }
      }
    `;
    document.head.appendChild(modalStyle);

    // Add event listeners
    modal.querySelector('.close-btn').addEventListener('click', () => {
      modal.remove();
      modalStyle.remove();
    });

    const smsBtns = modal.querySelectorAll('.send-sms-btn');
    smsBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const paymentId = parseInt(btn.dataset.id);
        await this.sendSingleSms({ id: paymentId });
        modal.remove();
        modalStyle.remove();
        this.updateView();
      });
    });

    document.body.appendChild(modal);
  }

  handleFilterReset() {
    this.filters = {
      startDate: '',
      endDate: '',
      paymentType: '',
      userId: '',
      specialOffering: ''
    };
    this.currentPage = 1;
    this.loadPayments();
  }

  getPaymentTypeOptions() {
    const types = [...new Set(this.payments.map(p => p.paymentType))];
    return types
      .map(type => `<option value="${type}">${type}</option>`)
      .join('');
  }

  getSpecialOfferingOptions() {
    return this.specialOfferings
      .map(so => `<option value="${so.id}">${so.name}</option>`)
      .join('');
  }

  createMessageElements() {
    let messages = '';
    if (this.error) {
      messages += `<div class="error-message">${this.sanitizeInput(this.error)}</div>`;
    }
    if (this.success) {
      messages += `<div class="success-message">${this.sanitizeInput(this.success)}</div>`;
    }
    if (this.SMS_STATUS.sending) {
      messages += '<div class="info-message">Sending SMS messages...</div>';
    }
    return messages;
  }

  renderPaymentsTable() {
    const wrapper = document.createElement('div');
    wrapper.className = 'payments-table-wrapper';
    wrapper.style.cssText = 'overflow-x: auto; background: rgba(30, 41, 59, 0.5); border-radius: 8px; margin-top: 20px;';

    const table = document.createElement('table');
    table.className = 'payments-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; min-width: 700px;';

    // Sort payments by ID in descending order
    const sortedPayments = [...this.payments].sort((a, b) => b.id - a.id);

    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>ID ▼</th>
        <th>Date</th>
        <th>Amount</th>
        <th>Description</th>
        <th>Payment Type</th>
        <th>Status</th>
        <th>SMS Status</th>
        <th>Actions</th>
      </tr>
    `;

    const tbody = document.createElement('tbody');
    
    sortedPayments.forEach(payment => {
      const tr = document.createElement('tr');
      const description = this.getPaymentDescription(payment);
      const smsStatus = this.smsStatus.get(payment.id) || 'Not Sent';
      
      tr.innerHTML = `
        <td>${payment.id}</td>
        <td>${new Date(payment.paymentDate).toLocaleDateString()}</td>
        <td>${payment.amount.toLocaleString()}</td>
        <td>${this.sanitizeInput(description)}</td>
        <td>${this.sanitizeInput(this.getPaymentTypeName(payment))}</td>
        <td><span class="status-badge ${payment.status.toLowerCase()}">${payment.status}</span></td>
        <td><span class="sms-status ${smsStatus.toLowerCase().replace(' ', '-')}">${smsStatus}</span></td>
        <td class="actions">
          <button class="view-btn" data-id="${payment.id}">View</button>
          <button class="send-sms-btn" data-id="${payment.id}" ${smsStatus === 'Sent' ? 'disabled' : ''}>
            Send SMS
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);

    // Add batch SMS button if there are unsent messages
    const unsentPayments = sortedPayments.filter(p => !this.smsStatus.get(p.id));
    if (unsentPayments.length > 0) {
      const batchSmsBtn = document.createElement('button');
      batchSmsBtn.className = 'batch-sms-btn';
      batchSmsBtn.textContent = `Send Batch SMS (${unsentPayments.length})`;
      batchSmsBtn.onclick = () => this.handleBatchSms(unsentPayments);
      wrapper.insertBefore(batchSmsBtn, table);
    }

    // Add responsive table styles
    const style = document.createElement('style');
    style.textContent = `
      .payments-table th, .payments-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        white-space: nowrap;
      }

      .payments-table th {
        background: rgba(30, 41, 59, 0.8);
        color: #e2e8f0;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 1;
      }

      .payments-table tbody tr:hover {
        background: rgba(51, 65, 85, 0.5);
      }

      @media (max-width: 768px) {
        .payments-table {
          font-size: 14px;
        }

        .payments-table td {
          padding: 8px;
        }

        .payments-table-wrapper {
          margin: 0 -12px;
          border-radius: 0;
        }
      }

      @media (max-width: 480px) {
        .payments-table {
          font-size: 12px;
        }

        .payments-table td {
          padding: 6px;
        }
      }
    `;
    document.head.appendChild(style);

    return wrapper;
  }

  createPagination() {
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';
    
    const totalPages = Math.ceil(this.totalPayments / this.pageSize);
    const currentPage = this.currentPage;
    
    let pages = [];
    if (totalPages <= 5) {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      if (currentPage <= 3) {
        pages = [1, 2, 3, 4, '...', totalPages];
      } else if (currentPage >= totalPages - 2) {
        pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      } else {
        pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
      }
    }
    
    const paginationHTML = `
      <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
        Previous
      </button>
      ${pages.map(page => {
        if (page === '...') {
          return '<span class="pagination-ellipsis">...</span>';
        }
        return `
          <button class="pagination-btn ${page === currentPage ? 'active' : ''}" 
                  data-page="${page}">
            ${page}
          </button>
        `;
      }).join('')}
      <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} 
              data-page="${currentPage + 1}">
        Next
      </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
    
    // Add pagination styles
    const style = document.createElement('style');
    style.textContent = `
      .pagination {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-top: 24px;
        flex-wrap: wrap;
      }

      .pagination-btn {
        padding: 8px 12px;
        border: none;
        background: rgba(51, 65, 85, 0.5);
        color: #e2e8f0;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .pagination-btn:hover:not(:disabled) {
        background: rgba(71, 85, 105, 0.5);
      }

      .pagination-btn.active {
        background: #3b82f6;
        color: white;
      }

      .pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pagination-ellipsis {
        padding: 8px;
        color: #e2e8f0;
      }

      @media (max-width: 768px) {
        .pagination {
          gap: 4px;
        }

        .pagination-btn {
          padding: 6px 10px;
          font-size: 14px;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Add event listeners
    paginationContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.pagination-btn');
      if (btn && !btn.disabled) {
        const page = parseInt(btn.dataset.page);
        if (page !== this.currentPage) {
          this.currentPage = page;
          this.loadPayments();
        }
      }
    });
    
    return paginationContainer;
  }

  // Helper methods for data display
  getPaymentTypeName(payment) {
    if (payment.specialOffering) {
      return payment.description || 'Special Offering';
    }
    return payment.paymentType;
  }

  getPaymentDescription(payment) {
    if (payment.specialOffering) {
      const offering = this.specialOfferings.find(so => so.id === payment.specialOffering);
      return offering ? offering.name : payment.description;
    }
    return payment.description;
  }

  // Handle cleanup
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver.disconnect();
  }

  addResponsiveStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .transaction-management-container {
        padding: 16px;
        max-width: 1280px;
        margin: 0 auto;
      }
      
      .filter-form {
        background: rgba(30, 41, 59, 0.5);
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 24px;
      }
      
      .form-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
      
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .form-group label {
        font-size: 14px;
        color: #e2e8f0;
      }
      
      .form-group input, .form-group select {
        padding: 8px;
        border-radius: 4px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.3);
        color: #e2e8f0;
      }
      
      .form-actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
      }
      
      .primary-btn, .secondary-btn {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .primary-btn {
        background: #3b82f6;
        color: white;
      }
      
      .secondary-btn {
        background: rgba(148, 163, 184, 0.2);
        color: #e2e8f0;
      }
      
      .loading-spinner {
        text-align: center;
        padding: 24px;
        color: #e2e8f0;
      }
      
      @media (max-width: 768px) {
        .transaction-management-container {
          padding: 12px;
        }
        
        .form-grid {
          grid-template-columns: 1fr;
        }
        
        .form-actions {
          flex-direction: column;
        }
        
        .primary-btn, .secondary-btn {
          width: 100%;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
}