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

      if (sequelize.getDialect() === 'postgres') {
        // For PostgreSQL, create schema if it doesn't exist
        await sequelize.query('CREATE SCHEMA IF NOT EXISTS public');
        
        // Drop and recreate tables in PostgreSQL (only in production)
        console.log('Recreating tables in PostgreSQL...');
        await sequelize.query('DROP TABLE IF EXISTS "Payments" CASCADE');
        await sequelize.query('DROP TABLE IF EXISTS "Users" CASCADE');
        
        // Force sync to create tables with proper casing
        await sequelize.sync({ force: true });
      } else {
        // For SQLite, just sync normally
        await sequelize.sync({ alter: true });
      }

      console.log('Database schema updated successfully!');

      // Initialize database
      const { initializeDatabase } = require('./utils/dbInit');
      await initializeDatabase();
      console.log('Database initialization completed');

    } catch (error) {
      console.error('Database operation failed:', error);
      process.exit(1);
    }

    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error in schema update:', error);
    if (require.main === module) {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  updateSchema();
}

module.exports = { updateSchema };