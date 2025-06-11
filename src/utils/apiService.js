// src/utils/apiService.js

/**
 * ========================================================================================================
 * COMPREHENSIVE API SERVICE FOR TASSIA CENTRAL SDA CHURCH FINANCIAL MANAGEMENT SYSTEM
 * ========================================================================================================
 * 
 * This service handles ALL communication between the frontend and backend for a comprehensive
 * church financial management system. It provides a complete abstraction layer over the REST API.
 * 
 * SYSTEM OVERVIEW:
 * ================
 * - Full authentication and user management with role-based access control
 * - Multi-gateway payment processing (KCB Bank primary, M-Pesa backup)
 * - Comprehensive batch payment processing for bulk operations
 * - Advanced wallet management with multi-admin approval workflows
 * - Special offerings management with progress tracking
 * - Automated receipt generation and management
 * - Contact inquiry management system
 * - Comprehensive admin dashboard with analytics and reporting
 * - Real-time KCB bank transaction synchronization
 * - File upload capabilities for receipts and attachments
 * 
 * PAYMENT GATEWAY INTEGRATION:
 * ============================
 * - KCB (Kenya Commercial Bank) - Primary payment gateway for STK Push
 * - M-Pesa Safaricom - Backup/alternative payment method
 * - Manual entry capabilities for cash/bank transfer payments
 * - Automatic payment status tracking and callback handling
 * 
 * SECURITY FEATURES:
 * ==================
 * - JWT token-based authentication with automatic token management
 * - Role-based access control (Admin vs Regular User)
 * - View-only admin restrictions for sensitive operations
 * - Automatic session management and logout on token expiry
 * - Secure file upload validation and handling
 * 
 * RESPONSE FORMATS:
 * =================
 * All API responses follow a standardized format:
 * Success Response: { success: true, data: {...}, message: "Operation successful" }
 * Error Response: { success: false, message: "Error description", error: { code: "ERROR_CODE", details: {...} } }
 * 
 * @author Church Financial Management Development Team
 * @version 2.0.0 - Enhanced with KCB Integration and Batch Processing
 * @lastUpdated June 2025
 */
export class ApiService {
  /**
   * ========================================================================================================
   * CONSTRUCTOR AND INITIALIZATION
   * ========================================================================================================
   * 
   * Initializes the API service with configuration and loads stored authentication
   * Sets up base URLs, timeouts, file upload constraints, and loads any existing auth tokens
   */
  constructor() {
    // Base API URL - Vite proxy handles development routing
    this.baseUrl = '/api';
    
    // Authentication state
    this.token = null;  // JWT authentication token
    this.user = null;   // Current logged-in user object
    
    // Request timeout configuration (in milliseconds)
    this.defaultTimeout = 30000;   // 30 seconds for standard requests
    this.uploadTimeout = 120000;   // 2 minutes for file uploads
    this.downloadTimeout = 60000;  // 1 minute for file downloads
    
    // File upload constraints and validation
    this.supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    this.supportedDocumentTypes = ['application/pdf'];
    this.maxFileSize = 5 * 1024 * 1024; // 5MB maximum file size
    
    // Payment processing constants
    this.SUPPORTED_PAYMENT_METHODS = ['KCB', 'MPESA', 'MANUAL'];
    this.DEFAULT_PAYMENT_METHOD = 'KCB'; // KCB is preferred gateway
    this.SUPPORTED_PAYMENT_TYPES = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL', 'EXPENSE'];
    
    // Load any existing authentication data from localStorage
    this.loadStoredAuth();
    
    console.log('🚀 Church Financial API Service initialized');
    console.log('🔧 Service configuration:', this.getServiceStatus());
  }

  // ================================================================================================
  // AUTHENTICATION STATE MANAGEMENT
  // ================================================================================================

  /**
   * Load authentication data from browser localStorage
   * Automatically called during service initialization to restore user sessions
   * 
   * STORAGE KEYS:
   * - 'authToken': JWT authentication token
   * - 'user': Serialized user object with profile data
   * 
   * ERROR HANDLING:
   * - Catches JSON parsing errors and clears invalid stored data
   * - Logs authentication restoration status for debugging
   */
  loadStoredAuth() {
    try {
      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');
      
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
      this.clearAuth(); // Clear corrupted data
    }
  }

  /**
   * Store authentication data in browser localStorage
   * Called automatically after successful login to persist session
   * 
   * @param {string} token - JWT authentication token from server
   * @param {Object} user - User profile object from server
   * 
   * USER OBJECT STRUCTURE:
   * {
   *   id: number,
   *   username: string,
   *   fullName: string,
   *   email: string|null,
   *   phone: string,
   *   isAdmin: boolean,
   *   role: string,
   *   isActive: boolean,
   *   lastLogin: string|null,
   *   createdAt: string,
   *   updatedAt: string
   * }
   */
  storeAuth(token, user) {
    try {
      this.token = token;
      this.user = user;
      
      // Use 'token' as the key to be consistent with authService.js
      localStorage.setItem('token', token); 
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log('✅ Authentication data stored successfully');
      console.log('👤 User:', user.fullName, '| Admin:', user.isAdmin, '| Role:', user.role);
    } catch (error) {
      console.error('❌ Error storing authentication data:', error);
    }
  }

  /**
 * Add new payment items to an existing batch
 * @param {number} batchId - The ID of the batch to update
 * @param {Object} batchData - The data containing the new payment items
 * @returns {Promise<Object>} The updated batch payment details
 */
async addItemsToBatch(batchId, batchData) {
  console.log(`➕ Adding ${batchData.payments?.length || 0} items to existing batch ID:`, batchId);
  // Corrected line: Use this.post instead of this.request
  return this.post(`/batch-payments/${batchId}/add-items`, batchData);
}

  /**
   * Clear all authentication data from memory and localStorage
   * Called during logout or when authentication becomes invalid
   * 
   * ACTIONS PERFORMED:
   * - Clears in-memory token and user data
   * - Removes data from localStorage
   * - Logs clearance for debugging
   */
  clearAuth() {
    this.token = null;
    this.user = null;
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    console.log('🗑️ Authentication data cleared from storage');
  }

  /**
   * Check if user is currently authenticated
   * 
   * @returns {boolean} True if user has valid token and user data
   * 
   * VALIDATION CRITERIA:
   * - Must have JWT token
   * - Must have user profile data
   * - Does not validate token expiry (handled by server)
   */
  isAuthenticated() {
    const authenticated = !!(this.token && this.user);
    console.log('🔍 Authentication status check:', authenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED');
    return authenticated;
  }

  /**
   * Check if current user has administrator privileges
   * 
   * @returns {boolean} True if user is authenticated and has admin role
   * 
   * ADMIN PRIVILEGES INCLUDE:
   * - User management (create, update, delete)
   * - Payment management (manual entry, status updates)
   * - System reporting and analytics
   * - Special offering management
   * - Batch payment processing
   * - Wallet and withdrawal management
   */
  isAdmin() {
    const admin = !!(this.user && this.user.isAdmin);
    console.log('👑 Admin privileges check:', admin ? 'ADMIN USER' : 'REGULAR USER');
    return admin;
  }

  /**
   * Get current authenticated user profile
   * 
   * @returns {Object|null} User profile object or null if not authenticated
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Get current JWT authentication token
   * 
   * @returns {string|null} JWT token or null if not authenticated
   */
  getToken() {
    return this.token;
  }

  /**
   * Generate HTTP headers for API requests with automatic authentication
   * 
   * @param {boolean} isFormData - Set to true for file uploads (omits Content-Type)
   * @returns {Object} Headers object for fetch requests
   * 
   * GENERATED HEADERS:
   * - Content-Type: application/json (for non-FormData requests)
   * - Authorization: Bearer {token} (when authenticated)
   * 
   * FORMDATA HANDLING:
   * When isFormData=true, Content-Type is omitted to allow browser
   * to set multipart/form-data boundary automatically
   */
  getHeaders(isFormData = false) {
    const headers = {};
    
    // Set content type for JSON requests (browser handles FormData automatically)
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // Add authentication token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log('🔑 Authorization header added to request');
    } else {
      console.warn('⚠️ No authentication token available for request');
    }
    
    return headers;
  }

  /**
   * ========================================================================================================
   * RESPONSE HANDLING AND ERROR MANAGEMENT
   * ========================================================================================================
   * 
   * Comprehensive response handler with detailed error parsing and automatic authentication management
   * Handles both successful and error responses with standardized error objects
   * 
   * @param {Response} response - Fetch API response object
   * @returns {Promise<any>} Parsed response data
   * @throws {Error} Detailed error with status, code, and context information
   * 
   * RESPONSE PROCESSING:
   * 1. Detects content type (JSON vs text)
   * 2. Parses response body appropriately
   * 3. Handles HTTP error status codes
   * 4. Manages 401 Unauthorized (auto-logout)
   * 5. Extracts detailed error information
   * 6. Returns standardized data format
   * 
   * AUTOMATIC 401 HANDLING:
   * When server returns 401 Unauthorized:
   * - Automatically clears stored authentication
   * - Redirects to login page (if not already there)
   * - Prevents authentication loops
   * 
   * ERROR OBJECT STRUCTURE:
   * {
   *   message: string,     // Human-readable error message
   *   code: string,        // Machine-readable error code
   *   status: number,      // HTTP status code
   *   details: any,        // Additional error details from server
   *   response: any,       // Full server response
   *   endpoint: string     // API endpoint that failed
   * }
   * 
   * STANDARDIZED SUCCESS RESPONSE HANDLING:
   * Server responses with { success: true, data: {...}, message: "..." }
   * are automatically unwrapped to return just the data portion
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    let responseData;

    // Parse response body based on content type
    try {
      responseData = isJson ? await response.json() : await response.text();
    } catch (parseError) {
      console.error('❌ Failed to parse API response:', parseError);
      throw new Error(response.ok ? 'Invalid JSON response from server.' : `Request failed with status ${response.status}: ${response.statusText}`);
    }

    // Handle HTTP error status codes
    if (!response.ok) {
      // Special handling for 401 Unauthorized - automatic logout
      if (response.status === 401) {
        console.warn('🔒 Received 401 Unauthorized - clearing authentication and redirecting');
        this.clearAuth();
        
        // Redirect to login page if not already there
        const currentPath = window.location.pathname;
        if (currentPath !== '/login.html' && currentPath !== '/' && currentPath !== '/index.html') {
          console.log('🔄 Redirecting to login page due to authentication failure');
          window.location.href = '/login.html';
        }
      }

      // Extract detailed error information from response
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorCode = `HTTP_ERROR_${response.status}`;
      let errorDetails = null;

      // Parse structured error response
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
      
      console.error('🚨 API Request Failed:', {
        endpoint: error.endpoint,
        status: error.status,
        code: error.code,
        message: error.message,
        details: error.details
      });
      
      throw error;
    }

    // Handle standardized successful response format
    if (responseData && typeof responseData === 'object' && responseData.hasOwnProperty('success')) {
      if (responseData.success === true) {
        // Return data portion of successful response, fallback to message if no data
        return responseData.data !== undefined ? responseData.data : { message: responseData.message };
      } else {
        // Server reported operation failure even with 200 status
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

    // Return raw response data for non-standardized responses (file downloads, etc.)
    return responseData;
  }

  // ================================================================================================
  // AUTHENTICATION AND USER MANAGEMENT API CALLS
  // ================================================================================================

  /**
   * User authentication with username and password
   * Automatically saves authentication data on successful login
   * 
   * @param {string|Object} usernameOrCredentials - Username string or {username, password} object
   * @param {string} [password] - Password (if first param is username string)
   * @returns {Promise<Object>} Authentication response with user data and token
   * 
   * API ENDPOINT: POST /api/auth/login
   * 
   * REQUEST BODY:
   * {
   *   username: string,    // User's login username
   *   password: string     // User's password
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     user: {
   *       id: number,
   *       username: string,
   *       fullName: string,
   *       email: string|null,
   *       phone: string,
   *       isAdmin: boolean,
   *       role: string,
   *       isActive: boolean,
   *       lastLogin: string|null,
   *       createdAt: string,
   *       updatedAt: string
   *     },
   *     token: string       // JWT authentication token
   *   },
   *   message: "Login successful"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed (missing username/password)
   * - 401: Invalid credentials or inactive account
   * - 500: Server error
   * 
   * AUTOMATIC ACTIONS ON SUCCESS:
   * - Stores JWT token in memory and localStorage
   * - Stores user profile in memory and localStorage
   * - Updates lastLogin timestamp on server
   * 
   * USAGE EXAMPLES:
   * await apiService.login('john.doe', 'mypassword');
   * await apiService.login({username: 'john.doe', password: 'mypassword'});
   */
  async login(usernameOrCredentials, password) {
    let username, pwd;
    
    // Handle both object and separate parameter formats for flexibility
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
      credentials: 'include', // Include cookies for session management
    });
    
    const data = await this.handleResponse(response);
    
    // Automatically store authentication data on successful login
    if (data && data.user && data.token) {
      this.storeAuth(data.token, data.user);
      console.log('✅ Authentication successful for user:', data.user.fullName);
      console.log('👤 User role:', data.user.isAdmin ? 'Administrator' : 'Regular User');
    }
    
    return data;
  }

  /**
   * User logout with automatic cleanup and redirection
   * Clears local storage and redirects to login page
   * 
   * API ENDPOINT: GET /api/auth/logout
   * 
   * ACTIONS PERFORMED:
   * 1. Sends logout request to server (if authenticated)
   * 2. Clears JWT token from memory and localStorage
   * 3. Clears user profile from memory and localStorage
   * 4. Redirects browser to login page
   * 5. Handles logout gracefully even if server request fails
   * 
   * ERROR HANDLING:
   * - Continues with cleanup even if server logout fails
   * - Always redirects to login page regardless of server response
   * - Logs warnings for failed server logout but doesn't throw errors
   */
  async logout() {
    console.log('👋 Initiating user logout process');
    
    try {
      // Attempt server-side logout if token exists
      if (this.token) {
        console.log('📡 Sending logout request to server');
        await this.get('/auth/logout');
        console.log('✅ Server logout successful');
      }
    } catch (error) {
      console.warn('⚠️ Server logout request failed:', error.message);
      // Continue with local cleanup regardless of server response
    } finally {
      // Always clear local authentication data
      console.log('🧹 Clearing local authentication data');
      this.clearAuth();
      
      // Redirect to login page
      console.log('🔄 Redirecting to login page');
      window.location.href = '/login.html';
    }
  }

  /**
   * Get current user's detailed profile information
   * Refreshes user data from server (useful for profile updates)
   * 
   * @returns {Promise<Object>} Current user's profile data
   * 
   * API ENDPOINT: GET /api/auth/profile
   * AUTHENTICATION: Required (JWT token)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     user: {
   *       id: number,
   *       username: string,
   *       fullName: string,
   *       email: string|null,
   *       phone: string,
   *       isAdmin: boolean,
   *       role: string,
   *       lastLogin: string|null,
   *       isActive: boolean,
   *       createdAt: string,
   *       updatedAt: string
   *     }
   *   },
   *   message: "Profile retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 401: Authentication required or token expired
   * - 404: User not found (rare, indicates data corruption)
   * - 500: Server error
   * 
   * USAGE:
   * const profile = await apiService.getUserProfile();
   * console.log('User email:', profile.user.email);
   */
  async getUserProfile() {
    console.log('👤 Fetching current user profile from server');
    return this.get('/auth/profile');
  }

  /**
   * Change current user's password with validation
   * Requires current password for security verification
   * 
   * @param {string} currentPassword - User's existing password
   * @param {string} newPassword - New password (must meet security requirements)
   * @returns {Promise<Object>} Password change confirmation
   * 
   * API ENDPOINT: POST /api/auth/change-password
   * AUTHENTICATION: Required (JWT token)
   * 
   * REQUEST BODY:
   * {
   *   currentPassword: string,    // Current password for verification
   *   newPassword: string         // New password (min 8 chars, 1 number, 1 uppercase)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   message: "Password changed successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed (weak password, missing fields)
   * - 401: Current password incorrect or authentication required
   * - 500: Server error
   * 
   * PASSWORD REQUIREMENTS:
   * - Minimum 8 characters
   * - At least one number
   * - At least one uppercase letter
   * - Must be different from current password
   * 
   * SECURITY FEATURES:
   * - Requires current password verification
   * - Server validates password strength
   * - Does not return new password in response
   */
  async changePassword(currentPassword, newPassword) {
    console.log('🔒 Initiating password change for current user');
    return this.post('/auth/change-password', { currentPassword, newPassword });
  }

  // ================================================================================================
  // ADMIN USER MANAGEMENT API CALLS
  // ================================================================================================

  /**
   * Get all users in the system with their profile information
   * Admin-only endpoint for user management
   * 
   * @returns {Promise<Object>} List of all users with profile data
   * 
   * API ENDPOINT: GET /api/auth/users
   * AUTHENTICATION: Required (Admin only)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     users: [
   *       {
   *         id: number,
   *         username: string,
   *         fullName: string,
   *         email: string|null,
   *         phone: string,
   *         isAdmin: boolean,
   *         role: string,
   *         lastLogin: string|null,
   *         isActive: boolean,
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more users
   *     ]
   *   },
   *   message: "Users retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 401: Authentication required
   * - 403: Admin privileges required
   * - 500: Server error
   * 
   * DATA SECURITY:
   * - Password fields are never included in response
   * - Reset tokens and sensitive data are excluded
   * - Ordered by creation date (newest first)
   */
  async getAllUsers() {
    console.log('👥 Fetching all system users (Admin operation)');
    return this.get('/auth/users');
  }

  /**
   * Register a new user in the system
   * Admin-only endpoint for creating user accounts
   * 
   * @param {Object} userData - New user information
   * @returns {Promise<Object>} Created user profile (without password)
   * 
   * API ENDPOINT: POST /api/auth/register
   * AUTHENTICATION: Required (Admin only)
   * 
   * REQUEST BODY:
   * {
   *   username: string,           // Unique username (min 3 chars, alphanumeric + _ -)
   *   password: string,           // Password (min 8 chars, 1 number, 1 uppercase)
   *   fullName: string,           // User's full name
   *   phone: string,              // Mobile phone number
   *   email: string|null,         // Email address (optional)
   *   isAdmin: boolean           // Admin privileges (optional, default: false)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     user: {
   *       id: number,
   *       username: string,
   *       fullName: string,
   *       email: string|null,
   *       phone: string,
   *       isAdmin: boolean,
   *       role: string,
   *       isActive: boolean,
   *       createdAt: string,
   *       updatedAt: string
   *     }
   *   },
   *   message: "User registered successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, duplicate username/email/phone, admin limit reached
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 500: Server error
   * 
   * VALIDATION RULES:
   * - Username: 3+ chars, unique, alphanumeric + underscore/hyphen only
   * - Password: 8+ chars, 1 number, 1 uppercase letter
   * - Phone: Valid mobile format, unique
   * - Email: Valid email format, unique (if provided)
   * 
   * ADMIN LIMITS:
   * - Maximum admin count enforced (default: 5)
   * - View-only admins cannot create new users
   * 
   * USAGE:
   * const newUser = await apiService.registerUser({
   *   username: 'john.doe',
   *   password: 'SecurePass123',
   *   fullName: 'John Doe',
   *   phone: '0712345678',
   *   email: 'john@example.com',
   *   isAdmin: false
   * });
   */
  async registerUser(userData) {
    console.log('➕ Registering new user:', userData.username);
    console.log('👤 User type:', userData.isAdmin ? 'Administrator' : 'Regular User');
    return this.post('/auth/register', userData);
  }

  /**
   * Update existing user information
   * Admin-only endpoint for modifying user profiles
   * 
   * @param {number} userId - ID of user to update
   * @param {Object} userData - Updated user information
   * @returns {Promise<Object>} Updated user profile
   * 
   * API ENDPOINT: PUT /api/auth/users/{userId}
   * AUTHENTICATION: Required (Admin only)
   * 
   * REQUEST BODY (all fields optional):
   * {
   *   fullName: string,          // Updated full name
   *   phone: string,             // Updated phone number
   *   email: string|null,        // Updated email address
   *   isAdmin: boolean,          // Admin privilege change
   *   isActive: boolean,         // Account activation status
   *   role: string               // User role designation
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     user: {
   *       id: number,
   *       username: string,       // Username cannot be changed
   *       fullName: string,
   *       email: string|null,
   *       phone: string,
   *       isAdmin: boolean,
   *       role: string,
   *       isActive: boolean,
   *       createdAt: string,
   *       updatedAt: string       // Updated timestamp
   *     }
   *   },
   *   message: "User updated successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, admin limits, self-restriction violations
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: User not found
   * - 500: Server error
   * 
   * BUSINESS RULES:
   * - Cannot change username (system constraint)
   * - Admin cannot demote themselves if they're the last admin
   * - Admin cannot deactivate their own account
   * - Maximum admin count enforced
   * - Phone and email must be unique
   * - View-only admins cannot update users
   * 
   * ADMIN PROMOTION/DEMOTION:
   * - When promoting to admin: checks admin limit
   * - When demoting from admin: ensures at least one admin remains
   * - Logs admin role changes for audit trail
   */
  async updateUser(userId, userData) {
    console.log('✏️ Updating user profile for user ID:', userId);
    console.log('📝 Update fields:', Object.keys(userData));
    return this.put(`/auth/users/${userId}`, userData);
  }

  /**
   * Delete or deactivate user account
   * Admin-only endpoint for user removal (hard delete)
   * 
   * @param {number} userId - ID of user to delete
   * @returns {Promise<Object>} Deletion confirmation
   * 
   * API ENDPOINT: DELETE /api/auth/users/{userId}
   * AUTHENTICATION: Required (Admin only)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     userId: number,
   *     status: "deleted_permanently"
   *   },
   *   message: "User permanently deleted"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Cannot delete last admin, cannot delete self
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: User not found
   * - 500: Server error
   * 
   * BUSINESS RULES:
   * - Admin cannot delete their own account
   * - Cannot delete the last active admin
   * - Performs hard delete (permanently removes user)
   * - View-only admins cannot delete users
   * 
   * DATA HANDLING:
   * - User data is permanently removed from database
   * - Associated payment records remain (for audit trail)
   * - Username becomes available for reuse
   * 
   * SECURITY CONSIDERATIONS:
   * - Irreversible operation
   * - Logs deletion action for audit
   * - Requires admin authentication
   */
  async deleteUser(userId) {
    console.log('🗑️ Deleting user account with ID:', userId);
    console.warn('⚠️ This is a permanent deletion operation');
    return this.delete(`/auth/users/${userId}`);
  }

  /**
   * Reset user password by administrator
   * Admin-only endpoint for password resets (bypasses current password requirement)
   * 
   * @param {number} userId - ID of user whose password to reset
   * @param {string} newPassword - New password to set
   * @returns {Promise<Object>} Password reset confirmation
   * 
   * API ENDPOINT: POST /api/auth/reset-password/{userId}
   * AUTHENTICATION: Required (Admin only)
   * 
   * REQUEST BODY:
   * {
   *   newPassword: string        // New password (must meet security requirements)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   message: "User password reset successfully by admin"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, admin trying to reset own password via this route
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: User not found
   * - 500: Server error
   * 
   * SECURITY FEATURES:
   * - Requires admin authentication
   * - Does not require user's current password
   * - Clears any existing reset tokens
   * - Logs admin password reset action
   * - View-only admins cannot reset passwords
   * 
   * BUSINESS RULES:
   * - Admin cannot use this to reset their own password (use changePassword instead)
   * - New password must meet security requirements
   * - User will need to use new password on next login
   * 
   * PASSWORD REQUIREMENTS:
   * - Minimum 8 characters
   * - At least one number
   * - At least one uppercase letter
   */
  async adminResetUserPassword(userId, newPassword) {
    console.log('🔐 Admin resetting password for user ID:', userId);
    console.log('⚠️ User will need to use new password on next login');
    return this.post(`/auth/reset-password/${userId}`, { newPassword });
  }

  // ================================================================================================
  // PAYMENT PROCESSING API CALLS
  // ================================================================================================

  /**
   * Get user's payment history with filtering and pagination
   * Returns payments for current user or specified user (if admin)
   * 
   * @param {number|null} userId - User ID to fetch payments for (null = current user)
   * @param {Object} params - Query parameters for filtering and pagination
   * @returns {Promise<Object>} Paginated payment history
   * 
   * API ENDPOINT: GET /api/payment/user/{userId?}
   * AUTHENTICATION: Required
   * AUTHORIZATION: Own payments or admin for any user
   * 
   * QUERY PARAMETERS:
   * {
   *   page: number,              // Page number (default: 1)
   *   limit: number,             // Items per page (default: 10, max: 100)
   *   startDate: string,         // Filter start date (ISO 8601 format)
   *   endDate: string,           // Filter end date (ISO 8601 format)
   *   paymentType: string,       // Filter by payment type (TITHE, OFFERING, etc.)
   *   status: string,            // Filter by status (PENDING, COMPLETED, FAILED)
   *   search: string             // Search in description, reference, receipt number
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     payments: [
   *       {
   *         id: number,
   *         amount: number,
   *         paymentType: string,         // TITHE, OFFERING, DONATION, SPECIAL_OFFERING_CONTRIBUTION
   *         paymentMethod: string,       // KCB, MPESA, MANUAL
   *         description: string,
   *         status: string,              // PENDING, COMPLETED, FAILED, CANCELLED
   *         paymentDate: string,
   *         receiptNumber: string|null,
   *         reference: string|null,
   *         transactionId: string|null,
   *         platformFee: number,
   *         titheDistributionSDA: Object|null,
   *         specialOffering: {           // If payment is for special offering
   *           id: number,
   *           name: string,
   *           offeringCode: string
   *         }|null,
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more payments
   *     ],
   *     totalPages: number,
   *     currentPage: number,
   *     totalPayments: number
   *   },
   *   message: "User payments retrieved successfully"
   * }
   * 
   * TITHE DISTRIBUTION STRUCTURE:
   * {
   *   campMeetingExpenses: boolean,
   *   welfare: boolean,
   *   thanksgiving: boolean,
   *   stationFund: boolean,
   *   mediaMinistry: boolean
   * }
   * 
   * USAGE EXAMPLES:
   * // Get current user's payments
   * const myPayments = await apiService.getUserPayments();
   * 
   * // Get specific user's payments (admin only)
   * const userPayments = await apiService.getUserPayments(123);
   * 
   * // Get filtered payments
   * const tithePayments = await apiService.getUserPayments(null, {
   *   paymentType: 'TITHE',
   *   startDate: '2024-01-01',
   *   page: 1,
   *   limit: 20
   * });
   */
  async getUserPayments(userId = null, params = {}) {
    const endpoint = userId ? `/payment/user/${userId}` : '/payment/user';
    console.log('💰 Fetching payment history for user:', userId || 'current user');
    console.log('🔍 Filter parameters:', params);
    return this.get(endpoint, params);
  }

  /**
   * Check payment status by payment ID
   * Returns current status and details of a specific payment
   * 
   * @param {number} paymentId - ID of payment to check
   * @returns {Promise<Object>} Payment status and details
   * 
   * API ENDPOINT: GET /api/payment/status/{paymentId}
   * AUTHENTICATION: Required
   * AUTHORIZATION: Own payments or admin for any payment
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     id: number,
   *     status: string,              // PENDING, COMPLETED, FAILED, CANCELLED
   *     amount: number,
   *     paymentType: string,
   *     paymentMethod: string,
   *     description: string,
   *     paymentDate: string,
   *     reference: string|null,
   *     transactionId: string|null,
   *     receiptNumber: string|null,
   *     userId: number
   *   },
   *   message: "Payment status retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid payment ID format
   * - 401: Authentication required
   * - 403: Cannot access other user's payment (non-admin)
   * - 404: Payment not found
   * - 500: Server error
   * 
   * PAYMENT STATUSES:
   * - PENDING: Payment initiated, awaiting gateway response
   * - COMPLETED: Payment successful, receipt generated
   * - FAILED: Payment failed at gateway level
   * - CANCELLED: Payment cancelled by user or admin
   * 
   * USAGE:
   * const status = await apiService.getPaymentStatus(12345);
   * if (status.status === 'COMPLETED') {
   *   console.log('Payment successful! Receipt:', status.receiptNumber);
   * }
   */
  async getPaymentStatus(paymentId) {
    console.log('🔍 Checking payment status for payment ID:', paymentId);
    return this.get(`/payment/status/${paymentId}`);
  }

  /**
   * Initiate a new payment using KCB or M-Pesa gateway
   * KCB is the primary payment method, M-Pesa is backup/alternative
   * 
   * @param {Object} paymentData - Payment information and gateway details
   * @returns {Promise<Object>} Payment initiation response with gateway details
   * 
   * API ENDPOINT: POST /api/payment/initiate
   * AUTHENTICATION: Required
   * 
   * REQUEST BODY:
   * {
   *   amount: number,                    // Payment amount (positive number)
   *   paymentType: string,               // TITHE, OFFERING, DONATION, SPECIAL
   *   paymentMethod: string,             // KCB (default), MPESA
   *   phoneNumber: string,               // Mobile number for STK push
   *   description: string,               // Payment description (optional)
   *   specialOfferingId: number,         // Required if paymentType = SPECIAL
   *   titheDistributionSDA: {           // Required if paymentType = TITHE
   *     campMeetingExpenses: boolean,
   *     welfare: boolean,
   *     thanksgiving: boolean,
   *     stationFund: boolean,
   *     mediaMinistry: boolean
   *   }
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     paymentId: number,               // Internal payment record ID
   *     checkoutRequestId: string,       // Gateway checkout request ID
   *     paymentMethod: string            // KCB or MPESA
   *   },
   *   message: "KCB payment initiated. Check your phone." // Gateway-specific message
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, invalid amount, missing required fields
   * - 401: Authentication required
   * - 404: Special offering not found/inactive
   * - 500: Payment gateway error or server error
   * 
   * PAYMENT PROCESSING FLOW:
   * 1. Validates payment data and user authentication
   * 2. Creates pending payment record in database
   * 3. Initiates STK push with selected gateway (KCB/M-Pesa)
   * 4. Returns gateway response with checkout ID
   * 5. User completes payment on mobile device
   * 6. Gateway sends callback to update payment status
   * 7. Receipt generated automatically on successful payment
   * 
   * PHONE NUMBER FORMAT:
   * - Accepts: 0712345678, 712345678, 254712345678, +254712345678
   * - Converts to: 254712345678 (standard format)
   * 
   * TITHE DISTRIBUTION:
   * When paymentType = TITHE, the titheDistributionSDA object specifies
   * which SDA categories this tithe should support. Each category is a boolean.
   * 
   * SPECIAL OFFERING PAYMENTS:
   * When paymentType = SPECIAL, specialOfferingId must reference an active
   * special offering campaign.
   * 
   * USAGE EXAMPLES:
   * // KCB Tithe Payment
   * const response = await apiService.initiatePayment({
   *   amount: 1000,
   *   paymentType: 'TITHE',
   *   paymentMethod: 'KCB',
   *   phoneNumber: '0712345678',
   *   description: 'Monthly tithe',
   *   titheDistributionSDA: {
   *     welfare: true,
   *     stationFund: true,
   *     campMeetingExpenses: false,
   *     thanksgiving: false,
   *     mediaMinistry: false
   *   }
   * });
   * 
   * // Special Offering Payment
   * const response = await apiService.initiatePayment({
   *   amount: 500,
   *   paymentType: 'SPECIAL',
   *   paymentMethod: 'KCB',
   *   phoneNumber: '0712345678',
   *   specialOfferingId: 5,
   *   description: 'Building fund contribution'
   * });
   */
  async initiatePayment(paymentData) {
    // Set KCB as default payment method if not specified
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

  /**
   * Initiate M-Pesa payment specifically (legacy method for backward compatibility)
   * 
   * @param {Object} paymentData - Payment information for M-Pesa
   * @returns {Promise<Object>} M-Pesa payment initiation response
   * 
   * API ENDPOINT: POST /api/payment/initiate-mpesa
   * AUTHENTICATION: Required
   * 
   * This method is maintained for backward compatibility. New code should use
   * initiatePayment() with paymentMethod: 'MPESA' instead.
   * 
   * USAGE:
   * const response = await apiService.initiateMpesaPayment({
   *   amount: 1000,
   *   paymentType: 'OFFERING',
   *   phoneNumber: '0712345678'
   * });
   */
  async initiateMpesaPayment(paymentData) {
    console.log('📱 Initiating M-Pesa payment (legacy method)');
    console.log('💰 Amount:', paymentData.amount);
    return this.post('/payment/initiate-mpesa', this.preparePaymentData(paymentData));
  }

  /**
   * Initiate KCB payment specifically
   * 
   * @param {Object} paymentData - Payment information for KCB
   * @returns {Promise<Object>} KCB payment initiation response
   * 
   * API ENDPOINT: POST /api/payment/initiate (with paymentMethod: 'KCB')
   * AUTHENTICATION: Required
   * 
   * This method specifically uses KCB as the payment gateway.
   * KCB is the preferred gateway due to lower fees and better integration.
   * 
   * USAGE:
   * const response = await apiService.initiateKcbPayment({
   *   amount: 2000,
   *   paymentType: 'TITHE',
   *   phoneNumber: '0712345678',
   *   titheDistributionSDA: { welfare: true, stationFund: false }
   * });
   */
  async initiateKcbPayment(paymentData) {
    const kcbPaymentData = {
      ...paymentData,
      paymentMethod: 'KCB'
    };
    
    console.log('🏦 Initiating KCB payment');
    console.log('💰 Amount:', kcbPaymentData.amount);
    return this.post('/payment/initiate', this.preparePaymentData(kcbPaymentData));
  }

  // ================================================================================================
  // ADMIN PAYMENT MANAGEMENT API CALLS
  // ================================================================================================

  /**
   * Get all payments with advanced filtering and pagination
   * Admin-only endpoint for comprehensive payment management
   * 
   * @param {Object} params - Query parameters for filtering, sorting, and pagination
   * @returns {Promise<Object>} Paginated list of all payments with detailed information
   * 
   * API ENDPOINT: GET /api/payment/all
   * AUTHENTICATION: Required (Admin only)
   * 
   * QUERY PARAMETERS:
   * {
   *   page: number,                    // Page number (default: 1)
   *   limit: number,                   // Items per page (default: 20, max: 100)
   *   startDate: string,               // Filter start date (ISO format)
   *   endDate: string,                 // Filter end date (ISO format)
   *   paymentType: string,             // TITHE, OFFERING, DONATION, SPECIAL_OFFERING_CONTRIBUTION
   *   userId: number,                  // Filter by specific user
   *   department: string,              // Filter by department (for expenses)
   *   status: string,                  // PENDING, COMPLETED, FAILED, CANCELLED
   *   search: string,                  // Search in description, reference, receipt, user name
   *   specialOfferingId: number,       // Filter by special offering
   *   titheCategory: string            // Filter by tithe category
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     payments: [
   *       {
   *         id: number,
   *         amount: number,
   *         paymentType: string,
   *         paymentMethod: string,
   *         description: string,
   *         status: string,
   *         paymentDate: string,
   *         receiptNumber: string|null,
   *         reference: string|null,
   *         transactionId: string|null,
   *         platformFee: number,
   *         isExpense: boolean,
   *         department: string|null,
   *         titheDistributionSDA: Object|null,
   *         user: {                      // Payment creator information
   *           id: number,
   *           username: string,
   *           fullName: string,
   *           phone: string,
   *           email: string|null
   *         },
   *         specialOffering: {           // If applicable
   *           id: number,
   *           name: string,
   *           offeringCode: string,
   *           description: string
   *         }|null,
   *         processor: {                 // Admin who processed (if manual)
   *           id: number,
   *           username: string,
   *           fullName: string
   *         }|null,
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more payments
   *     ],
   *     totalPages: number,
   *     currentPage: number,
   *     totalPayments: number
   *   },
   *   message: "Payments retrieved successfully"
   * }
   * 
   * ADVANCED SEARCH CAPABILITIES:
   * - Text search across description, reference, transaction ID, receipt number
   * - User search by full name or username
   * - Special offering search by name
   * - Amount search (exact match)
   * 
   * FILTERING OPTIONS:
   * - Date range filtering with start/end dates
   * - Payment type and method filtering
   * - User-specific payment history
   * - Department filtering for expense tracking
   * - Status-based filtering for payment processing
   * - Special offering campaign filtering
   * - Tithe category filtering for SDA designations
   * 
   * USAGE EXAMPLES:
   * // Get all payments from last month
   * const lastMonthPayments = await apiService.getAllAdminPayments({
   *   startDate: '2024-05-01',
   *   endDate: '2024-05-31',
   *   page: 1,
   *   limit: 50
   * });
   * 
   * // Get all failed payments for troubleshooting
   * const failedPayments = await apiService.getAllAdminPayments({
   *   status: 'FAILED'
   * });
   * 
   * // Search for specific user's tithe payments
   * const userTithes = await apiService.getAllAdminPayments({
   *   userId: 123,
   *   paymentType: 'TITHE'
   * });
   */
  async getAllAdminPayments(params = {}) {
    console.log('📊 Fetching all payments for admin review');
    console.log('🔍 Filter parameters:', params);
    return this.get('/payment/all', params);
  }

  /**
   * Get comprehensive payment statistics and analytics
   * Admin-only endpoint for financial reporting and dashboard
   * 
   * @returns {Promise<Object>} Comprehensive payment statistics and trends
   * 
   * API ENDPOINT: GET /api/payment/stats
   * AUTHENTICATION: Required (Admin only)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     revenue: number,                 // Total completed revenue (non-expense)
   *     expenses: number,                // Total completed expenses
   *     netBalance: number,              // Revenue minus expenses
   *     platformFees: number,            // Total platform fees collected
   *     monthlyData: [                   // Last 12 months financial summary
   *       {
   *         month: string,               // YYYY-MM format
   *         revenue: number,
   *         expenses: number,
   *         net: number                  // Revenue minus expenses for month
   *       },
   *       // ... 11 more months
   *     ],
   *     paymentsByType: [                // Revenue breakdown by payment type
   *       {
   *         type: string,                // TITHE, OFFERING, DONATION, etc.
   *         total: number
   *       },
   *       // ... more payment types
   *     ],
   *     expensesByDepartment: [          // Expense breakdown by department
   *       {
   *         department: string,
   *         total: number
   *       },
   *       // ... more departments
   *     ],
   *     pendingInquiries: number         // Count of pending contact inquiries
   *   },
   *   message: "Payment statistics retrieved successfully"
   * }
   * 
   * DATA CALCULATION METHODS:
   * - Only includes COMPLETED payments (excludes PENDING, FAILED, CANCELLED)
   * - Excludes template payments (isTemplate: false)
   * - Monthly data covers last 12 months from current date
   * - Revenue excludes expense payments (isExpense: false)
   * - Expenses include only expense payments (isExpense: true)
   * - Platform fees include all gateway fees collected
   * 
   * DASHBOARD USAGE:
   * This endpoint provides all key metrics for admin dashboard display:
   * - Financial summary cards (revenue, expenses, net balance)
   * - Monthly trend charts for revenue and expenses
   * - Payment type distribution charts
   * - Department expense breakdown
   * - Operational metrics (pending inquiries)
   * 
   * USAGE:
   * const stats = await apiService.getPaymentStats();
   * console.log('Total revenue:', stats.revenue);
   * console.log('Net balance:', stats.netBalance);
   * console.log('This month revenue:', stats.monthlyData[stats.monthlyData.length - 1].revenue);
   */
  async getPaymentStats() {
    console.log('📈 Fetching comprehensive payment statistics for admin dashboard');
    return this.get('/payment/stats');
  }

  /**
   * Add manual payment entry to the system
   * Admin-only endpoint for recording offline payments (cash, bank transfer, etc.)
   * 
   * @param {Object} paymentData - Manual payment information
   * @returns {Promise<Object>} Created payment record with receipt information
   * 
   * API ENDPOINT: POST /api/payment/manual
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   userId: number,                    // ID of user making payment
   *   amount: number,                    // Payment amount (positive number)
   *   paymentType: string,               // TITHE, OFFERING, DONATION, EXPENSE, SPECIAL_OFFERING_[ID], [number]
   *   description: string,               // Payment description (optional)
   *   paymentDate: string,               // Payment date (ISO format, optional - defaults to now)
   *   paymentMethod: string,             // MANUAL, CASH, BANK_TRANSFER, CHEQUE (default: MANUAL)
   *   isExpense: boolean,                // true for expense entries (default: false)
   *   department: string,                // Required if isExpense = true
   *   titheDistributionSDA: {           // Required if paymentType = TITHE
   *     campMeetingExpenses: boolean,
   *     welfare: boolean,
   *     thanksgiving: boolean,
   *     stationFund: boolean,
   *     mediaMinistry: boolean
   *   },
   *   specialOfferingId: number,         // Required if paymentType = SPECIAL_OFFERING_CONTRIBUTION
   *   reference: string                  // External reference number (optional)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     payment: {
   *       id: number,
   *       userId: number,
   *       amount: number,
   *       paymentType: string,
   *       paymentMethod: string,
   *       description: string,
   *       status: "COMPLETED",            // Manual payments are immediately completed
   *       paymentDate: string,
   *       receiptNumber: string,          // Auto-generated receipt number
   *       processedById: number,          // Admin who created the entry
   *       isExpense: boolean,
   *       department: string|null,
   *       specialOfferingId: number|null,
   *       titheDistributionSDA: Object|null,
   *       reference: string|null,
   *       createdAt: string,
   *       updatedAt: string
   *     }
   *   },
   *   message: "Manual payment added successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, missing required fields, invalid payment type
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: User not found, special offering not found/inactive
   * - 500: Server error
   * 
   * AUTOMATIC PROCESSING:
   * - Payment status is immediately set to COMPLETED
   * - Receipt is automatically generated for non-expense payments
   * - Receipt number is auto-generated using system format
   * - Admin ID is recorded as processor
   * - Payment date defaults to current timestamp if not provided
   * 
   * PAYMENT TYPE HANDLING:
   * - Standard types: TITHE, OFFERING, DONATION, EXPENSE
   * - Special offering format: SPECIAL_OFFERING_[ID] or numeric ID
   * - System automatically converts special offering IDs to proper format
   * - Validates special offering exists and is active
   * 
   * EXPENSE PAYMENTS:
   * - Require department specification
   * - Can include expense receipt file upload (separate endpoint)
   * - Do not generate standard receipts
   * - Tracked separately in expense reporting
   * 
   * USAGE EXAMPLES:
   * // Record cash tithe payment
   * const tithePayment = await apiService.addManualPayment({
   *   userId: 123,
   *   amount: 1000,
   *   paymentType: 'TITHE',
   *   paymentMethod: 'CASH',
   *   description: 'Weekly tithe - cash',
   *   titheDistributionSDA: {
   *     welfare: true,
   *     stationFund: true,
   *     campMeetingExpenses: false,
   *     thanksgiving: false,
   *     mediaMinistry: false
   *   }
   * });
   * 
   * // Record bank transfer for special offering
   * const offeringPayment = await apiService.addManualPayment({
   *   userId: 456,
   *   amount: 5000,
   *   paymentType: 'SPECIAL_OFFERING_5',
   *   paymentMethod: 'BANK_TRANSFER',
   *   description: 'Building fund - bank transfer',
   *   reference: 'BT20240615001'
   * });
   * 
   * // Record expense payment
   * const expensePayment = await apiService.addManualPayment({
   *   userId: 789,
   *   amount: 2500,
   *   paymentType: 'EXPENSE',
   *   paymentMethod: 'CASH',
   *   description: 'Office supplies purchase',
   *   isExpense: true,
   *   department: 'Administration'
   * });
   */
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

  /**
   * Add manual payment with expense receipt file attachment
   * Admin-only endpoint for recording expenses with supporting documentation
   * 
   * @param {Object} paymentData - Payment information
   * @param {File} receiptFile - Receipt image or PDF file
   * @returns {Promise<Object>} Created payment record with file attachment info
   * 
   * API ENDPOINT: POST /api/payment/manual (with multipart/form-data)
   * AUTHENTICATION: Required (Admin only)
   * 
   * FORM DATA FIELDS:
   * - All fields from addManualPayment()
   * - expenseReceiptImage: File (JPEG, PNG, or PDF, max 5MB)
   * 
   * FILE UPLOAD CONSTRAINTS:
   * - Supported formats: JPEG, PNG, PDF
   * - Maximum file size: 5MB
   * - File is stored on server with secure filename
   * - File path is saved in payment record
   * 
   * SUCCESS RESPONSE:
   * Same as addManualPayment() with additional:
   * {
   *   data: {
   *     payment: {
   *       // ... standard payment fields
   *       expenseReceiptUrl: string    // Path to uploaded receipt file
   *     }
   *   }
   * }
   * 
   * USAGE:
   * const fileInput = document.getElementById('receiptFile');
   * const receiptFile = fileInput.files[0];
   * 
   * const payment = await apiService.addManualPaymentWithReceipt({
   *   userId: 123,
   *   amount: 500,
   *   paymentType: 'EXPENSE',
   *   description: 'Office supplies',
   *   isExpense: true,
   *   department: 'Administration'
   * }, receiptFile);
   */
  async addManualPaymentWithReceipt(paymentData, receiptFile) {
    console.log('📄 Adding manual payment with receipt attachment');
    console.log('💰 Amount:', paymentData.amount);
    console.log('📎 File:', receiptFile ? receiptFile.name : 'No file');
    
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
   * Update payment status and processing information
   * Admin-only endpoint for managing payment lifecycle
   * 
   * @param {number} paymentId - ID of payment to update
   * @param {string} status - New payment status
   * @returns {Promise<Object>} Updated payment record
   * 
   * API ENDPOINT: PUT /api/payment/{paymentId}/status
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   status: string                   // PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED
   * }
   * 
   * VALID STATUS TRANSITIONS:
   * - PENDING → COMPLETED, FAILED, CANCELLED
   * - FAILED → PENDING (for retry), CANCELLED
   * - COMPLETED → REFUNDED (rare, requires special handling)
   * - CANCELLED → Cannot be changed (final state)
   * - REFUNDED → Cannot be changed (final state)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     payment: {
   *       id: number,
   *       status: string,              // Updated status
   *       amount: number,
   *       paymentType: string,
   *       paymentMethod: string,
   *       // ... other payment fields
   *       updatedAt: string            // Updated timestamp
   *     }
   *   },
   *   message: "Payment status updated successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid payment ID or status value
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: Payment not found
   * - 500: Server error
   * 
   * BUSINESS LOGIC:
   * - Status changes are logged for audit trail
   * - Receipt generation may be triggered for COMPLETED status
   * - Wallet balances may need manual update after status changes
   * - Platform fees are handled based on final status
   * 
   * USAGE EXAMPLES:
   * // Mark failed payment as completed (after manual verification)
   * await apiService.updatePaymentStatus(12345, 'COMPLETED');
   * 
   * // Cancel a pending payment
   * await apiService.updatePaymentStatus(12346, 'CANCELLED');
   * 
   * // Mark completed payment as refunded
   * await apiService.updatePaymentStatus(12347, 'REFUNDED');
   */
  async updatePaymentStatus(paymentId, status) {
    console.log('🔄 Updating payment status for payment ID:', paymentId);
    console.log('📋 New status:', status);
    return this.put(`/payment/${paymentId}/status`, { status });
  }

  /**
   * Delete payment record from system
   * Admin-only endpoint for removing erroneous or test payments
   * 
   * @param {number} paymentId - ID of payment to delete
   * @returns {Promise<Object>} Deletion confirmation
   * 
   * API ENDPOINT: DELETE /api/payment/{paymentId}
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     paymentId: number
   *   },
   *   message: "Payment and associated receipts deleted successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid payment ID format
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: Payment not found
   * - 500: Server error
   * 
   * CASCADE DELETION:
   * - Associated receipt records are automatically deleted
   * - Payment history is removed from user's record
   * - Wallet balances may need manual adjustment
   * - Audit logs retain deletion record for compliance
   * 
   * USAGE CAUTION:
   * This is a destructive operation that permanently removes payment data.
   * Consider updating status to CANCELLED instead of deletion for audit trail.
   * 
   * USAGE:
   * await apiService.adminDeletePayment(12345);
   */
  async adminDeletePayment(paymentId) {
    console.log('🗑️ Deleting payment record with ID:', paymentId);
    console.warn('⚠️ This permanently removes payment data');
    return this.delete(`/payment/${paymentId}`);
  }

  // ================================================================================================
  // BATCH PAYMENT MANAGEMENT API CALLS
  // ================================================================================================

  /**
   * Create batch payment for bulk processing of multiple payments
   * Admin-only endpoint for efficient bulk payment processing
   * 
   * @param {Object} batchData - Batch payment configuration and payment list
   * @returns {Promise<Object>} Created batch payment with individual payment records
   * 
   * API ENDPOINT: POST /api/batch-payments
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   payments: [                      // Array of payments to process
   *     {
   *       userId: number,              // User making payment
   *       amount: number,              // Payment amount
   *       paymentType: string,         // TITHE, OFFERING, DONATION, EXPENSE, or numeric special offering ID
   *       description: string,         // Payment description (optional)
   *       paymentDate: string,         // Payment date (optional, defaults to now)
   *       isExpense: boolean,          // true for expense payments
   *       department: string,          // Required if isExpense = true
   *       specialOfferingId: number,   // For special offering contributions
   *       titheDistributionSDA: {     // For tithe payments
   *         campMeetingExpenses: boolean,
   *         welfare: boolean,
   *         thanksgiving: boolean,
   *         stationFund: boolean,
   *         mediaMinistry: boolean
   *       }
   *     },
   *     // ... more payments (minimum 1 required)
   *   ],
   *   description: string              // Batch description (optional, max 200 chars)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     batchPayment: {
   *       id: number,
   *       batchReference: string,      // Unique batch identifier (BATCH-timestamp-hash)
   *       totalAmount: number,         // Sum of all payment amounts
   *       totalCount: number,          // Number of payments in batch
   *       status: "PENDING",           // Initial status
   *       description: string,
   *       createdById: number,         // Admin who created batch
   *       createdAt: string,
   *       updatedAt: string
   *     },
   *     paymentsCreated: number,       // Count of successfully created payments
   *     batchReference: string         // Batch reference for tracking
   *   },
   *   message: "Batch payment created successfully with X payments. Ready for KCB deposit."
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, empty payments array, invalid payment data
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: User not found, special offering not found/inactive
   * - 500: Server error during batch processing
   * 
   * BATCH PROCESSING LOGIC:
   * 1. Validates all payments before creating any records
   * 2. Creates batch payment record with unique reference
   * 3. Creates individual payment records linked to batch
   * 4. Calculates total amount and payment count
   * 5. Sets all payments to PENDING status initially
   * 6. Generates batch reference for tracking
   * 
   * PAYMENT VALIDATION (PER PAYMENT):
   * - Valid user ID (user must exist)
   * - Positive payment amount
   * - Valid payment type
   * - Required fields based on payment type (tithe distribution, special offering ID)
   * - Department required for expense payments
   * - Special offering must exist and be active
   * 
   * BATCH REFERENCE FORMAT:
   * BATCH-{timestamp}-{random_hex} (e.g., BATCH-1640995200000-A1B2C3D4)
   * 
   * NEXT STEPS AFTER CREATION:
   * 1. Use processBatchDeposit() to initiate KCB payment for total amount
   * 2. User completes payment on mobile device
   * 3. Use completeBatchPayment() after successful payment callback
   * 4. All individual payments updated to COMPLETED with receipts generated
   * 
   * USAGE EXAMPLE:
   * const batchResult = await apiService.createBatchPayment({
   *   description: 'Weekly collection - January 15, 2024',
   *   payments: [
   *     {
   *       userId: 123,
   *       amount: 1000,
   *       paymentType: 'TITHE',
   *       description: 'Weekly tithe',
   *       titheDistributionSDA: { welfare: true, stationFund: false }
   *     },
   *     {
   *       userId: 456,
   *       amount: 500,
   *       paymentType: 'OFFERING',
   *       description: 'Weekly offering'
   *     },
   *     {
   *       userId: 789,
   *       amount: 2000,
   *       paymentType: '5', // Special offering ID
   *       description: 'Building fund contribution'
   *     }
   *   ]
   * });
   */
  async createBatchPayment(batchData) {
    console.log('📦 Creating batch payment for bulk processing');
    console.log('📊 Batch details:', {
      paymentCount: batchData.payments?.length || 0,
      description: batchData.description
    });
    return this.post('/batch-payments', batchData);
  }

  /**
   * Get all batch payments with filtering and pagination
   * Admin-only endpoint for batch payment management
   * 
   * @param {Object} params - Query parameters for filtering and pagination
   * @returns {Promise<Object>} Paginated list of batch payments
   * 
   * API ENDPOINT: GET /api/batch-payments
   * AUTHENTICATION: Required (Admin only)
   * 
   * QUERY PARAMETERS:
   * {
   *   status: string,                  // PENDING, DEPOSITED, COMPLETED, CANCELLED, ALL (default)
   *   page: number,                    // Page number (default: 1)
   *   limit: number                    // Items per page (default: 20, max: 100)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     batchPayments: [
   *       {
   *         id: number,
   *         batchReference: string,
   *         totalAmount: number,
   *         totalCount: number,
   *         status: string,             // PENDING, DEPOSITED, COMPLETED, CANCELLED
   *         description: string,
   *         creator: {                  // Admin who created batch
   *           id: number,
   *           username: string,
   *           fullName: string
   *         },
   *         processor: {                // Admin who processed deposit (if applicable)
   *           id: number,
   *           username: string,
   *           fullName: string
   *         }|null,
   *         paymentCount: number,       // Count of individual payments
   *         kcbTransactionId: string|null,
   *         kcbReference: string|null,
   *         depositedAt: string|null,
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more batch payments
   *     ],
   *     totalPages: number,
   *     currentPage: number,
   *     totalBatches: number
   *   },
   *   message: "Batch payments retrieved successfully"
   * }
   * 
   * BATCH STATUS DEFINITIONS:
   * - PENDING: Created but not yet deposited via KCB
   * - DEPOSITED: KCB deposit initiated, awaiting confirmation
   * - COMPLETED: All payments processed successfully with receipts
   * - CANCELLED: Batch cancelled before processing
   * 
   * USAGE:
   * // Get all pending batches
   * const pendingBatches = await apiService.getAllBatchPayments({
   *   status: 'PENDING'
   * });
   * 
   * // Get recent batches with pagination
   * const recentBatches = await apiService.getAllBatchPayments({
   *   page: 1,
   *   limit: 10
   * });
   */
  async getAllBatchPayments(params = {}) {
    console.log('📦 Fetching batch payments for admin management');
    console.log('🔍 Filter parameters:', params);
    return this.get('/batch-payments', params);
  }

  /**
   * Get detailed information for specific batch payment
   * Includes all individual payment records within the batch
   * 
   * @param {number} batchId - ID of batch payment to retrieve
   * @returns {Promise<Object>} Detailed batch payment information with individual payments
   * 
   * API ENDPOINT: GET /api/batch-payments/{batchId}
   * AUTHENTICATION: Required (Admin only)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     batchPayment: {
   *       id: number,
   *       batchReference: string,
   *       totalAmount: number,
   *       totalCount: number,
   *       status: string,
   *       description: string,
   *       creator: {
   *         id: number,
   *         username: string,
   *         fullName: string
   *       },
   *       processor: {
   *         id: number,
   *         username: string,
   *         fullName: string
   *       }|null,
   *       kcbTransactionId: string|null,
   *       kcbReference: string|null,
   *       depositedAt: string|null,
   *       createdAt: string,
   *       updatedAt: string,
   *       payments: [                  // Individual payment records in batch
   *         {
   *           id: number,
   *           userId: number,
   *           amount: number,
   *           paymentType: string,
   *           paymentMethod: "BATCH_KCB",
   *           description: string,
   *           status: string,
   *           paymentDate: string,
   *           receiptNumber: string|null,
   *           titheDistributionSDA: Object|null,
   *           user: {
   *             id: number,
   *             username: string,
   *             fullName: string,
   *             phone: string
   *           },
   *           specialOffering: {
   *             name: string,
   *             offeringCode: string
   *           }|null,
   *           batchPaymentId: number,
   *           isBatchProcessed: boolean,
   *           bankDepositStatus: string,
   *           createdAt: string
   *         },
   *         // ... more individual payments
   *       ]
   *     }
   *   },
   *   message: "Batch payment details retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid batch ID format
   * - 401: Authentication required
   * - 403: Admin privileges required
   * - 404: Batch payment not found
   * - 500: Server error
   * 
   * DETAILED INFORMATION INCLUDES:
   * - Complete batch payment metadata
   * - Creator and processor information
   * - KCB transaction details (if deposited)
   * - All individual payment records with user information
   * - Special offering details (if applicable)
   * - Processing status for each payment
   * 
   * USAGE:
   * const batchDetails = await apiService.getBatchPaymentDetails(123);
   * console.log('Batch total:', batchDetails.batchPayment.totalAmount);
   * console.log('Payment count:', batchDetails.batchPayment.payments.length);
   */
  async getBatchPaymentDetails(batchId) {
    console.log('🔍 Fetching detailed batch payment information for batch ID:', batchId);
    return this.get(`/batch-payments/${batchId}`);
  }

  /**
   * Process batch deposit via KCB payment gateway
   * Initiates KCB STK push for the total batch amount
   * 
   * @param {number} batchId - ID of batch payment to deposit
   * @param {Object} depositData - Deposit configuration
   * @returns {Promise<Object>} KCB deposit initiation response
   * 
   * API ENDPOINT: POST /api/batch-payments/{batchId}/deposit
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   phoneNumber: string,             // Mobile number for KCB STK push
   *   depositDescription: string       // Description for deposit (optional, max 100 chars)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     batchPayment: {
   *       id: number,
   *       batchReference: string,
   *       totalAmount: number,
   *       status: "DEPOSITED",         // Updated status
   *       kcbTransactionId: string,    // KCB transaction ID
   *       kcbReference: string,        // KCB checkout reference
   *       processedById: number,       // Admin who initiated deposit
   *       depositedAt: string,         // Deposit timestamp
   *       // ... other batch fields
   *     },
   *     kcbResponse: {
   *       reference: string,           // KCB checkout request ID
   *       message: string              // KCB response message
   *     }
   *   },
   *   message: "KCB deposit initiated for batch BATCH-123. Check your phone to complete the transaction."
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid batch ID, phone number required, batch not in PENDING status
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: Batch payment not found
   * - 500: KCB gateway error or server error
   * 
   * DEPOSIT PROCESSING FLOW:
   * 1. Validates batch is in PENDING status
   * 2. Formats phone number for KCB compatibility
   * 3. Initiates KCB STK push for total batch amount
   * 4. Updates batch status to DEPOSITED
   * 5. Records KCB transaction details
   * 6. Returns KCB response for user action
   * 
   * PHONE NUMBER REQUIREMENTS:
   * - Must be valid Kenyan mobile number
   * - Accepts formats: 0712345678, 712345678, 254712345678, +254712345678
   * - Automatically converts to KCB-compatible format
   * 
   * KCB STK PUSH PROCESS:
   * 1. User receives STK push notification on phone
   * 2. User enters M-Pesa PIN to authorize payment
   * 3. KCB processes payment and sends callback to server
   * 4. Use completeBatchPayment() after successful callback
   * 
   * USAGE:
   * const depositResult = await apiService.processBatchDeposit(123, {
   *   phoneNumber: '0712345678',
   *   depositDescription: 'Weekly collection batch deposit'
   * });
   * 
   * // User completes payment on phone, then:
   * // await apiService.completeBatchPayment(123);
   */
  async processBatchDeposit(batchId, depositData) {
    console.log('🏦 Processing KCB deposit for batch ID:', batchId);
    console.log('📱 Phone number:', depositData.phoneNumber);
    return this.post(`/batch-payments/${batchId}/deposit`, depositData);
  }

  /**
   * Complete batch payment processing after successful KCB payment
   * Updates all individual payments to COMPLETED and generates receipts
   * 
   * @param {number} batchId - ID of batch payment to complete
   * @param {Object} completionData - Completion details (optional)
   * @returns {Promise<Object>} Batch completion confirmation with processed payment count
   * 
   * API ENDPOINT: POST /api/batch-payments/{batchId}/complete
   * AUTHENTICATION: Required (Admin only)
   * 
   * REQUEST BODY (optional):
   * {
   *   kcbTransactionId: string,        // KCB transaction ID (optional, for verification)
   *   kcbReceiptNumber: string         // KCB receipt number (optional)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     batchPayment: {
   *       id: number,
   *       batchReference: string,
   *       totalAmount: number,
   *       status: "COMPLETED",         // Final status
   *       kcbTransactionId: string,
   *       // ... other batch fields
   *       updatedAt: string            // Completion timestamp
   *     },
   *     completedPayments: number      // Count of successfully processed payments
   *   },
   *   message: "Batch payment completed successfully. X payments processed and receipts generated."
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid batch ID, batch not in DEPOSITED status
   * - 401: Authentication required
   * - 403: Admin privileges required
   * - 404: Batch payment not found
   * - 500: Server error during completion processing
   * 
   * COMPLETION PROCESSING (ATOMIC TRANSACTION):
   * 1. Validates batch is in DEPOSITED status
   * 2. Updates all individual payments to COMPLETED status
   * 3. Generates unique receipt numbers for each payment
   * 4. Creates receipt records for all payments
   * 5. Updates batch status to COMPLETED
   * 6. Records completion timestamp
   * 7. Updates KCB transaction details (if provided)
   * 
   * RECEIPT GENERATION:
   * - Each payment receives a unique receipt number
   * - Receipt format: TYPE/YYYYMMDD/XXXX (e.g., TH/20240615/1234)
   * - Receipt data includes payment details, user info, batch reference
   * - Tithe designations and special offering details included
   * - All receipts linked to batch for audit trail
   * 
   * BUSINESS LOGIC:
   * - All payments within batch are processed atomically
   * - If any payment fails, entire batch completion is rolled back
   * - Individual payment statuses synchronized with batch status
   * - Bank deposit status updated to DEPOSITED for all payments
   * 
   * USAGE:
   * // Complete batch after successful KCB payment
   * const completionResult = await apiService.completeBatchPayment(123, {
   *   kcbTransactionId: 'KCB_TXN_789',
   *   kcbReceiptNumber: 'KCB_RCP_456'
   * });
   * 
   * console.log('Payments processed:', completionResult.completedPayments);
   */
  async completeBatchPayment(batchId, completionData = {}) {
    console.log('✅ Completing batch payment processing for batch ID:', batchId);
    console.log('📊 Completion data:', completionData);
    return this.post(`/batch-payments/${batchId}/complete`, completionData);
  }

  /**
   * Cancel batch payment before processing
   * Sets batch and all individual payments to CANCELLED status
   * 
   * @param {number} batchId - ID of batch payment to cancel
   * @param {string} reason - Reason for cancellation (optional)
   * @returns {Promise<Object>} Cancellation confirmation
   * 
   * API ENDPOINT: DELETE /api/batch-payments/{batchId}
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY (optional):
   * {
   *   reason: string                   // Cancellation reason (max 200 chars)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     batchPayment: {
   *       id: number,
   *       batchReference: string,
   *       status: "CANCELLED",         // Updated status
   *       description: string,         // Updated with cancellation reason
   *       // ... other batch fields
   *     },
   *     cancelledPayments: number      // Count of cancelled individual payments
   *   },
   *   message: "Batch payment cancelled successfully. X payments cancelled."
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid batch ID, batch not in PENDING status
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: Batch payment not found
   * - 500: Server error during cancellation
   * 
   * CANCELLATION RULES:
   * - Only PENDING batches can be cancelled
   * - DEPOSITED or COMPLETED batches cannot be cancelled
   * - All individual payments in batch are also cancelled
   * - Cancellation reason is appended to batch description
   * - Operation is irreversible
   * 
   * BUSINESS IMPACT:
   * - Payments are not processed through gateway
   * - No receipts are generated
   * - Wallet balances are not affected
   * - Audit trail retains cancellation record
   * 
   * USAGE:
   * await apiService.cancelBatchPayment(123, 'Duplicate batch created by error');
   */
  async cancelBatchPayment(batchId, reason = null) {
    console.log('❌ Cancelling batch payment with ID:', batchId);
    console.log('📝 Cancellation reason:', reason || 'No reason provided');
    return this.delete(`/batch-payments/${batchId}`, { reason });
  }

  /**
   * Create bulk payments for batch processing (convenience method)
   * Wrapper method for createBatchPayment with simplified interface
   * 
   * @param {Array} paymentsArray - Array of payment objects
   * @param {string} description - Batch description (optional)
   * @returns {Promise<Object>} Created batch payment
   * 
   * This is a convenience method that wraps createBatchPayment() with a simpler
   * interface for common bulk payment scenarios.
   * 
   * USAGE:
   * const payments = [
   *   { userId: 1, amount: 1000, paymentType: 'TITHE' },
   *   { userId: 2, amount: 500, paymentType: 'OFFERING' }
   * ];
   * 
   * const batch = await apiService.createBulkPayments(payments, 'Sunday collection');
   */
  async createBulkPayments(paymentsArray, description = null) {
    console.log('📝 Creating bulk payments for batch processing');
    console.log('📊 Payment count:', paymentsArray.length);
    return this.createBatchPayment({
      payments: paymentsArray,
      description
    });
  }

  // ================================================================================================
  // WALLET MANAGEMENT API CALLS
  // ================================================================================================

  /**
   * Initialize wallet system with default wallet types
   * Admin-only endpoint for setting up church financial wallet structure
   * 
   * @returns {Promise<Object>} Wallet initialization results
   * 
   * API ENDPOINT: POST /api/wallets/initialize
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     walletsCreated: [
   *       {
   *         id: number,
   *         walletType: string,          // TITHE, OFFERING, DONATION, SPECIAL_OFFERING
   *         subType: string|null,        // For tithe: welfare, campMeetingExpenses, etc.
   *         balance: 0,
   *         totalDeposits: 0,
   *         totalWithdrawals: 0,
   *         isActive: true,
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more wallets
   *     ]
   *   },
   *   message: "Wallet system initialized. Created X new wallets."
   * }
   * 
   * DEFAULT WALLETS CREATED:
   * - OFFERING (general offerings)
   * - DONATION (general donations)
   * - TITHE/campMeetingExpenses (SDA specific)
   * - TITHE/welfare (SDA specific)
   * - TITHE/thanksgiving (SDA specific)
   * - TITHE/stationFund (SDA specific)
   * - TITHE/mediaMinistry (SDA specific)
   * - SPECIAL_OFFERING/general (for special campaigns)
   * 
   * INITIALIZATION LOGIC:
   * - Checks for existing wallets before creation
   * - Only creates wallets that don't already exist
   * - All wallets start with zero balance
   * - Wallets are marked as active by default
   * - Special offering wallets are created dynamically per campaign
   * 
   * BUSINESS CONTEXT:
   * The wallet system separates church finances into designated categories
   * for proper fund management and reporting. This follows SDA financial
   * management guidelines for tithe distribution and special offerings.
   * 
   * USAGE:
   * // Initialize wallet system (typically done once during setup)
   * const initResult = await apiService.initializeWallets();
   * console.log('Wallets created:', initResult.walletsCreated.length);
   */
  async initializeWallets() {
    console.log('🏦 Initializing church wallet system with default wallet types');
    return this.post('/wallets/initialize');
  }

  /**
   * Get all wallets with current balances and transaction summaries
   * Admin-only endpoint for wallet balance overview and management
   * 
   * @returns {Promise<Object>} Complete wallet system status with balances
   * 
   * API ENDPOINT: GET /api/wallets
   * AUTHENTICATION: Required (Admin only)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     wallets: {
   *       TITHE: [                     // Grouped by wallet type
   *         {
   *           id: number,
   *           walletType: "TITHE",
   *           subType: "welfare",      // SDA category
   *           balance: number,         // Current available balance
   *           totalDeposits: number,   // Lifetime deposits
   *           totalWithdrawals: number, // Lifetime withdrawals
   *           lastUpdated: string,     // Last balance update
   *           isActive: boolean,
   *           createdAt: string,
   *           updatedAt: string
   *         },
   *         // ... more tithe wallets (campMeetingExpenses, thanksgiving, etc.)
   *       ],
   *       OFFERING: [
   *         {
   *           id: number,
   *           walletType: "OFFERING",
   *           subType: null,           // General offering wallet
   *           balance: number,
   *           totalDeposits: number,
   *           totalWithdrawals: number,
   *           // ... other fields
   *         }
   *       ],
   *       DONATION: [...],             // General donations
   *       SPECIAL_OFFERING: [...]      // Special campaigns
   *     },
   *     summary: {
   *       totalBalance: number,        // Sum of all wallet balances
   *       totalDeposits: number,       // Sum of all deposits
   *       totalWithdrawals: number,    // Sum of all withdrawals
   *       walletsCount: number         // Total number of active wallets
   *     }
   *   },
   *   message: "Wallets retrieved successfully"
   * }
   * 
   * WALLET ORGANIZATION:
   * - Wallets are grouped by type for easy navigation
   * - TITHE wallets are subdivided by SDA categories
   * - SPECIAL_OFFERING wallets are created per campaign
   * - Summary provides overall financial position
   * 
   * BALANCE CALCULATION:
   * - Balance = TotalDeposits - TotalWithdrawals
   * - Only includes completed/successful transactions
   * - Updated through updateWalletBalances() method
   * - Real-time balance reflects available funds
   * 
   * SDA TITHE CATEGORIES:
   * - campMeetingExpenses: Camp meeting and conference expenses
   * - welfare: Community welfare and assistance programs
   * - thanksgiving: Thanksgiving and special services
   * - stationFund: Local church station maintenance
   * - mediaMinistry: Media and communication ministry
   * 
   * USAGE:
   * const wallets = await apiService.getAllWallets();
   * console.log('Total church balance:', wallets.summary.totalBalance);
   * console.log('Welfare wallet balance:', 
   *   wallets.wallets.TITHE.find(w => w.subType === 'welfare').balance);
   */
  async getAllWallets() {
    console.log('💰 Fetching all wallet balances and transaction summaries');
    return this.get('/wallets');
  }

  /**
   * Update wallet balances from completed payment records
   * Admin-only endpoint for synchronizing wallet balances with payment data
   * 
   * @param {Array} paymentIds - Array of payment IDs to process into wallets
   * @returns {Promise<Object>} Wallet update results with balance changes
   * 
   * API ENDPOINT: POST /api/wallets/update-balances
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   paymentIds: [number, ...]       // Array of payment IDs (minimum 1 required)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     updatedWallets: [
   *       {
   *         id: number,
   *         walletType: string,
   *         subType: string|null,
   *         balance: number,           // Updated balance
   *         totalDeposits: number,     // Updated total deposits
   *         totalWithdrawals: number,  // Updated total withdrawals
   *         lastUpdated: string        // Update timestamp
   *       },
   *       // ... more updated wallets
   *     ],
   *     processedPayments: [number, ...] // Payment IDs successfully processed
   *   },
   *   message: "Updated X wallets from Y payments"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Missing payment IDs array, empty array
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 500: Server error during wallet update processing
   * 
   * PAYMENT PROCESSING LOGIC:
   * 1. Validates all payment IDs exist and are COMPLETED
   * 2. Skips expense payments (they don't add to wallets)
   * 3. Determines target wallet(s) based on payment type
   * 4. Distributes tithe payments among SDA categories
   * 5. Creates special offering wallets if needed
   * 6. Updates wallet balances atomically
   * 7. Records last update timestamp
   * 
   * WALLET ALLOCATION BY PAYMENT TYPE:
   * - TITHE: Distributed among selected SDA categories based on titheDistributionSDA
   * - OFFERING: Added to general OFFERING wallet
   * - DONATION: Added to general DONATION wallet
   * - SPECIAL_OFFERING_CONTRIBUTION: Added to specific special offering wallet
   * - EXPENSE: Skipped (expenses don't increase wallet balances)
   * 
   * TITHE DISTRIBUTION EXAMPLE:
   * If payment has titheDistributionSDA: { welfare: true, stationFund: true }
   * and amount is 1000, then 500 goes to welfare wallet and 500 to stationFund wallet
   * 
   * ATOMIC OPERATIONS:
   * - All wallet updates are processed in a single database transaction
   * - If any update fails, all changes are rolled back
   * - Prevents partial updates and maintains data consistency
   * - Uses database-level increment operations to prevent race conditions
   * 
   * SPECIAL OFFERING HANDLING:
   * - Creates wallet automatically if special offering wallet doesn't exist
   * - Wallet subType is set to offering code for identification
   * - Links wallet to special offering ID for reporting
   * 
   * USAGE EXAMPLES:
   * // Update wallets after processing batch payments
   * const paymentIds = [1001, 1002, 1003, 1004, 1005];
   * const updateResult = await apiService.updateWalletBalances(paymentIds);
   * console.log('Wallets updated:', updateResult.updatedWallets.length);
   * console.log('Payments processed:', updateResult.processedPayments.length);
   * 
   * // Update wallets after manual payment entry
   * const manualPayment = await apiService.addManualPayment({...});
   * await apiService.updateWalletBalances([manualPayment.payment.id]);
   */
  async updateWalletBalances(paymentIds) {
    console.log('⚖️ Updating wallet balances from completed payments');
    console.log('📊 Processing', paymentIds.length, 'payment records');
    return this.post('/wallets/update-balances', { paymentIds });
  }

  /**
   * Create withdrawal request from church wallet
   * Admin-only endpoint for requesting fund withdrawals with approval workflow
   * 
   * @param {Object} withdrawalData - Withdrawal request information
   * @returns {Promise<Object>} Created withdrawal request awaiting approval
   * 
   * API ENDPOINT: POST /api/wallets/withdraw
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   walletId: number,               // ID of wallet to withdraw from
   *   amount: number,                 // Withdrawal amount (positive number)
   *   purpose: string,                // Purpose of withdrawal (5-100 characters)
   *   description: string,            // Additional description (optional)
   *   withdrawalMethod: string,       // BANK_TRANSFER, MPESA, CASH
   *   destinationAccount: string,     // Required for BANK_TRANSFER
   *   destinationPhone: string        // Required for MPESA
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     withdrawalRequest: {
   *       id: number,
   *       withdrawalReference: string, // Unique reference (WD-timestamp-hash)
   *       walletId: number,
   *       amount: number,
   *       purpose: string,
   *       description: string,
   *       requestedById: number,       // Admin who requested
   *       status: "PENDING",           // Initial status
   *       withdrawalMethod: string,
   *       destinationAccount: string|null,
   *       destinationPhone: string|null,
   *       requiredApprovals: 3,        // Default approval requirement
   *       currentApprovals: 0,         // Current approval count
   *       wallet: {
   *         id: number,
   *         walletType: string,
   *         subType: string|null,
   *         balance: number             // Current wallet balance
   *       },
   *       requester: {
   *         id: number,
   *         username: string,
   *         fullName: string
   *       },
   *       createdAt: string,
   *       updatedAt: string
   *     }
   *   },
   *   message: "Withdrawal request created successfully. Awaiting approvals."
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, insufficient wallet balance, invalid withdrawal method
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: Wallet not found
   * - 500: Server error during withdrawal request creation
   * 
   * VALIDATION RULES:
   * - Withdrawal amount must be positive and not exceed wallet balance
   * - Purpose must be between 5-100 characters
   * - BANK_TRANSFER requires destinationAccount
   * - MPESA requires destinationPhone (valid Kenyan mobile number)
   * - Wallet must be active and have sufficient balance
   * 
   * WITHDRAWAL METHODS:
   * - BANK_TRANSFER: Direct bank transfer to specified account
   * - MPESA: Mobile money transfer to specified phone number
   * - CASH: Physical cash withdrawal (manual process)
   * 
   * APPROVAL WORKFLOW:
   * 1. Withdrawal request created in PENDING status
   * 2. Requires 3 admin approvals by default (configurable)
   * 3. Each admin provides password-based approval
   * 4. After sufficient approvals, withdrawal is processed
   * 5. Funds are transferred via KCB gateway (if applicable)
   * 6. Wallet balance is updated and expense record created
   * 
   * WITHDRAWAL REFERENCE FORMAT:
   * WD-{timestamp}-{random_hex} (e.g., WD-1640995200000-A1B2C3D4)
   * 
   * BALANCE VALIDATION:
   * - Checks current wallet balance before creating request
   * - Uses row-level locking to prevent race conditions
   * - Balance is reserved but not deducted until approval
   * 
   * USAGE EXAMPLES:
   * // Request bank transfer from welfare wallet
   * const withdrawal = await apiService.createWithdrawalRequest({
   *   walletId: 5,
   *   amount: 10000,
   *   purpose: 'Community welfare assistance',
   *   description: 'Monthly welfare distribution to needy families',
   *   withdrawalMethod: 'BANK_TRANSFER',
   *   destinationAccount: '1234567890'
   * });
   * 
   * // Request MPESA transfer from station fund
   * const mpesaWithdrawal = await apiService.createWithdrawalRequest({
   *   walletId: 8,
   *   amount: 5000,
   *   purpose: 'Church maintenance supplies',
   *   withdrawalMethod: 'MPESA',
   *   destinationPhone: '0712345678'
   * });
   */
  async createWithdrawalRequest(withdrawalData) {
    console.log('💸 Creating withdrawal request from church wallet');
    console.log('💰 Withdrawal details:', {
      amount: withdrawalData.amount,
      purpose: withdrawalData.purpose,
      method: withdrawalData.withdrawalMethod
    });
    return this.post('/wallets/withdraw', withdrawalData);
  }

  /**
   * Get withdrawal requests with filtering and pagination
   * Admin-only endpoint for withdrawal request management and approval
   * 
   * @param {Object} params - Query parameters for filtering and pagination
   * @returns {Promise<Object>} Paginated list of withdrawal requests
   * 
   * API ENDPOINT: GET /api/wallets/withdrawals
   * AUTHENTICATION: Required (Admin only)
   * 
   * QUERY PARAMETERS:
   * {
   *   status: string,                  // PENDING, APPROVED, REJECTED, COMPLETED, ALL (default)
   *   page: number,                    // Page number (default: 1)
   *   limit: number                    // Items per page (default: 20, max: 100)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     withdrawalRequests: [
   *       {
   *         id: number,
   *         withdrawalReference: string,
   *         amount: number,
   *         purpose: string,
   *         description: string,
   *         status: string,             // PENDING, APPROVED, REJECTED, COMPLETED
   *         withdrawalMethod: string,
   *         destinationAccount: string|null,
   *         destinationPhone: string|null,
   *         requiredApprovals: number,
   *         currentApprovals: number,
   *         wallet: {
   *           id: number,
   *           walletType: string,
   *           subType: string|null,
   *           balance: number
   *         },
   *         requester: {
   *           id: number,
   *           username: string,
   *           fullName: string
   *         },
   *         approvals: [                // Approval history
   *           {
   *             id: number,
   *             approved: boolean,
   *             approvalMethod: string,
   *             comment: string|null,
   *             approver: {
   *               id: number,
   *               username: string,
   *               fullName: string
   *             },
   *             createdAt: string
   *           },
   *           // ... more approvals
   *         ],
   *         kcbTransactionId: string|null,
   *         kcbReference: string|null,
   *         processedAt: string|null,
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more withdrawal requests
   *     ],
   *     totalPages: number,
   *     currentPage: number,
   *     totalRequests: number
   *   },
   *   message: "Withdrawal requests retrieved successfully"
   * }
   * 
   * WITHDRAWAL STATUS DEFINITIONS:
   * - PENDING: Awaiting admin approvals
   * - APPROVED: Sufficient approvals received, ready for processing
   * - REJECTED: Request denied by admin
   * - COMPLETED: Funds transferred and wallet updated
   * 
   * APPROVAL TRACKING:
   * - Shows current approval count vs required count
   * - Lists all approval attempts with approver details
   * - Includes approval method (PASSWORD, EMAIL, GOOGLE_AUTH)
   * - Records approval comments and timestamps
   * 
   * USAGE:
   * // Get all pending withdrawal requests
   * const pendingWithdrawals = await apiService.getWithdrawalRequests({
   *   status: 'PENDING'
   * });
   * 
   * // Get recent withdrawal history
   * const recentWithdrawals = await apiService.getWithdrawalRequests({
   *   page: 1,
   *   limit: 10
   * });
   */
  async getWithdrawalRequests(params = {}) {
    console.log('📋 Fetching withdrawal requests for admin review');
    console.log('🔍 Filter parameters:', params);
    return this.get('/wallets/withdrawals', params);
  }

  /**
   * Approve withdrawal request with multi-admin security
   * Admin-only endpoint for providing withdrawal approval with password verification
   * 
   * @param {number} withdrawalId - ID of withdrawal request to approve
   * @param {Object} approvalData - Approval details and authentication
   * @returns {Promise<Object>} Approval result and next steps
   * 
   * API ENDPOINT: POST /api/wallets/withdrawals/{withdrawalId}/approve
   * AUTHENTICATION: Required (Admin only)
   * 
   * REQUEST BODY:
   * {
   *   password: string,               // Withdrawal approval password
   *   approvalMethod: string,         // PASSWORD, EMAIL, GOOGLE_AUTH (default: PASSWORD)
   *   comment: string                 // Approval comment (optional)
   * }
   * 
   * SUCCESS RESPONSE (MORE APPROVALS NEEDED):
   * {
   *   success: true,
   *   data: {
   *     approved: true,
   *     requiresMoreApprovals: true,
   *     currentApprovals: number,      // Updated approval count
   *     requiredApprovals: number      // Total approvals needed
   *   },
   *   message: "Approval recorded. X more approvals needed."
   * }
   * 
   * SUCCESS RESPONSE (WITHDRAWAL PROCESSED):
   * {
   *   success: true,
   *   data: {
   *     approved: true,
   *     processed: true,
   *     withdrawalRequest: {
   *       id: number,
   *       withdrawalReference: string,
   *       status: "COMPLETED",
   *       amount: number,
   *       processedAt: string,
   *       kcbTransactionId: string|null,
   *       kcbReference: string|null
   *     },
   *     walletBalance: number,         // Updated wallet balance
   *     expensePaymentId: number,      // Created expense record ID
   *     kcbResponse: {                 // KCB transfer response (if applicable)
   *       transactionId: string,
   *       reference: string,
   *       message: string
   *     }|null
   *   },
   *   message: "Withdrawal request fully approved and processed."
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid withdrawal ID, already approved by user, invalid password
   * - 401: Authentication required
   * - 403: Admin privileges required
   * - 404: Withdrawal request not found
   * - 500: Server error during approval processing
   * 
   * APPROVAL SECURITY:
   * - Requires special withdrawal approval password (separate from login)
   * - Each admin can only approve once per withdrawal
   * - Password validation against environment variables
   * - Approval method tracking for audit trail
   * 
   * WITHDRAWAL PASSWORDS:
   * Three different passwords are configured in environment:
   * - WITHDRAWAL_PASSWORD_1
   * - WITHDRAWAL_PASSWORD_2  
   * - WITHDRAWAL_PASSWORD_3
   * Any valid password can be used for approval
   * 
   * MULTI-ADMIN WORKFLOW:
   * 1. First admin creates withdrawal request
   * 2. Three different admins must approve (default requirement)
   * 3. Each approval is recorded with timestamp and approver
   * 4. After sufficient approvals, withdrawal is automatically processed
   * 5. Funds are transferred and wallet balance updated
   * 
   * AUTOMATIC PROCESSING:
   * When sufficient approvals are received:
   * 1. Wallet balance is atomically decremented
   * 2. Expense payment record is created
   * 3. KCB withdrawal is initiated (if BANK_TRANSFER or MPESA)
   * 4. Withdrawal status updated to COMPLETED
   * 5. Processing timestamp recorded
   * 
   * USAGE EXAMPLES:
   * // Approve withdrawal with password
   * const approval = await apiService.approveWithdrawalRequest(123, {
   *   password: 'secure-withdrawal-password-1',
   *   comment: 'Approved for legitimate church expense'
   * });
   * 
   * if (approval.requiresMoreApprovals) {
   *   console.log('Need', approval.requiredApprovals - approval.currentApprovals, 'more approvals');
   * } else {
   *   console.log('Withdrawal processed, new balance:', approval.walletBalance);
   * }
   */
  async approveWithdrawalRequest(withdrawalId, approvalData) {
    console.log('✅ Processing withdrawal approval for request ID:', withdrawalId);
    console.log('🔐 Approval method:', approvalData.approvalMethod || 'PASSWORD');
    return this.post(`/wallets/withdrawals/${withdrawalId}/approve`, approvalData);
  }

  // ================================================================================================
  // KCB INTEGRATION & SYNCHRONIZATION API CALLS
  // ================================================================================================

  /**
   * Get current KCB account balance and financial status
   * Admin-only endpoint for real-time bank account monitoring
   * 
   * @returns {Promise<Object>} Current KCB account balance information
   * 
   * API ENDPOINT: GET /api/kcb-sync/balance
   * AUTHENTICATION: Required (Admin only)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     balance: {
   *       availableBalance: number,    // Available balance for transactions
   *       actualBalance: number,       // Actual account balance
   *       currency: "KES",             // Account currency
   *       accountNumber: string,       // KCB account number
   *       lastUpdated: string          // Balance check timestamp
   *     },
   *     lastChecked: string            // API call timestamp
   *   },
   *   message: "KCB account balance retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 401: Authentication required
   * - 403: Admin privileges required
   * - 500: KCB API error, server error, configuration issues
   * 
   * BALANCE TYPES:
   * - Available Balance: Funds available for immediate transactions
   * - Actual Balance: Total account balance including pending transactions
   * - Currency: Always KES (Kenya Shillings) for KCB accounts
   * 
   * KCB API INTEGRATION:
   * - Connects to live KCB banking API
   * - Requires valid KCB API credentials
   * - Real-time balance retrieval
   * - Secure authentication with KCB servers
   * 
   * USAGE:
   * const balance = await apiService.getKcbAccountBalance();
   * console.log('Available funds:', balance.balance.availableBalance);
   * console.log('Account balance:', balance.balance.actualBalance);
   */
  async getKcbAccountBalance() {
    console.log('🏦 Fetching current KCB account balance from banking API');
    return this.get('/kcb-sync/balance');
  }

  /**
   * Get KCB transaction history with date filtering and pagination
   * Admin-only endpoint for reviewing bank transaction records
   * 
   * @param {Object} params - Query parameters for date range and pagination
   * @returns {Promise<Object>} Paginated KCB transaction history
   * 
   * API ENDPOINT: GET /api/kcb-sync/transactions
   * AUTHENTICATION: Required (Admin only)
   * 
   * QUERY PARAMETERS:
   * {
   *   startDate: string,              // Start date (ISO format, optional - defaults to 30 days ago)
   *   endDate: string,                // End date (ISO format, optional - defaults to today)
   *   pageSize: number,               // Items per page (default: 50, max: 200)
   *   pageNumber: number              // Page number (default: 1)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     transactions: [
   *       {
   *         transactionId: string,     // KCB transaction ID
   *         reference: string,         // Transaction reference
   *         amount: number,            // Transaction amount
   *         transactionDate: string,   // Transaction timestamp
   *         description: string,       // Transaction description
   *         transactionType: string,   // CREDIT or DEBIT
   *         balance: number,           // Account balance after transaction
   *         channel: string,           // Transaction channel (MOBILE, ATM, etc.)
   *         // ... additional KCB fields
   *       },
   *       // ... more transactions
   *     ],
   *     pagination: {
   *       totalCount: number,          // Total transaction count
   *       pageSize: number,            // Current page size
   *       pageNumber: number,          // Current page number
   *       hasMore: boolean             // More pages available
   *     },
   *     dateRange: {
   *       startDate: string,           // Effective start date
   *       endDate: string              // Effective end date
   *     }
   *   },
   *   message: "KCB transaction history retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid date range (end date before start date)
   * - 401: Authentication required
   * - 403: Admin privileges required
   * - 500: KCB API error, server error
   * 
   * DATE RANGE HANDLING:
   * - Default range: Last 30 days if no dates specified
   * - Maximum range: KCB API limits (typically 90 days)
   * - Date format: ISO 8601 (YYYY-MM-DD)
   * - Timezone: Kenya time (EAT)
   * 
   * TRANSACTION TYPES:
   * - CREDIT: Money received (customer payments, deposits)
   * - DEBIT: Money sent (withdrawals, transfers, fees)
   * 
   * USAGE EXAMPLES:
   * // Get last 7 days of transactions
   * const recent = await apiService.getKcbTransactionHistory({
   *   startDate: '2024-06-08',
   *   endDate: '2024-06-15'
   * });
   * 
   * // Get transactions with pagination
   * const page2 = await apiService.getKcbTransactionHistory({
   *   pageNumber: 2,
   *   pageSize: 25
   * });
   */
  async getKcbTransactionHistory(params = {}) {
    console.log('📊 Fetching KCB transaction history from banking API');
    console.log('📅 Date range and pagination:', params);
    return this.get('/kcb-sync/transactions', params);
  }

  /**
   * Synchronize KCB transactions with local database
   * Admin-only endpoint for importing and linking bank transactions
   * 
   * @param {Object} syncData - Synchronization configuration
   * @returns {Promise<Object>} Synchronization results and statistics
   * 
   * API ENDPOINT: POST /api/kcb-sync/sync
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   startDate: string,              // Sync start date (ISO format, optional)
   *   endDate: string,                // Sync end date (ISO format, optional)
   *   forceSync: boolean              // Force re-sync existing transactions (default: false)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     syncResults: {
   *       new: number,                 // New transactions imported
   *       linkedToPayments: number,    // Transactions automatically linked to payments
   *       duplicates: number,          // Duplicate transactions skipped
   *       total: number                // Total transactions processed
   *     },
   *     dateRange: {
   *       startDate: string,           // Effective sync start date
   *       endDate: string              // Effective sync end date
   *     }
   *   },
   *   message: "KCB transaction sync completed. X new transactions, Y automatically linked."
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid date range
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 500: KCB API error, database error, server error
   * 
   * SYNCHRONIZATION PROCESS:
   * 1. Retrieves transactions from KCB API for specified date range
   * 2. Checks for existing transactions in local database
   * 3. Imports new transactions to KcbTransactionSync table
   * 4. Attempts automatic linking with existing payment records
   * 5. Updates sync statistics and timestamps
   * 
   * AUTOMATIC LINKING LOGIC:
   * - Matches transactions with payments by amount and date
   * - Links if exactly one payment matches criteria
   * - Date tolerance: ±24 hours from transaction date
   * - Amount must match exactly (within 1 KES tolerance)
   * - Only links COMPLETED payments without existing KCB links
   * 
   * DEFAULT DATE RANGE:
   * - Start date: 7 days ago (if not specified)
   * - End date: Today (if not specified)
   * 
   * FORCE SYNC:
   * - When forceSync=true, re-processes existing transactions
   * - Useful for fixing linking issues or updating transaction data
   * - Slower than normal sync due to duplicate checking
   * 
   * USAGE EXAMPLES:
   * // Sync last week's transactions
   * const syncResult = await apiService.syncKcbTransactions({
   *   startDate: '2024-06-08',
   *   endDate: '2024-06-15'
   * });
   * 
   * console.log('New transactions:', syncResult.syncResults.new);
   * console.log('Auto-linked:', syncResult.syncResults.linkedToPayments);
   * 
   * // Force re-sync with all data
   * const forceSync = await apiService.syncKcbTransactions({
   *   forceSync: true
   * });
   */
  async syncKcbTransactions(syncData = {}) {
    console.log('🔄 Initiating KCB transaction synchronization with database');
    console.log('⚙️ Sync configuration:', syncData);
    return this.post('/kcb-sync/sync', syncData);
  }

  /**
   * Get unlinked KCB transactions requiring manual review
   * Admin-only endpoint for managing unmatched bank transactions
   * 
   * @param {Object} params - Query parameters for filtering and pagination
   * @returns {Promise<Object>} Paginated list of unlinked KCB transactions
   * 
   * API ENDPOINT: GET /api/kcb-sync/unlinked
   * AUTHENTICATION: Required (Admin only)
   * 
   * QUERY PARAMETERS:
   * {
   *   page: number,                   // Page number (default: 1)
   *   limit: number,                  // Items per page (default: 20, max: 100)
   *   transactionType: string         // CREDIT, DEBIT, ALL (default: ALL)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     transactions: [
   *       {
   *         id: number,                // Local sync record ID
   *         kcbTransactionId: string,  // KCB transaction ID
   *         kcbReference: string,      // KCB reference number
   *         amount: number,            // Transaction amount
   *         transactionDate: string,   // Transaction timestamp
   *         description: string,       // Transaction description
   *         transactionType: string,   // CREDIT or DEBIT
   *         syncStatus: "UNLINKED",    // Always UNLINKED for this endpoint
   *         rawData: Object,           // Complete KCB transaction data
   *         createdAt: string,         // Import timestamp
   *         updatedAt: string
   *       },
   *       // ... more unlinked transactions
   *     ],
   *     totalPages: number,
   *     currentPage: number,
   *     totalUnlinked: number
   *   },
   *   message: "Unlinked KCB transactions retrieved successfully"
   * }
   * 
   * UNLINKED TRANSACTION REASONS:
   * - No matching payment record found
   * - Multiple potential matches (ambiguous)
   * - Amount or date mismatch outside tolerance
   * - Payment already linked to different KCB transaction
   * - Manual transaction entry without corresponding payment
   * 
   * TRANSACTION TYPE FILTERING:
   * - CREDIT: Money received (customer payments)
   * - DEBIT: Money sent (withdrawals, fees)
   * - ALL: Both credit and debit transactions
   * 
   * MANUAL LINKING PROCESS:
   * 1. Review unlinked transactions
   * 2. Identify corresponding payment records
   * 3. Use linkKcbTransaction() to create manual links
   * 4. Or use ignoreKcbTransaction() to mark as ignored
   * 
   * USAGE:
   * // Get all unlinked credit transactions (customer payments)
   * const unlinkedCredits = await apiService.getUnlinkedKcbTransactions({
   *   transactionType: 'CREDIT'
   * });
   * 
   * // Review unlinked transactions for manual linking
   * unlinkedCredits.transactions.forEach(tx => {
   *   console.log(`Unlinked: ${tx.amount} on ${tx.transactionDate} - ${tx.description}`);
   * });
   */
  async getUnlinkedKcbTransactions(params = {}) {
    console.log('🔗 Fetching unlinked KCB transactions for manual review');
    console.log('🔍 Filter parameters:', params);
    return this.get('/kcb-sync/unlinked', params);
  }

  /**
   * Manually link KCB transaction to payment record
   * Admin-only endpoint for creating manual transaction-payment associations
   * 
   * @param {number} kcbSyncId - ID of KCB sync record to link
   * @param {number} paymentId - ID of payment record to link to
   * @returns {Promise<Object>} Linking result with updated records
   * 
   * API ENDPOINT: POST /api/kcb-sync/link
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   kcbSyncId: number,              // KCB sync record ID
   *   paymentId: number               // Payment record ID
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     linkedTransaction: {
   *       id: number,
   *       kcbTransactionId: string,
   *       kcbReference: string,
   *       amount: number,
   *       syncStatus: "LINKED",       // Updated status
   *       linkedPaymentId: number,    // Linked payment ID
   *       updatedAt: string
   *     },
   *     linkedPayment: {
   *       id: number,
   *       amount: number,
   *       paymentType: string,
   *       kcbTransactionId: string,   // Updated with KCB transaction ID
   *       kcbReference: string,       // Updated with KCB reference
   *       updatedAt: string
   *     }
   *   },
   *   message: "KCB transaction linked to payment successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, amount mismatch, already linked transaction
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: KCB sync record or payment not found
   * - 500: Server error during linking process
   * 
   * VALIDATION RULES:
   * - KCB transaction must be in UNLINKED status
   * - Payment must be in COMPLETED status
   * - Payment must not already be linked to another KCB transaction
   * - Amount difference must be within tolerance (1 KES)
   * - Both records must exist and be valid
   * 
   * LINKING PROCESS (ATOMIC):
   * 1. Validates both records exist and are eligible for linking
   * 2. Checks amount compatibility within tolerance
   * 3. Updates KCB sync record status to LINKED
   * 4. Updates payment record with KCB transaction details
   * 5. Records linking timestamp and admin action
   * 
   * AMOUNT TOLERANCE:
   * - Allows up to 1 KES difference between KCB transaction and payment
   * - Accounts for rounding differences and minor discrepancies
   * - Prevents linking of significantly different amounts
   * 
   * USAGE EXAMPLES:
   * // Link specific KCB transaction to payment
   * const linkResult = await apiService.linkKcbTransaction(456, 789);
   * console.log('Linked successfully:', linkResult.linkedTransaction.kcbTransactionId);
   * 
   * // Manual review and linking process
   * const unlinked = await apiService.getUnlinkedKcbTransactions();
   * const payments = await apiService.getAllAdminPayments({
   *   status: 'COMPLETED',
   *   startDate: '2024-06-01'
   * });
   * 
   * // Find matching payment and link
   * const kcbTx = unlinked.transactions[0];
   * const matchingPayment = payments.payments.find(p => 
   *   Math.abs(p.amount - kcbTx.amount) <= 1.0
   * );
   * 
   * if (matchingPayment) {
   *   await apiService.linkKcbTransaction(kcbTx.id, matchingPayment.id);
   * }
   */
  async linkKcbTransaction(kcbSyncId, paymentId) {
    console.log('🔗 Manually linking KCB transaction to payment record');
    console.log('🏦 KCB Sync ID:', kcbSyncId, '| Payment ID:', paymentId);
    return this.post('/kcb-sync/link', { kcbSyncId, paymentId });
  }

  /**
   * Mark KCB transaction as ignored (not for linking)
   * Admin-only endpoint for excluding transactions from linking process
   * 
   * @param {number} kcbSyncId - ID of KCB sync record to ignore
   * @param {string} reason - Reason for ignoring transaction (optional)
   * @returns {Promise<Object>} Ignore confirmation with updated record
   * 
   * API ENDPOINT: PUT /api/kcb-sync/ignore/{kcbSyncId}
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   reason: string                  // Ignore reason (optional, max 200 characters)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     ignoredTransaction: {
   *       id: number,
   *       kcbTransactionId: string,
   *       kcbReference: string,
   *       amount: number,
   *       syncStatus: "IGNORED",      // Updated status
   *       rawData: {
   *         // ... original KCB data
   *         ignoredReason: string,    // Reason for ignoring
   *         ignoredBy: number,        // Admin who ignored
   *         ignoredAt: string         // Ignore timestamp
   *       },
   *       updatedAt: string
   *     }
   *   },
   *   message: "KCB transaction marked as ignored"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid KCB sync ID, transaction not in UNLINKED status
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: KCB sync record not found
   * - 500: Server error during ignore operation
   * 
   * IGNORE REASONS (COMMON):
   * - "Bank fee transaction"
   * - "Internal bank transfer"
   * - "Interest payment from bank"
   * - "ATM withdrawal fee"
   * - "Duplicate transaction entry"
   * - "Non-church related transaction"
   * 
   * BUSINESS LOGIC:
   * - Only UNLINKED transactions can be ignored
   * - IGNORED status is permanent (cannot be reverted via API)
   * - Ignored transactions are excluded from future auto-linking
   * - Audit trail preserved with ignore reason and admin details
   * 
   * USAGE EXAMPLES:
   * // Ignore bank fee transaction
   * await apiService.ignoreKcbTransaction(123, 'Monthly bank maintenance fee');
   * 
   * // Ignore without specific reason
   * await apiService.ignoreKcbTransaction(456);
   * 
   * // Bulk ignore bank fees
   * const unlinked = await apiService.getUnlinkedKcbTransactions();
   * const bankFees = unlinked.transactions.filter(tx => 
   *   tx.description.toLowerCase().includes('fee')
   * );
   * 
   * for (const fee of bankFees) {
   *   await apiService.ignoreKcbTransaction(fee.id, 'Bank fee transaction');
   * }
   */
  async ignoreKcbTransaction(kcbSyncId, reason = null) {
    console.log('🚫 Marking KCB transaction as ignored:', kcbSyncId);
    console.log('📝 Ignore reason:', reason || 'No reason provided');
    return this.put(`/kcb-sync/ignore/${kcbSyncId}`, { reason });
  }

  /**
   * Get KCB synchronization statistics and performance metrics
   * Admin-only endpoint for monitoring sync health and effectiveness
   * 
   * @returns {Promise<Object>} Comprehensive synchronization statistics
   * 
   * API ENDPOINT: GET /api/kcb-sync/statistics
   * AUTHENTICATION: Required (Admin only)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     statistics: {
   *       totalRecords: number,        // Total KCB sync records
   *       linked: number,              // Successfully linked transactions
   *       unlinked: number,            // Unlinked transactions needing review
   *       ignored: number,             // Manually ignored transactions
   *       linkageRate: string,         // Linking success percentage (e.g., "85.50")
   *       totals: {
   *         linkedCredits: number,     // Total amount of linked credit transactions
   *         linkedDebits: number,      // Total amount of linked debit transactions
   *         netLinked: number          // Net linked amount (credits - debits)
   *       },
   *       recentActivity: [            // Last 5 sync records
   *         {
   *           id: number,
   *           kcbTransactionId: string,
   *           amount: number,
   *           transactionDate: string,
   *           syncStatus: string,
   *           createdAt: string
   *         },
   *         // ... more recent records
   *       ]
   *     }
   *   },
   *   message: "KCB sync statistics retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 401: Authentication required
   * - 403: Admin privileges required
   * - 500: Database error, server error
   * 
   * STATISTICS BREAKDOWN:
   * - Total Records: All KCB transactions ever synced
   * - Linked: Transactions successfully matched to payments
   * - Unlinked: Transactions awaiting manual review
   * - Ignored: Transactions marked as non-linkable
   * - Linkage Rate: Percentage of successful auto-linking
   * 
   * FINANCIAL TOTALS:
   * - Linked Credits: Total amount of successfully linked incoming transactions
   * - Linked Debits: Total amount of successfully linked outgoing transactions
   * - Net Linked: Difference between credits and debits (should be positive)
   * 
   * PERFORMANCE MONITORING:
   * - High linkage rate (>80%) indicates good auto-linking performance
   * - Many unlinked transactions may indicate data quality issues
   * - Recent activity shows sync system health
   * 
   * USAGE:
   * const stats = await apiService.getKcbSyncStatistics();
   * console.log('Linkage success rate:', stats.statistics.linkageRate + '%');
   * console.log('Unlinked transactions needing review:', stats.statistics.unlinked);
   * console.log('Net linked amount:', stats.statistics.totals.netLinked);
   */
  async getKcbSyncStatistics() {
    console.log('📈 Fetching KCB synchronization statistics and performance metrics');
    return this.get('/kcb-sync/statistics');
  }

  // ================================================================================================
  // RECEIPT MANAGEMENT API CALLS
  // ================================================================================================

  /**
   * Get user's receipts with filtering and pagination
   * Returns receipts for current user or specified user (if admin)
   * 
   * @param {number|null} userId - User ID to fetch receipts for (null = current user)
   * @param {Object} params - Query parameters for filtering and pagination
   * @returns {Promise<Object>} Paginated receipt history
   * 
   * API ENDPOINT: GET /api/receipt/user/{userId?}
   * AUTHENTICATION: Required
   * AUTHORIZATION: Own receipts or admin for any user
   * 
   * QUERY PARAMETERS:
   * {
   *   page: number,                   // Page number (default: 1)
   *   limit: number,                  // Items per page (default: 10, max: 50)
   *   startDate: string,              // Filter start date (ISO format)
   *   endDate: string,                // Filter end date (ISO format)
   *   search: string                  // Search in receipt number, payment description
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     receipts: [
   *       {
   *         id: number,
   *         receiptNumber: string,      // Unique receipt number (e.g., TH/20240615/1234)
   *         paymentId: number,          // Associated payment ID
   *         userId: number,
   *         receiptDate: string,        // Receipt generation date
   *         receiptData: {              // Receipt content data
   *           paymentId: number,
   *           amount: number,
   *           paymentType: string,
   *           userName: string,
   *           paymentDate: string,
   *           description: string,
   *           titheDesignations: Object|null, // Tithe category selections
   *           specialOfferingName: string|null,
   *           kcbTransactionId: string|null,
   *           mpesaReceipt: string|null
   *         },
   *         pdfPath: string|null,       // PDF file path (if generated)
   *         attachmentPath: string|null, // Additional attachment path
   *         payment: {                  // Associated payment details
   *           id: number,
   *           amount: number,
   *           paymentType: string,
   *           paymentMethod: string,
   *           description: string,
   *           status: string,
   *           paymentDate: string
   *         },
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more receipts
   *     ],
   *     totalPages: number,
   *     currentPage: number,
   *     totalReceipts: number
   *   },
   *   message: "User receipts retrieved successfully"
   * }
   * 
   * RECEIPT NUMBER FORMAT:
   * - TH/YYYYMMDD/XXXX: Tithe receipts
   * - OF/YYYYMMDD/XXXX: Offering receipts
   * - DN/YYYYMMDD/XXXX: Donation receipts
   * - OT/YYYYMMDD/XXXX: Other payment types
   * 
   * RECEIPT DATA STRUCTURE:
   * Contains comprehensive payment information for receipt generation:
   * - Basic payment details (amount, type, date)
   * - User information (name, contact details)
   * - Gateway transaction IDs (KCB, M-Pesa)
   * - Tithe designations (SDA categories)
   * - Special offering details
   * 
   * USAGE EXAMPLES:
   * // Get current user's receipts
   * const myReceipts = await apiService.getUserReceipts();
   * 
   * // Get specific user's receipts (admin only)
   * const userReceipts = await apiService.getUserReceipts(123);
   * 
   * // Get receipts with filtering
   * const titheReceipts = await apiService.getUserReceipts(null, {
   *   startDate: '2024-01-01',
   *   endDate: '2024-06-30',
   *   search: 'TH/'
   * });
   */
  async getUserReceipts(userId = null, params = {}) {
    const endpoint = userId ? `/receipt/user/${userId}` : '/receipt/user';
    console.log('🧾 Fetching receipt history for user:', userId || 'current user');
    console.log('🔍 Filter parameters:', params);
    return this.get(endpoint, params);
  }

  /**
   * Get all receipts in the system with advanced filtering
   * Admin-only endpoint for comprehensive receipt management
   * 
   * @param {Object} params - Query parameters for filtering and pagination
   * @returns {Promise<Object>} Paginated list of all receipts
   * 
   * API ENDPOINT: GET /api/receipt/all
   * AUTHENTICATION: Required (Admin only)
   * 
   * QUERY PARAMETERS:
   * {
   *   page: number,                   // Page number (default: 1)
   *   limit: number,                  // Items per page (default: 20, max: 100)
   *   startDate: string,              // Filter start date (ISO format)
   *   endDate: string,                // Filter end date (ISO format)
   *   userId: number,                 // Filter by specific user
   *   search: string                  // Search in receipt number, user name, payment description
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     receipts: [
   *       {
   *         id: number,
   *         receiptNumber: string,
   *         paymentId: number,
   *         userId: number,
   *         receiptDate: string,
   *         receiptData: Object,        // Complete receipt information
   *         pdfPath: string|null,
   *         attachmentPath: string|null,
   *         user: {                     // Receipt owner information
   *           id: number,
   *           username: string,
   *           fullName: string,
   *           phone: string
   *         },
   *         payment: {                  // Associated payment details
   *           id: number,
   *           amount: number,
   *           paymentType: string,
   *           paymentMethod: string,
   *           description: string,
   *           status: string,
   *           isExpense: boolean
   *         },
   *         generator: {                // Admin who generated receipt (if manual)
   *           id: number,
   *           username: string,
   *           fullName: string
   *         }|null,
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more receipts
   *     ],
   *     totalPages: number,
   *     currentPage: number,
   *     totalReceipts: number
   *   },
   *   message: "Receipts retrieved successfully"
   * }
   * 
   * ADVANCED SEARCH CAPABILITIES:
   * - Receipt number search (exact or partial match)
   * - User name search (full name or username)
   * - Payment description search
   * - Amount search (exact match)
   * - Cross-reference search across multiple fields
   * 
   * ADMIN FEATURES:
   * - View all receipts regardless of user
   * - Track receipt generation by admin
   * - Monitor receipt system usage
   * - Identify missing receipts for completed payments
   * 
   * USAGE:
   * // Get all receipts from last month
   * const monthlyReceipts = await apiService.getAllReceipts({
   *   startDate: '2024-05-01',
   *   endDate: '2024-05-31'
   * });
   * 
   * // Search for specific receipt
   * const searchResults = await apiService.getAllReceipts({
   *   search: 'TH/20240615'
   * });
   */
  async getAllReceipts(params = {}) {
    console.log('🧾 Fetching all receipts for admin management');
    console.log('🔍 Filter parameters:', params);
    return this.get('/receipt/all', params);
  }

  /**
   * Get specific receipt by ID with complete details
   * Returns detailed receipt information for viewing or processing
   * 
   * @param {number} receiptId - ID of receipt to retrieve
   * @returns {Promise<Object>} Detailed receipt information
   * 
   * API ENDPOINT: GET /api/receipt/{receiptId}
   * AUTHENTICATION: Required
   * AUTHORIZATION: Own receipts or admin for any receipt
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     receipt: {
   *       id: number,
   *       receiptNumber: string,
   *       paymentId: number,
   *       userId: number,
   *       receiptDate: string,
   *       receiptData: {
   *         paymentId: number,
   *         amount: number,
   *         paymentType: string,
   *         userName: string,
   *         paymentDate: string,
   *         description: string,
   *         titheDesignations: {       // Tithe category breakdown
   *           campMeetingExpenses: boolean,
   *           welfare: boolean,
   *           thanksgiving: boolean,
   *           stationFund: boolean,
   *           mediaMinistry: boolean
   *         }|null,
   *         specialOfferingName: string|null,
   *         batchReference: string|null, // If part of batch payment
   *         kcbTransactionId: string|null,
   *         mpesaReceipt: string|null
   *       },
   *       pdfPath: string|null,
   *       attachmentPath: string|null,
   *       user: {
   *         id: number,
   *         username: string,
   *         fullName: string,
   *         phone: string,
   *         email: string|null
   *       },
   *       payment: {
   *         id: number,
   *         amount: number,
   *         paymentType: string,
   *         paymentMethod: string,
   *         description: string,
   *         status: string,
   *         paymentDate: string,
   *         isExpense: boolean,
   *         titheDistributionSDA: Object|null,
   *         specialOffering: {
   *           name: string,
   *           offeringCode: string
   *         }|null
   *       },
   *       generator: {
   *         id: number,
   *         username: string,
   *         fullName: string
   *       }|null,
   *       createdAt: string,
   *       updatedAt: string
   *     }
   *   },
   *   message: "Receipt retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid receipt ID format
   * - 401: Authentication required
   * - 403: Cannot access other user's receipt (non-admin)
   * - 404: Receipt not found
   * - 500: Server error
   * 
   * DETAILED INFORMATION INCLUDES:
   * - Complete receipt metadata and generation details
   * - Full user profile information
   * - Associated payment details with gateway information
   * - Tithe designation breakdowns for SDA compliance
   * - Special offering details (if applicable)
   * - Batch payment reference (if part of bulk processing)
   * - File attachment paths (PDF and additional documents)
   * 
   * USAGE:
   * const receipt = await apiService.getReceiptById(12345);
   * console.log('Receipt number:', receipt.receipt.receiptNumber);
   * console.log('Payment amount:', receipt.receipt.receiptData.amount);
   * 
   * // Check for tithe designations
   * if (receipt.receipt.receiptData.titheDesignations) {
   *   console.log('Welfare designation:', 
   *     receipt.receipt.receiptData.titheDesignations.welfare);
   * }
   */
  async getReceiptById(receiptId) {
    console.log('🔍 Fetching detailed receipt information for receipt ID:', receiptId);
    return this.get(`/receipt/${receiptId}`);
  }

  /**
   * Download receipt as PDF file
   * Generates and downloads a formatted PDF receipt
   * 
   * @param {number} receiptId - ID of receipt to download
   * @returns {Promise<Object>} Download initiation confirmation
   * 
   * API ENDPOINT: GET /api/receipt/{receiptId}/pdf
   * AUTHENTICATION: Required
   * AUTHORIZATION: Own receipts or admin for any receipt
   * 
   * SUCCESS RESPONSE:
   * The response triggers a browser download of the PDF file.
   * Returns: { success: true, message: "File download initiated" }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid receipt ID format
   * - 401: Authentication required
   * - 403: Cannot access other user's receipt (non-admin)
   * - 404: Receipt not found
   * - 500: PDF generation error, server error
   * 
   * PDF GENERATION PROCESS:
   * 1. Retrieves receipt data from database
   * 2. Generates formatted PDF with church letterhead
   * 3. Includes payment details, user information, and designations
   * 4. Stores PDF file on server for future access
   * 5. Triggers browser download with appropriate filename
   * 
   * PDF CONTENT INCLUDES:
   * - Church letterhead and contact information
   * - Receipt number and generation date
   * - User/payer information
   * - Payment details (amount, type, method, date)
   * - Tithe designations (if applicable)
   * - Gateway transaction references
   * - Official signatures and validation stamps
   * 
   * FILE NAMING CONVENTION:
   * receipt-{receiptNumber}-{timestamp}.pdf
   * Example: receipt-TH-20240615-1234-1640995200000.pdf
   * 
   * USAGE:
   * // Download specific receipt as PDF
   * await apiService.downloadReceipt(12345);
   * // Browser will automatically download the PDF file
   * 
   * // Download multiple receipts
   * const receipts = await apiService.getUserReceipts();
   * for (const receipt of receipts.receipts) {
   *   await apiService.downloadReceipt(receipt.id);
   *   // Add delay to prevent overwhelming the server
   *   await new Promise(resolve => setTimeout(resolve, 1000));
   * }
   */
  async downloadReceipt(receiptId) {
    console.log('📄 Initiating PDF download for receipt ID:', receiptId);
    return this.downloadFile(`/receipt/${receiptId}/pdf`, `receipt-${receiptId}.pdf`);
  }

  /**
   * Upload attachment to existing receipt
   * Admin-only endpoint for adding supporting documents to receipts
   * 
   * @param {number} receiptId - ID of receipt to attach file to
   * @param {FormData} formData - Form data containing file attachment
   * @returns {Promise<Object>} Upload confirmation with file path
   * 
   * API ENDPOINT: POST /api/receipt/{receiptId}/attachment
   * AUTHENTICATION: Required (Admin only)
   * 
   * FORM DATA FIELDS:
   * - attachmentFile: File (JPEG, PNG, or PDF, max 5MB)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     attachmentPath: string        // Server path to uploaded file
   *   },
   *   message: "Attachment uploaded and linked to receipt successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid receipt ID, no file uploaded, invalid file type
   * - 401: Authentication required
   * - 403: Admin privileges required
   * - 404: Receipt not found
   * - 413: File size exceeds limit
   * - 500: File upload error, server error
   * 
   * FILE UPLOAD CONSTRAINTS:
   * - Supported formats: JPEG, PNG, PDF
   * - Maximum file size: 5MB
   * - Files stored with secure, unique filenames
   * - Virus scanning performed on uploads
   * 
   * USE CASES:
   * - Attach physical receipt images for manual payments
   * - Include supporting documentation for special offerings
   * - Add bank transfer confirmations
   * - Store signed acknowledgment forms
   * 
   * SECURITY FEATURES:
   * - File type validation and sanitization
   * - Virus scanning before storage
   * - Secure filename generation
   * - Access control for file retrieval
   * 
   * USAGE:
   * // Prepare file upload
   * const fileInput = document.getElementById('attachmentFile');
   * const file = fileInput.files[0];
   * 
   * const formData = new FormData();
   * formData.append('attachmentFile', file);
   * 
   * // Upload attachment to receipt
   * const uploadResult = await apiService.uploadReceiptAttachment(12345, formData);
   * console.log('File uploaded to:', uploadResult.attachmentPath);
   */
  async uploadReceiptAttachment(receiptId, formData) {
    console.log('📎 Uploading attachment to receipt ID:', receiptId);
    return this.uploadFile(`/receipt/${receiptId}/attachment`, formData);
  }

  // ================================================================================================
  // SPECIAL OFFERINGS MANAGEMENT API CALLS
  // ================================================================================================

  /**
   * Get all special offerings with filtering and progress tracking
   * Public endpoint for viewing available special offering campaigns
   * 
   * @param {Object} params - Query parameters for filtering and pagination
   * @returns {Promise<Object>} Paginated list of special offerings with progress
   * 
   * API ENDPOINT: GET /api/special-offerings
   * AUTHENTICATION: Not required (public information)
   * 
   * QUERY PARAMETERS:
   * {
   *   activeOnly: boolean,            // Show only active offerings (default: true)
   *   page: number,                   // Page number (default: 1)
   *   limit: number,                  // Items per page (default: 10, max: 100)
   *   search: string                  // Search in name, code, description
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     specialOfferings: [
   *       {
   *         id: number,
   *         offeringCode: string,       // Unique offering code (e.g., SO-2024-A1B2)
   *         name: string,               // Offering campaign name
   *         description: string,        // Campaign description
   *         targetAmount: number|null,  // Fundraising target (null = no target)
   *         currentAmount: number,      // Amount raised so far
   *         startDate: string,          // Campaign start date
   *         endDate: string|null,       // Campaign end date (null = ongoing)
   *         isActive: boolean,          // Campaign status
   *         creator: {                  // Admin who created campaign
   *           id: number,
   *           fullName: string,
   *           username: string
   *         },
   *         customFields: Object|null,  // Additional campaign metadata
   *         createdAt: string,
   *         updatedAt: string
   *       },
   *       // ... more special offerings
   *     ],
   *     totalPages: number,
   *     currentPage: number,
   *     totalOfferings: number
   *   },
   *   message: "Special offerings retrieved successfully"
   * }
   * 
   * OFFERING STATUS LOGIC:
   * - Active: isActive=true AND (endDate=null OR endDate > now)
   * - Inactive: isActive=false OR endDate <= now
   * - Progress: currentAmount / targetAmount * 100
   * 
   * CURRENT AMOUNT CALCULATION:
   * - Sum of all COMPLETED payments with paymentType=SPECIAL_OFFERING_CONTRIBUTION
   * - Only includes successfully processed contributions
   * - Real-time calculation on each request
   * 
   * CUSTOM FIELDS USAGE:
   * - Additional campaign metadata (project details, milestones, etc.)
   * - Flexible JSON structure for campaign-specific information
   * - Used for rich campaign descriptions and progress tracking
   * 
   * OFFERING CODE FORMAT:
   * SO-{YEAR}-{RANDOM} (e.g., SO-2024-A1B2C3)
   * - SO: Special Offering prefix
   * - YEAR: Creation year
   * - RANDOM: Unique identifier
   * 
   * USAGE EXAMPLES:
   * // Get all active special offerings
   * const activeOfferings = await apiService.getSpecialOfferings();
   * 
   * // Get all offerings including inactive
   * const allOfferings = await apiService.getSpecialOfferings({
   *   activeOnly: false
   * });
   * 
   * // Search for building fund campaigns
   * const buildingFunds = await apiService.getSpecialOfferings({
   *   search: 'building'
   * });
   */
  async getSpecialOfferings(params = { activeOnly: 'true' }) {
    console.log('🎯 Fetching special offering campaigns');
    console.log('🔍 Filter parameters:', params);
    return this.get('/special-offerings', params);
  }

  /**
   * Create new special offering campaign
   * Admin-only endpoint for launching fundraising campaigns
   * 
   * @param {Object} offeringData - Special offering configuration
   * @returns {Promise<Object>} Created special offering with unique code
   * 
   * API ENDPOINT: POST /api/special-offerings
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY:
   * {
   *   name: string,                   // Campaign name (3-100 characters)
   *   description: string,            // Campaign description (optional)
   *   targetAmount: number|null,      // Fundraising target (optional)
   *   startDate: string|null,         // Campaign start date (ISO format, optional - defaults to now)
   *   endDate: string|null,           // Campaign end date (ISO format, optional)
   *   isActive: boolean,              // Campaign status (optional, default: true)
   *   customFields: Object|null       // Additional campaign metadata (optional)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     specialOffering: {
   *       id: number,
   *       offeringCode: string,       // Auto-generated unique code
   *       name: string,
   *       description: string,
   *       targetAmount: number|null,
   *       currentAmount: 0,           // Always starts at 0
   *       startDate: string,
   *       endDate: string|null,
   *       isActive: boolean,
   *       createdBy: number,          // Admin who created campaign
   *       creator: {
   *         id: number,
   *         fullName: string,
   *         username: string
   *       },
   *       customFields: Object|null,
   *       createdAt: string,
   *       updatedAt: string
   *     }
   *   },
   *   message: "Special offering created successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, invalid dates, duplicate name
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 500: Code generation error, server error
   * 
   * VALIDATION RULES:
   * - Name: 3-100 characters, required
   * - Description: Optional, any length
   * - Target amount: Positive number or null
   * - Start date: Must be valid ISO date
   * - End date: Must be after start date (if provided)
   * - Custom fields: Valid JSON object or null
   * 
   * AUTOMATIC FEATURES:
   * - Offering code is auto-generated and guaranteed unique
   * - Start date defaults to current timestamp if not provided
   * - Campaign status defaults to active
   * - Creator information automatically recorded
   * - Initial current amount is set to 0
   * 
   * CUSTOM FIELDS EXAMPLES:
   * {
   *   "projectType": "construction",
   *   "milestones": [
   *     {"amount": 100000, "description": "Foundation complete"},
   *     {"amount": 500000, "description": "Walls and roof complete"}
   *   ],
   *   "images": ["foundation.jpg", "blueprint.pdf"],
   *   "updates": []
   * }
   * 
   * USAGE EXAMPLES:
   * // Create simple offering campaign
   * const campaign = await apiService.createSpecialOffering({
   *   name: 'New Church Building Fund',
   *   description: 'Fundraising for our new church building project',
   *   targetAmount: 1000000
   * });
   * 
   * // Create campaign with detailed configuration
   * const detailedCampaign = await apiService.createSpecialOffering({
   *   name: 'Youth Ministry Equipment',
   *   description: 'Audio-visual equipment for youth programs',
   *   targetAmount: 50000,
   *   startDate: '2024-07-01T00:00:00Z',
   *   endDate: '2024-12-31T23:59:59Z',
   *   customFields: {
   *     category: 'ministry',
   *     department: 'youth',
   *     priority: 'high'
   *   }
   * });
   */
  async createSpecialOffering(offeringData) {
    console.log('➕ Creating new special offering campaign');
    console.log('🎯 Campaign details:', {
      name: offeringData.name,
      target: offeringData.targetAmount,
      startDate: offeringData.startDate
    });
    return this.post('/special-offerings', offeringData);
  }

  /**
   * Get specific special offering details by ID or code
   * Returns detailed information about a specific campaign
   * 
   * @param {string|number} identifier - Offering ID or offering code
   * @returns {Promise<Object>} Detailed special offering information
   * 
   * API ENDPOINT: GET /api/special-offerings/{identifier}
   * AUTHENTICATION: Not required (public information)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     specialOffering: {
   *       id: number,
   *       offeringCode: string,
   *       name: string,
   *       description: string,
   *       targetAmount: number|null,
   *       currentAmount: number,      // Real-time contribution total
   *       startDate: string,
   *       endDate: string|null,
   *       isActive: boolean,
   *       createdBy: number,
   *       creator: {
   *         id: number,
   *         fullName: string,
   *         username: string
   *       },
   *       customFields: Object|null,
   *       createdAt: string,
   *       updatedAt: string
   *     }
   *   },
   *   message: "Special offering retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid identifier format
   * - 404: Special offering not found
   * - 500: Server error
   * 
   * IDENTIFIER FORMATS:
   * - Numeric ID: 123, "123"
   * - Offering code: "SO-2024-A1B2", "BLD2024"
   * - System automatically detects format and queries appropriately
   * 
   * CURRENT AMOUNT CALCULATION:
   * - Real-time sum of all COMPLETED contributions
   * - Includes payments with paymentType=SPECIAL_OFFERING_CONTRIBUTION
   * - Excludes PENDING, FAILED, or CANCELLED payments
   * 
   * USAGE:
   * // Get offering by ID
   * const offering = await apiService.getSpecialOfferingDetails(5);
   * 
   * // Get offering by code
   * const offeringByCode = await apiService.getSpecialOfferingDetails('SO-2024-A1B2');
   * 
   * console.log('Campaign progress:', 
   *   (offering.specialOffering.currentAmount / offering.specialOffering.targetAmount * 100).toFixed(1) + '%');
   */
  async getSpecialOfferingDetails(identifier) {
    console.log('🔍 Fetching special offering details for identifier:', identifier);
    return this.get(`/special-offerings/${identifier}`);
  }

  /**
   * Get special offering contribution progress and statistics
   * Returns detailed progress information for campaign tracking
   * 
   * @param {string|number} identifier - Offering ID or offering code
   * @returns {Promise<Object>} Detailed progress statistics
   * 
   * API ENDPOINT: GET /api/special-offerings/{identifier}/progress
   * AUTHENTICATION: Not required (public information)
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     progress: {
   *       offeringId: number,
   *       offeringCode: string,
   *       name: string,
   *       targetGoal: number,         // Campaign target amount
   *       totalContributed: number,   // Total amount raised
   *       percentage: number,         // Progress percentage (0-100+)
   *       remainingAmount: number     // Amount still needed (0 if target exceeded)
   *     }
   *   },
   *   message: "Special offering progress retrieved successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid identifier format
   * - 404: Special offering not found
   * - 500: Server error
   * 
   * PROGRESS CALCULATION LOGIC:
   * - Total Contributed: Sum of all COMPLETED payments for this offering
   * - Percentage: (totalContributed / targetGoal) * 100
   * - Remaining Amount: max(0, targetGoal - totalContributed)
   * - Percentage can exceed 100% if contributions surpass target
   * 
   * NO TARGET HANDLING:
   * - If targetGoal is null or 0, percentage is set to 100% if any contributions exist
   * - Remaining amount is 0 when no target is set
   * 
   * USAGE:
   * const progress = await apiService.getSpecialOfferingProgress('SO-2024-A1B2');
   * console.log('Campaign progress:', progress.progress.percentage + '%');
   * console.log('Amount raised:', progress.progress.totalContributed);
   * console.log('Still needed:', progress.progress.remainingAmount);
   * 
   * // Create progress bar
   * const progressBar = document.getElementById('progressBar');
   * progressBar.style.width = Math.min(100, progress.progress.percentage) + '%';
   */
  async getSpecialOfferingProgress(identifier) {
    console.log('📊 Fetching contribution progress for special offering:', identifier);
    return this.get(`/special-offerings/${identifier}/progress`);
  }

  /**
   * Update special offering campaign information
   * Admin-only endpoint for modifying existing campaigns
   * 
   * @param {string|number} identifier - Offering ID or offering code
   * @param {Object} updateData - Updated campaign information
   * @returns {Promise<Object>} Updated special offering details
   * 
   * API ENDPOINT: PUT /api/special-offerings/{identifier}
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * REQUEST BODY (all fields optional):
   * {
   *   name: string,                   // Updated campaign name
   *   offeringCode: string,           // Updated offering code (must be unique)
   *   description: string,            // Updated description
   *   targetAmount: number|null,      // Updated target amount
   *   startDate: string|null,         // Updated start date
   *   endDate: string|null,           // Updated end date
   *   isActive: boolean,              // Updated active status
   *   customFields: Object|null       // Updated custom metadata
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     specialOffering: {
   *       id: number,
   *       offeringCode: string,       // Potentially updated code
   *       name: string,               // Updated name
   *       description: string,
   *       targetAmount: number|null,
   *       currentAmount: number,      // Recalculated current amount
   *       startDate: string,
   *       endDate: string|null,
   *       isActive: boolean,
   *       creator: {
   *         id: number,
   *         fullName: string,
   *         username: string
   *       },
   *       customFields: Object|null,
   *       createdAt: string,
   *       updatedAt: string           // Updated timestamp
   *     }
   *   },
   *   message: "Special offering updated successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, duplicate offering code, invalid dates
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: Special offering not found
   * - 500: Server error
   * 
   * VALIDATION RULES:
   * - Name: 3-100 characters (if provided)
   * - Offering code: Must be unique across all offerings (if provided)
   * - Target amount: Positive number or null (if provided)
   * - End date: Must be after start date (if both provided)
   * - Only provided fields are updated (partial updates)
   * 
   * OFFERING CODE UPDATES:
   * - Changing offering code affects wallet associations
   * - Consider impact on existing contributions and reports
   * - System maintains referential integrity automatically
   * 
   * USAGE EXAMPLES:
   * // Update campaign target and description
   * const updated = await apiService.updateSpecialOffering('SO-2024-A1B2', {
   *   targetAmount: 1200000,
   *   description: 'Updated: Expanded building project with additional features'
   * });
   * 
   * // Deactivate completed campaign
   * await apiService.updateSpecialOffering(5, {
   *   isActive: false,
   *   endDate: new Date().toISOString()
   * });
   * 
   * // Update custom fields for progress tracking
   * await apiService.updateSpecialOffering('BLD2024', {
   *   customFields: {
   *     ...existingFields,
   *     phase: 'construction_started',
   *     milestoneReached: 'foundation_complete'
   *   }
   * });
   */
  async updateSpecialOffering(identifier, updateData) {
    console.log('✏️ Updating special offering campaign:', identifier);
    console.log('📝 Update fields:', Object.keys(updateData));
    return this.put(`/special-offerings/${identifier}`, updateData);
  }

  /**
   * Delete special offering campaign
   * Admin-only endpoint for removing campaigns (with business logic protection)
   * 
   * @param {string|number} identifier - Offering ID or offering code
   * @returns {Promise<Object>} Deletion or deactivation confirmation
   * 
   * API ENDPOINT: DELETE /api/special-offerings/{identifier}
   * AUTHENTICATION: Required (Admin only, view-only admins restricted)
   * 
   * SUCCESS RESPONSE (DEACTIVATED):
   * {
   *   success: true,
   *   data: {
   *     specialOffering: {
   *       id: number,
   *       offeringCode: string,
   *       name: string,
   *       isActive: false,          // Marked as inactive
   *       endDate: string,          // Set to current timestamp
   *       // ... other fields
   *     },
   *     statusMessage: "deactivated"
   *   },
   *   message: "Special offering has contributions and has been marked as inactive"
   * }
   * 
   * SUCCESS RESPONSE (DELETED):
   * {
   *   success: true,
   *   data: {
   *     id: number,
   *     offeringCode: string,
   *     statusMessage: "deleted"
   *   },
   *   message: "Special offering deleted successfully"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Invalid identifier format
   * - 401: Authentication required
   * - 403: Admin privileges required or view-only admin restriction
   * - 404: Special offering not found
   * - 500: Server error
   * 
   * BUSINESS LOGIC PROTECTION:
   * - Offerings WITH contributions: Marked as inactive (soft delete)
   * - Offerings WITHOUT contributions: Permanently deleted (hard delete)
   * - Preserves audit trail and financial records
   * - Prevents data integrity issues
   * 
   * SOFT DELETE (DEACTIVATION):
   * - Sets isActive = false
   * - Sets endDate = current timestamp (if not already set)
   * - Preserves all campaign and contribution data
   * - Maintains wallet associations
   * 
   * HARD DELETE:
   * - Permanently removes campaign record
   * - Only allowed for campaigns with no contributions
   * - Frees up offering code for reuse
   * - Removes associated empty wallets
   * 
   * USAGE:
   * // Delete campaign (system decides soft vs hard delete)
   * const deleteResult = await apiService.deleteSpecialOffering('SO-2024-A1B2');
   * 
   * if (deleteResult.statusMessage === 'deactivated') {
   *   console.log('Campaign deactivated due to existing contributions');
   * } else {
   *   console.log('Campaign permanently deleted');
   * }
   */
  async deleteSpecialOffering(identifier) {
    console.log('🗑️ Deleting special offering campaign:', identifier);
    console.warn('⚠️ System will determine if deletion or deactivation is appropriate');
    return this.delete(`/special-offerings/${identifier}`);
  }

  /**
   * Make contribution to special offering campaign
   * Authenticated endpoint for contributing to fundraising campaigns
   * 
   * @param {string|number} identifier - Offering ID or offering code
   * @param {Object} paymentData - Contribution details
   * @returns {Promise<Object>} Payment initiation response
   * 
   * API ENDPOINT: POST /api/special-offerings/{identifier}/contribution
   * AUTHENTICATION: Required
   * 
   * REQUEST BODY:
   * {
   *   amount: number,                 // Contribution amount (positive number)
   *   description: string,            // Contribution description (optional)
   *   paymentMethod: string,          // MPESA (default), MANUAL (admin only)
   *   phoneNumber: string             // Mobile number for M-Pesa (required for MPESA)
   * }
   * 
   * SUCCESS RESPONSE (MPESA):
   * {
   *   success: true,
   *   data: {
   *     paymentId: number,            // Created payment record ID
   *     mpesaCheckoutID: string       // M-Pesa checkout request ID
   *   },
   *   message: "M-Pesa STK Push initiated" // Or payment gateway message
   * }
   * 
   * SUCCESS RESPONSE (MANUAL):
   * {
   *   success: true,
   *   data: {
   *     paymentId: number,            // Created payment record ID
   *     receiptNumber: string         // Generated receipt number
   *   },
   *   message: "Contribution recorded"
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed, invalid amount, missing phone number
   * - 401: Authentication required
   * - 403: Manual payment method requires admin privileges
   * - 404: Special offering not found or inactive
   * - 500: Payment gateway error, server error
   * 
   * PAYMENT METHODS:
   * - MPESA: Mobile money payment via Safaricom M-Pesa STK push
   * - MANUAL: Direct entry by admin (for cash/bank transfer contributions)
   * 
   * PAYMENT PROCESSING FLOW:
   * 1. Validates special offering exists and is active
   * 2. Creates payment record with SPECIAL_OFFERING_CONTRIBUTION type
   * 3. Links payment to specific special offering campaign
   * 4. Initiates payment gateway process (for MPESA)
   * 5. Returns checkout details for user completion
   * 6. Payment status updated via gateway callback
   * 7. Receipt generated on successful payment
   * 
   * OFFERING VALIDATION:
   * - Campaign must exist and be active (isActive = true)
   * - Campaign must not be ended (endDate = null OR endDate > now)
   * - Validates offering availability before processing payment
   * 
   * MANUAL CONTRIBUTIONS (ADMIN ONLY):
   * - Immediately marked as COMPLETED
   * - Receipt generated automatically
   * - Used for cash donations and bank transfers
   * - Requires admin authentication
   * 
   * USAGE EXAMPLES:
   * // Make M-Pesa contribution
   * const contribution = await apiService.makeSpecialOfferingContribution('SO-2024-A1B2', {
   *   amount: 5000,
   *   description: 'Supporting the building fund',
   *   paymentMethod: 'MPESA',
   *   phoneNumber: '0712345678'
   * });
   * 
   * // Check payment status after user completes M-Pesa
   * const status = await apiService.getPaymentStatus(contribution.paymentId);
   * 
   * // Admin manual entry for cash contribution
   * const manualContribution = await apiService.makeSpecialOfferingContribution('BLD2024', {
   *   amount: 10000,
   *   description: 'Cash contribution from fundraising event',
   *   paymentMethod: 'MANUAL'
   * });
   */
  async makeSpecialOfferingContribution(identifier, paymentData) {
    console.log('💝 Making contribution to special offering:', identifier);
    console.log('💰 Contribution details:', {
      amount: paymentData.amount,
      method: paymentData.paymentMethod || 'MPESA'
    });
    return this.post(`/special-offerings/${identifier}/contribution`, paymentData);
  }

  // ================================================================================================
  // CONTACT & INQUIRY MANAGEMENT API CALLS
  // ================================================================================================

  /**
   * Submit contact form inquiry to church administration
   * Public endpoint for community members to contact the church
   * 
   * @param {Object} formData - Contact form information
   * @returns {Promise<Object>} Inquiry submission confirmation
   * 
   * API ENDPOINT: POST /api/contact/submit
   * AUTHENTICATION: Not required (public endpoint)
   * 
   * REQUEST BODY:
   * {
   *   name: string,                   // Inquirer's full name (2-100 characters)
   *   email: string,                  // Valid email address
   *   phone: string,                  // Phone number (optional, 10-15 characters)
   *   subject: string,                // Inquiry subject (3-150 characters)
   *   message: string                 // Inquiry message (10-2000 characters)
   * }
   * 
   * SUCCESS RESPONSE:
   * {
   *   success: true,
   *   data: {
   *     inquiryId: number             // Created inquiry record ID
   *   },
   *   message: "Your message has been received. We will get back to you shortly."
   * }
   * 
   * ERROR RESPONSES:
   * - 400: Validation failed (missing fields, invalid email, message too short/long)
   * - 500: Server error, email delivery failure
   * 
   * INQUIRY PROCESSING:
   * 1. Validates all form fields according to business rules
   * 2. Creates inquiry record in database with PENDING status
   * 3. Links to authenticated user (if logged in)
   * 4. Sends notification to church administrators
   * 5. Returns confirmation to sender
   * 
   * VALIDATION RULES:
   * - Name: 2-100 characters, required
   * - Email: Valid email format, required
   * - Phone: 10-15 characters, optional
   * - Subject: 3-150 characters, required
   * - Message: 10-2000 characters, required
   * 
   * AUTOMATIC LINKING:
   * - If user is logged in, inquiry is linked to their account
   * - Enables admins to see inquiry history for registered users
   * - Facilitates follow-up communications
   * 
   * ADMIN NOTIFICATION:
   * - Email notification sent to church administration
   * - Dashboard notification created for admin review
   * - Inquiry appears in admin inquiry management system
   * 
   * USAGE EXAMPLES:
   * // Submit general inquiry
   * const inquiry = await apiService.submitContactForm({
   *   name: 'John Smith',
   *   email: 'john.smith@example.com',
   *   phone: '0712345678',
   *   subject: 'Service times inquiry',
   *   message: 'Could you please let me know the current Sunday service times?'
   * });
   * 
   * // Submit prayer request
   * const prayerRequest = await apiService.submitContactForm({
   *   name: 'Mary Johnson',
   *   email: 'mary.j@example.com',
   *   subject: 'Prayer request',
   *   message: 'Please pray for my family during this difficult time...'
   * });
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