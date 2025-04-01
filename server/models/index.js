// server/models/index.js
const sequelize = require('../config/database');
const User = require('./User');
const Payment = require('./Payment');
const { AdminAction, AdminActionApproval } = require('./AdminAction');
const Notification = require('./Notification');
const Receipt = require('./Receipt');

// Initialize all models and relationships
const models = {
  User,
  Payment,
  AdminAction,
  AdminActionApproval,
  Notification,
  Receipt
};

// Sync all models with database
const syncDatabase = async (force = false) => {
  try {
    // Never force sync in production
    if (process.env.NODE_ENV === 'production') {
      console.log('Production environment detected - skipping force sync');
      // Only run migrations in production
      await sequelize.sync({ force: false });
    } else {
      await sequelize.sync({ force });
    }
    console.log('Database synced successfully');
    
    // Initialize admin accounts only if force is true AND not in production
    if (force && process.env.NODE_ENV !== 'production') {
      await initializeAdmins();
    }
  } catch (error) {
    console.error('Error syncing database:', error);
  }
};

// Initialize admin accounts from environment variables
const initializeAdmins = async () => {
  try {
    const adminPromises = [];
    
    for (let i = 1; i <= 5; i++) {
      const username = process.env[`ADMIN${i}_USERNAME`];
      const password = process.env[`ADMIN${i}_PASSWORD`];
      
      if (username && password) {
        adminPromises.push(
          User.create({
            username,
            password, // Will be hashed via hooks
            fullName: `Admin ${i}`,
            email: `admin${i}@tassiac.church`,
            phone: `10000000${i}`,
            isAdmin: true
          })
        );
      }
    }
    
    await Promise.all(adminPromises);
    console.log('Admin accounts initialized successfully');
  } catch (error) {
    console.error('Error initializing admin accounts:', error);
  }
};

module.exports = {
  sequelize,
  models,
  syncDatabase
};