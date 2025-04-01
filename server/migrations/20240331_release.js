const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Only run if tables don't exist
    const tableExists = await queryInterface.showAllTables()
      .then(tables => tables.includes('Users'));
    
    if (!tableExists) {
      // Run initial schema creation
      await require('./20240331_init').up(queryInterface, Sequelize);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Migration cannot be reversed in production
  }
};
