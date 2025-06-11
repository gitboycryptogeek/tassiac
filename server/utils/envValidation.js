// server/utils/envValidation.js
const fs = require('fs');
const path = require('path');

// Environment validation configuration
const ENV_CONFIG = {
  // Required for all environments
  required: {
    // Database
    DATABASE_URL_PRISMA: {
      description: 'Prisma database connection string',
      example: 'postgresql://user:password@localhost:5432/database'
    },
    
    // JWT and Session Security
    JWT_SECRET: {
      description: 'JWT signing secret (minimum 32 characters)',
      minLength: 32,
      example: 'your-very-secure-jwt-secret-key-here'
    },
    SESSION_SECRET: {
      description: 'Express session secret (minimum 32 characters)',
      minLength: 32,
      example: 'your-very-secure-session-secret-key-here'
    },
    
    // KCB Payment Integration
    KCB_API_KEY: {
      description: 'KCB API Key for payment integration',
      example: 'your-kcb-api-key'
    },
    KCB_SECRET_KEY: {
      description: 'KCB Secret Key for payment integration',
      example: 'your-kcb-secret-key'
    },
    KCB_MERCHANT_ID: {
      description: 'KCB Merchant ID',
      example: 'your-merchant-id'
    },
    KCB_ACCOUNT_NUMBER: {
      description: 'KCB Account Number for transactions',
      example: 'your-account-number'
    },
    
    // Application URLs
    BACKEND_URL: {
      description: 'Backend URL for callbacks',
      example: 'https://your-backend-domain.com'
    }
  },
  
  // Required for production only
  production: {
    FRONTEND_URL: {
      description: 'Frontend URL for CORS',
      example: 'https://your-frontend-domain.com'
    },
    
    // M-Pesa Integration (if using)
    MPESA_LIVE_CONSUMER_KEY: {
      description: 'M-Pesa Live Consumer Key',
      example: 'your-mpesa-consumer-key'
    },
    MPESA_LIVE_CONSUMER_SECRET: {
      description: 'M-Pesa Live Consumer Secret',
      example: 'your-mpesa-consumer-secret'
    },
    MPESA_LIVE_SHORTCODE: {
      description: 'M-Pesa Live Shortcode',
      example: 'your-shortcode'
    },
    MPESA_LIVE_PASSKEY: {
      description: 'M-Pesa Live Passkey',
      example: 'your-passkey'
    },
    MPESA_LIVE_CALLBACK_URL: {
      description: 'M-Pesa callback URL',
      example: 'https://your-backend-domain.com/api/payment/mpesa/callback'
    },
    
    // Withdrawal passwords
    WITHDRAWAL_PASSWORD_1: {
      description: 'First withdrawal approval password',
      minLength: 12,
      example: 'secure-withdrawal-password-1'
    },
    WITHDRAWAL_PASSWORD_2: {
      description: 'Second withdrawal approval password',
      minLength: 12,
      example: 'secure-withdrawal-password-2'
    },
    WITHDRAWAL_PASSWORD_3: {
      description: 'Third withdrawal approval password',
      minLength: 12,
      example: 'secure-withdrawal-password-3'
    }
  },
  
  // Optional environment variables
  optional: {
    // KCB Configuration
    KCB_BASE_URL: {
      description: 'KCB API Base URL',
      default: 'https://uat.buni.kcbgroup.com',
      example: 'https://api.kcbgroup.com'
    },
    KCB_TOKEN_URL: {
      description: 'KCB Token endpoint URL',
      default: 'https://uat.buni.kcbgroup.com/token?grant_type=client_credentials'
    },
    KCB_CALLBACK_URL: {
      description: 'KCB payment callback URL',
      example: 'https://your-backend-domain.com/api/payment/kcb/callback'
    },
    
    // Africa's Talking SMS
    AFRICASTALKING_API_KEY: {
      description: "Africa's Talking API Key for SMS",
      example: 'your-africastalking-api-key'
    },
    AFRICASTALKING_USERNAME: {
      description: "Africa's Talking Username",
      example: 'your-africastalking-username'
    },
    AFRICASTALKING_SENDER_ID: {
      description: "SMS Sender ID",
      default: 'TASSIAC',
      example: 'CHURCH'
    },
    
    // Admin Configuration
    VIEW_ONLY_ADMIN_USERNAMES: {
      description: 'Comma-separated list of view-only admin usernames',
      default: 'admin3,admin4,admin5',
      example: 'readonly_admin1,readonly_admin2'
    },
    MAX_ADMIN_COUNT: {
      description: 'Maximum number of admin users',
      default: '5',
      example: '10'
    },
    
    // Church Information
    CHURCH_CONTACT_EMAIL: {
      description: 'Church contact email',
      default: 'info@tassiac.church',
      example: 'contact@your-church.org'
    },
    CHURCH_CONTACT_PHONE: {
      description: 'Church contact phone',
      default: '+254 123 456 789',
      example: '+254 700 000 000'
    },
    CHURCH_ADDRESS: {
      description: 'Church physical address',
      default: '123 Church Street, Nairobi, Kenya',
      example: 'Your Church Address'
    },
    CHURCH_FACEBOOK_URL: {
      description: 'Church Facebook page URL',
      example: 'https://facebook.com/your-church'
    },
    CHURCH_TWITTER_URL: {
      description: 'Church Twitter profile URL',
      example: 'https://twitter.com/your-church'
    },
    
    // Application Configuration
    PORT: {
      description: 'Server port number',
      default: '3000',
      example: '8080'
    },
    NODE_ENV: {
      description: 'Node environment',
      default: 'development',
      example: 'production'
    }
  }
};

// Validation functions
function validateEnvironmentVariables() {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log('\n🔍 Validating environment variables...\n');
  
  // Check required variables
  Object.entries(ENV_CONFIG.required).forEach(([key, config]) => {
    const value = process.env[key];
    
    if (!value) {
      errors.push(`❌ Missing required environment variable: ${key} - ${config.description}`);
    } else if (config.minLength && value.length < config.minLength) {
      errors.push(`❌ ${key} must be at least ${config.minLength} characters long`);
    } else if (config.example && value === config.example) {
      warnings.push(`⚠️  ${key} appears to be using example value`);
    } else {
      console.log(`✅ ${key}: Set and valid`);
    }
  });
  
  // Check production-specific variables
  if (isProduction) {
    Object.entries(ENV_CONFIG.production).forEach(([key, config]) => {
      const value = process.env[key];
      
      if (!value) {
        errors.push(`❌ Missing production environment variable: ${key} - ${config.description}`);
      } else if (config.minLength && value.length < config.minLength) {
        errors.push(`❌ ${key} must be at least ${config.minLength} characters long`);
      } else {
        console.log(`✅ ${key}: Set and valid`);
      }
    });
  }
  
  // Check optional variables and set defaults
  Object.entries(ENV_CONFIG.optional).forEach(([key, config]) => {
    const value = process.env[key];
    
    if (!value && config.default) {
      process.env[key] = config.default;
      console.log(`🔧 ${key}: Using default value (${config.default})`);
    } else if (value) {
      console.log(`✅ ${key}: Set`);
    } else {
      console.log(`ℹ️  ${key}: Not set (optional)`);
    }
  });
  
  // Database URL validation
  if (process.env.DATABASE_URL_PRISMA) {
    if (isProduction && (
      process.env.DATABASE_URL_PRISMA.includes('localhost') ||
      process.env.DATABASE_URL_PRISMA.includes('127.0.0.1') ||
      process.env.DATABASE_URL_PRISMA.includes('YOUR_USER')
    )) {
      warnings.push('⚠️  DATABASE_URL_PRISMA appears to be using local/example values in production');
    }
  }
  
  // Security validation for production
  if (isProduction) {
    const securityChecks = [
      { key: 'JWT_SECRET', checks: ['default-secret', 'jwt-secret', 'secret'] },
      { key: 'SESSION_SECRET', checks: ['session-secret', 'secret'] }
    ];
    
    securityChecks.forEach(({ key, checks }) => {
      const value = process.env[key]?.toLowerCase() || '';
      if (checks.some(check => value.includes(check))) {
        warnings.push(`⚠️  ${key} appears to contain common/weak patterns`);
      }
    });
  }
  
  // Print summary
  console.log('\n📋 Validation Summary:');
  console.log(`✅ Valid variables: ${Object.keys(ENV_CONFIG.required).length + (isProduction ? Object.keys(ENV_CONFIG.production).length : 0) - errors.length}`);
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(warning));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(error => console.log(error));
    console.log('\n💡 Create a .env file with the required variables. See .env.example for reference.\n');
    return false;
  }
  
  console.log('\n✅ All required environment variables are properly configured!\n');
  return true;
}

// Generate .env.example file
function generateEnvExample() {
  const exampleContent = [
    '# Tassia Central SDA Church Management System - Environment Variables',
    '# Copy this file to .env and fill in your actual values',
    '',
    '# ========================================',
    '# REQUIRED VARIABLES',
    '# ========================================',
    ''
  ];
  
  Object.entries(ENV_CONFIG.required).forEach(([key, config]) => {
    exampleContent.push(`# ${config.description}`);
    exampleContent.push(`${key}=${config.example || 'your-value-here'}`);
    exampleContent.push('');
  });
  
  exampleContent.push('# ========================================');
  exampleContent.push('# PRODUCTION VARIABLES');
  exampleContent.push('# ========================================');
  exampleContent.push('');
  
  Object.entries(ENV_CONFIG.production).forEach(([key, config]) => {
    exampleContent.push(`# ${config.description}`);
    exampleContent.push(`${key}=${config.example || 'your-value-here'}`);
    exampleContent.push('');
  });
  
  exampleContent.push('# ========================================');
  exampleContent.push('# OPTIONAL VARIABLES');
  exampleContent.push('# ========================================');
  exampleContent.push('');
  
  Object.entries(ENV_CONFIG.optional).forEach(([key, config]) => {
    exampleContent.push(`# ${config.description}`);
    if (config.default) {
      exampleContent.push(`# Default: ${config.default}`);
    }
    exampleContent.push(`${key}=${config.example || config.default || 'your-value-here'}`);
    exampleContent.push('');
  });
  
  const envExamplePath = path.join(__dirname, '..', '..', '.env.example');
  try {
    fs.writeFileSync(envExamplePath, exampleContent.join('\n'));
    console.log(`📝 Generated .env.example file at ${envExamplePath}`);
  } catch (error) {
    console.error('❌ Failed to generate .env.example file:', error.message);
  }
}

// KCB specific validation
function validateKcbConfiguration() {
  const kcbVars = ['KCB_API_KEY', 'KCB_SECRET_KEY', 'KCB_MERCHANT_ID', 'KCB_ACCOUNT_NUMBER'];
  const missingKcb = kcbVars.filter(key => !process.env[key]);
  
  if (missingKcb.length > 0) {
    console.log('\n⚠️  KCB Integration Warning:');
    console.log('Missing KCB configuration variables:', missingKcb.join(', '));
    console.log('KCB payment features will not work properly.');
    return false;
  }
  
  console.log('✅ KCB configuration is complete');
  return true;
}

// M-Pesa specific validation
function validateMpesaConfiguration() {
  const mpesaVars = ['MPESA_LIVE_CONSUMER_KEY', 'MPESA_LIVE_CONSUMER_SECRET', 'MPESA_LIVE_SHORTCODE', 'MPESA_LIVE_PASSKEY'];
  const missingMpesa = mpesaVars.filter(key => !process.env[key]);
  
  if (missingMpesa.length > 0) {
    console.log('\n⚠️  M-Pesa Integration Warning:');
    console.log('Missing M-Pesa configuration variables:', missingMpesa.join(', '));
    console.log('M-Pesa payment features will not work properly.');
    return false;
  }
  
  console.log('✅ M-Pesa configuration is complete');
  return true;
}

module.exports = {
  validateEnvironmentVariables,
  generateEnvExample,
  validateKcbConfiguration,
  validateMpesaConfiguration,
  ENV_CONFIG
};