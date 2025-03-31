// fix-queries.js
const fs = require('fs');
const path = require('path');

// Fix the authController.js file
const authControllerPath = path.join(__dirname, 'server', 'controllers', 'authController.js');
let content = fs.readFileSync(authControllerPath, 'utf8');

// Replace all instances of unquoted table names with quoted ones
content = content.replace(/SELECT \* FROM Users/g, 'SELECT * FROM "Users"');
content = content.replace(/SELECT username FROM Users/g, 'SELECT username FROM "Users"');
content = content.replace(/FROM Users WHERE/g, 'FROM "Users" WHERE');

// Fix the querySqlite function to correctly pass SQL to Sequelize
content = content.replace(/function querySqlite\(sql, params = \[\]\) \{[\s\S]+?return sequelize\.query\(sql, \{/g, 
  `function querySqlite(sql, params = []) {
  // Check if we're in production with Postgres
  if (process.env.DATABASE_URL) {
    debugLog('POSTGRES ENVIRONMENT DETECTED - Using Sequelize query');
    // For PostgreSQL, ensure we use double quotes for table names
    const modifiedSql = sql
      .replace(/FROM Users/g, 'FROM "Users"')
      .replace(/FROM Payments/g, 'FROM "Payments"');
    
    return sequelize.query(modifiedSql, {`);

fs.writeFileSync(authControllerPath, content);
console.log('Authentication controller fixed with proper PostgreSQL table references');