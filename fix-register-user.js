// fix-register-user.js
const fs = require('fs');
const path = require('path');

const authControllerPath = path.join(__dirname, 'server', 'controllers', 'authController.js');
let content = fs.readFileSync(authControllerPath, 'utf8');

// Replace the entire registerUser function with a fixed version
const fixedFunction = `// Register user (admin only)
exports.registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, fullName, phone, email, isAdmin } = req.body;

    // Check if username already exists
    let existingUsers;
    
    if (process.env.DATABASE_URL) {
      existingUsers = await sequelize.query(
        'SELECT id FROM "Users" WHERE username = $1',
        { 
          replacements: [username],
          type: sequelize.QueryTypes.SELECT 
        }
      );
    } else {
      existingUsers = await querySqlite(
        'SELECT id FROM Users WHERE username = ?',
        [username]
      );
    }
    
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the user
    const now = new Date().toISOString();
    let newUser;
    
    if (process.env.DATABASE_URL) {
      // Direct PostgreSQL insert
      const result = await sequelize.query(
        'INSERT INTO "Users" (username, password, "fullName", phone, email, "isAdmin", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        { 
          replacements: [username, hashedPassword, fullName, phone, email || null, isAdmin ? true : false, now, now],
          type: sequelize.QueryTypes.INSERT 
        }
      );
      
      // Get the inserted user
      newUser = await sequelize.query(
        'SELECT id, username, "fullName", phone, email, "isAdmin", "createdAt", "updatedAt" FROM "Users" WHERE username = $1',
        { 
          replacements: [username],
          type: sequelize.QueryTypes.SELECT 
        }
      );
    } else {
      // SQLite insert
      await querySqlite(
        'INSERT INTO Users (username, password, fullName, phone, email, isAdmin, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, fullName, phone, email || null, isAdmin ? 1 : 0, now, now]
      );
      
      newUser = await querySqlite(
        'SELECT id, username, fullName, phone, email, isAdmin, createdAt, updatedAt FROM Users WHERE username = ?',
        [username]
      );
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser[0]
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}`;

// Replace the original function with the fixed one
const regexPattern = /\/\/ Register user \(admin only\)[\s\S]*?exports\.registerUser[\s\S]*?};/;
content = content.replace(regexPattern, fixedFunction);

fs.writeFileSync(authControllerPath, content);
console.log('Fixed registerUser function in authController.js');