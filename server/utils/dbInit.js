// server/utils/dbInit.js
const bcrypt = require('bcrypt');
const User = require('../models/User');
const sequelize = require('../config/database');

// Function to initialize the database
async function initializeDatabase() {
  try {
    // Sync the database (create tables)
    await sequelize.sync({ force: false }); // Set to true to reset database
    console.log('Database synchronized successfully');
    
    // Check if we have any admin users
    const adminCount = await User.count({ where: { isAdmin: true } });
    
    // If no admins exist, create them from environment variables
    if (adminCount === 0) {
      console.log('No admin users found. Creating default admin accounts...');
      
      // Create admin users from environment variables
      const adminPromises = [];
      
      for (let i = 1; i <= 5; i++) {
        const username = process.env[`ADMIN${i}_USERNAME`];
        const password = process.env[`ADMIN${i}_PASSWORD`];
        
        if (username && password) {
          console.log(`Creating admin user: ${username}`);
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
      
      // If no admin credentials were found in env, create a default admin
      if (adminPromises.length === 0) {
        console.log('Creating default admin user: admin');
        adminPromises.push(
          User.create({
            username: 'admin',
            password: 'admin123', // Will be hashed via hooks
            fullName: 'System Admin',
            email: 'admin@tassiac.church',
            phone: '1000000001',
            isAdmin: true
          })
        );
      }
      
      await Promise.all(adminPromises);
      console.log('Admin accounts created successfully');
    } else {
      console.log(`${adminCount} admin users already exist`);
    }
    
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
}

module.exports = { initializeDatabase };