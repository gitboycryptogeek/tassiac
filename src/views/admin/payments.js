// src/views/admin/payments.js
import { BaseComponent } from '../../utils/BaseComponent.js';

export class AdminPaymentsView extends BaseComponent {
  constructor() {
    super();
    
    this.authService = window.authService;
    if (!this.authService) {
      console.error('AuthService not initialized at AdminPaymentsView construction');
      throw new Error('AuthService not initialized');
    }

    this.apiService = window.apiService;  
    if (!this.apiService) { // Added check for apiService
      console.error('ApiService not initialized at AdminPaymentsView construction');
      throw new Error('ApiService not initialized');
    }
    
    this.title = 'Payment Management';
    this.user = this.authService ? this.authService.getUser() : null;
    
    this.allPaymentsMasterList = [];  
    this.payments = []; 
    this.specialOfferings = [];

    this.currentPage = 1;
    this.totalPages = 1;
    this.totalFilteredPayments = 0;  
    this.isLoading = true; 
    this.error = null;
    this.success = null;

    this.filters = {
      search: ''  
    };

    this.exportFilterState = {
        startDate: '',
        endDate: '',
        paymentType: '',
        specialOffering: '',
        format: '' 
    };

    this.selectedPayment = null;
    
    this.apiRequestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 200;  
    
    this.specialOfferingsCache = null;  
    this.CACHE_LIFETIME = 5 * 60 * 1000;  
    
    this.smsState = new Map();  
    this.pdfState = { generating: false };  
    this.batchSmsState = { sending: false, queue: [], results: [], progress: 0, total: 0 };
    
    this.searchDebounceTimer = null; 
    this.SEARCH_DEBOUNCE_DELAY = 550;
    
    this.isRendering = false;  
    this.isRendered = false;  
    this._fetchInProgress = false;  

    this.breakpoints = { mobile: 768, tablet: 1024 };
    this.viewport = {
      width: window.innerWidth,
      isMobile: window.innerWidth < this.breakpoints.mobile,
      isTablet: window.innerWidth >= this.breakpoints.mobile && window.innerWidth < this.breakpoints.tablet
    };
    this.pageSize = this.viewport.isMobile ? 10 : 20;

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // Initial data fetch
    // Consider wrapping these in an async init() method for clearer control
    // For now, keeping as is, assuming the main issue is backend.
    console.log('AdminPaymentsView: Kicking off initial data fetches.');
    this.fetchAllPaymentsData();
    this.fetchSpecialOfferings(); 
  }
  
  handleResize() {
    const width = window.innerWidth;
    this.viewport = {
        width,
        isMobile: width < this.breakpoints.mobile,
        isTablet: width >= this.breakpoints.mobile && width < this.breakpoints.tablet
    };
    const newPageSize = this.viewport.isMobile ? 10 : 20;
    if (newPageSize !== this.pageSize) {
        this.pageSize = newPageSize;
        this.applyFiltersAndPagination(this.filters);  
        if(this.isRendered) this.updateView();
    }
  }

  async render() {
    // console.log('AdminPaymentsView: render() called. isLoading:', this.isLoading, '_fetchInProgress:', this._fetchInProgress, 'isRendering:', this.isRendering);
    if (this.isRendering && document.readyState !== 'complete') {
        // console.log('AdminPaymentsView: Bailing from render due to isRendering and document.readyState');
        return null;
    }
    this.isRendering = true;
    
    try {
      if (!this.authService.isAdmin()) {
        this.isRendering = false;
        return this.renderUnauthorized();
      }
      
      this.addBackgroundEffects();
      
      const container = this.createElement('div', { className: 'dashboard-container' });

      container.appendChild(this.renderTopNavigation());
      container.appendChild(this.renderPageHeader());    
      
      if (this.error) container.appendChild(this.renderAlert('error', this.error));      
      if (this.success) container.appendChild(this.renderAlert('success', this.success));  
      
      container.appendChild(this.renderFiltersCard());  
      
      if (this.isLoading && this._fetchInProgress) {  
        // console.log('AdminPaymentsView: Rendering loading state.');
        container.appendChild(this.renderLoading());  
      } else { 
        // console.log('AdminPaymentsView: Rendering payments table.');
        container.appendChild(this.renderPaymentsTable());  
      }
      
      container.appendChild(this.renderPaymentDetailModal());
      container.appendChild(this.renderSmsStatusModal());
      container.appendChild(this.renderBatchSmsModal());
      container.appendChild(this.renderExportFilterModal());  
      
      this.addGlobalStyles();  
      
      if (!this.isRendered) { 
          this.attachEventListeners();  
      }
      
      this.isRendered = true;  
      this.isRendering = false;
      // console.log('AdminPaymentsView: render() completed.');
      return container;
    } catch (error) {
      console.error('Render error in AdminPaymentsView:', error);
      this.isRendering = false;
      return this.renderError(error);  
    }
  }
  
  addBackgroundEffects() {
    if (!document.querySelector('.gradient-background')) {
      const gradientBackground = this.createElement('div', { className: 'gradient-background' });
      document.body.appendChild(gradientBackground);
    }
    if (!document.querySelector('.particle-overlay')) {
      const particleOverlay = this.createElement('div', { className: 'particle-overlay' });
      document.body.appendChild(particleOverlay);
    }
  }
  
  renderPageHeader() {
    const headerSection = this.createElement('div', { className: 'neo-card animated-item page-header-card' });
    const headerGlow = this.createElement('div', { className: 'card-glow' });
    headerSection.appendChild(headerGlow);
    
    for (let i = 0; i < 3; i++) {  
        const particle = this.createElement('div', { className: 'header-particle' });
        Object.assign(particle.style, {
            width: `${Math.random() * 4 + 2}px`, height: `${Math.random() * 4 + 2}px`,
            top: `${Math.random() * 100}%`, right: `${Math.random() * 30}%`,
            animationDelay: `${Math.random() * 2}s`, opacity: Math.random() * 0.5 + 0.2,
        });
        headerSection.appendChild(particle);
    }
    
    const headerContent = this.createElement('div', { className: 'page-header-content' });
    const headerTitle = this.createElement('h1', { className: 'page-header-title' }, 'Payment Management');
    const exportButtonsGroup = this.createElement('div', { className: 'export-buttons-group' });
    
    const exportCsvButton = this.createFuturisticButton('Export CSV', '#10b981', () => this.showExportFilterModal('csv'));
    const csvIcon = this.createSvgIcon('csv');
    if (csvIcon) exportCsvButton.prepend(csvIcon);
    
    const exportPdfButton = this.createFuturisticButton('Export PDF', '#ef4444', () => this.showExportFilterModal('pdf'));
    const pdfIcon = this.createSvgIcon('pdf');
    if (pdfIcon) exportPdfButton.prepend(pdfIcon);
    
    const batchSmsButton = this.createFuturisticButton('Batch SMS', '#8b5cf6', () => this.showBatchSmsModal());
    const smsIconSvg = this.createSvgIcon('sms');
    if (smsIconSvg) batchSmsButton.prepend(smsIconSvg);
    
    exportButtonsGroup.append(exportCsvButton, exportPdfButton, batchSmsButton);
    headerContent.append(headerTitle, exportButtonsGroup);
    headerSection.appendChild(headerContent);
    return headerSection;
  }
  
  createFuturisticButton(text, color, onClick) {
    const button = this.createElement('button', { className: 'futuristic-button' });
    if (onClick) button.onclick = onClick;  
    const rgb = this.hexToRgb(color);
    if (rgb) {  
        button.style.setProperty('--btn-color-r', rgb.r.toString());
        button.style.setProperty('--btn-color-g', rgb.g.toString());
        button.style.setProperty('--btn-color-b', rgb.b.toString());
    }
    button.appendChild(document.createTextNode(text));  
    return button;
  }
  
  createSvgIcon(type) {
    const iconWrapper = this.createElement('span', { className: 'svg-icon-wrapper' });
    const icons = {  
        csv: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
        pdf: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10.5 17H8.5v-2H10c.8 0 1.5.7 1.5 1.5v0c0 .8-.7 1.5-1.5 1.5zM12 17h1.5a1.5 1.5 0 0 0 1.5-1.5v0A1.5 1.5 0 0 0 13.5 14H12v3zM15 17h1a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1v5z"/></svg>`,
        eye: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
        sms: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
    };
    if (icons[type]) iconWrapper.innerHTML = icons[type];
    return iconWrapper;
  }
  
  renderAlert(type, message) {
    const configs = {
      success: { icon: '✓' },
      error: { icon: '⚠' }
    };
    const config = configs[type] || configs.error;
    const alertElement = this.createElement('div', { className: `neo-card animated-item alert-card alert-${type}` });
    alertElement.innerHTML = `<span class="alert-icon">${config.icon}</span><span class="alert-message">${this.escapeHtml(message)}</span>`;
    return alertElement;
  }
  
  renderFiltersCard() {
    const filtersCard = this.createElement('div', { className: 'neo-card animated-item filters-card' });
    filtersCard.appendChild(this.createElement('div', { className: 'card-glow' }));
    
    const filtersHeader = this.createElement('div', { className: 'filters-header' });
    filtersHeader.appendChild(this.createElement('h2', { className: 'filters-title' }, '🔍 Search Payments'));
    filtersCard.appendChild(filtersHeader);
    
    const filtersContent = this.createElement('div', { className: 'filters-content' });
    const filtersForm = this.createElement('form', { id: 'payment-filters-form', className: 'filters-form' });
    
    const searchGroup = this.createFormGroup('Search (All Fields)', 'search', 'text', 'Type any keyword...');
    searchGroup.querySelector('input').value = this.filters.search;
    
    const formActions = this.createElement('div', { className: 'filters-form-actions' });
    const resetButton = this.createFuturisticButton('Reset Search', '#64748b', () => this.resetFilters());
    formActions.append(resetButton);

    filtersForm.append(searchGroup, formActions); 
    filtersContent.appendChild(filtersForm);
    filtersCard.appendChild(filtersContent);
    return filtersCard;
  }
  
  createFormGroup(label, id, type, placeholder = '') {
    const formGroup = this.createElement('div', { className: 'form-group' });
    const formLabel = this.createElement('label', { htmlFor: id, className: 'form-label' }, label);
    let inputElement;
    if (type === 'select') {
      inputElement = this.createElement('select', { id, name: id, className: 'form-control' });
    } else {
      inputElement = this.createElement('input', { id, name: id, type, className: 'form-control', placeholder });
    }
    formGroup.append(formLabel, inputElement);
    return formGroup;
  }
  
  renderPaymentsTable() {
    const tableCard = this.createElement('div', { className: 'neo-card animated-item payments-table-card' });
    tableCard.appendChild(this.createElement('div', { className: 'card-glow' }));
    
    const tableHeaderEl = this.createElement('div', { className: 'payments-table-header' });
    const tableTitle = this.createElement('h2', { className: 'payments-table-title' }, '💳 Payment Records');
    const paymentCount = this.createElement('span', { className: 'payment-count' }, `${this.totalFilteredPayments.toLocaleString()} records found`);
    tableHeaderEl.append(tableTitle, paymentCount);
    tableCard.appendChild(tableHeaderEl);

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const paginatedPayments = this.payments.slice(startIndex, endIndex);  

    if (paginatedPayments.length === 0 && !this.isLoading) { 
      const emptyState = this.createElement('div', { className: 'empty-state-container' });
      emptyState.innerHTML = `
        <div class="empty-state-icon">📋</div>
        <h3 class="empty-state-title">No payments match your criteria.</h3>
        <p class="empty-state-text">Try adjusting your search or add a new payment.</p>`;
      const addPaymentButton = this.createElement('a', { href: '/admin/add-payment', className: 'futuristic-button add-payment-empty' });
      addPaymentButton.textContent = '➕ Add New Payment';  
      const addBtnRgb = this.hexToRgb('#4f46e5');
      if (addBtnRgb) {
          addPaymentButton.style.setProperty('--btn-color-r', addBtnRgb.r.toString());
          addPaymentButton.style.setProperty('--btn-color-g', addBtnRgb.g.toString());
          addPaymentButton.style.setProperty('--btn-color-b', addBtnRgb.b.toString());
      }
      emptyState.appendChild(addPaymentButton);
      tableCard.appendChild(emptyState);
      return tableCard;
    }
    
    const tableContainer = this.createElement('div', { className: 'payment-table-wrapper' });
    const table = this.createElement('table', { className: 'payments-table' });
    const thead = this.createElement('thead');
    const headerRow = this.createElement('tr');
    const headers = ['ID', 'Date', 'User', 'Type', 'Method', 'Amount', 'Status', 'Actions'];
    headers.forEach(headerText => {
      const th = this.createElement('th', {}, headerText);
      if (headerText === 'Amount') th.style.textAlign = 'right';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = this.createElement('tbody');
    paginatedPayments.forEach((payment, index) => {  
      const row = this.createElement('tr');
      row.style.background = index % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'transparent';

      const cellData = [
          payment.id,
          this.formatDate(new Date(payment.paymentDate)),
          this.renderUserCell(payment.User), // Changed from payment.user to payment.User
          this.createPaymentTypeBadge(payment),
          payment.paymentMethod,
          this.renderAmountCell(payment),
          this.createStatusBadge(payment.status),
          this.renderActionButtons(payment)
      ];
      cellData.forEach((data, i) => {
          const cell = this.createElement('td');
          if (headers[i] === 'Amount') cell.style.textAlign = 'right';
          if (data instanceof Node) cell.appendChild(data);
          else cell.textContent = data !== null && data !== undefined ? data.toString() : '';
          row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    tableCard.appendChild(tableContainer);
    
    if (this.totalPages > 1) {  
      tableCard.appendChild(this.renderPagination());
    }
    return tableCard;
  }

  renderUserCell(user) {  
    const userCell = this.createElement('div', {className: 'user-cell'});
    if (user && user.fullName) {  
      userCell.innerHTML = `
        <div class="user-name">${this.escapeHtml(user.fullName)}</div>
        <div class="user-phone">${this.escapeHtml(user.phone) || 'N/A'}</div>`;
    } else {
      userCell.textContent = 'Unknown User';
    }
    return userCell;
  }

  renderAmountCell(payment) {  
    const amountCell = this.createElement('div', { className: 'amount-cell' });
    amountCell.style.color = payment.isExpense ? '#ef4444' : '#10b981';
    const amount = payment.amount !== null && payment.amount !== undefined ? parseFloat(payment.amount) : 0;
    amountCell.textContent = `${payment.isExpense ? '-' : ''}KES ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return amountCell;
  }

  createStatusBadge(status) {  
    const colors = { COMPLETED: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }, PENDING: { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }, FAILED: { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }};
    const config = colors[status] || colors.PENDING;  
    const badge = this.createElement('span', { className: 'status-badge' }, status || 'Unknown');  
    Object.assign(badge.style, { backgroundColor: config.bg, color: config.color });
    return badge;
  }

  renderActionButtons(payment) {  
    const actionsContainer = this.createElement('div', { className: 'action-buttons-container' });
    const viewButton = this.createElement('button', { className: 'action-button view-payment-btn', 'data-id': payment.id });
    const eyeIcon = this.createSvgIcon('eye');
    if (eyeIcon) viewButton.appendChild(eyeIcon);
    viewButton.appendChild(document.createTextNode('View'));
    actionsContainer.appendChild(viewButton);

    if (payment.User && payment.User.phone) { // Changed from payment.user to payment.User
      const smsButton = this.createElement('button', { className: 'action-button send-sms-btn', 'data-id': payment.id, 'data-phone': payment.User.phone, 'data-name': payment.User.fullName });
      const smsStateData = this.smsState.get(payment.id) || { sent: false, sending: false };
      this.styleSmsButton(smsButton, smsStateData.sending ? 'sending' : (smsStateData.sent ? 'sent' : 'default'));
      actionsContainer.appendChild(smsButton);
    }
    return actionsContainer;
  }

  renderPagination() {  
    const paginationContainer = this.createElement('div', { className: 'pagination-container' });
    if (this.currentPage > 1) {
      paginationContainer.appendChild(this.createElement('button', { className: 'pagination-item', 'data-page': this.currentPage - 1 }, '« Prev'));
    }
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);  
    if (startPage > 1) paginationContainer.appendChild(this.createElement('button', {className: 'pagination-item', 'data-page': 1}, '1'));
    if (startPage > 2) paginationContainer.appendChild(this.createElement('span', {className: 'pagination-ellipsis'}, '...'));
    
    for (let i = startPage; i <= endPage; i++) {
      paginationContainer.appendChild(this.createElement('button', { className: `pagination-item ${i === this.currentPage ? 'active' : ''}`, 'data-page': i }, i.toString()));
    }

    if (endPage < this.totalPages -1) paginationContainer.appendChild(this.createElement('span', {className: 'pagination-ellipsis'}, '...'));
    if (endPage < this.totalPages) paginationContainer.appendChild(this.createElement('button', {className: 'pagination-item', 'data-page': this.totalPages}, this.totalPages.toString()));

    if (this.currentPage < this.totalPages) {
      paginationContainer.appendChild(this.createElement('button', { className: 'pagination-item', 'data-page': this.currentPage + 1 }, 'Next »'));
    }
    return paginationContainer;
  }
  
  getPaymentTypeDisplayName(payment) {
    if (!payment) return 'Unknown';
    if (payment.isExpense || payment.paymentType === 'EXPENSE') return 'Expense';
    if (payment.paymentType === 'TITHE') return 'Tithe';
    if (payment.paymentType === 'OFFERING') return 'Offering';
    if (payment.paymentType === 'DONATION') return 'Donation';
    
    if (payment.paymentType && payment.paymentType.startsWith('SPECIAL_')) {
      const specialOffering = this.specialOfferings.find(o =>  
        o.paymentType === payment.paymentType || o.offeringType === payment.paymentType || o.offeringCode === payment.paymentType // Added offeringCode check
      );
      if (specialOffering) {
        return this.escapeHtml(specialOffering.description || specialOffering.name || `Special: ${payment.paymentType.replace('SPECIAL_', '')}`);
      }
      return `Special: ${this.escapeHtml(payment.paymentType.replace('SPECIAL_', '').replace(/_/g, ' '))}`;
    }
    
    const knownTypes = { 'OTHER': 'Other', 'SPECIAL_OFFERING_CONTRIBUTION': 'Special Contribution' }; // Added for clarity
    return knownTypes[payment.paymentType] || (payment.paymentType ? this.escapeHtml(payment.paymentType.charAt(0).toUpperCase() + payment.paymentType.slice(1).toLowerCase().replace(/_/g, ' ')) : 'Unknown');
  }

  createPaymentTypeBadge(payment) {  
    const typeName = this.getPaymentTypeDisplayName(payment);
    let badgeColor = { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' };  
    if (payment.isExpense || payment.paymentType === 'EXPENSE') badgeColor = { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
    else if (payment.paymentType === 'TITHE') badgeColor = { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' };
    else if (payment.paymentType === 'OFFERING') badgeColor = { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    else if (payment.paymentType === 'DONATION') badgeColor = { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
    else if (payment.paymentType && (payment.paymentType.startsWith('SPECIAL_') || payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION')) badgeColor = { bg: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' };
    
    const badge = this.createElement('span', { className: 'payment-type-badge' }, typeName.length > 25 ? typeName.substring(0,22) + '...' : typeName);
    Object.assign(badge.style, { backgroundColor: badgeColor.bg, color: badgeColor.color });
    return badge;
  }

  queueApiRequest(requestFunction) {  
    return new Promise((resolve, reject) => {
      this.apiRequestQueue.push({ request: requestFunction, resolve, reject });
      if (!this.isProcessingQueue) this.processApiRequestQueue();
    });
  }
  async processApiRequestQueue() {  
    if (this.apiRequestQueue.length === 0) { this.isProcessingQueue = false; return; }
    this.isProcessingQueue = true;
    const { request, resolve, reject } = this.apiRequestQueue.shift();
    try { 
        // console.log('AdminPaymentsView: Processing API request from queue.');
        resolve(await request()); 
    } catch (error) { 
        // console.error('AdminPaymentsView: Error in queued API request:', error);
        reject(error); 
    } finally { 
        setTimeout(() => this.processApiRequestQueue(), this.requestThrottleTime); 
    }
  }
    
  async fetchAllPaymentsData() {
    // console.log('AdminPaymentsView: fetchAllPaymentsData() started.');
    if (this._fetchInProgress) {
        // console.log('AdminPaymentsView: fetchAllPaymentsData() already in progress, returning.');
        return;
    }
    this._fetchInProgress = true;
    this.isLoading = true;
    this.error = null;  
    if(this.isRendered && !this.isRendering) this.updateView(); // Avoid calling updateView if another render is in progress

    try {
      // console.log('AdminPaymentsView: Calling API for /payment/all');
      const response = await this.queueApiRequest(() => this.apiService.get('/payment/all'));  
      // console.log('AdminPaymentsView: API response for /payment/all:', response);

      // apiService.get returns the 'data' object from the backend.
      // paymentController.getAllPayments returns: { payments, totalPages, currentPage, totalPayments }
      // So, response here is { payments, totalPages, ... }
      if (response && Array.isArray(response.payments)) {
        this.allPaymentsMasterList = response.payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()); // Ensure correct date sorting
        // console.log('AdminPaymentsView: Payments data processed, count:', this.allPaymentsMasterList.length);
      } else {
        this.allPaymentsMasterList = [];
        console.warn("AdminPaymentsView: No payments data received or in unexpected format from /payment/all:", response);
      }
      this.applyFiltersAndPagination(this.filters);  
    } catch (error) {
      console.error('AdminPaymentsView: Error fetching all payments data:', error);
      this.error = `Failed to load payment data: ${error.message || 'Unknown API error'}`;
      this.allPaymentsMasterList = [];
      this.applyFiltersAndPagination(this.filters);  
    } finally {
      // console.log('AdminPaymentsView: fetchAllPaymentsData() finally block. Setting isLoading=false, _fetchInProgress=false.');
      this.isLoading = false;
      this._fetchInProgress = false;
      if(!this.isRendering) this.updateView(); // Avoid calling updateView if another render is in progress
    }
  }

  applyClientSideFilters(sourceFilters) {
    let filtered = [...this.allPaymentsMasterList];

    if (sourceFilters.search) {
      const searchTerm = sourceFilters.search.toLowerCase();
      filtered = filtered.filter(p =>  
        (p.User?.fullName?.toLowerCase().includes(searchTerm)) || // Changed from p.user to p.User
        (p.User?.phone?.includes(searchTerm)) || // Changed from p.user to p.User
        (p.description?.toLowerCase().includes(searchTerm)) ||
        (p.paymentMethod?.toLowerCase().includes(searchTerm)) ||
        (p.id?.toString().includes(searchTerm)) ||  
        (this.getPaymentTypeDisplayName(p).toLowerCase().includes(searchTerm)) ||
        (p.receiptNumber?.toLowerCase().includes(searchTerm)) // Added receipt number to search
      );
    }

    if (sourceFilters.startDate) {
        try {
            const startDate = new Date(sourceFilters.startDate);
            startDate.setHours(0,0,0,0);  
            if (!isNaN(startDate)) { 
                filtered = filtered.filter(p => new Date(p.paymentDate) >= startDate);
            }
        } catch (e) { console.warn("Invalid start date for filter:", sourceFilters.startDate); }
    }
    if (sourceFilters.endDate) {
        try {
            const endDate = new Date(sourceFilters.endDate);
            endDate.setHours(23,59,59,999);  
            if (!isNaN(endDate)) { 
                filtered = filtered.filter(p => new Date(p.paymentDate) <= endDate);
            }
        } catch (e) { console.warn("Invalid end date for filter:", sourceFilters.endDate); }
    }
    
    if (sourceFilters.paymentType) {
        if (sourceFilters.paymentType === 'SPECIAL') { // For export filter: general "Special" category
            if (sourceFilters.specialOffering) {  // A specific special offering is chosen from dropdown
                // Filter by the specific offering code/ID (value from select)
                filtered = filtered.filter(p => p.paymentType === sourceFilters.specialOffering || p.specialOffering?.offeringCode === sourceFilters.specialOffering || p.specialOffering?.id?.toString() === sourceFilters.specialOffering);
            } else {  // All types of special offerings
                filtered = filtered.filter(p => p.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' || (p.paymentType && p.paymentType.startsWith('SPECIAL_')));
            }
        } else {  // Specific non-special type
            filtered = filtered.filter(p => p.paymentType === sourceFilters.paymentType);
        }
    }
    
    if (sourceFilters.userId) {  
        filtered = filtered.filter(p => p.User && p.User.id?.toString() === sourceFilters.userId);  // Changed from p.user to p.User
    }
    
    return filtered;
  }

  applyFiltersAndPagination(filterSetToUse) {
    const filteredPayments = this.applyClientSideFilters(filterSetToUse);
    this.totalFilteredPayments = filteredPayments.length;
    this.totalPages = Math.ceil(this.totalFilteredPayments / this.pageSize) || 1;
    this.currentPage = Math.max(1, Math.min(this.currentPage, this.totalPages));  
    this.payments = filteredPayments;  // This now holds the filtered (but not paginated) list
  }
  
  showExportFilterModal(format) {
    this.exportFilterState.format = format; 
    const modal = document.getElementById('export-filter-modal');
    if (modal) {
        modal.querySelector('#export-start-date').value = this.exportFilterState.startDate || '';
        modal.querySelector('#export-end-date').value = this.exportFilterState.endDate || '';
        
        const paymentTypeSelect = modal.querySelector('#export-payment-type');
        paymentTypeSelect.value = this.exportFilterState.paymentType || '';

        const specialOfferingGroup = modal.querySelector('#export-special-offering-group');
        const specialOfferingSelect = modal.querySelector('#export-special-offering');
        
        this.populateExportFilterSpecialOfferings(); 

        if (paymentTypeSelect.value === 'SPECIAL') {
            specialOfferingGroup.style.display = 'grid';
            specialOfferingSelect.value = this.exportFilterState.specialOffering || '';
        } else {
            specialOfferingGroup.style.display = 'none';
            specialOfferingSelect.value = ''; 
        }
        
        const searchInfoP = modal.querySelector('#export-search-info');
        if (searchInfoP) {
            searchInfoP.innerHTML = `The current main search term ("<strong style="color:#e0e7ff;">${this.escapeHtml(this.filters.search) || 'None'}</strong>") will also be applied.`;
        }

        modal.style.display = 'flex';
    }
  }
  
  async handleProceedWithExport() {
    const modal = document.getElementById('export-filter-modal');
    if (!modal) return;

    const exportFilters = {
        startDate: modal.querySelector('#export-start-date').value,
        endDate: modal.querySelector('#export-end-date').value,
        paymentType: modal.querySelector('#export-payment-type').value,
        specialOffering: '', 
        search: this.filters.search 
    };

    if (exportFilters.paymentType === 'SPECIAL') {
        exportFilters.specialOffering = modal.querySelector('#export-special-offering').value;
    }

    this.exportFilterState.startDate = exportFilters.startDate;
    this.exportFilterState.endDate = exportFilters.endDate;
    this.exportFilterState.paymentType = exportFilters.paymentType;
    this.exportFilterState.specialOffering = exportFilters.specialOffering;
    
    modal.style.display = 'none'; 
    this.exportPayments(this.exportFilterState.format, exportFilters);
  }


  async exportPayments(format, exportSpecificFilters) {
    this.showMessage(`Preparing ${format.toUpperCase()} export...`, 'info');
    
    const paymentsToExport = this.applyClientSideFilters(exportSpecificFilters);  

    if (paymentsToExport.length === 0) {
        this.showMessage('No data to export with the selected filters.', 'error');
        return;
    }

    if (format === 'csv') {
      try {
        const headers = ['ID', 'Date', 'User Name', 'User Phone', 'Payment Type', 'Description', 'Method', 'Amount (KES)', 'Status', 'Receipt No.'];
        const csvRows = [];
        csvRows.push(headers.join(','));  

        paymentsToExport.forEach(p => {
          const row = [
            p.id,
            this.formatDate(new Date(p.paymentDate)),
            `"${p.User?.fullName?.replace(/"/g, '""') || ''}"`,  // Changed from p.user to p.User
            p.User?.phone || '', // Changed from p.user to p.User
            this.getPaymentTypeDisplayName(p),
            `"${p.description?.replace(/"/g, '""') || ''}"`,  
            p.paymentMethod || '',
            p.amount,
            p.status || '',
            p.receiptNumber || ''
          ];
          csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        a.download = `payments_export_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        this.showMessage('CSV export generated successfully.', 'success');
      } catch (error) {
        console.error('Error generating CSV:', error);
        this.showMessage(`Failed to generate CSV: ${error.message}`, 'error');
      }
    } else if (format === 'pdf') {
      try {
        if (this.pdfState.generating) {
          this.showMessage('PDF generation is already in progress.', 'info');
          return;
        }
        this.pdfState.generating = true;
        this.showMessage('Generating PDF report...', 'info'); 
        await this.generateBatchPdfInBrowser(paymentsToExport);
      } catch (error) {
        console.error('Error generating batch PDF:', error);
        this.showMessage(`Failed to generate PDF: ${error.message}`, 'error');
      } finally {
        this.pdfState.generating = false;
      }
    }
  }

  async generateBatchPdfInBrowser(paymentsToPrint) {
    const printWindow = window.open('', '_blank', 'height=600,width=800,scrollbars=yes');
    if (!printWindow) {
      this.showMessage('Pop-up blocked! Please allow pop-ups for this site to generate PDF.', 'error', 10000);
      throw new Error('Pop-up blocked.');
    }
    printWindow.document.write('<html><head><title>Payments Export</title>');
    printWindow.document.write(`
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 10px; word-break: break-word; }
            th { background-color: #e9e9e9; font-weight: bold; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 18px; }
            .print-controls { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; }
            @media print { .print-controls { display: none !important; } body { margin: 0.5in; font-size: 10pt;} table{font-size: 9pt;} }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>Payment Records</h1>');
    printWindow.document.write('<table><thead><tr>');
    const headers = ['ID', 'Date', 'User', 'Type', 'Method', 'Amount (KES)', 'Status', 'Description'];
    headers.forEach(h => printWindow.document.write(`<th>${this.escapeHtml(h)}</th>`));
    printWindow.document.write('</tr></thead><tbody>');

    paymentsToPrint.forEach(p => {
        const amount = p.amount !== null && p.amount !== undefined ? parseFloat(p.amount) : 0;
        printWindow.document.write('<tr>');
        printWindow.document.write(`<td>${p.id}</td>`);
        printWindow.document.write(`<td>${this.formatDate(new Date(p.paymentDate))}</td>`);
        printWindow.document.write(`<td>${this.escapeHtml(p.User?.fullName) || 'N/A'} (${this.escapeHtml(p.User?.phone) || 'N/A'})</td>`); // Changed from p.user to p.User
        printWindow.document.write(`<td>${this.getPaymentTypeDisplayName(p)}</td>`);
        printWindow.document.write(`<td>${this.escapeHtml(p.paymentMethod) || ''}</td>`);
        printWindow.document.write(`<td style="text-align:right;">${p.isExpense ? '-' : ''}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`);
        printWindow.document.write(`<td>${this.escapeHtml(p.status) || ''}</td>`);
        printWindow.document.write(`<td>${this.escapeHtml(p.description) || ''}</td>`);
        printWindow.document.write('</tr>');
    });

    printWindow.document.write('</tbody></table>');
    
    const controlsDiv = printWindow.document.createElement('div');
    controlsDiv.className = 'print-controls';
    const printButton = printWindow.document.createElement('button');
    printButton.textContent = 'Print Records';
    printButton.style.cssText = 'padding: 8px 15px; font-size: 14px; cursor: pointer; margin: 0 5px; background-color:#4A90E2; color:white; border:none; border-radius:4px;';
    const closeButton = printWindow.document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = 'padding: 8px 15px; font-size: 14px; cursor: pointer; margin: 0 5px; background-color:#ccc; color:black; border:none; border-radius:4px;';
    controlsDiv.appendChild(printButton);
    controlsDiv.appendChild(closeButton);
    printWindow.document.body.appendChild(controlsDiv);
    
    printWindow.document.write('</body></html>');
    printWindow.document.close();  

    printWindow.onload = () => { 
        const pButton = printWindow.document.querySelector('.print-controls button:first-child');
        const cButton = printWindow.document.querySelector('.print-controls button:last-child');
        if(pButton) pButton.addEventListener('click', () => printWindow.print());
        if(cButton) cButton.addEventListener('click', () => printWindow.close());
        printWindow.focus();  
        this.showMessage('PDF ready for printing/saving. Use browser print option.', 'success');
    };
  }
  
  async fetchSpecialOfferings() {  
    // console.log('AdminPaymentsView: fetchSpecialOfferings() started.');
    try {
      if (this.specialOfferingsCache && (Date.now() - this.specialOfferingsCache.timestamp < this.CACHE_LIFETIME)) {
        this.specialOfferings = this.specialOfferingsCache.data;
        // console.log('AdminPaymentsView: Using cached special offerings.');
      } else {
        // console.log('AdminPaymentsView: Calling API for special offerings.');
        const response = await this.queueApiRequest(() => this.apiService.getSpecialOfferings());
        // console.log('AdminPaymentsView: API response for special offerings:', response);
        // apiService.getSpecialOfferings() returns the 'data' object from the backend.
        // specialOfferingController.getAllSpecialOfferings returns: { specialOfferings, totalPages, ... }
        // So, response here is { specialOfferings, ... }
        this.specialOfferings = (response && Array.isArray(response.specialOfferings)) ? response.specialOfferings : [];
        this.specialOfferingsCache = { data: this.specialOfferings, timestamp: Date.now() };
        // console.log('AdminPaymentsView: Special offerings fetched, count:', this.specialOfferings.length);
      }
    } catch (error) {
      console.error('AdminPaymentsView: Error fetching special offerings:', error);
      this.specialOfferings = []; 
      // Optionally set an error message if this fetch is critical and separate from payments fetch error
      // if (!this.error) this.error = `Failed to load special offerings: ${error.message}`;
    }
    this.populateExportFilterSpecialOfferings();  
    // console.log('AdminPaymentsView: fetchSpecialOfferings() completed.');
  }
  
  populateExportFilterSpecialOfferings() {
    const modal = document.getElementById('export-filter-modal');
    if (modal) {
        const select = modal.querySelector('select[name="export-special-offering"]');
        this.populateSpecialOfferingsDropdown(select, this.exportFilterState.specialOffering);
    }
  }

  populateSpecialOfferingsDropdown(selectElement, currentSelectionValue) {  
    if (selectElement) {
        const originalValue = currentSelectionValue || selectElement.value;  
        
        let firstOption = null;
        if (selectElement.options.length > 0 && selectElement.options[0].value === '') {
            firstOption = selectElement.options[0];
        }
        selectElement.innerHTML = ''; 
        if (firstOption) { 
            selectElement.appendChild(firstOption);
        } else { 
            selectElement.add(new Option('All Special Offerings', ''), 0);
        }

        this.specialOfferings.forEach(offering => {
          // Use offering.name for display, and offering.offeringCode or offering.id as value
          const displayName = this.escapeHtml(offering.name || offering.description || `ID: ${offering.id}`);
          const value = offering.offeringCode || offering.id.toString(); // Prefer code if available
          selectElement.add(new Option(displayName, value));
        });
        selectElement.value = originalValue;  
      }
  }
  
  async viewPaymentDetails(paymentId) {  
    const modal = document.getElementById('payment-detail-modal');
    const modalBody = document.getElementById('modal-body');
    if (!modal || !modalBody) return;
    modal.style.display = 'flex';
    modalBody.innerHTML = `<div class="modal-loading"><div class="loading-spinner"></div>Loading...</div>`;
    
    try {
        let payment = this.allPaymentsMasterList.find(p => p.id === parseInt(paymentId));
        if (!payment) throw new Error('Payment details not found in local data.');
        this.selectedPayment = payment;
        
        const modalTitle = document.getElementById('modal-title');
        if(modalTitle) modalTitle.textContent = `${this.getPaymentTypeDisplayName(payment)} Details`;
        
        modalBody.innerHTML = this.renderPaymentDetailsContent(payment);

        const downloadBtn = document.getElementById('modal-download-btn');
        if(downloadBtn) downloadBtn.onclick = () => this.downloadPdf(payment);  

        const sendSmsBtn = document.getElementById('modal-sms-btn');
        if (sendSmsBtn) {
            if (payment.User && payment.User.phone) { // Changed from payment.user to payment.User
                sendSmsBtn.style.display = 'inline-flex';  
                const smsStateData = this.smsState.get(payment.id) || { sent: false, sending: false };
                this.styleSmsButton(sendSmsBtn, smsStateData.sending ? 'sending' : (smsStateData.sent ? 'sent' : 'default'), true);
                sendSmsBtn.onclick = () => this.sendSms(payment.User.phone, payment.User.fullName, payment); // Changed from payment.user to payment.User
            } else {
                sendSmsBtn.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error in viewPaymentDetails:', error);
        modalBody.innerHTML = `<div class="modal-error">⚠️ Error loading details: ${this.escapeHtml(error.message)}</div>`;
    }
  }
  
  renderPaymentDetailsContent(payment) {  
    const paymentTypeName = this.getPaymentTypeDisplayName(payment);
    let html = `<div class="payment-details-grid">`;
    if (payment.User) { // Changed from payment.user to payment.User
        html += `<div class="neo-card detail-section"><h4>👤 User Information</h4><div><span>Name:</span><span>${this.escapeHtml(payment.User.fullName) || 'N/A'}</span></div><div><span>Phone:</span><span>${this.escapeHtml(payment.User.phone) || 'N/A'}</span></div>${payment.User.email ? `<div><span>Email:</span><span>${this.escapeHtml(payment.User.email)}</span></div>` : ''}</div>`;
    }
    html += `<div class="neo-card detail-section"><h4>💳 Payment Information</h4><div><span>ID:</span><span>${payment.id}</span></div><div><span>Date:</span><span>${this.formatDate(new Date(payment.paymentDate))}</span></div><div><span>Type:</span><span>${this.escapeHtml(paymentTypeName)}</span></div><div><span>Method:</span><span>${this.escapeHtml(payment.paymentMethod) || 'N/A'}</span></div><div><span>Status:</span><span>${this.escapeHtml(payment.status) || 'N/A'}</span></div><div><span>Receipt:</span><span>${this.escapeHtml(payment.receiptNumber) || 'N/A'}</span></div></div>`;
    const amount = payment.amount !== null && payment.amount !== undefined ? parseFloat(payment.amount) : 0;
    html += `<div class="neo-card detail-section"><h4>💰 Amount Information</h4><div><span>Amount:</span><span style="color:${payment.isExpense ? '#ef4444':'#10b981'}; font-weight:bold;">${payment.isExpense ? '-' : ''}KES ${amount.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`;
    if (payment.platformFee && parseFloat(payment.platformFee) > 0) {
        html += `<div><span>Platform Fee:</span><span>KES ${parseFloat(payment.platformFee).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>`;
    }
    if (payment.description) {
        html += `<div class="description-detail"><span>Description:</span><p>${this.escapeHtml(payment.description)}</p></div>`;
    }
    html += `</div>`;  
    // Check for special offering details using payment.specialOffering (populated by include in Prisma query)
    if (payment.specialOffering && (payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' || payment.paymentType.startsWith('SPECIAL_'))) {
        const so = payment.specialOffering; // Already have details if included
        html += `<div class="neo-card detail-section so-detail"><h4>✨ Special Offering</h4><div><span>Name:</span><span>${this.escapeHtml(so.name || so.description)}</span></div>${so.targetAmount ? `<div><span>Target:</span><span>KES ${parseFloat(so.targetAmount).toLocaleString()}</span></div>` : ''}${so.endDate ? `<div><span>Ends:</span><span>${this.formatDate(new Date(so.endDate))}</span></div>` : ''}</div>`;
    } else if (payment.isExpense && payment.department) {
        html += `<div class="neo-card detail-section dept-detail"><h4>🏢 Department</h4><div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background-color:${this.getDepartmentColor(payment.department)};"></div><span>${this.formatDepartment(payment.department)}</span></div></div>`;
    }
    html += `</div>`;  
    return html;
  }
  
  escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
          .toString()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }

  async downloadPdf(payment) {  
    try {
      if (this.pdfState.generating) {
        this.showMessage('Receipt generation is already in progress.', 'info'); return;
      }
      this.pdfState.generating = true;
      this.showMessage('Generating receipt...', 'info');
      await this.generatePdfInBrowser(payment);  
    } catch (error) {
      console.error('Error preparing PDF receipt:', error);
      if (error.message !== 'Pop-up blocked.') { 
         this.showMessage(`Failed to generate receipt: ${error.message}.`, 'error');
      }
    } finally {
      this.pdfState.generating = false;
    }
  }

  async generatePdfInBrowser(payment) {  
    const printWindow = window.open('', '_blank', 'height=700,width=850,scrollbars=yes,resizable=yes');
    if (!printWindow) {
      this.showMessage('Pop-up blocked! Please allow pop-ups for this site to generate the receipt.', 'error', 10000);  
      throw new Error('Pop-up blocked.');
    }
    const user = payment.User || { fullName: 'N/A', phone: 'N/A', email: 'N/A' }; // Changed from payment.user to payment.User
    const paymentTypeName = this.getPaymentTypeDisplayName(payment);
    const amount = payment.amount !== null && payment.amount !== undefined ? parseFloat(payment.amount) : 0;

    const htmlContent = `
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Receipt ${payment.id}</title>
      <style>
        body{font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;margin:20px;color:#333;max-width:750px;margin-left:auto;margin-right:auto;border:1px solid #dcdcdc;padding:25px; box-shadow: 0 0 15px rgba(0,0,0,0.05);}
        .header{text-align:center;border-bottom:2px solid #4A90E2;padding-bottom:15px;margin-bottom:25px;}
        .header h1{margin:0;font-size:26px;color:#4A90E2; font-weight:600;} .header p{margin:5px 0;font-size:14px; color:#555;}
        .section{margin-bottom:25px;}.section h2{font-size:18px;color:#4A90E2;border-bottom:1px solid #eaeaea;padding-bottom:8px;margin-top:0; font-weight:600;}
        .details div{display:flex;justify-content:space-between;padding:6px 0;font-size:14px; border-bottom: 1px dotted #f0f0f0;}
        .details div:last-child{border-bottom:none;}
        .details div span:first-child{font-weight:500;color:#444;}
        .details div span:last-child{color:#222; text-align:right;}
        .total{font-size:17px !important;font-weight:bold !important;color:${payment.isExpense ? '#D9534F' : '#28A745'} !important;}
        .footer{text-align:center;font-size:12px;color:#777;margin-top:35px;padding-top:15px;border-top:1px solid #eaeaea;}
        .print-controls{text-align:center;margin-top:25px;}
        @media print{
            .print-controls{display:none !important;}  
            body{border:none;margin:0.5in; box-shadow:none; font-size:10pt;}  
            .header h1{font-size:22pt;} .section h2{font-size:14pt;} .details div{font-size:10pt;} .total{font-size:12pt !important;}
        }
      </style></head><body>
      <div class="header"><h1>TASSIAC CHURCH</h1><p>Official Payment Receipt</p></div>
      <div class="section"><h2>Receipt Details</h2><div class="details">
        <div><span>Receipt No:</span><span>${this.escapeHtml(payment.receiptNumber) || 'N/A'}</span></div>
        <div><span>Payment ID:</span><span>${payment.id}</span></div>
        <div><span>Date & Time:</span><span>${new Date(payment.paymentDate).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>
        <div><span>Status:</span><span>${this.escapeHtml(payment.status)}</span></div>
      </div></div>
      ${payment.User ? `<div class="section"><h2>Payer Information</h2><div class="details">
        <div><span>Name:</span><span>${this.escapeHtml(user.fullName)}</span></div>
        <div><span>Phone:</span><span>${this.escapeHtml(user.phone)}</span></div>
        ${user.email ? `<div><span>Email:</span><span>${this.escapeHtml(user.email)}</span></div>` : ''}
      </div></div>` : ''}
      <div class="section"><h2>Payment Information</h2><div class="details">
        <div><span>Type:</span><span>${this.escapeHtml(paymentTypeName)}</span></div>
        <div><span>Method:</span><span>${this.escapeHtml(payment.paymentMethod)}</span></div>
        ${payment.description ? `<div><span>Description:</span><span style="white-space:pre-wrap; text-align:left;">${this.escapeHtml(payment.description)}</span></div>` : ''}
        ${payment.platformFee && parseFloat(payment.platformFee) > 0 ? `<div><span>Platform Fee:</span><span>KES ${parseFloat(payment.platformFee).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>` : ''}
        <div><span>Amount:</span><span class="total">${payment.isExpense ? '-' : ''}KES ${amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
      </div></div>
      <div class="footer"><p>Thank you for your transaction. This is an official receipt.</p></div>
      </body></html>`;
      
    printWindow.document.write(htmlContent);
    
    const controlsDiv = printWindow.document.createElement('div');
    controlsDiv.className = 'print-controls';
    const printButton = printWindow.document.createElement('button');
    printButton.textContent = 'Print Receipt';
    printButton.style.cssText = 'padding:10px 18px;margin:5px;cursor:pointer;background-color:#4A90E2;color:white;border:none;border-radius:5px;font-size:15px;transition:background-color 0.2s;';
    const closeButton = printWindow.document.createElement('button');
    closeButton.textContent = 'Close Window';
    closeButton.style.cssText = 'padding:10px 18px;margin:5px;cursor:pointer;background-color:#ccc;color:black;border:none;border-radius:5px;font-size:15px;transition:background-color 0.2s;';
    controlsDiv.append(printButton, closeButton);
    printWindow.document.body.appendChild(controlsDiv);

    printWindow.document.close();

    printWindow.onload = () => { 
        const pButton = printWindow.document.querySelector('.print-controls button:first-child');
        const cButton = printWindow.document.querySelector('.print-controls button:last-child');
        if(pButton) pButton.addEventListener('click', () => printWindow.print());
        if(cButton) cButton.addEventListener('click', () => printWindow.close());
        printWindow.focus();
        this.showMessage('Receipt ready. Use browser print to save as PDF.', 'success');
    };
  }
  
  async sendSms(phoneNumber, name, payment) {  
    const paymentId = payment.id;  
    const currentState = this.smsState.get(paymentId) || { sent: false, sending: false };
    if (currentState.sending || currentState.sent) {
      this.showSmsStatus('SMS already processed for this payment.', 'info'); return;
    }
    this.smsState.set(paymentId, { sent: false, sending: true });
    this.updateSmsButtonState(paymentId, 'sending');
    this.showSmsStatus(`Sending SMS to ${name}...`, 'info');
    try {
      const paymentType = this.getPaymentTypeDisplayName(payment);
      const amountVal = payment.amount !== null && payment.amount !== undefined ? parseFloat(payment.amount) : 0;
      const amount = amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 });
      const date = new Date(payment.paymentDate).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
      const message = `Dear ${name}, your ${paymentType} of KES ${amount} on ${date} (Ref: ${payment.receiptNumber||payment.id}) is confirmed. TASSIAC Church.`;
      const response = await this.queueApiRequest(() => this.apiService.post('/notifications/send-sms', { phone: phoneNumber, message }));
      if (response && response.success) {
        this.smsState.set(paymentId, { sent: true, sending: false });
        this.showSmsStatus(`SMS sent to ${name}.`, 'success');
      } else { throw new Error(response?.message || 'API error during SMS send.'); }
    } catch (error) {
      this.smsState.set(paymentId, { sent: false, sending: false });  
      this.showSmsStatus(`SMS failed for ${name}: ${error.message}`, 'error');
    } finally {
      const finalState = this.smsState.get(paymentId);
      this.updateSmsButtonState(paymentId, finalState?.sent ? 'sent' : (finalState?.sending ? 'sending' : 'default'));  
    }
  }

  updateSmsButtonState(paymentId, state) {  
    const tableButton = document.querySelector(`.payment-table-wrapper .send-sms-btn[data-id="${paymentId}"]`);
    if (tableButton) this.styleSmsButton(tableButton, state, false);
    if (this.selectedPayment && this.selectedPayment.id === paymentId) {
        const modalButton = document.getElementById('modal-sms-btn');
        if (modalButton) this.styleSmsButton(modalButton, state, true);
    }
  }
  styleSmsButton(button, state, isModal = false) {  
    button.disabled = false; button.style.opacity = '1'; button.style.cursor = 'pointer'; button.innerHTML = '';
    let iconSvg = (state !== 'sending' && state !== 'sent') ? this.createSvgIcon('sms') : null;
    switch (state) {
        case 'sending':  
            button.disabled = true; button.style.opacity = '0.5';  
            if (iconSvg && isModal) button.appendChild(iconSvg);  
            button.appendChild(document.createTextNode(isModal ? ' Sending...' : 'Sending...'));  
            break;
        case 'sent':  
            button.style.background = 'rgba(16, 185, 129, 0.2)'; button.style.color = '#10b981';  
            button.appendChild(document.createTextNode('✓ Sent'));  
            break;
        case 'default':  
        default:  
            const defaultRgb = this.hexToRgb(isModal ? '#8b5cf6' : '#8b5cf6');  
            if (defaultRgb) {
                button.style.setProperty('--btn-color-r', defaultRgb.r.toString());
                button.style.setProperty('--btn-color-g', defaultRgb.g.toString());
                button.style.setProperty('--btn-color-b', defaultRgb.b.toString());
                button.style.background = `linear-gradient(135deg, rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.2), rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.1))`;
                button.style.border = `1px solid rgba(${defaultRgb.r}, ${defaultRgb.g}, ${defaultRgb.b}, 0.3)`;
                button.style.color = '#e0e7ff';  
            }
            if (iconSvg) button.appendChild(iconSvg);
            button.appendChild(document.createTextNode(isModal ? 'Send SMS' : 'SMS'));  
            break;
    }
  }

  showBatchSmsModal() {  
    const modal = document.getElementById('batch-sms-modal');
    if (modal) {
        const recipientsContainer = modal.querySelector('#batch-sms-recipients');
        const countEl = modal.querySelector('#batch-sms-recipient-count');
        if (!recipientsContainer || !countEl) return;

        recipientsContainer.innerHTML = '';  
        const eligiblePayments = this.applyClientSideFilters(this.filters).filter(p => p.User && p.User.phone);  // Changed from p.user to p.User
        
        countEl.textContent = `Recipients (${eligiblePayments.length} from current view):`;
        if (eligiblePayments.length > 0) {
            eligiblePayments.forEach(p => {
                const div = this.createElement('div', {className: 'batch-recipient-item'});
                const checkbox = this.createElement('input', { type: 'checkbox', id: `batch-${p.id}`, 'data-payment-id': p.id, checked: true });
                const label = this.createElement('label', { htmlFor: `batch-${p.id}`}, `${this.escapeHtml(p.User.fullName)} (${p.User.phone})`); // Changed from p.user to p.User
                div.append(checkbox, label);
                recipientsContainer.appendChild(div);
            });
        } else {
            recipientsContainer.innerHTML = `<p class="no-recipients-text">No eligible recipients in current filtered view.</p>`;
        }
        modal.style.display = 'flex';
    }
  }

  async sendBatchSms() {  
    if (this.batchSmsState.sending) return;
    const modal = document.getElementById('batch-sms-modal');  
    const messageTemplate = document.getElementById('batch-sms-message').value.trim();
    const checkboxes = modal ? modal.querySelectorAll('#batch-sms-recipients input[type="checkbox"]:checked') : [];

    if (!messageTemplate) { this.showMessage('Enter message template.', 'error'); return; }
    if (checkboxes.length === 0) { this.showMessage('Select recipients.', 'error'); return; }

    this.batchSmsState = { sending: true, queue: [], results: [], progress: 0, total: checkboxes.length };
    checkboxes.forEach(cb => {
        const paymentId = parseInt(cb.dataset.paymentId);
        const payment = this.allPaymentsMasterList.find(p => p.id === paymentId);  
        if (payment) this.batchSmsState.queue.push(payment);
    });
    
    if (modal) modal.style.display = 'none';
    this.showMessage(`Batch SMS: 0/${this.batchSmsState.total} sent...`, 'info', 60000);  

    let successCount = 0, errorCount = 0;
    for (let i = 0; i < this.batchSmsState.queue.length; i++) {
        const payment = this.batchSmsState.queue[i];
        this.batchSmsState.progress = i + 1;
        if (!payment || !payment.User || !payment.User.phone) { errorCount++; continue; } // Changed from payment.user to payment.User
        try {
            const paymentType = this.getPaymentTypeDisplayName(payment);
            const amountVal = payment.amount !== null && payment.amount !== undefined ? parseFloat(payment.amount) : 0;
            const amount = amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 });
            const date = new Date(payment.paymentDate).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
            const personalizedMessage = messageTemplate
                .replace(/{name}/g, payment.User.fullName) // Changed from payment.user to payment.User
                .replace(/{amount}/g, amount)
                .replace(/{type}/g, paymentType)
                .replace(/{receiptNumber}/g, payment.receiptNumber || payment.id.toString())
                .replace(/{date}/g, date);

            const response = await this.queueApiRequest(() => this.apiService.post('/notifications/send-sms', { phone: payment.User.phone, message: personalizedMessage })); // Changed from payment.user to payment.User
            if (response && response.success) {
                successCount++;
                this.smsState.set(payment.id, { sent: true, sending: false });
                this.updateSmsButtonState(payment.id, 'sent');  
            } else { errorCount++; console.warn(`SMS API error for ${payment.User.phone}: ${response?.message}`);} // Changed from payment.user to payment.User
        } catch (err) { errorCount++; console.error(`Exception during SMS to ${payment.User.phone}:`, err); } // Changed from payment.user to payment.User
        
        if ((i + 1) % 5 === 0 || i + 1 === this.batchSmsState.total) {  
             this.showMessage(`Batch SMS: ${successCount} sent, ${errorCount} failed (${this.batchSmsState.progress}/${this.batchSmsState.total})...`, 'info', 60000);
        }
        await new Promise(resolve => setTimeout(resolve, this.requestThrottleTime + 150));  
    }
    this.batchSmsState.sending = false;
    this.showMessage(`Batch SMS complete: ${successCount} sent, ${errorCount} failed.`, successCount > 0 && errorCount === 0 ? 'success' : (errorCount > 0 ? 'error' : 'info'));
  }

  showSmsStatus(message, type) {  
    const modal = document.getElementById('sms-status-modal');
    if (!modal) return;
    const configs = {  
        success: { icon: '✓', color: '#10b981', bg: 'rgba(16,185,129,0.2)' },  
        error: { icon: '⚠', color: '#ef4444', bg: 'rgba(239,68,68,0.2)' },  
        info: { icon: 'ℹ', color: '#3b82f6', bg: 'rgba(59,130,246,0.2)' }
    };  
    const config = configs[type] || configs.info;
    Object.assign(modal.style, { backgroundColor: config.bg, borderLeft: `4px solid ${config.color}`, display: 'block' });
    modal.innerHTML = `<div class="sms-status-content"><span class="sms-status-icon" style="color:${config.color};">${config.icon}</span><div class="sms-status-message">${this.escapeHtml(message)}</div><button class="sms-status-close" onclick="this.parentElement.parentElement.style.display='none'">×</button></div>`;
    setTimeout(() => { if(modal.style.display === 'block') modal.style.display = 'none'; }, type === 'error' ? 8000 : 5000);
  }
  showMessage(message, type, duration) {  
    this.error = null; this.success = null;
    const defaultDurations = { success: 4000, error: 7000, info: 5000 };
    const effectiveDuration = duration || defaultDurations[type] || 5000;

    if (type === 'success') this.success = message;
    else if (type === 'error') this.error = message;
    else this.success = message;  

    if(this.isRendered && !this.isRendering) this.updateView(); 
    setTimeout(() => {
      if ((type === 'success' || type === 'info') && this.success === message) this.success = null;
      if (type === 'error' && this.error === message) this.error = null;
      this.updateViewIfNoPersistentMessage();
    }, effectiveDuration);
  }
  updateViewIfNoPersistentMessage() {  
    if (!this.error && !this.success && this.isRendered && !this.isRendering) this.updateView();
  }
  
  formatPaymentType(type, isExpense = false) {  
    return this.getPaymentTypeDisplayName({paymentType: type, isExpense});
  }
  getFriendlySpecialOfferingName(paymentType) {  
    if (paymentType && paymentType.startsWith('SPECIAL_')) {
      const uniquePart = paymentType.replace('SPECIAL_', '').replace(/_/g, ' ');
      return `Special: ${this.escapeHtml(uniquePart.charAt(0).toUpperCase() + uniquePart.slice(1).toLowerCase())}`;
    }
    return 'Special Offering';
  }
  formatDepartment(department) {  
    const departments = {  
        'MUSIC': 'Music Ministry', 'CHILDREN': "Children's Ministry", 'COMMUNICATION': 'Communication',
        'EDUCATION': 'Education', 'FAMILY': 'Family Ministries', 'HEALTH': 'Health Ministries',
        'MINISTERIAL': 'Ministerial Association', 'PLANNED_GIVING': 'Planned Giving & Trust Services',
        'TREASURY': 'Treasury', 'PUBLIC_AFFAIRS': 'Public Affairs & Religious Liberty',
        'PUBLISHING': 'Publishing', 'SABBATH_SCHOOL': 'Sabbath School & Personal Ministries',
        'WOMEN': "Women's Ministries", 'YOUTH': 'Youth Ministries', 'OTHER': 'Other',
        'MAINTENANCE': 'Maintenance', 'DEVELOPMENT': 'Development'
    };  
    return departments[department] || this.escapeHtml(department.replace(/_/g, ' '));
  }
  getDepartmentColor(department) {  
    const colors = {  
        'MUSIC': '#3b82f6', 'MAINTENANCE': '#ef4444', 'EDUCATION': '#8b5cf6',
        'CHILDREN': '#10b981', 'YOUTH': '#f59e0b', 'HEALTH': '#06b6d4',
        'COMMUNICATION': '#ec4899', 'FAMILY': '#f97316', 'TREASURY': '#14b8a6',
        'DEVELOPMENT': '#0ea5e9', 'OTHER': '#64748b'
    };  
    return colors[department] || '#64748b';
  }
  hexToRgb(hex) {  
    if (!hex) return {r: 100, g: 100, b: 100}; 
    let sanitizedHex = hex.replace('#', '');
    if (sanitizedHex.length === 3) sanitizedHex = sanitizedHex.split('').map(c => c + c).join('');
    if (sanitizedHex.length !== 6) return {r: 100, g: 100, b: 100}; 

    return {  
        r: parseInt(sanitizedHex.substring(0, 2), 16),  
        g: parseInt(sanitizedHex.substring(2, 4), 16),  
        b: parseInt(sanitizedHex.substring(4, 6), 16)  
    };
  }
  formatDate(date) {  
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });  
  }
  
  resetFilters() {  
    this.filters.search = ''; 
    this.currentPage = 1;
    const form = document.getElementById('payment-filters-form');
    if (form) {
      const searchInput = form.querySelector('input[name="search"]');
      if (searchInput) searchInput.value = '';
    }
    this.applyFiltersAndPagination(this.filters);  
    if(!this.isRendering) this.updateView();
  }
  
  applyFiltersWithDebounce() {  
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage = 1;
      this.applyFiltersAndPagination(this.filters);  
      if(!this.isRendering) this.updateView();  
    }, this.SEARCH_DEBOUNCE_DELAY);
  }
  
  attachEventListeners() {  
    const filtersForm = document.getElementById('payment-filters-form');
    if (filtersForm) {
      const searchInput = filtersForm.elements.search;
      if (searchInput) {
          searchInput.addEventListener('input', () => {
              this.updateFiltersFromForm(); 
              this.applyFiltersWithDebounce(); 
          });
      }
    }
    
    const appContainer = document.getElementById('app') || document.body;  
    appContainer.addEventListener('click', (e) => {
        const target = e.target;
        const pageButton = target.closest('.pagination-item[data-page]');
        if (pageButton) {
            const page = parseInt(pageButton.dataset.page);
            if (page && page !== this.currentPage && page > 0 && page <= this.totalPages) {
                this.currentPage = page;
                if(!this.isRendering) this.updateView();  
            }
            return;
        }
        const viewBtn = target.closest('.view-payment-btn[data-id]');
        if (viewBtn) { this.viewPaymentDetails(viewBtn.dataset.id); return; }
        
        const smsBtnTable = target.closest('.action-button.send-sms-btn[data-id]');
        if (smsBtnTable && !target.closest('#payment-detail-modal')) {  
            const paymentId = parseInt(smsBtnTable.dataset.id);
            const payment = this.allPaymentsMasterList.find(p => p.id === paymentId);
            if (payment && payment.User?.phone) { // Changed from payment.user to payment.User
                const state = this.smsState.get(paymentId) || {};
                if (!state.sending && !state.sent) this.sendSms(payment.User.phone, payment.User.fullName, payment); // Changed from payment.user to payment.User
            }
            return;
        }
        if (target.matches('.close-modal') || target.closest('.close-modal')) {
            const modal = target.closest('.modal-backdrop');
            if (modal && modal.id !== 'batch-sms-modal' && modal.id !== 'export-filter-modal') { 
                 modal.style.display = 'none';
            } else if (modal && (modal.id === 'export-filter-modal')) { 
                 modal.style.display = 'none';
            }
            return;
        }
        if (target.matches('.close-batch-modal') || target.closest('.close-batch-modal')) {
            const batchSmsModalEl = document.getElementById('batch-sms-modal'); 
            if (batchSmsModalEl) batchSmsModalEl.style.display = 'none';
            return;
        }
        
        if(target.id === 'proceed-with-export-btn') {
            this.handleProceedWithExport();
            return;
        }
    });
    
    const paymentDetailModal = document.getElementById('payment-detail-modal');
    if (paymentDetailModal) paymentDetailModal.addEventListener('click', (e) => { if (e.target === paymentDetailModal) paymentDetailModal.style.display = 'none'; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && paymentDetailModal?.style.display === 'flex') paymentDetailModal.style.display = 'none'; });
    
    const batchSmsModalEl = document.getElementById('batch-sms-modal');  
    if (batchSmsModalEl) {
      batchSmsModalEl.addEventListener('click', (e) => { if (e.target === batchSmsModalEl) batchSmsModalEl.style.display = 'none'; });
      const sendButton = batchSmsModalEl.querySelector('#send-batch-sms');
      if (sendButton) sendButton.onclick = () => this.sendBatchSms();
    }

    const exportFilterModalEl = document.getElementById('export-filter-modal');
    if (exportFilterModalEl) {
        exportFilterModalEl.addEventListener('click', (e) => { if (e.target === exportFilterModalEl) exportFilterModalEl.style.display = 'none'; });
        const exportPaymentTypeSelect = exportFilterModalEl.querySelector('#export-payment-type');
        if(exportPaymentTypeSelect) {
            exportPaymentTypeSelect.addEventListener('change', (e) => {
                const group = exportFilterModalEl.querySelector('#export-special-offering-group');
                if(group) group.style.display = e.target.value === 'SPECIAL' ? 'grid' : 'none';
                if (e.target.value !== 'SPECIAL') { 
                    const soSelect = exportFilterModalEl.querySelector('#export-special-offering');
                    if (soSelect) soSelect.value = '';
                }
            });
        }
    }
  }
  
  updateFiltersFromForm() {  
    const form = document.getElementById('payment-filters-form');
    if (!form) return;
    const searchInput = form.querySelector('input[name="search"]');
    if (searchInput) {
        this.filters.search = searchInput.value || '';
    }
  }
  
  updateView() {  
    // console.log('AdminPaymentsView: updateView() called. isRendering:', this.isRendering, 'isLoading:', this.isLoading, '_fetchInProgress:', this._fetchInProgress);
    if (this.isRendering && document.readyState !== 'complete') {
        // console.log('AdminPaymentsView: Bailing from updateView due to isRendering and document.readyState');
        return;
    }
    this.isRendering = true;  
    const appContainer = document.getElementById('app');
    if (appContainer) {
      const scrollTop = appContainer.scrollTop;  
      
      this.render().then(content => {  
        if (content) {
          appContainer.innerHTML = '';  
          appContainer.appendChild(content);
        }
        appContainer.scrollTop = scrollTop;  
        this.isRendering = false;  
        // console.log('AdminPaymentsView: updateView() -> render() completed.');
      }).catch(error => {
        console.error('Critical error in updateView -> render (AdminPaymentsView):', error);
        appContainer.innerHTML = `<div class="critical-error-display">A major error occurred. Please refresh. Details: ${this.escapeHtml(error.message)}</div>`;
        this.isRendering = false;  
      });
    } else {
        console.warn("AdminPaymentsView: updateView() called but #app container not found.");
        this.isRendering = false;  
    }
  }
  
  renderTopNavigation() {  
    const nav = this.createElement('nav', { className: 'admin-top-nav' });
    const links = [
      { path: '/admin/dashboard', text: 'Dashboard', icon: '📊' },
      { path: '/admin/payments', text: 'Payments', icon: '💰', active: true },
      { path: '/admin/users', text: 'Users', icon: '👥' },
      { path: '/admin/expenses', text: 'Expenses', icon: '📉' },
      { path: '/admin/add-payment', text: 'Add Payment', icon: '➕' }
    ];
    const navContent = this.createElement('div', { className: 'admin-nav-content' });
    links.forEach(link => {
      const a = this.createElement('a', { href: link.path, className: `nav-link ${link.active ? 'active' : ''}` });
      a.innerHTML = `${link.icon} ${link.text}`;
      a.addEventListener('mouseenter', () => { if (!link.active) { a.classList.add('hover'); }});
      a.addEventListener('mouseleave', () => { if (!link.active) { a.classList.remove('hover'); }});
      navContent.appendChild(a);
    });
    nav.appendChild(navContent);
    return nav;
  }
  renderPaymentDetailModal() {  
    const modalBackdrop = this.createElement('div', { id: 'payment-detail-modal', className: 'modal-backdrop' });
    const modalContent = this.createElement('div', { className: 'modal-content neo-card' });  
    modalContent.appendChild(this.createElement('div', { className: 'card-glow' }));

    const modalHeader = this.createElement('div', { className: 'modal-header' });
    const modalTitle = this.createElement('h3', { id: 'modal-title' }, 'Payment Details');
    const closeButton = this.createElement('button', { className: 'close-modal' }, '×');
    modalHeader.append(modalTitle, closeButton);

    const modalBody = this.createElement('div', { id: 'modal-body', className: 'modal-body' });
    modalBody.innerHTML = `<div class="modal-loading"><div class="loading-spinner"></div>Loading...</div>`;

    const modalFooter = this.createElement('div', { className: 'modal-footer' });
    const closeModalButtonFooter = this.createFuturisticButton('Close', '#64748b', () => { modalBackdrop.style.display = 'none'; });
    
    const downloadButton = this.createFuturisticButton('', '#3b82f6', null);  
    downloadButton.id = 'modal-download-btn';
    const downloadIcon = this.createSvgIcon('download');
    if (downloadIcon) downloadButton.prepend(downloadIcon);
    downloadButton.appendChild(document.createTextNode('Receipt PDF'));

    const sendSmsButton = this.createFuturisticButton('', '#8b5cf6', null);  
    sendSmsButton.id = 'modal-sms-btn';

    modalFooter.append(closeModalButtonFooter, sendSmsButton, downloadButton);
    modalContent.append(modalHeader, modalBody, modalFooter);
    modalBackdrop.appendChild(modalContent);
    return modalBackdrop;
  }
  renderSmsStatusModal() {  
    return this.createElement('div', { id: 'sms-status-modal', className: 'neo-card sms-status-toast' });
  }
  renderBatchSmsModal() {  
    const modalBackdrop = this.createElement('div', { id: 'batch-sms-modal', className: 'modal-backdrop' });
    const modalContent = this.createElement('div', { className: 'modal-content neo-card batch-sms-modal-content' });
    
    modalContent.innerHTML = `
      <div class="modal-header">
        <h3 id="batch-sms-modal-title">📱 Batch SMS</h3>
        <button class="close-batch-modal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="batch-sms-message" class="form-label">Message Template</label>
          <textarea id="batch-sms-message" rows="4" class="form-control" placeholder="Use {name}, {amount}, {type}, {receiptNumber}, {date}.">Dear {name}, your {type} payment of KES {amount} on {date} (Receipt: {receiptNumber}) has been recorded. Thank you for your contribution to TASSIAC Church.</textarea>
        </div>
        <div class="form-group">
          <div id="batch-sms-recipient-count" class="form-label">Recipients (0 from current view):</div>
          <div id="batch-sms-recipients">
              <p class="no-recipients-text">Loading recipients...</p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="close-batch-modal futuristic-button" style="--btn-color-r:100; --btn-color-g:116; --btn-color-b:139;">Cancel</button>
        <button id="send-batch-sms" class="futuristic-button" style="--btn-color-r:139; --btn-color-g:92; --btn-color-b:246;">Send Batch SMS</button>
      </div>`;
    modalBackdrop.appendChild(modalContent);
    return modalBackdrop;
  }

  renderExportFilterModal() {
    const modalBackdrop = this.createElement('div', { id: 'export-filter-modal', className: 'modal-backdrop' });
    const modalContent = this.createElement('div', { className: 'modal-content neo-card export-filter-modal-content' });

    modalContent.innerHTML = `
        <div class="modal-header">
            <h3 id="export-filter-modal-title">Export Options</h3>
            <button class="close-modal">×</button> 
        </div>
        <div class="modal-body">
            <p id="export-search-info" style="font-size:14px; color:#cbd5e1; margin-bottom:20px;">Select filters for your export. The current main search term ("<strong style="color:#e0e7ff;">${this.escapeHtml(this.filters.search) || 'None'}</strong>") will also be applied.</p>
            <div class="export-filters-form-grid">
                ${this.createFormGroup('Start Date (Export)', 'export-start-date', 'date').outerHTML}
                ${this.createFormGroup('End Date (Export)', 'export-end-date', 'date').outerHTML}
                ${this.createFormGroup('Payment Type (Export)', 'export-payment-type', 'select').outerHTML}
                <div id="export-special-offering-group" style="display:none;">
                    ${this.createFormGroup('Special Offering (Export)', 'export-special-offering', 'select').outerHTML}
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="close-modal futuristic-button" style="--btn-color-r:100; --btn-color-g:116; --btn-color-b:139;">Cancel</button>
            <button id="proceed-with-export-btn" class="futuristic-button" style="--btn-color-r:79; --btn-color-g:70; --btn-color-b:229;">Proceed with Export</button>
        </div>
    `;
    const paymentTypeSelect = modalContent.querySelector('#export-payment-type');
    if(paymentTypeSelect) {
        const paymentTypes = [  
            { value: '', label: 'All Types' }, { value: 'TITHE', label: 'Tithe' },  
            { value: 'OFFERING', label: 'Offering' }, { value: 'DONATION', label: 'Donation' },
            { value: 'EXPENSE', label: 'Expense' }, { value: 'SPECIAL', label: 'Special Offerings' } // 'SPECIAL' acts as a category
        ];
        paymentTypes.forEach(type => paymentTypeSelect.add(new Option(type.label, type.value)));
    }
    modalBackdrop.appendChild(modalContent);
    return modalBackdrop;
  }

  renderLoading() {  
    const loadingContainer = this.createElement('div', { className: 'loading-container neo-card' });
    loadingContainer.innerHTML = `<div class="loading-spinner"></div><p>Loading data...</p>`;
    return loadingContainer;
  }
  renderError(error) {  
    const errorContainer = this.createElement('div', { className: 'error-container neo-card' });
    errorContainer.innerHTML = `⚠️<h2>Error Encountered</h2><p>${this.escapeHtml(error.message)}</p><button id="retry-load-btn" class="futuristic-button" style="--btn-color-r:239; --btn-color-g:68; --btn-color-b:68;">Retry Load</button>`;
    
    setTimeout(() => {
        const retryBtn = document.getElementById('retry-load-btn');
        if(retryBtn && !retryBtn.dataset.listenerAttached) { 
            retryBtn.dataset.listenerAttached = 'true';
            retryBtn.onclick = () => { 
                this.error = null; 
                // console.log("AdminPaymentsView: Retry Load button clicked.");
                this.fetchAllPaymentsData(); // Re-fetch all data
                this.fetchSpecialOfferings();
            };
        }
    },0);
    return errorContainer;
  }
  renderUnauthorized() {  
    const unauthContainer = this.createElement('div', { className: 'unauthorized-container neo-card' });
    unauthContainer.innerHTML = `
        <div style="font-size: 50px; margin-bottom: 15px;">🔒</div>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
        <a href="/dashboard" class="futuristic-button" style="--btn-color-r:79; --btn-color-g:70; --btn-color-b:229;">🏠 Go to Dashboard</a>
    `;
    return unauthContainer;
  }
  
  addGlobalStyles() {  
    if (document.getElementById('dashboard-global-styles')) return;
    const styleElement = document.createElement('style');
    styleElement.id = 'dashboard-global-styles';
    styleElement.textContent = `
      body { margin: 0; background-color: #0f172a; color: #eef2ff; font-family: 'Inter', sans-serif; overflow-x:hidden; }
      * { box-sizing: border-box; }
      .dashboard-container { max-width: 1400px; margin: 0 auto; padding: 20px; position: relative; z-index: 1; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); }
      ::-webkit-scrollbar-thumb { background: rgba(79, 107, 255, 0.6); border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(79, 107, 255, 0.8); }
      .neo-card { position: relative; backdrop-filter: blur(12px) saturate(150%); background: rgba(30, 41, 59, 0.7); border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.2); box-shadow: 0 6px 20px -10px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.08) inset; overflow: hidden; transition: box-shadow 0.3s ease; }
      .neo-card:hover { box-shadow: 0 10px 30px -12px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.12) inset; }
      .card-glow { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(var(--glow-r, 99), var(--glow-g, 102), var(--glow-b, 241), 0.15) 0%, transparent 70%); animation: rotateGlow 10s linear infinite; z-index: 0; pointer-events:none; opacity:0; transition: opacity 0.5s; }
      .neo-card:hover .card-glow { opacity:1; }
      @keyframes rotateGlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .page-header-card { margin-bottom: 30px; padding: 25px; --glow-r:99; --glow-g:102; --glow-b:241; }
      .header-particle { position: absolute; border-radius: 50%; background: rgba(129, 140, 248, 0.3); animation: float 3s ease-in-out infinite; z-index:1;}
      .page-header-content { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; position: relative; z-index: 2; }
      .page-header-title { font-size: 28px; font-weight: 700; margin: 0; background: linear-gradient(to right, #ffffff, #e0e7ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .export-buttons-group { display: flex; gap: 12px; flex-wrap: wrap; }
      .futuristic-button { position: relative; color: #e0e7ff; border: 1px solid rgba(var(--btn-color-r,79), var(--btn-color-g,70), var(--btn-color-b,229), 0.3); background: linear-gradient(135deg, rgba(var(--btn-color-r,79), var(--btn-color-g,70), var(--btn-color-b,229), 0.2), rgba(var(--btn-color-r,79), var(--btn-color-g,70), var(--btn-color-b,229), 0.1)); border-radius: 6px; padding: 8px 14px; font-weight: 500; font-size: 13px; cursor: pointer; transition: all 0.25s ease; backdrop-filter: blur(8px); box-shadow: 0 2px 6px rgba(0,0,0,0.15); overflow: hidden; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; }
      .futuristic-button .svg-icon-wrapper { margin-right: 4px; display: inline-flex; align-items: center;}
      .futuristic-button::before { content: ""; position: absolute; top: 0; left: -120%; width: 100%; height: 100%; background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%); transform: skewX(-25deg); transition: left 0.7s cubic-bezier(0.23, 1, 0.32, 1); }
      .futuristic-button:hover { transform: translateY(-2px); box-shadow: 0 5px 12px rgba(var(--btn-color-r,79), var(--btn-color-g,70), var(--btn-color-b,229),0.2), 0 0 0 1px rgba(var(--btn-color-r,79), var(--btn-color-g,70), var(--btn-color-b,229),0.1) inset; color: #fff; }
      .futuristic-button:hover::before { left: 120%; }
      .futuristic-button:active { transform: translateY(0); }
      .futuristic-button:disabled { opacity: 0.6; cursor: not-allowed; transform: translateY(0); box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
      .futuristic-button:disabled::before { display:none; }
      .alert-card { padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; animation: fadeIn 0.3s ease-out; }
      .alert-icon { font-weight: bold; font-size: 1.2em; } .alert-message { font-size: 14px; color: #f1f5f9; }
      .alert-success { background-color: rgba(16,185,129,0.1); border-left: 4px solid #10b981; }
      .alert-error { background-color: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; }
      .filters-card { margin-bottom: 20px; animation-delay: '0.1s'; --glow-r:99; --glow-g:102; --glow-b:241;}
      .filters-header { padding: 14px 20px; border-bottom: 1px solid rgba(148,163,184,0.1); }
      .filters-title { font-size: 16px; font-weight: 600; margin: 0; color: #f1f5f9; display: flex; align-items: center; gap: 6px; }
      .filters-content { padding: 20px; }
      .filters-form { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: end; }
      .form-group { display: grid; gap: 6px; }  
      .form-label { font-size: 13px; font-weight: 500; color: #94a3b8; }
      .form-control { width: 100%; padding: 9px 12px; background: rgba(15,23,42,0.75); border: 1px solid rgba(148,163,184,0.3); border-radius: 6px; color: #f1f5f9; font-size: 14px; transition: all 0.2s ease; }
      .form-control:focus { border-color: #4f46e5; outline: none; box-shadow: 0 0 0 3px rgba(79,70,229,0.3); background: rgba(15,23,42,0.9); }
      select.form-control { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 35px; }
      .filters-form-actions { display: flex; gap: 12px; justify-content: flex-end; } 
      .payments-table-card { animation-delay: '0.2s'; --glow-r:59; --glow-g:130; --glow-b:246;}
      .payments-table-header { padding: 14px 20px; border-bottom: 1px solid rgba(148,163,184,0.1); display: flex; justify-content: space-between; align-items: center; }
      .payments-table-title { font-size: 16px; font-weight: 600; margin: 0; color: #f1f5f9; display: flex; align-items: center; gap: 6px; }
      .payment-count { font-size: 13px; color: #94a3b8; }
      .payment-table-wrapper { overflow-x: auto; padding: 0 8px; }
      .payments-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .payments-table thead { background: rgba(30,41,59,0.6); }
      .payments-table th { padding: 12px 14px; font-size: 12px; font-weight: 600; color: #94a3b8; border-bottom: 1px solid rgba(148,163,184,0.2); white-space: nowrap; text-align:left; }
      .payments-table td { padding: 12px 14px; font-size: 13px; color: #f1f5f9; border-bottom: 1px solid rgba(148,163,184,0.1); }
      .payments-table td:nth-child(2), .payments-table td:nth-child(5) { color: #94a3b8; }  
      .payments-table tr:hover td { background-color: rgba(30, 41, 59, 0.5); }
      .user-cell .user-name { font-weight:500; color:#f1f5f9; font-size:13px; } .user-cell .user-phone { font-size:12px; color:#94a3b8; }
      .amount-cell { font-family: 'SF Mono', 'Consolas', monospace; font-weight:600; font-size:13px; }
      .status-badge { display: inline-block; padding: 3px 9px; border-radius: 12px; font-size: 11px; font-weight: 500; }
      .payment-type-badge { display: inline-block; padding: 3px 9px; border-radius: 12px; font-size: 11px; font-weight: 500; }
      .action-buttons-container { display: flex; gap: 6px; flex-wrap: wrap; }
      .action-button { display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border:none; border-radius: 5px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; }
      .action-button:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.2); }
      .action-button .svg-icon-wrapper { margin-right:3px; display: inline-flex; align-items: center;}
      .view-payment-btn { background: rgba(59,130,246,0.2); color: #3b82f6; }
      .empty-state-container { padding: 50px 20px; text-align: center; }
      .empty-state-icon { margin: 0 auto 16px; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 40px; color: #64748b; }
      .empty-state-title { font-size: 20px; font-weight: 600; margin: 0 0 8px 0; color: #f1f5f9; }
      .empty-state-text { font-size: 14px; color: #94a3b8; margin: 0 0 20px 0; }
      .add-payment-empty { margin-top:10px; }
      .pagination-container { display: flex; justify-content: center; padding: 16px; border-top: 1px solid rgba(148,163,184,0.1); gap: 5px; flex-wrap: wrap; }
      .pagination-item { cursor: pointer; padding: 7px 12px; margin: 0 2px; border-radius: 6px; transition: all 0.2s; font-size: 13px; color: #94a3b8; background: rgba(30,41,59,0.5); border: 1px solid transparent; font-family: inherit; }
      .pagination-item:hover:not(.disabled) { background: rgba(79,70,229,0.25); color: #f1f5f9; border-color: rgba(79,70,229,0.4); }
      .pagination-item.active { background: #4f46e5; color: white; font-weight: 600; border-color: #4f46e5; }
      .pagination-ellipsis { padding: 7px 5px; color: #94a3b8; }
      .modal-backdrop { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(15,23,42,0.8); z-index: 1000; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); animation: fadeInModal 0.3s ease-out; }
      @keyframes fadeInModal { from { opacity:0; } to { opacity:1; } }
      .modal-content { position: relative; width: 90%; max-width: 700px; max-height: 85vh; overflow: hidden; display:flex; flex-direction:column; background: rgba(30,41,59,0.9); border-radius:10px; border:1px solid rgba(148,163,184,0.25); box-shadow: 0 10px 30px rgba(0,0,0,0.3); animation: slideInModal 0.3s ease-out; }
      @keyframes slideInModal { from { opacity:0; transform: translateY(20px) scale(0.98); } to { opacity:1; transform: translateY(0) scale(1); } }
      .modal-header { padding: 16px 20px; border-bottom: 1px solid rgba(148,163,184,0.15); display: flex; justify-content: space-between; align-items: center; }
      .modal-header h3 { margin:0; font-size:18px; font-weight:600; color:#f1f5f9; }
      .close-modal { background:none; border:none; color:#94a3b8; cursor:pointer; font-size:24px; transition: color 0.2s ease; padding:0; line-height:1; }
      .close-modal:hover { color: #fff; }
      .modal-body { padding: 20px; flex-grow:1; overflow-y:auto; }
      .modal-loading { text-align:center; padding:40px 0; color:#94a3b8; display:flex; flex-direction:column; align-items:center; gap:10px; }
      .modal-error { text-align:center; padding:30px; color:#ef4444; font-size:14px; }
      .payment-details-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:20px; }
      .detail-section { padding:16px; background:rgba(15,23,42,0.5) !important; border-radius: 8px; }  
      .detail-section h4 { margin:0 0 12px 0; font-size:15px; font-weight:600; color:#c7d2fe; border-bottom:1px solid rgba(148,163,184,0.1); padding-bottom:8px;}
      .detail-section div { margin-bottom:8px; font-size:13px; display:flex; justify-content:space-between; }
      .detail-section div span:first-child { font-weight:500; color:#94a3b8; margin-right:10px; }
      .detail-section div span:last-child { color:#f1f5f9; text-align:right; }
      .description-detail { flex-direction:column; align-items:flex-start;}
      .description-detail span:first-child { margin-bottom:4px;}
      .description-detail p { margin: 2px 0 0 0; white-space:pre-wrap; color:#f1f5f9; text-align:left; width:100%;}
      .modal-footer { padding: 16px 20px; border-top: 1px solid rgba(148,163,184,0.15); display: flex; justify-content: flex-end; gap: 12px; background:rgba(30,41,59,0.8); }
      .sms-status-toast { display:none; position:fixed; top:20px; right:20px; z-index:2000; padding:14px; border-radius:8px; box-shadow:0 5px 15px rgba(0,0,0,0.25); max-width:350px; width:calc(100% - 40px); animation: slideInToast 0.3s ease-out; }
      @keyframes slideInToast { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
      .sms-status-content { display:flex; align-items:flex-start; gap:10px; }
      .sms-status-icon { font-weight:bold; font-size:18px; margin-top:1px; }
      .sms-status-message { flex:1; font-size:14px; color:#f1f5f9; line-height:1.4; }
      .sms-status-close { background:none; border:none; color:inherit; opacity:0.7; cursor:pointer; font-size:20px; padding:0; line-height:1; }
      .sms-status-close:hover { opacity:1; }
      #batch-sms-modal .modal-content, .export-filter-modal-content { max-width: 550px; }  
      .batch-sms-modal-content .modal-body, .export-filter-modal-content .modal-body { display:flex; flex-direction:column; gap:16px; }
      #batch-sms-recipients { max-height: 200px; overflow-y: auto; border: 1px solid rgba(148,163,184,0.2); border-radius: 6px; padding: 10px; background:rgba(15,23,42,0.6); }
      .batch-recipient-item { display:flex; align-items:center; padding:5px 0; font-size:13px; }
      .batch-recipient-item input[type="checkbox"] { margin-right:10px; cursor:pointer; transform:scale(1.1); accent-color: #4f46e5; }
      .batch-recipient-item label { color:#f1f5f9; cursor:pointer; flex-grow:1; }
      .no-recipients-text { color:#94a3b8; font-size:13px; text-align:center; padding:10px; }
      .export-filters-form-grid { display:grid; grid-template-columns:1fr; gap:15px; }
      @media (min-width: 500px) { .export-filters-form-grid { grid-template-columns:1fr 1fr; } } 
      .loading-container { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center; }
      .loading-spinner { display: inline-block; width: 40px; height: 40px; border: 3px solid rgba(79,70,229,0.3); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s cubic-bezier(0.68,-0.55,0.27,1.55) infinite; }
      .loading-container p { color:#94a3b8; font-size:16px; font-weight:500; margin-top:15px; }
      .error-container { padding:40px 20px; text-align:center; margin:20px auto; max-width:600px; background-color:rgba(239,68,68,0.05); border-left:4px solid #ef4444; }
      .error-container h2 { font-size:22px; color:#f1f5f9; margin:0 0 10px; } .error-container p { color:#cbd5e1; margin:0 0 20px; }
      .unauthorized-container { max-width:600px; margin:40px auto; padding:40px 30px; text-align:center; }
      .unauthorized-container h2 {font-size:24px; font-weight:700; color:#f1f5f9; margin:0 0 12px;}
      .unauthorized-container p {font-size:14px; color:#94a3b8; margin:0 0 30px;}
      .critical-error-display { color:red; text-align:center; padding:30px; font-size:16px; background:rgba(255,0,0,0.1); border:1px solid red; border-radius:8px; }
      @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
      @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      .animated-item { animation: fadeIn 0.5s ease-out forwards; }
      .admin-top-nav { padding: 12px; border-bottom: 1px solid rgba(148,163,184,0.1); background: rgba(30,41,59,0.5); margin-bottom: 20px; border-radius: 8px; }
      .admin-nav-content { max-width:1200px; margin:0 auto; display:flex; gap:12px; flex-wrap:wrap; }
      .nav-link { display:flex; align-items:center; gap:6px; padding:8px 12px; color:#94a3b8; text-decoration:none; border-radius:6px; background:transparent; transition:all 0.2s; font-size:14px; font-weight:500; }
      .nav-link.active { color:#fff; background:rgba(79,70,229,0.2); }
      .nav-link:hover { background:rgba(40,51,79,0.7); color:#fff; }  
      @media (max-width: 768px) {
        .dashboard-container { padding:15px; } .page-header-title { font-size:24px; }
        .filters-form { grid-template-columns:1fr; gap:15px; } 
        .filters-form-actions { justify-content: center; } 
        .futuristic-button { padding:7px 12px; font-size:12px; }
        .modal-content { max-width:95%; max-height:90vh; }
        .admin-nav-content { gap:8px; } .nav-link { padding:7px 10px; font-size:13px; }
      }
      @media (max-width: 480px) {
        .dashboard-container { padding:10px; } .page-header-title { font-size:20px; }
        .export-buttons-group { flex-direction:column; align-items:stretch; width:100%; }
        .export-buttons-group .futuristic-button { width:100%; justify-content:center; }
        .payments-table th, .payments-table td { padding:10px 8px; font-size:12px; }
        .action-button { padding:4px 7px; font-size:10px; }
      }
      .gradient-background { position:fixed; top:0; left:0; width:100%; height:100%; background:linear-gradient(125deg, #0f172a 0%, #1e293b 40%, #0f172a 100%); background-size:400% 400%; z-index:-2; animation:gradientBG 15s ease infinite; }
      .particle-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7z' fill='%234f6bff' fill-opacity='0.03'/%3E%3C/svg%3E"); background-size:100px 100px; z-index:-1; animation:floatParticles 150s linear infinite; }
      @keyframes gradientBG { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @keyframes floatParticles { from{background-position:0 0;} to{background-position:1000px 1000px;} }
    `;
    document.head.appendChild(styleElement);
  }

  destroy() {
    if (this.handleResize) window.removeEventListener('resize', this.handleResize);
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer); 
    
    this.allPaymentsMasterList = [];
    this.payments = [];
    this.specialOfferings = [];
    this.specialOfferingsCache = null;
    
    this.smsState.clear();
    this.batchSmsState = { sending: false, queue: [], results: [], progress: 0, total: 0 };
    this.pdfState = { generating: false };
    this.isRendered = false;  
    this.isRendering = false;
    // console.log('AdminPaymentsView: destroy() called.');
  }
}
