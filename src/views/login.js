// src/views/login.js
import { BaseComponent } from '../utils/BaseComponent.js';
import { FuturisticStyles } from '../utils/futuristicStyles.js';

export class LoginView extends BaseComponent {
  constructor() {
    super();
    this.authService = window.authService;
    this.apiService = window.apiService;
    this.router = window.router;
    
    // Initialize state
    this.isLoading = false;
    this.error = null;
    this.username = '';
    this.password = '';
    this.rememberMe = false;
  }
  
  async render() {
    // Apply futuristic styles
    FuturisticStyles.addGlobalStyles();
    FuturisticStyles.addBackgroundEffects();
    
    // If already authenticated, redirect to appropriate dashboard
    if (this.authService.isAuthenticated()) {
      this.redirectBasedOnRole();
      return null;
    }
    
    // Create container for login form
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.minHeight = 'calc(100vh - 80px)';
    container.style.padding = '40px 20px';
    container.style.position = 'relative';
    container.style.zIndex = '1';
    
    // Create the login card
    const formCard = document.createElement('div');
    formCard.className = 'neo-card animated-item';
    formCard.style.width = '100%';
    formCard.style.maxWidth = '450px';
    formCard.style.padding = '0';
    formCard.style.position = 'relative';
    formCard.style.overflow = 'hidden';
    
    // Add glow effect for the card
    const cardGlow = document.createElement('div');
    cardGlow.className = 'card-glow';
    cardGlow.style.background = 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.3), transparent 70%)';
    formCard.appendChild(cardGlow);
    
    // Create the header section
    const headerSection = document.createElement('div');
    headerSection.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(8, 145, 178, 0.3))';
    headerSection.style.padding = '30px';
    headerSection.style.textAlign = 'center';
    headerSection.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    headerSection.style.position = 'relative';
    
    // Add floating particles to header
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = `${Math.random() * 6 + 2}px`;
      particle.style.height = `${Math.random() * 6 + 2}px`;
      particle.style.borderRadius = '50%';
      particle.style.background = 'rgba(255, 255, 255, 0.3)';
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animation = `float ${Math.random() * 4 + 3}s ease-in-out infinite`;
      particle.style.animationDelay = `${Math.random() * 2}s`;
      particle.style.opacity = Math.random() * 0.5 + 0.2;
      particle.style.zIndex = '1';
      headerSection.appendChild(particle);
    }
    
    // "Login" title with gradient text
    const formTitle = document.createElement('h1');
    formTitle.className = 'text-gradient';
    formTitle.textContent = 'Sign In';
    formTitle.style.fontSize = '36px';
    formTitle.style.fontWeight = '800';
    formTitle.style.marginBottom = '12px';
    formTitle.style.position = 'relative';
    formTitle.style.zIndex = '2';
    
    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Access your account';
    subtitle.style.color = '#e2e8f0';
    subtitle.style.fontSize = '16px';
    subtitle.style.marginBottom = '0';
    subtitle.style.opacity = '0.9';
    subtitle.style.position = 'relative';
    subtitle.style.zIndex = '2';
    
    headerSection.appendChild(formTitle);
    headerSection.appendChild(subtitle);
    
    // Create the form body
    const formBody = document.createElement('div');
    formBody.style.padding = '40px 30px';
    
    // Create login form
    const form = document.createElement('form');
    form.id = 'login-form';
    form.addEventListener('submit', this.handleSubmit.bind(this));
    
    // Error message area
    const errorContainer = document.createElement('div');
    errorContainer.id = 'error-container';
    errorContainer.style.color = '#f87171';
    errorContainer.style.padding = '12px 16px';
    errorContainer.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    errorContainer.style.borderRadius = '12px';
    errorContainer.style.marginBottom = '24px';
    errorContainer.style.display = this.error ? 'flex' : 'none';
    errorContainer.style.fontSize = '14px';
    errorContainer.style.alignItems = 'center';
    errorContainer.style.gap = '10px';
    
    // Error icon
    const errorIcon = document.createElement('span');
    errorIcon.textContent = '⚠️';
    errorIcon.style.fontSize = '16px';
    
    const errorText = document.createElement('span');
    errorText.id = 'error-text';
    if (this.error) {
      errorText.textContent = this.error;
    }
    
    errorContainer.appendChild(errorIcon);
    errorContainer.appendChild(errorText);
    
    // Username field
    const usernameGroup = document.createElement('div');
    usernameGroup.style.marginBottom = '24px';
    
    const usernameLabel = document.createElement('label');
    usernameLabel.className = 'futuristic-label';
    usernameLabel.setAttribute('for', 'username');
    usernameLabel.textContent = 'Username';
    
    const usernameInput = document.createElement('input');
    usernameInput.className = 'futuristic-input';
    usernameInput.type = 'text';
    usernameInput.id = 'username';
    usernameInput.name = 'username';
    usernameInput.required = true;
    usernameInput.placeholder = 'Enter your username';
    usernameInput.value = this.username;
    usernameInput.addEventListener('input', (e) => {
      this.username = e.target.value;
    });
    
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameInput);
    
    // Password field
    const passwordGroup = document.createElement('div');
    passwordGroup.style.marginBottom = '24px';
    
    const passwordLabel = document.createElement('label');
    passwordLabel.className = 'futuristic-label';
    passwordLabel.setAttribute('for', 'password');
    passwordLabel.textContent = 'Password';
    
    const passwordInput = document.createElement('input');
    passwordInput.className = 'futuristic-input';
    passwordInput.type = 'password';
    passwordInput.id = 'password';
    passwordInput.name = 'password';
    passwordInput.required = true;
    passwordInput.placeholder = 'Enter your password';
    passwordInput.value = this.password;
    passwordInput.addEventListener('input', (e) => {
      this.password = e.target.value;
    });
    
    passwordGroup.appendChild(passwordLabel);
    passwordGroup.appendChild(passwordInput);
    
    // Remember me checkbox
    const rememberGroup = document.createElement('div');
    rememberGroup.style.marginBottom = '30px';
    rememberGroup.style.display = 'flex';
    rememberGroup.style.alignItems = 'center';
    
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.position = 'relative';
    checkboxContainer.style.marginRight = '10px';
    
    const rememberInput = document.createElement('input');
    rememberInput.type = 'checkbox';
    rememberInput.id = 'remember-me';
    rememberInput.name = 'remember-me';
    rememberInput.style.position = 'absolute';
    rememberInput.style.opacity = '0';
    rememberInput.style.width = '0';
    rememberInput.style.height = '0';
    rememberInput.checked = this.rememberMe;
    rememberInput.addEventListener('change', (e) => {
      this.rememberMe = e.target.checked;
      customCheckbox.style.backgroundColor = this.rememberMe ? 'rgba(6, 182, 212, 0.2)' : 'transparent';
      customCheckbox.style.borderColor = this.rememberMe ? 'rgba(6, 182, 212, 0.8)' : 'rgba(148, 163, 184, 0.3)';
      checkmark.style.opacity = this.rememberMe ? '1' : '0';
    });
    
    // Custom styled checkbox
    const customCheckbox = document.createElement('div');
    customCheckbox.style.width = '20px';
    customCheckbox.style.height = '20px';
    customCheckbox.style.border = '2px solid rgba(148, 163, 184, 0.3)';
    customCheckbox.style.borderRadius = '6px';
    customCheckbox.style.backgroundColor = this.rememberMe ? 'rgba(6, 182, 212, 0.2)' : 'transparent';
    customCheckbox.style.display = 'flex';
    customCheckbox.style.alignItems = 'center';
    customCheckbox.style.justifyContent = 'center';
    customCheckbox.style.transition = 'all 0.2s ease';
    customCheckbox.style.cursor = 'pointer';
    customCheckbox.style.borderColor = this.rememberMe ? 'rgba(6, 182, 212, 0.8)' : 'rgba(148, 163, 184, 0.3)';
    
    // Custom checkmark
    const checkmark = document.createElement('div');
    checkmark.textContent = '✓';
    checkmark.style.color = '#06b6d4';
    checkmark.style.fontSize = '14px';
    checkmark.style.opacity = this.rememberMe ? '1' : '0';
    checkmark.style.transition = 'opacity 0.2s ease';
    
    customCheckbox.appendChild(checkmark);
    checkboxContainer.appendChild(rememberInput);
    checkboxContainer.appendChild(customCheckbox);
    
    // Add click event to custom checkbox
    customCheckbox.addEventListener('click', () => {
      rememberInput.checked = !rememberInput.checked;
      const event = new Event('change', { bubbles: true });
      rememberInput.dispatchEvent(event);
    });
    
    const rememberLabel = document.createElement('label');
    rememberLabel.setAttribute('for', 'remember-me');
    rememberLabel.textContent = 'Remember me';
    rememberLabel.style.color = '#e2e8f0';
    rememberLabel.style.fontSize = '14px';
    rememberLabel.style.cursor = 'pointer';
    
    rememberLabel.addEventListener('click', () => {
      rememberInput.checked = !rememberInput.checked;
      const event = new Event('change', { bubbles: true });
      rememberInput.dispatchEvent(event);
    });
    
    rememberGroup.appendChild(checkboxContainer);
    rememberGroup.appendChild(rememberLabel);
    
    // Submit button with loading state
    const buttonContainer = document.createElement('div');
    buttonContainer.style.position = 'relative';
    buttonContainer.style.marginBottom = '24px';
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.id = 'login-button';
    submitButton.className = 'futuristic-button';
    submitButton.textContent = this.isLoading ? 'Signing in...' : 'Sign In';
    submitButton.disabled = this.isLoading;
    submitButton.style.width = '100%';
    submitButton.style.padding = '14px';
    submitButton.style.fontSize = '16px';
    submitButton.style.fontWeight = '600';
    
    // Loading spinner
    const loadingSpinner = document.createElement('div');
    loadingSpinner.style.display = this.isLoading ? 'block' : 'none';
    loadingSpinner.style.position = 'absolute';
    loadingSpinner.style.right = '20px';
    loadingSpinner.style.top = '50%';
    loadingSpinner.style.transform = 'translateY(-50%)';
    loadingSpinner.style.width = '20px';
    loadingSpinner.style.height = '20px';
    loadingSpinner.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    loadingSpinner.style.borderTop = '2px solid white';
    loadingSpinner.style.borderRadius = '50%';
    loadingSpinner.style.animation = 'spin 1s linear infinite';
    
    // Add keyframes for spinner
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes spin {
        0% { transform: translateY(-50%) rotate(0deg); }
        100% { transform: translateY(-50%) rotate(360deg); }
      }
    `;
    document.head.appendChild(styleElement);
    
    buttonContainer.appendChild(submitButton);
    buttonContainer.appendChild(loadingSpinner);
    
    // Development login details (REMOVE IN PRODUCTION!)
    const devHelpText = document.createElement('div');
    devHelpText.style.marginBottom = '20px';
    devHelpText.style.padding = '12px 16px';
    devHelpText.style.backgroundColor = 'rgba(14, 165, 233, 0.1)';
    devHelpText.style.borderRadius = '12px';
    devHelpText.style.fontSize = '13px';
    devHelpText.style.color = '#e2e8f0';
    devHelpText.style.border = '1px solid rgba(14, 165, 233, 0.2)';
    devHelpText.innerHTML = `
      <strong>Login Help:</strong><br>
      - Regular users go to user dashboard<br>
      - Admin users go to admin dashboard<br>
    `;
    
    // Help text
    const helpText = document.createElement('p');
    helpText.textContent = 'Need help? Contact the church administration.';
    helpText.style.textAlign = 'center';
    helpText.style.fontSize = '14px';
    helpText.style.color = '#94a3b8';
    helpText.style.marginTop = '24px';
    
    // Append all elements to form
    form.appendChild(errorContainer);
    form.appendChild(usernameGroup);
    form.appendChild(passwordGroup);
    form.appendChild(rememberGroup);
    form.appendChild(buttonContainer);
    form.appendChild(devHelpText);
    form.appendChild(helpText);
    
    formBody.appendChild(form);
    formCard.appendChild(headerSection);
    formCard.appendChild(formBody);
    container.appendChild(formCard);
    
    return container;
  }
  
  // Helper method to redirect based on user role
  redirectBasedOnRole() {
    console.log('Redirecting based on role');
    if (this.authService.isAdmin()) {
      console.log('User is admin, redirecting to admin dashboard');
      this.router.navigateTo('/admin/dashboard');
    } else {
      console.log('User is not admin, redirecting to user dashboard');
      this.router.navigateTo('/dashboard');
    }
  }
  
  async handleSubmit(event) {
    event.preventDefault(); // Prevent form submission
    
    // Get form elements
    const errorContainer = document.getElementById('error-container');
    const errorText = document.getElementById('error-text');
    const submitButton = document.getElementById('login-button');
    const loadingSpinner = submitButton.nextSibling;
    
    // Validate inputs
    if (!this.username || !this.password) {
      errorText.textContent = 'Please enter both username and password';
      errorContainer.style.display = 'flex';
      return;
    }
    
    // Show loading state
    this.isLoading = true;
    submitButton.textContent = 'Signing in...';
    submitButton.disabled = true;
    loadingSpinner.style.display = 'block';
    
    try {
      // Create proper credentials object
      const credentials = {
        username: this.username,
        password: this.password
      };
      
      console.log('Attempting login with:', JSON.stringify(credentials));
      
      // Attempt to login with proper error catching
      const loginResult = await this.apiService.login(credentials);
      
      console.log('Login result:', loginResult);
      
      if (loginResult && loginResult.token) {
        console.log('Login successful');
        // Successful login, store auth data
        this.authService.token = loginResult.token;
        this.authService.user = loginResult.user;
        
        // Save to storage
        const storage = this.rememberMe ? localStorage : sessionStorage;
        storage.setItem('token', loginResult.token);
        storage.setItem('user', JSON.stringify(loginResult.user));
        
        // Check if user is admin and redirect accordingly
        console.log('User data:', loginResult.user);
        console.log('Is admin:', loginResult.user.isAdmin === 1 || loginResult.user.isAdmin === true);
        
        if (loginResult.user.isAdmin === 1 || loginResult.user.isAdmin === true) {
          console.log('Redirecting to admin dashboard');
          window.location.href = '/admin/dashboard';
        } else {
          console.log('Redirecting to user dashboard');
          window.location.href = '/dashboard';
        }
      } else {
        // Handle unexpected response format
        this.error = 'Invalid server response. Please try again.';
        errorText.textContent = this.error;
        errorContainer.style.display = 'flex';
        this.isLoading = false;
        submitButton.textContent = 'Sign In';
        submitButton.disabled = false;
        loadingSpinner.style.display = 'none';
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Show error message
      this.error = error.message || 'An error occurred during login. Please try again.';
      errorText.textContent = this.error;
      errorContainer.style.display = 'flex';
      
      // Reset loading state
      this.isLoading = false;
      submitButton.textContent = 'Sign In';
      submitButton.disabled = false;
      loadingSpinner.style.display = 'none';
    }
  }
}