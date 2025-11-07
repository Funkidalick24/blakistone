const db = require('./database');
const Auth = require('./auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class AccountingService {
  static async createInvoice(invoiceData, userId) {
    return new Promise((resolve, reject) => {
      // Generate invoice number
      const invoiceNumber = 'INV-' + Date.now().toString().slice(-8);

      const sql = `
        INSERT INTO invoices (
          patient_id, invoice_number, amount, tax_amount, total_amount,
          due_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const taxAmount = invoiceData.amount * 0.15; // 15% VAT for Zimbabwe
      const totalAmount = invoiceData.amount + taxAmount;

      const values = [
        invoiceData.patientId,
        invoiceNumber,
        invoiceData.amount,
        taxAmount,
        totalAmount,
        invoiceData.dueDate,
        invoiceData.notes
      ];

      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          const invoiceId = this.lastID;

          // Add invoice items
          if (invoiceData.items && invoiceData.items.length > 0) {
            let completed = 0;
            invoiceData.items.forEach(item => {
              db.run(`
                INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
              `, [invoiceId, item.description, item.quantity, item.unitPrice, item.totalPrice], (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                completed++;
                if (completed === invoiceData.items.length) {
                  // Log creation
                  Auth.logAudit(userId, 'CREATE_INVOICE', 'invoices', invoiceId, null, invoiceData);
                  resolve({ id: invoiceId, invoiceNumber });
                }
              });
            });
          } else {
            // Log creation
            Auth.logAudit(userId, 'CREATE_INVOICE', 'invoices', invoiceId, null, invoiceData);
            resolve({ id: invoiceId, invoiceNumber });
          }
        }
      });
    });
  }

  static async getInvoices(filters = {}, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT i.*, p.first_name, p.last_name, p.patient_id
        FROM invoices i
        JOIN patients p ON i.patient_id = p.id
      `;

      const params = [];
      const conditions = [];

      if (filters.patientId) {
        conditions.push('i.patient_id = ?');
        params.push(filters.patientId);
      }

      if (filters.status) {
        conditions.push('i.status = ?');
        params.push(filters.status);
      }

      if (filters.dateFrom) {
        conditions.push('DATE(i.created_at) >= ?');
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        conditions.push('DATE(i.created_at) <= ?');
        params.push(filters.dateTo);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async updateInvoicePayment(id, paymentData, userId) {
    return new Promise((resolve, reject) => {
      // Get old values for audit
      db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, oldInvoice) => {
        if (err) {
          reject(err);
          return;
        }

        if (!oldInvoice) {
          reject(new Error('Invoice not found'));
          return;
        }

        const sql = `
          UPDATE invoices
          SET status = ?, payment_date = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        db.run(sql, [paymentData.status, paymentData.paymentDate, paymentData.paymentMethod, id], function(err) {
          if (err) {
            reject(err);
          } else {
            // Log update
            Auth.logAudit(userId, 'UPDATE_INVOICE_PAYMENT', 'invoices', id, oldInvoice, paymentData);
            resolve(this.changes);
          }
        });
      });
    });
  }

  static async createExpense(expenseData, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO expenses (
          description, category, amount, expense_date, vendor, receipt_path, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        expenseData.description,
        expenseData.category,
        expenseData.amount,
        expenseData.expenseDate,
        expenseData.vendor,
        expenseData.receiptPath,
        expenseData.notes
      ];

      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          // Log creation
          Auth.logAudit(userId, 'CREATE_EXPENSE', 'expenses', this.lastID, null, expenseData);
          resolve(this.lastID);
        }
      });
    });
  }

  static async getExpenses(filters = {}, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM expenses';
      const params = [];
      const conditions = [];

      if (filters.category) {
        conditions.push('category = ?');
        params.push(filters.category);
      }

      if (filters.dateFrom) {
        conditions.push('DATE(expense_date) >= ?');
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        conditions.push('DATE(expense_date) <= ?');
        params.push(filters.dateTo);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY expense_date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async getFinancialStats() {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT SUM(total_amount) as totalRevenue FROM invoices WHERE status = \'paid\'',
        'SELECT SUM(total_amount) as pendingRevenue FROM invoices WHERE status = \'unpaid\'',
        'SELECT SUM(amount) as totalExpenses FROM expenses',
        'SELECT SUM(amount) as monthlyExpenses FROM expenses WHERE strftime(\'%Y-%m\', expense_date) = strftime(\'%Y-%m\', \'now\')',
        'SELECT SUM(total_amount) as monthlyRevenue FROM invoices WHERE status = \'paid\' AND strftime(\'%Y-%m\', payment_date) = strftime(\'%Y-%m\', \'now\')'
      ];

      const results = {};

      let completed = 0;
      queries.forEach((query, index) => {
        db.get(query, (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (index === 0) results.totalRevenue = row.totalRevenue || 0;
          else if (index === 1) results.pendingRevenue = row.pendingRevenue || 0;
          else if (index === 2) results.totalExpenses = row.totalExpenses || 0;
          else if (index === 3) results.monthlyExpenses = row.monthlyExpenses || 0;
          else if (index === 4) results.monthlyRevenue = row.monthlyRevenue || 0;

          completed++;
          if (completed === queries.length) {
            results.netProfit = results.totalRevenue - results.totalExpenses;
            results.monthlyNet = results.monthlyRevenue - results.monthlyExpenses;
            resolve(results);
          }
        });
      });
    });
  }

  static async generateInvoicePDF(invoiceId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get invoice data with patient and items
        const invoice = await this.getInvoiceWithDetails(invoiceId);
        if (!invoice) {
          reject(new Error('Invoice not found'));
          return;
        }

        const doc = new PDFDocument();
        const fileName = `invoice_${invoice.invoice_number}.pdf`;
        const filePath = path.join(__dirname, '..', 'invoices', fileName);

        // Ensure invoices directory exists
        const invoicesDir = path.dirname(filePath);
        if (!fs.existsSync(invoicesDir)) {
          fs.mkdirSync(invoicesDir, { recursive: true });
        }

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('BLACKISTONE MEDICAL CENTRE', { align: 'center' });
        doc.fontSize(16).text('INVOICE', { align: 'center' });
        doc.moveDown();

        // Invoice details
        doc.fontSize(12);
        doc.text(`Invoice Number: ${invoice.invoice_number}`);
        doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`);
        doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`);
        doc.moveDown();

        // Patient details
        doc.text('Bill To:');
        doc.text(`${invoice.first_name} ${invoice.last_name}`);
        doc.text(`Patient ID: ${invoice.patient_id}`);
        doc.moveDown();

        // Items table
        const tableTop = doc.y;
        doc.text('Description', 50, tableTop);
        doc.text('Qty', 300, tableTop);
        doc.text('Unit Price', 350, tableTop);
        doc.text('Total', 450, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let yPosition = tableTop + 25;
        invoice.items.forEach(item => {
          doc.text(item.description, 50, yPosition);
          doc.text(item.quantity.toString(), 300, yPosition);
          doc.text(`$${item.unit_price.toFixed(2)}`, 350, yPosition);
          doc.text(`$${item.total_price.toFixed(2)}`, 450, yPosition);
          yPosition += 20;
        });

        // Totals
        yPosition += 10;
        doc.text(`Subtotal: $${invoice.amount.toFixed(2)}`, 350, yPosition);
        doc.text(`Tax (15%): $${invoice.tax_amount.toFixed(2)}`, 350, yPosition + 20);
        doc.font('Helvetica-Bold').text(`Total: $${invoice.total_amount.toFixed(2)}`, 350, yPosition + 40);

        doc.end();

        stream.on('finish', () => {
          resolve(filePath);
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  static async getInvoiceWithDetails(invoiceId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT i.*, p.first_name, p.last_name, p.patient_id
        FROM invoices i
        JOIN patients p ON i.patient_id = p.id
        WHERE i.id = ?
      `;

      db.get(sql, [invoiceId], (err, invoice) => {
        if (err) {
          reject(err);
          return;
        }

        if (!invoice) {
          resolve(null);
          return;
        }

        // Get invoice items
        db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId], (err, items) => {
          if (err) {
            reject(err);
          } else {
            invoice.items = items;
            resolve(invoice);
          }
        });
      });
    });
  }
}

module.exports = AccountingService;