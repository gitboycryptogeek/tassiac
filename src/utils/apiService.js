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
   * Sets up base configuration and auth service reference
   */
  constructor() {
    this.baseUrl = '/api'; // Vite proxy handles this in development
    this.authService = null; // Will be set by auth service
    
    // Request timeout configuration
    this.defaultTimeout = 30000; // 30 seconds
    this.uploadTimeout = 120000;  // 2 minutes for file uploads
    
    // Supported file types for uploads
    this.supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    this.supportedDocumentTypes = ['application/pdf'];
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    
    console.log('🚀 Church Financial API Service initialized');
  }

  /**
   * Set the authentication service reference
   * Called by auth service during initialization
   * 
   * @param {Object} authService - The authentication service instance
   */
  setAuthService(authService) {
    this.authService = authService;
    console.log('🔐 Auth service linked to API service');
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
    if (this.authService) {
      const token = this.authService.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
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
      
      console.error('🚨 API Error:', {
        message: error.message,
        code: error.code,
        status: error.status,
        details: error.details,
        endpoint: response.url
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
   * 
   * Response format:
   * {
   *   user: {
   *     id: number,
   *     username: string,
   *     fullName: string,
   *     email: string,
   *     phone: string,
   *     isAdmin: boolean,
   *     isActive: boolean,
   *     lastLogin: string (ISO date),
   *     createdAt: string (ISO date)
   *   },
   *   token: string (JWT token)
   * }
   * 
   * @throws {Error} Invalid credentials, inactive account, or server error
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
      headers: this.getHeaders(),
      body: JSON.stringify({ username, password: pwd }),
      credentials: 'include',
    });
    
    const data = await this.handleResponse(response);
    
    // Save authentication data if successful
    if (this.authService && data && data.user && data.token) {
      this.authService.saveUserToStorage(data.user, data.token);
      console.log('✅ Login successful for user:', data.user.fullName);
    }
    
    return data;
  }

  /**
   * User logout
   * Clears local storage and redirects to login page
   * 
   * @returns {void}
   */
  logout() {
    console.log('👋 Logging out user');
    
    if (this.authService) {
      return this.authService.logout();
    }
    
    // Fallback logout if auth service not available
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  /**
   * Get current user's profile information
   * 
   * @returns {Promise<Object>} Current user's profile data
   * 
   * Response format:
   * {
   *   user: {
   *     id: number,
   *     username: string,
   *     fullName: string,
   *     email: string,
   *     phone: string,
   *     isAdmin: boolean,
   *     role: string,
   *     lastLogin: string (ISO date),
   *     isActive: boolean,
   *     createdAt: string (ISO date),
   *     updatedAt: string (ISO date)
   *   }
   * }
   * 
   * @throws {Error} Authentication required or user not found
   */
  async getUserProfile() {
    console.log('👤 Fetching user profile');
    return this.get('/auth/profile');
  }

  /**
   * Change current user's password
   * Requires current password for security validation
   * 
   * @param {string} currentPassword - User's current password
   * @param {string} newPassword - New password (min 8 chars, must contain number and uppercase)
   * @returns {Promise<Object>} Success confirmation
   * 
   * Password requirements:
   * - Minimum 8 characters
   * - Must contain at least one number
   * - Must contain at least one uppercase letter
   * - Must be different from current password
   * 
   * @throws {Error} Invalid current password, weak new password, or server error
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
   * Returns complete user list with profile information
   * 
   * @returns {Promise<Array>} Array of all users
   * 
   * Response format:
   * {
   *   users: [
   *     {
   *       id: number,
   *       username: string,
   *       fullName: string,
   *       email: string,
   *       phone: string,
   *       isAdmin: boolean,
   *       role: string,
   *       lastLogin: string (ISO date),
   *       isActive: boolean,
   *       createdAt: string (ISO date),
   *       updatedAt: string (ISO date)
   *     }
   *   ]
   * }
   * 
   * @throws {Error} Admin access required
   */
  async getAllUsers() {
    console.log('👥 Fetching all users (Admin)');
    return this.get('/auth/users');
  }

  /**
   * Register a new user (Admin only)
   * Creates new user account with specified permissions
   * 
   * @param {Object} userData - New user information
   * @param {string} userData.username - Unique username (min 3 chars, alphanumeric + underscore/hyphen)
   * @param {string} userData.password - Password (min 8 chars, number + uppercase required)
   * @param {string} userData.fullName - User's full name
   * @param {string} userData.phone - Mobile phone number
   * @param {string} [userData.email] - Email address (optional)
   * @param {boolean} [userData.isAdmin=false] - Admin privileges flag
   * @param {string} [userData.role] - User role designation
   * @returns {Promise<Object>} Created user data (without password)
   * 
   * @throws {Error} Validation errors, duplicate username/email/phone, or admin limit reached
   */
  async registerUser(userData) {
    console.log('➕ Registering new user:', userData.username);
    return this.post('/auth/register', userData);
  }

  /**
   * Update existing user information (Admin only)
   * 
   * @param {number} userId - Target user ID
   * @param {Object} userData - Updated user information
   * @param {string} [userData.fullName] - Updated full name
   * @param {string} [userData.phone] - Updated phone number
   * @param {string} [userData.email] - Updated email address
   * @param {boolean} [userData.isAdmin] - Updated admin status
   * @param {boolean} [userData.isActive] - Updated active status
   * @param {string} [userData.role] - Updated role designation
   * @returns {Promise<Object>} Updated user data
   * 
   * Restrictions:
   * - Cannot demote last admin
   * - Cannot self-deactivate
   * - Cannot self-demote if last admin
   * 
   * @throws {Error} User not found, invalid permissions, or validation errors
   */
  async updateUser(userId, userData) {
    console.log('✏️ Updating user:', userId);
    return this.put(`/auth/users/${userId}`, userData);
  }

  /**
   * Delete/deactivate user account (Admin only)
   * Performs soft delete by deactivating account and mangling identifiers
   * 
   * @param {number} userId - Target user ID to delete
   * @returns {Promise<Object>} Deletion confirmation
   * 
   * Restrictions:
   * - Cannot delete self
   * - Cannot delete last active admin
   * - Preserves data integrity by soft deletion
   * 
   * @throws {Error} User not found, cannot delete self/last admin, or server error
   */
  async deleteUser(userId) {
    console.log('🗑️ Deleting user:', userId);
    return this.delete(`/auth/users/${userId}`);
  }

  /**
   * Reset user password (Admin only)
   * Allows admin to set new password for any user
   * 
   * @param {number} userId - Target user ID
   * @param {string} newPassword - New password to set
   * @returns {Promise<Object>} Password reset confirmation
   * 
   * Note: Admins should use changePassword() for their own accounts
   * 
   * @throws {Error} User not found, invalid password format, or admin access required
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
   * 
   * @param {number|null} [userId=null] - Specific user ID (admin only), null for current user
   * @param {Object} [params={}] - Query parameters for filtering
   * @param {number} [params.page=1] - Page number for pagination
   * @param {number} [params.limit=10] - Items per page
   * @param {string} [params.startDate] - Filter from date (ISO format)
   * @param {string} [params.endDate] - Filter to date (ISO format)
   * @param {string} [params.paymentType] - Filter by payment type (TITHE, OFFERING, etc.)
   * @param {string} [params.status] - Filter by status (PENDING, COMPLETED, FAILED)
   * @param {string} [params.search] - Search in descriptions, references, amounts
   * @returns {Promise<Object>} Paginated payment data
   * 
   * Response format:
   * {
   *   payments: [
   *     {
   *       id: number,
   *       amount: number,
   *       paymentType: string,
   *       paymentMethod: string,
   *       description: string,
   *       status: string,
   *       paymentDate: string (ISO date),
   *       receiptNumber: string,
   *       reference: string,
   *       isExpense: boolean,
   *       titheDistributionSDA: object,
   *       specialOffering: object (if applicable)
   *     }
   *   ],
   *   totalPages: number,
   *   currentPage: number,
   *   totalPayments: number
   * }
   */
  async getUserPayments(userId = null, params = {}) {
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    console.log('💰 Fetching payments for user:', userId || 'current user');
    return this.get(endpoint, params);
  }

  /**
   * Check payment status by payment ID
   * 
   * @param {number} paymentId - Payment ID to check
   * @returns {Promise<Object>} Payment status information
   * 
   * Response format:
   * {
   *   id: number,
   *   status: string (PENDING, COMPLETED, FAILED, CANCELLED),
   *   amount: number,
   *   paymentType: string,
   *   paymentMethod: string,
   *   description: string,
   *   paymentDate: string (ISO date),
   *   reference: string,
   *   transactionId: string,
   *   receiptNumber: string
   * }
   */
  async getPaymentStatus(paymentId) {
    console.log('🔍 Checking payment status:', paymentId);
    return this.get(`/payment/status/${paymentId}`);
  }

  /**
   * Initiate a new payment (KCB or M-Pesa)
   * KCB is the primary payment method, M-Pesa is backup
   * 
   * @param {Object} paymentData - Payment information
   * @param {number} paymentData.amount - Payment amount (must be positive)
   * @param {string} paymentData.paymentType - Payment type: TITHE, OFFERING, DONATION, SPECIAL
   * @param {string} paymentData.phoneNumber - Mobile number for payment (Kenyan format)
   * @param {string} [paymentData.paymentMethod='KCB'] - Payment method: KCB (recommended) or MPESA
   * @param {string} [paymentData.description] - Payment description
   * @param {number} [paymentData.specialOfferingId] - Required if paymentType is SPECIAL
   * @param {Object} [paymentData.titheDistributionSDA] - Required if paymentType is TITHE
   * @param {boolean} [paymentData.titheDistributionSDA.campMeetingExpenses] - SDA category
   * @param {boolean} [paymentData.titheDistributionSDA.welfare] - SDA category
   * @param {boolean} [paymentData.titheDistributionSDA.thanksgiving] - SDA category
   * @param {boolean} [paymentData.titheDistributionSDA.stationFund] - SDA category
   * @param {boolean} [paymentData.titheDistributionSDA.mediaMinistry] - SDA category
   * @returns {Promise<Object>} Payment initiation response
   * 
   * Response format:
   * {
   *   paymentId: number,
   *   checkoutRequestId: string (for tracking),
   *   paymentMethod: string,
   *   message: string (instructions for user)
   * }
   * 
   * Usage example:
   * ```javascript
   * await apiService.initiatePayment({
   *   amount: 1000,
   *   paymentType: 'TITHE',
   *   phoneNumber: '0712345678',
   *   paymentMethod: 'KCB',
   *   titheDistributionSDA: {
   *     welfare: true,
   *     stationFund: true
   *   }
   * });
   * ```
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
   * Legacy method for backward compatibility
   * 
   * @param {Object} paymentData - Payment data (same format as initiatePayment)
   * @returns {Promise<Object>} M-Pesa payment initiation response
   */
  async initiateMpesaPayment(paymentData) {
    console.log('📱 Initiating M-Pesa payment:', paymentData.amount);
    return this.post('/payment/initiate-mpesa', this.preparePaymentData(paymentData));
  }

  /**
   * Initiate KCB payment specifically
   * Recommended payment method for better user experience
   * 
   * @param {Object} paymentData - Payment data (same format as initiatePayment)
   * @returns {Promise<Object>} KCB payment initiation response
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
   * Comprehensive payment management interface for administrators
   * 
   * @param {Object} [params={}] - Query parameters for filtering
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=20] - Items per page (max 100)
   * @param {string} [params.startDate] - Filter from date (ISO format)
   * @param {string} [params.endDate] - Filter to date (ISO format)
   * @param {string} [params.paymentType] - Filter by type (TITHE, OFFERING, etc.)
   * @param {number} [params.userId] - Filter by specific user
   * @param {string} [params.department] - Filter by department (for expenses)
   * @param {string} [params.status] - Filter by status
   * @param {string} [params.search] - Search across multiple fields
   * @param {number} [params.specialOfferingId] - Filter by special offering
   * @param {string} [params.titheCategory] - Filter by tithe category
   * @returns {Promise<Object>} Comprehensive payment data with user information
   * 
   * Response includes user details, special offering info, processor info, etc.
   */
  async getAllAdminPayments(params = {}) {
    console.log('📊 Fetching all payments (Admin)');
    return this.get('/payment/all', params);
  }

  /**
   * Get payment statistics and analytics (Admin only)
   * 
   * @returns {Promise<Object>} Comprehensive payment statistics
   * 
   * Response format:
   * {
   *   revenue: number,
   *   expenses: number,
   *   netBalance: number,
   *   platformFees: number,
   *   monthlyData: [
   *     {
   *       month: string,
   *       revenue: number,
   *       expenses: number,
   *       net: number
   *     }
   *   ],
   *   paymentsByType: [
   *     {
   *       type: string,
   *       total: number
   *     }
   *   ],
   *   expensesByDepartment: [
   *     {
   *       department: string,
   *       total: number
   *     }
   *   ],
   *   pendingInquiries: number
   * }
   */
  async getPaymentStats() {
    console.log('📈 Fetching payment statistics');
    return this.get('/payment/stats');
  }

  /**
   * Add manual payment entry (Admin only)
   * For cash payments, bank transfers, or other offline transactions
   * 
   * @param {Object} paymentData - Manual payment information
   * @param {number} paymentData.userId - User ID receiving the payment
   * @param {number} paymentData.amount - Payment amount
   * @param {string} paymentData.paymentType - Payment type or special offering ID
   * @param {string} [paymentData.description] - Payment description
   * @param {string} [paymentData.paymentDate] - Payment date (ISO format, defaults to now)
   * @param {string} [paymentData.paymentMethod='MANUAL'] - Payment method
   * @param {boolean} [paymentData.isExpense=false] - Whether this is an expense
   * @param {string} [paymentData.department] - Required if isExpense is true
   * @param {string} [paymentData.reference] - External reference number
   * @param {Object} [paymentData.titheDistributionSDA] - Tithe distribution (if TITHE)
   * @param {number} [paymentData.specialOfferingId] - Special offering ID (if applicable)
   * @returns {Promise<Object>} Created payment with receipt information
   * 
   * Note: Receipt is automatically generated for completed payments
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
   * For expenses that require receipt documentation
   * 
   * @param {Object} paymentData - Payment data (same as addManualPayment)
   * @param {File} receiptFile - Receipt image/PDF file (max 5MB, JPEG/PNG/PDF)
   * @returns {Promise<Object>} Created payment with receipt information
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
   * 
   * @param {number} paymentId - Payment ID to update
   * @param {string} status - New status (PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED)
   * @returns {Promise<Object>} Updated payment information
   */
  async updatePaymentStatus(paymentId, status) {
    console.log('🔄 Updating payment status:', paymentId, 'to', status);
    return this.put(`/payment/${paymentId}/status`, { status });
  }

  /**
   * Delete payment record (Admin only)
   * Permanently removes payment and associated receipts
   * Use with extreme caution - consider updating status instead
   * 
   * @param {number} paymentId - Payment ID to delete
   * @returns {Promise<Object>} Deletion confirmation
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
   * Allows processing multiple payments simultaneously through KCB
   * 
   * @param {Object} batchData - Batch payment information
   * @param {Array} batchData.payments - Array of payment objects
   * @param {number} batchData.payments[].userId - User ID for payment
   * @param {number} batchData.payments[].amount - Payment amount
   * @param {string} batchData.payments[].paymentType - Payment type or special offering ID
   * @param {string} [batchData.payments[].description] - Payment description
   * @param {string} [batchData.payments[].paymentDate] - Payment date
   * @param {boolean} [batchData.payments[].isExpense] - Expense flag
   * @param {string} [batchData.payments[].department] - Department (for expenses)
   * @param {Object} [batchData.payments[].titheDistributionSDA] - Tithe distribution
   * @param {string} [batchData.description] - Batch description
   * @returns {Promise<Object>} Created batch payment information
   * 
   * Usage example:
   * ```javascript
   * await apiService.createBatchPayment({
   *   payments: [
   *     { userId: 1, amount: 1000, paymentType: 'TITHE' },
   *     { userId: 2, amount: 500, paymentType: 'OFFERING' }
   *   ],
   *   description: 'Sunday collection batch'
   * });
   * ```
   */
  async createBatchPayment(batchData) {
    console.log('📦 Creating batch payment with', batchData.payments?.length, 'payments');
    return this.post('/batch-payments', batchData);
  }

  /**
   * Get all batch payments with filtering
   * 
   * @param {Object} [params={}] - Query parameters
   * @param {string} [params.status] - Filter by status (PENDING, DEPOSITED, COMPLETED, CANCELLED)
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=20] - Items per page
   * @returns {Promise<Object>} Paginated batch payment data
   */
  async getAllBatchPayments(params = {}) {
    console.log('📦 Fetching batch payments');
    return this.get('/batch-payments', params);
  }

  /**
   * Get detailed information for specific batch payment
   * 
   * @param {number} batchId - Batch payment ID
   * @returns {Promise<Object>} Detailed batch payment with individual payments
   */
  async getBatchPaymentDetails(batchId) {
    console.log('🔍 Fetching batch payment details:', batchId);
    return this.get(`/batch-payments/${batchId}`);
  }

  /**
   * Process batch deposit via KCB
   * Initiates bank deposit for the entire batch amount
   * 
   * @param {number} batchId - Batch payment ID
   * @param {Object} depositData - Deposit information
   * @param {string} depositData.phoneNumber - Phone number for KCB notification
   * @param {string} [depositData.depositDescription] - Deposit description
   * @returns {Promise<Object>} KCB deposit initiation response
   */
  async processBatchDeposit(batchId, depositData) {
    console.log('🏦 Processing batch deposit:', batchId);
    return this.post(`/batch-payments/${batchId}/deposit`, depositData);
  }

  /**
   * Complete batch payment processing
   * Called after successful KCB callback to finalize all payments
   * 
   * @param {number} batchId - Batch payment ID
   * @param {Object} [completionData={}] - Completion data
   * @param {string} [completionData.kcbTransactionId] - KCB transaction ID
   * @param {string} [completionData.kcbReceiptNumber] - KCB receipt number
   * @returns {Promise<Object>} Completion confirmation with receipt generation status
   */
  async completeBatchPayment(batchId, completionData = {}) {
    console.log('✅ Completing batch payment:', batchId);
    return this.post(`/batch-payments/${batchId}/complete`, completionData);
  }

  /**
   * Cancel batch payment (only if not yet deposited)
   * 
   * @param {number} batchId - Batch payment ID
   * @param {string} [reason] - Cancellation reason
   * @returns {Promise<Object>} Cancellation confirmation
   */
  async cancelBatchPayment(batchId, reason = null) {
    console.log('❌ Cancelling batch payment:', batchId);
    return this.delete(`/batch-payments/${batchId}`, { reason });
  }

  /**
   * Create bulk payments for batch processing
   * Convenience method for creating multiple payments at once
   * 
   * @param {Array} paymentsArray - Array of payment objects
   * @param {string} [description] - Batch description
   * @returns {Promise<Object>} Created batch payment
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
   * Creates default wallets for different payment types and SDA categories
   * 
   * @returns {Promise<Object>} Initialization result with created wallets count
   */
  async initializeWallets() {
    console.log('🏦 Initializing wallet system');
    return this.post('/wallets/initialize');
  }

  /**
   * Get all wallets with current balances
   * 
   * @returns {Promise<Object>} Organized wallet data by type
   * 
   * Response format:
   * {
   *   wallets: {
   *     TITHE: [wallet objects],
   *     OFFERING: [wallet objects],
   *     DONATION: [wallet objects],
   *     SPECIAL_OFFERING: [wallet objects]
   *   },
   *   summary: {
   *     totalBalance: number,
   *     totalDeposits: number,
   *     totalWithdrawals: number,
   *     walletsCount: number
   *   }
   * }
   */
  async getAllWallets() {
    console.log('💰 Fetching all wallets');
    return this.get('/wallets');
  }

  /**
   * Update wallet balances from completed payments
   * Processes completed payments and distributes amounts to appropriate wallets
   * 
   * @param {Array<number>} paymentIds - Array of payment IDs to process
   * @returns {Promise<Object>} Update results with affected wallets
   */
  async updateWalletBalances(paymentIds) {
    console.log('⚖️ Updating wallet balances for', paymentIds.length, 'payments');
    return this.post('/wallets/update-balances', { paymentIds });
  }

  /**
   * Create withdrawal request from wallet
   * Initiates multi-admin approval process for fund withdrawals
   * 
   * @param {Object} withdrawalData - Withdrawal request information
   * @param {number} withdrawalData.walletId - Source wallet ID
   * @param {number} withdrawalData.amount - Withdrawal amount
   * @param {string} withdrawalData.purpose - Purpose/reason for withdrawal (5-100 chars)
   * @param {string} [withdrawalData.description] - Additional description
   * @param {string} withdrawalData.withdrawalMethod - Method: BANK_TRANSFER, MPESA, CASH
   * @param {string} [withdrawalData.destinationAccount] - Required for BANK_TRANSFER
   * @param {string} [withdrawalData.destinationPhone] - Required for MPESA
   * @returns {Promise<Object>} Created withdrawal request
   * 
   * Note: Requires multiple admin approvals before processing
   */
  async createWithdrawalRequest(withdrawalData) {
    console.log('💸 Creating withdrawal request:', withdrawalData.amount);
    return this.post('/wallets/withdraw', withdrawalData);
  }

  /**
   * Get withdrawal requests with filtering
   * 
   * @param {Object} [params={}] - Query parameters
   * @param {string} [params.status] - Filter by status (PENDING, APPROVED, REJECTED, COMPLETED)
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=20] - Items per page
   * @returns {Promise<Object>} Paginated withdrawal requests with approval status
   */
  async getWithdrawalRequests(params = {}) {
    console.log('📋 Fetching withdrawal requests');
    return this.get('/wallets/withdrawals', params);
  }

  /**
   * Approve withdrawal request (Admin only)
   * Part of multi-admin approval process for withdrawals
   * 
   * @param {number} withdrawalId - Withdrawal request ID
   * @param {Object} approvalData - Approval information
   * @param {string} approvalData.password - Admin approval password
   * @param {string} [approvalData.approvalMethod='PASSWORD'] - Approval method
   * @param {string} [approvalData.comment] - Approval comment
   * @returns {Promise<Object>} Approval result and processing status
   * 
   * Note: Once all required approvals are obtained, withdrawal is automatically processed
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
   * 
   * @returns {Promise<Object>} Account balance information
   * 
   * Response format:
   * {
   *   balance: {
   *     availableBalance: number,
   *     actualBalance: number,
   *     currency: string
   *   },
   *   lastChecked: string (ISO date)
   * }
   */
  async getKcbAccountBalance() {
    console.log('🏦 Fetching KCB account balance');
    return this.get('/kcb-sync/balance');
  }

  /**
   * Get KCB transaction history
   * 
   * @param {Object} [params={}] - Query parameters
   * @param {string} [params.startDate] - Start date (ISO format)
   * @param {string} [params.endDate] - End date (ISO format)
   * @param {number} [params.pageSize=50] - Transactions per page (max 200)
   * @param {number} [params.pageNumber=1] - Page number
   * @returns {Promise<Object>} KCB transaction history with pagination
   */
  async getKcbTransactionHistory(params = {}) {
    console.log('📊 Fetching KCB transaction history');
    return this.get('/kcb-sync/transactions', params);
  }

  /**
   * Sync KCB transactions with local database
   * Downloads and processes KCB transactions for reconciliation
   * 
   * @param {Object} [syncData={}] - Sync parameters
   * @param {string} [syncData.startDate] - Sync from date (defaults to last 7 days)
   * @param {string} [syncData.endDate] - Sync to date (defaults to today)
   * @param {boolean} [syncData.forceSync=false] - Force re-sync existing transactions
   * @returns {Promise<Object>} Sync results with statistics
   * 
   * Response format:
   * {
   *   syncResults: {
   *     new: number,
   *     linkedToPayments: number,
   *     errors: number
   *   },
   *   dateRange: {
   *     startDate: string,
   *     endDate: string
   *   }
   * }
   */
  async syncKcbTransactions(syncData = {}) {
    console.log('🔄 Syncing KCB transactions');
    return this.post('/kcb-sync/sync', syncData);
  }

  /**
   * Get unlinked KCB transactions
   * Shows KCB transactions that haven't been matched to payments
   * 
   * @param {Object} [params={}] - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=20] - Items per page
   * @param {string} [params.transactionType] - Filter by type (CREDIT, DEBIT, ALL)
   * @returns {Promise<Object>} Unlinked transactions requiring manual review
   */
  async getUnlinkedKcbTransactions(params = {}) {
    console.log('🔗 Fetching unlinked KCB transactions');
    return this.get('/kcb-sync/unlinked', params);
  }

  /**
   * Manually link KCB transaction to payment
   * Resolves unlinked transactions by connecting them to specific payments
   * 
   * @param {number} kcbSyncId - KCB sync record ID
   * @param {number} paymentId - Payment record ID to link
   * @returns {Promise<Object>} Link confirmation
   * 
   * Note: Validates amount matching between KCB transaction and payment
   */
  async linkKcbTransaction(kcbSyncId, paymentId) {
    console.log('🔗 Linking KCB transaction:', kcbSyncId, 'to payment:', paymentId);
    return this.post('/kcb-sync/link', { kcbSyncId, paymentId });
  }

  /**
   * Mark KCB transaction as ignored
   * For transactions that don't need to be linked (bank fees, etc.)
   * 
   * @param {number} kcbSyncId - KCB sync record ID
   * @param {string} [reason] - Reason for ignoring transaction
   * @returns {Promise<Object>} Ignore confirmation
   */
  async ignoreKcbTransaction(kcbSyncId, reason = null) {
    console.log('🚫 Ignoring KCB transaction:', kcbSyncId);
    return this.put(`/kcb-sync/ignore/${kcbSyncId}`, { reason });
  }

  /**
   * Get KCB synchronization statistics
   * 
   * @returns {Promise<Object>} Comprehensive sync statistics
   * 
   * Response format:
   * {
   *   statistics: {
   *     totalRecords: number,
   *     linked: number,
   *     unlinked: number,
   *     ignored: number,
   *     linkageRate: string (percentage),
   *     totals: {
   *       linkedCredits: number,
   *       linkedDebits: number,
   *       netLinked: number
   *     },
   *     recentActivity: [recent sync records]
   *   }
   * }
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
   * 
   * @param {number|null} [userId=null] - Specific user ID (admin only), null for current user
   * @param {Object} [params={}] - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=10] - Items per page
   * @param {string} [params.startDate] - Filter from date
   * @param {string} [params.endDate] - Filter to date
   * @param {string} [params.search] - Search in receipt numbers, descriptions
   * @returns {Promise<Object>} Paginated receipt data with payment information
   */
  async getUserReceipts(userId = null, params = {}) {
    const endpoint = userId ? `/receipt/user/${userId}` : '/receipt/user';
    console.log('🧾 Fetching receipts for user:', userId || 'current user');
    return this.get(endpoint, params);
  }

  /**
   * Get specific receipt by ID
   * 
   * @param {number} receiptId - Receipt ID
   * @returns {Promise<Object>} Detailed receipt information with payment data
   */
  async getReceiptById(receiptId) {
    console.log('🔍 Fetching receipt:', receiptId);
    return this.get(`/receipt/${receiptId}`);
  }

  /**
   * Download receipt as PDF
   * Generates and downloads PDF receipt for the specified receipt
   * 
   * @param {number} receiptId - Receipt ID
   * @returns {Promise<Object>} Download initiation confirmation
   * 
   * Note: PDF is generated on-demand and includes church letterhead,
   * payment details, tithe distributions, and official formatting
   */
  async downloadReceipt(receiptId) {
    console.log('📄 Downloading receipt PDF:', receiptId);
    return this.downloadFile(`/receipt/${receiptId}/pdf`, `receipt-${receiptId}.pdf`);
  }

  /**
   * Upload attachment to receipt
   * Attach supporting documents to receipts (admin function)
   * 
   * @param {number} receiptId - Receipt ID
   * @param {FormData} formData - Form data containing attachment file
   * @returns {Promise<Object>} Upload confirmation with attachment path
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
   * 
   * @param {Object} [params={ activeOnly: 'true' }] - Query parameters
   * @param {string} [params.activeOnly='true'] - Show only active offerings
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=10] - Items per page
   * @param {string} [params.search] - Search in names, codes, descriptions
   * @returns {Promise<Object>} Paginated special offerings with progress information
   * 
   * Response includes current contribution amounts and progress percentages
   */
  async getSpecialOfferings(params = { activeOnly: 'true' }) {
    console.log('🎯 Fetching special offerings');
    return this.get('/special-offerings', params);
  }

  /**
   * Create new special offering (Admin only)
   * 
   * @param {Object} offeringData - Special offering information
   * @param {string} offeringData.name - Offering name (3-100 chars)
   * @param {string} [offeringData.description] - Offering description
   * @param {number} [offeringData.targetAmount] - Target amount (optional)
   * @param {string} [offeringData.startDate] - Start date (ISO format, defaults to now)
   * @param {string} [offeringData.endDate] - End date (ISO format, optional)
   * @param {boolean} [offeringData.isActive=true] - Active status
   * @param {Object} [offeringData.customFields] - Additional custom data
   * @returns {Promise<Object>} Created special offering with auto-generated code
   * 
   * Note: Offering code is automatically generated in format SO-XXXX
   */
  async createSpecialOffering(offeringData) {
    console.log('➕ Creating special offering:', offeringData.name);
    return this.post('/special-offerings', offeringData);
  }

  /**
   * Get specific special offering details
   * 
   * @param {number|string} identifier - Offering ID or offering code
   * @returns {Promise<Object>} Detailed offering information with contribution progress
   */
  async getSpecialOfferingDetails(identifier) {
    console.log('🔍 Fetching special offering:', identifier);
    return this.get(`/special-offerings/${identifier}`);
  }

  /**
   * Get special offering contribution progress
   * 
   * @param {number|string} identifier - Offering ID or offering code
   * @returns {Promise<Object>} Progress information
   * 
   * Response format:
   * {
   *   progress: {
   *     offeringId: number,
   *     offeringCode: string,
   *     name: string,
   *     targetGoal: number,
   *     totalContributed: number,
   *     percentage: number,
   *     remainingAmount: number
   *   }
   * }
   */
  async getSpecialOfferingProgress(identifier) {
    console.log('📊 Fetching offering progress:', identifier);
    return this.get(`/special-offerings/${identifier}/progress`);
  }

  /**
   * Update special offering (Admin only)
   * 
   * @param {number|string} identifier - Offering ID or offering code
   * @param {Object} updateData - Fields to update (same format as createSpecialOffering)
   * @returns {Promise<Object>} Updated offering information
   */
  async updateSpecialOffering(identifier, updateData) {
    console.log('✏️ Updating special offering:', identifier);
    return this.put(`/special-offerings/${identifier}`, updateData);
  }

  /**
   * Delete special offering (Admin only)
   * If offering has contributions, it will be deactivated instead of deleted
   * 
   * @param {number|string} identifier - Offering ID or offering code
   * @returns {Promise<Object>} Deletion/deactivation confirmation
   */
  async deleteSpecialOffering(identifier) {
    console.log('🗑️ Deleting special offering:', identifier);
    return this.delete(`/special-offerings/${identifier}`);
  }

  /**
   * Make contribution to special offering
   * 
   * @param {number|string} identifier - Offering ID or offering code
   * @param {Object} paymentData - Contribution information
   * @param {number} paymentData.amount - Contribution amount
   * @param {string} [paymentData.description] - Contribution description
   * @param {string} [paymentData.paymentMethod='MPESA'] - Payment method (MPESA or MANUAL)
   * @param {string} [paymentData.phoneNumber] - Phone number (required for MPESA)
   * @returns {Promise<Object>} Payment initiation response
   * 
   * Note: MANUAL method is admin-only for cash/check contributions
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
   * Public method for submitting contact inquiries
   * 
   * @param {Object} formData - Contact form information
   * @param {string} formData.name - Full name (2-100 chars)
   * @param {string} formData.email - Email address
   * @param {string} [formData.phone] - Phone number (optional, 10-15 chars)
   * @param {string} formData.subject - Inquiry subject (3-150 chars)
   * @param {string} formData.message - Inquiry message (10-2000 chars)
   * @returns {Promise<Object>} Submission confirmation
   */
  async submitContactForm(formData) {
    console.log('📧 Submitting contact form from:', formData.name);
    return this.post('/contact/submit', formData);
  }

  /**
   * Get church contact information
   * 
   * @returns {Promise<Object>} Church contact details
   * 
   * Response format:
   * {
   *   email: string,
   *   phone: string,
   *   address: string,
   *   socialMedia: {
   *     facebook: string,
   *     twitter: string
   *   },
   *   serviceHours: string
   * }
   */
  async getContactInfo() {
    console.log('📞 Fetching church contact info');
    return this.get('/contact/info');
  }

  // Admin contact inquiry methods

  /**
   * Get all contact inquiries (Admin only)
   * 
   * @param {Object} [params={}] - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=15] - Items per page
   * @param {string} [params.status] - Filter by status (PENDING, VIEWED, RESOLVED, ARCHIVED, SPAM)
   * @param {string} [params.search] - Search in names, emails, subjects, messages
   * @returns {Promise<Object>} Paginated inquiry data with user information
   */
  async getAllInquiries(params = {}) {
    console.log('📋 Fetching all inquiries (Admin)');
    return this.get('/contact/inquiries', params);
  }

  /**
   * Get specific inquiry by ID (Admin only)
   * 
   * @param {number} inquiryId - Inquiry ID
   * @returns {Promise<Object>} Detailed inquiry information
   * 
   * Note: Viewing pending inquiry automatically changes status to VIEWED
   */
  async getInquiryById(inquiryId) {
    console.log('🔍 Fetching inquiry:', inquiryId);
    return this.get(`/contact/inquiries/${inquiryId}`);
  }

  /**
   * Update inquiry status (Admin only)
   * 
   * @param {number} inquiryId - Inquiry ID
   * @param {string} status - New status (PENDING, VIEWED, RESOLVED, ARCHIVED, SPAM)
   * @param {string} [resolutionNotes] - Resolution notes (optional)
   * @returns {Promise<Object>} Updated inquiry information
   */
  async updateInquiryStatus(inquiryId, status, resolutionNotes = null) {
    console.log('🔄 Updating inquiry status:', inquiryId, 'to', status);
    const data = { status };
    if (resolutionNotes) data.resolutionNotes = resolutionNotes;
    return this.put(`/contact/inquiries/${inquiryId}/status`, data);
  }

  /**
   * Archive inquiry (Admin only)
   * Soft delete by changing status to ARCHIVED
   * 
   * @param {number} inquiryId - Inquiry ID to archive
   * @returns {Promise<Object>} Archive confirmation
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
   * 
   * @returns {Promise<Object>} Complete dashboard data
   * 
   * Response format:
   * {
   *   userStats: {
   *     total: number,
   *     adminCount: number,
   *     activeLast30Days: number
   *   },
   *   paymentStats: {
   *     revenue: number,
   *     expenses: number,
   *     netBalance: number,
   *     platformFees: number
   *   },
   *   monthlyFinancialSummary: [
   *     {
   *       month: string,
   *       revenue: number,
   *       expenses: number,
   *       net: number
   *     }
   *   ],
   *   paymentsByType: [
   *     {
   *       type: string,
   *       total: number
   *     }
   *   ],
   *   expensesByDepartment: [
   *     {
   *       department: string,
   *       total: number
   *     }
   *   ],
   *   pendingInquiries: number
   * }
   */
  async getDashboardStats() {
    console.log('📊 Fetching dashboard statistics');
    return this.get('/admin/dashboard-stats');
  }

  /**
   * Get recent admin activity log
   * 
   * @param {Object} [params={}] - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=20] - Items per page (max 100)
   * @returns {Promise<Object>} Paginated admin activity log
   */
  async getRecentActivity(params = {}) {
    console.log('📝 Fetching recent admin activity');
    return this.get('/admin/activity', params);
  }

  /**
   * Generate system reports (Admin only)
   * Creates PDF or CSV reports for various data types
   * 
   * @param {Object} reportParams - Report parameters
   * @param {string} reportParams.reportType - Report type (REVENUE, EXPENSES, USERS, COMPREHENSIVE)
   * @param {string} reportParams.startDate - Start date (ISO format)
   * @param {string} reportParams.endDate - End date (ISO format)
   * @param {string} [reportParams.format='pdf'] - Report format (pdf, csv)
   * @returns {Promise<Object>} Report generation confirmation with file path
   * 
   * Report types:
   * - REVENUE: Income analysis with breakdowns
   * - EXPENSES: Expense analysis by department
   * - USERS: User management report
   * - COMPREHENSIVE: Complete financial overview
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
   * 
   * @param {string} endpoint - API endpoint (without /api prefix)
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<any>} Response data
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
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });
    
    return this.handleResponse(response);
  }

  /**
   * Generic POST request handler
   * 
   * @param {string} endpoint - API endpoint (without /api prefix)
   * @param {Object} [data={}] - Request body data
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, data = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    
    return this.handleResponse(response);
  }

  /**
   * Generic PUT request handler
   * 
   * @param {string} endpoint - API endpoint (without /api prefix)
   * @param {Object} [data={}] - Request body data
   * @returns {Promise<any>} Response data
   */
  async put(endpoint, data = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    
    return this.handleResponse(response);
  }

  /**
   * Generic DELETE request handler
   * 
   * @param {string} endpoint - API endpoint (without /api prefix)
   * @param {Object} [data] - Optional request body data
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint, data = null) {
    const options = {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    return this.handleResponse(response);
  }

  /**
   * File upload handler
   * 
   * @param {string} endpoint - API endpoint (without /api prefix)
   * @param {FormData} formData - Form data containing files and other data
   * @returns {Promise<any>} Response data
   */
  async uploadFile(endpoint, formData) {
    const headers = this.getHeaders(true);
    delete headers['Content-Type']; // Let browser set Content-Type for FormData

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: formData,
      credentials: 'include',
    });
    
    return this.handleResponse(response);
  }

  /**
   * File upload with progress tracking
   * 
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data to upload
   * @param {Function} [onProgress] - Progress callback function (percentage)
   * @returns {Promise<any>} Upload response
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
   * 
   * @param {string} endpoint - API endpoint for file download
   * @param {string} filename - Suggested filename for download
   * @returns {Promise<Object>} Download confirmation
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
   * 
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} True if valid Kenyan format (254XXXXXXXXX)
   */
  validatePhoneNumber(phoneNumber) {
    const kenyanPhoneRegex = /^254\d{9}$/;
    return kenyanPhoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number to standard Kenya format
   * Handles various input formats and converts to 254XXXXXXXXX
   * 
   * @param {string} phoneNumber - Phone number in any format
   * @returns {string} Formatted phone number (254XXXXXXXXX)
   * 
   * Supported input formats:
   * - 0712345678 → 254712345678
   * - 712345678 → 254712345678
   * - +254712345678 → 254712345678
   * - 254712345678 → 254712345678 (already correct)
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
   * Validates and formats payment data before sending to backend
   * 
   * @param {Object} rawData - Raw payment data from form
   * @returns {Object} Cleaned and formatted payment data
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
   * Handles array conversion for custom field data
   * 
   * @param {Object} offeringData - Special offering data
   * @returns {Array|null} Formatted custom fields or null
   */
  formatCustomFields(offeringData) {
    if (Array.isArray(offeringData.customFields) && offeringData.customFields.length > 0) {
      return offeringData.customFields;
    }
    return null;
  }

  /**
   * Validate file for upload
   * Checks file type and size constraints
   * 
   * @param {File} file - File to validate
   * @param {Array<string>} [allowedTypes] - Allowed MIME types
   * @param {number} [maxSize] - Maximum file size in bytes
   * @returns {Object} Validation result
   * 
   * Response format:
   * {
   *   valid: boolean,
   *   error: string (if invalid)
   * }
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
   * 
   * @param {number} amount - Amount to format
   * @param {string} [currency='KES'] - Currency code
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount, currency = 'KES') {
    return `${currency} ${parseFloat(amount).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  /**
   * Format date for display
   * 
   * @param {string|Date} date - Date to format
   * @param {boolean} [includeTime=false] - Whether to include time
   * @returns {string} Formatted date string
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
   * Internal method for debugging and monitoring
   * 
   * @param {string} action - Action being performed
   * @param {Object} [details={}] - Additional details
   */
  logActivity(action, details = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 API Service: ${action}`, details);
    }
  }

  /**
   * Get API service status and configuration
   * Useful for debugging and health checks
   * 
   * @returns {Object} Service status information
   */
  getServiceStatus() {
    return {
      baseUrl: this.baseUrl,
      authenticated: !!this.authService?.getToken(),
      user: this.authService?.getCurrentUser(),
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

// Log initialization
console.log('✅ Church Financial Management API Service loaded successfully');
console.log('🔧 Service status:', apiServiceInstance.getServiceStatus());

// Export both the class and the instance for flexibility
export { ApiService };
export default apiServiceInstance;