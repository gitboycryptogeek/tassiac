// server/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// FORCE production mode when on Heroku
if (process.env.DATABASE_URL) {
  console.log('PRODUCTION ENVIRONMENT DETECTED - Using PostgreSQL');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: console.log
  });
} else {
  console.log('DEVELOPMENT ENVIRONMENT - Using SQLite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
}

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    console.log('Dialect being used:', sequelize.getDialect());
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

testConnection();

module.exports = sequelize;