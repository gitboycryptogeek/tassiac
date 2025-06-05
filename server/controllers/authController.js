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
  console.log(logMessage);
  
  return logMessage;
}
exports.logout = (req, res) => {
  debugLog('=== LOGOUT ATTEMPT STARTED ===');
  // If using server-side sessions primarily:
  // req.session.destroy(err => {
  //   if (err) {
  //     debugLog('Error destroying session:', err);
  //     return sendResponse(res, 500, false, null, 'Could not log out.');
  //   }
  //   res.clearCookie('connect.sid'); // Clear the session cookie (name might vary)
  //   debugLog('User logged out successfully, session destroyed.');
  //   return sendResponse(res, 200, true, null, 'Logged out successfully.');
  // });

  // If primarily JWT-based, logout is mostly a client-side token removal.
  // The server can optionally have a token blacklist if needed for immediate invalidation.
  // For now, a simple success response is fine as the client clears the token.
  debugLog(`User ${req.user?.id || 'Unknown'} logged out (token will be cleared by client).`);
  return sendResponse(res, 200, true, null, 'Logged out successfully. Please clear your token client-side.');
};

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

// Helper to check for view-only admin (placeholder logic)
// In a real app, this should check a 'role' field or a list of view-only admin IDs/usernames.
const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  // Example: Check if username is admin3, admin4, or admin5
  const viewOnlyUsernames = ['admin3', 'admin4', 'admin5'];
  // Example: Check if ID is one of the view-only IDs (replace with actual IDs)
  // const viewOnlyIds = [3, 4, 5]; // Replace with actual IDs from your DB after creation
  // return viewOnlyUsernames.includes(user.username) || viewOnlyIds.includes(user.id);
  return viewOnlyUsernames.includes(user.username);
};

// Log Action for Admin Activity
async function logAdminActivity(actionType, targetId, initiatedBy, actionData = {}) {
  try {
    await prisma.adminAction.create({
      data: {
        actionType,
        targetId: String(targetId), // Ensure targetId is a string
        initiatedBy,
        actionData,
        status: 'COMPLETED', // Assuming actions here are completed immediately
      },
    });
    debugLog(`Admin activity logged: ${actionType} for target ${targetId} by user ${initiatedBy}`);
  } catch (error) {
    debugLog(`Error logging admin activity for ${actionType} on ${targetId}:`, error.message);
    // Do not let logging failure stop the main operation
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

    debugLog(`Prisma: Looking up user: ${username}`);
    const user = await prisma.user.findUnique({
      where: { username: username },
    });

    if (!user || !user.isActive) {
      debugLog(`Prisma: No active user found or user is inactive: ${username}`);
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
      username: user.username,
      isAdmin: user.isAdmin, // Prisma schema defines this as Boolean
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
    await logAdminActivity('USER_LOGIN', user.id, user.id, { ip: req.ip }); // Log user login as an "admin" action on their own account

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

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email ? email : undefined },
          { phone: phone }
        ],
      },
    });

    if (existingUser) {
      let message = 'User already exists.';
      if (existingUser.username === username) message = 'Username already exists.';
      else if (email && existingUser.email === email) message = 'Email already registered.';
      else if (existingUser.phone === phone) message = 'Phone number already registered.';
      debugLog(`Registration failed: ${message}`, { username, email, phone });
      return sendResponse(res, 400, false, null, message, { code: 'USER_EXISTS' });
    }

    if (isAdmin) {
        const adminCount = await prisma.user.count({ where: { isAdmin: true } });
        if (adminCount >= 5) {
            debugLog('Admin limit reached. Cannot create new admin.');
            return sendResponse(res, 400, false, null, 'Maximum number of admin users (5) reached.', { code: 'ADMIN_LIMIT_REACHED' });
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        fullName,
        phone,
        email: email || null,
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
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
      select: {
        id: true, username: true, fullName: true, email: true, phone: true,
        isAdmin: true, lastLogin: true, isActive: true, createdAt: true, updatedAt: true,
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
      select: {
        id: true, username: true, fullName: true, email: true, phone: true,
        isAdmin: true, lastLogin: true, isActive: true, createdAt: true, updatedAt: true,
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
    const { fullName, phone, email, isAdmin, isActive } = req.body;
    const numericUserId = parseInt(userId);

    if (isNaN(numericUserId)) {
      return sendResponse(res, 400, false, null, 'Invalid User ID format.', { code: 'INVALID_USER_ID' });
    }

    const userToUpdate = await prisma.user.findUnique({ where: { id: numericUserId } });

    if (!userToUpdate) {
      debugLog(`User not found for update: ID ${numericUserId}`);
      return sendResponse(res, 404, false, null, 'User not found.', { code: 'USER_NOT_FOUND' });
    }

    if (typeof isAdmin === 'boolean' && userToUpdate.isAdmin !== isAdmin) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true, isActive: true } }); // Count only active admins
      if (isAdmin && adminCount >= 5) {
        debugLog('Admin limit reached. Cannot promote user.');
        return sendResponse(res, 400, false, null, 'Maximum number of admin users (5) reached.', { code: 'ADMIN_LIMIT_REACHED' });
      }
      if (!isAdmin && userToUpdate.isAdmin && adminCount <= 1) {
         if (userToUpdate.id === req.user.id) {
            debugLog('Attempt to demote self as last admin.');
            return sendResponse(res, 400, false, null, 'You cannot demote yourself as the last admin.', { code: 'CANNOT_SELF_DEMOTE_LAST_ADMIN' });
        }
        debugLog('Cannot remove the last active admin.');
        return sendResponse(res, 400, false, null, 'Cannot remove the last active admin user.', { code: 'CANNOT_DEMOTE_LAST_ADMIN' });
      }
    }

    if (userToUpdate.id === req.user.id) {
        if (typeof isAdmin === 'boolean' && !isAdmin && userToUpdate.isAdmin) {
            const adminCount = await prisma.user.count({ where: { isAdmin: true, isActive: true } });
            if (adminCount <= 1) {
                 debugLog('Attempt to self-demote as last admin.');
                 return sendResponse(res, 400, false, null, 'You cannot demote yourself as the last admin.', { code: 'CANNOT_SELF_DEMOTE_LAST_ADMIN' });
            }
        }
        if (typeof isActive === 'boolean' && !isActive) {
            debugLog('Attempt to self-deactivate.');
            return sendResponse(res, 400, false, null, 'You cannot deactivate your own account.', { code: 'CANNOT_SELF_DEACTIVATE' });
        }
    }

    const updateData = {
        fullName: fullName !== undefined ? fullName : userToUpdate.fullName,
        phone: phone !== undefined ? phone : userToUpdate.phone,
        email: email !== undefined ? (email || null) : userToUpdate.email,
        isAdmin: typeof isAdmin === 'boolean' ? isAdmin : userToUpdate.isAdmin,
        isActive: typeof isActive === 'boolean' ? isActive : userToUpdate.isActive,
    };

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
        return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot delete users.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { userId } = req.params;
    const numericUserId = parseInt(userId);

    if (isNaN(numericUserId)) {
      return sendResponse(res, 400, false, null, 'Invalid User ID format.', { code: 'INVALID_USER_ID' });
    }

    const userToDelete = await prisma.user.findUnique({ where: { id: numericUserId } });

    if (!userToDelete) {
      debugLog(`User not found for deletion: ID ${numericUserId}`);
      return sendResponse(res, 404, false, null, 'User not found.', { code: 'USER_NOT_FOUND' });
    }

    if (userToDelete.id === req.user.id) {
        debugLog('Attempt to delete self.');
        return sendResponse(res, 400, false, null, 'You cannot delete/deactivate your own account.', { code: 'CANNOT_DELETE_SELF' });
    }
    
    if (userToDelete.isAdmin) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true, isActive: true } });
      if (adminCount <= 1) {
        debugLog('Attempt to delete the last active admin.');
        return sendResponse(res, 400, false, null, 'Cannot delete or deactivate the last active admin user.', { code: 'CANNOT_DELETE_LAST_ADMIN' });
      }
    }

    // Soft delete
    const deactivatedUser = await prisma.user.update({
      where: { id: numericUserId },
      data: { 
        isActive: false,
        // To preserve uniqueness if user wants to re-register later with same username/email/phone
        // we append a timestamp to make them unique.
        // Alternatively, set them to NULL if your schema allows and you have a different re-registration policy.
        username: `${userToDelete.username}_deleted_${Date.now()}`,
        email: userToDelete.email ? `${userToDelete.email}_deleted_${Date.now()}` : null,
        phone: `${userToDelete.phone}_deleted_${Date.now()}`
      },
    });

    await logAdminActivity('ADMIN_DEACTIVATE_USER', deactivatedUser.id, req.user.id, { deactivatedUsername: userToDelete.username });
    debugLog(`User deactivated by admin ${req.user.username}: User ${userToDelete.username}`);
    return sendResponse(res, 200, true, { userId: numericUserId, status: 'deactivated' }, 'User deactivated successfully.');

  } catch (error) {
    debugLog('CRITICAL ERROR in deleteUser process:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error deactivating user.', {
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : error.message,
    });
  } finally {
    debugLog('=== DELETE USER ATTEMPT FINISHED (ADMIN) ===');
  }
};

// Reset user password by Admin (sets a new password directly)
exports.resetUserPassword = async (req, res) => {
  debugLog('=== ADMIN RESET USER PASSWORD ATTEMPT STARTED ===');
  try {
    if (isViewOnlyAdmin(req.user)) {
        debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to reset password.`);
        return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot reset passwords.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }
    const errors = validationResult(req); // Assuming validation rules for newPassword are in authRoutes.js
    if (!errors.isEmpty()) {
      debugLog('Validation errors on password reset:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { userId } = req.params;
    const { newPassword } = req.body;
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
    
    // Prevent admin from resetting their own password through this admin-specific route
    // They should use the regular 'change password' flow.
    if (numericUserId === req.user.id) {
        debugLog('Admin attempted to reset their own password via admin reset route.');
        return sendResponse(res, 400, false, null, "Admins should use the 'Change Password' feature for their own account.", { code: 'ADMIN_SELF_RESET_NOT_ALLOWED'});
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
    
    await logAdminActivity('USER_CHANGE_OWN_PASSWORD', userId, userId);
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