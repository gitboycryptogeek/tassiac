// add-special-offering-column.js
const sequelize = require('./server/config/database');

async function addSpecialOfferingColumn() {
  try {
    console.log('Starting to add isSpecialOffering column to Payments table...');
    
    // SQLite only supports adding columns one at a time
    await sequelize.query('ALTER TABLE Payments ADD COLUMN isSpecialOffering BOOLEAN DEFAULT 0');
    console.log('Added isSpecialOffering column');
    
    // Update existing special offerings to set the flag
    await sequelize.query("UPDATE Payments SET isSpecialOffering = 1 WHERE paymentType LIKE 'SPECIAL%'");
    console.log('Updated existing special offerings');
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding column:', error);
    process.exit(1);
  }
}

addSpecialOfferingColumn();