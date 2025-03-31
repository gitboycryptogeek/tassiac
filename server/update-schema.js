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

      // Check if tables exist
      const tableExists = await sequelize.query(
        'SELECT * FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
        {
          bind: ['public', 'Payments'],
          type: sequelize.QueryTypes.SELECT
        }
      );

      // If tables don't exist, force create them
      const force = tableExists.length === 0;
      console.log(`Tables exist: ${!force}`);

      await sequelize.sync({ force });
      console.log(`Database schema ${force ? 'created' : 'updated'} successfully!`);

      if (force) {
        // Initialize database if needed
        const { initializeDatabase } = require('./utils/dbInit');
        await initializeDatabase();
        console.log('Database initialization completed');
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