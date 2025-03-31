// src/components/Layout.js
export class Layout {
  constructor(title = 'TASSIAC') {
    this.title = title;
    this.authService = window.authService;
  }
  
  render(content) {
    // Set document title
    document.title = `${this.title} - TASSIAC Church`;
    
    // Create layout container
    const layout = document.createElement('div');
    
    try {
      // Add base styles directly to the layout
      layout.innerHTML = `
        <style>
          /* Base styles for layout */
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #e8ecfd 0%, #f5e5ff 100%);
            margin: 0;
            min-height: 100vh;
            color: #333;
          }
          
          .layout {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
          
          .header {
            background: white;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 15px 20px;
          }
          
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 1200px;
            margin: 0 auto;
          }
          
          .header-logo {
            font-size: 24px;
            font-weight: bold;
            color: #4a6da7;
            text-decoration: none;
            background: linear-gradient(135deg, #4a6da7 0%, #6b8cc9 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }
          
          .nav-menu {
            display: flex;
            gap: 20px;
          }
          
          .nav-link {
            color: #555;
            text-decoration: none;
            font-weight: 500;
            padding: 5px 0;
            position: relative;
          }
          
          .nav-link:after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 0;
            height: 2px;
            background: linear-gradient(135deg, #4a6da7 0%, #6b8cc9 100%);
            transition: width 0.3s ease;
          }
          
          .nav-link:hover:after, .nav-link.active:after {
            width: 100%;
          }
          
          .nav-link:hover, .nav-link.active {
            color: #4a6da7;
          }
          
          .auth-buttons {
            display: flex;
            gap: 10px;
          }
          
          .sign-in-btn {
            background: linear-gradient(135deg, #4a6da7 0%, #6b8cc9 100%);
            color: white;
            padding: 8px 15px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.3s ease;
          }
          
          .sign-in-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          
          .main-content {
            flex-grow: 1;
          }
          
          .footer {
            background: white;
            border-top: 1px solid #eee;
            padding: 20px;
            margin-top: auto;
          }
          
          .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 1200px;
            margin: 0 auto;
            flex-wrap: wrap;
            gap: 20px;
          }
          
          .footer-copyright {
            color: #666;
          }
          
          .footer-links {
            display: flex;
            gap: 20px;
          }
          
          .footer-link {
            color: #555;
            text-decoration: none;
          }
          
          .footer-link:hover {
            color: #4a6da7;
          }
          
          @media (max-width: 768px) {
            .nav-menu {
              display: none;
            }
            
            .footer-content {
              flex-direction: column;
              align-items: flex-start;
            }
          }
        </style>
        
        <div class="layout">
          <header class="header">
            <div class="header-container">
              <a href="/" class="header-logo" data-link>TASSIAC</a>
              
              ${this.renderNavLinks()}
              
              <div class="auth-buttons">
                ${this.renderAuthButtons()}
              </div>
            </div>
          </header>
          
          <main class="main-content">
            <div id="page-content"></div>
          </main>
          
          <footer class="footer">
            <div class="footer-content">
              <div class="footer-copyright">
                &copy; ${new Date().getFullYear()} TASSIAC Church. All rights reserved.
              </div>
              
              <div class="footer-links">
                <a href="/about" class="footer-link" data-link>About</a>
                <a href="/contact" class="footer-link" data-link>Contact</a>
                <a href="/help" class="footer-link" data-link>Help</a>
              </div>
            </div>
          </footer>
        </div>
      `;
      
      // Add content to main
      const pageContent = layout.querySelector('#page-content');
      if (pageContent) {
        if (typeof content === 'string') {
          pageContent.innerHTML = content;
        } else if (content instanceof HTMLElement) {
          pageContent.appendChild(content);
        } else {
          console.error('Invalid content provided to Layout.render():', content);
          pageContent.innerHTML = '<div style="color: red; padding: 20px;">Error: Invalid content provided.</div>';
        }
      }
      
      // Add active class to current nav link
      setTimeout(() => {
        const currentPath = window.location.pathname;
        const navLinks = layout.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
          const linkPath = link.getAttribute('href');
          if (linkPath === currentPath || 
              (linkPath !== '/' && currentPath.startsWith(linkPath))) {
            link.classList.add('active');
          }
        });
      }, 0);
      
      return layout;
    } catch (error) {
      console.error('Error rendering layout:', error);
      
      // Return error layout
      layout.innerHTML = `
        <div style="padding: 20px; color: red; text-align: center;">
          <h1>Error rendering layout</h1>
          <p>${error.message}</p>
          <a href="/" style="color: blue; text-decoration: underline;">Go back home</a>
        </div>
      `;
      
      return layout;
    }
  }
  
  renderNavLinks() {
    const isAuthenticated = this.authService && this.authService.isAuthenticated();
    const isAdmin = this.authService && this.authService.isAdmin();
    
    if (!isAuthenticated) {
      return `
        <nav class="nav-menu">
          <a href="/" class="nav-link" data-link>Home</a>
          <a href="/about" class="nav-link" data-link>About</a>
          <a href="/contact" class="nav-link" data-link>Contact</a>
        </nav>
      `;
    }
    
    if (isAdmin) {
      return `
        <nav class="nav-menu">
          <a href="/admin/dashboard" class="nav-link" data-link>Dashboard</a>
          <a href="/admin/users" class="nav-link" data-link>Users</a>
          <a href="/admin/payments" class="nav-link" data-link>Payments</a>
          <a href="/admin/expenses" class="nav-link" data-link>Expenses</a>
          <a href="/admin/add-payment" class="nav-link" data-link>Add Payment</a>
        </nav>
      `;
    }
    
    return `
      <nav class="nav-menu">
        <a href="/dashboard" class="nav-link" data-link>Dashboard</a>
        <a href="/payments" class="nav-link" data-link>My Payments</a>
        <a href="/receipts" class="nav-link" data-link>Receipts</a>
        <a href="/make-payment" class="nav-link" data-link>Make Payment</a>
      </nav>
    `;
  }
  
  renderAuthButtons() {
    const isAuthenticated = this.authService && this.authService.isAuthenticated();
    
    if (!isAuthenticated) {
      return `<a href="/login" class="sign-in-btn" data-link>Sign In</a>`;
    }
    
    const user = this.authService.getUser();
    const userName = user ? user.fullName || user.username : 'User';
    
    return `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-weight: 500; color: #555;">${userName}</span>
        <a href="/logout" class="sign-in-btn" data-link style="background: #f44336;">Sign Out</a>
      </div>
    `;
  }
}