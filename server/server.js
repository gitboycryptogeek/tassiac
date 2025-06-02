// server/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
// const { initializeDatabase } = require('./utils/dbInit'); // Sequelize-specific init, to be replaced
const errorHandler = require('./middlewares/errorHandler.js');

// Import routes using CommonJS
const mainApiRoutes = require('./routes/index.js'); // Your main API router
const authRoutes = require('./routes/authRoutes.js');
const paymentRoutes = require('./routes/paymentRoutes.js');
const receiptRoutes = require('./routes/receiptRoutes.js');
const specialOfferingRoutes = require('./routes/specialOfferingRoutes.js');
const contactRoutes = require('./routes/contactRoutes.js');
const adminRoutes = require('./routes/adminRoutes.js');

// Load environment variables
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Debug logging for requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  // More detailed logging can be added here if needed during debugging
  next();
});

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL, // Your deployed frontend URL
    // Add any other origins that need access
  ].filter(Boolean), // Removes undefined/null from array
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Basic security with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"], // Allow vite HMR and CDN for jspdf if needed
      // Add other directives as necessary, e.g., for fonts, images from CDNs
    },
  },
  // For development, you might need to relax CSP further if issues arise,
  // but tighten it for production.
  // Example: contentSecurityPolicy: false, // (DISABLES CSP - USE WITH CAUTION)
}));


// Body parser middleware
app.use(bodyParser.json({
  limit: '10mb', // Keep if you handle large JSON payloads
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      console.error('Invalid JSON in request body:', e.message);
      res.status(400).json({ success: false, message: 'Malformed JSON in request body.' });
      // Throwing an error here might be too aggressive and stop further middleware.
      // Sending a response is usually better.
    }
  }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'a-very-strong-tassiac-session-secret-key', // CHANGE THIS IN PRODUCTION
  resave: false,
  saveUninitialized: true, // Set to true if you want to save sessions for unauthenticated users
  cookie: {
    secure: process.env.NODE_ENV === 'production', // True if using HTTPS
    httpOnly: true,
    sameSite: 'lax', // Helps prevent CSRF
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  // Consider using a session store like connect-session-sequelize (if you were still on Sequelize)
  // or connect-pg-simple for PostgreSQL with Prisma if you need persistent sessions.
  // For Prisma, you might need a custom session store or a compatible one.
  // For simple JWT auth, session might be less critical if client stores the token.
}));

// Serve static files from public directory (e.g., for uploaded receipts, reports)
app.use('/public', express.static(path.join(__dirname, 'public')));


// API Routes
// It's cleaner to mount all API routes under a common base path like /api
// and then have server/routes/index.js handle sub-routes.
// The way you had it before was also fine, where server/routes/index.js was the main hub.

app.use('/api', mainApiRoutes); // This should now correctly mount all your sub-routers

// Health check endpoint (good for monitoring)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'up',
    message: 'TASSIAC API is healthy and running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});


// Production static file serving
if (process.env.NODE_ENV === 'production') {
  // Serve built frontend files from 'dist' directory
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

  // Serve source JS files for dynamic imports from src (if your build requires it)
  // This is usually not needed if Vite bundles everything correctly.
  // If you have dynamic imports in your frontend like import(`../views/${route.moduleUrl}`),
  // Vite should handle these during the build process.
  // The proxy setup in vite.config.js handles `/api` calls during development.
  // For production, ensure your build output in 'dist' is self-contained or served correctly.

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
  // Optionally, log more details or exit process in critical cases
  // For production, consider a more robust logging solution.
});

// Database Initialization and Server Start
// With Prisma, explicit DB initialization like sequelize.sync() is handled by `prisma migrate`.
// The Prisma Client connects on its first query.
// If you have a seeding script for initial data (like admin users), run it separately:
// `npx prisma db seed`
// This assumes your `package.json` has a "prisma": { "seed": "node prisma/seed.js" } configuration.

const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Frontend dev server likely at http://localhost:5173`);
        console.log(`Backend API accessible at http://localhost:${PORT}/api`);
    } else {
        console.log(`Application accessible at your production URL.`);
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret-key-for-tassiac-app') {
      console.warn('\x1b[33m%s\x1b[0m', 'WARNING: JWT_SECRET is not set or is using the default. Please set a strong, unique secret in your .env file for production!');
    }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'a-very-strong-tassiac-session-secret-key') {
      console.warn('\x1b[33m%s\x1b[0m', 'WARNING: SESSION_SECRET is not set or is using the default. Please set a strong, unique secret in your .env file for production!');
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

// Check Prisma DB connection (optional, Prisma connects on demand)
async function checkDbConnection() {
  try {
    await prisma.$connect();
    debugLog('Successfully connected to the database via Prisma Client.');
    await prisma.$disconnect(); // Disconnect after check
    return true;
  } catch (error) {
    console.error('\x1b[31mFailed to connect to the database via Prisma Client:\x1b[0m', error.message);
    console.error('Please ensure your DATABASE_URL_PRISMA in .env is correct and the database server is running.');
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL_PRISMA && process.env.DATABASE_URL_PRISMA.includes('YOUR_USER')) {
        console.error('\x1b[33mWARNING: It seems you are using placeholder DATABASE_URL_PRISMA in production. Please update it!\x1b[0m');
    }
    return false;
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

// Your previous server/utils/dbInit.js was responsible for sequelize.sync() and creating admin users.
// - sequelize.sync() is replaced by `npx prisma migrate dev` (for schema changes) and `npx prisma db push` (for development sync without migrations, use carefully).
// - Admin user creation should now be handled by a Prisma seed script. See Prisma documentation on "Seeding your database".
//   You would create a `prisma/seed.js` file and run `npx prisma db seed`.