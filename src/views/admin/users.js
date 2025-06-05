// src/views/admin/users.js
export class AdminUsersView {
  constructor() {
    this.apiService = window.apiService;
    this.users = [];
    this.filteredUsers = [];
    this.isLoading = true;
    this.error = null;
    this.success = null;
    this.showAddUserForm = false;
    this.showEditUserForm = false;
    this.showPasswordResetForm = false;
    this.editingUser = null;
    this.resettingPasswordUserId = null;
    this.searchTerm = '';
    this.adminCount = 0;
    
    // Data caching
    this.cache = {
      users: null,
      lastFetchTime: 0,
      cacheDuration: 60000, // 1 minute cache
      userPayments: {},
      userPaymentsTimestamp: {}
    };
    
    // Request management
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.requestThrottleTime = 300; // ms between API calls
    this.searchDebounceTimeout = null;
    
    // UI state
    this.currentPage = 1;
    this.usersPerPage = 10;
    this.totalPages = 1;
    this.mobileView = window.innerWidth < 768;
    
    // Color palette aligned with dashboard
    this.colors = {
      primary: '#3b82f6',     // Bright blue
      secondary: '#818cf8',   // Light blue-purple
      accent: '#8b5cf6',      // Purple
      success: '#10b981',     // Green
      danger: '#ef4444',      // Red
      warning: '#f59e0b',     // Amber
      dark: '#0f172a',        // Very dark blue
      darker: '#0a0f1c',      // Even darker blue
      grayDark: '#1e293b',    // Dark slate
      gray: '#64748b',        // Medium slate
      grayLight: '#94a3b8',   // Light slate
      white: '#f1f5f9',       // Off-white
      adminBg: 'rgba(251, 113, 133, 0.2)',  // Pink/red
      adminText: '#fb7185',                 // Pink/red
      userBg: 'rgba(16, 185, 129, 0.2)',    // Green
      userText: '#10b981',                  // Green
      gradient1: '#4f46e5',   // Indigo
      gradient2: '#5568e9'    // Blue purple
    };
    
    // Add styles to document
    this.injectStyles();
    
    // Add window resize listener for responsive design
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  
  handleResize() {
    const wasMobile = this.mobileView;
    this.mobileView = window.innerWidth < 768;
    
    // Only re-render if the view type changes
    if (wasMobile !== this.mobileView) {
      this.updateView();
    }
  }
  
  injectStyles() {
    // Only inject if not already injected
    if (!document.getElementById('admin-users-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'admin-users-styles';
      styleElement.innerHTML = `
        /* Global styling matching the dashboard */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
          margin: 0;
          padding: 0;
          background-color: ${this.colors.dark};
          color: ${this.colors.white};
          font-family: 'Inter', sans-serif;
          overflow-x: hidden;
        }
        
        * {
          box-sizing: border-box;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(79, 107, 255, 0.5);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(79, 107, 255, 0.8);
        }
        
        .admin-users-container {
          background: linear-gradient(125deg, ${this.colors.dark} 0%, ${this.colors.grayDark} 40%, ${this.colors.dark} 100%);
          background-size: 400% 400%;
          animation: gradientBG 15s ease infinite;
          padding: 30px 20px;
          min-height: calc(100vh - 180px);
          position: relative;
          z-index: 1;
          overflow: hidden;
        }
        
        @media (max-width: 767px) {
          .admin-users-container {
            padding: 20px 12px;
          }
        }
        
        .particle-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%234f6bff' fill-opacity='0.03' fill-rule='evenodd'/%3E%3C/svg%3E");
          background-size: 100px 100px;
          background-repeat: repeat;
          z-index: -1;
          animation: floatParticles 150s linear infinite;
        }
        
        .content-wrapper {
          max-width: 1200px;
          margin: 0 auto;
          background: rgba(30, 41, 59, 0.5);
          backdrop-filter: blur(15px);
          border-radius: 24px;
          padding: 30px;
          box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.3), 0 0 15px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          position: relative;
          overflow: hidden;
          animation: fadeIn 0.5s ease-out;
        }
        
        @media (max-width: 767px) {
          .content-wrapper {
            padding: 20px 15px;
            border-radius: 16px;
          }
        }
        
        .nav-container {
          display: flex;
          align-items: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        @media (max-width: 767px) {
          .nav-container {
            margin-bottom: 20px;
          }
        }
        
        .nav-back-button {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(79, 70, 229, 0.1));
          color: ${this.colors.white};
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .nav-back-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(79, 70, 229, 0.2));
        }
        
        .nav-pills {
          display: flex;
          gap: 8px;
          margin-left: auto;
          flex-wrap: wrap;
        }
        
        @media (max-width: 767px) {
          .nav-pills {
            width: 100%;
            margin-left: 0;
            justify-content: center;
            gap: 6px;
          }
        }
        
        .nav-pill {
          padding: 10px 16px;
          background: rgba(30, 41, 59, 0.5);
          color: ${this.colors.white};
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
          text-decoration: none;
        }
        
        .nav-pill:hover {
          background: rgba(30, 41, 59, 0.8);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }
        
        @media (max-width: 767px) {
          .nav-pill {
            padding: 8px 12px;
            font-size: 13px;
            flex: 1;
            justify-content: center;
          }
          
          .nav-pill-text {
            display: none;
          }
        }
        
        .neo-card {
          position: relative;
          backdrop-filter: blur(16px);
          background: rgba(30, 41, 59, 0.5);
          border-radius: 20px;
          border: 1px solid rgba(148, 163, 184, 0.1);
          box-shadow: 
            0 4px 24px -8px rgba(0, 0, 0, 0.3),
            0 0 1px rgba(255, 255, 255, 0.1) inset,
            0 8px 16px -4px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        
        .neo-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, 
            rgba(255, 255, 255, 0), 
            rgba(255, 255, 255, 0.1), 
            rgba(255, 255, 255, 0));
        }
        
        .neo-card:hover {
          transform: translateY(-5px);
          box-shadow: 
            0 12px 30px -10px rgba(0, 0, 0, 0.4),
            0 0 1px rgba(255, 255, 255, 0.15) inset,
            0 8px 20px -6px rgba(66, 108, 245, 0.2);
        }
        
        @media (max-width: 767px) {
          .neo-card {
            border-radius: 16px;
          }
          
          .neo-card:hover {
            transform: none;
          }
        }
        
        .card-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 20px;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }
        
        .neo-card:hover .card-glow {
          opacity: 0.15;
        }
        
        @media (max-width: 767px) {
          .card-glow {
            border-radius: 16px;
          }
        }
        
        .card-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(10px);
          position: relative;
        }
        
        @media (max-width: 767px) {
          .card-header {
            padding: 16px;
          }
        }
        
        .btn {
          padding: 10px 16px;
          border-radius: 12px;
          border: none;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }
        
        .btn::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transition: left 0.7s ease;
        }
        
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
        }
        
        .btn:hover::before {
          left: 100%;
        }
        
        .btn:active {
          transform: translateY(1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) inset;
        }
        
        @media (max-width: 767px) {
          .btn {
            padding: 8px 14px;
            font-size: 13px;
          }
        }
        
        .btn-primary {
          background: linear-gradient(135deg, ${this.colors.primary}, ${this.colors.gradient1});
          color: white;
        }
        
        .btn-primary:hover {
          background: linear-gradient(135deg, #4f87f5, #4338ca);
        }
        
        .btn-secondary {
          background: rgba(30, 41, 59, 0.6);
          color: ${this.colors.white};
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .btn-secondary:hover {
          background: rgba(30, 41, 59, 0.8);
        }
        
        .btn-danger {
          background: linear-gradient(135deg, ${this.colors.danger}, #dc2626);
          color: white;
        }
        
        .btn-danger:hover {
          background: linear-gradient(135deg, #f87171, #b91c1c);
        }
        
        .btn-warning {
          background: linear-gradient(135deg, ${this.colors.warning}, #d97706);
          color: white;
        }
        
        .btn-warning:hover {
          background: linear-gradient(135deg, #fbbf24, #b45309);
        }
        
        .btn-info {
          background: linear-gradient(135deg, ${this.colors.accent}, #7c3aed);
          color: white;
        }
        
        .btn-info:hover {
          background: linear-gradient(135deg, #a78bfa, #6d28d9);
        }
        
        .btn-icon {
          width: 40px;
          height: 40px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-size: 18px;
        }
        
        .btn-icon:hover {
          transform: translateY(-2px) scale(1.05);
        }
        
        @media (max-width: 767px) {
          .btn-icon {
            width: 36px;
            height: 36px;
            font-size: 16px;
            border-radius: 10px;
          }
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          font-size: 14px;
          color: ${this.colors.white};
        }
        
        .form-control {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.3s ease;
          background: rgba(15, 23, 42, 0.5);
          color: ${this.colors.white};
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1) inset;
        }
        
        .form-control:focus {
          border-color: ${this.colors.primary};
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25), 0 2px 6px rgba(0, 0, 0, 0.1) inset;
          outline: none;
        }
        
        @media (max-width: 767px) {
          .form-control {
            padding: 10px 14px;
            font-size: 13px;
          }
        }
        
        .alert {
          padding: 16px 20px;
          border-radius: 16px;
          margin-bottom: 24px;
          border: 1px solid transparent;
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          animation: fadeIn 0.5s ease-out;
        }
        
        .alert::before {
          margin-right: 12px;
          font-size: 20px;
        }
        
        .alert-success {
          background: rgba(16, 185, 129, 0.2);
          border-color: rgba(16, 185, 129, 0.3);
          color: #ecfdf5;
        }
        
        .alert-success::before {
          content: "✓";
          color: ${this.colors.success};
        }
        
        .alert-danger {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
          color: #fef2f2;
        }
        
        .alert-danger::before {
          content: "⚠";
          color: ${this.colors.danger};
        }
        
        @media (max-width: 767px) {
          .alert {
            padding: 14px 16px;
            border-radius: 12px;
            font-size: 13px;
          }
          
          .alert::before {
            font-size: 18px;
          }
        }
        
        .badge {
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
          display: inline-block;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          white-space: nowrap;
        }
        
        .badge-admin {
          background: ${this.colors.adminBg};
          color: ${this.colors.adminText};
          border: 1px solid rgba(251, 113, 133, 0.3);
        }
        
        .badge-user {
          background: ${this.colors.userBg};
          color: ${this.colors.userText};
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        
        .table-container {
          position: relative;
          overflow-x: auto;
          border-radius: 0 0 20px 20px;
          max-height: 500px;
          overflow-y: auto;
        }
        
        @media (max-width: 767px) {
          .table-container {
            max-height: 460px;
            border-radius: 0 0 16px 16px;
          }
        }
        
        .table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 700px; /* Ensures table is scrollable on mobile */
        }
        
        .table th, .table td {
          padding: 16px 20px;
          text-align: left;
        }
        
        .table th {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: ${this.colors.grayLight};
          background: rgba(15, 23, 42, 0.6);
          position: sticky;
          top: 0;
          z-index: 10;
          backdrop-filter: blur(5px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .table th:first-child {
          border-top-left-radius: 12px;
        }
        
        .table th:last-child {
          border-top-right-radius: 12px;
        }
        
        .table tbody tr {
          transition: all 0.2s ease;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .table tbody tr:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
          box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
        }
        
        @media (max-width: 767px) {
          .table th, .table td {
            padding: 14px 16px;
            font-size: 13px;
          }
          
          .table tbody tr:hover {
            transform: none;
          }
        }
        
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          animation: fadeIn 0.3s;
        }
        
        .modal-content {
          background: rgba(30, 41, 59, 0.9);
          padding: 0;
          border-radius: 24px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
          max-width: 800px;
          width: 90%;
          max-height: 90vh;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        
        @media (max-width: 767px) {
          .modal-content {
            width: 95%;
            max-height: 95vh;
            border-radius: 20px;
          }
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(15, 23, 42, 0.5);
        }
        
        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          background: linear-gradient(to right, #ffffff, #e0e7ff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
        }
        
        .modal-close {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: ${this.colors.white};
          width: 32px;
          height: 32px;
          font-size: 20px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .modal-close:hover {
          background: rgba(239, 68, 68, 0.2);
          color: ${this.colors.white};
          transform: rotate(90deg);
        }
        
        .modal-body {
          padding: 24px;
          overflow-y: auto;
          max-height: calc(90vh - 80px);
        }
        
        @media (max-width: 767px) {
          .modal-header {
            padding: 16px 20px;
          }
          
          .modal-body {
            padding: 20px;
            max-height: calc(95vh - 70px);
          }
        }
        
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(15, 23, 42, 0.5);
        }
        
        .page-title {
          color: ${this.colors.white};
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          margin-bottom: 30px;
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(to right, #ffffff, #e0e7ff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        @media (max-width: 767px) {
          .page-title {
            font-size: 24px;
            margin-bottom: 20px;
          }
        }
        
        .loading-spinner {
          display: inline-block;
          width: 40px;
          height: 40px;
          position: relative;
        }
        
        .loading-spinner:after {
          content: " ";
          display: block;
          width: 32px;
          height: 32px;
          margin: 4px;
          border-radius: 50%;
          border: 3px solid transparent;
          border-top-color: ${this.colors.primary};
          border-left-color: ${this.colors.primary};
          animation: spinner 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
        }
        
        @media (max-width: 767px) {
          .loading-spinner {
            width: 32px;
            height: 32px;
          }
          
          .loading-spinner:after {
            width: 24px;
            height: 24px;
          }
        }
        
        .animated-item {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        .animated-item:nth-child(1) { animation-delay: 0.1s; }
        .animated-item:nth-child(2) { animation-delay: 0.2s; }
        .animated-item:nth-child(3) { animation-delay: 0.3s; }
        .animated-item:nth-child(4) { animation-delay: 0.4s; }
        .animated-item:nth-child(5) { animation-delay: 0.5s; }
        
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
        }
        
        .pagination-info {
          font-size: 14px;
          color: ${this.colors.grayLight};
        }
        
        .pagination-button {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(30, 41, 59, 0.4);
          color: ${this.colors.white};
          font-size: 14px;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .pagination-button:hover {
          background: rgba(30, 41, 59, 0.8);
          transform: translateY(-2px);
        }
        
        .pagination-button.active {
          background: linear-gradient(135deg, ${this.colors.primary}, ${this.colors.gradient1});
          border-color: transparent;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        
        .pagination-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }
        
        @media (max-width: 767px) {
          .pagination-button {
            width: 36px;
            height: 36px;
            font-size: 13px;
          }
          
          .pagination-info {
            font-size: 12px;
          }
        }
        
        @keyframes gradientBG {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        
        @keyframes floatParticles {
          from { background-position: 0 0; }
          to { background-position: 1000px 1000px; }
        }
        
        @keyframes pulse {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.7; transform: scale(1); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(10px); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        
        @keyframes spinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleElement);
    }
  }
  
  async render() {
    // Create the main container with the gradient background
    const container = document.createElement('div');
    container.className = 'admin-users-container';
    
    // Add particle overlay (only if not already present)
    if (!document.querySelector('.particle-overlay')) {
      const particleOverlay = document.createElement('div');
      particleOverlay.className = 'particle-overlay';
      document.body.appendChild(particleOverlay);
    }
    
    try {
      // Navigation Section
      const navContainer = document.createElement('div');
      navContainer.className = 'nav-container';
      
      // Back button
      const backLink = document.createElement('a');
      backLink.href = '/admin/dashboard';
      backLink.className = 'nav-back-button';
      backLink.innerHTML = '<span style="margin-right: 10px;">←</span> Dashboard';
      
      // Navigation pills
      const navPills = document.createElement('div');
      navPills.className = 'nav-pills';
      
      // Create navigation items
      const navItems = [
        { icon: '📊', text: 'Dashboard', link: '/admin/dashboard' },
        { icon: '💰', text: 'Payments', link: '/admin/payments' },
        { icon: '📉', text: 'Expenses', link: '/admin/expenses' },
        { icon: '🙏', text: 'Offerings', link: '/admin/offerings' }
      ];
      
      navItems.forEach(item => {
        const pill = document.createElement('a');
        pill.href = item.link;
        pill.className = 'nav-pill';
        pill.innerHTML = `
          <span style="font-size: 18px;">${item.icon}</span>
          <span class="nav-pill-text">${item.text}</span>
        `;
        navPills.appendChild(pill);
      });
      
      navContainer.appendChild(backLink);
      navContainer.appendChild(navPills);
      
      container.appendChild(navContainer);
      
      // Page title
      const pageTitle = document.createElement('h1');
      pageTitle.innerHTML = '<span style="font-size: 32px; margin-right: 12px;">👥</span> User Management';
      pageTitle.className = 'page-title';
      container.appendChild(pageTitle);
      
      // Content wrapper
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'content-wrapper';
      
      // Header section with title and add user button
      const headerSection = document.createElement('div');
      headerSection.className = 'animated-item';
      headerSection.style.marginBottom = '30px';
      headerSection.style.display = 'flex';
      headerSection.style.justifyContent = 'space-between';
      headerSection.style.alignItems = 'center';
      headerSection.style.flexWrap = 'wrap';
      headerSection.style.gap = '16px';
      
      const headerTitle = document.createElement('h2');
      headerTitle.textContent = 'Manage System Users';
      headerTitle.style.fontSize = '22px';
      headerTitle.style.fontWeight = '600';
      headerTitle.style.color = this.colors.white;
      headerTitle.style.margin = '0';
      headerTitle.style.position = 'relative';
      headerTitle.style.paddingLeft = '18px';
      
      // Add accent bar
      const titleAccent = document.createElement('div');
      titleAccent.style.position = 'absolute';
      titleAccent.style.left = '0';
      titleAccent.style.top = '50%';
      titleAccent.style.transform = 'translateY(-50%)';
      titleAccent.style.width = '6px';
      titleAccent.style.height = '24px';
      titleAccent.style.background = `linear-gradient(to bottom, ${this.colors.primary}, ${this.colors.accent})`;
      titleAccent.style.borderRadius = '3px';
      
      headerTitle.appendChild(titleAccent);
      
      const addUserButton = document.createElement('button');
      addUserButton.innerHTML = '<span style="margin-right: 8px;">+</span> Add New User';
      addUserButton.className = 'btn btn-primary';
      
      addUserButton.addEventListener('click', () => {
        this.showAddUserForm = true;
        this.updateView();
      });
      
      headerSection.appendChild(headerTitle);
      headerSection.appendChild(addUserButton);
      contentWrapper.appendChild(headerSection);
      
      // Loading indicator
      if (this.isLoading) {
        const loadingDiv = document.createElement('div');
        loadingDiv.style.display = 'flex';
        loadingDiv.style.flexDirection = 'column';
        loadingDiv.style.justifyContent = 'center';
        loadingDiv.style.alignItems = 'center';
        loadingDiv.style.padding = '60px 0';
        loadingDiv.style.textAlign = 'center';
        
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        
        const loadingText = document.createElement('div');
        loadingText.textContent = 'Loading user data...';
        loadingText.style.marginTop = '20px';
        loadingText.style.color = this.colors.grayLight;
        loadingText.style.fontSize = '14px';
        
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(loadingText);
        contentWrapper.appendChild(loadingDiv);
        
        // Load users data
        this.fetchUsers();
      } else {
        // Show error or success message if any
        if (this.error) {
          const errorBox = document.createElement('div');
          errorBox.className = 'alert alert-danger';
          errorBox.textContent = this.error;
          contentWrapper.appendChild(errorBox);
          
          // Auto-dismiss error after 5 seconds
          setTimeout(() => {
            this.error = null;
            this.updateView();
          }, 5000);
        }
        
        if (this.success) {
          const successBox = document.createElement('div');
          successBox.className = 'alert alert-success';
          successBox.textContent = this.success;
          contentWrapper.appendChild(successBox);
          
          // Auto-dismiss success after 5 seconds
          setTimeout(() => {
            this.success = null;
            this.updateView();
          }, 5000);
        }
        
        // Add User Form (conditionally displayed)
        if (this.showAddUserForm) {
          contentWrapper.appendChild(this.renderAddUserForm());
        }
        
        // Edit User Form (conditionally displayed)
        if (this.showEditUserForm && this.editingUser) {
          contentWrapper.appendChild(this.renderEditUserForm());
        }
        
        // Reset Password Form (conditionally displayed)
        if (this.showPasswordResetForm) {
          contentWrapper.appendChild(this.renderPasswordResetForm());
        }
        
        // Search and Filter Section
        contentWrapper.appendChild(this.renderSearchFilter());
        
        // Users table
        const usersCard = document.createElement('div');
        usersCard.className = 'neo-card animated-item';
        usersCard.style.marginTop = '30px';
        
        // Add glow effect
        const cardGlow = document.createElement('div');
        cardGlow.className = 'card-glow';
        cardGlow.style.background = 'radial-gradient(circle at center, rgba(59, 130, 246, 0.3), transparent 70%)';
        usersCard.appendChild(cardGlow);
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.style.display = 'flex';
        cardHeader.style.justifyContent = 'space-between';
        cardHeader.style.alignItems = 'center';
        cardHeader.style.flexWrap = 'wrap';
        cardHeader.style.gap = '12px';
        
        const cardTitle = document.createElement('h2');
        cardTitle.textContent = 'All Users';
        cardTitle.style.margin = '0';
        cardTitle.style.fontSize = '18px';
        cardTitle.style.fontWeight = '600';
        cardTitle.style.color = this.colors.white;
        
        // Stats pill
        const statsPill = document.createElement('div');
        statsPill.style.background = 'rgba(30, 41, 59, 0.6)';
        statsPill.style.borderRadius = '10px';
        statsPill.style.padding = '6px 12px';
        statsPill.style.fontSize = '13px';
        statsPill.style.color = this.colors.grayLight;
        statsPill.style.display = 'flex';
        statsPill.style.alignItems = 'center';
        statsPill.style.marginRight = '10px';
        
        const totalUsers = this.filteredUsers ? this.filteredUsers.length : 0;
        statsPill.innerHTML = `<span style="margin-right: 6px;">👥</span> ${totalUsers} Users`;
        
        // Print button
        const printButton = document.createElement('button');
        printButton.innerHTML = '<span style="margin-right: 8px;">🖨️</span> <span class="nav-pill-text">Print List</span>';
        printButton.className = 'btn btn-secondary';
        
        printButton.addEventListener('click', () => {
          this.printUsers();
        });
        
        const actionContainer = document.createElement('div');
        actionContainer.style.display = 'flex';
        actionContainer.style.alignItems = 'center';
        actionContainer.style.gap = '12px';
        actionContainer.style.flexWrap = 'wrap';
        
        // Only show stats pill if there are filtered users
        if (this.filteredUsers.length > 0) {
          actionContainer.appendChild(statsPill);
        }
        
        actionContainer.appendChild(printButton);
        
        cardHeader.appendChild(cardTitle);
        cardHeader.appendChild(actionContainer);
        usersCard.appendChild(cardHeader);
        
        // Table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        
        const table = document.createElement('table');
        table.id = 'usersTable';
        table.className = 'table';
        
        // Table header
        const tableHead = document.createElement('thead');
        
        const headerRow = document.createElement('tr');
        
        // Define headers based on screen size
        const headers = this.mobileView 
          ? ['Username', 'Full Name', 'Role', 'Actions']
          : ['Username', 'Full Name', 'Phone', 'Email', 'Role', 'Last Login', 'Actions'];
        
        headers.forEach(headerText => {
          const th = document.createElement('th');
          th.textContent = headerText;
          
          // Set width for actions column
          if (headerText === 'Actions') {
            th.style.width = this.mobileView ? '120px' : '180px';
          }
          
          headerRow.appendChild(th);
        });
        
        tableHead.appendChild(headerRow);
        table.appendChild(tableHead);
        
        // Table body
        const tableBody = document.createElement('tbody');
        
        if (this.filteredUsers.length === 0) {
          const emptyRow = document.createElement('tr');
          const emptyCell = document.createElement('td');
          
          const emptyState = document.createElement('div');
          emptyState.style.display = 'flex';
          emptyState.style.flexDirection = 'column';
          emptyState.style.alignItems = 'center';
          emptyState.style.justifyContent = 'center';
          emptyState.style.padding = '40px 20px';
          
          const emptyIcon = document.createElement('div');
          emptyIcon.innerHTML = '👥';
          emptyIcon.style.fontSize = '32px';
          emptyIcon.style.marginBottom = '16px';
          emptyIcon.style.opacity = '0.6';
          
          const emptyText = document.createElement('div');
          emptyText.textContent = 'No users found';
          emptyText.style.fontSize = '16px';
          emptyText.style.color = this.colors.grayLight;
          
          emptyState.appendChild(emptyIcon);
          emptyState.appendChild(emptyText);
          
          emptyCell.colSpan = headers.length;
          emptyCell.style.textAlign = 'center';
          emptyCell.appendChild(emptyState);
          
          emptyRow.appendChild(emptyCell);
          tableBody.appendChild(emptyRow);
        } else {
          // Calculate pagination
          const totalUsers = this.filteredUsers.length;
          this.totalPages = Math.ceil(totalUsers / this.usersPerPage);
          
          // Get current page users
          const startIndex = (this.currentPage - 1) * this.usersPerPage;
          const endIndex = Math.min(startIndex + this.usersPerPage, totalUsers);
          const currentPageUsers = this.filteredUsers.slice(startIndex, endIndex);
          
          currentPageUsers.forEach((user, index) => {
            const row = document.createElement('tr');
            row.className = 'animated-item';
            row.style.animationDelay = `${0.1 + (index * 0.05)}s`;
            
            const createCell = (content, isMain = false) => {
              const cell = document.createElement('td');
              
              if (content === null || content === undefined || content === '') {
                const dash = document.createElement('span');
                dash.textContent = '—';
                dash.style.color = this.colors.gray;
                dash.style.opacity = '0.6';
                cell.appendChild(dash);
              } else {
                cell.textContent = content;
              }
              
              if (isMain) {
                cell.style.fontWeight = '600';
                cell.style.color = '#f8fafc';
              }
              
              return cell;
            };
            
            // Username
            row.appendChild(createCell(user.username, true));
            
            // Full Name
            row.appendChild(createCell(user.fullName));
            
            // Phone (only on desktop)
            if (!this.mobileView) {
              row.appendChild(createCell(user.phone));
            }
            
            // Email (only on desktop)
            if (!this.mobileView) {
              row.appendChild(createCell(user.email));
            }
            
            // Role
            const roleCell = document.createElement('td');
            
            const roleBadge = document.createElement('span');
            roleBadge.textContent = user.isAdmin ? 'Admin' : 'User';
            roleBadge.className = user.isAdmin ? 'badge badge-admin' : 'badge badge-user';
            
            roleCell.appendChild(roleBadge);
            row.appendChild(roleCell);
            
            // Last Login (only on desktop)
            if (!this.mobileView) {
              const lastLoginText = user.lastLogin 
                ? new Date(user.lastLogin).toLocaleString() 
                : null;
              row.appendChild(createCell(lastLoginText));
            }
            
            // Actions
            const actionsCell = document.createElement('td');
            
            const actionContainer = document.createElement('div');
            actionContainer.style.display = 'flex';
            actionContainer.style.gap = '8px';
            actionContainer.style.flexWrap = 'wrap';
            
            // View button
            const viewButton = document.createElement('button');
            viewButton.innerHTML = '👁️';
            viewButton.title = 'View User Details';
            viewButton.className = 'btn btn-icon btn-info';
            
            viewButton.addEventListener('click', () => {
              this.viewUserDetails(user);
            });
            
            // Edit button
            const editButton = document.createElement('button');
            editButton.innerHTML = '✏️';
            editButton.title = 'Edit User';
            editButton.className = 'btn btn-icon btn-secondary';
            
            editButton.addEventListener('click', () => {
              this.editingUser = {...user};
              this.showEditUserForm = true;
              this.updateView();
            });
            
            // Reset password button
            const resetPasswordButton = document.createElement('button');
            resetPasswordButton.innerHTML = '🔑';
            resetPasswordButton.title = 'Reset Password';
            resetPasswordButton.className = 'btn btn-icon btn-warning';
            
            resetPasswordButton.addEventListener('click', () => {
              this.showPasswordResetForm = true;
              this.resettingPasswordUserId = user.id;
              this.updateView();
            });
            
            // Delete button (only show for non-admin users or if admin count > 1)
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '🗑️';
            deleteButton.title = 'Delete User';
            deleteButton.className = 'btn btn-icon btn-danger';
            
            // Only enable delete if not admin or if there are multiple admins
            if (user.isAdmin && this.adminCount <= 1) {
              deleteButton.disabled = true;
              deleteButton.style.opacity = '0.5';
              deleteButton.style.cursor = 'not-allowed';
              deleteButton.title = 'Cannot delete the last admin user';
            } else {
              deleteButton.addEventListener('click', () => {
                this.deleteUser(user.id);
              });
            }
            
            actionContainer.appendChild(viewButton);
            actionContainer.appendChild(editButton);
            actionContainer.appendChild(resetPasswordButton);
            actionContainer.appendChild(deleteButton);
            actionsCell.appendChild(actionContainer);
            
            row.appendChild(actionsCell);
            tableBody.appendChild(row);
          });
        }
        
        table.appendChild(tableBody);
        tableContainer.appendChild(table);
        usersCard.appendChild(tableContainer);
        
        // Add pagination only if we have users and more than one page
        if (this.filteredUsers.length > 0 && this.totalPages > 1) {
          const paginationContainer = document.createElement('div');
          paginationContainer.className = 'pagination';
          
          // Info text
          const paginationInfo = document.createElement('div');
          paginationInfo.className = 'pagination-info';
          const startIndex = (this.currentPage - 1) * this.usersPerPage + 1;
          const endIndex = Math.min(startIndex + this.usersPerPage - 1, this.filteredUsers.length);
          paginationInfo.textContent = `${startIndex}-${endIndex} of ${this.filteredUsers.length}`;
          
          // Create pagination buttons
          const prevButton = document.createElement('button');
          prevButton.className = `pagination-button ${this.currentPage === 1 ? 'disabled' : ''}`;
          prevButton.innerHTML = '←';
          prevButton.title = 'Previous Page';
          
          if (this.currentPage > 1) {
            prevButton.addEventListener('click', () => {
              this.currentPage--;
              this.updateView();
            });
          }
          
          const nextButton = document.createElement('button');
          nextButton.className = `pagination-button ${this.currentPage === this.totalPages ? 'disabled' : ''}`;
          nextButton.innerHTML = '→';
          nextButton.title = 'Next Page';
          
          if (this.currentPage < this.totalPages) {
            nextButton.addEventListener('click', () => {
              this.currentPage++;
              this.updateView();
            });
          }
          
          // Add page numbers
          const pageButtons = [];
          
          // First page
          if (this.totalPages > 0) {
            const firstPage = document.createElement('button');
            firstPage.className = `pagination-button ${this.currentPage === 1 ? 'active' : ''}`;
            firstPage.textContent = '1';
            
            if (this.currentPage !== 1) {
              firstPage.addEventListener('click', () => {
                this.currentPage = 1;
                this.updateView();
              });
            }
            
            pageButtons.push(firstPage);
            
            // Add ellipsis if needed
            if (this.currentPage > 3) {
              const ellipsis = document.createElement('div');
              ellipsis.textContent = '...';
              ellipsis.style.margin = '0 4px';
              pageButtons.push(ellipsis);
            }
            
            // Add current page and surrounding pages
            for (let i = Math.max(2, this.currentPage - 1); i <= Math.min(this.totalPages - 1, this.currentPage + 1); i++) {
              const pageButton = document.createElement('button');
              pageButton.className = `pagination-button ${this.currentPage === i ? 'active' : ''}`;
              pageButton.textContent = i.toString();
              
              if (this.currentPage !== i) {
                pageButton.addEventListener('click', () => {
                  this.currentPage = i;
                  this.updateView();
                });
              }
              
              pageButtons.push(pageButton);
            }
            
            // Add ellipsis if needed
            if (this.currentPage < this.totalPages - 2) {
              const ellipsis = document.createElement('div');
              ellipsis.textContent = '...';
              ellipsis.style.margin = '0 4px';
              pageButtons.push(ellipsis);
            }
            
            // Last page (if more than 1 page)
            if (this.totalPages > 1) {
              const lastPage = document.createElement('button');
              lastPage.className = `pagination-button ${this.currentPage === this.totalPages ? 'active' : ''}`;
              lastPage.textContent = this.totalPages.toString();
              
              if (this.currentPage !== this.totalPages) {
                lastPage.addEventListener('click', () => {
                  this.currentPage = this.totalPages;
                  this.updateView();
                });
              }
              
              pageButtons.push(lastPage);
            }
          }
          
          // Add all elements to pagination container
          paginationContainer.appendChild(prevButton);
          
          if (this.mobileView) {
            // On mobile, only show prev/next buttons and page info
            paginationContainer.appendChild(paginationInfo);
          } else {
            // On desktop, show page buttons
            pageButtons.forEach(button => {
              paginationContainer.appendChild(button);
            });
          }
          
          paginationContainer.appendChild(nextButton);
          
          usersCard.appendChild(paginationContainer);
        }
        
        contentWrapper.appendChild(usersCard);
      }
      
      container.appendChild(contentWrapper);
    } catch (error) {
      console.error('Error rendering Users view:', error);
      
      const errorMessage = document.createElement('div');
      errorMessage.className = 'alert alert-danger';
      errorMessage.textContent = `Error loading page: ${error.message}`;
      
      container.appendChild(errorMessage);
    }
    
    return container;
  }
  
  renderSearchFilter() {
    const filterSection = document.createElement('div');
    filterSection.className = 'neo-card animated-item';
    filterSection.style.padding = '20px';
    filterSection.style.marginBottom = '30px';
    
    // Add glow effect
    const cardGlow = document.createElement('div');
    cardGlow.className = 'card-glow';
    cardGlow.style.background = 'radial-gradient(circle at center, rgba(139, 92, 246, 0.3), transparent 70%)';
    filterSection.appendChild(cardGlow);
    
    const searchContainer = document.createElement('div');
    searchContainer.style.display = 'flex';
    searchContainer.style.gap = '16px';
    searchContainer.style.alignItems = 'center';
    searchContainer.style.flexWrap = 'wrap';
    
    // Search label and input
    const searchGroup = document.createElement('div');
    searchGroup.style.flex = '1';
    searchGroup.style.minWidth = this.mobileView ? '100%' : '250px';
    searchGroup.style.position = 'relative';
    
    const searchIcon = document.createElement('div');
    searchIcon.innerHTML = '🔍';
    searchIcon.style.position = 'absolute';
    searchIcon.style.left = '14px';
    searchIcon.style.top = '50%';
    searchIcon.style.transform = 'translateY(-50%)';
    searchIcon.style.fontSize = '16px';
    searchIcon.style.opacity = '0.7';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search by username, name, phone or email...';
    searchInput.value = this.searchTerm;
    searchInput.className = 'form-control';
    searchInput.style.paddingLeft = '42px';
    
    searchInput.addEventListener('input', (e) => {
      // Debounce search for better performance
      clearTimeout(this.searchDebounceTimeout);
      const searchValue = e.target.value;
      
      this.searchDebounceTimeout = setTimeout(() => {
        this.searchTerm = searchValue;
        this.currentPage = 1; // Reset to first page when searching
        this.filterUsers();
      }, 300);
    });
    
    searchGroup.appendChild(searchIcon);
    searchGroup.appendChild(searchInput);
    
    // Role filter
    const roleGroup = document.createElement('div');
    roleGroup.style.minWidth = this.mobileView ? '100%' : '180px';
    roleGroup.style.position = 'relative';
    
    const roleIcon = document.createElement('div');
    roleIcon.innerHTML = '👤';
    roleIcon.style.position = 'absolute';
    roleIcon.style.left = '14px';
    roleIcon.style.top = '50%';
    roleIcon.style.transform = 'translateY(-50%)';
    roleIcon.style.fontSize = '16px';
    roleIcon.style.opacity = '0.7';
    
    const roleSelect = document.createElement('select');
    roleSelect.className = 'form-control';
    roleSelect.style.paddingLeft = '42px';
    
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Roles';
    
    const adminOption = document.createElement('option');
    adminOption.value = 'admin';
    adminOption.textContent = 'Admins Only';
    
    const userOption = document.createElement('option');
    userOption.value = 'user';
    userOption.textContent = 'Users Only';
    
    roleSelect.appendChild(allOption);
    roleSelect.appendChild(adminOption);
    roleSelect.appendChild(userOption);
    
    roleSelect.addEventListener('change', () => {
      this.currentPage = 1; // Reset to first page when changing filters
      this.filterUsers();
    });
    
    roleGroup.appendChild(roleIcon);
    roleGroup.appendChild(roleSelect);
    
    searchContainer.appendChild(searchGroup);
    searchContainer.appendChild(roleGroup);
    
    filterSection.appendChild(searchContainer);
    
    return filterSection;
  }
  
  filterUsers() {
    const searchTerm = this.searchTerm.toLowerCase();
    const roleSelect = document.querySelector('select');
    
    // If roleSelect doesn't exist yet, return early
    if (!roleSelect) return;
    
    const roleFilter = roleSelect.value;
    
    this.filteredUsers = this.users.filter(user => {
      // Apply search filter
      const matchesSearch = 
        user.username.toLowerCase().includes(searchTerm) ||
        user.fullName.toLowerCase().includes(searchTerm) ||
        (user.phone && user.phone.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm));
      
      // Apply role filter
      let matchesRole = true;
      if (roleFilter === 'admin') {
        matchesRole = user.isAdmin;
      } else if (roleFilter === 'user') {
        matchesRole = !user.isAdmin;
      }
      
      return matchesSearch && matchesRole;
    });
    
    // Reset to first page if the filtered results don't have the current page
    const totalPages = Math.ceil(this.filteredUsers.length / this.usersPerPage);
    if (this.currentPage > totalPages) {
      this.currentPage = Math.max(1, totalPages);
    }
    
    // Update the UI with filtered results
    this.updateView();
  }
  
  async viewUserDetails(user) {
    // Create a modal to display user details
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h2');
    modalTitle.className = 'modal-title';
    modalTitle.textContent = `User: ${user.username}`;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.innerHTML = '&times;';
    
    closeButton.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.style.maxHeight = this.mobileView ? '75vh' : '80vh';
    
    // User info and payment sections will be side by side
    const flexContainer = document.createElement('div');
    flexContainer.style.display = 'flex';
    flexContainer.style.gap = '24px';
    flexContainer.style.marginBottom = '24px';
    flexContainer.style.flexWrap = this.mobileView ? 'wrap' : 'nowrap';
    
    // User details section
    const userDetailsSection = document.createElement('div');
    userDetailsSection.style.flex = '1';
    userDetailsSection.style.minWidth = this.mobileView ? '100%' : '300px';
    
    const userDetailsCard = document.createElement('div');
    userDetailsCard.className = 'neo-card';
    userDetailsCard.style.height = '100%';
    
    // Add glow effect based on role
    const userCardGlow = document.createElement('div');
    userCardGlow.className = 'card-glow';
    userCardGlow.style.background = user.isAdmin 
      ? 'radial-gradient(circle at center, rgba(251, 113, 133, 0.3), transparent 70%)'
      : 'radial-gradient(circle at center, rgba(16, 185, 129, 0.3), transparent 70%)';
    userDetailsCard.appendChild(userCardGlow);
    
    const userCardHeader = document.createElement('div');
    userCardHeader.className = 'card-header';
    
    const userDetailsTitle = document.createElement('h3');
    userDetailsTitle.textContent = 'Personal Information';
    userDetailsTitle.style.fontSize = '16px';
    userDetailsTitle.style.fontWeight = '600';
    userDetailsTitle.style.margin = '0';
    
    userCardHeader.appendChild(userDetailsTitle);
    userDetailsCard.appendChild(userCardHeader);
    
    const userCardBody = document.createElement('div');
    userCardBody.style.padding = '20px';
    
    const createDetailRow = (label, value) => {
      const row = document.createElement('div');
      row.style.marginBottom = '16px';
      row.style.padding = '8px 0';
      row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      
      const labelSpan = document.createElement('span');
      labelSpan.textContent = label;
      labelSpan.style.fontWeight = '600';
      labelSpan.style.color = this.colors.grayLight;
      labelSpan.style.fontSize = '14px';
      labelSpan.style.display = 'block';
      labelSpan.style.marginBottom = '8px';
      
      const valueSpan = document.createElement('span');
      
      if (value === null || value === undefined || value === '') {
        const dash = document.createElement('span');
        dash.textContent = '—';
        dash.style.color = this.colors.gray;
        dash.style.opacity = '0.6';
        valueSpan.appendChild(dash);
      } else {
        valueSpan.textContent = value;
      }
      
      valueSpan.style.fontSize = '16px';
      valueSpan.style.display = 'block';
      
      row.appendChild(labelSpan);
      row.appendChild(valueSpan);
      
      return row;
    };
    
    // Profile icon container
    const profileContainer = document.createElement('div');
    profileContainer.style.display = 'flex';
    profileContainer.style.alignItems = 'center';
    profileContainer.style.gap = '16px';
    profileContainer.style.marginBottom = '24px';
    
    const profileIcon = document.createElement('div');
    profileIcon.style.width = '60px';
    profileIcon.style.height = '60px';
    profileIcon.style.borderRadius = '50%';
    profileIcon.style.display = 'flex';
    profileIcon.style.alignItems = 'center';
    profileIcon.style.justifyContent = 'center';
    profileIcon.style.fontSize = '24px';
    
    if (user.isAdmin) {
      profileIcon.style.background = 'linear-gradient(135deg, rgba(251, 113, 133, 0.2), rgba(251, 113, 133, 0.1))';
      profileIcon.style.border = '1px solid rgba(251, 113, 133, 0.3)';
      profileIcon.style.color = this.colors.adminText;
      profileIcon.innerHTML = '👑';
    } else {
      profileIcon.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))';
      profileIcon.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      profileIcon.style.color = this.colors.userText;
      profileIcon.innerHTML = '👤';
    }
    
    const profileName = document.createElement('div');
    profileName.style.display = 'flex';
    profileName.style.flexDirection = 'column';
    
    const userName = document.createElement('div');
    userName.textContent = user.fullName;
    userName.style.fontSize = '18px';
    userName.style.fontWeight = '600';
    userName.style.color = this.colors.white;
    
    const userRole = document.createElement('div');
    userRole.textContent = user.isAdmin ? 'Administrator' : 'Regular User';
    userRole.style.fontSize = '14px';
    userRole.style.color = this.colors.grayLight;
    
    profileName.appendChild(userName);
    profileName.appendChild(userRole);
    
    profileContainer.appendChild(profileIcon);
    profileContainer.appendChild(profileName);
    
    userCardBody.appendChild(profileContainer);
    userCardBody.appendChild(createDetailRow('Username', user.username));
    userCardBody.appendChild(createDetailRow('Phone', user.phone));
    userCardBody.appendChild(createDetailRow('Email', user.email));
    userCardBody.appendChild(createDetailRow('Last Login', user.lastLogin ? new Date(user.lastLogin).toLocaleString() : null));
    userCardBody.appendChild(createDetailRow('Created', user.createdAt ? new Date(user.createdAt).toLocaleString() : null));
    userCardBody.appendChild(createDetailRow('Updated', user.updatedAt ? new Date(user.updatedAt).toLocaleString() : null));
    
    userDetailsCard.appendChild(userCardBody);
    userDetailsSection.appendChild(userDetailsCard);
    
    // Payments section
    const paymentsSection = document.createElement('div');
    paymentsSection.style.flex = '2';
    paymentsSection.style.minWidth = this.mobileView ? '100%' : '300px';
    
    const paymentsCard = document.createElement('div');
    paymentsCard.className = 'neo-card';
    
    // Add glow effect
    const paymentCardGlow = document.createElement('div');
    paymentCardGlow.className = 'card-glow';
    paymentCardGlow.style.background = 'radial-gradient(circle at center, rgba(59, 130, 246, 0.3), transparent 70%)';
    paymentsCard.appendChild(paymentCardGlow);
    
    const paymentCardHeader = document.createElement('div');
    paymentCardHeader.className = 'card-header';
    paymentCardHeader.style.display = 'flex';
    paymentCardHeader.style.justifyContent = 'space-between';
    paymentCardHeader.style.alignItems = 'center';
    paymentCardHeader.style.flexWrap = 'wrap';
    paymentCardHeader.style.gap = '12px';
    
    const paymentsTitle = document.createElement('h3');
    paymentsTitle.textContent = 'Payment History';
    paymentsTitle.style.fontSize = '16px';
    paymentsTitle.style.fontWeight = '600';
    paymentsTitle.style.margin = '0';
    
    const downloadPdfButton = document.createElement('button');
    downloadPdfButton.innerHTML = '<span style="margin-right: 8px;">📄</span> Download PDF';
    downloadPdfButton.className = 'btn btn-primary';
    downloadPdfButton.style.fontSize = '13px';
    
    downloadPdfButton.addEventListener('click', () => {
      this.downloadUserPaymentsPdf(user);
    });
    
    paymentCardHeader.appendChild(paymentsTitle);
    paymentCardHeader.appendChild(downloadPdfButton);
    
    paymentsCard.appendChild(paymentCardHeader);
    
    const paymentCardBody = document.createElement('div');
    paymentCardBody.style.padding = '20px';
    
    // Payment filters
    const paymentFilters = document.createElement('div');
    paymentFilters.className = 'neo-card';
    paymentFilters.style.padding = '16px';
    paymentFilters.style.marginBottom = '20px';
    paymentFilters.style.background = 'rgba(15, 23, 42, 0.5)';
    
    const filtersContent = document.createElement('div');
    filtersContent.style.display = 'flex';
    filtersContent.style.gap = '16px';
    filtersContent.style.flexWrap = 'wrap';
    
    const paymentTypeFilter = document.createElement('select');
    paymentTypeFilter.className = 'form-control';
    paymentTypeFilter.style.flex = '1';
    paymentTypeFilter.style.minWidth = this.mobileView ? '100%' : '150px';
    
    const allTypesOption = document.createElement('option');
    allTypesOption.value = 'all';
    allTypesOption.textContent = 'All Payment Types';
    
    const titheOption = document.createElement('option');
    titheOption.value = 'TITHE';
    titheOption.textContent = 'Tithe';
    
    const offeringOption = document.createElement('option');
    offeringOption.value = 'OFFERING';
    offeringOption.textContent = 'Offering';
    
    const donationOption = document.createElement('option');
    donationOption.value = 'DONATION';
    donationOption.textContent = 'Donation';
    
    const specialOption = document.createElement('option');
    specialOption.value = 'SPECIAL';
    specialOption.textContent = 'Special Offering';
    
    paymentTypeFilter.appendChild(allTypesOption);
    paymentTypeFilter.appendChild(titheOption);
    paymentTypeFilter.appendChild(offeringOption);
    paymentTypeFilter.appendChild(donationOption);
    paymentTypeFilter.appendChild(specialOption);
    
    const dateRangeFilter = document.createElement('select');
    dateRangeFilter.className = 'form-control';
    dateRangeFilter.style.flex = '1';
    dateRangeFilter.style.minWidth = this.mobileView ? '100%' : '150px';
    
    const allTimeOption = document.createElement('option');
    allTimeOption.value = 'all';
    allTimeOption.textContent = 'All Time';
    
    const lastMonthOption = document.createElement('option');
    lastMonthOption.value = 'last-month';
    lastMonthOption.textContent = 'Last Month';
    
    const last3MonthsOption = document.createElement('option');
    last3MonthsOption.value = 'last-3-months';
    last3MonthsOption.textContent = 'Last 3 Months';
    
    const lastYearOption = document.createElement('option');
    lastYearOption.value = 'last-year';
    lastYearOption.textContent = 'Last Year';
    
    dateRangeFilter.appendChild(allTimeOption);
    dateRangeFilter.appendChild(lastMonthOption);
    dateRangeFilter.appendChild(last3MonthsOption);
    dateRangeFilter.appendChild(lastYearOption);
    
    const applyFiltersButton = document.createElement('button');
    applyFiltersButton.textContent = 'Apply Filters';
    applyFiltersButton.className = 'btn btn-primary';
    applyFiltersButton.style.minWidth = this.mobileView ? '100%' : 'auto';
    
    applyFiltersButton.addEventListener('click', () => {
      this.fetchUserPayments(user.id, paymentTypeFilter.value, dateRangeFilter.value);
    });
    
    filtersContent.appendChild(paymentTypeFilter);
    filtersContent.appendChild(dateRangeFilter);
    filtersContent.appendChild(applyFiltersButton);
    
    paymentFilters.appendChild(filtersContent);
    paymentCardBody.appendChild(paymentFilters);
    
    // Payments table container (will be populated later)
    const paymentsTableContainer = document.createElement('div');
    paymentsTableContainer.id = 'payments-table-container';
    paymentsTableContainer.style.position = 'relative';
    paymentsTableContainer.style.minHeight = '300px';
    
    // Initial loading spinner
    const loadingSpinner = document.createElement('div');
    loadingSpinner.style.display = 'flex';
    loadingSpinner.style.flexDirection = 'column';
    loadingSpinner.style.justifyContent = 'center';
    loadingSpinner.style.alignItems = 'center';
    loadingSpinner.style.padding = '60px 0';
    loadingSpinner.style.textAlign = 'center';
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading payment data...';
    loadingText.style.marginTop = '20px';
    loadingText.style.color = this.colors.grayLight;
    loadingText.style.fontSize = '14px';
    
    loadingSpinner.appendChild(spinner);
    loadingSpinner.appendChild(loadingText);
    paymentsTableContainer.appendChild(loadingSpinner);
    
    paymentCardBody.appendChild(paymentsTableContainer);
    
    paymentsCard.appendChild(paymentCardBody);
    
    paymentsSection.appendChild(paymentsCard);
    
    // Add both sections to flex container
    flexContainer.appendChild(userDetailsSection);
    flexContainer.appendChild(paymentsSection);
    
    modalBody.appendChild(flexContainer);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Fetch initial payment data
    this.fetchUserPayments(user.id, 'all', 'all');
  }
  
  async fetchUserPayments(userId, paymentType = 'all', dateRange = 'all') {
    const paymentsTableContainer = document.getElementById('payments-table-container');
    if (!paymentsTableContainer) return;
    
    // Generate a cache key based on the filters
    const cacheKey = `${userId}-${paymentType}-${dateRange}`;
    
    // Check if we have cached data for this request
    if (this.cache.userPayments[cacheKey] && 
        Date.now() - this.cache.userPaymentsTimestamp[cacheKey] < this.cache.cacheDuration) {
      // Use cached data
      this.renderPaymentsTable(paymentsTableContainer, this.cache.userPayments[cacheKey]);
      return;
    }
    
    // Show loading spinner
    paymentsTableContainer.innerHTML = '';
    const loadingSpinner = document.createElement('div');
    loadingSpinner.style.display = 'flex';
    loadingSpinner.style.flexDirection = 'column';
    loadingSpinner.style.justifyContent = 'center';
    loadingSpinner.style.alignItems = 'center';
    loadingSpinner.style.padding = '60px 0';
    loadingSpinner.style.textAlign = 'center';
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading payment data...';
    loadingText.style.marginTop = '20px';
    loadingText.style.color = this.colors.grayLight;
    loadingText.style.fontSize = '14px';
    
    loadingSpinner.appendChild(spinner);
    loadingSpinner.appendChild(loadingText);
    paymentsTableContainer.appendChild(loadingSpinner);
    
    try {
      // Build query parameters
      const params = { userId };
      
      // Add date range parameters
      const now = new Date();
      if (dateRange === 'last-month') {
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        params.startDate = lastMonth.toISOString();
        params.endDate = now.toISOString();
      } else if (dateRange === 'last-3-months') {
        const last3Months = new Date(now);
        last3Months.setMonth(last3Months.getMonth() - 3);
        params.startDate = last3Months.toISOString();
        params.endDate = now.toISOString();
      } else if (dateRange === 'last-year') {
        const lastYear = new Date(now);
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        params.startDate = lastYear.toISOString();
        params.endDate = now.toISOString();
      }
      
      // Add payment type parameter
      if (paymentType !== 'all') {
        params.paymentType = paymentType;
      }
      
      // Fetch payments data using throttled API queue
      const response = await this.queueApiRequest(() => {
        return this.apiService.getUserPayments(userId, params);
      });
      
      // Cache the response
      this.cache.userPayments[cacheKey] = response;
      this.cache.userPaymentsTimestamp[cacheKey] = Date.now();
      
      // Render the payments table
      this.renderPaymentsTable(paymentsTableContainer, response);
      
    } catch (error) {
      console.error('Error fetching user payments:', error);
      
      paymentsTableContainer.innerHTML = '';
      
      const errorState = document.createElement('div');
      errorState.style.display = 'flex';
      errorState.style.flexDirection = 'column';
      errorState.style.alignItems = 'center';
      errorState.style.justifyContent = 'center';
      errorState.style.padding = '40px 20px';
      errorState.style.textAlign = 'center';
      
      const errorIcon = document.createElement('div');
      errorIcon.innerHTML = '⚠️';
      errorIcon.style.fontSize = '32px';
      errorIcon.style.marginBottom = '16px';
      errorIcon.style.color = this.colors.danger;
      
      const errorTitle = document.createElement('div');
      errorTitle.textContent = 'Error Loading Payments';
      errorTitle.style.fontSize = '18px';
      errorTitle.style.fontWeight = '600';
      errorTitle.style.color = this.colors.white;
      errorTitle.style.marginBottom = '8px';
      
      const errorMessage = document.createElement('div');
      errorMessage.textContent = 'Unable to load payment data. Please try again.';
      errorMessage.style.fontSize = '14px';
      errorMessage.style.color = this.colors.grayLight;
      
      const retryButton = document.createElement('button');
      retryButton.innerHTML = '<span style="margin-right: 8px;">🔄</span> Retry';
      retryButton.className = 'btn btn-primary';
      retryButton.style.marginTop = '20px';
      
      retryButton.addEventListener('click', () => {
        this.fetchUserPayments(userId, paymentType, dateRange);
      });
      
      errorState.appendChild(errorIcon);
      errorState.appendChild(errorTitle);
      errorState.appendChild(errorMessage);
      errorState.appendChild(retryButton);
      
      paymentsTableContainer.appendChild(errorState);
    }
  }
  
  renderPaymentsTable(container, response) {
    // Clear container
    container.innerHTML = '';
    
    // Create payments table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'neo-card';
    tableContainer.style.overflow = 'hidden';
    
    const tableWrapper = document.createElement('div');
    tableWrapper.style.overflowX = 'auto';
    tableWrapper.style.maxHeight = '400px';
    tableWrapper.style.overflowY = 'auto';
    
    const table = document.createElement('table');
    table.className = 'table';
    table.style.width = '100%';
    table.style.margin = '0';
    table.style.minWidth = '700px'; // Ensures table is scrollable on mobile
    
    // Table header
    const tableHead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Date', 'Type', 'Amount', 'Status', 'Receipt'];
    
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    
    tableHead.appendChild(headerRow);
    table.appendChild(tableHead);
    
    // Table body
    const tableBody = document.createElement('tbody');
    
    if (response.payments && response.payments.length > 0) {
      response.payments.forEach((payment, index) => {
        const row = document.createElement('tr');
        row.className = 'animated-item';
        row.style.animationDelay = `${0.1 + (index * 0.05)}s`;
        
        // Date
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(payment.paymentDate).toLocaleDateString();
        row.appendChild(dateCell);
        
        // Type
        const typeCell = document.createElement('td');
        
        const typeBadge = document.createElement('span');
        typeBadge.textContent = this.formatPaymentType(payment.paymentType);
        typeBadge.className = 'badge';
        
        if (payment.paymentType === 'TITHE') {
          typeBadge.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
          typeBadge.style.color = '#60a5fa';
          typeBadge.style.border = '1px solid rgba(59, 130, 246, 0.3)';
        } else if (payment.paymentType === 'OFFERING') {
          typeBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
          typeBadge.style.color = '#34d399';
          typeBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        } else if (payment.paymentType.startsWith('SPECIAL')) {
          typeBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
          typeBadge.style.color = '#fbbf24';
          typeBadge.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        } else {
          typeBadge.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
          typeBadge.style.color = '#a78bfa';
          typeBadge.style.border = '1px solid rgba(139, 92, 246, 0.3)';
        }
        
        typeCell.appendChild(typeBadge);
        row.appendChild(typeCell);
        
        // Amount
        const amountCell = document.createElement('td');
        const amountText = document.createElement('div');
        amountText.textContent = `KES ${Number(payment.amount).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
        amountText.style.fontWeight = '600';
        amountText.style.color = this.colors.white;
        amountCell.appendChild(amountText);
        row.appendChild(amountCell);
        
        // Status
        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.textContent = payment.status;
        statusBadge.className = 'badge';
        
        if (payment.status === 'COMPLETED') {
          statusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
          statusBadge.style.color = '#34d399';
          statusBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        } else if (payment.status === 'PENDING') {
          statusBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
          statusBadge.style.color = '#fbbf24';
          statusBadge.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        } else {
          statusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
          statusBadge.style.color = '#f87171';
          statusBadge.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        }
        
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);
        
        // Receipt
        const receiptCell = document.createElement('td');
        if (payment.receiptNumber) {
          // Format receipt number to be clean - avoid showing random characters
          const formattedReceiptNumber = this.formatReceiptNumber(payment.receiptNumber);
          
          const receiptButton = document.createElement('button');
          receiptButton.innerHTML = '<span style="margin-right: 6px;">🧾</span> View';
          receiptButton.className = 'btn btn-info';
          receiptButton.style.fontSize = '12px';
          receiptButton.style.padding = '6px 12px';
          receiptButton.title = `Receipt #${formattedReceiptNumber}`;
          
          receiptButton.addEventListener('click', () => {
            // Navigate to receipt or download receipt
            if (this.apiService.downloadReceipt) {
              this.queueApiRequest(() => this.apiService.downloadReceipt(payment.id));
            }
          });
          
          receiptCell.appendChild(receiptButton);
        } else {
          const dash = document.createElement('span');
          dash.textContent = '—';
          dash.style.color = this.colors.gray;
          dash.style.opacity = '0.6';
          receiptCell.appendChild(dash);
        }
        row.appendChild(receiptCell);
        
        tableBody.appendChild(row);
      });
    } else {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      
      const emptyState = document.createElement('div');
      emptyState.style.display = 'flex';
      emptyState.style.flexDirection = 'column';
      emptyState.style.alignItems = 'center';
      emptyState.style.justifyContent = 'center';
      emptyState.style.padding = '40px 20px';
      
      const emptyIcon = document.createElement('div');
      emptyIcon.innerHTML = '💸';
      emptyIcon.style.fontSize = '32px';
      emptyIcon.style.marginBottom = '16px';
      emptyIcon.style.opacity = '0.6';
      
      const emptyText = document.createElement('div');
      emptyText.textContent = 'No payments found';
      emptyText.style.fontSize = '16px';
      emptyText.style.color = this.colors.grayLight;
      
      emptyState.appendChild(emptyIcon);
      emptyState.appendChild(emptyText);
      
      emptyCell.colSpan = headers.length;
      emptyCell.style.textAlign = 'center';
      emptyCell.appendChild(emptyState);
      
      emptyRow.appendChild(emptyCell);
      tableBody.appendChild(emptyRow);
    }
    
    table.appendChild(tableBody);
    tableWrapper.appendChild(table);
    tableContainer.appendChild(tableWrapper);
    
    // Add summary section
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'neo-card';
    summaryDiv.style.marginTop = '24px';
    summaryDiv.style.padding = '20px';
    summaryDiv.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
    summaryDiv.style.backdropFilter = 'blur(5px)';
    
    const summaryHeader = document.createElement('h4');
    summaryHeader.textContent = 'Payment Summary';
    summaryHeader.style.margin = '0 0 16px 0';
    summaryHeader.style.fontSize = '16px';
    summaryHeader.style.fontWeight = '600';
    summaryHeader.style.color = this.colors.white;
    
    const summaryGrid = document.createElement('div');
    summaryGrid.style.display = 'grid';
    summaryGrid.style.gridTemplateColumns = this.mobileView 
      ? 'repeat(1, 1fr)' 
      : 'repeat(3, 1fr)';
    summaryGrid.style.gap = '20px';
    
    // Calculate totals
    const completedPayments = response.payments?.filter(p => p.status === 'COMPLETED') || [];
    const totalAmount = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const averageAmount = completedPayments.length ? totalAmount / completedPayments.length : 0;
    
    // Total payments
    const totalPart = document.createElement('div');
    
    const totalIcon = document.createElement('div');
    totalIcon.innerHTML = '🧮';
    totalIcon.style.fontSize = '24px';
    totalIcon.style.marginBottom = '12px';
    totalIcon.style.opacity = '0.8';
    
    const totalLabel = document.createElement('div');
    totalLabel.textContent = 'Total Payments';
    totalLabel.style.fontSize = '13px';
    totalLabel.style.fontWeight = '500';
    totalLabel.style.color = this.colors.grayLight;
    totalLabel.style.marginBottom = '8px';
    
    const totalValue = document.createElement('div');
    totalValue.textContent = completedPayments.length.toString();
    totalValue.style.fontSize = '24px';
    totalValue.style.fontWeight = '700';
    totalValue.style.color = this.colors.white;
    
    totalPart.appendChild(totalIcon);
    totalPart.appendChild(totalLabel);
    totalPart.appendChild(totalValue);
    
    // Total amount
    const amountPart = document.createElement('div');
    
    const amountIcon = document.createElement('div');
    amountIcon.innerHTML = '💰';
    amountIcon.style.fontSize = '24px';
    amountIcon.style.marginBottom = '12px';
    amountIcon.style.opacity = '0.8';
    
    const amountLabel = document.createElement('div');
    amountLabel.textContent = 'Total Amount';
    amountLabel.style.fontSize = '13px';
    amountLabel.style.fontWeight = '500';
    amountLabel.style.color = this.colors.grayLight;
    amountLabel.style.marginBottom = '8px';
    
    const amountValue = document.createElement('div');
    amountValue.textContent = `KES ${totalAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
    amountValue.style.fontSize = '24px';
    amountValue.style.fontWeight = '700';
    amountValue.style.color = this.colors.white;
    
    amountPart.appendChild(amountIcon);
    amountPart.appendChild(amountLabel);
    amountPart.appendChild(amountValue);
    
    // Average amount
    const averagePart = document.createElement('div');
    
    const averageIcon = document.createElement('div');
    averageIcon.innerHTML = '📊';
    averageIcon.style.fontSize = '24px';
    averageIcon.style.marginBottom = '12px';
    averageIcon.style.opacity = '0.8';
    
    const averageLabel = document.createElement('div');
    averageLabel.textContent = 'Average Amount';
    averageLabel.style.fontSize = '13px';
    averageLabel.style.fontWeight = '500';
    averageLabel.style.color = this.colors.grayLight;
    averageLabel.style.marginBottom = '8px';
    
    const averageValue = document.createElement('div');
    averageValue.textContent = `KES ${averageAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
    averageValue.style.fontSize = '24px';
    averageValue.style.fontWeight = '700';
    averageValue.style.color = this.colors.white;
    
    averagePart.appendChild(averageIcon);
    averagePart.appendChild(averageLabel);
    averagePart.appendChild(averageValue);
    
    summaryGrid.appendChild(totalPart);
    summaryGrid.appendChild(amountPart);
    summaryGrid.appendChild(averagePart);
    
    summaryDiv.appendChild(summaryHeader);
    summaryDiv.appendChild(summaryGrid);
    
    // Add to container
    container.appendChild(tableContainer);
    
    // Only show summary if we have payments
    if (response.payments && response.payments.length > 0) {
      container.appendChild(summaryDiv);
    }
    
    // Store filtered payments for PDF download
    this.filteredUserPayments = response.payments || [];
    this.filteredUserName = response.userId;
  }
  
  async downloadUserPaymentsPdf(user) {
    // If no filtered payments are available, fetch all payments first
    if (!this.filteredUserPayments || this.filteredUserName !== user.id) {
      await this.fetchUserPayments(user.id, 'all', 'all');
    }
    
    const payments = this.filteredUserPayments || [];
    
    // Generate PDF in a new window
    const printWindow = window.open('', '_blank');
    
    const completedPayments = payments.filter(p => p.status === 'COMPLETED');
    const totalAmount = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Report for ${user.fullName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { 
            font-family: 'Inter', sans-serif; 
            margin: 40px; 
            line-height: 1.6; 
            color: #333;
            background: linear-gradient(125deg, #f8fafc 0%, #e2e8f0 50%, #f8fafc 100%);
            background-size: 200% 200%;
            animation: gradientBG 15s ease infinite;
          }
          h1 { 
            color: ${this.colors.primary}; 
            margin-bottom: 10px; 
            font-weight: 700;
            font-size: 28px;
          }
          h2 { 
            color: #333; 
            margin-top: 0; 
            font-weight: 500; 
            margin-bottom: 30px;
            font-size: 20px;
          }
          .header { 
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid ${this.colors.primary}; 
          }
          .user-info { 
            margin-bottom: 30px; 
            border-left: 4px solid ${this.colors.primary}; 
            padding-left: 15px;
            background-color: rgba(59, 130, 246, 0.05);
            padding: 20px;
            border-radius: 8px;
          }
          .user-info p { margin: 8px 0; }
          .user-info .label { font-weight: 600; color: #555; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 30px 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border-radius: 8px;
            overflow: hidden;
          }
          th, td { 
            text-align: left; 
            padding: 12px 15px; 
            border-bottom: 1px solid #e2e8f0; 
          }
          th { 
            background-color: ${this.colors.primary}; 
            font-weight: 600; 
            color: white;
            font-size: 12px;
            text-transform: uppercase;
          }
          tr:nth-child(even) { background-color: #f8fafc; }
          tr:hover { background-color: #eef2ff; }
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 500;
          }
          .status-completed { background-color: #d1fae5; color: #065f46; }
          .status-pending { background-color: #fef3c7; color: #92400e; }
          .status-failed { background-color: #fee2e2; color: #9e1c3b; }
          .summary { 
            margin-top: 30px; 
            background-color: #f8fafc; 
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
          }
          .summary h3 { 
            margin-top: 0; 
            color: ${this.colors.primary};
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
          }
          .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 30px;
          }
          .summary-item { 
            padding: 15px;
            border-radius: 8px;
            background-color: white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
            border: 1px solid #edf2f7;
          }
          .summary-item .label { 
            font-size: 14px; 
            color: #64748b;
            margin-bottom: 8px;
            font-weight: 500;
          }
          .summary-item .value { 
            font-size: 24px; 
            font-weight: 700; 
            color: #333;
          }
          .footer { 
            margin-top: 50px; 
            text-align: center; 
            font-size: 12px; 
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
          @keyframes gradientBG {
            0% { background-position: 0% 50% }
            50% { background-position: 100% 50% }
            100% { background-position: 0% 50% }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Payment Report</h1>
          <h2>${user.fullName}</h2>
        </div>
        
        <div class="user-info">
          <p><span class="label">Username:</span> ${user.username}</p>
          <p><span class="label">Phone:</span> ${user.phone || '-'}</p>
          <p><span class="label">Email:</span> ${user.email || '-'}</p>
          <p><span class="label">Role:</span> ${user.isAdmin ? 'Administrator' : 'Regular User'}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Receipt Number</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length > 0 ? payments.map(payment => `
              <tr>
                <td>${new Date(payment.paymentDate).toLocaleDateString()}</td>
                <td>${this.formatPaymentType(payment.paymentType)}</td>
                <td>KES ${Number(payment.amount).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}</td>
                <td>
                  <span class="status-badge status-${payment.status.toLowerCase()}">
                    ${payment.status}
                  </span>
                </td>
                <td>${this.formatReceiptNumber(payment.receiptNumber) || '-'}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="5" style="text-align: center;">No payments found</td>
              </tr>
            `}
          </tbody>
        </table>
        
        <div class="summary">
          <h3>Payment Summary</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="label">Total Payments</div>
              <div class="value">${completedPayments.length}</div>
            </div>
            <div class="summary-item">
              <div class="label">Total Amount</div>
              <div class="value">KES ${totalAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}</div>
            </div>
            <div class="summary-item">
              <div class="label">Average Amount</div>
              <div class="value">KES ${(completedPayments.length ? totalAmount / completedPayments.length : 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}</div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()} | TASSIAC Church Payment System</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
      printWindow.print();
    };
  }
  
  printUsers() {
    const printWindow = window.open('', '_blank');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>TASSIAC - User List</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { 
            font-family: 'Inter', sans-serif; 
            margin: 40px; 
            line-height: 1.6; 
            color: #333;
          }
          h1 { 
            color: ${this.colors.primary}; 
            margin-bottom: 8px;
            font-weight: 700;
            font-size: 28px;
          }
          .print-info { 
            margin-bottom: 30px; 
            color: #666; 
            font-size: 14px;
            padding: 15px;
            background-color: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid ${this.colors.primary};
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border-radius: 8px;
            overflow: hidden;
          }
          th, td { 
            text-align: left; 
            padding: 12px 15px; 
            border-bottom: 1px solid #ddd; 
          }
          th { 
            background-color: ${this.colors.primary}; 
            font-weight: 600; 
            color: white;
            font-size: 12px;
            text-transform: uppercase;
          }
          tr:nth-child(even) { background-color: #f9f9f9; }
          tr:hover { background-color: #eef2ff; }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 500;
          }
          .badge-admin { 
            background-color: #fecdd3; 
            color: #e11d48;
          }
          .badge-user { 
            background-color: #a7f3d0; 
            color: #047857;
          }
          .footer { 
            margin-top: 50px; 
            text-align: center; 
            font-size: 12px; 
            color: #666;
            border-top: 1px solid #eaeaea;
            padding-top: 20px;
          }
          
          @media print {
            .no-print { display: none; }
            body { margin: 0; padding: 20px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
            thead { display: table-header-group; }
          }
        </style>
      </head>
      <body>
        <h1>TASSIAC User List</h1>
        <div class="print-info">
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
          <p><strong>Total Users:</strong> ${this.filteredUsers.length}</p>
        </div>
        
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.print()" style="
            background-color: ${this.colors.primary};
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">Print Now</button>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredUsers.map(user => `
              <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.fullName}</td>
                <td>${user.phone || '-'}</td>
                <td>${user.email || '-'}</td>
                <td>
                  <span class="badge ${user.isAdmin ? 'badge-admin' : 'badge-user'}">
                    ${user.isAdmin ? 'Admin' : 'User'}
                  </span>
                </td>
                <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()} | TASSIAC Church Management System</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.focus();
      }, 500);
    };
  }
  
  renderAddUserForm() {
    const formCard = document.createElement('div');
    formCard.className = 'neo-card animated-item';
    formCard.style.marginBottom = '30px';
    
    // Add glow effect
    const cardGlow = document.createElement('div');
    cardGlow.className = 'card-glow';
    cardGlow.style.background = 'radial-gradient(circle at center, rgba(59, 130, 246, 0.3), transparent 70%)';
    formCard.appendChild(cardGlow);
    
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.style.display = 'flex';
    cardHeader.style.justifyContent = 'space-between';
    cardHeader.style.alignItems = 'center';
    
    const cardTitle = document.createElement('h2');
    cardTitle.textContent = 'Add New User';
    cardTitle.style.margin = '0';
    cardTitle.style.fontSize = '18px';
    cardTitle.style.fontWeight = '600';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.innerHTML = '&times;';
    
    closeButton.addEventListener('click', () => {
      this.showAddUserForm = false;
      this.updateView();
    });
    
    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(closeButton);
    formCard.appendChild(cardHeader);
    
    const cardBody = document.createElement('div');
    cardBody.style.padding = '24px';
    
    const form = document.createElement('form');
    form.id = 'addUserForm';
    form.style.display = 'grid';
    form.style.gridTemplateColumns = this.mobileView ? '1fr' : 'repeat(2, 1fr)';
    form.style.gap = '20px';
    
    // Username
    const usernameGroup = this.createFormGroup('Username', 'username', 'text', '👤');
    const usernameInput = usernameGroup.querySelector('input');
    usernameInput.required = true;
    usernameInput.placeholder = 'Enter username';
    usernameInput.pattern = '^[a-zA-Z0-9_-]+$';
    usernameInput.title = 'Username can only contain letters, numbers, underscores and hyphens';
    
    // Full Name
    const fullNameGroup = this.createFormGroup('Full Name', 'fullName', 'text', '📝');
    const fullNameInput = fullNameGroup.querySelector('input');
    fullNameInput.required = true;
    fullNameInput.placeholder = 'Enter full name';
    
    // Phone
    const phoneGroup = this.createFormGroup('Phone', 'phone', 'tel', '📱');
    const phoneInput = phoneGroup.querySelector('input');
    phoneInput.required = true;
    phoneInput.placeholder = 'Enter phone number';
    
    // Email
    const emailGroup = this.createFormGroup('Email', 'email', 'email', '✉️');
    const emailInput = emailGroup.querySelector('input');
    emailInput.placeholder = 'Enter email address';
    
    // Password
    const passwordGroup = this.createFormGroup('Password', 'password', 'password', '🔒');
    const passwordInput = passwordGroup.querySelector('input');
    passwordInput.required = true;
    passwordInput.placeholder = 'Enter password';
    passwordInput.pattern = '(?=.*[A-Z])(?=.*[0-9]).{8,}';
    passwordInput.title = 'Password must be at least 8 characters with at least 1 uppercase letter and 1 number';
    
    // Confirm Password
    const confirmPasswordGroup = this.createFormGroup('Confirm Password', 'confirmPassword', 'password', '🔒');
    const confirmPasswordInput = confirmPasswordGroup.querySelector('input');
    confirmPasswordInput.required = true;
    confirmPasswordInput.placeholder = 'Confirm password';
    
    // Is Admin (disabled if we already have 5 admins)
    const adminGroup = document.createElement('div');
    adminGroup.className = 'form-group';
    adminGroup.style.gridColumn = this.mobileView ? '1' : '1 / 3';
    adminGroup.style.margin = '8px 0';
    adminGroup.style.backgroundColor = 'rgba(15, 23, 42, 0.3)';
    adminGroup.style.padding = '15px';
    adminGroup.style.borderRadius = '12px';
    
    const roleHeading = document.createElement('h4');
    roleHeading.textContent = 'User Role';
    roleHeading.style.margin = '0 0 10px 0';
    roleHeading.style.fontSize = '15px';
    roleHeading.style.fontWeight = '600';
    roleHeading.style.color = this.colors.white;
    
    const roleOptions = document.createElement('div');
    roleOptions.style.display = 'flex';
    roleOptions.style.gap = '20px';
    roleOptions.style.flexDirection = this.mobileView ? 'column' : 'row';
    
    // Regular User option
    const userOption = document.createElement('div');
    userOption.style.display = 'flex';
    userOption.style.alignItems = 'center';
    userOption.style.gap = '10px';
    userOption.style.flex = '1';
    userOption.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
    userOption.style.padding = '15px';
    userOption.style.borderRadius = '10px';
    userOption.style.cursor = 'pointer';
    userOption.style.border = '1px solid rgba(16, 185, 129, 0.2)';
    
    const userRadio = document.createElement('input');
    userRadio.type = 'radio';
    userRadio.id = 'roleUser';
    userRadio.name = 'isAdmin';
    userRadio.value = 'false';
    userRadio.checked = true;
    userRadio.style.margin = '0';
    
    const userLabel = document.createElement('label');
    userLabel.htmlFor = 'roleUser';
    userLabel.style.margin = '0';
    userLabel.style.cursor = 'pointer';
    userLabel.style.fontWeight = '500';
    userLabel.style.display = 'flex';
    userLabel.style.flexDirection = 'column';
    userLabel.style.gap = '5px';
    
    const userTitle = document.createElement('span');
    userTitle.innerHTML = '<span style="margin-right: 6px; font-size: 18px;">👤</span> Regular User';
    userTitle.style.fontSize = '14px';
    userTitle.style.fontWeight = '600';
    
    const userDesc = document.createElement('span');
    userDesc.textContent = 'Can view and manage their own data';
    userDesc.style.fontSize = '12px';
    userDesc.style.color = this.colors.grayLight;
    
    userLabel.appendChild(userTitle);
    userLabel.appendChild(userDesc);
    
    userOption.appendChild(userRadio);
    userOption.appendChild(userLabel);
    
    // Admin User option
    const adminOption = document.createElement('div');
    adminOption.style.display = 'flex';
    adminOption.style.alignItems = 'center';
    adminOption.style.gap = '10px';
    adminOption.style.flex = '1';
    adminOption.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
    adminOption.style.padding = '15px';
    adminOption.style.borderRadius = '10px';
    adminOption.style.cursor = 'pointer';
    adminOption.style.border = '1px solid rgba(251, 113, 133, 0.2)';
    
    const adminRadio = document.createElement('input');
    adminRadio.type = 'radio';
    adminRadio.id = 'roleAdmin';
    adminRadio.name = 'isAdmin';
    adminRadio.value = 'true';
    adminRadio.style.margin = '0';
    
    // Disable admin option if we already have 5 admins
    if (this.adminCount >= 5) {
      adminRadio.disabled = true;
      adminOption.style.opacity = '0.5';
      adminOption.style.cursor = 'not-allowed';
    }
    
    const adminLabel = document.createElement('label');
    adminLabel.htmlFor = 'roleAdmin';
    adminLabel.style.margin = '0';
    adminLabel.style.cursor = this.adminCount >= 5 ? 'not-allowed' : 'pointer';
    adminLabel.style.fontWeight = '500';
    adminLabel.style.display = 'flex';
    adminLabel.style.flexDirection = 'column';
    adminLabel.style.gap = '5px';
    
    const adminTitle = document.createElement('span');
    adminTitle.innerHTML = '<span style="margin-right: 6px; font-size: 18px;">👑</span> Administrator';
    adminTitle.style.fontSize = '14px';
    adminTitle.style.fontWeight = '600';
    
    const adminDesc = document.createElement('span');
    adminDesc.textContent = `Full access to system (${this.adminCount}/5 used)`;
    adminDesc.style.fontSize = '12px';
    adminDesc.style.color = this.colors.grayLight;
    
    adminLabel.appendChild(adminTitle);
    adminLabel.appendChild(adminDesc);
    
    adminOption.appendChild(adminRadio);
    adminOption.appendChild(adminLabel);
    
    roleOptions.appendChild(userOption);
    roleOptions.appendChild(adminOption);
    
    adminGroup.appendChild(roleHeading);
    adminGroup.appendChild(roleOptions);
    
    // Password requirements
    const passwordRequirements = document.createElement('div');
    passwordRequirements.className = 'form-group';
    passwordRequirements.style.gridColumn = this.mobileView ? '1' : '1 / 3';
    passwordRequirements.style.backgroundColor = 'rgba(15, 23, 42, 0.3)';
    passwordRequirements.style.padding = '15px';
    passwordRequirements.style.borderRadius = '12px';
    passwordRequirements.style.fontSize = '13px';
    passwordRequirements.style.color = this.colors.grayLight;
    
    passwordRequirements.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600; color: ${this.colors.white};">Password Requirements:</div>
      <ul style="margin: 0; padding-left: 20px;">
        <li>At least 8 characters long</li>
        <li>At least one uppercase letter (A-Z)</li>
        <li>At least one number (0-9)</li>
      </ul>
    `;
    
    // Submit button
    const buttonGroup = document.createElement('div');
    buttonGroup.style.gridColumn = this.mobileView ? '1' : '1 / 3';
    buttonGroup.style.marginTop = '20px';
    buttonGroup.style.display = 'flex';
    buttonGroup.style.justifyContent = 'flex-end';
    buttonGroup.style.gap = '16px';
    buttonGroup.style.flexWrap = 'wrap';
    
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn-secondary';
    
    cancelButton.addEventListener('click', () => {
      this.showAddUserForm = false;
      this.updateView();
    });
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'btn btn-primary';
    submitButton.innerHTML = '<span style="margin-right: 8px;">➕</span> Create User';
    
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(submitButton);
    
    // Append all elements to form
    form.appendChild(usernameGroup);
    form.appendChild(fullNameGroup);
    form.appendChild(phoneGroup);
    form.appendChild(emailGroup);
    form.appendChild(passwordGroup);
    form.appendChild(confirmPasswordGroup);
    form.appendChild(passwordRequirements);
    form.appendChild(adminGroup);
    form.appendChild(buttonGroup);
    
    // Form submission
    form.addEventListener('submit', (e) => this.handleAddUserSubmit(e));
    
    cardBody.appendChild(form);
    formCard.appendChild(cardBody);
    
    return formCard;
  }
  
  renderEditUserForm() {
    const formCard = document.createElement('div');
    formCard.className = 'neo-card animated-item';
    formCard.style.marginBottom = '30px';
    
    // Add glow effect
    const cardGlow = document.createElement('div');
    cardGlow.className = 'card-glow';
    cardGlow.style.background = 'radial-gradient(circle at center, rgba(59, 130, 246, 0.3), transparent 70%)';
    formCard.appendChild(cardGlow);
    
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.style.display = 'flex';
    cardHeader.style.justifyContent = 'space-between';
    cardHeader.style.alignItems = 'center';
    
    const cardTitle = document.createElement('h2');
    cardTitle.textContent = `Edit User: ${this.editingUser.username}`;
    cardTitle.style.margin = '0';
    cardTitle.style.fontSize = '18px';
    cardTitle.style.fontWeight = '600';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.innerHTML = '&times;';
    
    closeButton.addEventListener('click', () => {
      this.showEditUserForm = false;
      this.editingUser = null;
      this.updateView();
    });
    
    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(closeButton);
    formCard.appendChild(cardHeader);
    
    const cardBody = document.createElement('div');
    cardBody.style.padding = '24px';
    
    const form = document.createElement('form');
    form.id = 'editUserForm';
    form.style.display = 'grid';
    form.style.gridTemplateColumns = this.mobileView ? '1fr' : 'repeat(2, 1fr)';
    form.style.gap = '20px';
    
    // Hidden ID field
    const idInput = document.createElement('input');
    idInput.type = 'hidden';
    idInput.name = 'id';
    idInput.value = this.editingUser.id;
    form.appendChild(idInput);
    
    // Username (disabled)
    const usernameGroup = this.createFormGroup('Username', 'username', 'text', '👤');
    const usernameInput = usernameGroup.querySelector('input');
    usernameInput.value = this.editingUser.username;
    usernameInput.disabled = true;
    usernameInput.style.backgroundColor = 'rgba(15, 23, 42, 0.7)';
    usernameInput.style.cursor = 'not-allowed';
    
    // Full Name
    const fullNameGroup = this.createFormGroup('Full Name', 'fullName', 'text', '📝');
    const fullNameInput = fullNameGroup.querySelector('input');
    fullNameInput.required = true;
    fullNameInput.value = this.editingUser.fullName;
    
    // Phone
    const phoneGroup = this.createFormGroup('Phone', 'phone', 'tel', '📱');
    const phoneInput = phoneGroup.querySelector('input');
    phoneInput.required = true;
    phoneInput.value = this.editingUser.phone;
    
    // Email
    const emailGroup = this.createFormGroup('Email', 'email', 'email', '✉️');
    const emailInput = emailGroup.querySelector('input');
    emailInput.value = this.editingUser.email || '';
    
    // Is Admin
    const adminGroup = document.createElement('div');
    adminGroup.className = 'form-group';
    adminGroup.style.gridColumn = this.mobileView ? '1' : '1 / 3';
    adminGroup.style.margin = '8px 0';
    adminGroup.style.backgroundColor = 'rgba(15, 23, 42, 0.3)';
    adminGroup.style.padding = '15px';
    adminGroup.style.borderRadius = '12px';
    
    const roleHeading = document.createElement('h4');
    roleHeading.textContent = 'User Role';
    roleHeading.style.margin = '0 0 10px 0';
    roleHeading.style.fontSize = '15px';
    roleHeading.style.fontWeight = '600';
    roleHeading.style.color = this.colors.white;
    
    const roleOptions = document.createElement('div');
    roleOptions.style.display = 'flex';
    roleOptions.style.gap = '20px';
    roleOptions.style.flexDirection = this.mobileView ? 'column' : 'row';
    
    // Regular User option
    const userOption = document.createElement('div');
    userOption.style.display = 'flex';
    userOption.style.alignItems = 'center';
    userOption.style.gap = '10px';
    userOption.style.flex = '1';
    userOption.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
    userOption.style.padding = '15px';
    userOption.style.borderRadius = '10px';
    userOption.style.cursor = 'pointer';
    userOption.style.border = '1px solid rgba(16, 185, 129, 0.2)';
    
    const userRadio = document.createElement('input');
    userRadio.type = 'radio';
    userRadio.id = 'roleUserEdit';
    userRadio.name = 'isAdmin';
    userRadio.value = 'false';
    userRadio.checked = !this.editingUser.isAdmin;
    userRadio.style.margin = '0';
    
    const userLabel = document.createElement('label');
    userLabel.htmlFor = 'roleUserEdit';
    userLabel.style.margin = '0';
    userLabel.style.cursor = 'pointer';
    userLabel.style.fontWeight = '500';
    userLabel.style.display = 'flex';
    userLabel.style.flexDirection = 'column';
    userLabel.style.gap = '5px';
    
    const userTitle = document.createElement('span');
    userTitle.innerHTML = '<span style="margin-right: 6px; font-size: 18px;">👤</span> Regular User';
    userTitle.style.fontSize = '14px';
    userTitle.style.fontWeight = '600';
    
    const userDesc = document.createElement('span');
    userDesc.textContent = 'Can view and manage their own data';
    userDesc.style.fontSize = '12px';
    userDesc.style.color = this.colors.grayLight;
    
    userLabel.appendChild(userTitle);
    userLabel.appendChild(userDesc);
    
    userOption.appendChild(userRadio);
    userOption.appendChild(userLabel);
    
    // Admin User option
    const adminOption = document.createElement('div');
    adminOption.style.display = 'flex';
    adminOption.style.alignItems = 'center';
    adminOption.style.gap = '10px';
    adminOption.style.flex = '1';
    adminOption.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
    adminOption.style.padding = '15px';
    adminOption.style.borderRadius = '10px';
    adminOption.style.cursor = 'pointer';
    adminOption.style.border = '1px solid rgba(251, 113, 133, 0.2)';
    
    const adminRadio = document.createElement('input');
    adminRadio.type = 'radio';
    adminRadio.id = 'roleAdminEdit';
    adminRadio.name = 'isAdmin';
    adminRadio.value = 'true';
    adminRadio.checked = this.editingUser.isAdmin;
    adminRadio.style.margin = '0';
    
    // Disable admin option if the user is not already an admin and we already have 5 admins
    if (!this.editingUser.isAdmin && this.adminCount >= 5) {
      adminRadio.disabled = true;
      adminOption.style.opacity = '0.5';
      adminOption.style.cursor = 'not-allowed';
    }
    
    const adminLabel = document.createElement('label');
    adminLabel.htmlFor = 'roleAdminEdit';
    adminLabel.style.margin = '0';
    adminLabel.style.cursor = (!this.editingUser.isAdmin && this.adminCount >= 5) ? 'not-allowed' : 'pointer';
    adminLabel.style.fontWeight = '500';
    adminLabel.style.display = 'flex';
    adminLabel.style.flexDirection = 'column';
    adminLabel.style.gap = '5px';
    
    const adminTitle = document.createElement('span');
    adminTitle.innerHTML = '<span style="margin-right: 6px; font-size: 18px;">👑</span> Administrator';
    adminTitle.style.fontSize = '14px';
    adminTitle.style.fontWeight = '600';
    
    const adminDesc = document.createElement('span');
    adminDesc.textContent = `Full access to system (${this.adminCount}/5 used)`;
    adminDesc.style.fontSize = '12px';
    adminDesc.style.color = this.colors.grayLight;
    
    adminLabel.appendChild(adminTitle);
    adminLabel.appendChild(adminDesc);
    
    adminOption.appendChild(adminRadio);
    adminOption.appendChild(adminLabel);
    
    roleOptions.appendChild(userOption);
    roleOptions.appendChild(adminOption);
    
    adminGroup.appendChild(roleHeading);
    adminGroup.appendChild(roleOptions);
    
    // Submit button
    const buttonGroup = document.createElement('div');
    buttonGroup.style.gridColumn = this.mobileView ? '1' : '1 / 3';
    buttonGroup.style.marginTop = '20px';
    buttonGroup.style.display = 'flex';
    buttonGroup.style.justifyContent = 'flex-end';
    buttonGroup.style.gap = '16px';
    buttonGroup.style.flexWrap = 'wrap';
    
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn-secondary';
    
    cancelButton.addEventListener('click', () => {
      this.showEditUserForm = false;
      this.editingUser = null;
      this.updateView();
    });
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'btn btn-primary';
    submitButton.innerHTML = '<span style="margin-right: 8px;">💾</span> Save Changes';
    
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(submitButton);
    
    // Append all elements to form
    form.appendChild(usernameGroup);
    form.appendChild(fullNameGroup);
    form.appendChild(phoneGroup);
    form.appendChild(emailGroup);
    form.appendChild(adminGroup);
    form.appendChild(buttonGroup);
    
    // Form submission
    form.addEventListener('submit', (e) => this.handleEditUserSubmit(e));
    
    cardBody.appendChild(form);
    formCard.appendChild(cardBody);
    
    return formCard;
  }
  
  renderPasswordResetForm() {
    const formCard = document.createElement('div');
    formCard.className = 'neo-card animated-item';
    formCard.style.marginBottom = '30px';
    
    // Add glow effect
    const cardGlow = document.createElement('div');
    cardGlow.className = 'card-glow';
    cardGlow.style.background = 'radial-gradient(circle at center, rgba(245, 158, 11, 0.3), transparent 70%)';
    formCard.appendChild(cardGlow);
    
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.style.display = 'flex';
    cardHeader.style.justifyContent = 'space-between';
    cardHeader.style.alignItems = 'center';
    
    const cardTitle = document.createElement('h2');
    cardTitle.textContent = 'Reset Password';
    cardTitle.style.margin = '0';
    cardTitle.style.fontSize = '18px';
    cardTitle.style.fontWeight = '600';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.innerHTML = '&times;';
    
    closeButton.addEventListener('click', () => {
      this.showPasswordResetForm = false;
      this.resettingPasswordUserId = null;
      this.updateView();
    });
    
    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(closeButton);
    formCard.appendChild(cardHeader);
    
    const cardBody = document.createElement('div');
    cardBody.style.padding = '24px';
    
    // Password security visual guide
    const passwordGuide = document.createElement('div');
    passwordGuide.className = 'neo-card';
    passwordGuide.style.marginBottom = '24px';
    passwordGuide.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
    passwordGuide.style.padding = '16px';
    
    const guideIcon = document.createElement('div');
    guideIcon.innerHTML = '🔒';
    guideIcon.style.fontSize = '24px';
    guideIcon.style.marginBottom = '12px';
    
    const guideTitle = document.createElement('h3');
    guideTitle.textContent = 'Admin Password Reset';
    guideTitle.style.fontSize = '16px';
    guideTitle.style.fontWeight = '600';
    guideTitle.style.margin = '0 0 12px 0';
    
    const guideText = document.createElement('p');
    guideText.style.fontSize = '14px';
    guideText.style.margin = '0 0 12px 0';
    guideText.style.lineHeight = '1.5';
    guideText.textContent = 'As an admin, you can reset this user\'s password directly. The new password must meet security requirements.';
    
    const guideRequirements = document.createElement('ul');
    guideRequirements.style.margin = '0';
    guideRequirements.style.paddingLeft = '20px';
    
    const req1 = document.createElement('li');
    req1.textContent = 'Minimum 8 characters';
    req1.style.marginBottom = '6px';
    
    const req2 = document.createElement('li');
    req2.textContent = 'At least 1 uppercase letter (A-Z)';
    req2.style.marginBottom = '6px';
    
    const req3 = document.createElement('li');
    req3.textContent = 'At least 1 number (0-9)';
    
    guideRequirements.appendChild(req1);
    guideRequirements.appendChild(req2);
    guideRequirements.appendChild(req3);
    
    passwordGuide.appendChild(guideIcon);
    passwordGuide.appendChild(guideTitle);
    passwordGuide.appendChild(guideText);
    passwordGuide.appendChild(guideRequirements);
    
    const form = document.createElement('form');
    form.id = 'resetPasswordForm';
    form.style.display = 'grid';
    form.style.gridTemplateColumns = this.mobileView ? '1fr' : 'repeat(2, 1fr)';
    form.style.gap = '20px';
    
    // Hidden user ID field
    const userIdInput = document.createElement('input');
    userIdInput.type = 'hidden';
    userIdInput.name = 'userId';
    userIdInput.value = this.resettingPasswordUserId;
    form.appendChild(userIdInput);
    
    // New Password
    const newPasswordGroup = this.createFormGroup('New Password', 'newPassword', 'password', '🔒');
    const newPasswordInput = newPasswordGroup.querySelector('input');
    newPasswordInput.required = true;
    newPasswordInput.placeholder = 'Enter new password';
    newPasswordInput.pattern = '(?=.*[A-Z])(?=.*[0-9]).{8,}';
    newPasswordInput.title = 'Password must be at least 8 characters with at least 1 uppercase letter and 1 number';
    
    // Confirm New Password
    const confirmPasswordGroup = this.createFormGroup('Confirm New Password', 'confirmNewPassword', 'password', '🔒');
    const confirmPasswordInput = confirmPasswordGroup.querySelector('input');
    confirmPasswordInput.required = true;
    confirmPasswordInput.placeholder = 'Confirm new password';
    
    // Submit button
    const buttonGroup = document.createElement('div');
    buttonGroup.style.gridColumn = this.mobileView ? '1' : '1 / 3';
    buttonGroup.style.marginTop = '20px';
    buttonGroup.style.display = 'flex';
    buttonGroup.style.justifyContent = 'flex-end';
    buttonGroup.style.gap = '16px';
    buttonGroup.style.flexWrap = 'wrap';
    
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn-secondary';
    
    cancelButton.addEventListener('click', () => {
      this.showPasswordResetForm = false;
      this.resettingPasswordUserId = null;
      this.updateView();
    });
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'btn btn-warning';
    submitButton.innerHTML = '<span style="margin-right: 8px;">🔄</span> Reset Password';
    
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(submitButton);
    
    // Append all elements to form
    form.appendChild(passwordGuide);
    form.appendChild(newPasswordGroup);
    form.appendChild(confirmPasswordGroup);
    form.appendChild(buttonGroup);
    
    // Form submission
    form.addEventListener('submit', (e) => this.handlePasswordResetSubmit(e));
    
    cardBody.appendChild(form);
    formCard.appendChild(cardBody);
    
    return formCard;
  }
  
  async fetchUsers() {
    // Check if we have cached data
    if (this.cache.users && Date.now() - this.cache.lastFetchTime < this.cache.cacheDuration) {
      this.users = this.cache.users;
      this.filteredUsers = [...this.users];
      
      // Count admins
      this.adminCount = this.users.filter(user => user.isAdmin).length;
      
      this.error = null;
      this.isLoading = false;
      await this.updateView();
      return;
    }
    
    try {
      // Use throttled API request
      const response = await this.queueApiRequest(() => {
        return this.apiService.getAllUsers();
      });
      
      // Handle response structure - check if it's { users: [...] } or directly [...]
      this.users = response.users || response || [];
      this.filteredUsers = [...this.users]; // Initialize filtered users with all users
      
      // Cache the data
      this.cache.users = this.users;
      this.cache.lastFetchTime = Date.now();
      
      // Count admins
      this.adminCount = this.users.filter(user => user.isAdmin).length;
      
      this.error = null;
      this.isLoading = false;
      await this.updateView();
    } catch (error) {
      console.error('Error fetching users:', error);
      this.error = error.message || 'Failed to load users. Please try again.';
      this.users = [];
      this.filteredUsers = [];
      this.isLoading = false;
      await this.updateView();
    }
  }
  
  async updateView() {
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = '';
      const content = await this.render();
      if (content) {
        appContainer.appendChild(content);
      }
    }
  }
  
  createFormGroup(label, name, type, icon = null) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = name;
    if (icon) {
      labelElement.innerHTML = `<span style="margin-right: 8px;">${icon}</span> ${label}`;
    } else {
      labelElement.textContent = label;
    }
    labelElement.className = 'form-label';
    
    const inputElement = document.createElement('input');
    inputElement.type = type;
    inputElement.id = name;
    inputElement.name = name;
    inputElement.className = 'form-control';
    
    formGroup.appendChild(labelElement);
    formGroup.appendChild(inputElement);
    
    return formGroup;
  }
  
  async handleAddUserSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Validate passwords match
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    
    if (password !== confirmPassword) {
      this.error = 'Passwords do not match';
      this.updateView();
      return;
    }
    
    // Validate password strength
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      this.error = 'Password must be at least 8 characters with at least 1 uppercase letter and 1 number';
      this.updateView();
      return;
    }
    
    // Get value from radio buttons
    const isAdmin = document.getElementById('roleAdmin')?.checked || false;
    
    // Check admin limit
    if (isAdmin && this.adminCount >= 5) {
      this.error = 'Maximum of 5 admins allowed';
      this.updateView();
      return;
    }
    
    const userData = {
      username: formData.get('username'),
      password: formData.get('password'),
      fullName: formData.get('fullName'),
      phone: formData.get('phone'),
      email: formData.get('email') || null,
      isAdmin: isAdmin
    };
    
    try {
      this.isLoading = true;
      this.updateView();
      
      // Use throttled API request to register user
      const response = await this.queueApiRequest(() => {
        return this.apiService.registerUser(userData);
      });
      
      if (response && (response.user || response.success)) {
        this.success = 'User created successfully';
        this.showAddUserForm = false;
        
        // Increment admin count if the new user is an admin
        if (userData.isAdmin) {
          this.adminCount++;
        }
        
        // Invalidate cache
        this.cache.users = null;
        
        // Refresh the users list
        await this.fetchUsers();
      } else {
        this.error = 'Failed to create user. Please try again.';
        this.isLoading = false;
        this.updateView();
      }
    } catch (error) {
      console.error('Error adding user:', error);
      this.error = error.message || 'Failed to create user. Please try again.';
      this.isLoading = false;
      this.updateView();
    }
  }
  
  async handleEditUserSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Get value from radio buttons
    const isAdmin = document.getElementById('roleAdminEdit')?.checked || false;
    
    // Check if admin status changed and admin limit
    const wasAdmin = this.editingUser.isAdmin;
    
    if (!wasAdmin && isAdmin && this.adminCount >= 5) {
      this.error = 'Maximum of 5 admins allowed';
      this.updateView();
      return;
    }
    
    const userData = {
      fullName: formData.get('fullName'),
      phone: formData.get('phone'),
      email: formData.get('email') || null,
      isAdmin: isAdmin
    };
    
    const userId = formData.get('id');
    
    try {
      this.isLoading = true;
      this.updateView();
      
      // Use throttled API request
      const response = await this.queueApiRequest(() => {
        return this.apiService.updateUser(userId, userData);
      });
      
      if (response && (response.success || response.user)) {
        this.success = 'User updated successfully';
        this.showEditUserForm = false;
        this.editingUser = null;
        
        // Update admin count if admin status changed
        if (wasAdmin && !isAdmin) {
          this.adminCount--;
        } else if (!wasAdmin && isAdmin) {
          this.adminCount++;
        }
        
        // Invalidate cache
        this.cache.users = null;
        
        // Refresh the users list
        await this.fetchUsers();
      } else {
        this.error = 'Failed to update user. Please try again.';
        this.isLoading = false;
        this.updateView();
      }
    } catch (error) {
      console.error('Error updating user:', error);
      this.error = error.message || 'Failed to update user. Please try again.';
      this.isLoading = false;
      this.updateView();
    }
  }
  
  async handlePasswordResetSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const userId = formData.get('userId');
    const newPassword = formData.get('newPassword');
    const confirmNewPassword = formData.get('confirmNewPassword');
    
    // Validate passwords match
    if (newPassword !== confirmNewPassword) {
      this.error = 'New passwords do not match';
      this.updateView();
      return;
    }
    
    // Validate password strength
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      this.error = 'Password must be at least 8 characters with at least 1 uppercase letter and 1 number';
      this.updateView();
      return;
    }
    
    try {
      this.isLoading = true;
      this.updateView();
      
      // Use the corrected admin reset password method (only needs newPassword)
      const response = await this.queueApiRequest(() => {
        return this.apiService.adminResetUserPassword(userId, newPassword);
      });
      
      if (response && (response.success || response.message)) {
        this.success = 'Password reset successfully';
        this.showPasswordResetForm = false;
        this.resettingPasswordUserId = null;
        this.updateView();
      } else {
        this.error = 'Failed to reset password. Please try again.';
        this.isLoading = false;
        this.updateView();
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      this.error = error.message || 'Failed to reset password. Please try again.';
      this.isLoading = false;
      this.updateView();
    }
  }
  
  async deleteUser(userId) {
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '500px';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h2');
    modalTitle.className = 'modal-title';
    modalTitle.textContent = 'Confirm Deletion';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.innerHTML = '&times;';
    
    closeButton.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    const warningIcon = document.createElement('div');
    warningIcon.innerHTML = '⚠️';
    warningIcon.style.fontSize = '48px';
    warningIcon.style.textAlign = 'center';
    warningIcon.style.marginBottom = '20px';
    
    const confirmMessage = document.createElement('p');
    confirmMessage.textContent = 'Are you sure you want to delete this user? This action cannot be undone.';
    confirmMessage.style.textAlign = 'center';
    confirmMessage.style.marginBottom = '24px';
    
    modalBody.appendChild(warningIcon);
    modalBody.appendChild(confirmMessage);
    
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn-secondary';
    
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    const confirmButton = document.createElement('button');
    confirmButton.innerHTML = '<span style="margin-right: 8px;">🗑️</span> Delete User';
    confirmButton.className = 'btn btn-danger';
    
    confirmButton.addEventListener('click', async () => {
      document.body.removeChild(modal);
      await this.confirmDeleteUser(userId);
    });
    
    modalFooter.appendChild(cancelButton);
    modalFooter.appendChild(confirmButton);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  }
  
  async confirmDeleteUser(userId) {
    try {
      this.isLoading = true;
      this.updateView();
      
      // Use throttled API request
      const response = await this.queueApiRequest(() => {
        return this.apiService.deleteUser(userId);
      });
      
      if (response && (response.success || response.message)) {
        this.success = response.message || 'User deleted successfully';
        
        // Invalidate cache
        this.cache.users = null;
        
        // Refresh the users list
        await this.fetchUsers();
      } else {
        this.error = 'Failed to delete user. Please try again.';
        this.isLoading = false;
        this.updateView();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      this.error = error.message || 'Failed to delete user. Please try again.';
      this.isLoading = false;
      this.updateView();
    }
  }
  
  // API Request Throttling
  queueApiRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        request: requestFunction,
        resolve,
        reject
      });
      
      if (!this.isProcessingQueue) {
        this.processRequestQueue();
      }
    });
  }

  processRequestQueue() {
    if (this.requestQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
    
    this.isProcessingQueue = true;
    const { request, resolve, reject } = this.requestQueue.shift();
    
    try {
      request()
        .then(result => resolve(result))
        .catch(error => reject(error))
        .finally(() => {
          setTimeout(() => {
            this.processRequestQueue();
          }, this.requestThrottleTime);
        });
    } catch (error) {
      reject(error);
      setTimeout(() => {
        this.processRequestQueue();
      }, this.requestThrottleTime);
    }
  }
  
  // Format payment type for better display
  formatPaymentType(type) {
    if (!type) return 'Unknown';
    
    if (type.startsWith('SPECIAL_')) {
      // Special offering types like SPECIAL_BUILDING, SPECIAL_MISSION
      return `Special: ${this.formatSpecialOfferingName(type)}`;
    }
    
    switch (type) {
      case 'TITHE':
        return 'Tithe';
      case 'OFFERING':
        return 'Offering';
      case 'DONATION':
        return 'Donation';
      case 'SPECIAL':
        return 'Special Offering';
      default:
        return type.charAt(0) + type.slice(1).toLowerCase();
    }
  }
  
  // Format special offering name for display
  formatSpecialOfferingName(type) {
    if (!type) return 'Unknown';

    if (!type.startsWith('SPECIAL_')) {
      return type;
    }

    const name = type.replace('SPECIAL_', '');

    // Handle common special offering types
    switch (name) {
      case 'BUILDING':
        return 'Building Fund';
      case 'MISSION':
        return 'Mission Trip';
      case 'CHARITY':
        return 'Charity Drive';
      case 'YOUTH':
        return 'Youth Program';
      case 'EDUCATION':
        return 'Education Fund';
      case 'EQUIPMENT':
        return 'Equipment Purchase';
      case 'COMMUNITY':
        return 'Community Outreach';
      case 'DEVELOPMENT':
        return 'Development Program';
      case 'OTHER':
        return 'Special Offering';
      default:
        // Convert SNAKE_CASE to Title Case
        return name.split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
    }
  }
  
  // Format receipt number for clean display
  formatReceiptNumber(receiptNumber) {
    if (!receiptNumber) return null;
    
    // Clean up any random characters in receipt numbers
    // If it's a complex string, extract only alphanumeric parts
    if (receiptNumber.length > 20 || /[^\w\-]/.test(receiptNumber)) {
      // Extract alphanumeric characters or create a short version
      const cleanedNumber = receiptNumber.replace(/[^\w]/g, '');
      return cleanedNumber.substr(0, 8).toUpperCase();
    }
    
    return receiptNumber.toUpperCase();
  }
}