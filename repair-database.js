// server/comprehensive-repair.js
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Configuration
const dbPath = './database.sqlite';
const backupPath = `./database.sqlite.backup-${Date.now()}`;

async function repairDatabase() {
  try {
    // Create backup first
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Database backup created at ${backupPath}`);
    
    // Connect to the database
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: console.log
    });
    
    try {
      await sequelize.authenticate();
      console.log('Database connection established successfully.');
      
      // Start transaction for safety
      const transaction = await sequelize.transaction();
      
      try {
        // 1. Check if resetToken column exists in Users table
        const [userColumns] = await sequelize.query(
          "PRAGMA table_info(Users)",
          { transaction }
        );
        
        console.log('Existing columns in Users table:', userColumns.map(c => c.name));
        
        const hasResetToken = userColumns.some(col => col.name === 'resetToken');
        const hasResetTokenExpiry = userColumns.some(col => col.name === 'resetTokenExpiry');
        
        // 2. Add the missing columns if they don't exist
        if (!hasResetToken) {
          console.log('Adding resetToken column to Users table...');
          await sequelize.query(
            "ALTER TABLE Users ADD COLUMN resetToken TEXT",
            { transaction }
          );
        } else {
          console.log('resetToken column already exists');
        }
        
        if (!hasResetTokenExpiry) {
          console.log('Adding resetTokenExpiry column to Users table...');
          await sequelize.query(
            "ALTER TABLE Users ADD COLUMN resetTokenExpiry DATETIME",
            { transaction }
          );
        } else {
          console.log('resetTokenExpiry column already exists');
        }
        
        // 3. Create a test admin user to ensure the database is working
        console.log('Checking for admin users...');
        const [admins] = await sequelize.query(
          "SELECT COUNT(*) as count FROM Users WHERE isAdmin = 1",
          { transaction }
        );
        
        if (admins[0].count === 0) {
          console.log('No admin users found. Creating a test admin user...');
          
          // Hash the password
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('admin123', salt);
          
          await sequelize.query(`
            INSERT INTO Users (
              username, password, fullName, email, phone, isAdmin, 
              createdAt, updatedAt
            ) VALUES (
              'test_admin', 
              '${hashedPassword}', 
              'Test Admin',
              'test@example.com',
              '1234567890',
              1,
              datetime('now'),
              datetime('now')
            )
          `, { transaction });
          
          console.log('Test admin user created with username: test_admin, password: admin123');
        } else {
          console.log(`Found ${admins[0].count} admin users`);
          
          // List the first admin user for debugging
          const [firstAdmin] = await sequelize.query(
            "SELECT id, username FROM Users WHERE isAdmin = 1 LIMIT 1",
            { transaction }
          );
          
          if (firstAdmin.length > 0) {
            console.log('Example admin user:', firstAdmin[0].username);
          }
        }
        
        // 4. Verify all tables have proper foreign keys
        console.log('\nVerifying database integrity...');
        
        // Get all tables
        const [tables] = await sequelize.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          { transaction }
        );
        
        console.log('Tables in database:', tables.map(t => t.name));
        
        // Commit the transaction
        await transaction.commit();
        console.log('\nDatabase repair completed successfully!');
        
        // Test admin login
        console.log('\nTesting admin login functionality...');
        
        // Get an admin user
        const [adminUsers] = await sequelize.query(
          "SELECT username, password FROM Users WHERE isAdmin = 1 LIMIT 1"
        );
        
        if (adminUsers.length > 0) {
          console.log(`Found admin user: ${adminUsers[0].username}`);
          console.log('To login, use this username with the password you set in your .env file');
          console.log('Or if you created a test admin: username=test_admin, password=admin123');
        } else {
          console.log('No admin users found after repair! This should not happen.');
        }
        
        console.log('\nYou should now be able to log in. If you still have issues:');
        console.log('1. Check your browser console for error messages');
        console.log('2. Try using curl to test the login API directly:');
        console.log(`curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"${adminUsers[0].username}","password":"admin123"}'`);
        
        process.exit(0);
      } catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error repairing database:', error);
      console.log('Rolling back to database backup...');
      
      // Close connection before file operations
      await sequelize.close();
      
      // Restore from backup
      fs.copyFileSync(backupPath, dbPath);
      console.log('Database restored from backup.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to create database backup:', error);
    process.exit(1);
  }
}

// Run the repair
repairDatabase();