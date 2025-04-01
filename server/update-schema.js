const sequelize = require('./config/database');
const User = require('./models/User');
const Payment = require('./models/Payment');

async function updateSchema() {
  try {
    console.log('Starting database schema update...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Found' : 'Not found');
    console.log('Node ENV:', process.env.NODE_ENV);

    try {
      await sequelize.authenticate();
      console.log('Database connection authenticated');

      if (sequelize.getDialect() === 'postgres') {
        // For PostgreSQL, only create schema if it doesn't exist
        await sequelize.query('CREATE SCHEMA IF NOT EXISTS public');
        
        // Check if tables exist first
        const [tables] = await sequelize.query(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
        );
        
        if (!tables.some(t => t.tablename === 'Users')) {
          console.log('Tables not found, running initial sync...');
          // Only sync if tables don't exist
          await sequelize.sync({ force: false });
        } else {
          console.log('Tables already exist, skipping sync');
          return;
        }
      } else {
        // For SQLite, just sync normally
        await sequelize.sync({ alter: true });
      }

      console.log('Database schema updated successfully!');

      // Only initialize if no users exist
      const adminCount = await User.count({ where: { isAdmin: true } });
      if (adminCount === 0) {
        console.log('No admin users found. Creating default admin accounts...');
        const { initializeDatabase } = require('./utils/dbInit');
        await initializeDatabase();
        console.log('Database initialization completed');
      } else {
        console.log(`Found ${adminCount} existing admin users, skipping initialization`);
      }

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