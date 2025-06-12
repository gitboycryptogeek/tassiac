// src/utils/apiService.js

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
  
  async request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: this.getHeaders(data instanceof FormData),
      credentials: 'include',
      ...options
    };
    
    if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      if (data instanceof FormData) {
        fetchOptions.body = data;
      } else {
        fetchOptions.body = JSON.stringify(data);
      }
    }
    
    const response = await fetch(url, fetchOptions);
    return this.handleResponse(response);
  }

  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    let responseData;

    try {
      if (response.status === 204) { // No Content
        return null;
      }
      responseData = isJson ? await response.json() : await response.text();
    } catch (parseError) {
      console.error('❌ Failed to parse API response:', parseError);
      throw new Error(response.ok ? 'Invalid JSON response from server.' : `Request failed with status ${response.status}: ${response.statusText}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        this.clearAuth();
        if (window.router && typeof window.router.navigateTo === 'function') {
          window.router.navigateTo('/login');
        } else {
          window.location.hash = '#/login';
        }
      }

      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      if (responseData && responseData.message) {
        errorMessage = responseData.message;
      }

      const error = new Error(errorMessage);
      error.response = responseData;
      error.status = response.status;
      throw error;
    }
    
    // **MAJOR FIX**: Return the nested data if the request was successful
    if (responseData && responseData.success === true && responseData.data) {
        return responseData.data;
    }

    return responseData;
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
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });
    
    return this.handleResponse(response);
  }

  async post(endpoint, data = {}) {
    return this.request('POST', endpoint, data);
  }

  async put(endpoint, data = {}) {
    return this.request('PUT', endpoint, data);
  }

  async delete(endpoint, data = null) {
    return this.request('DELETE', endpoint, data);
  }
  
  // --- AUTH METHODS ---
  async login(credentials) {
    const data = await this.post('/auth/login', credentials);
    if (data && data.user && data.token) {
      this.storeAuth(data.token, data.user);
    }
    return data;
  }

  async logout() {
    try {
      await this.get('/auth/logout');
    } catch (error) {
      console.warn('Server logout request failed:', error.message);
    } finally {
      this.clearAuth();
      if (window.router) {
        window.router.navigateTo('/login');
      } else {
        window.location.href = '/login';
      }
    }
  }
  
  // --- USER METHODS ---
  async getAllUsers() {
    return this.get('/auth/users');
  }

  async registerUser(userData) {
    return this.post('/auth/register', userData);
  }

  async updateUser(userId, userData) {
    return this.put(`/auth/users/${userId}`, userData);
  }

  async deleteUser(userId) {
    return this.delete(`/auth/users/${userId}`);
  }

  async adminResetUserPassword(userId, newPassword) {
    return this.post(`/auth/reset-password/${userId}`, { newPassword });
  }

  // --- PAYMENT METHODS ---
  async getAllAdminPayments(params = {}) {
    return this.get('/payment/all', params);
  }
  
  async getUserPayments(userId = null, params = {}) {
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    return this.get(endpoint, params);
  }
  
  async addManualPaymentWithReceipt(paymentData, receiptFile) {
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

  // --- BATCH PAYMENT METHODS ---
  async createBatchPayment(batchData) {
    return this.post('/batch-payments', batchData);
  }

  async getAllBatchPayments(params = {}) {
    return this.get('/batch-payments', params);
  }

  async getBatchPaymentDetails(batchId) {
    return this.get(`/batch-payments/${batchId}`);
  }
  
  async addItemsToBatch(batchId, batchData) {
    return this.post(`/batch-payments/${batchId}/add-items`, batchData);
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

  // --- SPECIAL OFFERING METHODS ---
  async getSpecialOfferings(params = {}) {
    return this.get('/special-offerings', params);
  }

  async createSpecialOffering(offeringData) {
    return this.post('/special-offerings', offeringData);
  }
  
  async getSpecialOfferingProgress(identifier) {
    return this.get(`/special-offerings/${identifier}/progress`);
  }
  
  // --- WALLET METHODS ---
  async getAllWallets() {
    return this.get('/wallets/all');
  }

  // --- OTHER METHODS ---
  async getDashboardStats() {
    return this.get('/admin/dashboard-stats');
  }
  
  async getRecentActivity(params = {}) {
    return this.get('/admin/activity', params);
  }
  
  async getAllInquiries(params = {}) {
    return this.get('/contact/inquiries', params);
  }
  
  async updateInquiryStatus(inquiryId, status, resolutionNotes = null) {
    const data = { status, resolutionNotes };
    return this.put(`/contact/inquiries/${inquiryId}/status`, data);
  }
  
  async downloadReceipt(receiptId) {
    const url = `${this.baseUrl}/receipt/${receiptId}/pdf`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to download receipt: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `receipt-${receiptId}.pdf`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    }, 0);
    
    return { success: true, message: 'Receipt download initiated.' };
  }
  
  // --- HELPER & UTILITY METHODS ---
  
  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  }

  isAuthenticated() {
    return !!(this.token && this.user);
  }

  isAdmin() {
    return !!(this.user && this.user.isAdmin);
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
    }
    return headers;
  }
  
  async uploadFile(endpoint, formData) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(true); // isFormData = true
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: formData,
      credentials: 'include',
    });
    
    return this.handleResponse(response);
  }
  
  getServiceStatus() {
    return {
      baseUrl: this.baseUrl,
      authenticated: this.isAuthenticated(),
      user: this.getCurrentUser()
    };
  }
}

const apiServiceInstance = new ApiService();
window.apiService = apiServiceInstance;
export default apiServiceInstance;