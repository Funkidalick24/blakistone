const bcrypt = require('bcryptjs');
const db = require('./database');
const SessionManager = require('./sessionManager'); // Import SessionManager
const path = require('path');
const sessionManager = new SessionManager(path.join(__dirname, '..')); // Create session manager instance with app directory

class Auth {
  static async login(username, password) {
    console.log('Login attempt for:', username);
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        console.log('Database query result:', err, user);
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else if (!user) {
          console.log('User not found');
          resolve(null);
        } else {
          console.log('User found, comparing password...');
          try {
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            console.log('Password comparison result:', isValidPassword);
            if (isValidPassword) {
              // Log successful login
              Auth.logAudit(user.id, 'LOGIN', 'users', user.id, null, { login: true });
              
              // Save session for the user
              await sessionManager.saveSession({
                user: {
                  id: user.id,
                  username: user.username,
                  role: user.role,
                  name: user.name,
                  email: user.email
                }
              });
              
              resolve({
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                email: user.email
              });
            } else {
              resolve(null);
            }
          } catch (bcryptError) {
            console.error('bcrypt error:', bcryptError);
            reject(bcryptError);
          }
        }
      });
    });
  }

  static async createUser(username, password, role, name, email, phone) {
    return new Promise(async (resolve, reject) => {
      try {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        db.run(`
          INSERT INTO users (username, password_hash, role, name, email, phone)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [username, passwordHash, role, name, email, phone], function(err) {
          if (err) {
            reject(err);
          } else {
            // Log user creation
            Auth.logAudit(null, 'CREATE_USER', 'users', this.lastID, null, { username, role, name });
            resolve(this.lastID);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  static async updateUser(id, updates) {
    return new Promise((resolve, reject) => {
      // Get old values for audit
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, oldUser) => {
        if (err) {
          reject(err);
          return;
        }

        if (!oldUser) {
          reject(new Error('User not found'));
          return;
        }

        const fields = [];
        const values = [];

        if (updates.name) {
          fields.push('name = ?');
          values.push(updates.name);
        }
        if (updates.email) {
          fields.push('email = ?');
          values.push(updates.email);
        }
        if (updates.phone) {
          fields.push('phone = ?');
          values.push(updates.phone);
        }
        if (updates.role) {
          fields.push('role = ?');
          values.push(updates.role);
        }
        if (updates.password) {
          // Hash new password
          bcrypt.hash(updates.password, 10, (err, hash) => {
            if (err) {
              reject(err);
              return;
            }
            fields.push('password_hash = ?');
            values.push(hash);
            values.push(id);
            executeUpdate();
          });
          return;
        }

        values.push(id);
        executeUpdate();

        function executeUpdate() {
          const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

          db.run(sql, values, function(err) {
            if (err) {
              reject(err);
            } else {
              // Log update
              Auth.logAudit(null, 'UPDATE_USER', 'users', id, oldUser, updates);
              resolve(this.changes);
            }
          });
        }
      });
    });
  }

  static async getUsers() {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, username, role, name, email, phone, created_at FROM users ORDER BY name', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async deleteUser(id) {
    return new Promise((resolve, reject) => {
      // Get user for audit
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        if (err) {
          reject(err);
          return;
        }

        db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
          } else {
            // Log deletion
            Auth.logAudit(null, 'DELETE_USER', 'users', id, user, null);
            resolve(this.changes);
          }
        });
      });
    });
  }

  static logAudit(userId, action, tableName, recordId, oldValues, newValues) {
    db.run(`
      INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      userId,
      action,
      tableName,
      recordId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null
    ]);
  }

  static checkPermission(userRole, requiredRole) {
    const roleHierarchy = {
      'receptionist': 1,
      'accountant': 2,
      'doctor': 3,
      'admin': 4
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }
}

module.exports = Auth;