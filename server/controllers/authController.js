// server/controllers/authController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'auth-controller-debug.log');

// Helper to write debug logs
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] AUTH_CONTROLLER: ${message}`;

  if (data !== null) {
    try {
      const MASK = '[REDACTED]';
      let sanitizedData = JSON.parse(JSON.stringify(data)); // Deep clone
      if (typeof sanitizedData === 'object' && sanitizedData !== null) {
        if (sanitizedData.password) sanitizedData.password = MASK;
        if (sanitizedData.currentPassword) sanitizedData.currentPassword = MASK;
        if (sanitizedData.newPassword) sanitizedData.newPassword = MASK;
        if (sanitizedData.oldPassword) sanitizedData.oldPassword = MASK;
      }
      const dataStr = JSON.stringify(sanitizedData);
      logMessage += ` | Data: ${dataStr}`;
    } catch (err) {
      logMessage += ` | Data: [Failed to stringify or sanitize: ${err.message}]`;
    }
  }
  console.log(logMessage); // Keep for dev visibility
  // fs.appendFileSync(LOG_FILE, logMessage + '\n'); // Uncomment if file logging is desired
  return logMessage;
}

// Helper for sending standardized responses
const sendResponse = (res, statusCode, success, data, message, errorDetails = null) => {
  const responsePayload = { success, message };
  if (data !== null && data !== undefined) {
    responsePayload.data = data;
  }
  if (errorDetails) {
    responsePayload.error = errorDetails;
  }
  return res.status(statusCode).json(responsePayload);
};

// Helper to check for view-only admin
const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  const viewOnlyUsernames = (process.env.VIEW_ONLY_ADMIN_USERNAMES || 'admin3,admin4,admin5').split(',');
  return viewOnlyUsernames.includes(user.username);
};

// Log Action for Admin Activity
async function logAdminActivity(actionType, targetId, initiatedBy, actionData = {}) {
  try {
    await prisma.adminAction.create({
      data: {
        actionType,
        targetId: String(targetId),
        initiatedById: initiatedBy,
        actionData,
        status: 'COMPLETED',
      },
    });
    debugLog(`Admin activity logged: ${actionType} for target ${targetId} by user ${initiatedBy}`);
  } catch (error) {
    debugLog(`Error logging admin activity for ${actionType} on ${targetId}:`, error.message);
  }
}

// Login controller
exports.login = async (req, res) => {
  debugLog('=== LOGIN ATTEMPT STARTED ===');
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      debugLog('Missing credentials');
      return sendResponse(res, 400, false, null, 'Username and password are required', {
        code: 'MISSING_CREDENTIALS',
      });
    }

    const normalizedUsername = username.toLowerCase(); // Normalize username to lowercase for lookup

    debugLog(`Prisma: Looking up user: ${normalizedUsername}`);
    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername }, // Query with normalized username
    });

    if (!user || !user.isActive) {
      debugLog(`Prisma: No active user found or user is inactive: ${normalizedUsername}`);
      return sendResponse(res, 401, false, null, 'Invalid username or password, or account inactive.', {
        code: 'AUTH_FAILED_INACTIVE',
      });
    }
    debugLog(`Prisma: User found: ${user.username}, ID: ${user.id}, isAdmin: ${user.isAdmin}, isActive: ${user.isActive}`);

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      debugLog('Prisma: Invalid password provided');
      return sendResponse(res, 401, false, null, 'Invalid username or password.', {
        code: 'AUTH_FAILED_PASSWORD',
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });
    debugLog('Prisma: Last login time updated successfully');

    const userForToken = {
      id: user.id,
      username: user.username, // Use the username from DB (should be normalized)
      isAdmin: user.isAdmin,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email
    };

    const token = jwt.sign(
      userForToken,
      process.env.JWT_SECRET || 'default-secret-key-for-tassiac-app',
      { expiresIn: '8h' }
    );
    debugLog('Prisma: JWT token generated successfully');

    const { password: _, resetToken: __, resetTokenExpiry: ___, ...userResponse } = user;
    // Log user login. Since `logAdminActivity` expects an admin ID, we use the user's own ID.
    await logAdminActivity('USER_LOGIN', user.id, user.id, { ip: req.ip });

    return sendResponse(res, 200, true, { user: userResponse, token }, 'Login successful');

  } catch (error) {
    debugLog('CRITICAL ERROR in Prisma login process:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error during authentication.', {
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
    });
  } finally {
    debugLog('=== LOGIN ATTEMPT FINISHED ===');
  }
};

// Register user (admin only)
exports.registerUser = async (req, res) => {
  debugLog('=== REGISTER USER ATTEMPT STARTED (ADMIN) ===');
  try {
    if (isViewOnlyAdmin(req.user)) {
        debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to register user.`);
        return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot register new users.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { username, password, fullName, phone, email, isAdmin = false } = req.body;
    const normalizedUsername = username.toLowerCase(); // Normalize username for storage

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: normalizedUsername }, // Check normalized username
          { email: email ? email.toLowerCase() : undefined }, // Optionally normalize email too
          { phone: phone } // Phone numbers might also need normalization/validation
        ],
      },
    });

    if (existingUser) {
      let message = 'User already exists.';
      if (existingUser.username === normalizedUsername) message = 'Username already exists.';
      else if (email && existingUser.email === email.toLowerCase()) message = 'Email already registered.';
      else if (existingUser.phone === phone) message = 'Phone number already registered.';
      debugLog(`Registration failed: ${message}`, { username, email, phone });
      return sendResponse(res, 400, false, null, message, { code: 'USER_EXISTS' });
    }

    if (isAdmin) {
        const adminCount = await prisma.user.count({ where: { isAdmin: true, isActive: true } });
        if (adminCount >= (parseInt(process.env.MAX_ADMIN_COUNT) || 5)) { // Use env var for max admins
            debugLog('Admin limit reached. Cannot create new admin.');
            return sendResponse(res, 400, false, null, `Maximum number of admin users (${parseInt(process.env.MAX_ADMIN_COUNT) || 5}) reached.`, { code: 'ADMIN_LIMIT_REACHED' });
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: normalizedUsername, // Save normalized username
        password: hashedPassword,
        fullName,
        phone,
        email: email ? email.toLowerCase() : null, // Optionally normalize email
        isAdmin,
        isActive: true,
      },
    });

    const { password: _, ...userResponse } = newUser;
    await logAdminActivity('ADMIN_CREATE_USER', newUser.id, req.user.id, { createdUsername: newUser.username, roleSet: isAdmin ? 'Admin' : 'User' });
    debugLog('User registered successfully by admin:', req.user.username, 'New user:', userResponse.username);
    return sendResponse(res, 201, true, { user: userResponse }, 'User registered successfully');

  } catch (error) {
    debugLog('CRITICAL ERROR in registration process:', error.message);
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { // Unique constraint failed
        let field = 'identifier';
        if (error.meta && Array.isArray(error.meta.target)) field = error.meta.target.join(', ');
        return sendResponse(res, 400, false, null, `The ${field} is already taken.`, { code: 'UNIQUE_CONSTRAINT_FAILED', field });
    }
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error during registration.', {
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
    });
  } finally {
    debugLog('=== REGISTER USER ATTEMPT FINISHED (ADMIN) ===');
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  debugLog('=== GET PROFILE ATTEMPT STARTED ===');
  try {
    if (!req.user || !req.user.id) {
      debugLog('Authentication required for profile.');
      return sendResponse(res, 401, false, null, 'Authentication required.', { code: 'UNAUTHENTICATED' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { // Explicitly select fields to exclude password and sensitive tokens
        id: true, username: true, fullName: true, email: true, phone: true,
        isAdmin: true, role: true, lastLogin: true, isActive: true, createdAt: true, updatedAt: true,
      },
    });

    if (!user) {
      debugLog(`User not found for ID: ${req.user.id}`);
      return sendResponse(res, 404, false, null, 'User not found.', { code: 'USER_NOT_FOUND' });
    }

    debugLog('Profile retrieved successfully:', user.username);
    return sendResponse(res, 200, true, { user }, 'Profile retrieved successfully.');

  } catch (error) {
    debugLog('CRITICAL ERROR in getProfile process:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving profile.', {
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
    });
  } finally {
    debugLog('=== GET PROFILE ATTEMPT FINISHED ===');
  }
};

// Get all users (admin only)
exports.getUsers = async (req, res) => {
  debugLog('=== GET ALL USERS ATTEMPT STARTED (ADMIN) ===');
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { // Exclude password
        id: true, username: true, fullName: true, email: true, phone: true,
        isAdmin: true, role: true, lastLogin: true, isActive: true, createdAt: true, updatedAt: true,
      },
    });

    debugLog(`Retrieved ${users.length} users.`);
    return sendResponse(res, 200, true, { users }, 'Users retrieved successfully.');

  } catch (error) {
    debugLog('CRITICAL ERROR in getUsers process:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving users.', {
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
    });
  } finally {
    debugLog('=== GET ALL USERS ATTEMPT FINISHED (ADMIN) ===');
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  debugLog('=== UPDATE USER ATTEMPT STARTED (ADMIN) ===');
  try {
    if (isViewOnlyAdmin(req.user)) {
        debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to update user.`);
        return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot update users.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }
    const { userId } = req.params;
    const { fullName, phone, email, isAdmin, isActive, role } = req.body; // Added role
    const numericUserId = parseInt(userId);

    if (isNaN(numericUserId)) {
      return sendResponse(res, 400, false, null, 'Invalid User ID format.', { code: 'INVALID_USER_ID' });
    }

    const userToUpdate = await prisma.user.findUnique({ where: { id: numericUserId } });

    if (!userToUpdate) {
      debugLog(`User not found for update: ID ${numericUserId}`);
      return sendResponse(res, 404, false, null, 'User not found.', { code: 'USER_NOT_FOUND' });
    }

    // Admin promotion/demotion logic
    if (typeof isAdmin === 'boolean' && userToUpdate.isAdmin !== isAdmin) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true, isActive: true } });
      const maxAdminCount = parseInt(process.env.MAX_ADMIN_COUNT) || 5;
      if (isAdmin && adminCount >= maxAdminCount) {
        debugLog('Admin limit reached. Cannot promote user.');
        return sendResponse(res, 400, false, null, `Maximum number of admin users (${maxAdminCount}) reached.`, { code: 'ADMIN_LIMIT_REACHED' });
      }
      if (!isAdmin && userToUpdate.isAdmin && adminCount <= 1) {
         if (userToUpdate.id === req.user.id) { // Current admin trying to demote themselves as the last admin
            debugLog('Attempt to demote self as last admin.');
            return sendResponse(res, 400, false, null, 'You cannot demote yourself as the last admin.', { code: 'CANNOT_SELF_DEMOTE_LAST_ADMIN' });
        }
        debugLog('Cannot remove the last active admin.');
        return sendResponse(res, 400, false, null, 'Cannot remove the last active admin user.', { code: 'CANNOT_DEMOTE_LAST_ADMIN' });
      }
    }

    // Self-update restrictions
    if (userToUpdate.id === req.user.id) {
        if (typeof isAdmin === 'boolean' && !isAdmin && userToUpdate.isAdmin) { // Admin trying to demote self
            const adminCount = await prisma.user.count({ where: { isAdmin: true, isActive: true } });
            if (adminCount <= 1) {
                 debugLog('Attempt to self-demote as last admin.');
                 return sendResponse(res, 400, false, null, 'You cannot demote yourself as the last admin.', { code: 'CANNOT_SELF_DEMOTE_LAST_ADMIN' });
            }
        }
        if (typeof isActive === 'boolean' && !isActive) { // Admin trying to deactivate self
            debugLog('Attempt to self-deactivate.');
            return sendResponse(res, 400, false, null, 'You cannot deactivate your own account.', { code: 'CANNOT_SELF_DEACTIVATE' });
        }
    }

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email ? email.toLowerCase() : null; // Normalize email on update too
    if (typeof isAdmin === 'boolean') updateData.isAdmin = isAdmin;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (role !== undefined) updateData.role = role; // Add role update

    const updatedUser = await prisma.user.update({
      where: { id: numericUserId },
      data: updateData,
    });

    const { password: _, ...userResponse } = updatedUser;
    await logAdminActivity('ADMIN_UPDATE_USER', updatedUser.id, req.user.id, { updatedFields: Object.keys(updateData) });
    debugLog('User updated successfully by admin:', req.user.username, 'Updated user:', userResponse.username);
    return sendResponse(res, 200, true, { user: userResponse }, 'User updated successfully.');

  } catch (error) {
    debugLog('CRITICAL ERROR in updateUser process:', error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        let field = 'identifier';
        if (error.meta && Array.isArray(error.meta.target)) field = error.meta.target.join(', ');
        return sendResponse(res, 400, false, null, `The ${field} is already taken by another user.`, { code: 'UNIQUE_CONSTRAINT_FAILED', field });
    }
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error updating user.', {
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
    });
  } finally {
    debugLog('=== UPDATE USER ATTEMPT FINISHED (ADMIN) ===');
  }
};

// Delete user (admin only) - Soft delete
exports.deleteUser = async (req, res) => {
  debugLog('=== DELETE USER ATTEMPT STARTED (ADMIN) ===');
  try {
    if (isViewOnlyAdmin(req.user)) {
      debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to delete user.`);
      // Make sure to RETURN after sending response
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot delete users.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { userId } = req.params;
    const numericUserId = parseInt(userId);

    if (isNaN(numericUserId)) {
      // Make sure to RETURN
      return sendResponse(res, 400, false, null, 'Invalid User ID format.', { code: 'INVALID_USER_ID' });
    }

    const userToDelete = await prisma.user.findUnique({ where: { id: numericUserId } });

    if (!userToDelete) {
      debugLog(`User not found for deletion: ID ${numericUserId}`);
      // Make sure to RETURN
      return sendResponse(res, 404, false, null, 'User not found.', { code: 'USER_NOT_FOUND' });
    }

    if (userToDelete.id === req.user.id) {
        debugLog('Attempt to delete self.');
        // Make sure to RETURN
        return sendResponse(res, 400, false, null, 'You cannot delete/deactivate your own account.', { code: 'CANNOT_DELETE_SELF' });
    }

    if (userToDelete.isAdmin && userToDelete.isActive) { // Check isActive for admin count
      const activeAdminCount = await prisma.user.count({ where: { isAdmin: true, isActive: true } });
      if (activeAdminCount <= 1) {
        debugLog('Attempt to delete the last active admin.');
        // Make sure to RETURN
        return sendResponse(res, 400, false, null, 'Cannot delete or deactivate the last active admin user.', { code: 'CANNOT_DELETE_LAST_ADMIN' });
      }
    }

    const mangledUsername = `<span class="math-inline">\{userToDelete\.username\}\_deleted\_</span>{Date.now()}`;
    const mangledEmail = userToDelete.email ? `<span class="math-inline">\{userToDelete\.email\}\_deleted\_</span>{Date.now()}` : null;
    const mangledPhone = `<span class="math-inline">\{userToDelete\.phone\}\_deleted\_</span>{Date.now()}`;

    await prisma.user.delete({
      where: { id: numericUserId },
    });

    debugLog(`User HARD DELETED by admin ${req.user.username}: User ID ${numericUserId}, Username ${userToDelete.username}`);
return sendResponse(res, 200, true, { userId: numericUserId, status: 'deleted_permanently' }, 'User permanently deleted.');
  } catch (error) {
    debugLog('CRITICAL ERROR in deleteUser process:', error.message);
    console.error(error); // Log the full error for server-side debugging
    // Only send a response if one hasn't been sent yet.
    if (!res.headersSent) {
      return sendResponse(res, 500, false, null, 'Server error deactivating user.', {
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
      });
    } else {
      // This case indicates an error occurred after the response was already partially sent,
      // which is a more complex issue, but the primary "headers already sent" is due to double-send.
      console.error("Error occurred after response headers were sent in deleteUser:", error);
    }
  } finally {
    debugLog('=== DELETE USER ATTEMPT FINISHED (ADMIN) ===');
  }
};

// Reset user password by Admin (sets a new password directly)
// This function assumes the route calling it has validation that *only* requires newPassword from an admin.
exports.resetUserPassword = async (req, res) => {
  debugLog('=== ADMIN RESET USER PASSWORD ATTEMPT STARTED ===');
  try {
    if (isViewOnlyAdmin(req.user)) {
        debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to reset password.`);
        return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot reset passwords.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors on password reset:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { userId } = req.params;
    const { newPassword } = req.body; // Only newPassword is expected from an admin reset
    const numericUserId = parseInt(userId);

    if (isNaN(numericUserId)) {
      return sendResponse(res, 400, false, null, 'Invalid User ID format.', { code: 'INVALID_USER_ID' });
    }

    if (!newPassword) {
      debugLog('New password not provided for admin reset.');
      return sendResponse(res, 400, false, null, 'New password is required.', { code: 'NEW_PASSWORD_REQUIRED' });
    }

    const userToReset = await prisma.user.findUnique({ where: { id: numericUserId } });
    if (!userToReset) {
      debugLog(`User not found for password reset: ID ${numericUserId}`);
      return sendResponse(res, 404, false, null, 'User not found.', { code: 'USER_NOT_FOUND' });
    }
    
    if (numericUserId === req.user.id) { // Admin trying to reset their own password via this special route
        debugLog('Admin attempted to reset their own password via admin reset route.');
        return sendResponse(res, 400, false, null, "Admins should use the 'Change Password' feature for their own account (via their profile).", { code: 'ADMIN_SELF_RESET_VIA_ADMIN_ROUTE_NOT_ALLOWED'});
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: numericUserId },
      data: { password: hashedPassword, updatedAt: new Date(), resetToken: null, resetTokenExpiry: null },
    });

    await logAdminActivity('ADMIN_RESET_USER_PASSWORD', userToReset.id, req.user.id, { targetUsername: userToReset.username });
    debugLog(`Password reset by admin ${req.user.username} for user: ${userToReset.username}`);
    return sendResponse(res, 200, true, null, 'User password reset successfully by admin.');

  } catch (error) {
    debugLog('CRITICAL ERROR in admin resetUserPassword process:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error resetting user password.', {
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
    });
  } finally {
    debugLog('=== ADMIN RESET USER PASSWORD ATTEMPT FINISHED ===');
  }
};

// Change own password (for logged-in user)
exports.changePassword = async (req, res) => {
  debugLog('=== CHANGE OWN PASSWORD ATTEMPT STARTED ===');
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors on change password:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!userId) {
      debugLog('User ID not found in token for password change.');
      return sendResponse(res, 401, false, null, 'Authentication error.', { code: 'UNAUTHENTICATED' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      debugLog(`User not found for password change: ID ${userId}`);
      return sendResponse(res, 404, false, null, 'User not found.', { code: 'USER_NOT_FOUND' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      debugLog('Current password incorrect for password change.');
      return sendResponse(res, 401, false, null, 'Current password is incorrect.', { code: 'AUTH_FAILED_PASSWORD' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, updatedAt: new Date() },
    });
    
    // Log this as a user action rather than admin action, initiated by self
    await logAdminActivity('USER_CHANGE_OWN_PASSWORD', userId, userId); // Or a different logging function if needed
    debugLog(`Password changed successfully for user: ${user.username}`);
    return sendResponse(res, 200, true, null, 'Password changed successfully.');

  } catch (error) {
    debugLog('CRITICAL ERROR in changePassword process:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error changing password.', {
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
    });
  } finally {
    debugLog('=== CHANGE OWN PASSWORD ATTEMPT FINISHED ===');
  }
};

// Logout function
exports.logout = (req, res) => {
  debugLog('=== LOGOUT ATTEMPT STARTED ===');
  // For JWT, logout is primarily client-side (token removal).
  // Server can optionally maintain a token blacklist for immediate invalidation if needed.
  // Here, we just acknowledge the request.
  const userId = req.user ? req.user.id : 'UnknownUser'; // req.user might not be set if token was already invalid/cleared client-side
  debugLog(`User ${userId} logout request received. Client should clear token.`);
  return sendResponse(res, 200, true, null, 'Logged out successfully. Token should be cleared by client.');
};