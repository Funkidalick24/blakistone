const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'credentials.db');

// Ensure database directory exists (though it's in root)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Initialize database with only users table
db.serialize(() => {
  // Users table for authentication and roles
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'receptionist', 'accountant')),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default admin user
  const saltRounds = 10;
  const defaultPassword = 'admin123';
  bcrypt.hash(defaultPassword, saltRounds, (err, hash) => {
    if (!err) {
      db.run(`
        INSERT INTO users (username, password_hash, role, name, email)
        VALUES ('admin', ?, 'admin', 'System Administrator', 'admin@blackistone.com')
      `, [hash], (err) => {
        if (err) {
          console.error('Error inserting admin user:', err.message);
        } else {
          console.log('Admin user created successfully');
        }
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          } else {
            console.log('Database created at:', dbPath);
          }
        });
      });
    } else {
      console.error('Error hashing password:', err);
      db.close();
    }
  });
});