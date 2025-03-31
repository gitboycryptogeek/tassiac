// special-offerings-cleanup.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const BACKUP_FOLDER = path.join(__dirname, 'backups');

// Ensure backup folder exists
if (!fs.existsSync(BACKUP_FOLDER)) {
  fs.mkdirSync(BACKUP_FOLDER, { recursive: true });
}

// Create a database backup before making changes
function backupDatabase() {
  const timestamp = Date.now();
  const backupPath = path.join(BACKUP_FOLDER, `database.sqlite.backup-${timestamp}`);
  
  console.log(`Creating database backup at ${backupPath}`);
  
  try {
    // Copy the database file
    fs.copyFileSync(DB_PATH, backupPath);
    console.log('Backup created successfully');
    return true;
  } catch (error) {
    console.error('Error creating backup:', error);
    return false;
  }
}

// Open database connection
function openDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        resolve(db);
      }
    });
  });
}

// Execute a query
function executeQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error(`Error executing query: ${sql}`, err);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Get query results
function executeSelect(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error(`Error executing query: ${sql}`, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Main cleanup function
async function cleanupSpecialOfferings() {
  console.log('Starting special offerings cleanup...');
  
  // Create backup first
  const backupSuccess = backupDatabase();
  if (!backupSuccess) {
    console.error('Failed to create database backup. Aborting cleanup.');
    process.exit(1);
  }
  
  let db;
  
  try {
    // Open database
    db = await openDatabase();
    
    // Start a transaction
    await executeQuery(db, 'BEGIN TRANSACTION');
    
    // Get all records with SPECIAL_ prefix
    const specialRecords = await executeSelect(db, 
      "SELECT id, paymentType, description, amount, targetGoal, status, receiptNumber, isTemplate, customFields FROM Payments WHERE paymentType LIKE 'SPECIAL_%'"
    );
    
    console.log(`Found ${specialRecords.length} records with SPECIAL_ prefix`);
    
    // Group records by payment type
    const recordsByType = {};
    specialRecords.forEach(record => {
      if (!recordsByType[record.paymentType]) {
        recordsByType[record.paymentType] = [];
      }
      recordsByType[record.paymentType].push(record);
    });
    
    // Process each group
    for (const [paymentType, records] of Object.entries(recordsByType)) {
      console.log(`\nProcessing ${records.length} records for ${paymentType}`);
      
      // Identify which records are templates and which are payments
      const templateCandidates = records.filter(r => 
        !r.receiptNumber && (r.targetGoal > 0 || (r.customFields && r.customFields.length > 10))
      );
      
      const paymentCandidates = records.filter(r => 
        r.receiptNumber || (r.amount > 0 && !templateCandidates.some(t => t.id === r.id))
      );
      
      console.log(`Found ${templateCandidates.length} template candidates and ${paymentCandidates.length} payment candidates`);
      
      // Identify the most suitable template
      let bestTemplate = null;
      if (templateCandidates.length > 0) {
        // Sort by having customFields, then by most recent
        templateCandidates.sort((a, b) => {
          const aHasCustomFields = a.customFields && a.customFields.length > 10;
          const bHasCustomFields = b.customFields && b.customFields.length > 10;
          
          if (aHasCustomFields && !bHasCustomFields) return -1;
          if (!aHasCustomFields && bHasCustomFields) return 1;
          
          // If tie on custom fields, prefer the one with isTemplate=1 already
          if (a.isTemplate === 1 && b.isTemplate !== 1) return -1;
          if (a.isTemplate !== 1 && b.isTemplate === 1) return 1;
          
          // Otherwise pick by ID (higher ID means more recent)
          return b.id - a.id;
        });
        
        bestTemplate = templateCandidates[0];
        console.log(`Selected best template: ID=${bestTemplate.id}, isTemplate=${bestTemplate.isTemplate}`);
        
        // Fix the template flag
        if (bestTemplate.isTemplate !== 1) {
          await executeQuery(db, 
            "UPDATE Payments SET isTemplate = 1 WHERE id = ?", 
            [bestTemplate.id]
          );
          console.log(`Updated isTemplate flag for record ${bestTemplate.id}`);
        }
        
        // Mark all other templates for update or deletion
        for (let i = 1; i < templateCandidates.length; i++) {
          if (templateCandidates[i].isTemplate === 1) {
            // This is incorrectly marked as a template - update to 0
            await executeQuery(db, 
              "UPDATE Payments SET isTemplate = 0 WHERE id = ?", 
              [templateCandidates[i].id]
            );
            console.log(`Updated isTemplate flag for record ${templateCandidates[i].id} from 1 to 0`);
          }
        }
      } else if (records.length > 0) {
        // No good template found, create one from the first record
        console.log('No template found, creating one from the first record');
        
        const baseRecord = records[0];
        const templateData = {
          userId: baseRecord.userId,
          paymentType: baseRecord.paymentType,
          paymentMethod: 'MANUAL',
          description: baseRecord.description || 'Special Offering',
          status: 'COMPLETED',
          isExpense: 0,
          isTemplate: 1,
          customFields: JSON.stringify({
            fullDescription: baseRecord.description || 'Special Offering',
            fields: []
          }),
          targetGoal: baseRecord.targetGoal || baseRecord.amount || 0,
          amount: baseRecord.targetGoal || baseRecord.amount || 0,
          paymentDate: baseRecord.paymentDate || new Date().toISOString(),
          endDate: null,
          isPromoted: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Insert new template
        const result = await executeQuery(db, `
          INSERT INTO Payments (
            userId, paymentType, paymentMethod, description, status, 
            isExpense, isTemplate, customFields, targetGoal, amount,
            paymentDate, endDate, isPromoted, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          templateData.userId, templateData.paymentType, templateData.paymentMethod,
          templateData.description, templateData.status, templateData.isExpense,
          templateData.isTemplate, templateData.customFields, templateData.targetGoal,
          templateData.amount, templateData.paymentDate, templateData.endDate,
          templateData.isPromoted, templateData.createdAt, templateData.updatedAt
        ]);
        
        console.log(`Created new template with ID ${result.lastID}`);
      }
      
      // Make sure all payment records have isTemplate=0
      for (const payment of paymentCandidates) {
        if (payment.isTemplate === 1) {
          await executeQuery(db, 
            "UPDATE Payments SET isTemplate = 0 WHERE id = ?", 
            [payment.id]
          );
          console.log(`Updated payment record ${payment.id}, set isTemplate=0`);
        }
      }
    }
    
    // Commit changes
    await executeQuery(db, 'COMMIT');
    
    console.log('\nCleanup completed successfully');
  } catch (error) {
    console.error('Error during special offerings cleanup:', error);
    
    // Rollback transaction on error
    if (db) {
      await executeQuery(db, 'ROLLBACK').catch(e => console.error('Error rolling back transaction:', e));
    }
  } finally {
    // Close database connection
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

// Run the cleanup script
cleanupSpecialOfferings().catch(error => {
  console.error('Unhandled error during cleanup:', error);
  process.exit(1);
});