// src/utils/apiService.js - Production-Ready Church Management API Service
// Version: 2.0.0 - Enhanced with comprehensive error handling, caching, and offline support

/**
 * Production-Ready API Service for Tassia Central SDA Church Management System
 * Features:
 * - Comprehensive endpoint coverage
 * - Advanced error handling and retry logic
 * - Request/response caching
 * - File upload/download with progress tracking
 * - Offline support and connection monitoring
 * - Automatic token refresh
 * - Request deduplication
 * - Rate limiting awareness
 * - Debug logging and performance monitoring
 */

export class ApiService {
  constructor() {
    // Base configuration
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    this.version = '2.0.0';
    
    // Authentication state
    this.token = null;
    this.user = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    
    // Request configuration
    this.defaultTimeout = 30000; // 30 seconds
    this.uploadTimeout = 300000; // 5 minutes
    this.downloadTimeout = 120000; // 2 minutes
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second base delay
    
    // File handling
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    this.supportedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    this.supportedFileTypes = [...this.supportedImageTypes, ...this.supportedDocumentTypes];
    
    // Payment configuration
    this.supportedPaymentMethods = ['KCB', 'MPESA', 'MANUAL', 'CASH', 'BANK_TRANSFER', 'CHEQUE'];
    this.defaultPaymentMethod = 'KCB';
    this.supportedPaymentTypes = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL', 'EXPENSE', 'SPECIAL_OFFERING_CONTRIBUTION'];
    
    // Cache and request management
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.isOnline = navigator.onLine;
    
    // Performance monitoring
    this.requestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestTimes: []
    };
    
    // Event listeners
    this.eventListeners = new Map();
    
    // Initialize service
    this.init();
  }

  /**
   * Initialize the API service
   */
  async init() {
    console.log('🚀 Initializing Church Management API Service v' + this.version);
    
    // Load stored authentication
    this.loadStoredAuth();
    
    // Setup connection monitoring
    this.setupConnectionMonitoring();
    
    // Setup periodic token validation
    this.setupTokenValidation();
    
    // Setup cache cleanup
    this.setupCacheCleanup();
    
    // Process queued requests if online
    if (this.isOnline) {
      this.processRequestQueue();
    }
    
    console.log('✅ API Service initialized successfully');
    console.log('📊 Service Status:', this.getServiceStatus());
  }

  // ===================================
  // AUTHENTICATION METHODS
  // ===================================

  /**
   * User login with enhanced error handling
   */
  async login(credentials) {
    try {
      this.validateCredentials(credentials);
      
      const data = await this.post('/auth/login', credentials);
      
      if (data && data.user && data.token) {
        this.storeAuth(data.token, data.user, data.refreshToken);
        this.emit('login', { user: data.user });
        console.log('✅ Login successful for user:', data.user.fullName);
        return data;
      }
      
      throw new Error('Invalid login response format');
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      this.emit('loginError', { error: error.message });
      throw error;
    }
  }

  /**
   * User logout with cleanup
   */
  async logout() {
    try {
      // Attempt server logout
      await this.get('/auth/logout').catch(err => 
        console.warn('Server logout request failed:', err.message)
      );
    } finally {
      this.clearAuth();
      this.clearCache();
      this.emit('logout');
      console.log('✅ Logout completed successfully');
      
      // Redirect to login
      if (window.router && typeof window.router.navigateTo === 'function') {
        window.router.navigateTo('/login');
      } else {
        window.location.hash = '#/login';
      }
    }
  }

  /**
   * Change user password
   */
  async changePassword(currentPassword, newPassword) {
    return this.post('/auth/change-password', {
      currentPassword,
      newPassword
    });
  }

  /**
   * Get current user profile
   */
  async getUserProfile() {
    return this.get('/auth/profile', {}, { cache: true, cacheDuration: 300000 }); // 5 minutes cache
  }

  /**
   * Refresh authentication token
   */
  async refreshAuthToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const data = await this.post('/auth/refresh', {
        refreshToken: this.refreshToken
      });
      
      if (data && data.token) {
        this.storeAuth(data.token, data.user || this.user, data.refreshToken);
        return data.token;
      }
      
      throw new Error('Token refresh failed');
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      this.clearAuth();
      throw error;
    }
  }

  // ===================================
  // USER MANAGEMENT METHODS
  // ===================================

  /**
   * Get all users (admin only)
   */
  async getAllUsers(params = {}) {
    return this.get('/auth/users', params, { cache: true, cacheDuration: 60000 }); // 1 minute cache
  }

  /**
   * Register new user (admin only)
   */
  async registerUser(userData) {
    const result = await this.post('/auth/register', userData);
    this.invalidateCache('/auth/users');
    return result;
  }

  /**
   * Update user information (admin only)
   */
  async updateUser(userId, userData) {
    const result = await this.put(`/auth/users/${userId}`, userData);
    this.invalidateCache('/auth/users');
    this.invalidateCache('/auth/profile');
    return result;
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId) {
    const result = await this.delete(`/auth/users/${userId}`);
    this.invalidateCache('/auth/users');
    return result;
  }

  /**
   * Admin reset user password
   */
  async adminResetUserPassword(userId, newPassword) {
    return this.post(`/auth/reset-password/${userId}`, { newPassword });
  }

  // ===================================
  // PAYMENT METHODS
  // ===================================

  /**
   * Get all payments with advanced filtering (admin only)
   */
  async getAllPayments(params = {}) {
    const cacheKey = `/payment/all?${new URLSearchParams(params).toString()}`;
    return this.get('/payment/all', params, { 
      cache: true, 
      cacheDuration: 30000, // 30 seconds cache
      cacheKey 
    });
  }

  /**
   * Get user payments with pagination
   */
  async getUserPayments(userId = null, params = {}) {
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;
    
    return this.get(endpoint, params, { 
      cache: true, 
      cacheDuration: 30000,
      cacheKey 
    });
  }

  /**
   * Get payment statistics (admin only)
   */
  async getPaymentStats(params = {}) {
    return this.get('/payment/stats', params, { 
      cache: true, 
      cacheDuration: 60000 // 1 minute cache
    });
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId) {
    return this.get(`/payment/status/${paymentId}`);
  }

  /**
   * Initiate payment (unified KCB/M-Pesa endpoint)
   */
  async initiatePayment(paymentData) {
    this.validatePaymentData(paymentData);
    
    const result = await this.post('/payment/initiate', paymentData);
    this.invalidatePaymentCaches();
    return result;
  }

  /**
   * Initiate M-Pesa payment (legacy support)
   */
  async initiateMpesaPayment(paymentData) {
    const result = await this.post('/payment/initiate-mpesa', paymentData);
    this.invalidatePaymentCaches();
    return result;
  }

  /**
   * Initiate KCB payment
   */
  async initiateKcbPayment(paymentData) {
    const result = await this.post('/payment/initiate-kcb', paymentData);
    this.invalidatePaymentCaches();
    return result;
  }

  /**
   * Add manual payment with file upload support
   */
  async addManualPayment(paymentData, receiptFile = null) {
    const formData = new FormData();
    
    // Add payment data to form
    Object.keys(paymentData).forEach(key => {
      if (paymentData[key] !== null && paymentData[key] !== undefined) {
        if (typeof paymentData[key] === 'object') {
          formData.append(key, JSON.stringify(paymentData[key]));
        } else {
          formData.append(key, paymentData[key]);
        }
      }
    });
    
    // Add receipt file if provided
    if (receiptFile) {
      this.validateFile(receiptFile);
      formData.append('expenseReceiptImage', receiptFile);
    }
    
    const result = await this.uploadFile('/payment/manual', formData);
    this.invalidatePaymentCaches();
    return result;
  }

  /**
   * Update payment status (admin only)
   */
  async updatePaymentStatus(paymentId, status) {
    const result = await this.put(`/payment/${paymentId}/status`, { status });
    this.invalidatePaymentCaches();
    return result;
  }

  /**
   * Delete payment (admin only)
   */
  async deletePayment(paymentId) {
    const result = await this.delete(`/payment/${paymentId}`);
    this.invalidatePaymentCaches();
    return result;
  }

  // ===================================
  // BATCH PAYMENT METHODS
  // ===================================

  /**
   * Create batch payment
   */
  async createBatchPayment(batchData) {
    this.validateBatchData(batchData);
    
    const result = await this.post('/batch-payments', batchData);
    this.invalidateCache('/batch-payments');
    return result;
  }

  /**
   * Get all batch payments
   */
  async getAllBatchPayments(params = {}) {
    const cacheKey = `/batch-payments?${new URLSearchParams(params).toString()}`;
    return this.get('/batch-payments', params, {
      cache: true,
      cacheDuration: 30000,
      cacheKey
    });
  }

  /**
   * Get batch payment details
   */
  async getBatchPaymentDetails(batchId) {
    return this.get(`/batch-payments/${batchId}`, {}, {
      cache: true,
      cacheDuration: 15000 // 15 seconds cache
    });
  }

  /**
   * Add items to batch payment
   */
  async addItemsToBatch(batchId, batchData) {
    const result = await this.post(`/batch-payments/${batchId}/add-items`, batchData);
    this.invalidateCache('/batch-payments');
    this.invalidateCache(`/batch-payments/${batchId}`);
    return result;
  }

  /**
   * Process batch deposit via KCB
   */
  async processBatchDeposit(batchId, depositData) {
    const result = await this.post(`/batch-payments/${batchId}/deposit`, depositData);
    this.invalidateCache('/batch-payments');
    this.invalidateCache(`/batch-payments/${batchId}`);
    return result;
  }

  /**
   * Complete batch payment processing
   */
  async completeBatchPayment(batchId, completionData = {}) {
    const result = await this.post(`/batch-payments/${batchId}/complete`, completionData);
    this.invalidateCache('/batch-payments');
    this.invalidateCache(`/batch-payments/${batchId}`);
    this.invalidatePaymentCaches();
    return result;
  }

  /**
   * Cancel batch payment
   */
  async cancelBatchPayment(batchId, reason = null) {
    const result = await this.delete(`/batch-payments/${batchId}`, { reason });
    this.invalidateCache('/batch-payments');
    this.invalidateCache(`/batch-payments/${batchId}`);
    return result;
  }

  // ===================================
  // RECEIPT METHODS
  // ===================================

  /**
   * Get all receipts (admin only)
   */
  async getAllReceipts(params = {}) {
    const cacheKey = `/receipt/all?${new URLSearchParams(params).toString()}`;
    return this.get('/receipt/all', params, {
      cache: true,
      cacheDuration: 60000,
      cacheKey
    });
  }

  /**
   * Get user receipts
   */
  async getUserReceipts(userId = null, params = {}) {
    const endpoint = userId ? `/receipt/user/${userId}` : '/receipt/user';
    const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;
    
    return this.get(endpoint, params, {
      cache: true,
      cacheDuration: 60000,
      cacheKey
    });
  }

  /**
   * Get receipt by ID
   */
  async getReceiptById(receiptId) {
    return this.get(`/receipt/${receiptId}`, {}, {
      cache: true,
      cacheDuration: 300000 // 5 minutes cache
    });
  }

  /**
   * Download receipt PDF
   */
  async downloadReceipt(receiptId, filename = null) {
    const url = `${this.baseUrl}/receipt/${receiptId}/pdf`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to download receipt: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || `receipt-${receiptId}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      }, 0);
      
      return { success: true, message: 'Receipt download initiated.' };
    } catch (error) {
      console.error('❌ Receipt download failed:', error.message);
      throw error;
    }
  }

  /**
   * Upload receipt attachment
   */
  async uploadReceiptAttachment(receiptId, file) {
    this.validateFile(file);
    
    const formData = new FormData();
    formData.append('attachmentFile', file);
    
    return this.uploadFile(`/receipt/${receiptId}/attachment`, formData);
  }

  // ===================================
  // SPECIAL OFFERING METHODS
  // ===================================

  /**
   * Get all special offerings
   */
  async getSpecialOfferings(params = {}) {
    const cacheKey = `/special-offerings?${new URLSearchParams(params).toString()}`;
    return this.get('/special-offerings', params, {
      cache: true,
      cacheDuration: 120000, // 2 minutes cache
      cacheKey
    });
  }

  /**
   * Get special offering by ID or code
   */
  async getSpecialOffering(identifier) {
    return this.get(`/special-offerings/${identifier}`, {}, {
      cache: true,
      cacheDuration: 120000
    });
  }

  /**
   * Create special offering (admin only)
   */
  async createSpecialOffering(offeringData) {
    const result = await this.post('/special-offerings', offeringData);
    this.invalidateCache('/special-offerings');
    return result;
  }

  /**
   * Update special offering (admin only)
   */
  async updateSpecialOffering(identifier, offeringData) {
    const result = await this.put(`/special-offerings/${identifier}`, offeringData);
    this.invalidateCache('/special-offerings');
    this.invalidateCache(`/special-offerings/${identifier}`);
    return result;
  }

  /**
   * Delete special offering (admin only)
   */
  async deleteSpecialOffering(identifier) {
    const result = await this.delete(`/special-offerings/${identifier}`);
    this.invalidateCache('/special-offerings');
    this.invalidateCache(`/special-offerings/${identifier}`);
    return result;
  }

  /**
   * Get special offering progress
   */
  async getSpecialOfferingProgress(identifier) {
    return this.get(`/special-offerings/${identifier}/progress`, {}, {
      cache: true,
      cacheDuration: 30000 // 30 seconds cache
    });
  }

  /**
   * Make contribution to special offering
   */
  async contributeToSpecialOffering(identifier, contributionData) {
    const result = await this.post(`/special-offerings/${identifier}/contribution`, contributionData);
    this.invalidateCache(`/special-offerings/${identifier}/progress`);
    this.invalidatePaymentCaches();
    return result;
  }

  // ===================================
  // CONTACT & INQUIRY METHODS
  // ===================================

  /**
   * Get contact information (public)
   */
  async getContactInfo() {
    return this.get('/contact/info', {}, {
      cache: true,
      cacheDuration: 3600000 // 1 hour cache
    });
  }

  /**
   * Submit contact form (public)
   */
  async submitContactForm(contactData) {
    const result = await this.post('/contact/submit', contactData);
    this.invalidateCache('/contact/inquiries');
    return result;
  }

  /**
   * Get all inquiries (admin only)
   */
  async getAllInquiries(params = {}) {
    const cacheKey = `/contact/inquiries?${new URLSearchParams(params).toString()}`;
    return this.get('/contact/inquiries', params, {
      cache: true,
      cacheDuration: 30000,
      cacheKey
    });
  }

  /**
   * Get inquiry by ID (admin only)
   */
  async getInquiryById(inquiryId) {
    const result = await this.get(`/contact/inquiries/${inquiryId}`);
    this.invalidateCache('/contact/inquiries'); // Status might change to viewed
    return result;
  }

  /**
   * Update inquiry status (admin only)
   */
  async updateInquiryStatus(inquiryId, status, resolutionNotes = null) {
    const result = await this.put(`/contact/inquiries/${inquiryId}/status`, {
      status,
      resolutionNotes
    });
    this.invalidateCache('/contact/inquiries');
    this.invalidateCache(`/contact/inquiries/${inquiryId}`);
    return result;
  }

  /**
   * Delete/archive inquiry (admin only)
   */
  async deleteInquiry(inquiryId) {
    const result = await this.delete(`/contact/inquiries/${inquiryId}`);
    this.invalidateCache('/contact/inquiries');
    return result;
  }

  // ===================================
  // WALLET METHODS
  // ===================================

  /**
   * Get all wallets
   */
  async getAllWallets() {
    return this.get('/wallets/all', {}, {
      cache: true,
      cacheDuration: 60000 // 1 minute cache
    });
  }

  /**
   * Get wallet transactions
   */
  async getWalletTransactions(walletId, params = {}) {
    const cacheKey = `/wallets/${walletId}/transactions?${new URLSearchParams(params).toString()}`;
    return this.get(`/wallets/${walletId}/transactions`, params, {
      cache: true,
      cacheDuration: 30000,
      cacheKey
    });
  }

  /**
   * Initialize wallet system (admin only)
   */
  async initializeWallets() {
    const result = await this.post('/wallets/initialize');
    this.invalidateCache('/wallets/all');
    return result;
  }

  /**
   * Recalculate wallet balances (admin only)
   */
  async recalculateWalletBalances() {
    const result = await this.post('/wallets/recalculate');
    this.invalidateCache('/wallets/all');
    return result;
  }

  /**
   * Update wallet balances for specific payments (admin only)
   */
  async updateWalletBalances(paymentIds) {
    const result = await this.post('/wallets/update-balances', { paymentIds });
    this.invalidateCache('/wallets/all');
    return result;
  }

  /**
   * Get withdrawal requests
   */
  async getWithdrawalRequests(params = {}) {
    const cacheKey = `/wallets/withdrawals?${new URLSearchParams(params).toString()}`;
    return this.get('/wallets/withdrawals', params, {
      cache: true,
      cacheDuration: 30000,
      cacheKey
    });
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawalRequest(withdrawalData) {
    const result = await this.post('/wallets/withdrawals', withdrawalData);
    this.invalidateCache('/wallets/withdrawals');
    this.invalidateCache('/wallets/all');
    return result;
  }

  /**
   * Approve withdrawal request
   */
  async approveWithdrawalRequest(withdrawalId, approvalData) {
    const result = await this.post(`/wallets/withdrawals/${withdrawalId}/approve`, approvalData);
    this.invalidateCache('/wallets/withdrawals');
    this.invalidateCache('/wallets/all');
    return result;
  }

  /**
   * Validate tithe distribution
   */
  async validateTitheDistribution(distribution, totalAmount) {
    return this.post('/wallets/validate-tithe', {
      distribution,
      totalAmount
    });
  }

  // ===================================
  // KCB SYNC METHODS
  // ===================================

  /**
   * Get KCB account balance
   */
  async getKcbAccountBalance() {
    return this.get('/kcb-sync/balance', {}, {
      cache: true,
      cacheDuration: 60000 // 1 minute cache
    });
  }

  /**
   * Get KCB transaction history
   */
  async getKcbTransactionHistory(params = {}) {
    const cacheKey = `/kcb-sync/transactions?${new URLSearchParams(params).toString()}`;
    return this.get('/kcb-sync/transactions', params, {
      cache: true,
      cacheDuration: 120000, // 2 minutes cache
      cacheKey
    });
  }

  /**
   * Sync KCB transactions
   */
  async syncKcbTransactions(syncData = {}) {
    const result = await this.post('/kcb-sync/sync', syncData);
    this.invalidateCache('/kcb-sync/transactions');
    this.invalidateCache('/kcb-sync/unlinked');
    this.invalidateCache('/kcb-sync/statistics');
    return result;
  }

  /**
   * Get unlinked KCB transactions
   */
  async getUnlinkedKcbTransactions(params = {}) {
    const cacheKey = `/kcb-sync/unlinked?${new URLSearchParams(params).toString()}`;
    return this.get('/kcb-sync/unlinked', params, {
      cache: true,
      cacheDuration: 60000,
      cacheKey
    });
  }

  /**
   * Manually link KCB transaction
   */
  async linkKcbTransaction(kcbSyncId, paymentId) {
    const result = await this.post('/kcb-sync/link', {
      kcbSyncId,
      paymentId
    });
    this.invalidateCache('/kcb-sync/unlinked');
    this.invalidateCache('/kcb-sync/statistics');
    return result;
  }

  /**
   * Mark KCB transaction as ignored
   */
  async ignoreKcbTransaction(kcbSyncId, reason = null) {
    const result = await this.put(`/kcb-sync/ignore/${kcbSyncId}`, { reason });
    this.invalidateCache('/kcb-sync/unlinked');
    this.invalidateCache('/kcb-sync/statistics');
    return result;
  }

  /**
   * Get KCB sync statistics
   */
  async getKcbSyncStatistics() {
    return this.get('/kcb-sync/statistics', {}, {
      cache: true,
      cacheDuration: 120000 // 2 minutes cache
    });
  }

  // ===================================
  // ADMIN METHODS
  // ===================================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    return this.get('/admin/dashboard-stats', {}, {
      cache: true,
      cacheDuration: 60000 // 1 minute cache
    });
  }

  /**
   * Get recent admin activity
   */
  async getRecentActivity(params = {}) {
    const cacheKey = `/admin/activity?${new URLSearchParams(params).toString()}`;
    return this.get('/admin/activity', params, {
      cache: true,
      cacheDuration: 30000,
      cacheKey
    });
  }

  /**
   * Create activity log entry
   */
  async createActivityLog(activityData) {
    const result = await this.post('/admin/activity-log', activityData);
    this.invalidateCache('/admin/activity');
    return result;
  }

  /**
   * Generate admin reports
   */
  async generateReport(reportData) {
    return this.post('/admin/reports', reportData, {
      timeout: this.uploadTimeout // Reports can take time to generate
    });
  }

  // ===================================
  // SYSTEM HEALTH METHODS
  // ===================================

  /**
   * Check system health
   */
  async getSystemHealth() {
    return this.get('/health', {}, {
      cache: true,
      cacheDuration: 30000
    });
  }

  /**
   * Get system status (admin only)
   */
  async getSystemStatus() {
    return this.get('/system/status', {}, {
      cache: true,
      cacheDuration: 60000
    });
  }

  /**
   * Check receipt system health
   */
  async getReceiptHealth() {
    return this.get('/receipt-health', {}, {
      cache: true,
      cacheDuration: 60000
    });
  }

  // ===================================
  // CORE HTTP METHODS
  // ===================================

  /**
   * Enhanced GET request with caching and retry logic
   */
  async get(endpoint, params = {}, options = {}) {
    let url = `${this.baseUrl}${endpoint}`;
    
    // Add query parameters
    if (Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          queryParams.append(key, params[key]);
        }
      });
      url += `?${queryParams.toString()}`;
    }
    
    // Check cache first
    const cacheKey = options.cacheKey || url;
    if (options.cache && this.getCachedData(cacheKey)) {
      console.log('📦 Cache hit for:', cacheKey);
      return this.getCachedData(cacheKey);
    }
    
    // Check for pending request to avoid duplicates
    if (this.pendingRequests.has(cacheKey)) {
      console.log('⏳ Waiting for pending request:', cacheKey);
      return this.pendingRequests.get(cacheKey);
    }
    
    const requestPromise = this.executeRequest('GET', url, null, options);
    this.pendingRequests.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      
      // Cache the result if caching is enabled
      if (options.cache) {
        this.setCachedData(cacheKey, result, options.cacheDuration);
      }
      
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Enhanced POST request
   */
  async post(endpoint, data = {}, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.executeRequest('POST', url, data, options);
  }

  /**
   * Enhanced PUT request
   */
  async put(endpoint, data = {}, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.executeRequest('PUT', url, data, options);
  }

  /**
   * Enhanced DELETE request
   */
  async delete(endpoint, data = null, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    return this.executeRequest('DELETE', url, data, options);
  }

  /**
   * File upload with progress tracking
   */
  async uploadFile(endpoint, formData, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Setup progress tracking
      if (options.onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            options.onProgress(progress);
          }
        });
      }
      
      // Setup completion handler
      xhr.addEventListener('load', async () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve(this.processResponse(response));
          } else {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.message || `Upload failed: ${xhr.statusText}`));
          }
        } catch (error) {
          reject(new Error('Failed to parse upload response'));
        }
      });
      
      // Setup error handler
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });
      
      // Setup timeout
      xhr.timeout = options.timeout || this.uploadTimeout;
      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timed out'));
      });
      
      // Open and send request
      xhr.open('POST', url);
      
      // Set headers (don't set Content-Type for FormData)
      const headers = this.getHeaders(true);
      Object.keys(headers).forEach(key => {
        if (key !== 'Content-Type') {
          xhr.setRequestHeader(key, headers[key]);
        }
      });
      
      xhr.send(formData);
    });
  }

  /**
   * Core request execution with retry logic and error handling
   */
  async executeRequest(method, url, data, options = {}) {
    const startTime = Date.now();
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // Check if we're online for non-critical requests
        if (!this.isOnline && !options.allowOffline) {
          throw new Error('No internet connection');
        }
        
        // Check and refresh token if needed
        await this.ensureValidToken();
        
        const fetchOptions = {
          method: method.toUpperCase(),
          headers: this.getHeaders(data instanceof FormData),
          credentials: 'include',
          signal: this.createAbortSignal(options.timeout || this.defaultTimeout),
          ...options.fetchOptions
        };
        
        // Add body for non-GET requests
        if (data && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
          if (data instanceof FormData) {
            fetchOptions.body = data;
          } else {
            fetchOptions.body = JSON.stringify(data);
          }
        }
        
        console.log(`🌐 ${method.toUpperCase()} ${url} (attempt ${attempt})`);
        
        const response = await fetch(url, fetchOptions);
        const result = await this.handleResponse(response);
        
        // Track metrics
        this.trackRequestMetrics(Date.now() - startTime, true);
        
        return result;
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Request attempt ${attempt} failed:`, error.message);
        
        // Don't retry for certain errors
        if (this.shouldNotRetry(error)) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    // Track failed metrics
    this.trackRequestMetrics(Date.now() - startTime, false);
    
    // If offline, queue the request for later
    if (!this.isOnline && options.queueIfOffline !== false) {
      this.queueRequest(method, url, data, options);
      throw new Error('Request queued for when connection is restored');
    }
    
    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * Enhanced response handling
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    let responseData;
    try {
      if (response.status === 204) {
        return null;
      }
      responseData = isJson ? await response.json() : await response.text();
    } catch (parseError) {
      throw new Error('Failed to parse server response');
    }

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401) {
        this.handleAuthError();
        throw new Error('Authentication required');
      }
      
      // Handle other errors
      const errorMessage = this.extractErrorMessage(responseData, response);
      const error = new Error(errorMessage);
      error.response = responseData;
      error.status = response.status;
      throw error;
    }
    
    return this.processResponse(responseData);
  }

  /**
   * Process successful response data
   */
  processResponse(responseData) {
    // Handle nested data structure from backend
    if (responseData && responseData.success === true && responseData.data !== undefined) {
      return responseData.data;
    }
    
    return responseData;
  }

  // ===================================
  // AUTHENTICATION UTILITIES
  // ===================================

  /**
   * Load stored authentication data
   */
  loadStoredAuth() {
    try {
      const storageKeys = ['token', 'authToken'];
      let storedToken = null;
      
      // Try localStorage first
      for (const key of storageKeys) {
        storedToken = localStorage.getItem(key);
        if (storedToken) break;
      }
      
      // Fall back to sessionStorage
      if (!storedToken) {
        for (const key of storageKeys) {
          storedToken = sessionStorage.getItem(key);
          if (storedToken) break;
        }
      }
      
      const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const storedExpiry = localStorage.getItem('tokenExpiresAt');
      
      if (storedToken) {
        this.token = storedToken;
        this.refreshToken = storedRefreshToken;
        this.tokenExpiresAt = storedExpiry ? new Date(storedExpiry) : null;
        
        console.log('✅ Auth token restored from storage');
      }
      
      if (storedUser) {
        this.user = JSON.parse(storedUser);
        console.log('✅ User profile restored:', this.user.fullName || this.user.username);
      }
    } catch (error) {
      console.error('❌ Error loading stored authentication:', error);
      this.clearAuth();
    }
  }

  /**
   * Store authentication data
   */
  storeAuth(token, user, refreshToken = null) {
    try {
      this.token = token;
      this.user = user;
      this.refreshToken = refreshToken;
      
      // Calculate token expiry (assuming 8 hour tokens)
      this.tokenExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      
      // Store in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      
      localStorage.setItem('tokenExpiresAt', this.tokenExpiresAt.toISOString());
      
      // Clean up old keys
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      
      console.log('✅ Authentication data stored successfully');
    } catch (error) {
      console.error('❌ Error storing authentication data:', error);
    }
  }

  /**
   * Clear authentication data
   */
  clearAuth() {
    this.token = null;
    this.user = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    
    // Clear from all storage locations
    const keys = ['token', 'user', 'authToken', 'refreshToken', 'tokenExpiresAt'];
    keys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    console.log('🧹 Authentication data cleared');
  }

  /**
   * Ensure token is valid and refresh if needed
   */
  async ensureValidToken() {
    if (!this.token) {
      return;
    }
    
    // Check if token is close to expiry (within 5 minutes)
    if (this.tokenExpiresAt && this.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      try {
        await this.refreshAuthToken();
        console.log('🔄 Token refreshed successfully');
      } catch (error) {
        console.warn('⚠️ Token refresh failed:', error.message);
        this.clearAuth();
      }
    }
  }

  /**
   * Handle authentication errors
   */
  handleAuthError() {
    console.warn('🔒 Authentication error detected');
    this.clearAuth();
    this.emit('authError');
    
    // Redirect to login after a short delay
    setTimeout(() => {
      if (window.router && typeof window.router.navigateTo === 'function') {
        window.router.navigateTo('/login');
      } else {
        window.location.hash = '#/login';
      }
    }, 100);
  }

  // ===================================
  // CACHING UTILITIES
  // ===================================

  /**
   * Get cached data if not expired
   */
  getCachedData(key) {
    if (!this.cache.has(key)) {
      return null;
    }
    
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  /**
   * Set cached data with expiry
   */
  setCachedData(key, data, duration = 300000) { // 5 minutes default
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + duration);
  }

  /**
   * Invalidate specific cache entries
   */
  invalidateCache(pattern) {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    });
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    console.log('🧹 Cache cleared');
  }

  /**
   * Invalidate payment-related caches
   */
  invalidatePaymentCaches() {
    this.invalidateCache('/payment');
    this.invalidateCache('/admin/dashboard-stats');
    this.invalidateCache('/wallets');
  }

  // ===================================
  // CONNECTION & OFFLINE SUPPORT
  // ===================================

  /**
   * Setup connection monitoring
   */
  setupConnectionMonitoring() {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored');
      this.isOnline = true;
      this.emit('online');
      this.processRequestQueue();
    });

    window.addEventListener('offline', () => {
      console.log('📡 Connection lost');
      this.isOnline = false;
      this.emit('offline');
    });
  }

  /**
   * Queue request for when connection is restored
   */
  queueRequest(method, url, data, options) {
    this.requestQueue.push({ method, url, data, options, timestamp: Date.now() });
    console.log(`📋 Request queued: ${method} ${url}`);
  }

  /**
   * Process queued requests when connection is restored
   */
  async processRequestQueue() {
    if (this.requestQueue.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing ${this.requestQueue.length} queued requests`);
    
    const queue = [...this.requestQueue];
    this.requestQueue = [];
    
    for (const request of queue) {
      try {
        await this.executeRequest(request.method, request.url, request.data, request.options);
        console.log(`✅ Queued request completed: ${request.method} ${request.url}`);
      } catch (error) {
        console.error(`❌ Queued request failed: ${request.method} ${request.url}`, error.message);
        
        // Re-queue if it's not too old (5 minutes)
        if (Date.now() - request.timestamp < 5 * 60 * 1000) {
          this.requestQueue.push(request);
        }
      }
    }
  }

  // ===================================
  // VALIDATION UTILITIES
  // ===================================

  /**
   * Validate login credentials
   */
  validateCredentials(credentials) {
    if (!credentials.username || !credentials.password) {
      throw new Error('Username and password are required');
    }
    
    if (credentials.username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    
    if (credentials.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
  }

  /**
   * Validate payment data
   */
  validatePaymentData(paymentData) {
    if (!paymentData.amount || paymentData.amount <= 0) {
      throw new Error('Valid payment amount is required');
    }
    
    if (!paymentData.paymentType || !this.supportedPaymentTypes.includes(paymentData.paymentType)) {
      throw new Error('Valid payment type is required');
    }
    
    if (paymentData.paymentMethod && !this.supportedPaymentMethods.includes(paymentData.paymentMethod)) {
      throw new Error('Unsupported payment method');
    }
    
    if (!paymentData.phoneNumber) {
      throw new Error('Phone number is required');
    }
    
    // Validate Kenyan phone number
    const phonePattern = /^(\+254|0)?[17]\d{8}$/;
    if (!phonePattern.test(paymentData.phoneNumber)) {
      throw new Error('Invalid Kenyan phone number format');
    }
  }

  /**
   * Validate batch payment data
   */
  validateBatchData(batchData) {
    if (!batchData.payments || !Array.isArray(batchData.payments)) {
      throw new Error('Payments array is required');
    }
    
    if (batchData.payments.length === 0) {
      throw new Error('At least one payment is required');
    }
    
    if (batchData.payments.length > 500) {
      throw new Error('Batch size cannot exceed 500 payments');
    }
    
    batchData.payments.forEach((payment, index) => {
      if (!payment.userId || !payment.amount || !payment.paymentType) {
        throw new Error(`Payment ${index + 1}: Missing required fields`);
      }
      
      if (payment.amount <= 0) {
        throw new Error(`Payment ${index + 1}: Amount must be positive`);
      }
    });
  }

  /**
   * Validate file uploads
   */
  validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }
    
    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds ${Math.round(this.maxFileSize / 1024 / 1024)}MB limit`);
    }
    
    if (!this.supportedFileTypes.includes(file.type)) {
      throw new Error('Unsupported file type. Please use JPEG, PNG, or PDF files.');
    }
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  /**
   * Get request headers
   */
  getHeaders(isFormData = false) {
    const headers = {};
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    // Add request ID for tracking
    headers['X-Request-ID'] = this.generateRequestId();
    
    return headers;
  }

  /**
   * Create abort signal for request timeout
   */
  createAbortSignal(timeout) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  }

  /**
   * Determine if request should not be retried
   */
  shouldNotRetry(error) {
    // Don't retry for client errors (4xx) except 408, 429
    if (error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
      return true;
    }
    
    // Don't retry for authentication errors
    if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
      return true;
    }
    
    // Don't retry for validation errors
    if (error.message.includes('Validation') || error.message.includes('Invalid')) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract error message from response
   */
  extractErrorMessage(responseData, response) {
    if (responseData && responseData.message) {
      return responseData.message;
    }
    
    if (responseData && responseData.error && responseData.error.message) {
      return responseData.error.message;
    }
    
    return `Request failed: ${response.status} ${response.statusText}`;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Track request metrics
   */
  trackRequestMetrics(responseTime, success) {
    this.requestMetrics.totalRequests++;
    
    if (success) {
      this.requestMetrics.successfulRequests++;
    } else {
      this.requestMetrics.failedRequests++;
    }
    
    this.requestMetrics.requestTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.requestMetrics.requestTimes.length > 100) {
      this.requestMetrics.requestTimes.shift();
    }
    
    // Recalculate average
    this.requestMetrics.averageResponseTime = 
      this.requestMetrics.requestTimes.reduce((a, b) => a + b, 0) / this.requestMetrics.requestTimes.length;
  }

  // ===================================
  // PERIODIC TASKS
  // ===================================

  /**
   * Setup token validation checks
   */
  setupTokenValidation() {
    setInterval(() => {
      this.ensureValidToken().catch(error => {
        console.warn('Token validation failed:', error.message);
      });
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Setup cache cleanup
   */
  setupCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const expiredKeys = [];
      
      this.cacheExpiry.forEach((expiry, key) => {
        if (expiry < now) {
          expiredKeys.push(key);
        }
      });
      
      expiredKeys.forEach(key => {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      });
      
      if (expiredKeys.length > 0) {
        console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
      }
    }, 10 * 60 * 1000); // Clean every 10 minutes
  }

  // ===================================
  // EVENT SYSTEM
  // ===================================

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event, data = null) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ===================================
  // PUBLIC API INFO METHODS
  // ===================================

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!(this.token && this.user);
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    return !!(this.user && this.user.isAdmin);
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Get authentication token
   */
  getToken() {
    return this.token;
  }

  /**
   * Get service status information
   */
  getServiceStatus() {
    return {
      version: this.version,
      baseUrl: this.baseUrl,
      authenticated: this.isAuthenticated(),
      user: this.getCurrentUser(),
      isOnline: this.isOnline,
      cacheSize: this.cache.size,
      queuedRequests: this.requestQueue.length,
      metrics: this.requestMetrics,
      supportedPaymentMethods: this.supportedPaymentMethods,
      supportedFileTypes: this.supportedFileTypes
    };
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      online: this.isOnline,
      queuedRequests: this.requestQueue.length,
      lastOnline: this.isOnline ? new Date() : null
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.requestMetrics,
      successRate: this.requestMetrics.totalRequests > 0 
        ? (this.requestMetrics.successfulRequests / this.requestMetrics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      cacheHitRate: 'Available in future version'
    };
  }
}

// Create and export singleton instance
const apiServiceInstance = new ApiService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.apiService = apiServiceInstance;
}

export default apiServiceInstance;