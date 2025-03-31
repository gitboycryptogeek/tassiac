// src/views/help.js
import { FuturisticStyles } from '../utils/futuristicStyles.js';

export class HelpView {
  constructor() {
    this.title = 'Help Center';
    this.authService = window.authService;
    this.activeTab = 'general';
    this.activeFaq = null;
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
      
      // Header with search functionality
      const header = this.createHeader();
      container.appendChild(header);
      
      // Main content
      const content = document.createElement('div');
      content.style.marginTop = '50px';
      
      // Tab navigation
      const tabNav = this.createTabNavigation();
      content.appendChild(tabNav);
      
      // FAQ sections based on active tab
      const faqSection = this.createFaqSection();
      content.appendChild(faqSection);
      
      // Contact support section
      const supportSection = this.createSupportSection();
      content.appendChild(supportSection);
      
      container.appendChild(content);
      
    } catch (error) {
      console.error('Error rendering Help view:', error);
      
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
    headerGlow.style.background = 'radial-gradient(circle at top right, rgba(139, 92, 246, 0.4), transparent 70%)';
    header.appendChild(headerGlow);
    
    // Decorative elements
    const circle1 = document.createElement('div');
    circle1.style.position = 'absolute';
    circle1.style.top = '-50px';
    circle1.style.right = '-50px';
    circle1.style.width = '200px';
    circle1.style.height = '200px';
    circle1.style.borderRadius = '50%';
    circle1.style.background = 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, rgba(0, 0, 0, 0) 70%)';
    circle1.style.pointerEvents = 'none';
    
    const circle2 = document.createElement('div');
    circle2.style.position = 'absolute';
    circle2.style.bottom = '-30px';
    circle2.style.left = '-30px';
    circle2.style.width = '150px';
    circle2.style.height = '150px';
    circle2.style.borderRadius = '50%';
    circle2.style.background = 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(0, 0, 0, 0) 70%)';
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
    subtitle.textContent = 'Find answers to your questions';
    subtitle.style.fontSize = '20px';
    subtitle.style.color = '#94a3b8';
    subtitle.style.margin = '0 0 30px 0';
    subtitle.style.maxWidth = '600px';
    subtitle.style.margin = '0 auto 40px';
    
    // Search bar with futuristic styling
    const searchContainer = document.createElement('div');
    searchContainer.style.maxWidth = '600px';
    searchContainer.style.margin = '0 auto';
    searchContainer.style.position = 'relative';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search for help topics...';
    searchInput.className = 'futuristic-input';
    searchInput.style.padding = '16px 60px 16px 20px';
    searchInput.style.borderRadius = '20px';
    searchInput.style.fontSize = '16px';
    
    // Animated search icon
    const searchIcon = document.createElement('div');
    searchIcon.textContent = '🔍';
    searchIcon.style.position = 'absolute';
    searchIcon.style.right = '20px';
    searchIcon.style.top = '50%';
    searchIcon.style.transform = 'translateY(-50%)';
    searchIcon.style.fontSize = '20px';
    searchIcon.style.cursor = 'pointer';
    searchIcon.style.transition = 'all 0.3s ease';
    
    // Add icon animation
    searchIcon.addEventListener('click', () => {
      // Pulse effect
      searchIcon.style.transform = 'translateY(-50%) scale(1.2)';
      setTimeout(() => {
        searchIcon.style.transform = 'translateY(-50%) scale(1)';
      }, 200);
      
      // Trigger search (placeholder for now)
      console.log('Search:', searchInput.value);
    });
    
    // Add input animation
    searchInput.addEventListener('focus', () => {
      searchInput.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.3)';
    });
    
    searchInput.addEventListener('blur', () => {
      searchInput.style.boxShadow = '';
    });
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchIcon);
    
    header.appendChild(title);
    header.appendChild(subtitle);
    header.appendChild(searchContainer);
    
    return header;
  }
  
  createTabNavigation() {
    const tabNav = document.createElement('div');
    tabNav.className = 'neo-card';
    tabNav.style.marginBottom = '40px';
    tabNav.style.padding = '8px';
    tabNav.style.display = 'flex';
    tabNav.style.flexWrap = 'wrap';
    tabNav.style.justifyContent = 'center';
    tabNav.style.gap = '10px';
    tabNav.style.position = 'relative';
    tabNav.style.zIndex = '2';
    
    // Add glow to active tab
    const tabGlow = document.createElement('div');
    tabGlow.className = 'card-glow';
    tabGlow.style.background = 'radial-gradient(circle at center, rgba(139, 92, 246, 0.3), transparent 70%)';
    tabNav.appendChild(tabGlow);
    
    const tabs = [
      { id: 'general', label: 'General' },
      { id: 'accounts', label: 'Accounts & Login' },
      { id: 'payments', label: 'Payments & Offerings' },
      { id: 'receipts', label: 'Receipts & Records' }
    ];
    
    if (this.authService && this.authService.isAdmin()) {
      tabs.push({ id: 'admin', label: 'Admin Functions' });
    }
    
    tabs.forEach(tab => {
      const tabButton = document.createElement('button');
      tabButton.id = `tab-${tab.id}`;
      tabButton.textContent = tab.label;
      tabButton.style.padding = '14px 22px';
      tabButton.style.backgroundColor = this.activeTab === tab.id ? 
        'rgba(139, 92, 246, 0.2)' : 'rgba(30, 41, 59, 0.4)';
      tabButton.style.borderRadius = '12px';
      tabButton.style.border = this.activeTab === tab.id ? 
        '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(148, 163, 184, 0.1)';
      tabButton.style.color = this.activeTab === tab.id ? 
        '#ffffff' : '#94a3b8';
      tabButton.style.fontWeight = this.activeTab === tab.id ? '600' : '500';
      tabButton.style.fontSize = '15px';
      tabButton.style.cursor = 'pointer';
      tabButton.style.transition = 'all 0.3s ease';
      tabButton.style.backdropFilter = 'blur(8px)';
      tabButton.style.boxShadow = this.activeTab === tab.id ?
        '0 8px 16px rgba(0, 0, 0, 0.1)' : 'none';
      tabButton.style.transform = this.activeTab === tab.id ?
        'translateY(-2px)' : 'translateY(0)';
      
      // Add hover effect
      tabButton.addEventListener('mouseenter', () => {
        if (this.activeTab !== tab.id) {
          tabButton.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
          tabButton.style.color = '#e2e8f0';
          tabButton.style.transform = 'translateY(-2px)';
        }
      });
      
      tabButton.addEventListener('mouseleave', () => {
        if (this.activeTab !== tab.id) {
          tabButton.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
          tabButton.style.color = '#94a3b8';
          tabButton.style.transform = 'translateY(0)';
        }
      });
      
      tabButton.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.updateView();
      });
      
      tabNav.appendChild(tabButton);
    });
    
    return tabNav;
  }
  
  createFaqSection() {
    const faqSection = document.createElement('div');
    faqSection.className = 'animated-item';
    faqSection.style.animationDelay = '0.3s';
    
    // FAQ data
    const faqData = {
      general: [
        {
          question: 'What is TASSIAC Church?',
          answer: 'TASSIAC Church is a community of believers dedicated to spreading the message of love, hope, and salvation. Our mission is to create a welcoming environment where people can grow in their faith, develop meaningful relationships, and make a positive impact in the world around them.'
        },
        {
          question: 'When are your service times?',
          answer: 'Our main services are held every Sunday at 9:00 AM and 11:00 AM. We also have Wednesday evening prayer meetings at 7:00 PM and various ministry activities throughout the week. Please check our calendar for specific events and times.'
        },
        {
          question: 'Where are you located?',
          answer: 'Our main campus is located at 123 Church Street, Nairobi, Kenya. We also have satellite locations in surrounding communities. You can find directions and more information on our Contact page.'
        },
        {
          question: 'What should I expect when I visit?',
          answer: 'You can expect a warm welcome, inspiring worship, and practical teaching from the Bible. Our services typically last about 90 minutes. We have programs for children of all ages during the service. Dress is casual - just come as you are!'
        },
        {
          question: 'How can I get involved in the church?',
          answer: 'There are many ways to get involved! You can join a small group, volunteer in one of our ministries, attend our events, or participate in our outreach programs. Visit our Welcome Desk after the service or contact our office for more information.'
        }
      ],
      accounts: [
        {
          question: 'How do I create an account?',
          answer: 'Accounts are created by our church administrators. Please speak to a church official or contact the church office to have an account created for you.'
        },
        {
          question: 'I forgot my password. How do I reset it?',
          answer: 'If you forgot your password, click on the "Forgot Password" link on the login page. You\'ll receive an email with instructions to reset your password. If you don\'t receive the email, please contact our support team.'
        },
        {
          question: 'How do I update my personal information?',
          answer: 'You can update your personal information by logging into your account and going to the Profile page. From there, you can edit your contact details, address, and other information.'
        },
        {
          question: 'Is my personal information secure?',
          answer: 'Yes, we take data security very seriously. All personal information is encrypted and stored securely. We do not share your information with third parties without your consent.'
        },
        {
          question: 'Can I have multiple accounts for my family?',
          answer: 'Each church member should have their own individual account for accurate record-keeping. Family members aged 18 and above should have separate accounts. Children\'s contributions are typically recorded under a parent\'s account.'
        }
      ],
      payments: [
        {
          question: 'What payment methods are accepted?',
          answer: 'We currently accept M-Pesa and manual cash payments. Each payment method is securely processed and recorded in our system.'
        },
        {
          question: 'How do I make a tithe or offering payment?',
          answer: 'To make a payment, log into your account and go to the "Make Payment" page. Select the payment type (tithe, offering, donation, etc.), enter the amount, and choose your payment method. Follow the instructions to complete the transaction.'
        },
        {
          question: 'What is the difference between tithes and offerings?',
          answer: 'Tithes represent 10% of your income given to support the church\'s operations. Offerings are additional voluntary gifts beyond the tithe, which can be designated for special purposes or ministries.'
        },
        {
          question: 'What are special offerings?',
          answer: 'Special offerings are collections for specific projects or needs, such as building funds, mission trips, or community outreach programs. These are temporary campaigns with specific goals and end dates.'
        },
        {
          question: 'Are my contributions tax-deductible?',
          answer: 'Yes, all tithes and offerings are tax-deductible to the extent allowed by law. You will receive an annual giving statement for tax purposes. Please consult with a tax professional for advice on your specific situation.'
        }
      ],
      receipts: [
        {
          question: 'How do I view my contribution receipts?',
          answer: 'You can view your contribution receipts by logging into your account and going to the "Receipts" page. From there, you can view, download, or print your receipts.'
        },
        {
          question: 'Can I get a year-end giving statement?',
          answer: 'Yes, year-end giving statements are automatically generated and available in January for the previous year. You can access them on the "Receipts" page of your account.'
        },
        {
          question: 'How long are my receipt records kept?',
          answer: 'We maintain receipt records for a minimum of 7 years for auditing and tax purposes. However, you can access your complete contribution history as long as you have an active account.'
        },
        {
          question: 'What if I find an error on my receipt?',
          answer: 'If you find an error on your receipt, please contact our finance department immediately. Provide the receipt number and details of the error, and we will investigate and correct it as needed.'
        },
        {
          question: 'Can I download my receipts as PDF files?',
          answer: 'Yes, all receipts can be downloaded as PDF files for your records. Simply click the "Download PDF" button next to the receipt you want to save.'
        }
      ],
      admin: [
        {
          question: 'How do I add a new user to the system?',
          answer: 'As an administrator, you can add new users by going to the "Users" page in the admin dashboard and clicking the "+ Add New User" button. Fill in the required information and click "Create User".'
        },
        {
          question: 'How do I record manual payments?',
          answer: 'To record manual payments, go to the "Add Payment" page in the admin dashboard. Select the user, enter the payment details, and click "Add Payment". The system will generate a receipt automatically.'
        },
        {
          question: 'Can I edit or delete payment records?',
          answer: 'Editing payments is limited to protect financial integrity. You can add notes or make minor corrections. Deleting payments requires multiple admin approvals. These actions are logged for audit purposes.'
        },
        {
          question: 'How do I create a special offering campaign?',
          answer: 'To create a special offering campaign, go to the "Add Payment" page, select "Special Offering" as the payment type, and fill in the details including the campaign name, target goal, and end date.'
        },
        {
          question: 'How does the multi-admin approval system work?',
          answer: 'For sensitive actions like deleting records, the system requires approval from multiple administrators to prevent mistakes and ensure accountability. Each admin must verify their credentials to approve the action.'
        }
      ]
    };
    
    // Create FAQ accordion with futuristic styling
    const faqContainer = document.createElement('div');
    faqContainer.className = 'neo-card';
    faqContainer.style.padding = '10px';
    
    // Add shimmer effect to simulate data loading (even though data is already loaded)
    const shimmerEffect = document.createElement('div');
    shimmerEffect.style.position = 'absolute';
    shimmerEffect.style.top = '0';
    shimmerEffect.style.left = '-100%';
    shimmerEffect.style.width = '50%';
    shimmerEffect.style.height = '100%';
    shimmerEffect.style.background = 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent)';
    shimmerEffect.style.animation = 'shimmer 2s ease-out forwards';
    shimmerEffect.style.zIndex = '0';
    faqContainer.appendChild(shimmerEffect);
    
    // Add shimmer animation
    const shimmerStyle = document.createElement('style');
    shimmerStyle.textContent = `
      @keyframes shimmer {
        0% { transform: translateX(0%); }
        100% { transform: translateX(400%); }
      }
    `;
    document.head.appendChild(shimmerStyle);
    
    const faqs = faqData[this.activeTab] || [];
    
    faqs.forEach((faq, index) => {
      const faqItem = document.createElement('div');
      faqItem.style.marginBottom = '10px';
      faqItem.style.borderRadius = '12px';
      faqItem.style.overflow = 'hidden';
      faqItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      faqItem.style.transition = 'all 0.3s ease';
      faqItem.style.border = '1px solid rgba(148, 163, 184, 0.1)';
      faqItem.style.animation = 'fadeIn 0.6s forwards';
      faqItem.style.animationDelay = `${0.1 * (index + 1)}s`;
      faqItem.style.opacity = '0';
      
      // Hover effect
      faqItem.addEventListener('mouseenter', () => {
        faqItem.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
        faqItem.style.transform = 'translateY(-2px)';
      });
      
      faqItem.addEventListener('mouseleave', () => {
        faqItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        faqItem.style.transform = 'translateY(0)';
      });
      
      // Question header with futuristic styling
      const questionHeader = document.createElement('div');
      questionHeader.style.padding = '18px 24px';
      questionHeader.style.background = this.activeFaq === index ? 
        'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))' : 
        'rgba(30, 41, 59, 0.4)';
      questionHeader.style.display = 'flex';
      questionHeader.style.justifyContent = 'space-between';
      questionHeader.style.alignItems = 'center';
      questionHeader.style.cursor = 'pointer';
      questionHeader.style.userSelect = 'none';
      questionHeader.style.transition = 'all 0.3s ease';
      questionHeader.style.backdropFilter = 'blur(8px)';
      questionHeader.style.borderBottom = this.activeFaq === index ?
        '1px solid rgba(139, 92, 246, 0.2)' : 'none';
      
      const questionText = document.createElement('h3');
      questionText.textContent = faq.question;
      questionText.style.margin = '0';
      questionText.style.fontSize = '17px';
      questionText.style.fontWeight = '600';
      questionText.style.color = this.activeFaq === index ? '#ffffff' : '#e2e8f0';
      
      // Fancy toggle icon
      const toggleIconContainer = document.createElement('div');
      toggleIconContainer.style.width = '24px';
      toggleIconContainer.style.height = '24px';
      toggleIconContainer.style.borderRadius = '50%';
      toggleIconContainer.style.display = 'flex';
      toggleIconContainer.style.alignItems = 'center';
      toggleIconContainer.style.justifyContent = 'center';
      toggleIconContainer.style.background = this.activeFaq === index ?
        'rgba(139, 92, 246, 0.3)' : 'rgba(148, 163, 184, 0.1)';
      toggleIconContainer.style.transition = 'all 0.3s ease';
      
      const toggleIcon = document.createElement('span');
      toggleIcon.textContent = this.activeFaq === index ? '−' : '+';
      toggleIcon.style.fontSize = '18px';
      toggleIcon.style.fontWeight = 'bold';
      toggleIcon.style.color = this.activeFaq === index ? '#ffffff' : '#94a3b8';
      toggleIcon.style.lineHeight = '1';
      toggleIcon.style.display = 'block';
      toggleIcon.style.transition = 'all 0.3s ease';
      
      toggleIconContainer.appendChild(toggleIcon);
      
      questionHeader.appendChild(questionText);
      questionHeader.appendChild(toggleIconContainer);
      
      // Answer container with smooth animation
      const answerContainer = document.createElement('div');
      answerContainer.style.background = 'rgba(15, 23, 42, 0.3)';
      answerContainer.style.backdropFilter = 'blur(8px)';
      answerContainer.style.overflow = 'hidden';
      answerContainer.style.maxHeight = this.activeFaq === index ? '500px' : '0';
      answerContainer.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      
      const answerContent = document.createElement('div');
      answerContent.style.padding = '20px 24px';
      
      const answerText = document.createElement('p');
      answerText.textContent = faq.answer;
      answerText.style.margin = '0';
      answerText.style.fontSize = '16px';
      answerText.style.lineHeight = '1.7';
      answerText.style.color = '#e2e8f0';
      
      answerContent.appendChild(answerText);
      answerContainer.appendChild(answerContent);
      
      // Toggle FAQ on click
      questionHeader.addEventListener('click', () => {
        this.activeFaq = this.activeFaq === index ? null : index;
        this.updateView();
      });
      
      faqItem.appendChild(questionHeader);
      faqItem.appendChild(answerContainer);
      
      faqContainer.appendChild(faqItem);
    });
    
    faqSection.appendChild(faqContainer);
    
    return faqSection;
  }
  
  createSupportSection() {
    const supportSection = document.createElement('div');
    supportSection.className = 'neo-card animated-item';
    supportSection.style.marginTop = '40px';
    supportSection.style.padding = '40px 30px';
    supportSection.style.textAlign = 'center';
    supportSection.style.position = 'relative';
    supportSection.style.overflow = 'hidden';
    supportSection.style.animationDelay = '0.5s';
    
    // Add glow effect
    const supportGlow = document.createElement('div');
    supportGlow.className = 'card-glow';
    supportGlow.style.background = 'radial-gradient(circle at center, rgba(16, 185, 129, 0.3), transparent 70%)';
    supportSection.appendChild(supportGlow);
    
    // Add futuristic background pattern
    const patternOverlay = document.createElement('div');
    patternOverlay.style.position = 'absolute';
    patternOverlay.style.top = '0';
    patternOverlay.style.left = '0';
    patternOverlay.style.right = '0';
    patternOverlay.style.bottom = '0';
    patternOverlay.style.background = 'radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.05) 0%, transparent 50%)';
    patternOverlay.style.zIndex = '0';
    supportSection.appendChild(patternOverlay);
    
    // Holographic icon
    const supportIcon = document.createElement('div');
    supportIcon.style.width = '80px';
    supportIcon.style.height = '80px';
    supportIcon.style.borderRadius = '20px';
    supportIcon.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))';
    supportIcon.style.display = 'flex';
    supportIcon.style.alignItems = 'center';
    supportIcon.style.justifyContent = 'center';
    supportIcon.style.margin = '0 auto 24px';
    supportIcon.style.fontSize = '36px';
    supportIcon.style.position = 'relative';
    supportIcon.style.zIndex = '1';
    supportIcon.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.3)';
    supportIcon.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    supportIcon.textContent = '🙋‍♂️';
    
    // Holographic pulse effect
    const iconPulse = document.createElement('div');
    iconPulse.style.position = 'absolute';
    iconPulse.style.top = '0';
    iconPulse.style.left = '0';
    iconPulse.style.width = '100%';
    iconPulse.style.height = '100%';
    iconPulse.style.borderRadius = '20px';
    iconPulse.style.boxShadow = '0 0 0 rgba(16, 185, 129, 0.4)';
    iconPulse.style.animation = 'supportPulse 2s infinite';
    
    // Add pulse animation
    const pulseStyle = document.createElement('style');
    pulseStyle.textContent = `
      @keyframes supportPulse {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }
    `;
    document.head.appendChild(pulseStyle);
    
    supportIcon.appendChild(iconPulse);
    
    const supportTitle = document.createElement('h2');
    supportTitle.className = 'text-gradient';
    supportTitle.textContent = 'Still need help?';
    supportTitle.style.margin = '0 0 16px';
    supportTitle.style.fontSize = '28px';
    supportTitle.style.fontWeight = '700';
    supportTitle.style.position = 'relative';
    supportTitle.style.zIndex = '1';
    
    const supportText = document.createElement('p');
    supportText.textContent = 'If you couldn\'t find the answer to your question, our support team is here to help.';
    supportText.style.margin = '0 0 30px';
    supportText.style.fontSize = '17px';
    supportText.style.color = '#e2e8f0';
    supportText.style.maxWidth = '500px';
    supportText.style.margin = '0 auto 30px';
    supportText.style.position = 'relative';
    supportText.style.zIndex = '1';
    
    const contactButton = document.createElement('a');
    contactButton.href = '/contact';
    contactButton.textContent = 'Contact Support';
    contactButton.className = 'futuristic-button';
    contactButton.style.display = 'inline-block';
    contactButton.style.padding = '14px 30px';
    contactButton.style.fontSize = '16px';
    contactButton.style.fontWeight = '600';
    contactButton.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))';
    contactButton.style.position = 'relative';
    contactButton.style.zIndex = '1';
    contactButton.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    
    supportSection.appendChild(supportIcon);
    supportSection.appendChild(supportTitle);
    supportSection.appendChild(supportText);
    supportSection.appendChild(contactButton);
    
    return supportSection;
  }
  
  updateView() {
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = '';
      appContainer.appendChild(this.render());
    }
  }
}