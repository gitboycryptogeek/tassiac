const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite database - MODIFY THIS IF NEEDED
const DB_PATH = path.join(__dirname, 'database.sqlite');
console.log('Looking for database at:', DB_PATH);

// Open database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Step 1: List all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err.message);
      db.close();
      return;
    }
    
    console.log('Tables in database:');
    tables.forEach(table => {
      console.log(`- ${table.name}`);
    });
    
    // Step 2: Check the Payments table structure
    db.all("PRAGMA table_info(Payments)", [], (err, columns) => {
      if (err) {
        console.error('Error getting table structure:', err.message);
        db.close();
        return;
      }
      
      console.log('\nPayments table columns:');
      columns.forEach(col => {
        console.log(`- ${col.name} (${col.type})`);
      });
      
      // Step 3: Sample some payment records
      db.all("SELECT id, paymentType, description, status FROM Payments LIMIT 10", [], (err, payments) => {
        if (err) {
          console.error('Error fetching payments:', err.message);
          db.close();
          return;
        }
        
        console.log('\nSample payments:');
        if (payments.length === 0) {
          console.log('No payment records found');
        } else {
          payments.forEach((payment, i) => {
            console.log(`[${i+1}] ID: ${payment.id}, Type: ${payment.paymentType}, Status: ${payment.status}, Description: ${payment.description}`);
          });
        }
        
        // Step 4: Look for payment records with names that might be special offerings
        db.all("SELECT id, paymentType, description, status FROM Payments WHERE paymentType LIKE '%SPECIAL%' OR description LIKE '%special%offering%' LIMIT 20", [], (err, specialPayments) => {
          if (err) {
            console.error('Error searching for special offerings:', err.message);
          } else {
            console.log('\nPossible special offerings (using broader search):');
            if (specialPayments.length === 0) {
              console.log('No potential special offerings found');
            } else {
              specialPayments.forEach((payment, i) => {
                console.log(`[${i+1}] ID: ${payment.id}, Type: ${payment.paymentType}, Status: ${payment.status}, Description: ${payment.description}`);
              });
            }
          }
          
          // Close the database connection
          db.close();
        });
      });
    });
  });
});