// src/utils/apiService.js

export class ApiService {
  constructor() {
    this.baseUrl = '/api'; // Vite proxy will handle this in development
    this.authService = window.authService; // Assuming authService is globally available
  }

  setAuthService(authService) {
    this.authService = authService;
  }

  getHeaders(isFormData = false) {
    const headers = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.authService) {
      const token = this.authService.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    let responseData;

    try {
      responseData = isJson ? await response.json() : await response.text();
    } catch (e) {
      console.error('Error parsing API response:', e);
      throw new Error(response.ok ? 'Invalid JSON response from server.' : `Request failed with status ${response.status}: ${response.statusText}`);
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
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
      console.error('API Error:', error.message, 'Code:', error.code, 'Details:', error.details, 'Full Response:', responseData);
      throw error;
    }

    // Handle standardized successful response
    if (responseData && typeof responseData === 'object' && responseData.hasOwnProperty('success')) {
      if (responseData.success === true) {
        return responseData.data !== undefined ? responseData.data : { message: responseData.message };
      } else {
        const errorMessage = responseData.message || 'API operation reported failure.';
        const error = new Error(errorMessage);
        error.code = responseData.error?.code || 'OPERATION_FAILED';
        error.details = responseData.error?.details || null;
        error.response = responseData;
        console.error('API Operation Failed:', error.message, 'Details:', error.details);
        throw error;
      }
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

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ username, password: pwd }),
      credentials: 'include',
    });
    const data = await this.handleResponse(response);
    
    if (this.authService && data && data.user && data.token) {
      this.authService.saveUserToStorage(data.user, data.token);
    }
    return data;
  }

  logout() {
    if (this.authService) {
      return this.authService.logout();
    }
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  async get(endpoint, params = {}) {
    let url = `${this.baseUrl}${endpoint}`;
    if (Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams(params);
      url += `?${queryParams.toString()}`;
    }
    const response = await fetch(url, { method: 'GET', headers: this.getHeaders(), credentials: 'include' });
    return this.handleResponse(response);
  }

  async post(endpoint, data = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  async put(endpoint, data = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  async delete(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  async uploadFile(endpoint, formData) {
    const headers = this.getHeaders(true);
    delete headers['Content-Type'];

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: formData,
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  // --- Authentication Methods ---
  async getUserProfile() { return this.get('/auth/profile'); }
  async changePassword(currentPassword, newPassword) { 
    return this.post('/auth/change-password', { currentPassword, newPassword }); 
  }

  // --- Admin User Management ---
  async getAllUsers() { return this.get('/auth/users'); }
  async registerUser(userData) { return this.post('/auth/register', userData); }
  async updateUser(userId, userData) { return this.put(`/auth/users/${userId}`, userData); }
  async deleteUser(userId) { return this.delete(`/auth/users/${userId}`); }
  async adminResetUserPassword(userId, newPassword) { 
    return this.post(`/auth/reset-password/${userId}`, { newPassword }); 
  }

  // --- Payment Methods ---

  // User payment methods
  async getUserPayments(userId = null, params = {}) {
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    return this.get(endpoint, params);
  }

  async getPaymentStatus(paymentId) {
    return this.get(`/payment/status/${paymentId}`);
  }

  // Unified payment initiation method
  async initiatePayment(paymentData) {
    // Set KCB as default payment method if not specified
    const enhancedPaymentData = {
      paymentMethod: 'KCB',
      ...paymentData
    };
    return this.post('/payment/initiate', this.preparePaymentData(enhancedPaymentData));
  }

  // Specific payment method initiators
  async initiateMpesaPayment(paymentData) {
    return this.post('/payment/initiate-mpesa', paymentData);
  }

  async initiateKcbPayment(paymentData) {
    const kcbPaymentData = {
      ...paymentData,
      paymentMethod: 'KCB'
    };
    return this.post('/payment/initiate-kcb', this.preparePaymentData(kcbPaymentData));
  }

  // Enhanced manual payment with batch support
  async addManualPaymentToBatch(paymentData, batchId = null) {
    const enhancedData = {
      ...paymentData,
      batchPaymentId: batchId,
      isBatchProcessed: !!batchId
    };
    return this.post('/payment/manual', enhancedData);
  }

// Bulk payment creation for batch processing
async createBulkPayments(paymentsArray, description = null) {
  return this.createBatchPayment({
    payments: paymentsArray,
    description
  });
}
  // Admin payment methods
  async getAllAdminPayments(params = {}) { 
    return this.get('/payment/all', params); 
  }

  async getPaymentStats() { 
    return this.get('/payment/stats'); 
  }

  async addManualPayment(paymentData) { 
    return this.post('/payment/manual', paymentData); 
  }

  async addManualPaymentWithReceipt(paymentData, receiptFile) {
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

  async updatePaymentStatus(paymentId, status) { 
    return this.put(`/payment/${paymentId}/status`, { status }); 
  }

  async adminDeletePayment(paymentId) { 
    return this.delete(`/payment/${paymentId}`); 
  }

  // --- Admin Dashboard ---
  async getDashboardStats() { 
    return this.get('/admin/dashboard-stats'); 
  }

  async getRecentActivity(params = {}) { 
    return this.get('/admin/activity', params); 
  }

  async generateReport(reportParams) { 
    return this.post('/admin/reports', reportParams); 
  }

  // --- Receipt Methods ---
  async getUserReceipts(userId = null, params = {}) {
    const endpoint = userId ? `/receipt/user/${userId}` : '/receipt/user';
    return this.get(endpoint, params);
  }

  async getReceiptById(receiptId) { 
    return this.get(`/receipt/${receiptId}`); 
  }

  async downloadReceipt(receiptId) {
    return this.downloadFile(`/receipt/${receiptId}/pdf`, `receipt-${receiptId}.pdf`);
  }

  async uploadReceiptAttachment(receiptId, formData) {
    return this.uploadFile(`/receipt/${receiptId}/attachment`, formData);
  }

  // --- Special Offerings ---
  async getSpecialOfferings(params = { activeOnly: 'true' }) { 
    return this.get('/special-offerings', params); 
  }

  async createSpecialOffering(offeringData) { 
    return this.post('/special-offerings', offeringData); 
  }

  async getSpecialOfferingDetails(identifier) { 
    return this.get(`/special-offerings/${identifier}`); 
  }

  async getSpecialOfferingProgress(identifier) { 
    return this.get(`/special-offerings/${identifier}/progress`); 
  }

  async updateSpecialOffering(identifier, updateData) { 
    return this.put(`/special-offerings/${identifier}`, updateData); 
  }

  async deleteSpecialOffering(identifier) { 
    return this.delete(`/special-offerings/${identifier}`);
  }

  async makeSpecialOfferingContribution(identifier, paymentData) {
    return this.post(`/special-offerings/${identifier}/contribution`, paymentData);
  }

  // --- Contact Inquiries ---
  async submitContactForm(formData) { 
    return this.post('/contact/submit', formData); 
  }

  async getContactInfo() { 
    return this.get('/contact/info'); 
  }

  // Admin contact inquiry methods
  async getAllInquiries(params = {}) { 
    return this.get('/contact/inquiries', params); 
  }

  async getInquiryById(inquiryId) { 
    return this.get(`/contact/inquiries/${inquiryId}`); 
  }

  async updateInquiryStatus(inquiryId, status, resolutionNotes = null) {
    const data = { status };
    if (resolutionNotes) data.resolutionNotes = resolutionNotes;
    return this.put(`/contact/inquiries/${inquiryId}/status`, data);
  }

  async archiveInquiry(inquiryId) { 
    return this.delete(`/contact/inquiries/${inquiryId}`); 
  }

  // --- Utility Methods ---

  /**
   * Format custom fields for special offering.
   */
  formatCustomFields(offeringData) {
    if (Array.isArray(offeringData.customFields) && offeringData.customFields.length > 0) {
        return offeringData.customFields;
    }
    return null;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber) {
    const kenyanPhoneRegex = /^254\d{9}$/;
    return kenyanPhoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number to Kenya format
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
   * Download file with proper error handling
   */
  async downloadFile(endpoint, filename) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log('Making file download request to', url);
      
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
            errorData = { message: await response.text() || `File download failed with status ${response.status}`};
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
      console.error('API file download error:', error.message);
      throw error;
    }
  }

    // --- Wallet Management ---
    async initializeWallets() { 
      return this.post('/wallets/initialize'); 
    }
  
    async getAllWallets() { 
      return this.get('/wallets'); 
    }
  
    async updateWalletBalances(paymentIds) { 
      return this.post('/wallets/update-balances', { paymentIds }); 
    }
  
    async createWithdrawalRequest(withdrawalData) { 
      return this.post('/wallets/withdraw', withdrawalData); 
    }
  
    async getWithdrawalRequests(params = {}) { 
      return this.get('/wallets/withdrawals', params); 
    }
  
    async approveWithdrawalRequest(withdrawalId, approvalData) { 
      return this.post(`/wallets/withdrawals/${withdrawalId}/approve`, approvalData); 
    }
  
    // --- Batch Payment Management ---
    async createBatchPayment(batchData) { 
      return this.post('/batch-payments', batchData); 
    }
  
    async getAllBatchPayments(params = {}) { 
      return this.get('/batch-payments', params); 
    }
  
    async getBatchPaymentDetails(batchId) { 
      return this.get(`/batch-payments/${batchId}`); 
    }
  
    async processBatchDeposit(batchId, depositData) { 
      return this.post(`/batch-payments/${batchId}/deposit`, depositData); 
    }
  
    async completeBatchPayment(batchId, completionData = {}) { 
      return this.post(`/batch-payments/${batchId}/complete`, completionData); 
    }
  
    async cancelBatchPayment(batchId, reason = null) { 
      return this.delete(`/batch-payments/${batchId}`, { reason }); 
    }
  
    // --- KCB Sync and Balance Management ---
    async getKcbAccountBalance() { 
      return this.get('/kcb-sync/balance'); 
    }
  
    async getKcbTransactionHistory(params = {}) { 
      return this.get('/kcb-sync/transactions', params); 
    }
  
    async syncKcbTransactions(syncData = {}) { 
      return this.post('/kcb-sync/sync', syncData); 
    }
  
    async getUnlinkedKcbTransactions(params = {}) { 
      return this.get('/kcb-sync/unlinked', params); 
    }
  
    async linkKcbTransaction(kcbSyncId, paymentId) { 
      return this.post('/kcb-sync/link', { kcbSyncId, paymentId }); 
    }
  
    async ignoreKcbTransaction(kcbSyncId, reason = null) { 
      return this.put(`/kcb-sync/ignore/${kcbSyncId}`, { reason }); 
    }
  
    async getKcbSyncStatistics() { 
      return this.get('/kcb-sync/statistics'); 
    }

  /**
   * Handle file upload with progress tracking
   */
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
      
      // Set auth headers
      const headers = this.getHeaders(true);
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });
      
      xhr.send(formData);
    });
  }

  /**
   * Prepare payment data for submission
   */
  preparePaymentData(rawData) {
    const cleanData = { ...rawData };
    
    // Format phone number
    if (cleanData.phoneNumber) {
      cleanData.phoneNumber = this.formatPhoneNumber(cleanData.phoneNumber);
    }
    
    // Ensure amount is a number
    if (cleanData.amount) {
      cleanData.amount = parseFloat(cleanData.amount);
    }
    
    // Handle special offering ID conversion
    if (cleanData.paymentType === 'SPECIAL' && cleanData.specialOfferingId) {
      cleanData.specialOfferingId = parseInt(cleanData.specialOfferingId);
    }
    
    // Clean up tithe distribution
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
}

// Create global instance
window.apiService = new ApiService();

export default window.apiService;