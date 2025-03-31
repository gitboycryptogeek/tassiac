// fix-table-names.js
const { sequelize, models } = require('./server/models');

async function fixTables() {
  console.log('Starting PostgreSQL table creation');
  
  try {
    // Force create all tables with lowercase names
    await sequelize.query('DROP SCHEMA public CASCADE');
    await sequelize.query('CREATE SCHEMA public');
    
    // Set default schema privileges
    await sequelize.query('GRANT ALL ON SCHEMA public TO postgres');
    await sequelize.query('GRANT ALL ON SCHEMA public TO public');
    
    // Force sync with proper casing
    await sequelize.sync({ force: true });
    
    // Create admin user
    await models.User.create({
      username: 'admin',
      password: 'Admin123!',
      fullName: 'System Administrator',
      email: 'admin@example.com',
      phone: '1000000001',
      isAdmin: true
    });
    
    console.log('Database reset complete with admin user created');
  } catch (error) {
    console.error('Error:', error);
  }
}

fixTables();