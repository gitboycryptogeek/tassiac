// src/utils/authService.js

class AuthService {
  constructor() {
    this.user = null;
    this.token = null;
    this.loadUserFromStorage();
  }

  /**
   * Load the user and token from localStorage
   */
  loadUserFromStorage() {
    try {
      // Get user from localStorage
      const userJson = localStorage.getItem('user');
      if (userJson) {
        this.user = JSON.parse(userJson);
        console.log('Loaded user from storage:', this.user);
      }

      // Get token from localStorage
      this.token = localStorage.getItem('token');
      
      // Validate the token and user
      if (this.user && this.token) {
        // Check if token is expired
        if (this.isTokenExpired()) {
          console.warn('Token is expired, logging out');
          this.logout();
        }
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
      this.logout(false); // Clear invalid data, but don't redirect
    }
  }

  /**
   * Initialize auth (for compatibility with your original code)
   */
  initializeAuth() {
    // This is just for compatibility, actual init is done in constructor
    console.log('Auth initialized');
    return true;
  }

  /**
   * Save user and token to localStorage
   * @param {Object} user - User object
   * @param {string} token - JWT token
   */
  saveUserToStorage(user, token) {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      this.user = user;
    }
    
    if (token) {
      localStorage.setItem('token', token);
      this.token = token;
    }
  }

  /**
   * Log in the user
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise} - Login response
   */
  async login(username, password) {
    try {
      // Use fetch directly here to avoid circular dependency with apiService
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || 'Login failed');
      }
      
      const data = await response.json();
      
      // Save user and token
      this.saveUserToStorage(data.user, data.token);
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Log out the user
   * @param {boolean} redirect - Whether to redirect to login page (default: true)
   */
  logout(redirect = true) {
    const token = this.token; // Get token before clearing
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.removeItem('user'); // Also clear session storage
    sessionStorage.removeItem('token');
    this.user = null;
    this.token = null;
    
    // Optional: Call logout endpoint to invalidate token on server
    try {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      }).catch(() => {
        // Ignore errors on logout request
      });
    } catch (e) {
      // Ignore errors during logout API call
    }
    
    // Redirect to login page if specified
    if (redirect) {
      window.location.href = '/login';
    }
  }

  /**
   * Check if user is logged in
   * @returns {boolean} - True if user is logged in
   */
  isLoggedIn() {
    return !!this.user && !!this.token && !this.isTokenExpired();
  }

  /**
   * Check if user is authenticated (alias for isLoggedIn for compatibility)
   * @returns {boolean} - True if user is logged in
   */
  isAuthenticated() {
    return this.isLoggedIn();
  }

  /**
   * Check if user is an admin
   * @returns {boolean} - True if user is an admin
   */
  isAdmin() {
    // Handle different ways isAdmin could be stored
    return (
      this.user && 
      (this.user.isAdmin === true || 
       this.user.isAdmin === 1 || 
       this.user.isAdmin === '1')
    );
  }

  /**
   * Get the current user
   * @returns {Object} - User object or null if not logged in
   */
  getUser() {
    return this.user;
  }

  /**
   * Get the JWT token
   * @returns {string} - JWT token or null if not logged in
   */
  getToken() {
    return this.token;
  }

  /**
   * Update user information
   * @param {Object} userData - New user data
   */
  updateUser(userData) {
    this.user = { ...this.user, ...userData };
    localStorage.setItem('user', JSON.stringify(this.user));
  }

  /**
   * Check if token is expired
   * @returns {boolean} - True if token is expired or invalid
   */
  isTokenExpired() {
    if (!this.token) return true;
    
    try {
      // Get the expiration from the token (assuming JWT)
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      
      if (!payload || !payload.exp) {
        return true; // No expiration found
      }
      
      const expiration = payload.exp * 1000; // Convert to milliseconds
      return Date.now() > expiration;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // Assume expired on error
    }
  }

  /**
   * Allow setting API service (for compatibility with your original code)
   */
  setApiService(apiService) {
    // This is just a stub for compatibility
  }

  /**
   * Change password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise} - Change password response
   */
  async changePassword(currentPassword, newPassword) {
    try {
      if (!this.isLoggedIn()) {
        throw new Error('User not logged in');
      }

      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Password change failed' }));
        throw new Error(errorData.message || 'Password change failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise} - Password reset request response
   */
  async requestPasswordReset(email) {
    try {
      const response = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Password reset request failed' }));
        throw new Error(errorData.message || 'Password reset request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise} - Password reset response
   */
  async resetPassword(token, newPassword) {
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, newPassword }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Password reset failed' }));
        throw new Error(errorData.message || 'Password reset failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Get user roles and permissions
   * @returns {Object} - User roles and permissions
   */
  getUserRoles() {
    if (!this.user) return { isAdmin: false, roles: [] };
    
    return {
      isAdmin: this.isAdmin(),
      roles: this.user.roles || []
    };
  }

  /**
   * Check if the user has a specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} - True if user has permission
   */
  hasPermission(permission) {
    if (!this.user) return false;
    
    // Admin has all permissions
    if (this.isAdmin()) return true;
    
    // Check user permissions if available
    const permissions = this.user.permissions || [];
    return permissions.includes(permission);
  }
}

// Create global instance
window.authService = new AuthService();

export default window.authService;