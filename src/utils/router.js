// src/utils/router.js
export class Router {
  constructor(authService) {
    this.routes = [];
    this.notFoundHandler = null;
    this.authService = authService;
    this.currentPath = null;
    
    // Add event listener for navigation
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-link]');
      if (target) {
        e.preventDefault();
        this.navigateTo(target.href);
      }
    });
    
    // Add popstate event listener for browser history
    window.addEventListener('popstate', () => {
      this.handleRoute();
    });
  }
  
  // Add a route
  add(path, moduleUrl, className, requiresAuth = false, requiresAdmin = false) {
    this.routes.push({
      path,
      moduleUrl,
      className,
      requiresAuth,
      requiresAdmin
    });
    return this; // Allow chaining
  }
  
  // Add 404 handler
  add404(moduleUrl, className) {
    this.notFoundHandler = {
      moduleUrl,
      className
    };
    return this; // Allow chaining
  }
  
  // Initialize the router
  init() {
    // Initial route handling
    this.handleRoute();
  }
  
  // Navigate to a URL
  navigateTo(url) {
    console.log('🚀 Router navigating to:', url);
    
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    
    // Don't navigate if we're already on this path
    if (this.currentPath === path) {
      console.log('📍 Already on path:', path);
      return;
    }
    
    // Update history and handle the route
    history.pushState(null, null, url);
    this.handleRoute();
  }
  
  // Redirect without adding to history
  redirectTo(url) {
    console.log('🔄 Router redirecting to:', url);
    
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    
    history.replaceState(null, null, url);
    this.handleRoute();
  }
  
  // Wait for auth services to be ready
  async waitForAuthServices() {
    let attempts = 0;
    const maxAttempts = 20; // Wait up to 1 second
    
    while (attempts < maxAttempts) {
      if (window.apiService && window.authService) {
        // Also check if they have their methods
        if (typeof window.apiService.isAuthenticated === 'function' && 
            typeof window.authService.isAuthenticated === 'function') {
          console.log('✅ Auth services are ready');
          return true;
        }
      }
      
      console.log(`⏳ Waiting for auth services... (${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }
    
    console.warn('⚠️ Auth services not fully ready after waiting');
    return false;
  }
  
  // Enhanced authentication check
  isAuthenticated() {
    try {
      // Check both services for authentication
      const apiAuth = window.apiService && window.apiService.isAuthenticated();
      const authServiceAuth = window.authService && window.authService.isAuthenticated();
      
      const isAuth = apiAuth || authServiceAuth;
      console.log('🔍 Authentication check:', { apiAuth, authServiceAuth, final: isAuth });
      
      return isAuth;
    } catch (error) {
      console.error('❌ Error checking authentication:', error);
      return false;
    }
  }
  
  // Enhanced admin check
  isAdmin() {
    try {
      let isAdminResult = false;
      
      // Check apiService first
      if (window.apiService && window.apiService.isAuthenticated()) {
        const user = window.apiService.getCurrentUser();
        if (user) {
          isAdminResult = this.checkUserIsAdmin(user);
          console.log('🔍 Admin check via apiService:', isAdminResult, 'for user:', user);
        }
      }
      
      // Check authService if apiService didn't confirm admin
      if (!isAdminResult && window.authService && window.authService.isAuthenticated()) {
        const user = window.authService.getCurrentUser();
        if (user) {
          isAdminResult = this.checkUserIsAdmin(user);
          console.log('🔍 Admin check via authService:', isAdminResult, 'for user:', user);
        }
      }
      
      console.log('🎯 Final admin determination:', isAdminResult);
      return isAdminResult;
    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      return false;
    }
  }
  
  // Robust admin checking function
  checkUserIsAdmin(user) {
    if (!user) return false;
    
    // Multiple ways to check admin status
    const adminChecks = [
      user.isAdmin === true,
      user.isAdmin === 'true',
      user.isAdmin === 1,
      user.isAdmin === '1',
      String(user.isAdmin).toLowerCase() === 'true',
      user.role && String(user.role).toLowerCase().includes('admin')
    ];
    
    return adminChecks.some(check => check === true);
  }
  
  // Main route handling with enhanced auth timing
  async handleRoute() {
    const path = window.location.pathname;
    this.currentPath = path;
    
    console.log('🛣️ Router handling route:', path);
    
    // Wait for auth services to be ready
    await this.waitForAuthServices();
    
    // Check for login navigation context
    const loginNav = window._loginNavigation;
    if (loginNav && (Date.now() - loginNav.timestamp) < 10000) { // 10 second window
      console.log('🔐 Post-login navigation detected:', loginNav);
      
      // Use login context to ensure correct routing
      if (loginNav.isAdmin && path === '/admin/dashboard') {
        console.log('✅ Loading admin dashboard for post-login admin user');
      } else if (!loginNav.isAdmin && path === '/dashboard') {
        console.log('✅ Loading user dashboard for post-login regular user');
      } else {
        console.log('🔄 Correcting route based on login data...');
        const correctPath = loginNav.isAdmin ? '/admin/dashboard' : '/dashboard';
        
        // Clear the login navigation flag first
        delete window._loginNavigation;
        
        // Redirect to correct path
        this.redirectTo(correctPath);
        return;
      }
      
      // Clear the login navigation flag after successful routing
      delete window._loginNavigation;
    }
    
    try {
      const route = this.findMatchingRoute(path);
      document.title = `TASSIAC - ${this.getPageTitle(route.path)}`;
      
      // Enhanced auth checking with timing
      if (route.requiresAuth) {
        console.log('🔒 Route requires authentication, checking...');
        
        // Wait a bit more for auth state to be fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!this.isAuthenticated()) {
          console.log('❌ Authentication required, redirecting to login');
          this.redirectTo('/login');
          return;
        }
        
        if (route.requiresAdmin) {
          console.log('👑 Route requires admin privileges, checking...');
          
          // Additional wait for admin check
          await new Promise(resolve => setTimeout(resolve, 50));
          
          if (!this.isAdmin()) {
            console.log('❌ Admin access required but user is not admin, redirecting');
            this.redirectTo('/dashboard');
            return;
          }
          
          console.log('✅ Admin access confirmed');
        }
        
        console.log('✅ Authentication confirmed');
      }
      
      // Handle dashboard route conflicts
      if (path === '/dashboard') {
        console.log('👤 User dashboard route detected, checking if user should be admin...');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (this.isAuthenticated() && this.isAdmin()) {
          console.log('👑 Authenticated admin accessing user dashboard, redirecting to admin dashboard');
          this.redirectTo('/admin/dashboard');
          return;
        }
      }
      
      if (route.moduleUrl && route.className) {
        const appContainer = document.getElementById('app');
        if (!appContainer) {
          console.error('App container not found');
          return;
        }
        
        this.showLoading(appContainer);
        
        try {
          // Clean up the module path properly
          let modulePath = route.moduleUrl.startsWith('/') 
            ? route.moduleUrl.slice(1) 
            : route.moduleUrl;
          
          // Remove 'views/' prefix if it exists (to avoid duplication)
          if (modulePath.startsWith('views/')) {
            modulePath = modulePath.slice(6); // Remove 'views/' (6 characters)
          }
          
          // Construct the import path
          const importPath = `../views/${modulePath}`;
          
          console.log('📦 Loading module:', importPath);
          
          const modulePromise = import(/* @vite-ignore */ importPath);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Module loading timed out')), 10000)
          );
          
          // Wait for module to load or timeout
          const viewModule = await Promise.race([modulePromise, timeoutPromise]);
          
          // Check if the module exports the expected class
          if (viewModule && viewModule[route.className]) {
            const ViewClass = viewModule[route.className];
            const view = new ViewClass();
            
            // Clear the app container
            appContainer.innerHTML = '';
            
            try {
              console.log('🎭 Rendering view for:', route.path);
              
              // Pass authentication context to view if it's a dashboard
              if (path.includes('dashboard')) {
                view._authContext = {
                  isAuthenticated: this.isAuthenticated(),
                  isAdmin: this.isAdmin(),
                  user: this.getCurrentUser()
                };
              }
              
              // Render the view
              const renderedComponent = await Promise.resolve(view.render());
              
              if (renderedComponent instanceof Node) {
                appContainer.appendChild(renderedComponent);
                
                console.log('✅ View rendered successfully for:', route.path);
                
                // Execute any post-render scripts if available
                if (typeof view.afterRender === 'function') {
                  setTimeout(() => view.afterRender(), 0);
                }
              } else {
                console.error('Component render method did not return a valid DOM node');
                this.renderErrorMessage(appContainer, 'Component returned invalid content');
              }
            } catch (renderError) {
              console.error('❌ Error rendering view:', renderError);
              this.renderErrorMessage(appContainer, `Error rendering view: ${renderError.message}`);
            }
          } else {
            console.error(`Module ${route.moduleUrl} does not export ${route.className}`);
            this.renderErrorMessage(appContainer, `Component class '${route.className}' not found`);
          }
        } catch (loadError) {
          console.error(`❌ Error loading module ${route.moduleUrl}:`, loadError);
          this.renderErrorMessage(appContainer, `Error loading module: ${loadError.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Route handling error:', error);
      const appContainer = document.getElementById('app');
      if (appContainer) {
        this.renderErrorMessage(appContainer, `Routing error: ${error.message}`);
      }
    }
  }
  
  // Get current user from available auth services
  getCurrentUser() {
    if (window.apiService && window.apiService.isAuthenticated()) {
      return window.apiService.getCurrentUser();
    }
    if (window.authService && window.authService.isAuthenticated()) {
      return window.authService.getCurrentUser();
    }
    return null;
  }
  
  // Find the matching route for a path
  findMatchingRoute(path) {
    // Find a matching route
    const matchedRoute = this.routes.find(route => route.path === path);
    
    // If no matching route, use 404 handler
    if (!matchedRoute) {
      if (!this.notFoundHandler) {
        throw new Error('No matching route found and no 404 handler defined');
      }
      
      return {
        path,
        moduleUrl: this.notFoundHandler.moduleUrl,
        className: this.notFoundHandler.className,
        requiresAuth: false,
        requiresAdmin: false
      };
    }
    
    return matchedRoute;
  }
  
  // Add refresh method
  refresh() {
    console.log('🔄 Router refresh triggered');
    this.handleRoute();
  }
  
  // Add clear state method
  clearState() {
    console.log('🧹 Clearing router state');
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = '';
    }
  }
  
  // Get a page title based on the path
  getPageTitle(path) {
    const pathSegments = path.split('/').filter(Boolean);
    
    if (pathSegments.length === 0) return 'Home';
    
    // Convert path to title case
    const lastSegment = pathSegments[pathSegments.length - 1];
    return lastSegment
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  
  // Show loading indicator
  showLoading(container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 300px;">
        <div style="text-align: center;">
          <div style="border: 4px solid rgba(0, 0, 0, 0.1); border-left-color: #4A6DA7; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
          <p style="margin-top: 16px; color: #4A6DA7; font-weight: 500;">Loading...</p>
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
  }
  
  // Render error message
  renderErrorMessage(container, message) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; margin: 20px auto; max-width: 600px; background-color: #fff3f3; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);">
        <div style="font-size: 40px; margin-bottom: 16px;">⚠️</div>
        <h2 style="font-size: 20px; margin-bottom: 12px; color: #d32f2f;">Something went wrong</h2>
        <p style="margin-bottom: 24px; text-align: center;">${message}</p>
        <button onclick="window.location.reload()" style="padding: 8px 16px; background-color: #4A6DA7; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer;">Refresh Page</button>
      </div>
    `;
  }
}