// src/views/home.js
import { BaseComponent } from '../utils/BaseComponent.js';
import { FuturisticStyles } from '../utils/futuristicStyles.js';

export class HomeView extends BaseComponent {
  constructor() {
    super();
    this.title = 'Seventh-Day Adventist Church Tassia Central  - Financial Management';
    this.user = this.authService ? this.authService.getUser() : null;
    this.isAuthenticated = this.authService ? this.authService.isAuthenticated() : false;
    this.isAdmin = this.authService ? this.authService.isAdmin() : false;
    this.verseIndex = Math.floor(Math.random() * this.bibleVerses.length);
    
    // Apply futuristic styles
    FuturisticStyles.addGlobalStyles();
    FuturisticStyles.addBackgroundEffects();
  }

  // Collection of inspirational Bible verses about giving and stewardship
  bibleVerses = [
    {
      text: "Bring the whole tithe into the storehouse, that there may be food in my house. Test me in this, says the LORD Almighty, and see if I will not throw open the floodgates of heaven and pour out so much blessing that there will not be room enough to store it.",
      reference: "Malachi 3:10"
    },
    {
      text: "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.",
      reference: "2 Corinthians 9:7"
    },
    {
      text: "But who am I, and who are my people, that we should be able to give as generously as this? Everything comes from you, and we have given you only what comes from your hand.",
      reference: "1 Chronicles 29:14"
    },
    {
      text: "Honor the Lord with your wealth, with the firstfruits of all your crops; then your barns will be filled to overflowing, and your vats will brim over with new wine.",
      reference: "Proverbs 3:9-10"
    },
    {
      text: "Remember this: Whoever sows sparingly will also reap sparingly, and whoever sows generously will also reap generously.",
      reference: "2 Corinthians 9:6"
    }
  ];

  getDayOfWeek() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Sabbath'];
    return days[new Date().getDay()];
  }

  async render() {
    const container = document.createElement('div');
    container.style.maxWidth = '100%';
    container.style.margin = '0 auto';
    container.style.fontFamily = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    container.style.color = '#f8fafc';
    container.style.minHeight = '100vh';
    container.style.position = 'relative';
    
    // Hero section with enhanced futuristic design
    container.appendChild(this.renderHeroSection());
    
    // Bible verse section with neo-morphic design
    container.appendChild(this.renderVerseSection());
    
    // Financial services section with interactive cards
    container.appendChild(this.renderServicesSection());
    
    // Route guides based on user role with holographic effects
    container.appendChild(this.renderRouteGuides());

    // Enhanced footer with animated accents
    container.appendChild(this.renderFooter());

    return container;
  }

  renderHeroSection() {
    const heroSection = document.createElement('div');
    heroSection.className = 'animated-item';
    heroSection.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(26, 57, 167, 0.9))';
    heroSection.style.borderRadius = '0 0 40px 40px';
    heroSection.style.padding = '100px 20px 120px';
    heroSection.style.color = 'white';
    heroSection.style.textAlign = 'center';
    heroSection.style.position = 'relative';
    heroSection.style.overflow = 'hidden';
    heroSection.style.boxShadow = '0 30px 60px rgba(15, 23, 42, 0.4)';
    heroSection.style.zIndex = '2';
    
    // Custom overlay pattern with animated particles
    const pattern = document.createElement('div');
    pattern.style.position = 'absolute';
    pattern.style.top = '0';
    pattern.style.left = '0';
    pattern.style.right = '0';
    pattern.style.bottom = '0';
    pattern.style.background = 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23ffffff\' fill-opacity=\'0.05\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")';
    pattern.style.opacity = '0.5';
    pattern.style.zIndex = '0';
    
    // Create 10 floating particles
    for (let i = 0; i < 10; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = `${Math.random() * 10 + 5}px`;
      particle.style.height = `${Math.random() * 10 + 5}px`;
      particle.style.borderRadius = '50%';
      particle.style.background = 'rgba(255, 255, 255, 0.2)';
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animation = `float ${Math.random() * 10 + 10}s ease-in-out infinite`;
      particle.style.animationDelay = `${Math.random() * 5}s`;
      particle.style.opacity = Math.random() * 0.5 + 0.1;
      
      pattern.appendChild(particle);
    }
    
    // Add glassmorphism overlay
    const glassOverlay = document.createElement('div');
    glassOverlay.style.position = 'absolute';
    glassOverlay.style.top = '0';
    glassOverlay.style.left = '0';
    glassOverlay.style.right = '0';
    glassOverlay.style.bottom = '0';
    glassOverlay.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))';
    glassOverlay.style.backdropFilter = 'blur(10px)';
    glassOverlay.style.borderRadius = '0 0 40px 40px';
    glassOverlay.style.zIndex = '0';
    
    // Enhanced radial glow
    const radialGlow = document.createElement('div');
    radialGlow.style.position = 'absolute';
    radialGlow.style.top = '0';
    radialGlow.style.left = '0';
    radialGlow.style.right = '0';
    radialGlow.style.bottom = '0';
    radialGlow.style.background = 'radial-gradient(circle at 30% 20%, rgba(6, 182, 212, 0.4), transparent 50%), radial-gradient(circle at 70% 60%, rgba(26, 57, 167, 0.4), transparent 50%)';
    radialGlow.style.opacity = '0.8';
    radialGlow.style.zIndex = '0';
    
    // Animated circle design elements
    const circle1 = document.createElement('div');
    circle1.style.position = 'absolute';
    circle1.style.top = '-150px';
    circle1.style.right = '-100px';
    circle1.style.width = '400px';
    circle1.style.height = '400px';
    circle1.style.borderRadius = '50%';
    circle1.style.background = 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)';
    circle1.style.zIndex = '0';
    circle1.style.animation = 'float 15s ease-in-out infinite';

    const circle2 = document.createElement('div');
    circle2.style.position = 'absolute';
    circle2.style.bottom = '-100px';
    circle2.style.left = '-50px';
    circle2.style.width = '300px';
    circle2.style.height = '300px';
    circle2.style.borderRadius = '50%';
    circle2.style.background = 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)';
    circle2.style.zIndex = '0';
    circle2.style.animation = 'float 20s ease-in-out infinite reverse';
    
    // Content container with relative positioning
    const content = document.createElement('div');
    content.style.position = 'relative';
    content.style.zIndex = '2';
    content.style.maxWidth = '800px';
    content.style.margin = '0 auto';

    // Dynamic greeting with enhanced text effects
    const greeting = document.createElement('h1');
    greeting.className = 'text-gradient';
    greeting.textContent = `Happy ${this.getDayOfWeek()}!`;
    greeting.style.fontSize = '60px';
    greeting.style.fontWeight = '800';
    greeting.style.marginBottom = '16px';
    greeting.style.textShadow = '0 4px 12px rgba(0,0,0,0.3)';
    greeting.style.letterSpacing = '-0.5px';
    greeting.style.transform = 'translateZ(0)';
    greeting.style.background = 'linear-gradient(to right, #ffffff, #06b6d4)';
    greeting.style.WebkitBackgroundClip = 'text';
    greeting.style.WebkitTextFillColor = 'transparent';
    greeting.style.backgroundClip = 'text';
    greeting.style.color = 'transparent';
    greeting.style.display = 'inline-block';

    const churchName = document.createElement('h2');
    churchName.textContent = 'Seventh-Day Adventist Church Tassia Central';
    churchName.style.fontSize = '36px';
    churchName.style.fontWeight = '700';
    churchName.style.marginBottom = '25px';
    churchName.style.textShadow = '0 4px 12px rgba(0,0,0,0.2)';
    churchName.style.letterSpacing = '0.5px';
    churchName.style.color = '#ffffff';

    const tagline = document.createElement('p');
    tagline.textContent = 'Managing our resources for God\'s glory — simplifying your financial stewardship journey';
    tagline.style.fontSize = '22px';
    tagline.style.fontWeight = '400';
    tagline.style.lineHeight = '1.6';
    tagline.style.maxWidth = '650px';
    tagline.style.margin = '0 auto 50px';
    tagline.style.textShadow = '0 2px 6px rgba(0,0,0,0.2)';
    tagline.style.color = 'rgba(255, 255, 255, 0.9)';

    // CTA buttons with enhanced effects
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.gap = '25px';
    buttonContainer.style.flexWrap = 'wrap';

    const primaryButton = document.createElement('a');
    primaryButton.href = '/make-payment';
    primaryButton.className = 'futuristic-button';
    primaryButton.textContent = 'Make a Contribution';
    primaryButton.style.padding = '18px 36px';
    primaryButton.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.1))';
    primaryButton.style.color = '#ffffff';
    primaryButton.style.borderRadius = '16px';
    primaryButton.style.fontWeight = '700';
    primaryButton.style.backdropFilter = 'blur(10px)';
    primaryButton.style.fontSize = '18px';
    primaryButton.style.letterSpacing = '0.5px';
    primaryButton.style.border = '1px solid rgba(6, 182, 212, 0.3)';
    primaryButton.style.boxShadow = '0 15px 25px rgba(0,0,0,0.2), 0 5px 10px rgba(0,0,0,0.1)';
    
    // Add hover and active effects
    primaryButton.addEventListener('mouseenter', () => {
      primaryButton.style.transform = 'translateY(-5px) scale(1.03)';
      primaryButton.style.boxShadow = '0 20px 30px rgba(0,0,0,0.25), 0 10px 15px rgba(0,0,0,0.15)';
    });
    
    primaryButton.addEventListener('mouseleave', () => {
      primaryButton.style.transform = 'translateY(0) scale(1)';
      primaryButton.style.boxShadow = '0 15px 25px rgba(0,0,0,0.2), 0 5px 10px rgba(0,0,0,0.1)';
    });
    
    // Handle the redirects correctly
    const secondaryButton = document.createElement('a');
    secondaryButton.href = this.isAuthenticated ? (this.isAdmin ? '/admin/dashboard' : '/dashboard') : '/login';
    secondaryButton.className = 'futuristic-button';
    secondaryButton.textContent = this.isAuthenticated ? (this.isAdmin ? 'Admin Dashboard' : 'My Dashboard') : 'Sign In';
    secondaryButton.style.padding = '18px 36px';
    secondaryButton.style.background = 'rgba(15, 23, 42, 0.5)';
    secondaryButton.style.color = 'white';
    secondaryButton.style.borderRadius = '16px';
    secondaryButton.style.fontWeight = '700';
    secondaryButton.style.backdropFilter = 'blur(10px)';
    secondaryButton.style.border = '1px solid rgba(255,255,255,0.1)';
    secondaryButton.style.fontSize = '18px';
    secondaryButton.style.letterSpacing = '0.5px';
    secondaryButton.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';
    
    // Add hover effects
    secondaryButton.addEventListener('mouseenter', () => {
      secondaryButton.style.backgroundColor = 'rgba(15, 23, 42, 0.7)';
      secondaryButton.style.transform = 'translateY(-5px) scale(1.03)';
      secondaryButton.style.boxShadow = '0 15px 25px rgba(0,0,0,0.2)';
    });
    
    secondaryButton.addEventListener('mouseleave', () => {
      secondaryButton.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
      secondaryButton.style.transform = 'translateY(0) scale(1)';
      secondaryButton.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';
    });

    buttonContainer.appendChild(primaryButton);
    buttonContainer.appendChild(secondaryButton);

    content.appendChild(greeting);
    content.appendChild(churchName);
    content.appendChild(tagline);
    content.appendChild(buttonContainer);
    
    // Add the elements to the hero section
    heroSection.appendChild(radialGlow);
    heroSection.appendChild(pattern);
    heroSection.appendChild(glassOverlay);
    heroSection.appendChild(circle1);
    heroSection.appendChild(circle2);
    heroSection.appendChild(content);

    return heroSection;
  }

  renderVerseSection() {
    const verseSection = document.createElement('div');
    verseSection.className = 'animated-item';
    verseSection.style.padding = '80px 20px';
    verseSection.style.textAlign = 'center';
    verseSection.style.maxWidth = '1000px';
    verseSection.style.margin = '0 auto';
    verseSection.style.position = 'relative';
    verseSection.style.zIndex = '1';
    verseSection.style.animationDelay = '0.2s';

    const verseCard = document.createElement('div');
    verseCard.className = 'neo-card';
    verseCard.style.padding = '60px 40px';
    verseCard.style.position = 'relative';
    verseCard.style.overflow = 'hidden';
    verseCard.style.borderRadius = '24px';
    
    // Add glow effect
    const verseGlow = document.createElement('div');
    verseGlow.className = 'card-glow';
    verseGlow.style.background = 'radial-gradient(circle at center, rgba(6, 182, 212, 0.3), transparent 70%)';
    verseCard.appendChild(verseGlow);

    // Decorative elements with gradients
    const decorativeCircle1 = document.createElement('div');
    decorativeCircle1.style.position = 'absolute';
    decorativeCircle1.style.top = '-70px';
    decorativeCircle1.style.left = '-70px';
    decorativeCircle1.style.width = '140px';
    decorativeCircle1.style.height = '140px';
    decorativeCircle1.style.borderRadius = '50%';
    decorativeCircle1.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.2), rgba(6, 182, 212, 0.2))';
    decorativeCircle1.style.opacity = '0.5';
    verseCard.appendChild(decorativeCircle1);

    const decorativeCircle2 = document.createElement('div');
    decorativeCircle2.style.position = 'absolute';
    decorativeCircle2.style.bottom = '-50px';
    decorativeCircle2.style.right = '-50px';
    decorativeCircle2.style.width = '180px';
    decorativeCircle2.style.height = '180px';
    decorativeCircle2.style.borderRadius = '50%';
    decorativeCircle2.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(15, 23, 42, 0.2))';
    decorativeCircle2.style.opacity = '0.5';
    verseCard.appendChild(decorativeCircle2);

    // Cross icon with glowing effects
    const crossIcon = document.createElement('div');
    crossIcon.style.marginBottom = '30px';
    crossIcon.style.position = 'relative';
    crossIcon.style.display = 'inline-block';
    
    // Create a container for the cross with a glow effect
    const crossContainer = document.createElement('div');
    crossContainer.style.position = 'relative';
    crossContainer.style.width = '60px';
    crossContainer.style.height = '60px';
    crossContainer.style.margin = '0 auto';
    
    // Add an inner glow
    const crossGlow = document.createElement('div');
    crossGlow.style.position = 'absolute';
    crossGlow.style.top = '50%';
    crossGlow.style.left = '50%';
    crossGlow.style.transform = 'translate(-50%, -50%)';
    crossGlow.style.width = '50px';
    crossGlow.style.height = '50px';
    crossGlow.style.borderRadius = '50%';
    crossGlow.style.background = 'radial-gradient(circle, rgba(6, 182, 212, 0.4), transparent 70%)';
    crossGlow.style.animation = 'pulse 3s infinite';
    crossContainer.appendChild(crossGlow);

    const crossVertical = document.createElement('div');
    crossVertical.style.position = 'absolute';
    crossVertical.style.width = '6px';
    crossVertical.style.height = '50px';
    crossVertical.style.background = 'linear-gradient(to bottom, #06b6d4, #0284c7)';
    crossVertical.style.borderRadius = '3px';
    crossVertical.style.top = '5px';
    crossVertical.style.left = '50%';
    crossVertical.style.transform = 'translateX(-50%)';
    
    const crossHorizontal = document.createElement('div');
    crossHorizontal.style.position = 'absolute';
    crossHorizontal.style.width = '40px';
    crossHorizontal.style.height = '6px';
    crossHorizontal.style.background = 'linear-gradient(to right, #06b6d4, #0284c7)';
    crossHorizontal.style.borderRadius = '3px';
    crossHorizontal.style.top = '50%';
    crossHorizontal.style.left = '50%';
    crossHorizontal.style.transform = 'translate(-50%, -50%)';
    
    crossContainer.appendChild(crossVertical);
    crossContainer.appendChild(crossHorizontal);
    crossIcon.appendChild(crossContainer);

    const verse = this.bibleVerses[this.verseIndex];

    const verseText = document.createElement('p');
    verseText.textContent = verse.text;
    verseText.style.fontSize = '24px';
    verseText.style.fontWeight = '500';
    verseText.style.lineHeight = '1.7';
    verseText.style.marginBottom = '30px';
    verseText.style.fontStyle = 'italic';
    verseText.style.color = '#e2e8f0';
    verseText.style.maxWidth = '800px';
    verseText.style.margin = '0 auto 30px';
    verseText.style.position = 'relative';
    
    // Add subtle text animation on hover
    verseText.addEventListener('mouseenter', () => {
      verseText.style.transform = 'scale(1.02)';
      verseText.style.transition = 'transform 0.5s ease';
    });
    
    verseText.addEventListener('mouseleave', () => {
      verseText.style.transform = 'scale(1)';
    });

    const verseReference = document.createElement('p');
    verseReference.style.fontSize = '20px';
    verseReference.style.fontWeight = '700';
    verseReference.style.color = '#06b6d4';
    verseReference.style.position = 'relative';
    verseReference.style.display = 'inline-block';
    verseReference.style.padding = '10px 30px';
    verseReference.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(6, 182, 212, 0.05))';
    verseReference.style.borderRadius = '16px';
    verseReference.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
    verseReference.textContent = `— ${verse.reference}`;
    
    // Add a glow around the reference
    const referenceGlow = document.createElement('div');
    referenceGlow.style.position = 'absolute';
    referenceGlow.style.top = '0';
    referenceGlow.style.left = '0';
    referenceGlow.style.right = '0';
    referenceGlow.style.bottom = '0';
    referenceGlow.style.borderRadius = '16px';
    referenceGlow.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.2)';
    referenceGlow.style.opacity = '0';
    referenceGlow.style.transition = 'opacity 0.3s ease';
    
    verseReference.appendChild(referenceGlow);
    
    // Add hover effect for the reference
    verseReference.addEventListener('mouseenter', () => {
      referenceGlow.style.opacity = '1';
    });
    
    verseReference.addEventListener('mouseleave', () => {
      referenceGlow.style.opacity = '0';
    });

    verseCard.appendChild(crossIcon);
    verseCard.appendChild(verseText);
    verseCard.appendChild(verseReference);
    verseSection.appendChild(verseCard);

    return verseSection;
  }

  renderServicesSection() {
    const servicesSection = document.createElement('div');
    servicesSection.className = 'animated-item';
    servicesSection.style.padding = '40px 20px 80px';
    servicesSection.style.maxWidth = '1200px';
    servicesSection.style.margin = '0 auto';
    servicesSection.style.position = 'relative';
    servicesSection.style.animationDelay = '0.4s';

    // Visual decoration
    const diagonalAccent = document.createElement('div');
    diagonalAccent.style.position = 'absolute';
    diagonalAccent.style.top = '30px';
    diagonalAccent.style.left = '0';
    diagonalAccent.style.right = '0';
    diagonalAccent.style.height = '80%';
    diagonalAccent.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.05), rgba(6, 182, 212, 0.05))';
    diagonalAccent.style.transform = 'skewY(-6deg)';
    diagonalAccent.style.zIndex = '-1';
    diagonalAccent.style.borderRadius = '30px';
    servicesSection.appendChild(diagonalAccent);

    const sectionHeader = document.createElement('div');
    sectionHeader.style.textAlign = 'center';
    sectionHeader.style.marginBottom = '60px';

    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'text-gradient';
    sectionTitle.textContent = 'Financial Stewardship Services';
    sectionTitle.style.fontSize = '38px';
    sectionTitle.style.fontWeight = '800';
    sectionTitle.style.marginBottom = '16px';
    sectionTitle.style.position = 'relative';
    sectionTitle.style.display = 'inline-block';
    sectionTitle.style.background = 'linear-gradient(to right, #ffffff, #06b6d4)';
    sectionTitle.style.WebkitBackgroundClip = 'text';
    sectionTitle.style.WebkitTextFillColor = 'transparent';
    sectionTitle.style.backgroundClip = 'text';
    sectionTitle.style.color = 'transparent';
    
    // Add animated underline
    const titleUnderline = document.createElement('div');
    titleUnderline.style.position = 'absolute';
    titleUnderline.style.bottom = '-10px';
    titleUnderline.style.left = '50%';
    titleUnderline.style.transform = 'translateX(-50%)';
    titleUnderline.style.height = '4px';
    titleUnderline.style.width = '80px';
    titleUnderline.style.background = 'linear-gradient(to right, #0284c7, #06b6d4)';
    titleUnderline.style.borderRadius = '2px';
    titleUnderline.style.animation = 'pulse 3s infinite';
    sectionTitle.appendChild(titleUnderline);

    const sectionDescription = document.createElement('p');
    sectionDescription.textContent = 'Manage your tithes, offerings, and special contributions with our easy-to-use financial tools designed for faithful stewardship.';
    sectionDescription.style.fontSize = '18px';
    sectionDescription.style.color = '#e2e8f0';
    sectionDescription.style.maxWidth = '700px';
    sectionDescription.style.margin = '30px auto 0';
    sectionDescription.style.lineHeight = '1.6';
    sectionDescription.style.position = 'relative';
    sectionDescription.style.zIndex = '1';

    sectionHeader.appendChild(sectionTitle);
    sectionHeader.appendChild(sectionDescription);
    servicesSection.appendChild(sectionHeader);

    const servicesGrid = document.createElement('div');
    servicesGrid.style.display = 'grid';
    servicesGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    servicesGrid.style.gap = '30px';
    servicesGrid.style.padding = '0 10px';

    const services = [
      {
        title: 'Tithe',
        description: 'Return faithfully 10% of your increase as acknowledgment that God is the source of all blessings.',
        icon: '🙏',
        gradient: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
        color: '#0284c7'
      },
      {
        title: 'Offerings',
        description: 'Support church ministries, operations and outreach through your generous freewill offerings.',
        icon: '💝',
        gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)',
        color: '#0891b2'
      },
      {
        title: 'Special Projects',
        description: 'Contribute to church development initiatives including building funds and community outreach.',
        icon: '🏗️',
        gradient: 'linear-gradient(135deg, #0f766e, #14b8a6)',
        color: '#0f766e'
      },
      {
        title: 'Track Contributions',
        description: 'Access your complete giving history and generate detailed receipts for tax purposes.',
        icon: '📊',
        gradient: 'linear-gradient(135deg, #15803d, #22c55e)',
        color: '#15803d'
      }
    ];

    services.forEach((service, index) => {
      const serviceCard = document.createElement('div');
      serviceCard.className = 'neo-card';
      serviceCard.style.height = '100%';
      serviceCard.style.display = 'flex';
      serviceCard.style.flexDirection = 'column';
      serviceCard.style.position = 'relative';
      serviceCard.style.overflow = 'hidden';
      serviceCard.style.zIndex = '1';
      serviceCard.style.animation = 'fadeIn 0.6s forwards';
      serviceCard.style.animationDelay = `${0.2 * (index + 1)}s`;
      serviceCard.style.opacity = '0';
      serviceCard.style.borderRadius = '24px';
      
      // Add glow effect
      const cardGlow = document.createElement('div');
      cardGlow.className = 'card-glow';
      cardGlow.style.background = `radial-gradient(circle at top right, ${this.hexToRgba(service.color, 0.3)}, transparent 70%)`;
      serviceCard.appendChild(cardGlow);
      
      // Add hover effects
      serviceCard.addEventListener('mouseenter', () => {
        serviceCard.style.transform = 'translateY(-10px)';
        serviceCard.style.boxShadow = '0 30px 60px rgba(0,0,0,0.2), 0 15px 30px rgba(0,0,0,0.1)';
        cardGlow.style.opacity = '0.5';
      });
      
      serviceCard.addEventListener('mouseleave', () => {
        serviceCard.style.transform = 'translateY(0)';
        serviceCard.style.boxShadow = '0 4px 24px -8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 8px 16px -4px rgba(0, 0, 0, 0.2)';
        cardGlow.style.opacity = '0';
      });

      // Add shine effect on hover
      const shine = document.createElement('div');
      shine.className = 'service-shine';
      shine.style.position = 'absolute';
      shine.style.top = '0';
      shine.style.left = '0';
      shine.style.width = '100px';
      shine.style.height = '100px';
      shine.style.background = 'linear-gradient(225deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 50%)';
      shine.style.transform = 'translateX(-100px) translateY(100px)';
      shine.style.transition = 'transform 0.6s cubic-bezier(0.33, 1, 0.68, 1)';
      shine.style.zIndex = '0';
      shine.style.pointerEvents = 'none';
      
      serviceCard.addEventListener('mouseenter', () => {
        shine.style.transform = 'translateX(300px) translateY(-300px)';
      });
      
      serviceCard.addEventListener('mouseleave', () => {
        shine.style.transform = 'translateX(-100px) translateY(100px)';
      });
      
      serviceCard.appendChild(shine);
      
      // Card header
      const cardHeader = document.createElement('div');
      cardHeader.style.padding = '30px 25px 20px';
      
      const iconContainer = document.createElement('div');
      iconContainer.style.width = '70px';
      iconContainer.style.height = '70px';
      iconContainer.style.borderRadius = '16px';
      iconContainer.style.background = service.gradient;
      iconContainer.style.display = 'flex';
      iconContainer.style.alignItems = 'center';
      iconContainer.style.justifyContent = 'center';
      iconContainer.style.marginBottom = '24px';
      iconContainer.style.fontSize = '30px';
      iconContainer.style.boxShadow = `0 15px 30px ${this.hexToRgba(service.color, 0.3)}`;
      iconContainer.style.position = 'relative';
      iconContainer.style.zIndex = '2';
      iconContainer.textContent = service.icon;
      
      // Icon glow animation
      const iconGlow = document.createElement('div');
      iconGlow.style.position = 'absolute';
      iconGlow.style.top = '0';
      iconGlow.style.left = '0';
      iconGlow.style.right = '0';
      iconGlow.style.bottom = '0';
      iconGlow.style.borderRadius = '16px';
      iconGlow.style.boxShadow = `0 0 20px ${this.hexToRgba(service.color, 0.5)}`;
      iconGlow.style.animation = 'pulse 3s infinite';
      iconGlow.style.animationDelay = `${index * 0.5}s`;
      iconContainer.appendChild(iconGlow);
      
      const serviceTitle = document.createElement('h3');
      serviceTitle.textContent = service.title;
      serviceTitle.style.fontSize = '22px';
      serviceTitle.style.fontWeight = '700';
      serviceTitle.style.marginBottom = '16px';
      serviceTitle.style.color = '#ffffff';
      serviceTitle.style.textShadow = `0 2px 8px ${this.hexToRgba(service.color, 0.3)}`;
      serviceTitle.style.zIndex = '2';
      serviceTitle.style.position = 'relative';
      
      cardHeader.appendChild(iconContainer);
      cardHeader.appendChild(serviceTitle);
      
      // Card body
      const cardBody = document.createElement('div');
      cardBody.style.padding = '0 25px 30px';
      cardBody.style.flex = '1';
      
      const serviceDescription = document.createElement('p');
      serviceDescription.textContent = service.description;
      serviceDescription.style.fontSize = '16px';
      serviceDescription.style.lineHeight = '1.7';
      serviceDescription.style.color = '#e2e8f0';
      serviceDescription.style.position = 'relative';
      serviceDescription.style.zIndex = '2';
      
      // Action link 
      const actionLink = document.createElement('a');
      actionLink.href = '/make-payment';
      actionLink.style.display = 'inline-flex';
      actionLink.style.alignItems = 'center';
      actionLink.style.marginTop = '20px';
      actionLink.style.color = this.hexToRgba(service.color, 1);
      actionLink.style.fontWeight = '600';
      actionLink.style.fontSize = '15px';
      actionLink.style.transition = 'all 0.3s ease';
      actionLink.style.position = 'relative';
      actionLink.style.zIndex = '2';
      
      const linkText = document.createElement('span');
      linkText.textContent = 'Learn More';
      
      const linkArrow = document.createElement('span');
      linkArrow.textContent = '→';
      linkArrow.style.marginLeft = '8px';
      linkArrow.style.transition = 'transform 0.3s ease';
      
      actionLink.addEventListener('mouseenter', () => {
        linkArrow.style.transform = 'translateX(5px)';
      });
      
      actionLink.addEventListener('mouseleave', () => {
        linkArrow.style.transform = 'translateX(0)';
      });
      
      actionLink.appendChild(linkText);
      actionLink.appendChild(linkArrow);
      
      cardBody.appendChild(serviceDescription);
      cardBody.appendChild(actionLink);
      
      serviceCard.appendChild(cardHeader);
      serviceCard.appendChild(cardBody);
      
      servicesGrid.appendChild(serviceCard);
    });

    servicesSection.appendChild(servicesGrid);

    return servicesSection;
  }

  renderRouteGuides() {
    const routeSection = document.createElement('div');
    routeSection.className = 'animated-item';
    routeSection.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.7))';
    routeSection.style.padding = '80px 20px';
    routeSection.style.borderRadius = '40px 40px 0 0';
    routeSection.style.marginTop = '40px';
    routeSection.style.position = 'relative';
    routeSection.style.overflow = 'hidden';
    routeSection.style.backdropFilter = 'blur(10px)';
    routeSection.style.animationDelay = '0.6s';

    // Background pattern with animation
    const patternBg = document.createElement('div');
    patternBg.style.position = 'absolute';
    patternBg.style.top = '0';
    patternBg.style.left = '0';
    patternBg.style.right = '0';
    patternBg.style.bottom = '0';
    patternBg.style.background = 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2306b6d4\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")';
    patternBg.style.zIndex = '0';
    patternBg.style.animation = 'floatParticles 150s linear infinite reverse';
    
    // Add radial gradient overlay
    const radialOverlay = document.createElement('div');
    radialOverlay.style.position = 'absolute';
    radialOverlay.style.top = '0';
    radialOverlay.style.left = '0';
    radialOverlay.style.right = '0';
    radialOverlay.style.bottom = '0';
    radialOverlay.style.background = 'radial-gradient(circle at 30% 30%, rgba(6, 182, 212, 0.1), transparent 60%), radial-gradient(circle at 70% 70%, rgba(6, 182, 212, 0.1), transparent 60%)';
    radialOverlay.style.zIndex = '0';
    
    const sectionContent = document.createElement('div');
    sectionContent.style.maxWidth = '1200px';
    sectionContent.style.margin = '0 auto';
    sectionContent.style.position = 'relative';
    sectionContent.style.zIndex = '1';

    const sectionTitle = document.createElement('h2');
    sectionTitle.className = 'text-gradient';
    sectionTitle.textContent = this.isAuthenticated ? 'Welcome Back!' : 'Get Started';
    sectionTitle.style.fontSize = '38px';
    sectionTitle.style.fontWeight = '800';
    sectionTitle.style.textAlign = 'center';
    sectionTitle.style.marginBottom = '16px';
    sectionTitle.style.position = 'relative';
    sectionTitle.style.display = 'inline-block';
    sectionTitle.style.left = '50%';
    sectionTitle.style.transform = 'translateX(-50%)';
    sectionTitle.style.background = 'linear-gradient(to right, #ffffff, #06b6d4)';
    sectionTitle.style.WebkitBackgroundClip = 'text';
    sectionTitle.style.WebkitTextFillColor = 'transparent';
    sectionTitle.style.backgroundClip = 'text';
    sectionTitle.style.color = 'transparent';
    
    // Add animated pulse border
    const titleBorder = document.createElement('div');
    titleBorder.style.position = 'absolute';
    titleBorder.style.bottom = '-10px';
    titleBorder.style.left = '50%';
    titleBorder.style.transform = 'translateX(-50%)';
    titleBorder.style.width = '80px';
    titleBorder.style.height = '4px';
    titleBorder.style.background = 'linear-gradient(to right, #06b6d4, #0284c7)';
    titleBorder.style.borderRadius = '2px';
    titleBorder.style.animation = 'pulse 3s infinite';
    sectionTitle.appendChild(titleBorder);

    const sectionSubtitle = document.createElement('p');
    sectionSubtitle.textContent = this.isAuthenticated ? 
      `${this.user?.fullName || 'Member'}, here's where you can access your ${this.isAdmin ? 'admin' : 'member'} features.` : 
      'Join our church financial management system to start your stewardship journey.';
    sectionSubtitle.style.fontSize = '18px';
    sectionSubtitle.style.textAlign = 'center';
    sectionSubtitle.style.color = '#e2e8f0';
    sectionSubtitle.style.maxWidth = '700px';
    sectionSubtitle.style.margin = '25px auto 60px';
    sectionSubtitle.style.lineHeight = '1.6';

    // Create cards container with enhanced styling
    const cardsContainer = document.createElement('div');
    cardsContainer.style.display = 'grid';
    cardsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
    cardsContainer.style.gap = '30px';
    cardsContainer.style.padding = '0 10px';

    // Define route cards based on user status
    let routes = [];
    
    if (this.isAuthenticated) {
      // Add user-specific routes
      if (this.isAdmin) {
        // Admin routes
        routes = [
          {
            title: 'Admin Dashboard',
            description: 'Access comprehensive financial statistics, user management, and church operations in one place.',
            link: '/admin/dashboard',
            icon: '🔍',
            color: '#06b6d4'
          },
          {
            title: 'Manage Payments',
            description: 'Process tithes, offerings, and track all financial transactions with detailed reporting tools.',
            link: '/admin/payments',
            icon: '💸',
            color: '#0891b2'
          },
          {
            title: 'User Management',
            description: 'Add, edit, and manage church members within the financial system with role-based controls.',
            link: '/admin/users',
            icon: '👥',
            color: '#0f766e'
          }
        ];
      } else {
        // Regular user routes
        routes = [
          {
            title: 'My Dashboard',
            description: 'View your complete contribution history, upcoming pledges, and account information.',
            link: '/dashboard',
            icon: '📈',
            color: '#06b6d4'
          },
          {
            title: 'Make a Contribution',
            description: 'Quickly and securely submit your tithes, offerings, and special project donations.',
            link: '/make-payment',
            icon: '💳',
            color: '#0891b2'
          },
          {
            title: 'My Profile',
            description: 'Keep your personal information up-to-date and manage communication preferences.',
            link: '/profile',
            icon: '👤',
            color: '#0f766e'
          }
        ];
      }
    } else {
      // Not authenticated - show general routes
      routes = [
        {
          title: 'Sign In',
          description: 'Access your secure account to track contributions, view receipts, and manage preferences.',
          link: '/login',
          icon: '🔐',
          color: '#06b6d4'
        },
        {
          title: 'Make a Contribution',
          description: 'Give your tithes and offerings securely as a guest or registered member.',
          link: '/make-payment',
          icon: '💳',
          color: '#0891b2'
        },
        {
          title: 'Contact Us',
          description: 'Reach out to the church treasury for assistance with financial matters or inquiries.',
          link: '/contact',
          icon: '✉️',
          color: '#0f766e'
        }
      ];
    }

    // Create route cards with enhanced visual effects
    routes.forEach((route, index) => {
      const card = this.createRouteCard(route, index);
      cardsContainer.appendChild(card);
    });

    sectionContent.appendChild(sectionTitle);
    sectionContent.appendChild(sectionSubtitle);
    sectionContent.appendChild(cardsContainer);
    
    routeSection.appendChild(patternBg);
    routeSection.appendChild(radialOverlay);
    routeSection.appendChild(sectionContent);

    return routeSection;
  }

  createRouteCard(route, index) {
    const card = document.createElement('div');
    card.className = 'neo-card';
    card.style.height = '100%';
    card.style.position = 'relative';
    card.style.overflow = 'hidden';
    card.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    card.style.animation = 'fadeIn 0.6s forwards';
    card.style.animationDelay = `${0.3 * (index + 1)}s`;
    card.style.opacity = '0';
    card.style.borderRadius = '24px';
    
    // Add glow effect
    const cardGlow = document.createElement('div');
    cardGlow.className = 'card-glow';
    cardGlow.style.background = `radial-gradient(circle at center, ${this.hexToRgba(route.color, 0.3)}, transparent 70%)`;
    card.appendChild(cardGlow);

    // Add hover effects
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-10px) scale(1.02)';
      card.style.boxShadow = '0 30px 60px rgba(0,0,0,0.2), 0 15px 30px rgba(0,0,0,0.1)';
      cardGlow.style.opacity = '0.5';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0) scale(1)';
      card.style.boxShadow = '0 4px 24px -8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 8px 16px -4px rgba(0, 0, 0, 0.2)';
      cardGlow.style.opacity = '0';
    });

    // Add shine effect on hover
    const shine = document.createElement('div');
    shine.className = 'card-shine';
    shine.style.position = 'absolute';
    shine.style.top = '0';
    shine.style.left = '0';
    shine.style.width = '150px';
    shine.style.height = '150px';
    shine.style.background = 'linear-gradient(225deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 50%)';
    shine.style.transform = 'translateX(-100px) translateY(100px) rotate(30deg)';
    shine.style.transition = 'transform 0.6s cubic-bezier(0.33, 1, 0.68, 1)';
    shine.style.zIndex = '0';
    shine.style.pointerEvents = 'none';
    card.appendChild(shine);
    
    card.addEventListener('mouseenter', () => {
      shine.style.transform = 'translateX(350px) translateY(-100px) rotate(30deg)';
    });
    
    card.addEventListener('mouseleave', () => {
      shine.style.transform = 'translateX(-100px) translateY(100px) rotate(30deg)';
    });
    
    // Link with internal padding for better clickable area
    const link = document.createElement('a');
    link.href = route.link;
    link.style.display = 'flex';
    link.style.flexDirection = 'column';
    link.style.padding = '30px 25px';
    link.style.textDecoration = 'none';
    link.style.height = '100%';
    link.style.position = 'relative';
    link.style.zIndex = '1';
    
    // Icon with glowing effect
    const iconContainer = document.createElement('div');
    iconContainer.style.width = '60px';
    iconContainer.style.height = '60px';
    iconContainer.style.borderRadius = '16px';
    iconContainer.style.background = `linear-gradient(135deg, ${this.hexToRgba(route.color, 0.3)}, ${this.hexToRgba(route.color, 0.1)})`;
    iconContainer.style.display = 'flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';
    iconContainer.style.marginBottom = '24px';
    iconContainer.style.fontSize = '28px';
    iconContainer.style.boxShadow = `0 15px 25px ${this.hexToRgba(route.color, 0.15)}`;
    iconContainer.style.border = `1px solid ${this.hexToRgba(route.color, 0.3)}`;
    iconContainer.style.position = 'relative';
    iconContainer.textContent = route.icon;
    
    // Icon glow animation
    const iconGlow = document.createElement('div');
    iconGlow.style.position = 'absolute';
    iconGlow.style.top = '0';
    iconGlow.style.left = '0';
    iconGlow.style.right = '0';
    iconGlow.style.bottom = '0';
    iconGlow.style.borderRadius = '16px';
    iconGlow.style.boxShadow = `0 0 20px ${this.hexToRgba(route.color, 0.4)}`;
    iconGlow.style.animation = 'pulse 3s infinite';
    iconGlow.style.animationDelay = `${index * 0.5}s`;
    iconContainer.appendChild(iconGlow);

    const routeTitle = document.createElement('h3');
    routeTitle.textContent = route.title;
    routeTitle.style.fontSize = '22px';
    routeTitle.style.fontWeight = '700';
    routeTitle.style.marginBottom = '12px';
    routeTitle.style.color = '#ffffff';
    routeTitle.style.textShadow = `0 1px 3px rgba(0, 0, 0, 0.3)`;

    const routeDescription = document.createElement('p');
    routeDescription.textContent = route.description;
    routeDescription.style.fontSize = '16px';
    routeDescription.style.lineHeight = '1.7';
    routeDescription.style.color = '#e2e8f0';
    routeDescription.style.marginBottom = '20px';
    routeDescription.style.flex = '1';

    const routeButton = document.createElement('div');
    routeButton.style.display = 'inline-flex';
    routeButton.style.alignItems = 'center';
    routeButton.style.marginTop = 'auto';
    routeButton.style.color = this.hexToRgba(route.color, 1);
    routeButton.style.fontWeight = '700';
    routeButton.style.fontSize = '16px';
    
    const buttonText = document.createElement('span');
    buttonText.textContent = 'Access Now';
    
    const arrowIcon = document.createElement('span');
    arrowIcon.className = 'arrow';
    arrowIcon.textContent = '→';
    arrowIcon.style.marginLeft = '8px';
    arrowIcon.style.transition = 'all 0.3s ease';
    arrowIcon.style.opacity = '0.7';
    
    routeButton.appendChild(buttonText);
    routeButton.appendChild(arrowIcon);

    link.appendChild(iconContainer);
    link.appendChild(routeTitle);
    link.appendChild(routeDescription);
    link.appendChild(routeButton);
    
    card.appendChild(link);

    // Add micro-interaction to arrow on card hover
    card.addEventListener('mouseenter', () => {
      arrowIcon.style.transform = 'translateX(5px)';
      arrowIcon.style.opacity = '1';
    });
    
    card.addEventListener('mouseleave', () => {
      arrowIcon.style.transform = 'translateX(0)';
      arrowIcon.style.opacity = '0.7';
    });

    return card;
  }

  renderFooter() {
    const footer = document.createElement('footer');
    footer.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(26, 57, 167, 0.9))';
    footer.style.color = 'white';
    footer.style.padding = '80px 20px 40px';
    footer.style.position = 'relative';
    footer.style.overflow = 'hidden';
    footer.style.backdropFilter = 'blur(5px)';

    // Create mesh gradient background
    const gradientMesh = document.createElement('div');
    gradientMesh.style.position = 'absolute';
    gradientMesh.style.top = '0';
    gradientMesh.style.left = '0';
    gradientMesh.style.right = '0';
    gradientMesh.style.bottom = '0';
    gradientMesh.style.opacity = '0.15';
    gradientMesh.style.background = 'radial-gradient(circle at 20% 30%, #06b6d4 0%, transparent 50%), radial-gradient(circle at 80% 70%, #0284c7 0%, transparent 50%)';
    gradientMesh.style.zIndex = '0';
    
    // Add animated particle overlay
    const footerParticles = document.createElement('div');
    footerParticles.style.position = 'absolute';
    footerParticles.style.top = '0';
    footerParticles.style.left = '0';
    footerParticles.style.right = '0';
    footerParticles.style.bottom = '0';
    footerParticles.style.zIndex = '0';
    
    // Create 15 floating particles for the footer
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = `${Math.random() * 6 + 2}px`;
      particle.style.height = `${Math.random() * 6 + 2}px`;
      particle.style.borderRadius = '50%';
      particle.style.background = 'rgba(255, 255, 255, 0.2)';
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animation = `float ${Math.random() * 15 + 10}s ease-in-out infinite`;
      particle.style.animationDelay = `${Math.random() * 5}s`;
      particle.style.opacity = Math.random() * 0.3 + 0.1;
      
      footerParticles.appendChild(particle);
    }
    
    footer.appendChild(gradientMesh);
    footer.appendChild(footerParticles);

    const footerContent = document.createElement('div');
    footerContent.style.maxWidth = '1000px';
    footerContent.style.margin = '0 auto';
    footerContent.style.position = 'relative';
    footerContent.style.zIndex = '1';

    const logoSection = document.createElement('div');
    logoSection.className = 'animated-item';
    logoSection.style.textAlign = 'center';
    logoSection.style.marginBottom = '40px';
    logoSection.style.animationDelay = '0.2s';

    const churchName = document.createElement('h2');
    churchName.className = 'text-gradient';
    churchName.textContent = 'Tassia Central SEVENTH DAY ADVENTISTS Church';
    churchName.style.fontSize = '28px';
    churchName.style.fontWeight = '800';
    churchName.style.marginBottom = '16px';
    churchName.style.display = 'inline-block';
    churchName.style.transform = 'translateZ(0)';
    churchName.style.background = 'linear-gradient(to right, #ffffff, #06b6d4)';
    churchName.style.WebkitBackgroundClip = 'text';
    churchName.style.WebkitTextFillColor = 'transparent';
    churchName.style.backgroundClip = 'text';
    churchName.style.color = 'transparent';

    const tagline = document.createElement('p');
    tagline.textContent = 'Faithful in Stewardship, Growing in Faith';
    tagline.style.fontSize = '16px';
    tagline.style.marginBottom = '32px';
    tagline.style.opacity = '0.8';
    tagline.style.maxWidth = '500px';
    tagline.style.margin = '0 auto 32px';

    logoSection.appendChild(churchName);
    logoSection.appendChild(tagline);

    const linksSection = document.createElement('div');
    linksSection.style.display = 'flex';
    linksSection.style.justifyContent = 'center';
    linksSection.style.gap = '40px';
    linksSection.style.marginBottom = '50px';
    linksSection.style.flexWrap = 'wrap';

    // Navigation links
    const links = [
      { text: 'Home', href: '/' },
      { text: 'About', href: '/about' },
      { text: 'Contact', href: '/contact' },
      { text: 'Make Payment', href: '/make-payment' }
    ];

    links.forEach((link, index) => {
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.className = 'animated-item';
      anchor.textContent = link.text;
      anchor.style.color = 'white';
      anchor.style.opacity = '0.8';
      anchor.style.textDecoration = 'none';
      anchor.style.transition = 'all 0.3s ease';
      anchor.style.fontSize = '16px';
      anchor.style.fontWeight = '500';
      anchor.style.position = 'relative';
      anchor.style.animationDelay = `${0.1 * (index + 1)}s`;
      
      // Enhance with animated underline
      const underline = document.createElement('span');
      underline.className = 'link-underline';
      underline.style.position = 'absolute';
      underline.style.bottom = '-5px';
      underline.style.left = '0';
      underline.style.width = '0%';
      underline.style.height = '2px';
      underline.style.background = 'linear-gradient(to right, #ffffff, #06b6d4)';
      underline.style.transition = 'all 0.3s ease';
      underline.style.opacity = '0';
      
      anchor.addEventListener('mouseenter', () => {
        anchor.style.opacity = '1';
        underline.style.width = '100%';
        underline.style.opacity = '1';
      });
      
      anchor.addEventListener('mouseleave', () => {
        anchor.style.opacity = '0.8';
        underline.style.width = '0%';
        underline.style.opacity = '0';
      });
      
      anchor.appendChild(underline);
      linksSection.appendChild(anchor);
    });
    
    // Enhanced copyright section with animated border
    const copyright = document.createElement('div');
    copyright.style.fontSize = '14px';
    copyright.style.opacity = '0.6';
    copyright.style.textAlign = 'center';
    copyright.style.marginTop = '30px';
    copyright.style.padding = '20px 0 0';
    copyright.style.position = 'relative';
    
    // Animated gradient border
    const copyrightBorder = document.createElement('div');
    copyrightBorder.style.position = 'absolute';
    copyrightBorder.style.top = '0';
    copyrightBorder.style.left = '20%';
    copyrightBorder.style.right = '20%';
    copyrightBorder.style.height = '1px';
    copyrightBorder.style.background = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)';
    copyrightBorder.style.animation = 'shimmer 3s infinite';
    
    // Add shimmer animation
    const shimmerStyle = document.createElement('style');
    shimmerStyle.textContent = `
      @keyframes shimmer {
        0% { background-position: -500px 0; }
        100% { background-position: 500px 0; }
      }
    `;
    document.head.appendChild(shimmerStyle);
    
    copyright.appendChild(copyrightBorder);

    const copyrightText = document.createElement('p');
    copyrightText.textContent = `© ${new Date().getFullYear()} Tassia Central SEVENTH DAY ADVENTIST Church. All rights reserved.`;
    
    copyright.appendChild(copyrightText);

    footerContent.appendChild(logoSection);
    footerContent.appendChild(linksSection);
    footerContent.appendChild(copyright);
    footer.appendChild(footerContent);

    return footer;
  }

  // Helper function to convert hex to rgba
  hexToRgba(hex, alpha) {
    if (!hex) return 'rgba(0, 0, 0, ' + alpha + ')';
    
    hex = hex.replace('#', '');
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}