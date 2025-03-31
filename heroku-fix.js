const { sequelize, models } = require('./server/models');
const bcrypt = require('bcrypt');

async function fixDatabase() {
  console.log('Executing critical database rebuild');
  
  try {
    // Reset database schema without postgres-specific grants
    await sequelize.query('DROP SCHEMA IF EXISTS public CASCADE');
    await sequelize.query('CREATE SCHEMA public');
    await sequelize.query('GRANT ALL ON SCHEMA public TO public');
    
    // Force create all tables with correct capitalization
    console.log('Creating tables with proper case sensitivity');
    await sequelize.sync({ force: true });
    
    // Create admin account
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('Admin123!', salt);
    
    console.log('Creating admin user');
    await models.User.create({
      username: 'admin',
      password,
      fullName: 'System Administrator',
      email: 'admin@tassiac.church',
      phone: '1000000001',
      isAdmin: true
    });
    
    console.log('Database reset completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixDatabase();