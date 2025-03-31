// src/main.js
import { Router } from './utils/router';
import authService from './utils/authService';
import apiService from './utils/apiService';

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing application');
  
  // Make services globally available (they are already initialized as singletons)
  window.apiService = apiService;
  window.authService = authService;
  
  // Create app container if it doesn't exist
  let appContainer = document.getElementById('app');
  if (!appContainer) {
    appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);
  }

  // Handle logout route immediately, before initializing router
  if (window.location.pathname === '/logout') {
    console.log('Logging out user');
    try {
      authService.logout();
      // Use window.location.replace to avoid adding to history
      window.location.replace('/login');
      return; // Stop further execution
    } catch (error) {
      console.error('Error during logout:', error);
      // Force cleanup in case of error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.replace('/login');
      return; // Stop further execution
    }
  }

  // Initialize router
  const router = new Router(authService);
  window.router = router;

  // Define all routes with their respective module paths and view classes
  router.add('/', 'views/home.js', 'HomeView');
  router.add('/login', 'views/login.js', 'LoginView');
  router.add('/dashboard', 'views/dashboard.js', 'DashboardView', true);
  router.add('/profile', 'views/profile.js', 'ProfileView', true);
  router.add('/payments', 'views/payments.js', 'PaymentsView', true);
  router.add('/receipts', 'views/receipts.js', 'ReceiptsView', true);
  router.add('/make-payment', 'views/makePayment.js', 'MakePaymentView', true);
  router.add('/admin/dashboard', 'views/admin/dashboard.js', 'AdminDashboardView', true, true);
  router.add('/admin/users', 'views/admin/users.js', 'AdminUsersView', true, true);
  router.add('/admin/payments', 'views/admin/payments.js', 'AdminPaymentsView', true, true);
  router.add('/admin/expenses', 'views/admin/expenses.js', 'AdminExpensesView', true, true);
  router.add('/admin/add-payment', 'views/admin/addPayment.js', 'AdminAddPaymentView', true, true);
  router.add('/admin/receipts', 'views/admin/receipts.js', 'AdminReceiptsView', true, true);
  router.add('/about', 'views/about.js', 'AboutView');
  router.add('/contact', 'views/contact.js', 'ContactView');
  router.add('/help', 'views/help.js', 'HelpView');

  // Add 404 route
  router.add404('views/notFound.js', 'NotFoundView');

  // Add error handling for unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Display error notification if it's a user-facing issue
    if (event.reason && event.reason.message && !event.reason.isNetworkError) {
      const errorMessage = document.createElement('div');
      errorMessage.textContent = `Error: ${event.reason.message}`;
      errorMessage.style.position = 'fixed';
      errorMessage.style.bottom = '20px';
      errorMessage.style.right = '20px';
      errorMessage.style.padding = '16px';
      errorMessage.style.backgroundColor = '#FFEBEE';
      errorMessage.style.color = '#B71C1C';
      errorMessage.style.borderRadius = '4px';
      errorMessage.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
      errorMessage.style.zIndex = '9999';
      
      // Add close button
      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '5px';
      closeButton.style.right = '5px';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      closeButton.style.fontSize = '16px';
      closeButton.style.cursor = 'pointer';
      closeButton.style.color = '#B71C1C';
      
      closeButton.addEventListener('click', () => {
        document.body.removeChild(errorMessage);
      });
      
      errorMessage.appendChild(closeButton);
      document.body.appendChild(errorMessage);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (document.body.contains(errorMessage)) {
          document.body.removeChild(errorMessage);
        }
      }, 5000);
    }
  });
  
  // Add styles for a loading spinner
  const addSpinnerStyles = () => {
    if (!document.getElementById('spinner-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'spinner-styles';
      styleElement.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-left: 4px solid #4A6DA7;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
        }
        
        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 0;
        }
      `;
      document.head.appendChild(styleElement);
    }
  };

  // Call this to ensure spinner styles are available globally
  addSpinnerStyles();

  // Add global utility functions
  window.formatCurrency = (amount, currency = 'KES') => {
    return `${currency} ${parseFloat(amount).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  window.formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Initialize router
  router.init();
  console.log('Router initialized');
});