const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper to log with colors
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  switch(type) {
    case 'error':
      console.error(`${colors.red}[${timestamp}] ERROR: ${message}${colors.reset}`);
      break;
    case 'success':
      console.log(`${colors.green}[${timestamp}] SUCCESS: ${message}${colors.reset}`);
      break;
    case 'heading':
      console.log(`\n${colors.bright}${colors.cyan}=== ${message} ===${colors.reset}\n`);
      break;
    default:
      console.log(`${colors.blue}[${timestamp}] INFO: ${message}${colors.reset}`);
  }
}

// Path to your SQLite database
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Open database connection
function openDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

// Run a query with promises
function query(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Database inspection 
async function inspectSpecialOfferings(db) {
  log('SPECIAL OFFERINGS DATABASE INSPECTION', 'heading');
  
  try {
    // Count total special offerings
    const totalResult = await query(
      db, 
      "SELECT COUNT(*) as count FROM Payments WHERE paymentType LIKE 'SPECIAL\\_%'"
    );
    
    const totalCount = totalResult[0]?.count || 0;
    log(`Found ${totalCount} total records with SPECIAL_ prefix`);
    
    // Check status distribution
    const statusResults = await query(
      db, 
      "SELECT status, COUNT(*) as count FROM Payments WHERE paymentType LIKE 'SPECIAL\\_%' GROUP BY status"
    );
    
    log('Status distribution:');
    statusResults.forEach(result => {
      const { status, count } = result;
      if (status !== 'COMPLETED') {
        log(`  - ${status}: ${count} (THESE WILL BE MISSED BY THE API)`, 'warning');
      } else {
        log(`  - ${status}: ${count}`);
      }
    });
    
    // Get all special offerings for inspection
    const specialOfferings = await query(
      db,
      "SELECT id, paymentType, description, status, customFields FROM Payments WHERE paymentType LIKE 'SPECIAL\\_%' ORDER BY createdAt DESC"
    );
    
    log(`Performing detailed inspection on ${specialOfferings.length} special offerings`);
    
    // Analyze each offering
    const issues = [];
    
    for (const offering of specialOfferings) {
      const offeringInfo = {
        id: offering.id,
        paymentType: offering.paymentType,
        status: offering.status,
        issues: []
      };
      
      // Check status
      if (offering.status !== 'COMPLETED') {
        offeringInfo.issues.push('NON_COMPLETED_STATUS');
      }
      
      // Check custom fields format
      if (offering.customFields) {
        try {
          const customFieldsObj = JSON.parse(offering.customFields);
          
          if (!customFieldsObj.fullDescription) {
            offeringInfo.issues.push('MISSING_FULL_DESCRIPTION');
          }
          
          if (!Array.isArray(customFieldsObj.fields)) {
            offeringInfo.issues.push('INVALID_CUSTOM_FIELDS_FORMAT');
          }
        } catch (error) {
          offeringInfo.issues.push('CUSTOM_FIELDS_PARSE_ERROR');
        }
      }
      
      // If there are issues, add to issues array
      if (offeringInfo.issues.length > 0) {
        issues.push(offeringInfo);
      }
    }
    
    if (issues.length > 0) {
      log(`Found ${issues.length} offerings with issues:`, 'warning');
      issues.forEach((issue, index) => {
        log(`  ${index + 1}. ${issue.paymentType} (${issue.status}): ${issue.issues.join(', ')}`, 'warning');
      });
    } else {
      log('No issues found in special offerings data structure', 'success');
    }
    
    return {
      totalCount,
      statusDistribution: statusResults,
      issues
    };
    
  } catch (error) {
    log(`Error during inspection: ${error.message}`, 'error');
    throw error;
  }
}

// Fix special offerings with non-COMPLETED status
async function fixSpecialOfferingStatus(db) {
  log('FIXING SPECIAL OFFERINGS WITH NON-COMPLETED STATUS', 'heading');
  
  try {
    // Count non-completed offerings
    const nonCompletedResult = await query(
      db,
      "SELECT COUNT(*) as count FROM Payments WHERE paymentType LIKE 'SPECIAL\\_%' AND status != 'COMPLETED'"
    );
    
    const nonCompletedCount = nonCompletedResult[0]?.count || 0;
    
    if (nonCompletedCount === 0) {
      log('No special offerings with non-COMPLETED status found', 'success');
      return { fixed: 0 };
    }
    
    log(`Found ${nonCompletedCount} special offerings with non-COMPLETED status`, 'warning');
    
    // Update all non-completed special offerings
    await query(
      db,
      "UPDATE Payments SET status = 'COMPLETED' WHERE paymentType LIKE 'SPECIAL\\_%' AND status != 'COMPLETED'"
    );
    
    log(`Updated ${nonCompletedCount} special offerings to COMPLETED status`, 'success');
    
    return { fixed: nonCompletedCount };
    
  } catch (error) {
    log(`Error fixing special offering status: ${error.message}`, 'error');
    throw error;
  }
}

// Fix missing or invalid custom fields
async function fixCustomFields(db) {
  log('FIXING SPECIAL OFFERINGS WITH INVALID CUSTOM FIELDS', 'heading');
  
  try {
    // Get all special offerings
    const specialOfferings = await query(
      db,
      "SELECT id, description, customFields FROM Payments WHERE paymentType LIKE 'SPECIAL\\_%'"
    );
    
    log(`Checking custom fields for ${specialOfferings.length} special offerings`);
    
    let fixedCount = 0;
    
    for (const offering of specialOfferings) {
      let needsUpdate = false;
      let customFieldsObj = {};
      
      // Parse existing custom fields if they exist
      if (offering.customFields) {
        try {
          customFieldsObj = JSON.parse(offering.customFields);
        } catch (error) {
          log(`Error parsing custom fields for offering ${offering.id}: ${error.message}`, 'warning');
          customFieldsObj = {};
          needsUpdate = true;
        }
      } else {
        needsUpdate = true;
      }
      
      // Ensure fullDescription exists
      if (!customFieldsObj.fullDescription) {
        customFieldsObj.fullDescription = offering.description || 'Special Offering';
        needsUpdate = true;
      }
      
      // Ensure fields array exists
      if (!Array.isArray(customFieldsObj.fields)) {
        customFieldsObj.fields = [];
        needsUpdate = true;
      }
      
      // Update if needed
      if (needsUpdate) {
        await query(
          db,
          "UPDATE Payments SET customFields = ? WHERE id = ?",
          [JSON.stringify(customFieldsObj), offering.id]
        );
        fixedCount++;
        log(`Fixed custom fields for offering ${offering.id}`, 'success');
      }
    }
    
    if (fixedCount === 0) {
      log('No special offerings with invalid custom fields found', 'success');
    } else {
      log(`Fixed custom fields for ${fixedCount} special offerings`, 'success');
    }
    
    return { fixed: fixedCount };
    
  } catch (error) {
    log(`Error fixing custom fields: ${error.message}`, 'error');
    throw error;
  }
}

// Run all diagnostics and fixes
async function runDiagnosticAndFix() {
  let db;
  
  try {
    log('STARTING SPECIAL OFFERINGS DIAGNOSTIC AND FIX', 'heading');
    
    // Open database connection
    db = await openDatabase();
    
    // Run inspection first
    const inspectionResults = await inspectSpecialOfferings(db);
    
    // Fix status issues
    const statusFixResults = await fixSpecialOfferingStatus(db);
    
    // Fix custom fields issues
    const customFieldsFixResults = await fixCustomFields(db);
    
    // Run inspection again to verify fixes
    log('VERIFYING FIXES', 'heading');
    const verificationResults = await inspectSpecialOfferings(db);
    
    // Summary
    log('DIAGNOSTIC AND FIX SUMMARY', 'heading');
    log(`Total special offerings: ${inspectionResults.totalCount}`);
    log(`Fixed status issues: ${statusFixResults.fixed}`);
    log(`Fixed custom fields issues: ${customFieldsFixResults.fixed}`);
    
    if (verificationResults.issues.length === 0) {
      log('All issues have been resolved!', 'success');
    } else {
      log(`${verificationResults.issues.length} issues still remain`, 'warning');
    }
    
  } catch (error) {
    log(`Error running diagnostic and fix: ${error.message}`, 'error');
  } finally {
    // Close database connection
    if (db) {
      db.close();
    }
  }
}

// Run the script
runDiagnosticAndFix();