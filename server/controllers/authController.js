// server/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const sequelize = require('../config/database');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Add after other requires
if (process.env.DATABASE_URL) {
  debugLog('Initializing with PostgreSQL database');
  // Verify PostgreSQL connection
  sequelize.authenticate()
    .then(() => debugLog('PostgreSQL connection established successfully'))
    .catch(err => {
      debugLog('PostgreSQL connection error:', err);
      console.error('Unable to connect to PostgreSQL database:', err);
    });
}

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'auth-debug.log');
const DB_PATH = path.join(__dirname, '..', '..', 'database.sqlite');

// Helper to write debug logs
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ${message}`;
  
  if (data !== null) {
    try {
      const dataStr = typeof data === 'object' ? JSON.stringify(data) : data.toString();
      logMessage += ` | Data: ${dataStr}`;
    } catch (err) {
      logMessage += ` | Data: [Failed to stringify: ${err.message}]`;
    }
  }
  
  console.log(logMessage);
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    console.error('Failed to write to debug log file:', err);
  }
  
  return logMessage;
}

// Direct database query function based on environment
function querySqlite(sql, params = []) {
  if (process.env.DATABASE_URL) {
    debugLog('POSTGRES ENVIRONMENT DETECTED - Using Sequelize query');
    
    // Clean up the SQL for PostgreSQL
    let modifiedSql = sql
      // Remove all existing quotes first
      .replace(/["`]/g, '')
      // Add proper quotes for PostgreSQL
      .replace(/\bUsers\b/g, '"Users"')
      .replace(/\b(fullName|isAdmin|lastLogin|createdAt|updatedAt|resetToken|resetTokenExpiry)\b/g, 
        '"$1"'
      );

    // Convert ? placeholders to $1, $2, etc.
    let paramCount = 0;
    modifiedSql = modifiedSql.replace(/\?/g, () => `$${++paramCount}`);

    // Convert numeric boolean values to PostgreSQL boolean
    const postgresParams = params.map(param => 
      param === 1 || param === 0 ? Boolean(param) : param
    );

    debugLog('PostgreSQL query:', { sql: modifiedSql, params: postgresParams });

    // Use raw query with proper parameter binding
    return sequelize.query(modifiedSql, {
      bind: postgresParams,  // Use bind instead of replacements
      type: sequelize.QueryTypes.SELECT,
      raw: true
    });
  }
  
  // Fall back to SQLite for development
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        debugLog('Error opening database:', err);
        return reject(err);
      }
    });
    
    debugLog(`Executing SQLite query: ${sql}`, { params });
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        debugLog('SQLite query error:', err);
        db.close();
        return reject(err);
      }
      
      debugLog(`SQLite query returned ${rows ? rows.length : 0} rows`);
      resolve(rows);
      
      db.close((closeErr) => {
        if (closeErr) debugLog('Error closing database:', closeErr);
      });
    });
  });
}

// Add after other helper functions
function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return false;
}

function normalizeDate(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

// Login controller with extensive debugging
exports.login = async (req, res) => {
  debugLog('=== LOGIN ATTEMPT STARTED ===');
  
  try {
    // Check request body
    debugLog('Request body received:', { 
      username: req.body?.username || '[MISSING]',
      hasPassword: req.body?.password ? 'Yes' : 'No' 
    });
    
    // Log request body for debugging
    try {
      debugLog('Complete request body:', req.body);
    } catch (bodyError) {
      debugLog('Error logging request body:', bodyError);
    }
    
    // Validate request
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        debugLog('Validation errors:', errors.array());
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }
    } catch (validationError) {
      debugLog('Error in validation:', validationError);
      return res.status(400).json({ message: 'Error validating request' });
    }

    // Extract credentials
    const username = req.body?.username || '';
    const password = req.body?.password || '';
    
    if (!username || !password) {
      debugLog('Missing credentials', { hasUsername: !!username, hasPassword: !!password });
      return res.status(400).json({ message: 'Username and password are required' });
    }

    debugLog(`Looking up user: ${username}`);
    
    // Use direct SQLite for more reliable results
    let user = null;
    try {
      const users = await querySqlite(
        'SELECT * FROM Users WHERE username = ?',
        [username]
      );
      
      if (users && users.length > 0) {
        user = users[0];
        debugLog(`User found: ${user.username}, ID: ${user.id}`);
      } else {
        debugLog(`No user found with username: ${username}`);
        return res.status(401).json({ message: 'Invalid username or password' });
      }
    } catch (queryError) {
      debugLog('Error querying user:', queryError);
      
      // Try to get all users as a diagnostic
      try {
        const allUsers = await querySqlite('SELECT username FROM Users LIMIT 5');
        debugLog('Sample of available users:', allUsers);
      } catch (allError) {
        debugLog('Error getting all users:', allError);
      }
      
      return res.status(500).json({ message: 'Database error during authentication' });
    }
    
    // Log user properties for debugging
    try {
      debugLog('User object properties:', Object.keys(user));
    } catch (propsError) {
      debugLog('Error getting user properties:', propsError);
    }

    // Verify password with extensive error handling
    let isValidPassword = false;
    try {
      debugLog('Comparing password...');
      // Check if we actually have a password hash
      if (!user.password) {
        debugLog('User has no password hash stored');
        return res.status(401).json({ message: 'Account error - please contact admin' });
      }
      
      // Log first few chars of password hash for debugging
      const hashPreview = user.password.substring(0, 10) + '...';
      debugLog(`Password hash preview: ${hashPreview}`);
      
      isValidPassword = await bcrypt.compare(password, user.password);
      debugLog(`Password comparison result: ${isValidPassword}`);
    } catch (passwordError) {
      debugLog('Error comparing passwords:', passwordError);
      return res.status(500).json({ message: 'Error verifying credentials' });
    }
    
    if (!isValidPassword) {
      debugLog('Invalid password provided');
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Update last login time
    try {
      debugLog('Updating last login time');
      await querySqlite(
        'UPDATE "Users" SET "lastLogin" = ?, "updatedAt" = ? WHERE id = ?',
        [new Date().toISOString(), new Date().toISOString(), user.id]
      );
      debugLog('Last login time updated successfully');
    } catch (updateError) {
      // Non-fatal error - log but continue
      debugLog('Error updating last login time:', updateError);
    }

    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      debugLog('WARNING: JWT_SECRET is not set. Using fallback secret (insecure).');
    }

    // Create clean user object for token and response
    let userObj = {};
    try {
      userObj = { ...user };
      delete userObj.password;
      delete userObj.resetToken;
      delete userObj.resetTokenExpiry;
      debugLog('Created clean user object for response');
    } catch (objError) {
      debugLog('Error creating clean user object:', objError);
      // Create a minimal object to continue
      const isAdminValue = typeof user.isAdmin === 'boolean' ? user.isAdmin : 
                          (user.isAdmin === 1 || user.isAdmin === '1' || user.isAdmin === 'true');
      userObj = {
        id: user.id,
        username: user.username,
        isAdmin: isAdminValue
      };
    }

    // Generate JWT token
    let token = '';
    try {
      debugLog('Generating JWT token');
      const isAdminValue = typeof user.isAdmin === 'boolean' ? user.isAdmin : 
                          (user.isAdmin === 1 || user.isAdmin === '1' || user.isAdmin === 'true');
      token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          isAdmin: isAdminValue
        },
        process.env.JWT_SECRET || 'default-secret-key',
        { expiresIn: '8h' }
      );
      debugLog('JWT token generated successfully');
    } catch (tokenError) {
      debugLog('Error generating token:', tokenError);
      return res.status(500).json({ message: 'Error creating authentication token' });
    }

    debugLog('Login successful - sending response');
    res.json({
      message: 'Login successful',
      user: userObj,
      token
    });
    
    debugLog('=== LOGIN ATTEMPT COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    debugLog('CRITICAL ERROR in login process:', error);
    console.error(error);
    res.status(500).json({ 
      message: 'Server error during authentication',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Register user (admin only)
exports.registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, fullName, phone, email, isAdmin } = req.body;

    // Check if username already exists
    let existingUsers;
    
    if (process.env.DATABASE_URL) {
      // Fixed PostgreSQL query with proper parameter binding
      existingUsers = await sequelize.query(
        'SELECT id FROM "Users" WHERE username = :username',
        { 
          replacements: { username },
          type: sequelize.QueryTypes.SELECT 
        }
      );
    } else {
      existingUsers = await querySqlite(
        'SELECT id FROM Users WHERE username = ?',
        [username]
      );
    }
    
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the user
    const now = new Date().toISOString();
    let newUser;
    
    if (process.env.DATABASE_URL) {
      // Fixed PostgreSQL insert with named parameters
      const result = await sequelize.query(
        `INSERT INTO "Users" (
          username, 
          password, 
          "fullName", 
          phone, 
          email, 
          "isAdmin", 
          "createdAt", 
          "updatedAt"
        ) VALUES (
          :username, 
          :password, 
          :fullName, 
          :phone, 
          :email, 
          :isAdmin, 
          :createdAt, 
          :updatedAt
        ) RETURNING id`,
        { 
          replacements: {
            username,
            password: hashedPassword,
            fullName,
            phone,
            email: email || null,
            isAdmin: isAdmin ? true : false,
            createdAt: now,
            updatedAt: now
          },
          type: sequelize.QueryTypes.INSERT 
        }
      );
      
      // Get the inserted user with named parameters
      newUser = await sequelize.query(
        `SELECT 
          id, 
          username, 
          "fullName", 
          phone, 
          email, 
          "isAdmin", 
          "createdAt", 
          "updatedAt" 
        FROM "Users" 
        WHERE username = :username`,
        { 
          replacements: { username },
          type: sequelize.QueryTypes.SELECT 
        }
      );
    } else {
      // SQLite queries remain unchanged
      await querySqlite(
        'INSERT INTO Users (username, password, fullName, phone, email, isAdmin, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, fullName, phone, email || null, isAdmin ? 1 : 0, now, now]
      );
      
      newUser = await querySqlite(
        'SELECT id, username, fullName, phone, email, isAdmin, createdAt, updatedAt FROM Users WHERE username = ?',
        [username]
      );
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser[0]
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// Get user profile with direct SQLite
exports.getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Get user without sensitive fields
    const users = await querySqlite(
      `SELECT id, username, "fullName", phone, email, "isAdmin", "lastLogin", "createdAt", "updatedAt" 
       FROM "Users" 
       WHERE id = ?`,
      [req.user.id]
    );
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Get all users (for admin) with direct SQLite
exports.getUsers = async (req, res) => {
  try {
    let users;
    
    if (process.env.DATABASE_URL) {
      // Ensure consistent double quotes for PostgreSQL identifiers
      users = await sequelize.query(
        `SELECT 
          id, 
          username, 
          "fullName", 
          phone, 
          email, 
          "isAdmin", 
          "lastLogin", 
          "createdAt", 
          "updatedAt" 
        FROM "Users"
        ORDER BY "createdAt" DESC`,
        { 
          type: sequelize.QueryTypes.SELECT,
          raw: true 
        }
      );
    } else {
      // SQLite query - no quotes needed for column names
      users = await querySqlite(
        `SELECT 
          id, 
          username, 
          fullName, 
          phone, 
          email, 
          isAdmin, 
          lastLogin, 
          createdAt, 
          updatedAt 
        FROM Users 
        ORDER BY createdAt DESC`
      );
    }

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Update user (admin only) with direct SQLite
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, phone, email, isAdmin } = req.body;

    // Input validation
    if (!fullName || !phone) {
      return res.status(400).json({ message: 'Full name and phone are required' });
    }

    // Check if user exists
    const users = await querySqlite(
      'SELECT id, "isAdmin" FROM "Users" WHERE id = ?',
      [userId]
    );
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Count total admins if we're changing admin status
    if (users[0].isAdmin !== (isAdmin ? 1 : 0)) {
      const adminCount = await querySqlite(
        'SELECT COUNT(*) as count FROM "Users" WHERE "isAdmin" = 1'
      );
      
      // If user is being promoted to admin, check admin limit (max 5)
      if (isAdmin && users[0].isAdmin !== 1 && adminCount[0].count >= 5) {
        return res.status(400).json({ message: 'Maximum of 5 admins allowed' });
      }
      
      // If user is being demoted from admin, ensure at least one admin remains
      if (!isAdmin && users[0].isAdmin === 1 && adminCount[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot remove the last admin' });
      }
    }

    // Update the user
    await querySqlite(
      `UPDATE "Users" SET 
        "fullName" = ?, 
        phone = ?, 
        email = ?, 
        "isAdmin" = ?, 
        "updatedAt" = ?
      WHERE id = ?`,
      [
        fullName,
        phone,
        email || null,
        isAdmin ? 1 : 0,
        new Date().toISOString(),
        userId
      ]
    );

    // Get the updated user
    const updatedUser = await querySqlite(
      `SELECT id, username, "fullName", phone, email, "isAdmin", "lastLogin", "createdAt", "updatedAt" 
       FROM "Users" 
       WHERE id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Delete user (admin only) with direct SQLite
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const users = await querySqlite(
      'SELECT id, "isAdmin" FROM "Users" WHERE id = ?',
      [userId]
    );
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deletion of admin users for security
    if (users[0].isAdmin === 1) {
      return res.status(403).json({ message: 'Admin users cannot be deleted' });
    }

    // Check if the user has any related records
    const payments = await querySqlite(
      'SELECT COUNT(*) as count FROM "Payments" WHERE userId = ?',
      [userId]
    );

    const receipts = await querySqlite(
      'SELECT COUNT(*) as count FROM "Receipts" WHERE userId = ?',
      [userId]
    );

    // If user has related records, don't delete but mark as inactive
    if (payments[0].count > 0 || receipts[0].count > 0) {
      await querySqlite(
        `UPDATE "Users" SET 
          isActive = 0, 
          "updatedAt" = ?
        WHERE id = ?`,
        [new Date().toISOString(), userId]
      );

      return res.json({
        success: true,
        message: 'User has been deactivated due to existing records'
      });
    }

    // Delete the user if no related records
    await querySqlite(
      'DELETE FROM "Users" WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { oldPassword, newPassword } = req.body;
    
    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old password and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ 
        message: 'New password must contain at least one uppercase letter and one number' 
      });
    }
    
    // Find the user
    const users = await querySqlite(
      'SELECT id, password FROM "Users" WHERE id = ?',
      [userId]
    );
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    
    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Old password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await querySqlite(
      `UPDATE "Users" SET password = ?, "updatedAt" = ? WHERE id = ?`,
      [hashedPassword, new Date().toISOString(), userId]
    );
    
    // Optional: Log the activity (only if AdminAction table exists)
    try {
      // First check if AdminAction table exists
      const tables = await querySqlite("SELECT name FROM sqlite_master WHERE type='table' AND name='AdminAction'");
      
      if (tables && tables.length > 0) {
        await querySqlite(
          `INSERT INTO "AdminAction" (actionType, targetId, actionData, initiatedBy, status, "createdAt", "updatedAt") 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            'RESET_PASSWORD',
            userId,
            JSON.stringify({ userId }),
            req.user.id,
            'COMPLETED',
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
      }
    } catch (logError) {
      console.error('Error logging admin action:', logError);
      // Continue even if logging fails
    }
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Change password with direct SQLite
exports.changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Find the user
    const users = await querySqlite(
      `SELECT id, password FROM "Users" WHERE id = ?`,
      [req.user.id]
    );
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = users[0];
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await querySqlite(
      `UPDATE "Users" SET password = ?, "updatedAt" = ? WHERE id = ?`,
      [hashedPassword, new Date().toISOString(), req.user.id]
    );
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// DO NOT CHANGE THIS EXPORT. Export the entire exports object instead of individual functions
module.exports = exports;