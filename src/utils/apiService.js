export class ApiService {
  constructor() {
    this.baseUrl = '/api';
    
    this.token = null;
    this.user = null;
    
    this.defaultTimeout = 30000;
    this.uploadTimeout = 120000;
    this.downloadTimeout = 60000;
    
    this.supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    this.supportedDocumentTypes = ['application/pdf'];
    this.maxFileSize = 5 * 1024 * 1024;
    
    this.SUPPORTED_PAYMENT_METHODS = ['KCB', 'MPESA', 'MANUAL'];
    this.DEFAULT_PAYMENT_METHOD = 'KCB';
    this.SUPPORTED_PAYMENT_TYPES = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL', 'EXPENSE'];
    
    this.loadStoredAuth();
    
    console.log('🚀 Church Financial API Service initialized');
    console.log('🔧 Service configuration:', this.getServiceStatus());
  }

  loadStoredAuth() {
    try {
      let storedToken = localStorage.getItem('token') || localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');
      
      if (!storedToken) {
        storedToken = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
      }
      
      if (storedToken) {
        this.token = storedToken;
        console.log('✅ Auth token restored from storage:', this.token.substring(0, 20) + '...');
      } else {
        console.log('ℹ️ No authentication token found in storage');
      }
      
      if (storedUser) {
        this.user = JSON.parse(storedUser);
        console.log('✅ User profile restored from storage:', this.user.fullName || this.user.username);
      } else {
        console.log('ℹ️ No user profile found in storage');
      }
    } catch (error) {
      console.error('❌ Error loading stored authentication data:', error);
      this.clearAuth();
    }
  }

  storeAuth(token, user) {
    try {
      this.token = token;
      this.user = user;
      
      localStorage.setItem('token', token); 
      localStorage.setItem('user', JSON.stringify(user));
      
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
      
      console.log('✅ Authentication data stored successfully');
      console.log('👤 User:', user.fullName, '| Admin:', user.isAdmin, '| Role:', user.role);
    } catch (error) {
      console.error('❌ Error storing authentication data:', error);
    }
  }

  async addItemsToBatch(batchId, batchData) {
    console.log(`➕ Adding ${batchData.payments?.length || 0} items to existing batch ID:`, batchId);
    return this.post(`/batch-payments/${batchId}/add-items`, batchData);
  }

  clearAuth() {
    this.token = null;
    this.user = null;
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    
    console.log('🗑️ Authentication data cleared from storage');
  }

  isAuthenticated() {
    const authenticated = !!(this.token && this.user);
    console.log('🔍 Authentication status check:', authenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED');
    return authenticated;
  }

  isAdmin() {
    const admin = !!(this.user && this.user.isAdmin);
    console.log('👑 Admin privileges check:', admin ? 'ADMIN USER' : 'REGULAR USER');
    return admin;
  }

  getCurrentUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }

  getHeaders(isFormData = false) {
    const headers = {};
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log('🔑 Authorization header added to request');
    } else {
      console.warn('⚠️ No authentication token available for request');
    }
    
    return headers;
  }

  // Enhanced error handling for the handleResponse method
async handleResponse(response) {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  let responseData;

  try {
    responseData = isJson ? await response.json() : await response.text();
  } catch (parseError) {
    console.error('❌ Failed to parse API response:', parseError);
    throw new Error(response.ok ? 'Invalid JSON response from server.' : `Request failed with status ${response.status}: ${response.statusText}`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      console.warn('🔒 Received 401 Unauthorized - clearing authentication');
      this.clearAuth();
      
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/' && !currentPath.includes('login')) {
        console.log('🔄 Redirecting to login page due to authentication failure');
        if (window.router && typeof window.router.navigateTo === 'function') {
          window.router.navigateTo('/login');
        } else {
          window.location.hash = '#/login';
        }
      }
    }

    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode = `HTTP_ERROR_${response.status}`;
    let errorDetails = null;

    if (responseData && typeof responseData === 'object' && responseData.message) {
      errorMessage = responseData.message;
      if (responseData.error) {
        errorCode = responseData.error.code || errorCode;
        errorDetails = responseData.error.details || responseData.error;
      }
    } else if (typeof responseData === 'string' && responseData.length > 0 && responseData.length < 200) {
      errorMessage = responseData;
    }

    const error = new Error(errorMessage);
    error.code = errorCode;
    error.status = response.status;
    error.details = errorDetails;
    error.response = responseData;
    error.endpoint = response.url;
    
    console.error('🚨 API Request Failed:', {
      endpoint: error.endpoint,
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details
    });
    
    throw error;
  }

  // Handle different response formats
  if (responseData && typeof responseData === 'object') {
    // If response has success field, handle accordingly
    if (responseData.hasOwnProperty('success')) {
      if (responseData.success === true) {
        return responseData; // Return the full response object
      } else {
        const errorMessage = responseData.message || 'API operation reported failure.';
        const error = new Error(errorMessage);
        error.code = responseData.error?.code || 'OPERATION_FAILED';
        error.details = responseData.error?.details || null;
        error.response = responseData;
        
        console.error('⚠️ API Operation Failed:', {
          message: error.message,
          code: error.code,
          details: error.details
        });
        
        throw error;
      }
    }
    
    // If no success field, assume it's successful data
    return responseData;
  }

  return responseData;
}

  async login(usernameOrCredentials, password) {
    let username, pwd;
    
    if (typeof usernameOrCredentials === 'object' && usernameOrCredentials !== null) {
      username = String(usernameOrCredentials.username);
      pwd = String(usernameOrCredentials.password);
    } else {
      username = String(usernameOrCredentials);
      pwd = String(password);
    }

    console.log('🔐 Attempting authentication for user:', username);

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password: pwd }),
      credentials: 'include',
    });
    
    const data = await this.handleResponse(response);
    
    if (data && data.user && data.token) {
      this.storeAuth(data.token, data.user);
      console.log('✅ Authentication successful for user:', data.user.fullName);
      console.log('👤 User role:', data.user.isAdmin ? 'Administrator' : 'Regular User');
    }
    
    return data;
  }

  async logout() {
    console.log('👋 Initiating user logout process');
    
    try {
      if (this.token) {
        console.log('📡 Sending logout request to server');
        await this.get('/auth/logout');
        console.log('✅ Server logout successful');
      }
    } catch (error) {
      console.warn('⚠️ Server logout request failed:', error.message);
    } finally {
      console.log('🧹 Clearing local authentication data');
      this.clearAuth();
      
      console.log('🔄 Redirecting to login page');
      if (window.router && typeof window.router.navigateTo === 'function') {
        await window.router.navigateTo('/login');
      } else {
        window.location.hash = '#/login';
      }
    }
  }

  async getUserProfile() {
    console.log('👤 Fetching current user profile from server');
    return this.get('/auth/profile');
  }

  async changePassword(currentPassword, newPassword) {
    console.log('🔒 Initiating password change for current user');
    return this.post('/auth/change-password', { currentPassword, newPassword });
  }

  async getAllUsers() {
    console.log('👥 Fetching all system users (Admin operation)');
    return this.get('/auth/users');
  }

  async registerUser(userData) {
    console.log('➕ Registering new user:', userData.username);
    console.log('👤 User type:', userData.isAdmin ? 'Administrator' : 'Regular User');
    return this.post('/auth/register', userData);
  }

  async updateUser(userId, userData) {
    console.log('✏️ Updating user profile for user ID:', userId);
    console.log('📝 Update fields:', Object.keys(userData));
    return this.put(`/auth/users/${userId}`, userData);
  }

  async deleteUser(userId) {
    console.log('🗑️ Deleting user account with ID:', userId);
    console.warn('⚠️ This is a permanent deletion operation');
    return this.delete(`/auth/users/${userId}`);
  }

  async adminResetUserPassword(userId, newPassword) {
    console.log('🔐 Admin resetting password for user ID:', userId);
    console.log('⚠️ User will need to use new password on next login');
    return this.post(`/auth/reset-password/${userId}`, { newPassword });
  }

  async getUserPayments(userId = null, params = {}) {
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    console.log('💰 Fetching payment history for user:', userId || 'current user');
    console.log('🔍 Filter parameters:', params);
    return this.get(endpoint, params);
  }

  async getPaymentStatus(paymentId) {
    console.log('🔍 Checking payment status for payment ID:', paymentId);
    return this.get(`/payment/status/${paymentId}`);
  }

  async initiatePayment(paymentData) {
    const enhancedPaymentData = {
      paymentMethod: this.DEFAULT_PAYMENT_METHOD,
      ...paymentData
    };
    
    console.log('🚀 Initiating payment with gateway:', enhancedPaymentData.paymentMethod);
    console.log('💰 Payment details:', {
      amount: enhancedPaymentData.amount,
      type: enhancedPaymentData.paymentType,
      method: enhancedPaymentData.paymentMethod,
      phone: enhancedPaymentData.phoneNumber
    });
    
    return this.post('/payment/initiate', this.preparePaymentData(enhancedPaymentData));
  }

  async initiateMpesaPayment(paymentData) {
    console.log('📱 Initiating M-Pesa payment (legacy method)');
    console.log('💰 Amount:', paymentData.amount);
    return this.post('/payment/initiate-mpesa', this.preparePaymentData(paymentData));
  }

  async initiateKcbPayment(paymentData) {
    const kcbPaymentData = {
      ...paymentData,
      paymentMethod: 'KCB'
    };
    
    console.log('🏦 Initiating KCB payment');
    console.log('💰 Amount:', kcbPaymentData.amount);
    return this.post('/payment/initiate', this.preparePaymentData(kcbPaymentData));
  }

  async getAllAdminPayments(params = {}) {
    console.log('📊 Fetching all payments for admin review');
    console.log('🔍 Filter parameters:', params);
    return this.get('/payment/all', params);
  }

  async getPaymentStats() {
    console.log('📈 Fetching comprehensive payment statistics for admin dashboard');
    return this.get('/payment/stats');
  }

  async addManualPayment(paymentData) {
    console.log('✍️ Adding manual payment entry to system');
    console.log('💰 Payment details:', {
      amount: paymentData.amount,
      type: paymentData.paymentType,
      user: paymentData.userId,
      method: paymentData.paymentMethod || 'MANUAL'
    });
    return this.post('/payment/manual', paymentData);
  }

  async addManualPaymentWithReceipt(paymentData, receiptFile) {
    console.log('📄 Adding manual payment with receipt attachment');
    console.log('💰 Amount:', paymentData.amount);
    console.log('📎 File:', receiptFile ? receiptFile.name : 'No file');
    
    const formData = new FormData();
    
    Object.keys(paymentData).forEach(key => {
      if (paymentData[key] !== null && paymentData[key] !== undefined) {
        if (typeof paymentData[key] === 'object') {
          formData.append(key, JSON.stringify(paymentData[key]));
        } else {
          formData.append(key, paymentData[key]);
        }
      }
    });
    
    if (receiptFile) {
      formData.append('expenseReceiptImage', receiptFile);
    }
    
    return this.uploadFile('/payment/manual', formData);
  }

  async updatePaymentStatus(paymentId, status) {
    console.log('🔄 Updating payment status for payment ID:', paymentId);
    console.log('📋 New status:', status);
    return this.put(`/payment/${paymentId}/status`, { status });
  }

  async adminDeletePayment(paymentId) {
    console.log('🗑️ Deleting payment record with ID:', paymentId);
    console.warn('⚠️ This permanently removes payment data');
    return this.delete(`/payment/${paymentId}`);
  }

  async createBatchPayment(batchData) {
    console.log('📦 Creating batch payment for bulk processing');
    console.log('📊 Batch details:', {
      paymentCount: batchData.payments?.length || 0,
      description: batchData.description
    });
    return this.post('/batch-payments', batchData);
  }

  async getAllBatchPayments(params = {}) {
    console.log('📦 Fetching batch payments for admin management');
    console.log('🔍 Filter parameters:', params);
    return this.get('/batch-payments', params);
  }

  async getBatchPaymentDetails(batchId) {
    console.log('🔍 Fetching detailed batch payment information for batch ID:', batchId);
    return this.get(`/batch-payments/${batchId}`);
  }

  async processBatchDeposit(batchId, depositData) {
    console.log('🏦 Processing KCB deposit for batch ID:', batchId);
    console.log('📱 Phone number:', depositData.phoneNumber);
    return this.post(`/batch-payments/${batchId}/deposit`, depositData);
  }

  async completeBatchPayment(batchId, completionData = {}) {
    console.log('✅ Completing batch payment processing for batch ID:', batchId);
    console.log('📊 Completion data:', completionData);
    return this.post(`/batch-payments/${batchId}/complete`, completionData);
  }

  async cancelBatchPayment(batchId, reason = null) {
    console.log('❌ Cancelling batch payment with ID:', batchId);
    console.log('📝 Cancellation reason:', reason || 'No reason provided');
    return this.delete(`/batch-payments/${batchId}`, { reason });
  }

  async createBulkPayments(paymentsArray, description = null) {
    console.log('📝 Creating bulk payments for batch processing');
    console.log('📊 Payment count:', paymentsArray.length);
    return this.createBatchPayment({
      payments: paymentsArray,
      description
    });
  }

  // Enhanced wallet methods
async initializeWallets() {
  console.log('🏦 Initializing church wallet system with default wallet types');
  try {
    const result = await this.post('/wallets/initialize');
    return {
      success: true,
      data: result,
      message: 'Wallet system initialized successfully'
    };
  } catch (error) {
    console.error('❌ Error initializing wallets:', error);
    throw error;
  }
}

async recalculateWalletBalances() {
  console.log('🧮 Recalculating all wallet balances from payment data');
  try {
    const result = await this.post('/wallets/recalculate');
    return {
      success: true,
      data: result,
      message: 'Wallet balances recalculated successfully'
    };
  } catch (error) {
    console.error('❌ Error recalculating wallet balances:', error);
    throw error;
  }
}

async getAllWallets() {
  console.log('💰 Fetching all wallet balances and transaction summaries');
  try {
    const result = await this.get('/wallets');
    
    // Ensure consistent response format
    if (result && result.success !== undefined) {
      return result; // Already in correct format
    } else {
      // Wrap in expected format
      return {
        success: true,
        data: result,
        message: 'Wallets retrieved successfully'
      };
    }
  } catch (error) {
    console.error('❌ Error fetching wallets:', error);
    throw error;
  }
}
async uploadWithdrawalReceipt(withdrawalId, receiptFile) {
  console.log('📎 Uploading receipt for withdrawal ID:', withdrawalId);
  console.log('📄 File details:', receiptFile ? {
    name: receiptFile.name,
    size: receiptFile.size,
    type: receiptFile.type
  } : 'No file provided');
  
  if (!receiptFile) {
    throw new Error('No receipt file provided');
  }
  
  // Validate file
  const validation = this.validateFile(receiptFile);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const formData = new FormData();
  formData.append('withdrawalReceipt', receiptFile);
  
  try {
    const result = await this.uploadFile(`/wallets/withdrawals/${withdrawalId}/receipt`, formData);
    return {
      success: true,
      data: result,
      message: 'Receipt uploaded successfully'
    };
  } catch (error) {
    console.error('❌ Error uploading withdrawal receipt:', error);
    throw error;
  }
}
async getWalletTransactions(walletId, params = {}) {
  console.log('📊 Fetching transaction history for wallet ID:', walletId);
  console.log('🔍 Filter parameters:', params);
  
  try {
    const result = await this.get(`/wallets/${walletId}/transactions`, params);
    return {
      success: true,
      data: result,
      message: 'Wallet transactions retrieved successfully'
    };
  } catch (error) {
    console.error('❌ Error fetching wallet transactions:', error);
    throw error;
  }
}
// Method to get wallet transaction history (if your backend supports it)
async getWalletTransactions(walletId, params = {}) {
  console.log('📊 Fetching transaction history for wallet ID:', walletId);
  console.log('🔍 Filter parameters:', params);
  
  try {
    const result = await this.get(`/wallets/${walletId}/transactions`, params);
    return {
      success: true,
      data: result,
      message: 'Wallet transactions retrieved successfully'
    };
  } catch (error) {
    console.error('❌ Error fetching wallet transactions:', error);
    throw error;
  }
}

// Method to export wallet data
async exportWalletData(walletId, format = 'csv') {
  console.log('📥 Exporting wallet data for wallet ID:', walletId);
  console.log('📄 Export format:', format);
  
  try {
    const filename = `wallet-${walletId}-${new Date().toISOString().split('T')[0]}.${format}`;
    const result = await this.downloadFile(`/wallets/${walletId}/export?format=${format}`, filename);
    return {
      success: true,
      data: result,
      message: `Wallet data exported as ${format.toUpperCase()}`
    };
  } catch (error) {
    console.error('❌ Error exporting wallet data:', error);
    throw error;
  }
}

// Helper method for wallet validation
validateWalletOperation(operation, data) {
  console.log('🔍 Validating wallet operation:', operation);
  
  switch (operation) {
    case 'withdrawal':
      if (!data.walletId || !data.amount || !data.purpose) {
        return { valid: false, error: 'Wallet ID, amount, and purpose are required for withdrawals' };
      }
      if (parseFloat(data.amount) <= 0) {
        return { valid: false, error: 'Withdrawal amount must be greater than zero' };
      }
      if (data.purpose.length < 5 || data.purpose.length > 100) {
        return { valid: false, error: 'Purpose must be between 5 and 100 characters' };
      }
      break;
      
    case 'approval':
      if (!data.password) {
        return { valid: false, error: 'Approval password is required' };
      }
      break;
      
    default:
      return { valid: true };
  }
  
  return { valid: true };
}

async updateWalletBalances(paymentIds) {
  console.log('⚖️ Updating wallet balances from completed payments');
  console.log('📊 Processing', paymentIds.length, 'payment records');
  try {
    const result = await this.post('/wallets/update-balances', { paymentIds });
    return {
      success: true,
      data: result,
      message: 'Wallet balances updated successfully'
    };
  } catch (error) {
    console.error('❌ Error updating wallet balances:', error);
    throw error;
  }
}

async createWithdrawalRequest(withdrawalData) {
  console.log('💸 Creating withdrawal request from church wallet');
  console.log('💰 Withdrawal details:', {
    amount: withdrawalData.amount,
    purpose: withdrawalData.purpose,
    method: withdrawalData.withdrawalMethod
  });
  
  try {
    const result = await this.post('/wallets/withdraw', withdrawalData);
    return {
      success: true,
      data: result,
      message: 'Withdrawal request created successfully'
    };
  } catch (error) {
    console.error('❌ Error creating withdrawal request:', error);
    throw error;
  }
}

async getWithdrawalRequests(params = {}) {
  console.log('📋 Fetching withdrawal requests for admin review');
  console.log('🔍 Filter parameters:', params);
  
  try {
    const result = await this.get('/wallets/withdrawals', params);
    return {
      success: true,
      data: result,
      message: 'Withdrawal requests retrieved successfully'
    };
  } catch (error) {
    console.error('❌ Error fetching withdrawal requests:', error);
    throw error;
  }
}

async approveWithdrawalRequest(withdrawalId, approvalData) {
  console.log('✅ Processing withdrawal approval for request ID:', withdrawalId);
  console.log('🔐 Approval method:', approvalData.approvalMethod || 'PASSWORD');
  
  try {
    const result = await this.post(`/wallets/withdrawals/${withdrawalId}/approve`, approvalData);
    return {
      success: true,
      data: result,
      message: 'Withdrawal approval processed successfully'
    };
  } catch (error) {
    console.error('❌ Error approving withdrawal request:', error);
    throw error;
  }
}

async validateTitheDistribution(distributionData) {
  console.log('✅ Validating tithe distribution data');
  console.log('📊 Distribution details:', distributionData);
  
  try {
    const result = await this.post('/wallets/validate-tithe', distributionData);
    return {
      success: true,
      data: result,
      message: 'Tithe distribution validated successfully'
    };
  } catch (error) {
    console.error('❌ Error validating tithe distribution:', error);
    throw error;
  }
}

  async getKcbAccountBalance() {
    console.log('🏦 Fetching current KCB account balance from banking API');
    return this.get('/kcb-sync/balance');
  }

  async getKcbTransactionHistory(params = {}) {
    console.log('📊 Fetching KCB transaction history from banking API');
    console.log('📅 Date range and pagination:', params);
    return this.get('/kcb-sync/transactions', params);
  }

  async syncKcbTransactions(syncData = {}) {
    console.log('🔄 Initiating KCB transaction synchronization with database');
    console.log('⚙️ Sync configuration:', syncData);
    return this.post('/kcb-sync/sync', syncData);
  }

  async getUnlinkedKcbTransactions(params = {}) {
    console.log('🔗 Fetching unlinked KCB transactions for manual review');
    console.log('🔍 Filter parameters:', params);
    return this.get('/kcb-sync/unlinked', params);
  }

  async linkKcbTransaction(kcbSyncId, paymentId) {
    console.log('🔗 Manually linking KCB transaction to payment record');
    console.log('🏦 KCB Sync ID:', kcbSyncId, '| Payment ID:', paymentId);
    return this.post('/kcb-sync/link', { kcbSyncId, paymentId });
  }

  async ignoreKcbTransaction(kcbSyncId, reason = null) {
    console.log('🚫 Marking KCB transaction as ignored:', kcbSyncId);
    console.log('📝 Ignore reason:', reason || 'No reason provided');
    return this.put(`/kcb-sync/ignore/${kcbSyncId}`, { reason });
  }

  async getKcbSyncStatistics() {
    console.log('📈 Fetching KCB synchronization statistics and performance metrics');
    return this.get('/kcb-sync/statistics');
  }

  async getUserReceipts(userId = null, params = {}) {
    const endpoint = userId ? `/receipt/user/${userId}` : '/receipt/user';
    console.log('🧾 Fetching receipt history for user:', userId || 'current user');
    console.log('🔍 Filter parameters:', params);
    return this.get(endpoint, params);
  }

  async getAllReceipts(params = {}) {
    console.log('🧾 Fetching all receipts for admin management');
    console.log('🔍 Filter parameters:', params);
    return this.get('/receipt/all', params);
  }

  async getReceiptById(receiptId) {
    console.log('🔍 Fetching detailed receipt information for receipt ID:', receiptId);
    return this.get(`/receipt/${receiptId}`);
  }

  async downloadReceipt(receiptId) {
    console.log('📄 Initiating PDF download for receipt ID:', receiptId);
    return this.downloadFile(`/receipt/${receiptId}/pdf`, `receipt-${receiptId}.pdf`);
  }

  async uploadReceiptAttachment(receiptId, formData) {
    console.log('📎 Uploading attachment to receipt ID:', receiptId);
    return this.uploadFile(`/receipt/${receiptId}/attachment`, formData);
  }

  async getSpecialOfferings(params = { activeOnly: 'true' }) {
    console.log('🎯 Fetching special offering campaigns');
    console.log('🔍 Filter parameters:', params);
    return this.get('/special-offerings', params);
  }

  async createSpecialOffering(offeringData) {
    console.log('➕ Creating new special offering campaign');
    console.log('🎯 Campaign details:', {
      name: offeringData.name,
      target: offeringData.targetAmount,
      startDate: offeringData.startDate
    });
    return this.post('/special-offerings', offeringData);
  }

  async getSpecialOfferingDetails(identifier) {
    console.log('🔍 Fetching special offering details for identifier:', identifier);
    return this.get(`/special-offerings/${identifier}`);
  }

  async getSpecialOfferingProgress(identifier) {
    console.log('📊 Fetching contribution progress for special offering:', identifier);
    return this.get(`/special-offerings/${identifier}/progress`);
  }

  async updateSpecialOffering(identifier, updateData) {
    console.log('✏️ Updating special offering campaign:', identifier);
    console.log('📝 Update fields:', Object.keys(updateData));
    return this.put(`/special-offerings/${identifier}`, updateData);
  }

  async deleteSpecialOffering(identifier) {
    console.log('🗑️ Deleting special offering campaign:', identifier);
    console.warn('⚠️ System will determine if deletion or deactivation is appropriate');
    return this.delete(`/special-offerings/${identifier}`);
  }

  async makeSpecialOfferingContribution(identifier, paymentData) {
    console.log('💝 Making contribution to special offering:', identifier);
    console.log('💰 Contribution details:', {
      amount: paymentData.amount,
      method: paymentData.paymentMethod || 'MPESA'
    });
    return this.post(`/special-offerings/${identifier}/contribution`, paymentData);
  }

  async submitContactForm(formData) {
    console.log('📧 Submitting contact form from:', formData.name);
    return this.post('/contact/submit', formData);
  }

  async getContactInfo() {
    console.log('📞 Fetching church contact info');
    return this.get('/contact/info');
  }

  async getAllInquiries(params = {}) {
    console.log('📋 Fetching all inquiries (Admin)');
    return this.get('/contact/inquiries', params);
  }

  async getInquiryById(inquiryId) {
    console.log('🔍 Fetching inquiry:', inquiryId);
    return this.get(`/contact/inquiries/${inquiryId}`);
  }

  async updateInquiryStatus(inquiryId, status, resolutionNotes = null) {
    console.log('🔄 Updating inquiry status:', inquiryId, 'to', status);
    const data = { status };
    if (resolutionNotes) data.resolutionNotes = resolutionNotes;
    return this.put(`/contact/inquiries/${inquiryId}/status`, data);
  }

  async archiveInquiry(inquiryId) {
    console.log('🗄️ Archiving inquiry:', inquiryId);
    return this.delete(`/contact/inquiries/${inquiryId}`);
  }

  async getDashboardStats() {
    console.log('📊 Fetching dashboard statistics');
    return this.get('/admin/dashboard-stats');
  }

  async getRecentActivity(params = {}) {
    console.log('📝 Fetching recent admin activity');
    return this.get('/admin/activity', params);
  }

  async generateReport(reportParams) {
    console.log('📄 Generating report:', reportParams.reportType);
    return this.post('/admin/reports', reportParams);
  }

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

  async uploadFileWithProgress(endpoint, formData, onProgress = null) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(percentComplete);
          }
        });
      }
      
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
      
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });
      
      xhr.open('POST', `${this.baseUrl}${endpoint}`);
      
      const headers = this.getHeaders(true);
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });
      
      xhr.send(formData);
    });
  }

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
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      
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

  validatePhoneNumber(phoneNumber) {
    const kenyanPhoneRegex = /^254\d{9}$/;
    return kenyanPhoneRegex.test(phoneNumber);
  }

  formatPhoneNumber(phoneNumber) {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && cleaned.length === 9) {
      cleaned = '254' + cleaned;
    } else if (cleaned.startsWith('254')) {
      return cleaned;
    }
    
    return cleaned;
  }

  preparePaymentData(rawData) {
    const cleanData = { ...rawData };
    
    if (cleanData.phoneNumber) {
      cleanData.phoneNumber = this.formatPhoneNumber(cleanData.phoneNumber);
    }
    
    if (cleanData.amount) {
      cleanData.amount = parseFloat(cleanData.amount);
    }
    
    if (cleanData.paymentType === 'SPECIAL' && cleanData.specialOfferingId) {
      cleanData.specialOfferingId = parseInt(cleanData.specialOfferingId);
    }
    
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

  formatCustomFields(offeringData) {
    if (Array.isArray(offeringData.customFields) && offeringData.customFields.length > 0) {
      return offeringData.customFields;
    }
    return null;
  }

  validateFile(file, allowedTypes = null, maxSize = null) {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }
    
    const types = allowedTypes || [...this.supportedImageTypes, ...this.supportedDocumentTypes];
    if (!types.includes(file.type)) {
      return { valid: false, error: `File type ${file.type} not supported. Allowed: ${types.join(', ')}` };
    }
    
    const sizeLimit = maxSize || this.maxFileSize;
    if (file.size > sizeLimit) {
      const sizeMB = (sizeLimit / (1024 * 1024)).toFixed(1);
      return { valid: false, error: `File size exceeds ${sizeMB}MB limit` };
    }
    
    return { valid: true };
  }
  // Generic request method (add this to support the frontend's usage pattern)
async request(method, endpoint, data = null, options = {}) {
  const url = `${this.baseUrl}${endpoint}`;
  
  console.log(`📡 Making ${method.toUpperCase()} request to: ${url}`);
  
  const fetchOptions = {
    method: method.toUpperCase(),
    headers: this.getHeaders(data instanceof FormData),
    credentials: 'include',
    ...options
  };
  
  // Only add body for methods that support it and when data is provided
  if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    if (data instanceof FormData) {
      fetchOptions.body = data;
    } else {
      fetchOptions.body = JSON.stringify(data);
    }
  }
  
  const response = await fetch(url, fetchOptions);
  console.log(`📥 Response status: ${response.status} for ${url}`);
  
  const result = await this.handleResponse(response);
  
  // Return in the format expected by the frontend
  return {
    success: true,
    data: result,
    message: result?.message || 'Operation completed successfully'
  };
}
  formatCurrency(amount, currency = 'KES') {
    return `${currency} ${parseFloat(amount).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

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

  logActivity(action, details = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 API Service: ${action}`, details);
    }
  }

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

  setAuthService(authService) {
    console.log('⚠️ setAuthService called but authentication is now handled directly by ApiService');
    if (authService && authService.getToken && authService.getCurrentUser) {
      const token = authService.getToken();
      const user = authService.getCurrentUser();
      if (token && user) {
        this.storeAuth(token, user);
      }
    }
  }

  async getAllPayments(params = {}) {
    return this.getAllAdminPayments(params);
  }

  saveUserToStorage(user, token) {
    this.storeAuth(token, user);
  }
}

const apiServiceInstance = new ApiService();

window.apiService = apiServiceInstance;

console.log('✅ Church Financial Management API Service loaded successfully');
console.log('🔧 Service status:', apiServiceInstance.getServiceStatus());

export default apiServiceInstance;