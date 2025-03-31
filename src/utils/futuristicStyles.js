// src/utils/futuristicStyles.js

export const FuturisticStyles = {
    // Add global styles to document
    addGlobalStyles() {
      if (!document.getElementById('futuristic-global-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'futuristic-global-styles';
        styleElement.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          
          body {
            margin: 0;
            padding: 0;
            background-color: #0f172a;
            color: #f8fafc;
            font-family: 'Inter', sans-serif;
            overflow-x: hidden;
            min-height: 100vh;
          }
          
          * {
            box-sizing: border-box;
          }
          
          /* IMPROVED TEXT VISIBILITY */
          h1, h2, h3, h4, h5, h6 {
            color: #ffffff;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
            letter-spacing: 0.02em;
            margin: 0;
            padding: 0;
          }
          
          p, span, div {
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          }
          
          /* Neo-morphic cards */
          .neo-card {
            position: relative;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(16px);
            border-radius: 24px;
            border: 1px solid rgba(148, 163, 184, 0.1);
            box-shadow: 
              0 4px 24px -8px rgba(0, 0, 0, 0.3),
              0 0 1px rgba(255, 255, 255, 0.1) inset,
              0 8px 16px -4px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          }
          
          .neo-card::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, 
              rgba(255, 255, 255, 0), 
              rgba(255, 255, 255, 0.1), 
              rgba(255, 255, 255, 0));
          }
          
          .neo-card::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 30px;
            right: 30px;
            height: 1px;
            background: linear-gradient(90deg, 
              rgba(0, 0, 0, 0), 
              rgba(0, 0, 0, 0.2), 
              rgba(0, 0, 0, 0));
          }
          
          .neo-card:hover {
            transform: translateY(-5px);
            box-shadow: 
              0 12px 30px -10px rgba(0, 0, 0, 0.4),
              0 0 1px rgba(255, 255, 255, 0.15) inset,
              0 8px 20px -6px rgba(6, 182, 212, 0.2);
          }
          
          .card-glow {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 24px;
            z-index: -1;
            opacity: 0;
            transition: opacity 0.5s ease;
            pointer-events: none;
          }
          
          .neo-card:hover .card-glow {
            opacity: 0.15;
          }
          
          /* Futuristic form inputs */
          .futuristic-input {
            padding: 12px 16px;
            background: rgba(15, 23, 42, 0.6);
            color: #ffffff;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 16px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            backdrop-filter: blur(4px);
            width: 100%;
            font-family: 'Inter', sans-serif;
            font-size: 16px;
          }
          
          .futuristic-input:focus {
            outline: none;
            border-color: rgba(6, 182, 212, 0.5);
            box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
            background: rgba(15, 23, 42, 0.7);
          }
          
          .futuristic-input::placeholder {
            color: rgba(148, 163, 184, 0.7);
          }
          
          .futuristic-label {
            color: #e2e8f0;
            margin-bottom: 8px;
            display: block;
            font-weight: 500;
            font-size: 14px;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          }
          
          /* Futuristic buttons */
          .futuristic-button {
            position: relative;
            background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1));
            color: #ffffff;
            border: none;
            border-radius: 16px;
            padding: 12px 20px;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(6, 182, 212, 0.3);
          }
          
          .futuristic-button::before {
            content: "";
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              to right,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.1) 50%,
              rgba(255, 255, 255, 0) 100%
            );
            transition: left 0.7s ease;
          }
          
          .futuristic-button:hover {
            background: linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.2));
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          }
          
          .futuristic-button:hover::before {
            left: 100%;
          }
          
          .futuristic-button:active {
            transform: translateY(1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) inset;
          }
          
          .futuristic-button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            background: rgba(100, 116, 139, 0.2);
          }
          
          /* Animations */
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(10px); }
          }
          
          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
          }
          
          @keyframes pulse {
            0% { opacity: 0.7; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); }
            100% { opacity: 0.7; transform: scale(1); }
          }
          
          @keyframes gradientBG {
            0% { background-position: 0% 50% }
            50% { background-position: 100% 50% }
            100% { background-position: 0% 50% }
          }
          
          @keyframes floatParticles {
            0% { background-position: 0px 0px; }
            100% { background-position: 1000px 1000px; }
          }
          
          @keyframes shimmer {
            0% { background-position: -500px 0; }
            100% { background-position: 500px 0; }
          }
          
          /* Utility classes */
          .animated-item {
            animation: fadeIn 0.6s ease-out forwards;
            opacity: 0;
          }
          
          .text-gradient {
            background: linear-gradient(to right, #ffffff, #06b6d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            color: transparent;
            display: inline-block;
          }
          
          /* Scrollbar styling */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.6);
          }
          
          ::-webkit-scrollbar-thumb {
            background: rgba(6, 182, 212, 0.5);
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(6, 182, 212, 0.8);
          }
        `;
        document.head.appendChild(styleElement);
      }
    },
    
    // Add background effects
    addBackgroundEffects() {
      // Add gradient background (only if not already present)
      if (!document.querySelector('.gradient-background')) {
        const gradientBackground = document.createElement('div');
        gradientBackground.className = 'gradient-background';
        gradientBackground.style.position = 'fixed';
        gradientBackground.style.top = '0';
        gradientBackground.style.left = '0';
        gradientBackground.style.width = '100%';
        gradientBackground.style.height = '100%';
        gradientBackground.style.background = 'linear-gradient(125deg, #0f172a 0%, #0f766e 40%, #0f172a 100%)';
        gradientBackground.style.backgroundSize = '400% 400%';
        gradientBackground.style.zIndex = '-2';
        gradientBackground.style.animation = 'gradientBG 15s ease infinite';
        document.body.appendChild(gradientBackground);
      }
      
      // Add particle overlay (only if not already present)
      if (!document.querySelector('.particle-overlay')) {
        const particleOverlay = document.createElement('div');
        particleOverlay.className = 'particle-overlay';
        particleOverlay.style.position = 'fixed';
        particleOverlay.style.top = '0';
        particleOverlay.style.left = '0';
        particleOverlay.style.width = '100%';
        particleOverlay.style.height = '100%';
        particleOverlay.style.background = 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%2306b6d4\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")';
        particleOverlay.style.backgroundSize = '100px 100px';
        particleOverlay.style.backgroundRepeat = 'repeat';
        particleOverlay.style.zIndex = '-1';
        particleOverlay.style.animation = 'floatParticles 150s linear infinite';
        document.body.appendChild(particleOverlay);
      }
      
      // Add additional lens flares
      const flares = [
        { top: '15%', left: '85%', size: '300px', color: 'rgba(6, 182, 212, 0.15)', id: 'lens-flare-1' },
        { top: '75%', left: '15%', size: '250px', color: 'rgba(6, 182, 212, 0.1)', id: 'lens-flare-2' }
      ];
      
      flares.forEach(flare => {
        if (!document.getElementById(flare.id)) {
          const lensFlare = document.createElement('div');
          lensFlare.id = flare.id;
          lensFlare.style.position = 'fixed';
          lensFlare.style.top = flare.top;
          lensFlare.style.left = flare.left;
          lensFlare.style.width = flare.size;
          lensFlare.style.height = flare.size;
          lensFlare.style.borderRadius = '50%';
          lensFlare.style.background = `radial-gradient(circle at center, ${flare.color}, transparent 70%)`;
          lensFlare.style.pointerEvents = 'none';
          lensFlare.style.zIndex = '-1';
          document.body.appendChild(lensFlare);
        }
      });
    },
    
    // Hex to RGB helper
    hexToRgb(hex) {
      if (!hex) return '0, 0, 0';
      
      // Remove # if present
      hex = hex.replace('#', '');
  
      // Handle shorthand hex
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
  
      // Convert to RGB
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
  
      return `${r}, ${g}, ${b}`;
    }
  };