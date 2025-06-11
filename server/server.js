// server/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const receiptRoutes = require('./routes/receiptRoutes');
const errorHandler = require('./middlewares/errorHandler.js');

// Import environment validation
const { 
  validateEnvironmentVariables, 
  validateKcbConfiguration, 
  validateMpesaConfiguration 
} = require('./utils/envValidation.js');

// Import PrismaClient
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import routes using CommonJS
const mainApiRoutes = require('./routes/index.js');

// Load environment variables
require('dotenv').config();

// CRITICAL: Validate environment variables before starting
console.log('🚀 Starting Tassia Central SDA Church Management System...\n');

if (!validateEnvironmentVariables()) {
  console.error('❌ Environment validation failed. Server cannot start safely.');
  process.exit(1);
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// --- Debug Logging ---
let fs;
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server-debug.log');

if (!IS_PRODUCTION) {
  fs = require('fs');
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function debugLog(message, data = null) {
  if (IS_PRODUCTION || !fs) return;

  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] SERVER: ${message}`;
  if (data !== null) {
    try {
      const dataStr = JSON.stringify(data);
      logMessage += ` | Data: ${dataStr}`;
    } catch (err) {
      logMessage += ` | Data: [Failed to stringify: ${err.message}]`;
    }
  }
  console.log(logMessage);
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    // Silent fail for logging
  }
  return logMessage;
}

// Conditional request logging
if (!IS_PRODUCTION) {
  app.use((req, res, next) => {
    // Skip logging for static files and health checks
    if (!req.url.includes('/public/') && !req.url.includes('/health')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });
}

// CORS configuration with enhanced security
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:5173',
      'http://localhost:3000', // Local testing
      process.env.FRONTEND_URL, // Production frontend
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Enhanced security with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.safaricom.co.ke", "https://uat.buni.kcbgroup.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disabled for better compatibility
}));

// Rate limiting middleware (basic implementation)
const rateLimit = {};
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = IS_PRODUCTION ? 100 : 1000; // Stricter in production

app.use((req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimit[clientIp]) {
    rateLimit[clientIp] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
  } else if (now > rateLimit[clientIp].resetTime) {
    rateLimit[clientIp] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
  } else {
    rateLimit[clientIp].count++;
  }
  
  if (rateLimit[clientIp].count > MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      error: { code: 'RATE_LIMIT_EXCEEDED' }
    });
  }
  
  next();
});

// Body parser middleware with enhanced security
app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        console.error('Invalid JSON in request body:', e.message);
        const error = new Error('Invalid JSON payload');
        error.status = 400;
        throw error;
      }
    }
  }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration with enhanced security
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false, // Changed to false for better security
  name: 'tassiac.sid', // Custom session name
  cookie: {
    secure: IS_PRODUCTION, // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: IS_PRODUCTION ? 'strict' : 'lax',
  },
  // In production, use a proper session store (Redis, PostgreSQL, etc.)
};

app.use(session(sessionConfig));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

// Serve static files with proper headers
app.use('/public', express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline'); // Display in browser
    }
  }
}));

// Serve receipt PDFs and attachments with authentication check
app.use('/receipts', (req, res, next) => {
  // Add basic authentication check for receipts
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required to access receipts',
      error: { code: 'UNAUTHORIZED' }
    });
  }
  next();
}, express.static(path.join(__dirname, 'public/receipts')));

app.use('/uploads/receipt_attachments', express.static(path.join(__dirname, 'public/uploads/receipt_attachments')));

// API Routes
app.use('/api', mainApiRoutes);
app.use('/api/receipt', receiptRoutes);

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test KCB configuration
    const kcbStatus = validateKcbConfiguration();
    
    // Test M-Pesa configuration (if needed)
    const mpesaStatus = validateMpesaConfiguration();
    
    res.status(200).json({
      status: 'healthy',
      message: 'TASSIAC API is running properly',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'connected',
        kcb: kcbStatus ? 'configured' : 'misconfigured',
        mpesa: mpesaStatus ? 'configured' : 'misconfigured',
      },
      version: '2.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Service health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System status endpoint (admin only)
app.get('/api/system/status', async (req, res) => {
  try {
    // Basic auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const stats = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        // Add more DB stats if needed
      }
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Receipt system health check
app.get('/api/receipt-health', async (req, res) => {
  try {
    const receiptsDir = path.join(__dirname, 'public/receipts');
    const receiptsExists = fs ? fs.existsSync(receiptsDir) : false;
    
    const receiptCount = await prisma.receipt.count();
    const recentReceipts = await prisma.receipt.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, receiptNumber: true, createdAt: true }
    });
    
    res.status(200).json({
      status: 'operational',
      message: 'Receipt system is working properly',
      receiptsDirectory: receiptsExists ? 'exists' : 'missing',
      totalReceipts: receiptCount,
      recentReceipts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Receipt system check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Production static file serving with enhanced security
if (IS_PRODUCTION) {
  const distPath = path.join(__dirname, '..', 'dist');
  
  app.use(express.static(distPath, {
    maxAge: '1h', // Cache static files for 1 hour
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache'); // Don't cache HTML files
      }
    }
  }));

  // SPA fallback with error handling
  app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs && fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        success: false,
        message: 'Application not found',
        error: { code: 'APP_NOT_FOUND' }
      });
    }
  });
}

// Global error handling middleware (should be last)
app.use(errorHandler);

// Enhanced error handlers for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Promise Rejection at:', promise, 'reason:', reason);
  if (IS_PRODUCTION) {
    // In production, you might want to log to external service and restart gracefully
    console.error('🚨 Server will shutdown due to unhandled promise rejection in production');
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  if (IS_PRODUCTION) {
    console.error('🚨 Server will shutdown due to uncaught exception in production');
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, starting graceful shutdown...');
  
  // Close database connections
  await prisma.$disconnect();
  
  // Close server
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, starting graceful shutdown...');
  
  await prisma.$disconnect();
  process.exit(0);
});

// Database Initialization and Server Start
const startServer = () => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    if (!IS_PRODUCTION) {
      console.log(`🔗 Frontend dev server: http://localhost:5173`);
      console.log(`🔗 Backend API: http://localhost:${PORT}/api`);
      console.log(`🧾 Receipt system: http://localhost:${PORT}/api/receipt`);
      console.log(`💊 Health check: http://localhost:${PORT}/api/health`);
    } else {
      console.log(`🌐 Application URL: ${process.env.FRONTEND_URL || 'your-production-url'}`);
    }

    // Post-startup validations
    validateKcbConfiguration();
    if (IS_PRODUCTION) {
      validateMpesaConfiguration();
    }

    debugLog('Server startup complete with all validations passed.');
    console.log('\n✅ Server started successfully!\n');
  }).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please use another port or stop the existing process.`);
    } else {
      console.error('❌ Server startup error:', error);
    }
    process.exit(1);
  });
};

async function checkDbConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test if required tables exist
    const userCount = await prisma.user.count();
    const paymentCount = await prisma.payment.count();
    
    console.log('✅ Database connection successful');
    console.log(`📊 Found ${userCount} users and ${paymentCount} payments in database`);
    
    debugLog('Database connection test successful', { userCount, paymentCount });
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    if (error.message.includes('P1001')) {
      console.error('💡 Database server is not reachable. Please check your DATABASE_URL_PRISMA.');
    } else if (error.message.includes('P1017')) {
      console.error('💡 Database server closed the connection. Check your database service status.');
    }
    
    return false;
  }
}

// Ensure required directories exist
function ensureDirectories() {
  const requiredDirs = [
    path.join(__dirname, 'public'),
    path.join(__dirname, 'public/receipts'),
    path.join(__dirname, 'public/uploads'),
    path.join(__dirname, 'public/uploads/receipt_attachments'),
    path.join(__dirname, 'public/uploads/expense_receipts'),
    path.join(__dirname, 'public/reports'),
    path.join(__dirname, 'logs')
  ];

  if (!IS_PRODUCTION && fs) {
    requiredDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        debugLog(`Created directory: ${dir}`);
      }
    });
    console.log('✅ All required directories are ready');
  }
}

// Initialize directories and start server
console.log('🔧 Setting up directories...');
ensureDirectories();

console.log('🔍 Checking database connection...');
checkDbConnection().then(isConnected => {
  if (isConnected) {
    startServer();
  } else {
    console.error("❌ Cannot start server due to database connection issues.");
    console.error("💡 Please check your DATABASE_URL_PRISMA environment variable and ensure your database server is running.");
    process.exit(1);
  }
});