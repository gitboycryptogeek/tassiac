// server/update-schema.js
const sequelize = require('./config/database');
const Payment = require('./models/Payment');

async function updateSchema() {
  try {
    // This will add the new columns without dropping existing data
    await sequelize.sync({ alter: true });
    console.log('Database schema updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating database schema:', error);
    process.exit(1);
  }
}

updateSchema();