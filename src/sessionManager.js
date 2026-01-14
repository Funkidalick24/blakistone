const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');

// Session Manager for user authentication state
class SessionManager {
  constructor(userDataPath) {
    // Use provided path or fallback to current directory
    const basePath = userDataPath || process.cwd();
    this.sessionPath = path.join(basePath, 'session.enc');
    this.keyPath = path.join(basePath, 'session-key');
  }

  // Generate encryption key (done once)
  async generateKey() {
    const key = crypto.randomBytes(32);
    await fs.writeFile(this.keyPath, key.toString('hex'));
    return key;
  }

  // Load encryption key
  async loadKey() {
    try {
      const keyHex = await fs.readFile(this.keyPath, 'utf8');
      return Buffer.from(keyHex, 'hex');
    } catch {
      return await this.generateKey();
    }
  }

  // Encrypt and save session
  async saveSession(sessionData) {
    const key = await this.loadKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(JSON.stringify(sessionData), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const data = {
      iv: iv.toString('hex'),
      encrypted: encrypted,
      timestamp: Date.now()
    };

    await fs.writeFile(this.sessionPath, JSON.stringify(data));
  }

  // Load and decrypt session
  async loadSession() {
    try {
      const key = await this.loadKey();
      const data = JSON.parse(await fs.readFile(this.sessionPath, 'utf8'));

      // Check if session is expired (24 hours)
      if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        await this.clearSession();
        return null;
      }

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(data.iv, 'hex'));
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch {
      return null; // No session saved yet or invalid
    }
  }

  // Clear session
  async clearSession() {
    try {
      await fs.unlink(this.sessionPath);
    } catch {
      // File doesn't exist, ignore
    }
  }

  // Get current user from session
  async getCurrentUser() {
    const session = await this.loadSession();
    return session ? session.user : null;
  }
}

module.exports = SessionManager;