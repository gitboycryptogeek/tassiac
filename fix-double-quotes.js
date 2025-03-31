// fix-double-quotes.js
const fs = require('fs');
const path = require('path');

// Target the authController.js file
const authControllerPath = path.join(__dirname, 'server', 'controllers', 'authController.js');
let content = fs.readFileSync(authControllerPath, 'utf8');

// Replace the problematic querySqlite function with a corrected version
const fixedFunction = `// Direct database query function based on environment
function querySqlite(sql, params = []) {
  // Check if we're in production with Postgres
  if (process.env.DATABASE_URL) {
    debugLog('POSTGRES ENVIRONMENT DETECTED - Using Sequelize query');
    
    // For PostgreSQL, ensure we use double quotes for table and column names
    // But prevent double-quoting columns that are already quoted
    let modifiedSql = sql
      .replace(/FROM Users/g, 'FROM "Users"')
      .replace(/FROM Payments/g, 'FROM "Payments"')
      .replace(/FROM Receipts/g, 'FROM "Receipts"')
      .replace(/UPDATE Users/g, 'UPDATE "Users"')
      .replace(/DELETE FROM Users/g, 'DELETE FROM "Users"')
      .replace(/INSERT INTO Users/g, 'INSERT INTO "Users"');
    
    // Fix column names by only adding quotes if they don't already have them
    const columnNames = ['fullName', 'isAdmin', 'lastLogin', 'createdAt', 'updatedAt', 'resetToken', 'resetTokenExpiry'];
    columnNames.forEach(column => {
      // Only replace if not already quoted
      const regex = new RegExp('(?<!["\\\\w])' + column + '(?!["\\\\\w])', 'g');
      modifiedSql = modifiedSql.replace(regex, '"' + column + '"');
    });
    
    return sequelize.query(modifiedSql, {
      replacements: params,
      type: sequelize.QueryTypes.SELECT
    });
  }
  
  // Fall back to SQLite for development
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

// Replace the existing function with our fixed version
content = content.replace(/\/\/ Direct database query function[\s\S]*?function querySqlite\(sql[\s\S]*?}\r?\n}\r?\n/m, fixedFunction);

// Fix any already-quoted column names in getUsers directly
content = content.replace(/"\"fullName\""/g, '"fullName"');
content = content.replace(/"\"isAdmin\""/g, '"isAdmin"');
content = content.replace(/"\"lastLogin\""/g, '"lastLogin"');
content = content.replace(/"\"createdAt\""/g, '"createdAt"');
content = content.replace(/"\"updatedAt\""/g, '"updatedAt"');
content = content.replace(/user\.\"isAdmin\"/g, 'user.isAdmin');

fs.writeFileSync(authControllerPath, content);
console.log('Fixed double-quoting SQL issue in authController.js');