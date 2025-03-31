// src/views/about.js
import { FuturisticStyles } from '../utils/futuristicStyles.js';

export class AboutView {
  constructor() {
    this.title = 'About Us';
  }
  
  render() {
    // Apply futuristic styles
    FuturisticStyles.addGlobalStyles();
    FuturisticStyles.addBackgroundEffects();
    
    const container = document.createElement('div');
    
    try {
      // Main container styling for futuristic theme
      container.style.maxWidth = '1200px';
      container.style.margin = '0 auto';
      container.style.padding = '60px 24px';
      container.style.position = 'relative';
      container.style.zIndex = '1';
      
      // Header section with glowing accents
      const header = this.createHeader();
      container.appendChild(header);
      
      // Main content with animated sections
      const content = document.createElement('div');
      content.style.position = 'relative';
      
      // Mission section with neo-morphic design
      const missionSection = this.createMissionSection();
      content.appendChild(missionSection);
      
      // Values section with hoverable cards
      const valuesSection = this.createValuesSection();
      content.appendChild(valuesSection);
      
      // History section with timeline design
      const historySection = this.createHistorySection();
      content.appendChild(historySection);
      
      // Leadership section with holographic profiles
      const leadershipSection = this.createLeadershipSection();
      content.appendChild(leadershipSection);
      
      container.appendChild(content);
      
    } catch (error) {
      console.error('Error rendering About view:', error);
      
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
    header.style.marginBottom = '60px';
    header.style.padding = '40px';
    header.style.textAlign = 'center';
    header.style.position = 'relative';
    header.style.overflow = 'hidden';
    
    // Add glow effect
    const headerGlow = document.createElement('div');
    headerGlow.className = 'card-glow';
    headerGlow.style.background = 'radial-gradient(circle at top right, rgba(74, 109, 167, 0.4), transparent 70%)';
    header.appendChild(headerGlow);
    
    // Decorative elements
    const circle1 = document.createElement('div');
    circle1.style.position = 'absolute';
    circle1.style.top = '-50px';
    circle1.style.right = '-50px';
    circle1.style.width = '200px';
    circle1.style.height = '200px';
    circle1.style.borderRadius = '50%';
    circle1.style.background = 'radial-gradient(circle, rgba(74, 109, 167, 0.2) 0%, rgba(0, 0, 0, 0) 70%)';
    circle1.style.pointerEvents = 'none';
    
    const circle2 = document.createElement('div');
    circle2.style.position = 'absolute';
    circle2.style.bottom = '-30px';
    circle2.style.left = '-30px';
    circle2.style.width = '150px';
    circle2.style.height = '150px';
    circle2.style.borderRadius = '50%';
    circle2.style.background = 'radial-gradient(circle, rgba(74, 109, 167, 0.15) 0%, rgba(0, 0, 0, 0) 70%)';
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
    subtitle.textContent = 'Transforming lives through faith and community';
    subtitle.style.fontSize = '20px';
    subtitle.style.color = '#94a3b8';
    subtitle.style.margin = '0';
    subtitle.style.maxWidth = '700px';
    subtitle.style.margin = '0 auto';
    
    header.appendChild(title);
    header.appendChild(subtitle);
    
    return header;
  }
  
  createMissionSection() {
    const missionSection = document.createElement('section');
    missionSection.className = 'animated-item';
    missionSection.style.marginBottom = '60px';
    missionSection.style.animationDelay = '0.2s';
    
    const missionCard = document.createElement('div');
    missionCard.className = 'neo-card';
    missionCard.style.overflow = 'hidden';
    missionCard.style.position = 'relative';
    
    // Header
    const missionHeader = document.createElement('div');
    missionHeader.style.background = 'linear-gradient(135deg, rgba(74, 109, 167, 0.2), rgba(74, 109, 167, 0.1))';
    missionHeader.style.padding = '30px';
    missionHeader.style.position = 'relative';
    missionHeader.style.overflow = 'hidden';
    missionHeader.style.borderBottom = '1px solid rgba(148, 163, 184, 0.1)';
    
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
    missionHeader.appendChild(headerShine);
    
    // Add shine animation
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      @keyframes shine {
        0% { transform: translateX(-100%); }
        20%, 100% { transform: translateX(100%); }
      }
    `;
    document.head.appendChild(styleEl);
    
    const missionTitle = document.createElement('h2');
    missionTitle.className = 'text-gradient';
    missionTitle.textContent = 'Our Mission';
    missionTitle.style.margin = '0';
    missionTitle.style.fontSize = '32px';
    missionTitle.style.fontWeight = '700';
    missionTitle.style.position = 'relative';
    missionTitle.style.zIndex = '1';
    
    missionHeader.appendChild(missionTitle);
    
    // Body
    const missionBody = document.createElement('div');
    missionBody.style.padding = '30px';
    missionBody.style.position = 'relative';
    
    const missionText = document.createElement('p');
    missionText.textContent = 'TASSIAC Church is dedicated to spreading the message of love, hope, and salvation. Our mission is to create a welcoming community where people can grow in their faith, develop meaningful relationships, and make a positive impact in the world around them.';
    missionText.style.fontSize = '17px';
    missionText.style.lineHeight = '1.8';
    missionText.style.color = '#e2e8f0';
    missionText.style.margin = '0';
    
    missionBody.appendChild(missionText);
    
    missionCard.appendChild(missionHeader);
    missionCard.appendChild(missionBody);
    missionSection.appendChild(missionCard);
    
    return missionSection;
  }
  
  createValuesSection() {
    const valuesSection = document.createElement('section');
    valuesSection.className = 'animated-item';
    valuesSection.style.marginBottom = '60px';
    valuesSection.style.animationDelay = '0.4s';
    
    const valuesHeading = document.createElement('h2');
    valuesHeading.className = 'text-gradient';
    valuesHeading.textContent = 'Our Values';
    valuesHeading.style.fontSize = '32px';
    valuesHeading.style.fontWeight = '700';
    valuesHeading.style.marginBottom = '30px';
    valuesHeading.style.textAlign = 'center';
    
    valuesSection.appendChild(valuesHeading);
    
    const valuesGrid = document.createElement('div');
    valuesGrid.style.display = 'grid';
    valuesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    valuesGrid.style.gap = '30px';
    
    const values = [
      {
        title: 'Faith',
        description: 'We believe in a personal relationship with God through Jesus Christ and the guidance of the Holy Spirit.',
        color: '#4a6da7'
      },
      {
        title: 'Community',
        description: 'We foster genuine relationships built on love, respect, and mutual support.',
        color: '#5d8a3e'
      },
      {
        title: 'Service',
        description: 'We are committed to serving others and making a positive impact in our local and global communities.',
        color: '#a05195'
      },
      {
        title: 'Growth',
        description: 'We encourage continuous spiritual growth and personal development through Bible study, prayer, and discipleship.',
        color: '#ff7c43'
      }
    ];
    
    values.forEach((value, index) => {
      const valueCard = document.createElement('div');
      valueCard.className = 'neo-card';
      valueCard.style.overflow = 'hidden';
      valueCard.style.transition = 'transform 0.3s, box-shadow 0.3s';
      valueCard.style.cursor = 'pointer';
      valueCard.style.animation = 'fadeIn 0.6s forwards';
      valueCard.style.animationDelay = `${0.2 * (index + 1)}s`;
      valueCard.style.opacity = '0';
      
      // Add hover effect
      valueCard.addEventListener('mouseenter', () => {
        valueCard.style.transform = 'translateY(-10px)';
        valueCard.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.2)';
      });
      
      valueCard.addEventListener('mouseleave', () => {
        valueCard.style.transform = 'translateY(0)';
        valueCard.style.boxShadow = '0 4px 24px -8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 8px 16px -4px rgba(0, 0, 0, 0.2)';
      });
      
      const valueHeader = document.createElement('div');
      valueHeader.style.backgroundColor = this.hexToRgba(value.color, 0.2);
      valueHeader.style.padding = '20px 25px';
      valueHeader.style.color = 'white';
      valueHeader.style.borderBottom = `1px solid ${this.hexToRgba(value.color, 0.3)}`;
      
      const valueTitle = document.createElement('h3');
      valueTitle.textContent = value.title;
      valueTitle.style.margin = '0';
      valueTitle.style.fontSize = '22px';
      valueTitle.style.fontWeight = '700';
      valueTitle.style.color = this.hexToRgba(value.color, 1);
      valueTitle.style.textShadow = `0 2px 8px ${this.hexToRgba(value.color, 0.3)}`;
      
      valueHeader.appendChild(valueTitle);
      
      const valueBody = document.createElement('div');
      valueBody.style.padding = '25px';
      valueBody.style.height = '180px';
      valueBody.style.display = 'flex';
      valueBody.style.flexDirection = 'column';
      valueBody.style.justifyContent = 'center';
      
      const valueDescription = document.createElement('p');
      valueDescription.textContent = value.description;
      valueDescription.style.fontSize = '16px';
      valueDescription.style.lineHeight = '1.7';
      valueDescription.style.color = '#e2e8f0';
      valueDescription.style.margin = '0';
      
      valueBody.appendChild(valueDescription);
      
      // Add glowing circle in the background
      const glowCircle = document.createElement('div');
      glowCircle.style.position = 'absolute';
      glowCircle.style.bottom = '-40px';
      glowCircle.style.right = '-40px';
      glowCircle.style.width = '120px';
      glowCircle.style.height = '120px';
      glowCircle.style.borderRadius = '50%';
      glowCircle.style.background = `radial-gradient(circle, ${this.hexToRgba(value.color, 0.15)} 0%, rgba(0, 0, 0, 0) 70%)`;
      glowCircle.style.pointerEvents = 'none';
      glowCircle.style.zIndex = '0';
      
      valueCard.appendChild(valueHeader);
      valueCard.appendChild(valueBody);
      valueCard.appendChild(glowCircle);
      
      valuesGrid.appendChild(valueCard);
    });
    
    valuesSection.appendChild(valuesGrid);
    
    return valuesSection;
  }
  
  createHistorySection() {
    const historySection = document.createElement('section');
    historySection.className = 'animated-item neo-card';
    historySection.style.marginBottom = '60px';
    historySection.style.padding = '40px';
    historySection.style.animationDelay = '0.6s';
    historySection.style.position = 'relative';
    historySection.style.overflow = 'hidden';
    
    // Add glow effect
    const historyGlow = document.createElement('div');
    historyGlow.className = 'card-glow';
    historyGlow.style.background = 'radial-gradient(circle at bottom left, rgba(6, 182, 212, 0.2), transparent 70%)';
    historySection.appendChild(historyGlow);
    
    const historyHeading = document.createElement('h2');
    historyHeading.className = 'text-gradient';
    historyHeading.textContent = 'Our History';
    historyHeading.style.fontSize = '32px';
    historyHeading.style.fontWeight = '700';
    historyHeading.style.marginBottom = '30px';
    
    const historyContent = document.createElement('div');
    historyContent.style.display = 'flex';
    historyContent.style.flexDirection = 'column';
    historyContent.style.gap = '30px';
    historyContent.style.position = 'relative';
    
    // Timeline line
    const timelineLine = document.createElement('div');
    timelineLine.style.position = 'absolute';
    timelineLine.style.top = '10px';
    timelineLine.style.bottom = '10px';
    timelineLine.style.left = '18px';
    timelineLine.style.width = '2px';
    timelineLine.style.background = 'linear-gradient(to bottom, rgba(74, 109, 167, 0.7), rgba(6, 182, 212, 0.7))';
    timelineLine.style.zIndex = '0';
    historyContent.appendChild(timelineLine);
    
    // Timeline points
    const historyPoints = [
      {
        year: '1995',
        content: 'TASSIAC Church was founded by a small group of believers committed to creating an authentic community of faith. Starting with just 20 members meeting in a local community center, our church has grown steadily over the years.'
      },
      {
        year: '2005',
        content: 'We moved to our current location and have since expanded our facilities to accommodate our growing congregation and various ministries. Throughout our history, we\'ve remained committed to our founding principles while adapting to meet the changing needs of our community.'
      }
    ];
    
    historyPoints.forEach((point, index) => {
      const historyPoint = document.createElement('div');
      historyPoint.style.display = 'flex';
      historyPoint.style.position = 'relative';
      historyPoint.style.zIndex = '1';
      
      // Year bubble
      const yearBubble = document.createElement('div');
      yearBubble.style.width = '40px';
      yearBubble.style.height = '40px';
      yearBubble.style.borderRadius = '50%';
      yearBubble.style.background = `linear-gradient(135deg, rgba(74, 109, 167, 0.8), rgba(6, 182, 212, 0.8))`;
      yearBubble.style.display = 'flex';
      yearBubble.style.alignItems = 'center';
      yearBubble.style.justifyContent = 'center';
      yearBubble.style.marginRight = '20px';
      yearBubble.style.flexShrink = '0';
      yearBubble.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.5)';
      yearBubble.style.border = '2px solid rgba(255, 255, 255, 0.1)';
      
      // Year text
      const yearText = document.createElement('span');
      yearText.textContent = point.year;
      yearText.style.fontSize = '12px';
      yearText.style.fontWeight = '700';
      yearText.style.color = 'white';
      yearBubble.appendChild(yearText);
      
      // Content card
      const contentCard = document.createElement('div');
      contentCard.style.flex = '1';
      contentCard.style.padding = '20px 25px';
      contentCard.style.background = 'rgba(30, 41, 59, 0.4)';
      contentCard.style.borderRadius = '12px';
      contentCard.style.backdropFilter = 'blur(10px)';
      contentCard.style.border = '1px solid rgba(74, 109, 167, 0.2)';
      
      // Content text
      const contentText = document.createElement('p');
      contentText.textContent = point.content;
      contentText.style.fontSize = '16px';
      contentText.style.lineHeight = '1.7';
      contentText.style.color = '#e2e8f0';
      contentText.style.margin = '0';
      
      contentCard.appendChild(contentText);
      
      historyPoint.appendChild(yearBubble);
      historyPoint.appendChild(contentCard);
      
      historyContent.appendChild(historyPoint);
    });
    
    historySection.appendChild(historyHeading);
    historySection.appendChild(historyContent);
    
    return historySection;
  }
  
  createLeadershipSection() {
    const leadershipSection = document.createElement('section');
    leadershipSection.className = 'animated-item';
    leadershipSection.style.animationDelay = '0.8s';
    
    const leadershipHeading = document.createElement('h2');
    leadershipHeading.className = 'text-gradient';
    leadershipHeading.textContent = 'Our Leadership';
    leadershipHeading.style.fontSize = '32px';
    leadershipHeading.style.fontWeight = '700';
    leadershipHeading.style.marginBottom = '30px';
    leadershipHeading.style.textAlign = 'center';
    
    leadershipSection.appendChild(leadershipHeading);
    
    const leadershipGrid = document.createElement('div');
    leadershipGrid.style.display = 'grid';
    leadershipGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
    leadershipGrid.style.gap = '30px';
    leadershipGrid.style.justifyContent = 'center';
    
    const leaders = [
      {
        name: 'Pastor John Doe',
        role: 'Senior Pastor',
        bio: 'Leading our congregation since 2010 with wisdom and compassion.',
        color: '#4a6da7'
      },
      {
        name: 'Sarah Smith',
        role: 'Worship Director',
        bio: 'Coordinating our music ministry and leading our congregation in worship.',
        color: '#5d8a3e'
      },
      {
        name: 'Michael Johnson',
        role: 'Youth Pastor',
        bio: 'Guiding and mentoring our youth with energy and dedication.',
        color: '#a05195'
      },
      {
        name: 'Elizabeth Brown',
        role: 'Community Outreach',
        bio: 'Connecting our church with the wider community through service.',
        color: '#ff7c43'
      }
    ];
    
    leaders.forEach((leader, index) => {
      const leaderCard = document.createElement('div');
      leaderCard.className = 'neo-card';
      leaderCard.style.textAlign = 'center';
      leaderCard.style.animation = 'fadeIn 0.6s forwards';
      leaderCard.style.animationDelay = `${0.2 * (index + 1)}s`;
      leaderCard.style.opacity = '0';
      leaderCard.style.position = 'relative';
      leaderCard.style.overflow = 'hidden';
      
      // Add holographic ripple effect on hover
      leaderCard.addEventListener('mouseenter', () => {
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.top = '50%';
        ripple.style.left = '50%';
        ripple.style.transform = 'translate(-50%, -50%)';
        ripple.style.width = '10px';
        ripple.style.height = '10px';
        ripple.style.borderRadius = '50%';
        ripple.style.background = this.hexToRgba(leader.color, 0.1);
        ripple.style.opacity = '1';
        ripple.style.zIndex = '0';
        ripple.style.animation = 'ripple 1.5s ease-out';
        leaderCard.appendChild(ripple);
        
        setTimeout(() => {
          leaderCard.removeChild(ripple);
        }, 1500);
      });
      
      // Add ripple animation
      if (!document.getElementById('ripple-animation')) {
        const rippleStyle = document.createElement('style');
        rippleStyle.id = 'ripple-animation';
        rippleStyle.textContent = `
          @keyframes ripple {
            0% { width: 10px; height: 10px; opacity: 1; }
            100% { width: 300px; height: 300px; opacity: 0; }
          }
        `;
        document.head.appendChild(rippleStyle);
      }
      
      const avatarContainer = document.createElement('div');
      avatarContainer.style.padding = '30px 20px 20px';
      
      // Holographic avatar with glow
      const avatar = document.createElement('div');
      avatar.style.width = '120px';
      avatar.style.height = '120px';
      avatar.style.borderRadius = '50%';
      avatar.style.background = `linear-gradient(135deg, ${this.hexToRgba(leader.color, 0.3)}, ${this.hexToRgba(leader.color, 0.1)})`;
      avatar.style.display = 'flex';
      avatar.style.alignItems = 'center';
      avatar.style.justifyContent = 'center';
      avatar.style.margin = '0 auto 20px';
      avatar.style.position = 'relative';
      avatar.style.boxShadow = `0 0 20px ${this.hexToRgba(leader.color, 0.2)}`;
      avatar.style.border = `1px solid ${this.hexToRgba(leader.color, 0.3)}`;
      
      // Avatar glow pulse
      const avatarGlow = document.createElement('div');
      avatarGlow.style.position = 'absolute';
      avatarGlow.style.top = '0';
      avatarGlow.style.left = '0';
      avatarGlow.style.right = '0';
      avatarGlow.style.bottom = '0';
      avatarGlow.style.borderRadius = '50%';
      avatarGlow.style.boxShadow = `0 0 20px ${this.hexToRgba(leader.color, 0.3)}`;
      avatarGlow.style.animation = 'pulse 3s infinite';
      avatarGlow.style.animationDelay = `${index * 0.5}s`;
      avatar.appendChild(avatarGlow);
      
      const initials = document.createElement('span');
      initials.textContent = leader.name.split(' ').map(n => n[0]).join('');
      initials.style.fontSize = '42px';
      initials.style.fontWeight = '700';
      initials.style.color = this.hexToRgba(leader.color, 1);
      initials.style.textShadow = `0 0 10px ${this.hexToRgba(leader.color, 0.5)}`;
      initials.style.position = 'relative';
      initials.style.zIndex = '1';
      
      avatar.appendChild(initials);
      avatarContainer.appendChild(avatar);
      
      const leaderName = document.createElement('h3');
      leaderName.textContent = leader.name;
      leaderName.style.margin = '0 0 5px';
      leaderName.style.fontSize = '20px';
      leaderName.style.fontWeight = '700';
      leaderName.style.color = '#ffffff';
      
      const leaderRole = document.createElement('p');
      leaderRole.textContent = leader.role;
      leaderRole.style.margin = '0 0 10px';
      leaderRole.style.fontSize = '15px';
      leaderRole.style.color = this.hexToRgba(leader.color, 1);
      leaderRole.style.fontWeight = '600';
      
      avatarContainer.appendChild(leaderName);
      avatarContainer.appendChild(leaderRole);
      
      const leaderBody = document.createElement('div');
      leaderBody.style.padding = '0 20px 25px';
      
      const leaderBio = document.createElement('p');
      leaderBio.textContent = leader.bio;
      leaderBio.style.fontSize = '15px';
      leaderBio.style.lineHeight = '1.6';
      leaderBio.style.color = '#e2e8f0';
      leaderBio.style.margin = '0';
      
      leaderBody.appendChild(leaderBio);
      
      leaderCard.appendChild(avatarContainer);
      leaderCard.appendChild(leaderBody);
      
      leadershipGrid.appendChild(leaderCard);
    });
    
    leadershipSection.appendChild(leadershipGrid);
    
    return leadershipSection;
  }
  
  // Helper function to convert hex to rgba
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}