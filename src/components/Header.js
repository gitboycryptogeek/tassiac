// src/components/Header.js
export class Header {
  constructor(authService) {
    this.authService = authService;
    this.user = this.authService ? this.authService.getUser() : null;
    this.mobileMenuOpen = false;
  }
  
  render() {
    const header = document.createElement('header');
    
    try {
      const isAuthenticated = this.authService && this.authService.isAuthenticated();
      const isAdmin = this.authService && this.authService.isAdmin();
      
      // Set header content with proper classes from main.css
      header.innerHTML = `
        <div class="container header-container">
          <div class="flex items-center">
            <a href="/" data-link class="header-logo">
              TASSIAC
            </a>
            
            <button type="button" class="mobile-menu-button ml-4" id="mobile-menu-button" aria-label="Menu">
              <span class="mobile-menu-icon"></span>
            </button>
            
            ${isAuthenticated ? this.renderNavLinks(isAdmin) : ''}
          </div>
          
          <div>
            ${isAuthenticated ? this.renderUserMenu() : this.renderAuthLinks()}
          </div>
        </div>
      `;
      
      // Add event listeners after the header is rendered
      setTimeout(() => {
        // Mobile menu toggle
        const mobileMenuButton = header.querySelector('#mobile-menu-button');
        const mobileMenu = header.querySelector('.header-nav');
        
        if (mobileMenuButton && mobileMenu) {
          mobileMenuButton.addEventListener('click', () => {
            this.mobileMenuOpen = !this.mobileMenuOpen;
            mobileMenu.classList.toggle('open', this.mobileMenuOpen);
            mobileMenuButton.classList.toggle('mobile-menu-active', this.mobileMenuOpen);
          });
        }
        
        // User dropdown toggle
        if (isAuthenticated) {
          const userMenuButton = header.querySelector('.avatar');
          const userMenu = header.querySelector('#user-dropdown');
          
          if (userMenuButton && userMenu) {
            userMenuButton.addEventListener('click', (e) => {
              e.stopPropagation();
              userMenu.classList.toggle('visible');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
              userMenu.classList.remove('visible');
            });
            
            // Prevent closing when clicking inside dropdown
            userMenu.addEventListener('click', (e) => {
              e.stopPropagation();
            });
          }
        }
        
        // Highlight active nav link
        const currentPath = window.location.pathname;
        const navLinks = header.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
          const linkPath = link.getAttribute('href');
          if (linkPath === currentPath || 
              (linkPath !== '/' && currentPath.startsWith(linkPath))) {
            link.classList.add('active');
          }
        });
      }, 0);
      
      return header;
    } catch (error) {
      console.error('Error rendering header:', error);
      
      // Return simple header with error info
      header.innerHTML = `
        <div class="container">
          <div class="flex justify-between py-4">
            <a href="/" data-link class="header-logo">TASSIAC Church</a>
            <div class="text-error">Error: ${error.message}</div>
          </div>
        </div>
      `;
      
      return header;
    }
  }
  
  renderNavLinks(isAdmin) {
    if (isAdmin) {
      return `
        <nav class="header-nav">
          <a href="/admin/dashboard" data-link class="nav-link">Dashboard</a>
          <a href="/admin/users" data-link class="nav-link">Users</a>
          <a href="/admin/payments" data-link class="nav-link">Payments</a>
          <a href="/admin/expenses" data-link class="nav-link">Expenses</a>
          <a href="/admin/add-payment" data-link class="nav-link">Add Payment</a>
        </nav>
      `;
    } else {
      return `
        <nav class="header-nav">
          <a href="/dashboard" data-link class="nav-link">Dashboard</a>
          <a href="/payments" data-link class="nav-link">My Payments</a>
          <a href="/receipts" data-link class="nav-link">Receipts</a>
          <a href="/make-payment" data-link class="nav-link">Make Payment</a>
        </nav>
      `;
    }
  }
  
  renderUserMenu() {
    const userInitial = this.user && this.user.fullName ? this.user.fullName.charAt(0).toUpperCase() : 'U';
    
    return `
      <div class="user-menu">
        <button type="button" class="avatar" aria-label="User menu">
          ${userInitial}
        </button>
        
        <div class="dropdown-menu" id="user-dropdown">
          <div class="dropdown-header">
            <div class="font-medium">${this.user.fullName}</div>
            <div class="text-light">${this.user.username}</div>
          </div>
          <a href="/profile" data-link class="dropdown-item">Your Profile</a>
          <a href="/logout" data-link class="dropdown-item">Sign out</a>
        </div>
      </div>
    `;
  }
  
  renderAuthLinks() {
    return `
      <a href="/login" data-link class="btn btn-primary">
        Sign in
      </a>
    `;
  }
}