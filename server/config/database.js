// server/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

if (process.env.DATABASE_URL) {
  // Production environment (Heroku)
  try {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      protocol: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });
    console.log('Production database configuration loaded');
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error);
    // Fallback to SQLite if DATABASE_URL is invalid
    console.log('Falling back to SQLite database');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: './database.sqlite',
      logging: false
    });
  }
} else {
  // Development environment
  console.log('Development environment - Using SQLite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
}

// Test database connection
sequelize.authenticate()
  .then(() => {
    console.log('Database connection established successfully.');
    console.log('Dialect being used:', sequelize.getDialect());
  })
  .catch(error => {
    console.error('Unable to connect to the database:', error);
  });

module.exports = sequelize;