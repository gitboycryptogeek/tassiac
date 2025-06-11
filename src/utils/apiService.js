// src/utils/apiService.js

/**
 * Comprehensive API Service for Church Financial Management System
 * 
 * This service handles all communication between the frontend and backend
 * for a church financial management system with KCB payment integration.
 * 
 * MAIN FEATURES:
 * - Authentication & User Management
 * - Payment Processing (KCB primary, M-Pesa backup)
 * - Batch Payment Processing
 * - Wallet Management with Multi-Admin Approval
 * - Special Offerings Management
 * - Receipt Generation & Management
 * - Contact Inquiry Management
 * - Admin Dashboard & Reporting
 * - KCB Transaction Synchronization
 * 
 * PAYMENT METHODS SUPPORTED:
 * - KCB (Kenya Commercial Bank) - Primary gateway
 * - M-Pesa - Backup/alternative
 * - Manual entry (Admin only)
 * 
 * @author Church Financial Management Team
 * @version 2.0.0
 */
export class ApiService {
  /**
   * Initialize the API service
   * Sets up base configuration and loads stored authentication
   */
  constructor() {
    this.baseUrl = '/api'; // Vite proxy handles this in development
    this.token = null;
    this.user = null;
    
    // Request timeout configuration
    this.defaultTimeout = 30000; // 30 seconds
    this.uploadTimeout = 120000;  // 2 minutes for file uploads
    
    // Supported file types for uploads
    this.supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    this.supportedDocumentTypes = ['application/pdf'];
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    
    // Load stored authentication on initialization
    this.loadStoredAuth();
    
    console.log('🚀 Church Financial API Service initialized');
    console.log('🔧 Service status:', this.getServiceStatus());
  }

  // ================================================================================================
  // AUTHENTICATION MANAGEMENT
  // ================================================================================================

  /**
   * Load authentication data from localStorage
   */
  loadStoredAuth() {
    try {
      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken) {
        this.token = storedToken;
        console.log('✅ Token loaded from storage:', this.token.substring(0, 20) + '...');
      } else {
        console.log('ℹ️ No token found in storage');
      }
      
      if (storedUser) {
        this.user = JSON.parse(storedUser);
        console.log('✅ User loaded from storage:', this.user.fullName || this.user.username);
      } else {
        console.log('ℹ️ No user found in storage');
      }
    } catch (error) {
      console.error('❌ Error loading stored auth:', error);
      this.clearAuth();
    }
  }

  /**
   * Store authentication data
   */
  storeAuth(token, user) {
    try {
      this.token = token;
      this.user = user;
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log('✅ Auth data stored successfully');
    } catch (error) {
      console.error('❌ Error storing auth:', error);
    }
  }

  /**
   * Clear authentication data
   */
  clearAuth() {
    this.token = null;
    this.user = null;
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    console.log('🗑️ Auth data cleared');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const authenticated = !!(this.token && this.user);
    console.log('🔍 Authentication check:', authenticated);
    return authenticated;
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    const admin = !!(this.user && this.user.isAdmin);
    console.log('👑 Admin check:', admin);
    return admin;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Get current token
   */
  getToken() {
    return this.token;
  }

  /**
   * Generate headers for API requests
   * Automatically includes authentication token when available
   * 
   * @param {boolean} isFormData - Set to true for FormData uploads (skips Content-Type)
   * @returns {Object} Headers object for fetch requests
   */
  getHeaders(isFormData = false) {
    const headers = {};
    
    // Set content type for JSON requests
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // Add authentication token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log('🔑 Authorization header added:', `Bearer ${this.token.substring(0, 20)}...`);
    } else {
      console.warn('⚠️ No token available for authorization header');
    }
    
    return headers;
  }

  /**
   * Comprehensive response handler with detailed error parsing
   * Handles both successful and error responses from the backend
   * 
   * @param {Response} response - Fetch API response object
   * @returns {Promise<any>} Parsed response data
   * @throws {Error} Detailed error with status, code, and context
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    let responseData;

    // Parse response based on content type
    try {
      responseData = isJson ? await response.json() : await response.text();
    } catch (parseError) {
      console.error('❌ Error parsing API response:', parseError);
      throw new Error(response.ok ? 'Invalid JSON response from server.' : `Request failed with status ${response.status}: ${response.statusText}`);
    }

    // Handle error responses
    if (!response.ok) {
      // Handle 401 Unauthorized specifically
      if (response.status === 401) {
        console.warn('🔒 Received 401 Unauthorized, clearing auth');
        this.clearAuth();
        // Redirect to login page if not already there
        if (window.location.pathname !== '/login.html' && window.location.pathname !== '/') {
          window.location.href = '/login.html';
        }
      }

      let errorMessage = `Request failed with status ${response.status}`;
      let errorCode = `HTTP_ERROR_${response.status}`;
      let errorDetails = null;

      // Extract detailed error information
      if (responseData && typeof responseData === 'object' && responseData.message) {
        errorMessage = responseData.message;
        if (responseData.error) {
          errorCode = responseData.error.code || errorCode;
          errorDetails = responseData.error.details || responseData.error;
        }
      } else if (typeof responseData === 'string' && responseData.length > 0 && responseData.length < 200) {
        errorMessage = responseData;
      }

      // Create comprehensive error object
      const error = new Error(errorMessage);
      error.code = errorCode;
      error.status = response.status;
      error.details = errorDetails;
      error.response = responseData;
      error.endpoint = response.url;
      
      console.error('🚨 API Error:', {
        message: error.message,
        code: error.code,
        status: error.status,
        details: error.details,
        endpoint: error.endpoint
      });
      
      throw error;
    }

    // Handle standardized successful response format
    if (responseData && typeof responseData === 'object' && responseData.hasOwnProperty('success')) {
      if (responseData.success === true) {
        return responseData.data !== undefined ? responseData.data : { message: responseData.message };
      } else {
        // Backend reported operation failure
        const errorMessage = responseData.message || 'API operation reported failure.';
        const error = new Error(errorMessage);
        error.code = responseData.error?.code || 'OPERATION_FAILED';
        error.details = responseData.error?.details || null;
        error.response = responseData;
        console.error('⚠️ API Operation Failed:', error.message, 'Details:', error.details);
        throw error;
      }
    }

    // Return raw response data for non-standardized responses
    return responseData;
  }

  // ================================================================================================
  // AUTHENTICATION & USER MANAGEMENT
  // ================================================================================================

  /**
   * User authentication with username and password
   * Automatically saves user data and token on successful login
   * 
   * @param {string|Object} usernameOrCredentials - Username string or {username, password} object
   * @param {string} [password] - Password (if first param is username string)
   * @returns {Promise<Object>} User data and token
   */
  async login(usernameOrCredentials, password) {
    let username, pwd;
    
    // Handle both object and separate parameter formats
    if (typeof usernameOrCredentials === 'object' && usernameOrCredentials !== null) {
      username = String(usernameOrCredentials.username);
      pwd = String(usernameOrCredentials.password);
    } else {
      username = String(usernameOrCredentials);
      pwd = String(password);
    }

    console.log('🔐 Attempting login for user:', username);

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password: pwd }),
      credentials: 'include',
    });
    
    const data = await this.handleResponse(response);
    
    // Save authentication data if successful
    if (data && data.user && data.token) {
      this.storeAuth(data.token, data.user);
      console.log('✅ Login successful for user:', data.user.fullName);
    }
    
    return data;
  }

  /**
   * User logout
   * Clears local storage and redirects to login page
   */
  async logout() {
    console.log('👋 Logging out user');
    
    try {
      // Make logout request if token exists
      if (this.token) {
        await this.get('/auth/logout');
      }
    } catch (error) {
      console.warn('⚠️ Logout request failed:', error.message);
    } finally {
      // Always clear local auth data
      this.clearAuth();
      // Redirect to login page
      window.location.href = '/login.html';
    }
  }

  /**
   * Get current user's profile information
   */
  async getUserProfile() {
    console.log('👤 Fetching user profile');
    return this.get('/auth/profile');
  }

  /**
   * Change current user's password
   */
  async changePassword(currentPassword, newPassword) {
    console.log('🔒 Changing user password');
    return this.post('/auth/change-password', { currentPassword, newPassword });
  }

  // ================================================================================================
  // ADMIN USER MANAGEMENT
  // ================================================================================================

  /**
   * Get all users in the system (Admin only)
   */
  async getAllUsers() {
    console.log('👥 Fetching all users (Admin)');
    return this.get('/auth/users');
  }

  /**
   * Register a new user (Admin only)
   */
  async registerUser(userData) {
    console.log('➕ Registering new user:', userData.username);
    return this.post('/auth/register', userData);
  }

  /**
   * Update existing user information (Admin only)
   */
  async updateUser(userId, userData) {
    console.log('✏️ Updating user:', userId);
    return this.put(`/auth/users/${userId}`, userData);
  }

  /**
   * Delete/deactivate user account (Admin only)
   */
  async deleteUser(userId) {
    console.log('🗑️ Deleting user:', userId);
    return this.delete(`/auth/users/${userId}`);
  }

  /**
   * Reset user password (Admin only)
   */
  async adminResetUserPassword(userId, newPassword) {
    console.log('🔐 Admin resetting password for user:', userId);
    return this.post(`/auth/reset-password/${userId}`, { newPassword });
  }

  // ================================================================================================
  // PAYMENT PROCESSING METHODS
  // ================================================================================================

  /**
   * Get user's payment history with filtering and pagination
   */
  async getUserPayments(userId = null, params = {}) {
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    console.log('💰 Fetching payments for user:', userId || 'current user');
    return this.get(endpoint, params);
  }

  /**
   * Check payment status by payment ID
   */
  async getPaymentStatus(paymentId) {
    console.log('🔍 Checking payment status:', paymentId);
    return this.get(`/payment/status/${paymentId}`);
  }

  /**
   * Initiate a new payment (KCB or M-Pesa)
   * KCB is the primary payment method, M-Pesa is backup
   */
  async initiatePayment(paymentData) {
    // Set KCB as default payment method if not specified
    const enhancedPaymentData = {
      paymentMethod: 'KCB',
      ...paymentData
    };
    
    console.log('🚀 Initiating payment:', {
      amount: enhancedPaymentData.amount,
      type: enhancedPaymentData.paymentType,
      method: enhancedPaymentData.paymentMethod
    });
    
    return this.post('/payment/initiate', this.preparePaymentData(enhancedPaymentData));
  }

  /**
   * Initiate M-Pesa payment specifically
   */
  async initiateMpesaPayment(paymentData) {
    console.log('📱 Initiating M-Pesa payment:', paymentData.amount);
    return this.post('/payment/initiate-mpesa', this.preparePaymentData(paymentData));
  }

  /**
   * Initiate KCB payment specifically
   */
  async initiateKcbPayment(paymentData) {
    const kcbPaymentData = {
      ...paymentData,
      paymentMethod: 'KCB'
    };
    
    console.log('🏦 Initiating KCB payment:', kcbPaymentData.amount);
    return this.post('/payment/initiate', this.preparePaymentData(kcbPaymentData));
  }

  // ================================================================================================
  // ADMIN PAYMENT MANAGEMENT
  // ================================================================================================

  /**
   * Get all payments with advanced filtering (Admin only)
   */
  async getAllAdminPayments(params = {}) {
    console.log('📊 Fetching all payments (Admin)');
    return this.get('/payment/all', params);
  }

  /**
   * Get payment statistics and analytics (Admin only)
   */
  async getPaymentStats() {
    console.log('📈 Fetching payment statistics');
    return this.get('/payment/stats');
  }

  /**
   * Add manual payment entry (Admin only)
   */
  async addManualPayment(paymentData) {
    console.log('✍️ Adding manual payment:', {
      amount: paymentData.amount,
      type: paymentData.paymentType,
      user: paymentData.userId
    });
    return this.post('/payment/manual', paymentData);
  }

  /**
   * Add manual payment with receipt file attachment
   */
  async addManualPaymentWithReceipt(paymentData, receiptFile) {
    console.log('📄 Adding manual payment with receipt:', paymentData.amount);
    
    const formData = new FormData();
    
    // Add all payment data fields to FormData
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
      formData.append('expenseReceiptImage', receiptFile);
    }
    
    return this.uploadFile('/payment/manual', formData);
  }

  /**
   * Update payment status (Admin only)
   */
  async updatePaymentStatus(paymentId, status) {
    console.log('🔄 Updating payment status:', paymentId, 'to', status);
    return this.put(`/payment/${paymentId}/status`, { status });
  }

  /**
   * Delete payment record (Admin only)
   */
  async adminDeletePayment(paymentId) {
    console.log('🗑️ Deleting payment:', paymentId);
    return this.delete(`/payment/${paymentId}`);
  }

  // ================================================================================================
  // BATCH PAYMENT MANAGEMENT
  // ================================================================================================

  /**
   * Create batch payment for bulk processing
   */
  async createBatchPayment(batchData) {
    console.log('📦 Creating batch payment with', batchData.payments?.length, 'payments');
    return this.post('/batch-payments', batchData);
  }

  /**
   * Get all batch payments with filtering
   */
  async getAllBatchPayments(params = {}) {
    console.log('📦 Fetching batch payments');
    return this.get('/batch-payments', params);
  }

  /**
   * Get detailed information for specific batch payment
   */
  async getBatchPaymentDetails(batchId) {
    console.log('🔍 Fetching batch payment details:', batchId);
    return this.get(`/batch-payments/${batchId}`);
  }

  /**
   * Process batch deposit via KCB
   */
  async processBatchDeposit(batchId, depositData) {
    console.log('🏦 Processing batch deposit:', batchId);
    return this.post(`/batch-payments/${batchId}/deposit`, depositData);
  }

  /**
   * Complete batch payment processing
   */
  async completeBatchPayment(batchId, completionData = {}) {
    console.log('✅ Completing batch payment:', batchId);
    return this.post(`/batch-payments/${batchId}/complete`, completionData);
  }

  /**
   * Cancel batch payment
   */
  async cancelBatchPayment(batchId, reason = null) {
    console.log('❌ Cancelling batch payment:', batchId);
    return this.delete(`/batch-payments/${batchId}`, { reason });
  }

  /**
   * Create bulk payments for batch processing
   */
  async createBulkPayments(paymentsArray, description = null) {
    console.log('📝 Creating bulk payments:', paymentsArray.length, 'items');
    return this.createBatchPayment({
      payments: paymentsArray,
      description
    });
  }

  // ================================================================================================
  // WALLET MANAGEMENT
  // ================================================================================================

  /**
   * Initialize wallet system
   */
  async initializeWallets() {
    console.log('🏦 Initializing wallet system');
    return this.post('/wallets/initialize');
  }

  /**
   * Get all wallets with current balances
   */
  async getAllWallets() {
    console.log('💰 Fetching all wallets');
    return this.get('/wallets');
  }

  /**
   * Update wallet balances from completed payments
   */
  async updateWalletBalances(paymentIds) {
    console.log('⚖️ Updating wallet balances for', paymentIds.length, 'payments');
    return this.post('/wallets/update-balances', { paymentIds });
  }

  /**
   * Create withdrawal request from wallet
   */
  async createWithdrawalRequest(withdrawalData) {
    console.log('💸 Creating withdrawal request:', withdrawalData.amount);
    return this.post('/wallets/withdraw', withdrawalData);
  }

  /**
   * Get withdrawal requests with filtering
   */
  async getWithdrawalRequests(params = {}) {
    console.log('📋 Fetching withdrawal requests');
    return this.get('/wallets/withdrawals', params);
  }

  /**
   * Approve withdrawal request (Admin only)
   */
  async approveWithdrawalRequest(withdrawalId, approvalData) {
    console.log('✅ Approving withdrawal request:', withdrawalId);
    return this.post(`/wallets/withdrawals/${withdrawalId}/approve`, approvalData);
  }

  // ================================================================================================
  // KCB INTEGRATION & SYNCHRONIZATION
  // ================================================================================================

  /**
   * Get current KCB account balance
   */
  async getKcbAccountBalance() {
    console.log('🏦 Fetching KCB account balance');
    return this.get('/kcb-sync/balance');
  }

  /**
   * Get KCB transaction history
   */
  async getKcbTransactionHistory(params = {}) {
    console.log('📊 Fetching KCB transaction history');
    return this.get('/kcb-sync/transactions', params);
  }

  /**
   * Sync KCB transactions with local database
   */
  async syncKcbTransactions(syncData = {}) {
    console.log('🔄 Syncing KCB transactions');
    return this.post('/kcb-sync/sync', syncData);
  }

  /**
   * Get unlinked KCB transactions
   */
  async getUnlinkedKcbTransactions(params = {}) {
    console.log('🔗 Fetching unlinked KCB transactions');
    return this.get('/kcb-sync/unlinked', params);
  }

  /**
   * Manually link KCB transaction to payment
   */
  async linkKcbTransaction(kcbSyncId, paymentId) {
    console.log('🔗 Linking KCB transaction:', kcbSyncId, 'to payment:', paymentId);
    return this.post('/kcb-sync/link', { kcbSyncId, paymentId });
  }

  /**
   * Mark KCB transaction as ignored
   */
  async ignoreKcbTransaction(kcbSyncId, reason = null) {
    console.log('🚫 Ignoring KCB transaction:', kcbSyncId);
    return this.put(`/kcb-sync/ignore/${kcbSyncId}`, { reason });
  }

  /**
   * Get KCB synchronization statistics
   */
  async getKcbSyncStatistics() {
    console.log('📈 Fetching KCB sync statistics');
    return this.get('/kcb-sync/statistics');
  }

  // ================================================================================================
  // RECEIPT MANAGEMENT
  // ================================================================================================

  /**
   * Get user's receipts with filtering
   */
  async getUserReceipts(userId = null, params = {}) {
    const endpoint = userId ? `/receipt/user/${userId}` : '/receipt/user';
    console.log('🧾 Fetching receipts for user:', userId || 'current user');
    return this.get(endpoint, params);
  }

  /**
   * Get all receipts (Admin only)
   */
  async getAllReceipts(params = {}) {
    console.log('🧾 Fetching all receipts (Admin)');
    return this.get('/receipt/all', params);
  }

  /**
   * Get specific receipt by ID
   */
  async getReceiptById(receiptId) {
    console.log('🔍 Fetching receipt:', receiptId);
    return this.get(`/receipt/${receiptId}`);
  }

  /**
   * Download receipt as PDF
   */
  async downloadReceipt(receiptId) {
    console.log('📄 Downloading receipt PDF:', receiptId);
    return this.downloadFile(`/receipt/${receiptId}/pdf`, `receipt-${receiptId}.pdf`);
  }

  /**
   * Upload attachment to receipt
   */
  async uploadReceiptAttachment(receiptId, formData) {
    console.log('📎 Uploading receipt attachment:', receiptId);
    return this.uploadFile(`/receipt/${receiptId}/attachment`, formData);
  }

  // ================================================================================================
  // SPECIAL OFFERINGS MANAGEMENT
  // ================================================================================================

  /**
   * Get all special offerings with filtering
   */
  async getSpecialOfferings(params = { activeOnly: 'true' }) {
    console.log('🎯 Fetching special offerings');
    return this.get('/special-offerings', params);
  }

  /**
   * Create new special offering (Admin only)
   */
  async createSpecialOffering(offeringData) {
    console.log('➕ Creating special offering:', offeringData.name);
    return this.post('/special-offerings', offeringData);
  }

  /**
   * Get specific special offering details
   */
  async getSpecialOfferingDetails(identifier) {
    console.log('🔍 Fetching special offering:', identifier);
    return this.get(`/special-offerings/${identifier}`);
  }

  /**
   * Get special offering contribution progress
   */
  async getSpecialOfferingProgress(identifier) {
    console.log('📊 Fetching offering progress:', identifier);
    return this.get(`/special-offerings/${identifier}/progress`);
  }

  /**
   * Update special offering (Admin only)
   */
  async updateSpecialOffering(identifier, updateData) {
    console.log('✏️ Updating special offering:', identifier);
    return this.put(`/special-offerings/${identifier}`, updateData);
  }

  /**
   * Delete special offering (Admin only)
   */
  async deleteSpecialOffering(identifier) {
    console.log('🗑️ Deleting special offering:', identifier);
    return this.delete(`/special-offerings/${identifier}`);
  }

  /**
   * Make contribution to special offering
   */
  async makeSpecialOfferingContribution(identifier, paymentData) {
    console.log('💝 Making contribution to offering:', identifier, 'Amount:', paymentData.amount);
    return this.post(`/special-offerings/${identifier}/contribution`, paymentData);
  }

  // ================================================================================================
  // CONTACT & INQUIRY MANAGEMENT
  // ================================================================================================

  /**
   * Submit contact form inquiry
   */
  async submitContactForm(formData) {
    console.log('📧 Submitting contact form from:', formData.name);
    return this.post('/contact/submit', formData);
  }

  /**
   * Get church contact information
   */
  async getContactInfo() {
    console.log('📞 Fetching church contact info');
    return this.get('/contact/info');
  }

  /**
   * Get all contact inquiries (Admin only)
   */
  async getAllInquiries(params = {}) {
    console.log('📋 Fetching all inquiries (Admin)');
    return this.get('/contact/inquiries', params);
  }

  /**
   * Get specific inquiry by ID (Admin only)
   */
  async getInquiryById(inquiryId) {
    console.log('🔍 Fetching inquiry:', inquiryId);
    return this.get(`/contact/inquiries/${inquiryId}`);
  }

  /**
   * Update inquiry status (Admin only)
   */
  async updateInquiryStatus(inquiryId, status, resolutionNotes = null) {
    console.log('🔄 Updating inquiry status:', inquiryId, 'to', status);
    const data = { status };
    if (resolutionNotes) data.resolutionNotes = resolutionNotes;
    return this.put(`/contact/inquiries/${inquiryId}/status`, data);
  }

  /**
   * Archive inquiry (Admin only)
   */
  async archiveInquiry(inquiryId) {
    console.log('🗄️ Archiving inquiry:', inquiryId);
    return this.delete(`/contact/inquiries/${inquiryId}`);
  }

  // ================================================================================================
  // ADMIN DASHBOARD & REPORTING
  // ================================================================================================

  /**
   * Get comprehensive dashboard statistics (Admin only)
   */
  async getDashboardStats() {
    console.log('📊 Fetching dashboard statistics');
    return this.get('/admin/dashboard-stats');
  }

  /**
   * Get recent admin activity log
   */
  async getRecentActivity(params = {}) {
    console.log('📝 Fetching recent admin activity');
    return this.get('/admin/activity', params);
  }

  /**
   * Generate system reports (Admin only)
   */
  async generateReport(reportParams) {
    console.log('📄 Generating report:', reportParams.reportType);
    return this.post('/admin/reports', reportParams);
  }

  // ================================================================================================
  // CORE HTTP METHODS
  // ================================================================================================

  /**
   * Generic GET request handler
   */
  async get(endpoint, params = {}) {
    let url = `${this.baseUrl}${endpoint}`;
    if (Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          queryParams.append(key, params[key]);
        }
      });
      url += `?${queryParams.toString()}`;
    }
    
    console.log(`📡 Making GET request to: ${url}`);
    console.log('📋 Request headers:', this.getHeaders());
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });
    
    console.log(`📥 Response status: ${response.status} for ${url}`);
    
    return this.handleResponse(response);
  }

  /**
   * Generic POST request handler
   */
  async post(endpoint, data = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`📡 Making POST request to: ${url}`);
    console.log('📋 Request headers:', this.getHeaders());
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    
    console.log(`📥 Response status: ${response.status} for ${url}`);
    
    return this.handleResponse(response);
  }

  /**
   * Generic PUT request handler
   */
  async put(endpoint, data = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`📡 Making PUT request to: ${url}`);
    console.log('📋 Request headers:', this.getHeaders());
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    
    console.log(`📥 Response status: ${response.status} for ${url}`);
    
    return this.handleResponse(response);
  }

  /**
   * Generic DELETE request handler
   */
  async delete(endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`📡 Making DELETE request to: ${url}`);
    console.log('📋 Request headers:', this.getHeaders());
    
    const options = {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    console.log(`📥 Response status: ${response.status} for ${url}`);
    
    return this.handleResponse(response);
  }

  /**
   * File upload handler
   */
  async uploadFile(endpoint, formData) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(true);
    
    console.log(`📡 Making UPLOAD request to: ${url}`);
    console.log('📋 Request headers:', headers);

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: formData,
      credentials: 'include',
    });
    
    console.log(`📥 Response status: ${response.status} for ${url}`);
    
    return this.handleResponse(response);
  }

  /**
   * File upload with progress tracking
   */
  async uploadFileWithProgress(endpoint, formData, onProgress = null) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(percentComplete);
          }
        });
      }
      
      // Handle successful upload
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            resolve(xhr.responseText);
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });
      
      // Handle upload errors
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });
      
      // Configure and send request
      xhr.open('POST', `${this.baseUrl}${endpoint}`);
      
      // Set auth headers
      const headers = this.getHeaders(true);
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });
      
      xhr.send(formData);
    });
  }

  /**
   * Download file with proper error handling
   */
  async downloadFile(endpoint, filename) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log('📥 Downloading file from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: await response.text() || `File download failed with status ${response.status}` };
        }
        const error = new Error(errorData.message || `File download failed with status ${response.status}`);
        error.response = errorData;
        error.status = response.status;
        throw error;
      }
      
      // Create download blob and trigger download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      }, 0);
      
      return { success: true, message: 'File download initiated.' };
    } catch (error) {
      console.error('❌ File download error:', error.message);
      throw error;
    }
  }

  // ================================================================================================
  // UTILITY METHODS
  // ================================================================================================

  /**
   * Validate phone number format for Kenya
   */
  validatePhoneNumber(phoneNumber) {
    const kenyanPhoneRegex = /^254\d{9}$/;
    return kenyanPhoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number to standard Kenya format
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different input formats
    if (cleaned.startsWith('0')) {
      // Convert 0712345678 to 254712345678
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && cleaned.length === 9) {
      // Convert 712345678 to 254712345678
      cleaned = '254' + cleaned;
    } else if (cleaned.startsWith('254')) {
      // Already in correct format
      return cleaned;
    }
    
    return cleaned;
  }

  /**
   * Prepare payment data for submission
   */
  preparePaymentData(rawData) {
    const cleanData = { ...rawData };
    
    // Format phone number to standard format
    if (cleanData.phoneNumber) {
      cleanData.phoneNumber = this.formatPhoneNumber(cleanData.phoneNumber);
    }
    
    // Ensure amount is a proper number
    if (cleanData.amount) {
      cleanData.amount = parseFloat(cleanData.amount);
    }
    
    // Handle special offering ID conversion for frontend convenience
    if (cleanData.paymentType === 'SPECIAL' && cleanData.specialOfferingId) {
      cleanData.specialOfferingId = parseInt(cleanData.specialOfferingId);
    }
    
    // Clean up tithe distribution to ensure boolean values
    if (cleanData.titheDistributionSDA) {
      const cleanDistribution = {};
      const validKeys = ['campMeetingExpenses', 'welfare', 'thanksgiving', 'stationFund', 'mediaMinistry'];
      validKeys.forEach(key => {
        cleanDistribution[key] = Boolean(cleanData.titheDistributionSDA[key]);
      });
      cleanData.titheDistributionSDA = cleanDistribution;
    }
    
    return cleanData;
  }

  /**
   * Format custom fields for special offering
   */
  formatCustomFields(offeringData) {
    if (Array.isArray(offeringData.customFields) && offeringData.customFields.length > 0) {
      return offeringData.customFields;
    }
    return null;
  }

  /**
   * Validate file for upload
   */
  validateFile(file, allowedTypes = null, maxSize = null) {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }
    
    // Use default allowed types if not specified
    const types = allowedTypes || [...this.supportedImageTypes, ...this.supportedDocumentTypes];
    if (!types.includes(file.type)) {
      return { valid: false, error: `File type ${file.type} not supported. Allowed: ${types.join(', ')}` };
    }
    
    // Check file size
    const sizeLimit = maxSize || this.maxFileSize;
    if (file.size > sizeLimit) {
      const sizeMB = (sizeLimit / (1024 * 1024)).toFixed(1);
      return { valid: false, error: `File size exceeds ${sizeMB}MB limit` };
    }
    
    return { valid: true };
  }

  /**
   * Format currency amount for display
   */
  formatCurrency(amount, currency = 'KES') {
    return `${currency} ${parseFloat(amount).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  /**
   * Format date for display
   */
  formatDate(date, includeTime = false) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return dateObj.toLocaleDateString('en-US', options);
  }

  /**
   * Log API service activity
   */
  logActivity(action, details = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 API Service: ${action}`, details);
    }
  }

  /**
   * Get API service status and configuration
   */
  getServiceStatus() {
    return {
      baseUrl: this.baseUrl,
      authenticated: this.isAuthenticated(),
      user: this.getCurrentUser(),
      hasToken: !!this.token,
      tokenLength: this.token ? this.token.length : 0,
      timeout: {
        default: this.defaultTimeout,
        upload: this.uploadTimeout
      },
      fileUpload: {
        maxSize: this.maxFileSize,
        supportedTypes: [...this.supportedImageTypes, ...this.supportedDocumentTypes]
      }
    };
  }

  // ================================================================================================
  // LEGACY COMPATIBILITY METHODS
  // ================================================================================================

  /**
   * Set authentication service (for backward compatibility)
   * This service now manages authentication directly
   */
  setAuthService(authService) {
    console.log('⚠️ setAuthService called but authentication is now handled directly by ApiService');
    // For backward compatibility, we could sync with external auth service
    if (authService && authService.getToken && authService.getCurrentUser) {
      const token = authService.getToken();
      const user = authService.getCurrentUser();
      if (token && user) {
        this.storeAuth(token, user);
      }
    }
  }

  /**
   * Get all payments (alias for getAllAdminPayments)
   */
  async getAllPayments(params = {}) {
    return this.getAllAdminPayments(params);
  }

  /**
   * Save user to storage (for backward compatibility)
   */
  saveUserToStorage(user, token) {
    this.storeAuth(token, user);
  }
}

// ================================================================================================
// GLOBAL INSTANCE CREATION AND EXPORT
// ================================================================================================

/**
 * Create and configure global API service instance
 * This instance is automatically available throughout the application
 */
const apiServiceInstance = new ApiService();

// Make service globally available for easy access from any component
window.apiService = apiServiceInstance;

// Log successful initialization
console.log('✅ Church Financial Management API Service loaded successfully');
console.log('🔧 Service status:', apiServiceInstance.getServiceStatus());

// Export the service instance
export default apiServiceInstance;