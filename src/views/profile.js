// src/views/profile.js
import { FuturisticStyles } from '../utils/futuristicStyles.js';

export class ProfileView {
  constructor() {
    this.authService = window.authService;
    this.apiService = window.apiService;
    
    // Set initial state
    this.state = {
      user: this.authService.getUser() || {},
      isLoading: true,
      error: null,
      isEditing: false,
      formData: {},
      saveSuccess: false
    };
  }
  
  render() {
    // Apply futuristic styles
    FuturisticStyles.addGlobalStyles();
    FuturisticStyles.addBackgroundEffects();
    
    const container = document.createElement('div');
    container.style.maxWidth = '1200px';
    container.style.margin = '0 auto';
    container.style.padding = '60px 24px';
    container.style.position = 'relative';
    container.style.zIndex = '1';
    
    // Create header
    const header = this.createHeader();
    container.appendChild(header);
    
    // Create main content area
    const mainContent = document.createElement('div');
    mainContent.id = 'profile-content';
    mainContent.style.marginTop = '40px';
    
    // Show different content based on loading state
    if (this.state.isLoading) {
      mainContent.appendChild(this.renderLoadingState());
    } else if (this.state.error) {
      mainContent.appendChild(this.renderError());
    } else {
      mainContent.appendChild(this.renderProfileContent());
    }
    
    container.appendChild(mainContent);
    
    return container;
  }
  
  createHeader() {
    const header = document.createElement('header');
    header.className = 'neo-card animated-item';
    header.style.padding = '40px';
    header.style.position = 'relative';
    header.style.overflow = 'hidden';
    
    // Add glow effect
    const headerGlow = document.createElement('div');
    headerGlow.className = 'card-glow';
    headerGlow.style.background = 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.4), transparent 70%)';
    header.appendChild(headerGlow);
    
    // Decorative elements
    const circle1 = document.createElement('div');
    circle1.style.position = 'absolute';
    circle1.style.top = '-50px';
    circle1.style.right = '-50px';
    circle1.style.width = '200px';
    circle1.style.height = '200px';
    circle1.style.borderRadius = '50%';
    circle1.style.background = 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(0, 0, 0, 0) 70%)';
    circle1.style.pointerEvents = 'none';
    header.appendChild(circle1);
    
    // Content
    const title = document.createElement('h1');
    title.className = 'text-gradient';
    title.textContent = 'My Profile';
    title.style.fontSize = '48px';
    title.style.fontWeight = '800';
    title.style.margin = '0';
    title.style.position = 'relative';
    
    const user = this.state.user;
    const subtitle = document.createElement('p');
    subtitle.textContent = user.fullName ? `Manage your account settings, ${user.fullName.split(' ')[0]}` : 'Manage your account settings';
    subtitle.style.fontSize = '18px';
    subtitle.style.color = '#94a3b8';
    subtitle.style.marginTop = '10px';
    subtitle.style.maxWidth = '700px';
    
    header.appendChild(title);
    header.appendChild(subtitle);
    
    return header;
  }
  
  renderLoadingState() {
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'neo-card animated-item';
    loadingContainer.style.display = 'flex';
    loadingContainer.style.justifyContent = 'center';
    loadingContainer.style.alignItems = 'center';
    loadingContainer.style.padding = '60px 30px';
    loadingContainer.style.textAlign = 'center';
    
    // Create fancy loading spinner
    const spinnerContainer = document.createElement('div');
    spinnerContainer.style.display = 'flex';
    spinnerContainer.style.flexDirection = 'column';
    spinnerContainer.style.alignItems = 'center';
    spinnerContainer.style.gap = '20px';
    
    const spinner = document.createElement('div');
    spinner.style.width = '60px';
    spinner.style.height = '60px';
    spinner.style.borderRadius = '50%';
    spinner.style.border = '3px solid rgba(6, 182, 212, 0.1)';
    spinner.style.borderTop = '3px solid rgba(6, 182, 212, 0.8)';
    spinner.style.animation = 'profileSpin 1s linear infinite';
    
    // Add spinner animation
    const spinnerStyle = document.createElement('style');
    spinnerStyle.textContent = `
      @keyframes profileSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(spinnerStyle);
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading your profile...';
    loadingText.style.fontSize = '18px';
    loadingText.style.color = '#e2e8f0';
    loadingText.style.fontWeight = '500';
    
    spinnerContainer.appendChild(spinner);
    spinnerContainer.appendChild(loadingText);
    loadingContainer.appendChild(spinnerContainer);
    
    return loadingContainer;
  }
  
  renderError() {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'neo-card animated-item';
    errorContainer.style.padding = '30px';
    errorContainer.style.textAlign = 'center';
    errorContainer.style.color = '#f87171';
    errorContainer.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    
    const errorIcon = document.createElement('div');
    errorIcon.textContent = '⚠️';
    errorIcon.style.fontSize = '40px';
    errorIcon.style.marginBottom = '20px';
    
    const errorTitle = document.createElement('h3');
    errorTitle.textContent = 'Error Loading Profile';
    errorTitle.style.fontSize = '20px';
    errorTitle.style.fontWeight = '600';
    errorTitle.style.marginBottom = '10px';
    
    const errorMessage = document.createElement('p');
    errorMessage.textContent = this.state.error?.message || 'There was an error loading your profile. Please try again later.';
    errorMessage.style.fontSize = '16px';
    errorMessage.style.lineHeight = '1.6';
    errorMessage.style.marginBottom = '20px';
    
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry';
    retryButton.className = 'futuristic-button';
    retryButton.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))';
    retryButton.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    
    retryButton.addEventListener('click', () => {
      this.state.isLoading = true;
      this.state.error = null;
      this.updateView();
      this.loadUserData();
    });
    
    errorContainer.appendChild(errorIcon);
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorMessage);
    errorContainer.appendChild(retryButton);
    
    return errorContainer;
  }
  
  renderProfileContent() {
    const { user, isEditing, saveSuccess } = this.state;
    
    const profileCard = document.createElement('div');
    profileCard.className = 'neo-card animated-item';
    profileCard.style.overflow = 'hidden';
    
    // Card header with action buttons
    const cardHeader = document.createElement('div');
    cardHeader.style.padding = '25px 30px';
    cardHeader.style.display = 'flex';
    cardHeader.style.justifyContent = 'space-between';
    cardHeader.style.alignItems = 'center';
    cardHeader.style.borderBottom = '1px solid rgba(148, 163, 184, 0.1)';
    cardHeader.style.background = 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(30, 41, 59, 0.4))';
    
    const headerTitle = document.createElement('div');
    
    const cardTitle = document.createElement('h2');
    cardTitle.textContent = 'User Information';
    cardTitle.style.fontSize = '22px';
    cardTitle.style.fontWeight = '700';
    cardTitle.style.color = '#ffffff';
    cardTitle.style.margin = '0 0 8px 0';
    
    const cardSubtitle = document.createElement('p');
    cardSubtitle.textContent = 'Personal details and account settings';
    cardSubtitle.style.fontSize = '15px';
    cardSubtitle.style.color = '#94a3b8';
    cardSubtitle.style.margin = '0';
    
    headerTitle.appendChild(cardTitle);
    headerTitle.appendChild(cardSubtitle);
    
    // Action buttons
    const actionButtons = document.createElement('div');
    actionButtons.style.display = 'flex';
    actionButtons.style.gap = '15px';
    
    if (isEditing) {
      // Save button
      const saveButton = document.createElement('button');
      saveButton.id = 'save-profile';
      saveButton.textContent = 'Save Changes';
      saveButton.className = 'futuristic-button';
      saveButton.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))';
      saveButton.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      
      saveButton.addEventListener('click', () => this.handleSave());
      
      // Cancel button
      const cancelButton = document.createElement('button');
      cancelButton.id = 'cancel-edit';
      cancelButton.textContent = 'Cancel';
      cancelButton.className = 'futuristic-button';
      cancelButton.style.background = 'linear-gradient(135deg, rgba(148, 163, 184, 0.2), rgba(148, 163, 184, 0.1))';
      cancelButton.style.border = '1px solid rgba(148, 163, 184, 0.3)';
      
      cancelButton.addEventListener('click', () => {
        this.state.isEditing = false;
        this.state.formData = {};
        this.updateView();
      });
      
      actionButtons.appendChild(saveButton);
      actionButtons.appendChild(cancelButton);
    } else {
      // Edit button
      const editButton = document.createElement('button');
      editButton.id = 'edit-profile';
      editButton.textContent = 'Edit Profile';
      editButton.className = 'futuristic-button';
      editButton.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1))';
      editButton.style.border = '1px solid rgba(6, 182, 212, 0.3)';
      
      editButton.addEventListener('click', () => {
        this.state.isEditing = true;
        this.state.formData = { ...this.state.user };
        this.updateView();
      });
      
      actionButtons.appendChild(editButton);
    }
    
    cardHeader.appendChild(headerTitle);
    cardHeader.appendChild(actionButtons);
    
    // Success message
    if (saveSuccess) {
      const successMessage = document.createElement('div');
      successMessage.style.margin = '20px 30px 0';
      successMessage.style.padding = '15px 20px';
      successMessage.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      successMessage.style.color = '#10b981';
      successMessage.style.borderRadius = '12px';
      successMessage.style.display = 'flex';
      successMessage.style.alignItems = 'center';
      successMessage.style.gap = '10px';
      successMessage.style.animation = 'fadeIn 0.5s forwards';
      
      const successIcon = document.createElement('span');
      successIcon.textContent = '✓';
      successIcon.style.fontSize = '18px';
      successIcon.style.fontWeight = 'bold';
      
      const successText = document.createElement('span');
      successText.textContent = 'Profile updated successfully!';
      successText.style.fontSize = '15px';
      
      successMessage.appendChild(successIcon);
      successMessage.appendChild(successText);
      
      profileCard.appendChild(cardHeader);
      profileCard.appendChild(successMessage);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        this.state.saveSuccess = false;
        this.updateView();
      }, 5000);
    } else {
      profileCard.appendChild(cardHeader);
    }
    
    // Card content - either view mode or edit form
    const cardContent = document.createElement('div');
    if (isEditing) {
      cardContent.appendChild(this.renderEditForm());
    } else {
      cardContent.appendChild(this.renderProfileDetails());
    }
    
    profileCard.appendChild(cardContent);
    
    return profileCard;
  }
  
  renderProfileDetails() {
    const user = this.state.user;
    
    const detailsContainer = document.createElement('div');
    detailsContainer.style.padding = '10px';
    
    // Create futuristic data list
    const dataList = document.createElement('dl');
    dataList.style.display = 'grid';
    dataList.style.gap = '1px';
    dataList.style.margin = '0';
    
    // Profile fields to display
    const fields = [
      { label: 'Full name', value: user.fullName || 'Not set', icon: '👤' },
      { label: 'Username', value: user.username || 'Not set', icon: '🔤' },
      { label: 'Email address', value: user.email || 'Not set', icon: '✉️' },
      { label: 'Phone number', value: user.phone || 'Not set', icon: '📱' },
      { label: 'Account type', value: user.isAdmin ? 'Administrator' : 'Regular User', icon: '🔑' },
      { label: 'Last login', value: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Not available', icon: '🕒' }
    ];
    
    fields.forEach((field, index) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.borderRadius = '16px';
      row.style.margin = '10px 0';
      row.style.overflow = 'hidden';
      row.style.background = index % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.3)';
      row.style.backdropFilter = 'blur(8px)';
      row.style.transition = 'all 0.3s ease';
      row.style.animation = 'fadeIn 0.6s forwards';
      row.style.animationDelay = `${0.1 * (index + 1)}s`;
      row.style.opacity = '0';
      
      // Hover effect
      row.addEventListener('mouseenter', () => {
        row.style.transform = 'translateX(10px)';
        row.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      });
      
      row.addEventListener('mouseleave', () => {
        row.style.transform = 'translateX(0)';
        row.style.boxShadow = 'none';
      });
      
      // Icon with colored background
      const iconColumn = document.createElement('div');
      iconColumn.style.minWidth = '60px';
      iconColumn.style.display = 'flex';
      iconColumn.style.alignItems = 'center';
      iconColumn.style.justifyContent = 'center';
      iconColumn.style.background = 'rgba(6, 182, 212, 0.1)';
      iconColumn.style.fontSize = '20px';
      iconColumn.textContent = field.icon;
      
      // Label column
      const labelColumn = document.createElement('dt');
      labelColumn.textContent = field.label;
      labelColumn.style.padding = '16px 20px';
      labelColumn.style.width = '180px';
      labelColumn.style.fontWeight = '500';
      labelColumn.style.fontSize = '15px';
      labelColumn.style.color = '#94a3b8';
      labelColumn.style.borderRight = '1px solid rgba(148, 163, 184, 0.1)';
      labelColumn.style.display = 'flex';
      labelColumn.style.alignItems = 'center';
      
      // Value column
      const valueColumn = document.createElement('dd');
      valueColumn.textContent = field.value;
      valueColumn.style.padding = '16px 20px';
      valueColumn.style.margin = '0';
      valueColumn.style.flex = '1';
      valueColumn.style.fontWeight = '500';
      valueColumn.style.fontSize = '15px';
      valueColumn.style.color = '#ffffff';
      valueColumn.style.display = 'flex';
      valueColumn.style.alignItems = 'center';
      
      row.appendChild(iconColumn);
      row.appendChild(labelColumn);
      row.appendChild(valueColumn);
      
      dataList.appendChild(row);
    });
    
    detailsContainer.appendChild(dataList);
    
    return detailsContainer;
  }
  
  renderEditForm() {
    const { user, formData } = this.state;
    const data = formData || user;
    
    const formContainer = document.createElement('div');
    formContainer.style.padding = '30px';
    
    const form = document.createElement('form');
    form.id = 'profile-form';
    form.style.display = 'grid';
    form.style.gap = '25px';
    form.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    
    // Full name field
    const fullNameGroup = this.createFormField(
      'fullName',
      'Full name',
      'text',
      data.fullName || '',
      true
    );
    
    // Username field (disabled)
    const usernameGroup = this.createFormField(
      'username',
      'Username',
      'text',
      user.username || '',
      true,
      true // disabled
    );
    
    // Email field
    const emailGroup = this.createFormField(
      'email',
      'Email address',
      'email',
      data.email || '',
      true
    );
    
    // Phone field
    const phoneGroup = this.createFormField(
      'phone',
      'Phone number',
      'tel',
      data.phone || '',
      false
    );
    
    // Password field (span 2 columns)
    const passwordGroup = this.createFormField(
      'password',
      'New Password (leave blank to keep current)',
      'password',
      '',
      false
    );
    passwordGroup.style.gridColumn = '1 / -1';
    
    // Confirm password field (span 2 columns)
    const confirmPasswordGroup = this.createFormField(
      'confirmPassword',
      'Confirm New Password',
      'password',
      '',
      false
    );
    confirmPasswordGroup.style.gridColumn = '1 / -1';
    
    // Append all fields to form
    form.appendChild(fullNameGroup);
    form.appendChild(usernameGroup);
    form.appendChild(emailGroup);
    form.appendChild(phoneGroup);
    form.appendChild(passwordGroup);
    form.appendChild(confirmPasswordGroup);
    
    formContainer.appendChild(form);
    
    return formContainer;
  }
  
  createFormField(id, label, type, value, required, disabled = false) {
    const fieldGroup = document.createElement('div');
    fieldGroup.style.position = 'relative';
    
    const fieldLabel = document.createElement('label');
    fieldLabel.setAttribute('for', id);
    fieldLabel.textContent = label;
    fieldLabel.className = 'futuristic-label';
    
    const inputField = document.createElement('input');
    inputField.type = type;
    inputField.id = id;
    inputField.name = id;
    inputField.className = 'futuristic-input';
    inputField.value = value;
    inputField.required = required;
    inputField.disabled = disabled;
    
    if (disabled) {
      inputField.style.opacity = '0.7';
      inputField.style.cursor = 'not-allowed';
    }
    
    // Handle input changes
    inputField.addEventListener('input', (e) => {
      this.state.formData = { 
        ...this.state.formData, 
        [id]: e.target.value 
      };
    });
    
    fieldGroup.appendChild(fieldLabel);
    fieldGroup.appendChild(inputField);
    
    return fieldGroup;
  }
  
  handleSave() {
    const form = document.getElementById('profile-form');
    
    if (!form) return;
    
    // Basic validation
    if (form.password.value !== form.confirmPassword.value) {
      alert('Passwords do not match.');
      return;
    }
    
    // Get form data
    const formData = {
      fullName: form.fullName.value,
      email: form.email.value,
      phone: form.phone.value
    };
    
    // Only include password if provided
    if (form.password.value) {
      formData.password = form.password.value;
    }
    
    // In a real app, you would call the API here
    console.log('Saving profile data:', formData);
    
    // Update user data (mock implementation)
    setTimeout(() => {
      this.state.user = {
        ...this.state.user,
        ...formData
      };
      
      this.state.isEditing = false;
      this.state.formData = {};
      this.state.saveSuccess = true;
      
      this.updateView();
    }, 1000);
  }
  
  updateView() {
    const profileContent = document.getElementById('profile-content');
    
    if (profileContent) {
      profileContent.innerHTML = '';
      
      if (this.state.isLoading) {
        profileContent.appendChild(this.renderLoadingState());
      } else if (this.state.error) {
        profileContent.appendChild(this.renderError());
      } else {
        profileContent.appendChild(this.renderProfileContent());
      }
    }
  }
  
  async loadUserData() {
    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      window.location.href = '/login';
      return;
    }
    
    try {
      // In a real app, you would fetch user data from API
      // For now, just simulate a delay and use cached user data
      setTimeout(() => {
        this.state.user = this.authService.getUser();
        this.state.isLoading = false;
        this.updateView();
      }, 1000);
    } catch (error) {
      console.error('Error loading profile data:', error);
      this.state.error = error;
      this.state.isLoading = false;
      this.updateView();
    }
  }
  
  async afterRender() {
    // Automatically load user data after rendering
    this.loadUserData();
  }
}