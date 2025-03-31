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
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    
    // Don't navigate if we're already on this path
    if (this.currentPath === path) return;
    
    // Update history and handle the route
    history.pushState(null, null, url);
    this.handleRoute();
  }
  
  // Redirect without adding to history
  redirectTo(url) {
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    
    history.replaceState(null, null, url);
    this.handleRoute();
  }
  
  // Main route handling
  async handleRoute() {
    const path = window.location.pathname;
    this.currentPath = path;
    
    try {
      // Find the matching route
      const route = this.findMatchingRoute(path);
      document.title = `TASSIAC - ${this.getPageTitle(route.path)}`;
      
      // Check if route requires authentication
      if (route.requiresAuth) {
        if (!this.authService || !this.authService.isAuthenticated()) {
          console.log('Authentication required, redirecting to login');
          this.redirectTo('/login');
          return;
        }
        
        // Check if route requires admin access
        if (route.requiresAdmin && !this.authService.isAdmin()) {
          console.log('Admin access required, redirecting to dashboard');
          this.redirectTo(this.authService.isAdmin() ? '/admin/dashboard' : '/dashboard');
          return;
        }
      }
      
      // Load the view module
      if (route.moduleUrl && route.className) {
        const appContainer = document.getElementById('app');
        if (!appContainer) {
          console.error('App container not found');
          return;
        }
        
        // Show a loading indicator
        this.showLoading(appContainer);
        
        try {
          // Dynamic import with a timeout to ensure we don't wait forever
          const modulePromise = import(/* @vite-ignore */ `../${route.moduleUrl}`);
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
              // Render the view
              const renderedComponent = await Promise.resolve(view.render());
              
              if (renderedComponent instanceof Node) {
                appContainer.appendChild(renderedComponent);
                
                // Execute any post-render scripts if available
                if (typeof view.afterRender === 'function') {
                  setTimeout(() => view.afterRender(), 0);
                }
              } else {
                console.error('Component render method did not return a valid DOM node');
                this.renderErrorMessage(appContainer, 'Component returned invalid content');
              }
            } catch (renderError) {
              console.error('Error rendering view:', renderError);
              this.renderErrorMessage(appContainer, `Error rendering view: ${renderError.message}`);
            }
          } else {
            console.error(`Module ${route.moduleUrl} does not export ${route.className}`);
            this.renderErrorMessage(appContainer, `Component class '${route.className}' not found`);
          }
        } catch (loadError) {
          console.error(`Error loading module ${route.moduleUrl}:`, loadError);
          this.renderErrorMessage(appContainer, `Error loading module: ${loadError.message}`);
        }
      }
    } catch (error) {
      console.error('Route handling error:', error);
      const appContainer = document.getElementById('app');
      if (appContainer) {
        this.renderErrorMessage(appContainer, `Routing error: ${error.message}`);
      }
    }
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