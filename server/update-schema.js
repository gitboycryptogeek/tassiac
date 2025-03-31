const sequelize = require('./config/database');
const User = require('./models/User');
const Payment = require('./models/Payment');

async function updateSchema() {
  try {
    console.log('Starting database schema update...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Found' : 'Not found');
    console.log('Node ENV:', process.env.NODE_ENV);

    // Wait for database connection
    try {
      await sequelize.authenticate();
      console.log('Database connection authenticated');
    } catch (error) {
      console.error('Database connection failed:', error);
      process.exit(1);
    }

    // This will add the new columns without dropping existing data
    await sequelize.sync({ alter: true });
    console.log('Database schema updated successfully!');

    // Initialize database if needed
    const { initializeDatabase } = require('./utils/dbInit');
    await initializeDatabase();
    console.log('Database initialization completed');

    if (require.main === module) {
      // Only exit if running directly (not required as a module)
      process.exit(0);
    }
  } catch (error) {
    console.error('Error updating database schema:', error);
    if (require.main === module) {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  updateSchema();
}

module.exports = { updateSchema };