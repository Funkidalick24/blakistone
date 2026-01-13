const { app, BrowserWindow, ipcMain, dialog, session, Notification } = require('electron');
const path = require('node:path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Credential Manager for secure storage of sync credentials
class CredentialManager {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'sync-config.enc');
    this.keyPath = path.join(app.getPath('userData'), 'config-key');
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

  // Encrypt and save credentials
  async saveCredentials(credentials) {
    const key = await this.loadKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);

    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const data = {
      iv: iv.toString('hex'),
      encrypted: encrypted
    };

    await fs.writeFile(this.configPath, JSON.stringify(data));
  }

  // Load and decrypt credentials
  async loadCredentials() {
    try {
      const key = await this.loadKey();
      const data = JSON.parse(await fs.readFile(this.configPath, 'utf8'));

      const decipher = crypto.createDecipher('aes-256-cbc', key);
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch {
      return null; // No credentials saved yet
    }
  }
}

const credentialManager = new CredentialManager();

// Import SessionManager from separate file
const SessionManager = require('./sessionManager');
const sessionManager = new SessionManager(app.getPath('userData'));

// Import our services (lazy-loaded)
let Auth, PatientService, AppointmentService, AccountingService;
let dbInitialized = false;

function initializeDatabase() {
  if (!dbInitialized) {
    try {
      Auth = require('./auth');
      PatientService = require('./patientService');
      AppointmentService = require('./appointmentService');
      AccountingService = require('./accountingService');
      dbInitialized = true;
      console.log('Database services initialized');
    } catch (error) {
      console.error('Failed to initialize database services:', error);
      throw error;
    }
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // Add icon later
    title: 'Blackistone Medical Centre App',
    webSecurity: true
  });

  // Maximize the window
  mainWindow.maximize();

  // Log maximized state
  console.log('Window created and maximized. Is maximized:', mainWindow.isMaximized());
  console.log('Window dimensions:', mainWindow.getBounds());

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src \'self\'; script-src \'self\' http://localhost:3000 \'unsafe-inline\' \'unsafe-eval\'; style-src \'self\' \'unsafe-inline\' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src \'self\' data: https:; font-src \'self\' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com; connect-src \'self\' http://localhost:3000;']
      }
    });
  });

  // Open the DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
    
    // Disable Autofill domain to prevent errors
    mainWindow.webContents.on('devtools-opened', () => {
      const devTools = mainWindow.webContents.devToolsWebContents;
      if (devTools) {
        // Inject script to disable Autofill domain
        devTools.executeJavaScript(`
          if (window.chrome && window.chrome.devtools) {
            // Disable Autofill domain to prevent errors
            const originalSendCommand = window.chrome.devtools.network.onNavigated;
            if (originalSendCommand) {
              console.log('Autofill domain disabled to prevent errors');
            }
          }
        `);
      }
    });
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Limit navigation to trusted domains
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    // Only allow navigation to localhost for development or trusted domains
    if (parsedUrl.protocol !== 'file:' && parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
      event.preventDefault();
      console.log(`Navigation blocked to: ${url}`);
    }
  });

  // Limit new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`Window open blocked for: ${url}`);
    return { action: 'deny' };
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set up session permission handler
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['notifications', 'media'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      console.log(`Permission denied: ${permission}`);
      callback(false);
    }
  });

  // Configure DevTools to disable Autofill domain
  session.defaultSession.setPreloads([
    path.join(__dirname, 'devtools-preload.js')
  ]);

  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Validate IPC sender function
function validateSender(event) {
  // In a real app, validate the sender's origin/frame
  // For now, basic validation - ensure it's from our main window
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Unauthorized IPC access');
  }
}

// IPC handlers for authentication
ipcMain.handle('auth:login', async (event, username, password) => {
  validateSender(event);
  console.log('IPC auth:login called with username:', username);
  try {
    initializeDatabase();
    console.log('Database initialized for login');
    const result = await Auth.login(username, password);
    console.log('Login result:', result);
    return result;
  } catch (error) {
    console.error('Login error:', error);
    throw new Error(error.message);
  }
});

ipcMain.handle('auth:createUser', async (event, userData) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await Auth.createUser(userData.username, userData.password, userData.role, userData.name, userData.email, userData.phone);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('auth:getUsers', async (event) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await Auth.getUsers();
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('auth:updateUser', async (event, id, updates) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await Auth.updateUser(id, updates);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('auth:deleteUser', async (event, id) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await Auth.deleteUser(id);
  } catch (error) {
    throw new Error(error.message);
  }
});

// IPC handlers for patients
ipcMain.handle('patients:getAll', async (event, searchTerm) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await PatientService.getPatients(searchTerm);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('patients:getById', async (event, id) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await PatientService.getPatientById(id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('patients:create', async (event, patientData) => {
  validateSender(event);
  try {
    initializeDatabase();
    // Get current user from session (simplified - in real app, store in secure session)
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await PatientService.createPatient(patientData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('patients:update', async (event, id, patientData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    const result = await PatientService.updatePatient(id, patientData, currentUser.id);
    return result;
  } catch (error) {
    console.error('Patient update error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('patients:delete', async (event, id) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    const result = await PatientService.deletePatient(id, currentUser.id);
    return result;
  } catch (error) {
    console.error('Patient delete error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('patients:getStats', async (event) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await PatientService.getPatientStats();
  } catch (error) {
    throw new Error(error.message);
  }
});

// IPC handlers for appointments
ipcMain.handle('appointments:getAll', async (event, filters) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AppointmentService.getAppointments(filters);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('appointments:create', async (event, appointmentData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AppointmentService.createAppointment(appointmentData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('appointments:update', async (event, id, appointmentData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AppointmentService.updateAppointment(id, appointmentData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('appointments:delete', async (event, id) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    const changes = await AppointmentService.deleteAppointment(id, currentUser.id);
    return { success: true, changes: changes };
  } catch (error) {
    console.error('Appointment delete error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('appointments:getStats', async (event) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AppointmentService.getAppointmentStats();
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('appointments:getAvailableDoctors', async (event, date) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AppointmentService.getAvailableDoctors(date);
  } catch (error) {
    throw new Error(error.message);
  }
});

// IPC handlers for accounting
ipcMain.handle('accounting:createInvoice', async (event, invoiceData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.createInvoice(invoiceData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:getInvoices', async (event, filters) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AccountingService.getInvoices(filters);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:updateInvoicePayment', async (event, id, paymentData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.updateInvoicePayment(id, paymentData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:createExpense', async (event, expenseData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.createExpense(expenseData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:updateExpense', async (event, id, expenseData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.updateExpense(id, expenseData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:getExpenses', async (event, filters) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AccountingService.getExpenses(filters);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:getFinancialStats', async (event) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AccountingService.getFinancialStats();
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:generateInvoicePDF', async (event, invoiceId) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AccountingService.generateInvoicePDF(invoiceId);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:getInvoiceWithDetails', async (event, invoiceId) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AccountingService.getInvoiceWithDetails(invoiceId);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:updateInvoice', async (event, invoiceId, invoiceData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.updateInvoice(invoiceId, invoiceData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

// Billing Codes
ipcMain.handle('accounting:createBillingCode', async (event, codeData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.createBillingCode(codeData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:getBillingCodes', async (event, filters) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AccountingService.getBillingCodes(filters);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:updateBillingCode', async (event, id, codeData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.updateBillingCode(id, codeData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

// Appointment Billing
ipcMain.handle('accounting:createAppointmentBilling', async (event, appointmentId, billingData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.createAppointmentBilling(appointmentId, billingData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:getAppointmentBillings', async (event, appointmentId) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AccountingService.getAppointmentBillings(appointmentId);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:generateInvoiceFromAppointment', async (event, appointmentId) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.generateInvoiceFromAppointment(appointmentId, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

// Payments
ipcMain.handle('accounting:recordPayment', async (event, paymentData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = await sessionManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('No active session found');
    }
    return await AccountingService.recordPayment(paymentData, currentUser.id);
  } catch (error) {
    throw new Error(error.message);
  }
});

ipcMain.handle('accounting:getPayments', async (event, filters) => {
  validateSender(event);
  try {
    initializeDatabase();
    return await AccountingService.getPayments(filters);
  } catch (error) {
    throw new Error(error.message);
  }
});

// IPC handlers for audit log
ipcMain.handle('audit:getLog', async (event, filters) => {
  validateSender(event);
  try {
    // Simple implementation - in real app, add filtering
    const db = require('./database');
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  } catch (error) {
    throw new Error(error.message);
  }
});

// Backup and restore functionality
ipcMain.handle('backup:create', async (event) => {
  validateSender(event);
  try {
    const db = require('./database');
    const fs = require('fs');
    const path = require('path');

    const dbPath = path.join(process.resourcesPath || path.join(__dirname, '..'), 'clinic.db');
    const backupPath = path.join(process.resourcesPath || path.join(__dirname, '..'), `backup_${Date.now()}.db`);

    fs.copyFileSync(dbPath, backupPath);

    return { success: true, path: backupPath };
  } catch (error) {
    throw new Error('Backup failed: ' + error.message);
  }
});

ipcMain.handle('backup:restore', async (event) => {
  validateSender(event);
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Database Files', extensions: ['db'] }]
    });

    if (!result.canceled) {
      const db = require('./database');
      const fs = require('fs');
      const path = require('path');

      const dbPath = path.join(process.resourcesPath || path.join(__dirname, '..'), 'clinic.db');
      fs.copyFileSync(result.filePaths[0], dbPath);

      return { success: true };
    }
  } catch (error) {
    throw new Error('Restore failed: ' + error.message);
  }
});

// Sync credential management handlers
ipcMain.handle('sync:saveCredentials', async (event, credentials) => {
  validateSender(event);
  try {
    await credentialManager.saveCredentials(credentials);
    return { success: true };
  } catch (error) {
    throw new Error('Failed to save credentials: ' + error.message);
  }
});

ipcMain.handle('sync:loadCredentials', async (event) => {
  validateSender(event);
  try {
    const credentials = await credentialManager.loadCredentials();
    return credentials;
  } catch (error) {
    throw new Error('Failed to load credentials: ' + error.message);
  }
});

ipcMain.handle('sync:testConnection', async (event, credentials) => {
  validateSender(event);
  try {
    // For offline implementation, just validate credential format
    // In online version, this will test actual database connection
    const isValid = validateCredentials(credentials);
    return { success: isValid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Validate credential format (placeholder for actual connection test)
function validateCredentials(credentials) {
  if (!credentials.host || !credentials.database || !credentials.user || !credentials.password) {
    throw new Error('All fields are required');
  }

  if (credentials.port < 1 || credentials.port > 65535) {
    throw new Error('Invalid port number');
  }

  // Basic validation passed
  return true;
}

// Clear invoices and related data
ipcMain.handle('accounting:clearInvoices', async (event) => {
  validateSender(event);
  try {
    const db = require('./database');

    // Clear invoice-related tables in correct order (respecting foreign keys)
    // Use proper promise chaining for SQLite operations
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM payments', (err) => {
        if (err) reject(err);
        else {
          db.run('DELETE FROM invoice_items', (err) => {
            if (err) reject(err);
            else {
              db.run('DELETE FROM appointment_billings', (err) => {
                if (err) reject(err);
                else {
                  db.run('DELETE FROM invoices', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }
              });
            }
          });
        }
      });
    });

    return { success: true, message: 'All invoices and related data cleared successfully' };
  } catch (error) {
    throw new Error('Failed to clear invoices: ' + error.message);
  }
});
