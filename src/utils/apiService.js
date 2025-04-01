// src/utils/apiService.js

export class ApiService {
  constructor() {
    // Base URL for API requests - would be proxied by Vite in dev mode
    this.baseUrl = '/api';
    this.authService = window.authService;
  }

  /**
   * Set auth service (for compatibility with your original code)
   */
  setAuthService(authService) {
    this.authService = authService;
  }

  /**
   * Get authorization headers with the JWT token
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Get the auth token from authService
    if (this.authService) {
      const token = this.authService.getToken();
      if (token) {
        // Add Authorization header with Bearer token
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Login method - handles both formats (separate params or credentials object)
   * @param {string|object} usernameOrCredentials - Username or credentials object
   * @param {string|undefined} password - Password (not needed if credentials object used)
   * @returns {Promise} - Login response
   */
  async login(usernameOrCredentials, password) {
    try {
      let username, pwd;
      
      // Check if first parameter is an object (credentials)
      if (typeof usernameOrCredentials === 'object' && usernameOrCredentials !== null) {
        // Extract username and password from credentials object
        username = usernameOrCredentials.username;
        pwd = usernameOrCredentials.password;
        console.log('Login attempt with credentials object:', { username, password: '******' });
      } else {
        // Using separate parameters
        username = usernameOrCredentials;
        pwd = password;
        console.log('Login attempt with separate parameters:', { username, password: '******' });
      }
      
      // Make sure username and password are strings and not objects
      username = String(username);
      pwd = String(pwd);
      
      const url = `${this.baseUrl}/auth/login`;
      console.log('Making login request to', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password: pwd
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || 'Login failed');
      }
      
      const data = await response.json();
      
      // Save user and token via authService
      if (this.authService) {
        this.authService.saveUserToStorage(data.user, data.token);
      }
      
      return data;
    } catch (error) {
      console.error('Login API error:', error);
      throw error;
    }
  }

  /**
   * Logout method (for compatibility - delegates to authService)
   */
  logout() {
    if (this.authService) {
      return this.authService.logout();
    }
    
    // Fallback if authService not available
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  /**
   * Make a GET request to the API
   * @param {string} endpoint - API endpoint path
   * @param {object} params - Query parameters
   */
  async get(endpoint, params = {}) {
    try {
      let url = `${this.baseUrl}${endpoint}`;
      
      // Add query parameters if provided
      if (Object.keys(params).length > 0) {
        // Check if params is a simple object or not
        if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
          const queryParams = new URLSearchParams();
          
          // Build queryParams properly, avoiding [object Object]
          Object.entries(params).forEach(([key, value]) => {
            queryParams.append(key, value);
          });
          
          url += `?${queryParams.toString()}`;
        } else {
          // Just append as is if it's not a simple object
          url += `?params=${params}`;
        }
      }
      
      console.log('Making GET request to', url);
      
      // Make the request with authorization headers
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });
      
      return this.handleResponse(response);
    } catch (error) {
      console.error('API GET error:', error);
      throw error;
    }
  }

  /**
   * Make a POST request to the API
   * @param {string} endpoint - API endpoint path
   * @param {object} data - Request body data
   */
  async post(endpoint, data = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log('Making POST request to', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      return this.handleResponse(response);
    } catch (error) {
      console.error('API POST error:', error);
      throw error;
    }
  }

  /**
   * Make a PUT request to the API
   * @param {string} endpoint - API endpoint path
   * @param {object} data - Request body data
   */
  async put(endpoint, data = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log('Making PUT request to', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      return this.handleResponse(response);
    } catch (error) {
      console.error('API PUT error:', error);
      throw error;
    }
  }

  /**
   * Make a DELETE request to the API
   * @param {string} endpoint - API endpoint path
   */
  async delete(endpoint) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log('Making DELETE request to', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
        credentials: 'include'
      });
      
      return this.handleResponse(response);
    } catch (error) {
      console.error('API DELETE error:', error);
      throw error;
    }
  }

  /**
   * Handle API response
   * @param {Response} response - Fetch API response
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    // Get response data
    let data;
    try {
      data = isJson ? await response.json() : await response.text();
    } catch (e) {
      console.error('Error parsing response:', e);
      data = { message: 'Error parsing response' };
    }
    
    console.log('API Response:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('Error response data:', data);
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  }

  /**
   * Get payment statistics (for admin dashboard)
   */
  async getPaymentStats() {
    try {
      const response = await this.get('/payment/stats');
      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
  
  /**
   * Get recent activity (for admin dashboard)
   */
  async getRecentActivity() {
    try {
      const response = await this.get('/admin/recent-activity');
      return {
        success: true,
        activities: response && response.activities ? response.activities : []
      };
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      // Return a structured response with an empty activities array instead of throwing
      return { 
        success: false, 
        error: error.message,
        activities: [] 
      };
    }
  }

  /**
   * Upload a file
   * @param {string} endpoint - API endpoint path
   * @param {FormData} formData - Form data with file
   */
  async uploadFile(endpoint, formData) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log('Making file upload request to', url);
      
      // Get headers without Content-Type (browser will set it with boundary)
      const headers = this.getHeaders();
      delete headers['Content-Type'];
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: formData,
        credentials: 'include'
      });
      
      return this.handleResponse(response);
    } catch (error) {
      console.error('API file upload error:', error);
      throw error;
    }
  }

  /**
   * Delete a user (admin function)
   * @param {number} userId - User ID to delete
   * @returns {Promise} - User deletion response
   */
  async deleteUser(userId) {
    return this.delete(`/auth/users/${userId}`);
  }

  /**
   * Reset user password with old and new password (admin function)
   * @param {number} userId - User ID
   * @param {string} oldPassword - Old password
   * @param {string} newPassword - New password
   * @returns {Promise} - Password reset response
   */
  async resetUserPassword(userId, oldPassword, newPassword) {
    return this.post(`/auth/reset-password/${userId}`, { oldPassword, newPassword });
  }

  /**
   * Update user information (admin function)
   * @param {number} userId - User ID
   * @param {Object} userData - Updated user data
   * @returns {Promise} - User update response
   */
  async updateUser(userId, userData) {
    return this.put(`/auth/users/${userId}`, userData);
  }
  
  /**
 * Get special offerings - with improved error handling and data normalization
 * @param {boolean} activeOnly - Whether to get only active offerings
 * @returns {Promise} - Special offerings data
 */
  async getSpecialOfferings(activeOnly = false) {
    try {
      console.log('Fetching special offerings, activeOnly:', activeOnly);
      
      // Direct API call
      const response = await this.get('/payment/special-offering', { activeOnly });
      
      // Log the raw response
      console.log('Special offerings API response:', response);
      
      // Handle empty responses
      if (!response) {
        console.warn('Empty response from special offerings endpoint');
        return { specialOfferings: [] };
      }
      
      // Handle different response formats
      let specialOfferings = [];
      
      if (Array.isArray(response)) {
        // Handle array response directly
        specialOfferings = response;
      } else if (response.specialOfferings && Array.isArray(response.specialOfferings)) {
        // Standard format
        specialOfferings = response.specialOfferings;
      } else {
        // Try to find any array property in the response
        const arrayProps = Object.keys(response).filter(key => 
          Array.isArray(response[key])
        );
        
        if (arrayProps.length > 0) {
          specialOfferings = response[arrayProps[0]];
        } else {
          console.warn('No array found in response:', response);
          return { specialOfferings: [] };
        }
      }
      
      // Normalize each offering to ensure consistent format
      const normalizedOfferings = specialOfferings.map(offering => {
        // Create a normalized offering with default values for all fields
        return {
          id: this.extractIdFromType(offering.offeringType || offering.paymentType || ''),
          offeringType: offering.offeringType || offering.paymentType || '',
          // Improve name handling to never show raw IDs
          name: this.getHumanReadableName(offering),
          description: this.extractDescription(offering),
          startDate: offering.startDate || offering.paymentDate || offering.createdAt || new Date().toISOString(),
          endDate: offering.endDate || null,
          targetGoal: parseFloat(offering.targetGoal || 0),
          customFields: this.extractCustomFields(offering),
          isTemplate: offering.isTemplate === true || offering.isTemplate === 1
        };
      });
      
      // Filter out duplicates by offeringType, keeping the one marked as template
      const uniqueOfferings = {};
      normalizedOfferings.forEach(offering => {
        const key = offering.offeringType;
        
        // Prefer templates over non-templates
        if (!uniqueOfferings[key] || offering.isTemplate) {
          uniqueOfferings[key] = offering;
        }
      });
      
      console.log('Normalized special offerings:', Object.values(uniqueOfferings));
      
      return { specialOfferings: Object.values(uniqueOfferings) };
    } catch (error) {
      console.error('Error fetching special offerings:', error);
      
      // Return empty array on error instead of throwing
      return { specialOfferings: [] };
    }
  }

getHumanReadableName(offering) {
  // First try standard name fields
  if (offering.name && offering.name.trim() !== '') 
    return offering.name;
  
  if (offering.description && offering.description.trim() !== '') 
    return offering.description;
  
  // Try to extract from customFields
  try {
    if (offering.customFields) {
      const customFields = typeof offering.customFields === 'string'
        ? JSON.parse(offering.customFields)
        : offering.customFields;
        
      if (customFields.fullDescription && customFields.fullDescription.trim() !== '') {
        return customFields.fullDescription;
      }
    }
  } catch (e) {
    console.warn('Error parsing customFields for name:', e);
  }
  
  // If we still don't have a name, use "Special Offering" with a cleaner ID
  const id = this.extractIdFromType(offering.offeringType || offering.paymentType || '');
  return `Special Offering ${id.replace(/^SO/, '#')}`;
}

/**
 * Helper to extract description from an offering
 * @private
 */
extractDescription(offering) {
  if (offering.description) return offering.description;
  
  try {
    // Check for description in customFields
    if (offering.customFields) {
      const customFields = typeof offering.customFields === 'string'
        ? JSON.parse(offering.customFields)
        : offering.customFields;
        
      if (customFields.fullDescription) {
        return customFields.fullDescription;
      }
    }
  } catch (e) {
    console.warn('Error parsing customFields for description:', e);
  }
  
  return offering.name || 'Special Offering';
}

/**
 * Helper to extract custom fields from an offering
 * @private
 */
extractCustomFields(offering) {
  try {
    if (offering.customFields) {
      // Handle string or object format
      const customFields = typeof offering.customFields === 'string'
        ? JSON.parse(offering.customFields)
        : offering.customFields;
        
      return Array.isArray(customFields.fields) ? customFields.fields : [];
    }
  } catch (e) {
    console.warn('Error parsing customFields:', e);
  }
  
  return [];
}

/**
 * Helper to extract ID from offering type
 * @private
 */
extractIdFromType(typeString) {
  if (!typeString) return '';
  
  // Extract the ID part after SPECIAL_
  if (typeString.startsWith('SPECIAL_')) {
    return typeString.split('SPECIAL_')[1];
  }
  
  return typeString;
}
  /**
   * Create a special offering
   * @param {Object} offeringData - Special offering data
   * @returns {Promise} - Special offering creation response
   */
  async createSpecialOffering(offeringData) {
    try {
      console.log('Creating special offering:', offeringData);
      
      // Ensure offeringType uses the correct format
      if (!offeringData.offeringType.startsWith('SPECIAL_')) {
        offeringData.offeringType = `SPECIAL_${offeringData.offeringType}`;
      }
      
      // Ensure template flag is set
      offeringData.isTemplate = true;
      
      // Format customFields properly if it's not already a string
      if (offeringData.customFields && typeof offeringData.customFields !== 'string') {
        offeringData.customFields = JSON.stringify({
          fullDescription: offeringData.description || offeringData.name,
          fields: Array.isArray(offeringData.customFields) ? offeringData.customFields : []
        });
      }
      
      // Try the dedicated endpoint first
      try {
        return await this.post('/payment/special-offering', offeringData);
      } catch (error) {
        console.warn('Special offering endpoint failed, falling back to manual payment:', error);
        
        // Fall back to creating via manual payment
        const paymentData = {
          // CHANGE THIS LINE - use passed userId instead of admin's id
          userId: offeringData.userId || this.authService.getUser().id, // Allow passed userId or fallback to admin
          amount: offeringData.targetGoal || 0,
          paymentType: offeringData.offeringType,
          paymentMethod: 'MANUAL',
          status: 'COMPLETED',
          description: offeringData.name,
          isPromoted: true,
          isExpense: false, // Explicitly mark as not an expense
          paymentDate: offeringData.startDate,
          endDate: offeringData.endDate,
          targetGoal: offeringData.targetGoal,
          isTemplate: true, // Explicitly mark as template
          addedBy: this.authService.getUser().id, // Explicitly track who added it
          customFields: typeof offeringData.customFields === 'string' 
            ? offeringData.customFields 
            : JSON.stringify({
                fullDescription: offeringData.description || offeringData.name,
                fields: Array.isArray(offeringData.customFields) ? offeringData.customFields : []
              })
        };
        
        return this.post('/payment/manual', paymentData);
      }
    } catch (error) {
      console.error('Error creating special offering:', error);
      throw error;
    }
  }
  
  /**
   * Get special offering details
   * @param {string} offeringType - Special offering type ID
   * @returns {Promise} - Special offering details
   */
  async getSpecialOfferingDetails(offeringType) {
    try {
      // Try the new endpoint first
      return await this.get(`/payment/special-offering/${offeringType}`);
    } catch (error) {
      console.warn('New special offering endpoint failed, falling back to payment search:', error);
      // Fall back to finding the payment
      return this.get('/payment/all', {
        limit: 1,
        paymentType: offeringType
      }).then(response => {
        if (!response.payments || response.payments.length === 0) {
          throw new Error('Special offering not found');
        }
        
        const payment = response.payments[0];
        let customFields = [];
        let fullDescription = payment.description;
        
        try {
          if (payment.customFields && typeof payment.customFields === 'string') {
            const parsed = JSON.parse(payment.customFields);
            customFields = parsed.fields || [];
            fullDescription = parsed.fullDescription || payment.description;
          }
        } catch (e) {
          console.error('Error parsing custom fields:', e);
        }
        
        return {
          specialOffering: {
            offeringType: payment.paymentType,
            name: payment.description,
            description: fullDescription,
            startDate: payment.paymentDate,
            endDate: payment.endDate,
            targetGoal: payment.targetGoal || 0,
            customFields,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt
          }
        };
      });
    }
  }
  
  /**
   * Get progress for a special offering
   * @param {string} offeringType - Special offering type ID
   * @returns {Promise} - Special offering progress data
   */
  async getSpecialOfferingProgress(offeringType) {
    try {
      console.log('Fetching progress for offering:', offeringType);
      
      // Try the dedicated endpoint first
      try {
        return await this.get(`/payment/special-offering/${offeringType}/progress`);
      } catch (error) {
        console.warn('Special offering progress endpoint failed, calculating manually:', error);
        
        // Fall back to manual calculation
        // First get the special offering details (template)
        const offeringDetails = await this.getSpecialOfferingDetails(offeringType);
        const specialOffering = offeringDetails.specialOffering;
        
        // Then get all payments for this offering type (excluding the template)
        const payments = await this.get('/payment/all', {
          paymentType: offeringType,
          isTemplate: false
        });
        
        // Calculate the total amount contributed
        const totalContributed = payments.payments
          .filter(payment => payment.isTemplate !== true && payment.status === 'COMPLETED')
          .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        
        // Calculate the percentage
        let percentage = 0;
        if (specialOffering.targetGoal && specialOffering.targetGoal > 0) {
          percentage = Math.min(100, (totalContributed / parseFloat(specialOffering.targetGoal)) * 100);
        }
        
        return {
          offeringType,
          name: specialOffering.name,
          targetGoal: specialOffering.targetGoal || 0,
          totalContributed,
          percentage,
          payments: payments.payments.filter(payment => payment.isTemplate !== true),
          remainingAmount: Math.max(0, (parseFloat(specialOffering.targetGoal) || 0) - totalContributed)
        };
      }
    } catch (error) {
      console.error('Error getting special offering progress:', error);
      throw error;
    }
  }
  
  /**
   * Update a special offering
   * @param {string} offeringType - Special offering type ID
   * @param {Object} updateData - Data to update
   * @returns {Promise} - Special offering update response
   */
  async updateSpecialOffering(offeringType, updateData) {
    try {
      // Try the new endpoint first
      return await this.put(`/payment/special-offering/${offeringType}`, updateData);
    } catch (error) {
      console.warn('New special offering update endpoint failed, not supported:', error);
      throw new Error('Updating special offerings is not supported in your current server version. Please upgrade to use this feature.');
    }
  }
  // Make a payment to a special offering
async makeSpecialOfferingPayment(offeringType, paymentData) {
  try {
    // Ensure we have the minimum required fields
    if (!paymentData.amount) {
      throw new Error('Payment amount is required');
    }
    
    // Set correct values for a payment to a special offering
    const payment = {
      ...paymentData,
      paymentType: offeringType,
      isTemplate: false, // Explicitly mark as NOT a template
      status: 'COMPLETED'
    };
    
    return await this.post(`/payment/special-offering/${offeringType}/payment`, payment);
  } catch (error) {
    console.warn('Special offering payment endpoint failed, falling back to manual payment:', error);
    
    // Fallback to manual payment
    return await this.post('/payment/manual', {
      ...paymentData,
      paymentType: offeringType,
      isTemplate: false,
      status: 'COMPLETED'
    });
  }
}
  /**
   * Download a file
   * @param {string} endpoint - API endpoint path
   * @param {string} filename - Suggested filename for download
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
        const errorData = await response.json();
        throw new Error(errorData.message || 'File download failed');
      }
      
      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link and click it
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
      
      return true;
    } catch (error) {
      console.error('API file download error:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   * @returns {Promise} - User profile data
   */
  async getUserProfile() {
    return this.get('/auth/profile');
  }

  /**
   * Register a new user (admin function)
   * @param {Object} userData - User data
   * @returns {Promise} - Registration response
   */
  async registerUser(userData) {
    return this.post('/auth/register', userData);
  }

  /**
   * Change user password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise} - Password change response
   */
  async changePassword(currentPassword, newPassword) {
    return this.post('/auth/change-password', { currentPassword, newPassword });
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise} - Password reset request response
   */
  async requestPasswordReset(email) {
    return this.post('/auth/request-reset', { email });
  }

  /**
   * Complete password reset with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise} - Password reset completion response
   */
  async completePasswordReset(token, newPassword) {
    return this.post('/auth/reset-password', { token, newPassword });
  }

  /**
   * Get user payments
   * @param {number} userId - Optional user ID (defaults to current user)
   * @param {Object} params - Filter parameters
   * @returns {Promise} - User payments
   */
  async getUserPayments(userId, params = {}) {
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    return this.get(endpoint, params);
  }

  /**
   * Initiate a payment
   * @param {Object} paymentData - Payment data
   * @returns {Promise} - Payment initiation response
   */
  async initiatePayment(paymentData) {
    return this.post('/payment/initiate', paymentData);
  }

  /**
   * Get user receipts
   * @param {number} userId - Optional user ID (defaults to current user)
   * @param {Object} params - Filter parameters
   * @returns {Promise} - User receipts
   */
  async getUserReceipts(userId, params = {}) {
    const endpoint = userId ? `/receipt/user/${userId}` : '/receipt/user';
    return this.get(endpoint, params);
  }

  /**
   * Download receipt as PDF
   * @param {number} receiptId - Receipt ID
   * @returns {Promise} - Receipt download
   */
  async downloadReceipt(receiptId) {
    return this.downloadFile(`/receipt/${receiptId}/pdf`, `receipt-${receiptId}.pdf`);
  }

  /**
   * Submit contact form
   * @param {Object} formData - Contact form data
   * @returns {Promise} - Contact form submission response
   */
  async submitContactForm(formData) {
    return this.post('/contact/submit', formData);
  }

  /**
   * Get contact information
   * @returns {Promise} - Contact information
   */
  async getContactInfo() {
    return this.get('/contact/info');
  }
  
  /**
   * Get all users (admin function)
   * @returns {Promise} - All users
   */
  async getAllUsers() {
    return this.get('/auth/users');
  }
  
  /**
   * Get dashboard statistics (admin function)
   * @returns {Promise} - Dashboard statistics
   */
  async getDashboardStats() {
    return this.get('/admin/dashboard-stats');
  }
  
  /**
   * Generate report (admin function)
   * @param {Object} reportParams - Report parameters
   * @returns {Promise} - Report generation response
   */
  async generateReport(reportParams) {
    return this.post('/admin/generate-report', reportParams);
  }
}

// Create global instance
window.apiService = new ApiService();

// Export both the class and the instance
export default window.apiService;