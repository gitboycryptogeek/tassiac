// server/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const { initializeDatabase } = require('./utils/dbInit');
const errorHandler = require('./middlewares/errorHandler');

// Import routes
const specialOfferingRoutes = require('./routes/specialOfferingRoutes');
const contactRoutes = require('./routes/contactRoutes');
const routes = require('./routes');

// Load environment variables
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Detailed request logging for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Request headers:', req.headers);
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
      console.log('Request body:', sanitizedBody);
    }
  }
  next();
});

// Comprehensive CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_URL].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Basic security with Helmet
app.use(helmet({
  contentSecurityPolicy: false // Disabled for development
}));

// Body parser middleware with increased size limits and better error handling
app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ message: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  if (req.method === 'DELETE') {
    // Skip JSON body parsing for DELETE requests
    req.headers['content-type'] = 'text/plain';
  }
  next();
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'tassiac-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
  }
}));

// Mount special offering routes before general routes
app.use('/api/special-offerings', require('./routes/specialOfferingRoutes'));

// API routes must come before static file serving
app.use('/api', routes);
app.use('/api/payment/special-offering', specialOfferingRoutes);
app.use('/api/contact', contactRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'up', message: 'Server is running', timestamp: new Date().toISOString() });
});

// Production static file serving with proper MIME types
if (process.env.NODE_ENV === 'production') {
  // Serve built frontend with correct MIME types
  app.use(express.static(path.join(__dirname, '..', 'dist'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (path.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      } else if (path.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json');
      }
    }
  }));

  // Serve source JS files for dynamic imports with correct MIME type
  app.use('/views', express.static(path.join(__dirname, '..', 'src', 'views'), {
    setHeaders: (res, path) => {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }));

  app.use('/utils', express.static(path.join(__dirname, '..', 'src', 'utils'), {
    setHeaders: (res, path) => {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }));

  app.use('/components', express.static(path.join(__dirname, '..', 'src', 'components'), {
    setHeaders: (res, path) => {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }));

  // SPA fallback - must be after all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack trace:', reason.stack);
  }
});

// Initialize database and then start server
initializeDatabase().then(success => {
  if (success) {
    // In production, skip database reinitialization
    if (process.env.NODE_ENV === 'production') {
      console.log('Production mode - skipping database reinitialization');
      startServer();
    } else {
      // Only reinitialize in development
      const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`API accessible at: http://localhost:${PORT}/api`);
        
        if (!process.env.JWT_SECRET) {
          console.warn('WARNING: JWT_SECRET environment variable is not set. Using insecure default secret.');
        }
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use. Please use another port.`);
        } else {
          console.error('Server error:', error);
        }
        process.exit(1);
      });
    }
  } else {
    console.error('Failed to initialize database. Server not started.');
    process.exit(1);
  }
}).catch(error => {
  console.error('Unexpected error during initialization:', error);
  process.exit(1);
});

// Separate server start function
function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database URL: ${process.env.DATABASE_URL ? 'Found' : 'Not found'}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please use another port.`);
    } else {
      console.error('Server error:', error);
    }
    process.exit(1);
  });
}