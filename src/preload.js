const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  createUser: (userData) => ipcRenderer.invoke('auth:createUser', userData),
  getUsers: () => ipcRenderer.invoke('auth:getUsers'),
  updateUser: (id, updates) => ipcRenderer.invoke('auth:updateUser', id, updates),
  deleteUser: (id) => ipcRenderer.invoke('auth:deleteUser', id),

  // Patients
  getPatients: (searchTerm) => ipcRenderer.invoke('patients:getAll', searchTerm),
  getPatientById: (id) => ipcRenderer.invoke('patients:getById', id),
  savePatient: (patientData) => ipcRenderer.invoke('patients:create', patientData),
  updatePatient: (id, patientData) => ipcRenderer.invoke('patients:update', id, patientData),
  deletePatient: (id) => ipcRenderer.invoke('patients:delete', id),
  getPatientStats: () => ipcRenderer.invoke('patients:getStats'),

  // Appointments
  getAppointments: (filters) => ipcRenderer.invoke('appointments:getAll', filters),
  createAppointment: (appointmentData) => ipcRenderer.invoke('appointments:create', appointmentData),
  updateAppointment: (id, appointmentData) => ipcRenderer.invoke('appointments:update', id, appointmentData),
  deleteAppointment: (id) => ipcRenderer.invoke('appointments:delete', id),
  getAppointmentStats: () => ipcRenderer.invoke('appointments:getStats'),
  getAvailableDoctors: (date) => ipcRenderer.invoke('appointments:getAvailableDoctors', date),

  // Accounting
  createInvoice: (invoiceData) => ipcRenderer.invoke('accounting:createInvoice', invoiceData),
  getInvoices: (filters) => ipcRenderer.invoke('accounting:getInvoices', filters),
  getInvoiceWithDetails: (invoiceId) => ipcRenderer.invoke('accounting:getInvoiceWithDetails', invoiceId),
  updateInvoice: (invoiceId, invoiceData) => ipcRenderer.invoke('accounting:updateInvoice', invoiceId, invoiceData),
  updateInvoicePayment: (id, paymentData) => ipcRenderer.invoke('accounting:updateInvoicePayment', id, paymentData),
  createExpense: (expenseData) => ipcRenderer.invoke('accounting:createExpense', expenseData),
  updateExpense: (id, expenseData) => ipcRenderer.invoke('accounting:updateExpense', id, expenseData),
  getExpenses: (filters) => ipcRenderer.invoke('accounting:getExpenses', filters),
  getFinancialStats: () => ipcRenderer.invoke('accounting:getFinancialStats'),
  generateInvoicePDF: (invoiceId) => ipcRenderer.invoke('accounting:generateInvoicePDF', invoiceId),

  // Billing Codes
  createBillingCode: (codeData) => ipcRenderer.invoke('accounting:createBillingCode', codeData),
  getBillingCodes: (filters) => ipcRenderer.invoke('accounting:getBillingCodes', filters),
  updateBillingCode: (id, codeData) => ipcRenderer.invoke('accounting:updateBillingCode', id, codeData),

  // Appointment Billing
  createAppointmentBilling: (appointmentId, billingData) => ipcRenderer.invoke('accounting:createAppointmentBilling', appointmentId, billingData),
  getAppointmentBillings: (appointmentId) => ipcRenderer.invoke('accounting:getAppointmentBillings', appointmentId),
  generateInvoiceFromAppointment: (appointmentId) => ipcRenderer.invoke('accounting:generateInvoiceFromAppointment', appointmentId),

  // Payments
  recordPayment: (paymentData) => ipcRenderer.invoke('accounting:recordPayment', paymentData),
  getPayments: (filters) => ipcRenderer.invoke('accounting:getPayments', filters),

  // Audit
  getAuditLog: (filters) => ipcRenderer.invoke('audit:getLog', filters),

  // Backup/Restore
  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),

  // Secure event handling - avoid exposing raw ipcRenderer.on
  onUpdateCounter: (callback) => {
    // Example: if you need event listeners, validate and sanitize
    ipcRenderer.on('update-counter', (_event, value) => callback(value));
  }
});
