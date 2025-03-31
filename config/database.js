const config = {
  development: {
    dialect: 'sqlite',
    storage: './database.sqlite'
  },
  production: {
    dialect: 'postgres',
    url: process.env.DATABASE_URL,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];
