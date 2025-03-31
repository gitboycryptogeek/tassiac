// server/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const { initializeDatabase } = require('./utils/dbInit');
const errorHandler = require('./middlewares/errorHandler');

// Import the special offering routes
const specialOfferingRoutes = require('./routes/specialOfferingRoutes');



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
app.use(express.static(path.join(__dirname, 'public')));

// API routes
const routes = require('./routes');
app.use('/api', routes);

// Add the special offering routes to your API
app.use('/api/payment/special-offering', specialOfferingRoutes);

// Add route for contact
const contactRoutes = require('./routes/contactRoutes');
app.use('/api/contact', contactRoutes);

// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'up', message: 'Server is running', timestamp: new Date().toISOString() });
});

// Error handling middleware must be after all routes
app.use(errorHandler);

// Serve the frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  // Don't exit the process in production, but log the error
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack trace:', reason.stack);
  }
});

// Initialize database and then start server
initializeDatabase().then(success => {
  if (success) {
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`API accessible at: http://localhost:${PORT}/api`);
      
      // Warn if JWT_SECRET isn't set
      if (!process.env.JWT_SECRET) {
        console.warn('WARNING: JWT_SECRET environment variable is not set. Using insecure default secret.');
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please use another port.`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });
  } else {
    console.error('Failed to initialize database. Server not started.');
    process.exit(1);
  }
}).catch(error => {
  console.error('Unexpected error during initialization:', error);
  process.exit(1);
});