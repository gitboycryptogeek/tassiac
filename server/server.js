// server/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const errorHandler = require('./middlewares/errorHandler.js');

// Import PrismaClient
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import routes using CommonJS
const mainApiRoutes = require('./routes/index.js');
// Routes like authRoutes, paymentRoutes etc., are mounted within mainApiRoutes via ./routes/index.js

// Load environment variables
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// --- Debug Logging ---
// Setup debug log file only if not in production
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
  if (IS_PRODUCTION || !fs) return; // Do not log to file in production

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
  console.log(logMessage); // Keep console.log for dev visibility
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    // console.error('Failed to write to debug log file:', err);
  }
  return logMessage;
}

// Conditional request logging
if (!IS_PRODUCTION) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}
// --- End Debug Logging ---


// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL, // Your deployed frontend URL
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Basic security with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // REVIEW FOR PRODUCTION: 'unsafe-inline' is generally discouraged for script-src.
      // Ensure this is absolutely necessary or implement a stricter policy (e.g., using nonces or hashes).
      "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      // Consider adding other directives like img-src, style-src, font-src based on your app's needs.
    },
  },
}));

// Body parser middleware
app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length) { // Only try to parse if buffer is not empty
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        console.error('Invalid JSON in request body:', e.message);
        // Don't immediately send response here, let the route handler deal with it or use next(e)
        // For now, we'll just log it and let it pass to see if other errors occur
        // To be stricter, you'd throw an error that your global error handler catches.
      }
    }
  }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
// Ensure SESSION_SECRET is a strong, unique value set in your environment variables for production.
app.use(session({
  secret: process.env.SESSION_SECRET || 'a-very-strong-tassiac-session-secret-key-dev-fallback',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: IS_PRODUCTION, // True if using HTTPS (recommended for production)
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  // For production, consider a persistent session store compatible with Prisma/your database.
  // e.g., connect-pg-simple for PostgreSQL, or a custom Prisma session store.
}));

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', mainApiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'up',
    message: 'TASSIAC API is healthy and running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Production static file serving
if (IS_PRODUCTION) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));

  // SPA fallback: serve index.html for any unknown paths
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global error handling middleware (should be last)
app.use(errorHandler);

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  // In production, you might want to log this to an external service and potentially restart.
});

// Database Initialization and Server Start
const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (!IS_PRODUCTION) {
      console.log(`Frontend dev server likely at http://localhost:5173`);
      console.log(`Backend API accessible at http://localhost:${PORT}/api`);
    } else {
      console.log(`Application accessible at your production URL.`);
    }

    // Warnings for critical environment variables in production
    if (IS_PRODUCTION) {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-key-for-tassiac-app') {
        console.warn('\x1b[33m%s\x1b[0m', 'CRITICAL WARNING: JWT_SECRET is not set to a strong, unique value in production!');
      }
      if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'a-very-strong-tassiac-session-secret-key-dev-fallback') {
        console.warn('\x1b[33m%s\x1b[0m', 'CRITICAL WARNING: SESSION_SECRET is not set to a strong, unique value in production!');
      }
      if (!process.env.DATABASE_URL_PRISMA) {
        console.warn('\x1b[33m%s\x1b[0m', 'CRITICAL WARNING: DATABASE_URL_PRISMA is not set in production!');
      } else if (process.env.DATABASE_URL_PRISMA.includes('YOUR_USER') || process.env.DATABASE_URL_PRISMA.includes('localhost')) {
          console.warn('\x1b[33m%s\x1b[0m', 'WARNING: DATABASE_URL_PRISMA might be using placeholder or local development values in production. Please verify.');
      }
    }
    debugLog('Server startup complete.');
  }).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\x1b[31mERROR: Port ${PORT} is already in use. Please use another port or stop the existing process.\x1b[0m`);
    } else {
      console.error('\x1b[31mServer startup error:\x1b[0m', error);
    }
    process.exit(1);
  });
};

async function checkDbConnection() {
  try {
    // Prisma Client connects lazily on the first query.
    // A simple query can verify the connection.
    await prisma.$queryRaw`SELECT 1`;
    debugLog('Successfully connected to the database via Prisma Client.');
    return true;
  } catch (error) {
    console.error('\x1b[31mFailed to connect to the database via Prisma Client:\x1b[0m', error.message);
    console.error('Please ensure your DATABASE_URL_PRISMA in .env (or environment variables) is correct and the database server is running and accessible.');
    if (IS_PRODUCTION && process.env.DATABASE_URL_PRISMA && (process.env.DATABASE_URL_PRISMA.includes('YOUR_USER') || process.env.DATABASE_URL_PRISMA.includes('localhost'))) {
        console.error('\x1b[33mWARNING: DATABASE_URL_PRISMA may be using placeholder or local development values in production. This is likely incorrect.\x1b[0m');
    }
    return false;
  } finally {
    // It's good practice to disconnect if you explicitly connect for a check,
    // though Prisma manages connections automatically for ongoing operations.
    await prisma.$disconnect().catch(e => console.error("Error disconnecting Prisma during check:", e));
  }
}

checkDbConnection().then(isConnected => {
  if (isConnected) {
    startServer();
  } else {
    console.error("\x1b[31mHalting server start due to database connection issues.\x1b[0m");
    process.exit(1);
  }
});