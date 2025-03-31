// fix-column-names.js
const fs = require('fs');
const path = require('path');

// Fix authController.js getUsers method
const authControllerPath = path.join(__dirname, 'server', 'controllers', 'authController.js');
let content = fs.readFileSync(authControllerPath, 'utf8');

// Replace column references without quotes to include proper quotes
content = content.replace(/SELECT id, username, fullName/g, 'SELECT id, username, "fullName"');
content = content.replace(/phone, email, isAdmin/g, 'phone, email, "isAdmin"');
content = content.replace(/lastLogin, createdAt, updatedAt/g, '"lastLogin", "createdAt", "updatedAt"');

// Also fix other areas where column names might be used without quotes
content = content.replace(/User\.isAdmin/g, 'User."isAdmin"');
content = content.replace(/user\.isAdmin/g, 'user."isAdmin"');
content = content.replace(/user\.fullName/g, 'user."fullName"');
content = content.replace(/user\.lastLogin/g, 'user."lastLogin"');

fs.writeFileSync(authControllerPath, content);
console.log('Fixed column name case-sensitivity in authController.js');