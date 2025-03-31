// fix-env-admins.js
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createEnvAdmins() {
  const client = await pool.connect();
  
  try {
    // Process all admin environment variables
    for (let i = 1; i <= 5; i++) {
      const username = process.env[`ADMIN${i}_USERNAME`];
      const password = process.env[`ADMIN${i}_PASSWORD`];
      
      if (username && password) {
        console.log(`Processing admin ${i}: ${username}`);
        
        // Check if user already exists
        const existing = await client.query('SELECT id FROM "Users" WHERE username = $1', [username]);
        
        if (existing.rows.length > 0) {
          // Update existing user's password
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          await client.query('UPDATE "Users" SET password = $1 WHERE username = $2', 
            [hashedPassword, username]);
          console.log(`Updated existing user: ${username}`);
        } else {
          // Create new admin user
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          
          await client.query(`
            INSERT INTO "Users" (username, password, "fullName", email, phone, "isAdmin", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              username, 
              hashedPassword,
              `Admin ${i}`,
              `admin${i}@tassiac.church`,
              `10000000${i}`,
              true,
              new Date(),
              new Date()
            ]
          );
          console.log(`Created new admin: ${username}`);
        }
      }
    }
    
    console.log('All environment admins processed successfully');
  } finally {
    client.release();
  }
}

createEnvAdmins().catch(console.error);