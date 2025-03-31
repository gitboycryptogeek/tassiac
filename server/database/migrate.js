const sequelize = require('../config/database');

async function migrate() {
  try {
    // Add diagnostic queries
    console.log('Checking database state...');
    
    const tables = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Existing tables:', tables[0]);

    const columns = await sequelize.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);
    console.log('Table columns:', columns[0]);

    // Create Users table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Users" (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        "fullName" VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        "isAdmin" BOOLEAN DEFAULT FALSE,
        "lastLogin" TIMESTAMP,
        "resetToken" VARCHAR(255),
        "resetTokenExpiry" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL
      );
    `);

    // Create Payments table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Payments" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES "Users"(id),
        amount DECIMAL(10,2) NOT NULL,
        "paymentType" VARCHAR(50) NOT NULL,
        "paymentMethod" VARCHAR(50),
        description TEXT,
        reference VARCHAR(100),
        "transactionId" VARCHAR(100),
        status VARCHAR(20),
        "receiptNumber" VARCHAR(50),
        "isExpense" BOOLEAN DEFAULT FALSE,
        "addedBy" INTEGER,
        "paymentDate" TIMESTAMP,
        "platformFee" DECIMAL(10,2),
        "titheDistribution" JSONB,
        department VARCHAR(50),
        "isPromoted" BOOLEAN DEFAULT FALSE,
        "endDate" TIMESTAMP,
        "customFields" JSONB,
        "targetGoal" DECIMAL(10,2),
        "isTemplate" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL
      );
    `);

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();