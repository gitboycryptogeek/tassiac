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
      // If parsing fails, but status suggests success, this is an issue.
      // If status suggests error, the original status text might be more useful.
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
        // Use text response if it's short and likely an error message
        errorMessage = responseData;
      }

      const error = new Error(errorMessage);
      error.code = errorCode;
      error.status = response.status;
      error.details = errorDetails;
      error.response = responseData; // Attach full response data
      console.error('API Error:', error.message, 'Code:', error.code, 'Details:', error.details, 'Full Response:', responseData);
      throw error;
    }

    // Handle standardized successful response
    if (responseData && typeof responseData === 'object' && responseData.hasOwnProperty('success')) {
      if (responseData.success === true) {
        return responseData.data !== undefined ? responseData.data : { message: responseData.message }; // Return data or success message
      } else {
        // Backend reported success: false
        const errorMessage = responseData.message || 'API operation reported failure.';
        const error = new Error(errorMessage);
        error.code = responseData.error?.code || 'OPERATION_FAILED';
        error.details = responseData.error?.details || null;
        error.response = responseData;
        console.error('API Operation Failed:', error.message, 'Details:', error.details);
        throw error;
      }
    }

    // Fallback for successful responses not using the new standard structure (legacy or simple text/file responses)
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
      credentials: 'include', // Important for session cookies if used, though JWT is primary
    });
    const data = await this.handleResponse(response); // `handleResponse` now returns the `data` payload directly on success
    
    // Assuming `data` here is { user, token } as returned by a successful login
    if (this.authService && data && data.user && data.token) {
      this.authService.saveUserToStorage(data.user, data.token);
    }
    return data; // Return the { user, token } payload
  }

  logout() {
    if (this.authService) {
      return this.authService.logout();
    }
    // Fallback
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
    // For FormData, the browser sets the Content-Type header automatically with the boundary
    const headers = this.getHeaders(true); // Pass true to indicate FormData
    delete headers['Content-Type'];

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: formData,
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  // --- Specific API methods ---

  // Admin related
  async getPaymentStats() { return this.get('/admin/dashboard-stats'); } // Assuming this endpoint gives all necessary stats
  async getRecentActivity(params) { return this.get('/admin/activity', params); }
  async getAllUsers() { return this.get('/auth/users'); }
  async registerUser(userData) { return this.post('/auth/register', userData); }
  async updateUser(userId, userData) { return this.put(`/auth/users/${userId}`, userData); }
  async deleteUser(userId) { return this.delete(`/auth/users/${userId}`); }
  async adminResetUserPassword(userId, newPassword) { return this.post(`/auth/admin/reset-password/${userId}`, { newPassword }); }
  async generateReport(reportParams) { return this.post('/admin/reports', reportParams); }
  async getAllAdminPayments(params) { return this.get('/payment/all', params); } // Renamed for clarity
  async addManualPayment(paymentData) { return this.post('/payment/manual', paymentData); }
  async updatePaymentStatus(paymentId, status) { return this.put(`/payment/${paymentId}/status`, { status }); }
  async adminDeletePayment(paymentId) { return this.delete(`/payment/${paymentId}`); }
  
  // Contact Inquiries (Admin)
  async getAllInquiries(params) { return this.get('/contact/inquiries', params); }
  async getInquiryById(inquiryId) { return this.get(`/contact/inquiries/${inquiryId}`); }
  async updateInquiryStatus(inquiryId, status, resolutionNotes = null) {
    const data = { status };
    if (resolutionNotes) data.resolutionNotes = resolutionNotes;
    return this.put(`/contact/inquiries/${inquiryId}/status`, data);
  }
  async archiveInquiry(inquiryId) { return this.delete(`/contact/inquiries/${inquiryId}`); }


  // User Profile and Auth
  async getUserProfile() { return this.get('/auth/profile'); }
  async changePassword(currentPassword, newPassword) { return this.post('/auth/change-password', { currentPassword, newPassword }); }
  // Password reset request flow might involve other steps not covered here like verify-token
  // async requestPasswordReset(email) { return this.post('/auth/request-password-reset', { email }); }
  // async completePasswordReset(token, newPassword) { return this.post('/auth/reset-password-confirm', { token, newPassword }); }

  // Payments (User)
  async getUserPayments(userId = null, params = {}) { // userId can be null to fetch for current logged-in user
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    return this.get(endpoint, params);
  }
  async initiateMpesaPayment(paymentData) { // Changed from initiatePayment for clarity
    return this.post('/payment/initiate-mpesa', paymentData);
  }

  // Receipts (User)
  async getUserReceipts(userId = null, params = {}) {
    const endpoint = userId ? `/receipt/user/${userId}` : '/receipt/user';
    return this.get(endpoint, params);
  }
  async getReceiptById(receiptId) { return this.get(`/receipt/${receiptId}`); }
  async downloadReceipt(receiptId) {
    // This will trigger a browser download directly if backend sends correct headers
    // Or use downloadFile helper if backend returns a path
    return this.downloadFile(`/receipt/${receiptId}/pdf`, `receipt-${receiptId}.pdf`);
  }
   async uploadReceiptAttachment(receiptId, formData) {
    return this.uploadFile(`/receipt/${receiptId}/attachment`, formData);
  }


  // Special Offerings
  async getSpecialOfferings(params = { activeOnly: 'true' }) { return this.get('/special-offerings', params); }
  async createSpecialOffering(offeringData) { return this.post('/special-offerings', offeringData); }
  async getSpecialOfferingDetails(identifier) { return this.get(`/special-offerings/${identifier}`); }
  async getSpecialOfferingProgress(identifier) { return this.get(`/special-offerings/${identifier}/progress`); }
  async updateSpecialOffering(identifier, updateData) { return this.put(`/special-offerings/${identifier}`, updateData); }
  async deleteSpecialOffering(identifier) { return this.delete(`/special-offerings/${identifier}`);}
  async makeSpecialOfferingContribution(identifier, paymentData) { // Renamed for clarity
    return this.post(`/special-offerings/${identifier}/contribution`, paymentData);
  }

  // Public Contact
  async submitContactForm(formData) { return this.post('/contact/submit', formData); }
  async getContactInfo() { return this.get('/contact/info'); }


  /**
   * Format custom fields for special offering.
   * The backend for createSpecialOffering now expects customFields to be an object/JSON.
   * This helper might be used by the frontend form logic to construct that object
   * before passing it to createSpecialOffering.
   * If your form already builds the object, this explicit formatting here might be less needed.
   * @param {Object} offeringData - Raw offering data from a form.
   * @returns {Object} - Formatted custom fields object (or null if none).
   */
  formatCustomFields(offeringData) {
    // Example: if your form has fields like customField1_name, customField1_desc, etc.
    // This is highly dependent on how your frontend form for custom fields is structured.
    // For now, assuming `offeringData.customFields` is already an array of {name, description} objects.
    if (Array.isArray(offeringData.customFields) && offeringData.customFields.length > 0) {
        // Ensure it's in the { fields: [...] } structure if backend expects that in customFields JSON
        // return { fields: offeringData.customFields };
        return offeringData.customFields; // Or just return the array if Prisma model `customFields` expects array directly
    }
    return null; // Or Prisma.JsonNull for Prisma
  }

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
        // Try to parse error message if JSON
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            // If not JSON, use text
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
      
      return { success: true, message: 'File download initiated.' }; // Return a success indicator
    } catch (error) {
      console.error('API file download error:', error.message);
      throw error; // Re-throw for the caller to handle
    }
  }
}

// Create global instance
window.apiService = new ApiService();

export default window.apiService;