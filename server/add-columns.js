// server/add-columns.js
const sequelize = require('./config/database');

async function addColumns() {
  try {
    console.log('Starting to add new columns to Payments table...');
    
    // SQLite only supports adding columns, one at a time
    await sequelize.query('ALTER TABLE Payments ADD COLUMN endDate TEXT');
    console.log('Added endDate column');
    
    await sequelize.query('ALTER TABLE Payments ADD COLUMN customFields TEXT');
    console.log('Added customFields column');
    
    await sequelize.query('ALTER TABLE Payments ADD COLUMN targetGoal DECIMAL(10, 2)');
    console.log('Added targetGoal column');
    
    console.log('All columns successfully added!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
}

addColumns();