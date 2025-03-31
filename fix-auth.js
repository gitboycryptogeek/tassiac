// fix-auth.js
const fs = require('fs');
const path = require('path');

// Path to auth controller
const authPath = path.join(__dirname, 'server', 'controllers', 'authController.js');

// Read the file
let content = fs.readFileSync(authPath, 'utf8');

// Add database type detection
const patch = `
// Direct database query function based on environment
function querySqlite(sql, params = []) {
  // Check if we're in production with Postgres
  if (process.env.DATABASE_URL) {
    debugLog('POSTGRES ENVIRONMENT DETECTED - Using Sequelize queries');
    return sequelize.query(sql, {
      replacements: params,
      type: sequelize.QueryTypes.SELECT
    });
  }
  
  // Fall back to SQLite for development
  debugLog('DEVELOPMENT ENVIRONMENT - Using direct SQLite');
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        debugLog('Error opening database:', err);
        return reject(err);
      }
    });
    
    debugLog(\`Executing SQLite query: \${sql}\`, { params });
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        debugLog('SQLite query error:', err);
        db.close();
        return reject(err);
      }
      
      debugLog(\`SQLite query returned \${rows ? rows.length : 0} rows\`);
      resolve(rows);
      
      db.close((closeErr) => {
        if (closeErr) debugLog('Error closing database:', closeErr);
      });
    });
  });
}`;

// Replace the function
content = content.replace(/function querySqlite\(sql, params = \[\]\) \{[\s\S]+?}\)/g, patch);

// Save the file
fs.writeFileSync(authPath, content);
console.log('Auth controller fixed successfully');