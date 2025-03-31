// server/add-is-template-column.js
const sequelize = require('./config/database');  // Note: Removed 'server/' from path

async function addIsTemplateColumn() {
  try {
    console.log('Adding isTemplate column to Payments table...');
    
    // Add the column
    await sequelize.query('ALTER TABLE Payments ADD COLUMN isTemplate BOOLEAN DEFAULT 0');
    console.log('Added isTemplate column');
    
    // Mark existing special offerings as templates
    await sequelize.query("UPDATE Payments SET isTemplate = 1 WHERE paymentType LIKE 'SPECIAL%'");
    console.log('Marked existing special offerings as templates');
    
    console.log('Successfully updated Payments table with isTemplate flag');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addIsTemplateColumn();