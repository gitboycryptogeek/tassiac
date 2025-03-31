// src/views/contact.js
import { FuturisticStyles } from '../utils/futuristicStyles.js';

export class ContactView {
  constructor() {
    this.title = 'Contact Us';
    this.apiService = window.apiService;
    this.authService = window.authService;
    this.isLoading = false;
    this.error = null;
    this.success = null;
  }
  
  render() {
    // Apply futuristic styles
    FuturisticStyles.addGlobalStyles();
    FuturisticStyles.addBackgroundEffects();
    
    const container = document.createElement('div');
    
    try {
      // Main container styling
      container.style.maxWidth = '1200px';
      container.style.margin = '0 auto';
      container.style.padding = '60px 24px';
      container.style.position = 'relative';
      container.style.zIndex = '1';
      
      // Header section
      const header = this.createHeader();
      container.appendChild(header);
      
      // Main content with grid layout
      const content = document.createElement('div');
      content.style.display = 'grid';
      content.style.gridTemplateColumns = 'repeat(auto-fit, minmax(350px, 1fr))';
      content.style.gap = '40px';
      content.style.marginTop = '40px';
      
      // Contact form section
      const formSection = this.createFormSection();
      
      // Contact information section
      const infoSection = this.createInfoSection();
      
      content.appendChild(formSection);
      content.appendChild(infoSection);
      container.appendChild(content);
      
    } catch (error) {
      console.error('Error rendering Contact view:', error);
      
      const errorMessage = document.createElement('div');
      errorMessage.style.color = '#EF4444';
      errorMessage.style.padding = '20px';
      errorMessage.style.textAlign = 'center';
      errorMessage.style.background = 'rgba(30, 41, 59, 0.7)';
      errorMessage.style.borderRadius = '12px';
      errorMessage.style.backdropFilter = 'blur(10px)';
      errorMessage.style.margin = '20px 0';
      errorMessage.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      errorMessage.textContent = `Error loading page: ${error.message}`;
      
      container.appendChild(errorMessage);
    }
    
    return container;
  }
  
  createHeader() {
    const header = document.createElement('header');
    header.className = 'neo-card animated-item';
    header.style.padding = '40px';
    header.style.textAlign = 'center';
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
    
    const circle2 = document.createElement('div');
    circle2.style.position = 'absolute';
    circle2.style.bottom = '-30px';
    circle2.style.left = '-30px';
    circle2.style.width = '150px';
    circle2.style.height = '150px';
    circle2.style.borderRadius = '50%';
    circle2.style.background = 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(0, 0, 0, 0) 70%)';
    circle2.style.pointerEvents = 'none';
    
    header.appendChild(circle1);
    header.appendChild(circle2);
    
    // Content
    const title = document.createElement('h1');
    title.className = 'text-gradient';
    title.textContent = this.title;
    title.style.fontSize = '48px';
    title.style.fontWeight = '800';
    title.style.margin = '0 0 20px 0';
    title.style.position = 'relative';
    
    const subtitle = document.createElement('p');
    subtitle.textContent = 'We\'d love to hear from you';
    subtitle.style.fontSize = '20px';
    subtitle.style.color = '#94a3b8';
    subtitle.style.margin = '0';
    subtitle.style.maxWidth = '600px';
    subtitle.style.margin = '0 auto';
    
    header.appendChild(title);
    header.appendChild(subtitle);
    
    return header;
  }
  
  createFormSection() {
    const formSection = document.createElement('div');
    formSection.className = 'animated-item';
    formSection.style.animationDelay = '0.2s';
    
    // Error or success messages
    if (this.error) {
      const errorAlert = this.createAlert(this.error, 'error');
      formSection.appendChild(errorAlert);
    }
    
    if (this.success) {
      const successAlert = this.createAlert(this.success, 'success');
      formSection.appendChild(successAlert);
    }
    
    const formCard = document.createElement('div');
    formCard.className = 'neo-card';
    formCard.style.overflow = 'hidden';
    formCard.style.height = '100%';
    
    // Header
    const formHeader = document.createElement('div');
    formHeader.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1))';
    formHeader.style.padding = '25px 30px';
    formHeader.style.position = 'relative';
    formHeader.style.overflow = 'hidden';
    formHeader.style.borderBottom = '1px solid rgba(148, 163, 184, 0.1)';
    
    // Add shine effect
    const headerShine = document.createElement('div');
    headerShine.style.position = 'absolute';
    headerShine.style.top = '0';
    headerShine.style.left = '0';
    headerShine.style.width = '150%';
    headerShine.style.height = '100%';
    headerShine.style.background = 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)';
    headerShine.style.transform = 'translateX(-100%)';
    headerShine.style.animation = 'shine 3s infinite';
    headerShine.style.animationDelay = '1s';
    formHeader.appendChild(headerShine);
    
    const formTitle = document.createElement('h2');
    formTitle.textContent = 'Send us a message';
    formTitle.style.margin = '0';
    formTitle.style.fontSize = '22px';
    formTitle.style.fontWeight = '700';
    formTitle.style.color = '#ffffff';
    formTitle.style.position = 'relative';
    formTitle.style.zIndex = '1';
    
    formHeader.appendChild(formTitle);
    
    // Form body
    const formBody = document.createElement('div');
    formBody.style.padding = '30px';
    
    const form = document.createElement('form');
    form.id = 'contactForm';
    form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Name field
    const nameGroup = this.createFormGroup(
      'name',
      'Name',
      'text',
      'Your name',
      true
    );
    
    // If user is logged in, pre-fill name
    if (this.authService && this.authService.isAuthenticated()) {
      const user = this.authService.getUser();
      if (user && user.fullName) {
        nameGroup.querySelector('input').value = user.fullName;
      }
    }
    
    // Email field
    const emailGroup = this.createFormGroup(
      'email',
      'Email',
      'email',
      'Your email address',
      true
    );
    
    // If user is logged in, pre-fill email
    if (this.authService && this.authService.isAuthenticated()) {
      const user = this.authService.getUser();
      if (user && user.email) {
        emailGroup.querySelector('input').value = user.email;
      }
    }
    
    // Phone field
    const phoneGroup = this.createFormGroup(
      'phone',
      'Phone (optional)',
      'tel',
      'Your phone number',
      false
    );
    
    // If user is logged in, pre-fill phone
    if (this.authService && this.authService.isAuthenticated()) {
      const user = this.authService.getUser();
      if (user && user.phone) {
        phoneGroup.querySelector('input').value = user.phone;
      }
    }
    
    // Subject field
    const subjectGroup = this.createFormGroup(
      'subject',
      'Subject',
      'text',
      'Message subject',
      true
    );
    
    // Message field
    const messageGroup = document.createElement('div');
    messageGroup.style.marginBottom = '30px';
    
    const messageLabel = document.createElement('label');
    messageLabel.setAttribute('for', 'message');
    messageLabel.textContent = 'Message';
    messageLabel.className = 'futuristic-label';
    
    const messageTextarea = document.createElement('textarea');
    messageTextarea.id = 'message';
    messageTextarea.name = 'message';
    messageTextarea.placeholder = 'Your message...';
    messageTextarea.rows = 5;
    messageTextarea.required = true;
    messageTextarea.className = 'futuristic-input';
    messageTextarea.style.resize = 'vertical';
    
    messageGroup.appendChild(messageLabel);
    messageGroup.appendChild(messageTextarea);
    
    // Submit button
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.position = 'relative';
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Send Message';
    submitButton.className = 'futuristic-button';
    submitButton.style.width = '100%';
    submitButton.style.padding = '14px';
    submitButton.style.fontSize = '16px';
    submitButton.style.fontWeight = '600';
    
    // Loading spinner (initially hidden)
    const loadingSpinner = document.createElement('div');
    loadingSpinner.style.display = this.isLoading ? 'block' : 'none';
    loadingSpinner.style.width = '20px';
    loadingSpinner.style.height = '20px';
    loadingSpinner.style.border = '3px solid rgba(255, 255, 255, 0.3)';
    loadingSpinner.style.borderTop = '3px solid white';
    loadingSpinner.style.borderRadius = '50%';
    loadingSpinner.style.animation = 'spin 1s linear infinite';
    loadingSpinner.style.position = 'absolute';
    loadingSpinner.style.right = '20px';
    loadingSpinner.style.top = '50%';
    loadingSpinner.style.transform = 'translateY(-50%)';
    
    // Add keyframes for spinner
    const spinnerStyle = document.createElement('style');
    spinnerStyle.textContent = `
      @keyframes spin {
        0% { transform: translateY(-50%) rotate(0deg); }
        100% { transform: translateY(-50%) rotate(360deg); }
      }
    `;
    document.head.appendChild(spinnerStyle);
    
    buttonWrapper.appendChild(submitButton);
    buttonWrapper.appendChild(loadingSpinner);
    
    // Append all form groups
    form.appendChild(nameGroup);
    form.appendChild(emailGroup);
    form.appendChild(phoneGroup);
    form.appendChild(subjectGroup);
    form.appendChild(messageGroup);
    form.appendChild(buttonWrapper);
    
    formBody.appendChild(form);
    formCard.appendChild(formHeader);
    formCard.appendChild(formBody);
    formSection.appendChild(formCard);
    
    return formSection;
  }
  
  createInfoSection() {
    const infoSection = document.createElement('div');
    infoSection.className = 'animated-item';
    infoSection.style.animationDelay = '0.4s';
    
    const infoCard = document.createElement('div');
    infoCard.className = 'neo-card';
    infoCard.style.overflow = 'hidden';
    infoCard.style.marginBottom = '30px';
    
    // Header
    const infoHeader = document.createElement('div');
    infoHeader.style.background = 'linear-gradient(135deg, rgba(74, 109, 167, 0.2), rgba(74, 109, 167, 0.1))';
    infoHeader.style.padding = '25px 30px';
    infoHeader.style.position = 'relative';
    infoHeader.style.overflow = 'hidden';
    infoHeader.style.borderBottom = '1px solid rgba(148, 163, 184, 0.1)';
    
    // Add shine effect
    const headerShine = document.createElement('div');
    headerShine.style.position = 'absolute';
    headerShine.style.top = '0';
    headerShine.style.left = '0';
    headerShine.style.width = '150%';
    headerShine.style.height = '100%';
    headerShine.style.background = 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)';
    headerShine.style.transform = 'translateX(-100%)';
    headerShine.style.animation = 'shine 3s infinite';
    headerShine.style.animationDelay = '2s';
    infoHeader.appendChild(headerShine);
    
    const infoTitle = document.createElement('h2');
    infoTitle.textContent = 'Contact Information';
    infoTitle.style.margin = '0';
    infoTitle.style.fontSize = '22px';
    infoTitle.style.fontWeight = '700';
    infoTitle.style.color = '#ffffff';
    infoTitle.style.position = 'relative';
    infoTitle.style.zIndex = '1';
    
    infoHeader.appendChild(infoTitle);
    
    const infoBody = document.createElement('div');
    infoBody.style.padding = '30px';
    
    const contactItems = [
      {
        icon: '📍',
        title: 'Address',
        content: '123 Church Street, Nairobi, Kenya',
        color: '#06b6d4'
      },
      {
        icon: '📞',
        title: 'Phone',
        content: '+254 123 456 789',
        color: '#8b5cf6'
      },
      {
        icon: '✉️',
        title: 'Email',
        content: 'info@tassiac.church',
        color: '#10b981'
      },
      {
        icon: '🕒',
        title: 'Service Hours',
        content: 'Sunday: 9:00 AM - 12:00 PM',
        color: '#f59e0b'
      }
    ];
    
    contactItems.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.style.display = 'flex';
      itemDiv.style.alignItems = 'flex-start';
      itemDiv.style.marginBottom = index < contactItems.length - 1 ? '25px' : '0';
      itemDiv.style.position = 'relative';
      itemDiv.style.animation = 'fadeIn 0.6s forwards';
      itemDiv.style.animationDelay = `${0.2 * (index + 1)}s`;
      itemDiv.style.opacity = '0';
      
      // Holographic icon
      const iconDiv = document.createElement('div');
      iconDiv.style.width = '50px';
      iconDiv.style.height = '50px';
      iconDiv.style.borderRadius = '12px';
      iconDiv.style.background = `linear-gradient(135deg, ${this.hexToRgba(item.color, 0.2)}, ${this.hexToRgba(item.color, 0.1)})`;
      iconDiv.style.display = 'flex';
      iconDiv.style.alignItems = 'center';
      iconDiv.style.justifyContent = 'center';
      iconDiv.style.marginRight = '20px';
      iconDiv.style.fontSize = '24px';
      iconDiv.style.boxShadow = `0 0 15px ${this.hexToRgba(item.color, 0.2)}`;
      iconDiv.style.border = `1px solid ${this.hexToRgba(item.color, 0.3)}`;
      iconDiv.style.flexShrink = '0';
      iconDiv.style.position = 'relative';
      
      // Icon glow animation
      const iconGlow = document.createElement('div');
      iconGlow.style.position = 'absolute';
      iconGlow.style.top = '0';
      iconGlow.style.left = '0';
      iconGlow.style.right = '0';
      iconGlow.style.bottom = '0';
      iconGlow.style.borderRadius = '12px';
      iconGlow.style.boxShadow = `0 0 15px ${this.hexToRgba(item.color, 0.3)}`;
      iconGlow.style.animation = 'pulse 3s infinite';
      iconGlow.style.animationDelay = `${index * 0.5}s`;
      iconDiv.appendChild(iconGlow);
      
      iconDiv.textContent = item.icon;
      
      const contentDiv = document.createElement('div');
      contentDiv.style.flex = '1';
      
      const itemTitle = document.createElement('h3');
      itemTitle.textContent = item.title;
      itemTitle.style.margin = '0 0 8px';
      itemTitle.style.fontSize = '18px';
      itemTitle.style.fontWeight = '600';
      itemTitle.style.color = '#ffffff';
      
      const itemContent = document.createElement('p');
      itemContent.textContent = item.content;
      itemContent.style.margin = '0';
      itemContent.style.fontSize = '15px';
      itemContent.style.color = '#e2e8f0';
      itemContent.style.lineHeight = '1.5';
      
      contentDiv.appendChild(itemTitle);
      contentDiv.appendChild(itemContent);
      
      itemDiv.appendChild(iconDiv);
      itemDiv.appendChild(contentDiv);
      
      infoBody.appendChild(itemDiv);
    });
    
    // Map placeholder with futuristic design
    const mapDiv = document.createElement('div');
    mapDiv.style.marginTop = '30px';
    mapDiv.style.height = '200px';
    mapDiv.style.background = 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(30, 41, 59, 0.5))';
    mapDiv.style.borderRadius = '12px';
    mapDiv.style.display = 'flex';
    mapDiv.style.alignItems = 'center';
    mapDiv.style.justifyContent = 'center';
    mapDiv.style.position = 'relative';
    mapDiv.style.overflow = 'hidden';
    mapDiv.style.border = '1px solid rgba(148, 163, 184, 0.1)';
    
    // Map grid lines
    const gridOverlay = document.createElement('div');
    gridOverlay.style.position = 'absolute';
    gridOverlay.style.top = '0';
    gridOverlay.style.left = '0';
    gridOverlay.style.right = '0';
    gridOverlay.style.bottom = '0';
    gridOverlay.style.background = 'linear-gradient(0deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)';
    gridOverlay.style.backgroundSize = '20px 20px';
    gridOverlay.style.opacity = '0.4';
    mapDiv.appendChild(gridOverlay);
    
    // Map location pin
    const locationPin = document.createElement('div');
    locationPin.style.width = '20px';
    locationPin.style.height = '20px';
    locationPin.style.borderRadius = '50%';
    locationPin.style.background = '#06b6d4';
    locationPin.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.7)';
    locationPin.style.position = 'relative';
    
    // Pin pulse animation
    const pinPulse = document.createElement('div');
    pinPulse.style.position = 'absolute';
    pinPulse.style.top = '50%';
    pinPulse.style.left = '50%';
    pinPulse.style.transform = 'translate(-50%, -50%)';
    pinPulse.style.width = '20px';
    pinPulse.style.height = '20px';
    pinPulse.style.borderRadius = '50%';
    pinPulse.style.background = 'rgba(6, 182, 212, 0.7)';
    pinPulse.style.animation = 'mapPulse 2s infinite';
    
    // Add pulse animation
    const pulseStyle = document.createElement('style');
    pulseStyle.textContent = `
      @keyframes mapPulse {
        0% { width: 20px; height: 20px; opacity: 1; }
        100% { width: 60px; height: 60px; opacity: 0; }
      }
    `;
    document.head.appendChild(pulseStyle);
    
    locationPin.appendChild(pinPulse);
    
    const mapText = document.createElement('div');
    mapText.style.position = 'absolute';
    mapText.style.bottom = '15px';
    mapText.style.left = '15px';
    mapText.style.color = '#e2e8f0';
    mapText.style.fontSize = '14px';
    mapText.style.fontWeight = '500';
    mapText.style.padding = '8px 12px';
    mapText.style.background = 'rgba(30, 41, 59, 0.7)';
    mapText.style.borderRadius = '8px';
    mapText.style.backdropFilter = 'blur(5px)';
    mapText.textContent = 'Map location';
    
    mapDiv.appendChild(locationPin);
    mapDiv.appendChild(mapText);
    infoBody.appendChild(mapDiv);
    
    // Social media section
    const socialCard = document.createElement('div');
    socialCard.className = 'neo-card';
    socialCard.style.marginTop = '30px';
    
    // Social body
    const socialBody = document.createElement('div');
    socialBody.style.padding = '20px';
    socialBody.style.display = 'flex';
    socialBody.style.justifyContent = 'space-between';
    
    const socialNetworks = [
      { name: 'Facebook', icon: 'FB', color: '#1877f2' },
      { name: 'Twitter', icon: 'TW', color: '#1da1f2' },
      { name: 'Instagram', icon: 'IG', color: '#c32aa3' },
      { name: 'YouTube', icon: 'YT', color: '#ff0000' }
    ];
    
    socialNetworks.forEach((network, index) => {
      const socialLink = document.createElement('a');
      socialLink.href = '#';
      socialLink.style.display = 'flex';
      socialLink.style.flexDirection = 'column';
      socialLink.style.alignItems = 'center';
      socialLink.style.textDecoration = 'none';
      socialLink.style.color = '#ffffff';
      socialLink.style.animation = 'fadeIn 0.6s forwards';
      socialLink.style.animationDelay = `${0.2 * (index + 1)}s`;
      socialLink.style.opacity = '0';
      
      // Holographic social icon
      const socialIcon = document.createElement('div');
      socialIcon.style.width = '40px';
      socialIcon.style.height = '40px';
      socialIcon.style.borderRadius = '10px';
      socialIcon.style.background = `linear-gradient(135deg, ${this.hexToRgba(network.color, 0.3)}, ${this.hexToRgba(network.color, 0.1)})`;
      socialIcon.style.display = 'flex';
      socialIcon.style.alignItems = 'center';
      socialIcon.style.justifyContent = 'center';
      socialIcon.style.marginBottom = '8px';
      socialIcon.style.fontWeight = 'bold';
      socialIcon.style.fontSize = '16px';
      socialIcon.style.color = '#ffffff';
      socialIcon.style.boxShadow = `0 0 15px ${this.hexToRgba(network.color, 0.2)}`;
      socialIcon.style.border = `1px solid ${this.hexToRgba(network.color, 0.3)}`;
      socialIcon.style.transition = 'all 0.3s ease';
      socialIcon.textContent = network.icon;
      
      // Hover effects
      socialLink.addEventListener('mouseenter', () => {
        socialIcon.style.transform = 'translateY(-5px)';
        socialIcon.style.boxShadow = `0 10px 20px ${this.hexToRgba(network.color, 0.3)}`;
      });
      
      socialLink.addEventListener('mouseleave', () => {
        socialIcon.style.transform = 'translateY(0)';
        socialIcon.style.boxShadow = `0 0 15px ${this.hexToRgba(network.color, 0.2)}`;
      });
      
      const socialName = document.createElement('span');
      socialName.textContent = network.name;
      socialName.style.fontSize = '12px';
      socialName.style.fontWeight = '500';
      
      socialLink.appendChild(socialIcon);
      socialLink.appendChild(socialName);
      
      socialBody.appendChild(socialLink);
    });
    
    socialCard.appendChild(socialBody);
    
    infoCard.appendChild(infoHeader);
    infoCard.appendChild(infoBody);
    infoSection.appendChild(infoCard);
    infoSection.appendChild(socialCard);
    
    return infoSection;
  }
  
  createFormGroup(name, label, type, placeholder, required) {
    const group = document.createElement('div');
    group.style.marginBottom = '24px';
    
    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', name);
    labelEl.textContent = label;
    labelEl.className = 'futuristic-label';
    
    const input = document.createElement('input');
    input.type = type;
    input.id = name;
    input.name = name;
    input.placeholder = placeholder;
    input.required = required;
    input.className = 'futuristic-input';
    
    group.appendChild(labelEl);
    group.appendChild(input);
    
    return group;
  }
  
  createAlert(message, type) {
    const alert = document.createElement('div');
    alert.style.marginBottom = '20px';
    alert.style.borderRadius = '12px';
    alert.style.display = 'flex';
    alert.style.alignItems = 'center';
    alert.style.gap = '12px';
    alert.style.padding = '16px 20px';
    alert.style.backdropFilter = 'blur(10px)';
    alert.style.border = '1px solid';
    
    const icon = document.createElement('span');
    icon.style.fontSize = '20px';
    
    const text = document.createElement('p');
    text.textContent = message;
    text.style.margin = '0';
    text.style.fontSize = '15px';
    
    if (type === 'error') {
      alert.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      alert.style.color = '#f87171';
      alert.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      icon.textContent = '⚠️';
    } else {
      alert.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      alert.style.color = '#10b981';
      alert.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      icon.textContent = '✅';
    }
    
    alert.appendChild(icon);
    alert.appendChild(text);
    
    return alert;
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.isLoading) return;
    
    const form = e.target;
    const formData = new FormData(form);
    
    const contactData = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      subject: formData.get('subject'),
      message: formData.get('message'),
      userId: this.authService && this.authService.isAuthenticated() ? this.authService.getUserId() : null
    };
    
    this.isLoading = true;
    this.updateLoadingState();
    
    try {
      // Send inquiry to the admin dashboard
      const response = await this.apiService.post('/contact/inquiry', contactData);
      
      if (response && response.success) {
        this.success = 'Your message has been sent successfully. We will get back to you soon.';
        form.reset();
      } else {
        this.error = 'Failed to send your message. Please try again.';
      }
    } catch (error) {
      console.error('Contact form submission error:', error);
      this.error = error.response?.data?.message || 'Failed to send your message. Please try again.';
    } finally {
      this.isLoading = false;
      this.updateView();
    }
  }
  
  updateLoadingState() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    
    const submitButton = form.querySelector('button[type="submit"]');
    const loadingSpinner = submitButton.nextSibling;
    
    if (this.isLoading) {
      submitButton.textContent = 'Sending...';
      submitButton.disabled = true;
      submitButton.style.opacity = '0.7';
      loadingSpinner.style.display = 'block';
    } else {
      submitButton.textContent = 'Send Message';
      submitButton.disabled = false;
      submitButton.style.opacity = '1';
      loadingSpinner.style.display = 'none';
    }
  }
  
  updateView() {
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = '';
      appContainer.appendChild(this.render());
    }
  }
  
  // Helper function to convert hex to rgba
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}