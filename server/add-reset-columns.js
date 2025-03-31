// server/add-reset-columns.js
const sequelize = require('./config/database');

async function addResetColumns() {
  try {
    console.log('Starting to add resetToken columns to Users table...');
    
    // SQLite only supports adding columns, one at a time
    await sequelize.query('ALTER TABLE Users ADD COLUMN resetToken TEXT');
    console.log('Added resetToken column');
    
    await sequelize.query('ALTER TABLE Users ADD COLUMN resetTokenExpiry DATETIME');
    console.log('Added resetTokenExpiry column');
    
    console.log('All columns successfully added!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
}

addResetColumns();