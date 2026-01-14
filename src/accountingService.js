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

  static async updateInvoice(id, invoiceData, userId) {
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

        const fields = [];
        const values = [];

        if (invoiceData.patientId !== undefined) {
          fields.push('patient_id = ?');
          values.push(invoiceData.patientId);
        }
        if (invoiceData.amount !== undefined) {
          fields.push('amount = ?');
          values.push(invoiceData.amount);
        }
        if (invoiceData.taxAmount !== undefined) {
          fields.push('tax_amount = ?');
          values.push(invoiceData.taxAmount);
        }
        if (invoiceData.totalAmount !== undefined) {
          fields.push('total_amount = ?');
          values.push(invoiceData.totalAmount);
        }
        if (invoiceData.status !== undefined) {
          fields.push('status = ?');
          values.push(invoiceData.status);
        }
        if (invoiceData.dueDate !== undefined) {
          fields.push('due_date = ?');
          values.push(invoiceData.dueDate);
        }
        if (invoiceData.notes !== undefined) {
          fields.push('notes = ?');
          values.push(invoiceData.notes);
        }

        if (fields.length === 0) {
          resolve(0);
          return;
        }

        values.push(id);

        const sql = `UPDATE invoices SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        db.run(sql, values, function(err) {
          if (err) {
            reject(err);
          } else {
            // Update invoice items if provided
            if (invoiceData.items && invoiceData.items.length > 0) {
              // Delete existing items
              db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [id], (deleteErr) => {
                if (deleteErr) {
                  reject(deleteErr);
                  return;
                }

                // Add new items
                let completed = 0;
                invoiceData.items.forEach(item => {
                  db.run(`
                    INSERT INTO invoice_items (invoice_id, billing_code_id, description, quantity, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?, ?)
                  `, [id, item.billingCodeId, item.description, item.quantity, item.unitPrice, item.totalPrice], (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    completed++;
                    if (completed === invoiceData.items.length) {
                      // Log update
                      Auth.logAudit(userId, 'UPDATE_INVOICE', 'invoices', id, oldInvoice, invoiceData);
                      resolve(this.changes);
                    }
                  });
                });
              });
            } else {
              // Log update
              Auth.logAudit(userId, 'UPDATE_INVOICE', 'invoices', id, oldInvoice, invoiceData);
              resolve(this.changes);
            }
          }
        });
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

  static async updateExpense(id, expenseData, userId) {
    return new Promise((resolve, reject) => {
      // Get old values for audit
      db.get('SELECT * FROM expenses WHERE id = ?', [id], (err, oldExpense) => {
        if (err) {
          reject(err);
          return;
        }

        if (!oldExpense) {
          reject(new Error('Expense not found'));
          return;
        }

        const fields = [];
        const values = [];

        if (expenseData.description !== undefined) {
          fields.push('description = ?');
          values.push(expenseData.description);
        }
        if (expenseData.category !== undefined) {
          fields.push('category = ?');
          values.push(expenseData.category);
        }
        if (expenseData.amount !== undefined) {
          fields.push('amount = ?');
          values.push(expenseData.amount);
        }
        if (expenseData.expenseDate !== undefined) {
          fields.push('expense_date = ?');
          values.push(expenseData.expenseDate);
        }
        if (expenseData.vendor !== undefined) {
          fields.push('vendor = ?');
          values.push(expenseData.vendor);
        }
        if (expenseData.receiptPath !== undefined) {
          fields.push('receipt_path = ?');
          values.push(expenseData.receiptPath);
        }
        if (expenseData.notes !== undefined) {
          fields.push('notes = ?');
          values.push(expenseData.notes);
        }

        if (fields.length === 0) {
          resolve(0);
          return;
        }

        values.push(id);

        const sql = `UPDATE expenses SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        db.run(sql, values, function(err) {
          if (err) {
            reject(err);
          } else {
            Auth.logAudit(userId, 'UPDATE_EXPENSE', 'expenses', id, oldExpense, expenseData);
            resolve(this.changes);
          }
        });
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
        'SELECT COUNT(*) as pendingInvoiceCount FROM invoices WHERE status = \'unpaid\'',
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
          else if (index === 2) results.pendingInvoiceCount = row.pendingInvoiceCount || 0;
          else if (index === 3) results.totalExpenses = row.totalExpenses || 0;
          else if (index === 4) results.monthlyExpenses = row.monthlyExpenses || 0;
          else if (index === 5) results.monthlyRevenue = row.monthlyRevenue || 0;

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

  static async updateInvoice(invoiceId, invoiceData, userId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get old invoice data for audit
        const oldInvoice = await this.getInvoiceWithDetails(invoiceId);
        if (!oldInvoice) {
          reject(new Error('Invoice not found'));
          return;
        }

        // Calculate new totals
        const taxAmount = invoiceData.amount * 0.15; // 15% VAT for Zimbabwe
        const totalAmount = invoiceData.amount + taxAmount;

        // Update invoice
        const sql = `
          UPDATE invoices
          SET amount = ?, tax_amount = ?, total_amount = ?, due_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        db.run(sql, [invoiceData.amount, taxAmount, totalAmount, invoiceData.dueDate, invoiceData.notes, invoiceId], function(err) {
          if (err) {
            reject(err);
            return;
          }

          // Delete existing items
          db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId], (err) => {
            if (err) {
              reject(err);
              return;
            }

            // Add new items
            if (invoiceData.items && invoiceData.items.length > 0) {
              let completed = 0;
              invoiceData.items.forEach(item => {
                db.run(`
                  INSERT INTO invoice_items (invoice_id, billing_code_id, description, quantity, unit_price, total_price)
                  VALUES (?, ?, ?, ?, ?, ?)
                `, [invoiceId, item.billingCodeId, item.description, item.quantity, item.unitPrice, item.totalPrice], (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  completed++;
                  if (completed === invoiceData.items.length) {
                    // Log update
                    Auth.logAudit(userId, 'UPDATE_INVOICE', 'invoices', invoiceId, oldInvoice, invoiceData);
                    resolve(this.changes);
                  }
                });
              });
            } else {
              // Log update
              Auth.logAudit(userId, 'UPDATE_INVOICE', 'invoices', invoiceId, oldInvoice, invoiceData);
              resolve(this.changes);
            }
          });
        });
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

        // Get invoice items with billing codes
        const itemsSql = `
          SELECT ii.*, bc.code, bc.description as billing_description, bc.category
          FROM invoice_items ii
          LEFT JOIN billing_codes bc ON ii.billing_code_id = bc.id
          WHERE ii.invoice_id = ?
        `;

        db.all(itemsSql, [invoiceId], (err, items) => {
          if (err) {
            reject(err);
          } else {
            invoice.items = items;

            // Get payments for this invoice
            db.all('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC', [invoiceId], (err, payments) => {
              if (err) {
                reject(err);
              } else {
                invoice.payments = payments;
                resolve(invoice);
              }
            });
          }
        });
      });
    });
  }

  // Billing Codes Management
  static async createBillingCode(codeData, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO billing_codes (code, description, category, default_price, tax_rate, active)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const values = [
        codeData.code,
        codeData.description,
        codeData.category,
        codeData.defaultPrice,
        codeData.taxRate || 0.15,
        codeData.active !== undefined ? codeData.active : true
      ];

      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          Auth.logAudit(userId, 'CREATE_BILLING_CODE', 'billing_codes', this.lastID, null, codeData);
          resolve(this.lastID);
        }
      });
    });
  }

  static async getBillingCodes(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM billing_codes WHERE 1=1';
      const params = [];

      if (filters.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters.active !== undefined) {
        sql += ' AND active = ?';
        params.push(filters.active ? 1 : 0);
      }

      sql += ' ORDER BY category, code';

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async updateBillingCode(id, codeData, userId) {
    return new Promise((resolve, reject) => {
      // Get old values for audit
      db.get('SELECT * FROM billing_codes WHERE id = ?', [id], (err, oldCode) => {
        if (err) {
          reject(err);
          return;
        }

        if (!oldCode) {
          reject(new Error('Billing code not found'));
          return;
        }

        const fields = [];
        const values = [];

        if (codeData.code !== undefined) {
          fields.push('code = ?');
          values.push(codeData.code);
        }
        if (codeData.description !== undefined) {
          fields.push('description = ?');
          values.push(codeData.description);
        }
        if (codeData.category !== undefined) {
          fields.push('category = ?');
          values.push(codeData.category);
        }
        if (codeData.defaultPrice !== undefined) {
          fields.push('default_price = ?');
          values.push(codeData.defaultPrice);
        }
        if (codeData.taxRate !== undefined) {
          fields.push('tax_rate = ?');
          values.push(codeData.taxRate);
        }
        if (codeData.active !== undefined) {
          fields.push('active = ?');
          values.push(codeData.active);
        }

        if (fields.length === 0) {
          resolve(0);
          return;
        }

        values.push(id);

        const sql = `UPDATE billing_codes SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        db.run(sql, values, function(err) {
          if (err) {
            reject(err);
          } else {
            Auth.logAudit(userId, 'UPDATE_BILLING_CODE', 'billing_codes', id, oldCode, codeData);
            resolve(this.changes);
          }
        });
      });
    });
  }

  // Appointment Billing
  static async createAppointmentBilling(appointmentId, billingData, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO appointment_billings (appointment_id, billing_code_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `;

      const totalPrice = billingData.quantity * billingData.unitPrice;

      const values = [
        appointmentId,
        billingData.billingCodeId,
        billingData.quantity || 1,
        billingData.unitPrice,
        totalPrice
      ];

      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          Auth.logAudit(userId, 'CREATE_APPOINTMENT_BILLING', 'appointment_billings', this.lastID, null, { appointmentId, ...billingData });
          resolve(this.lastID);
        }
      });
    });
  }

  static async getAppointmentBillings(appointmentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ab.*, bc.code, bc.description, bc.category
        FROM appointment_billings ab
        JOIN billing_codes bc ON ab.billing_code_id = bc.id
        WHERE ab.appointment_id = ?
        ORDER BY ab.created_at
      `;

      db.all(sql, [appointmentId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async generateInvoiceFromAppointment(appointmentId, userId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get appointment details
        const appointment = await new Promise((res, rej) => {
          db.get(`
            SELECT a.*, p.first_name, p.last_name, p.patient_id
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.id = ?
          `, [appointmentId], (err, row) => {
            if (err) rej(err);
            else res(row);
          });
        });

        if (!appointment) {
          reject(new Error('Appointment not found'));
          return;
        }

        // Get unbilled items for this appointment
        const unbilledItems = await new Promise((res, rej) => {
          db.all(`
            SELECT ab.*, bc.code, bc.description, bc.category, bc.tax_rate
            FROM appointment_billings ab
            JOIN billing_codes bc ON ab.billing_code_id = bc.id
            WHERE ab.appointment_id = ? AND ab.billed = 0
          `, [appointmentId], (err, rows) => {
            if (err) rej(err);
            else res(rows);
          });
        });

        if (unbilledItems.length === 0) {
          reject(new Error('No unbilled items found for this appointment'));
          return;
        }

        // Calculate totals
        let subtotal = 0;
        const items = unbilledItems.map(item => {
          subtotal += item.total_price;
          return {
            billingCodeId: item.billing_code_id,
            description: `${item.code} - ${item.description}`,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price
          };
        });

        const taxRate = unbilledItems[0]?.tax_rate || 0.15; // Use first item's tax rate
        const taxAmount = subtotal * taxRate;
        const totalAmount = subtotal + taxAmount;

        // Create invoice
        const invoiceData = {
          patientId: appointment.patient_id,
          amount: subtotal,
          taxAmount: taxAmount,
          totalAmount: totalAmount,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
          notes: `Invoice for appointment on ${new Date(appointment.appointment_date).toLocaleDateString()}`,
          items: items
        };

        const invoiceResult = await this.createInvoice(invoiceData, userId);

        // Mark appointment billings as billed
        for (const item of unbilledItems) {
          await new Promise((res, rej) => {
            db.run(
              'UPDATE appointment_billings SET billed = 1, invoice_id = ? WHERE id = ?',
              [invoiceResult.id, item.id],
              (err) => {
                if (err) rej(err);
                else res();
              }
            );
          });
        }

        resolve(invoiceResult);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Payment Management
  static async recordPayment(paymentData, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference_number, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const values = [
        paymentData.invoiceId,
        paymentData.amount,
        paymentData.paymentDate,
        paymentData.paymentMethod,
        paymentData.referenceNumber || null,
        paymentData.notes || null
      ];

      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          // Update invoice status based on total payments
          this.updateInvoiceStatusAfterPayment(paymentData.invoiceId, (updateErr) => {
            if (updateErr) {
              console.error('Error updating invoice status:', updateErr);
            }
            Auth.logAudit(userId, 'RECORD_PAYMENT', 'payments', this.lastID, null, paymentData);
            resolve(this.lastID);
          });
        }
      });
    });
  }

  static updateInvoiceStatusAfterPayment(invoiceId, callback) {
    // Get total payments and invoice amount
    const sql = `
      SELECT
        i.total_amount,
        COALESCE(SUM(p.amount), 0) as total_paid
      FROM invoices i
      LEFT JOIN payments p ON i.id = p.invoice_id
      WHERE i.id = ?
      GROUP BY i.id
    `;

    db.get(sql, [invoiceId], (err, result) => {
      if (err) {
        callback(err);
        return;
      }

      let newStatus = 'unpaid';
      if (result.total_paid >= result.total_amount) {
        newStatus = 'paid';
      } else if (result.total_paid > 0) {
        newStatus = 'partial';
      }

      // Check if overdue
      db.get('SELECT due_date FROM invoices WHERE id = ?', [invoiceId], (err, invoice) => {
        if (!err && invoice) {
          const dueDate = new Date(invoice.due_date);
          const today = new Date();
          if (today > dueDate && newStatus !== 'paid') {
            newStatus = 'overdue';
          }
        }

        db.run('UPDATE invoices SET status = ? WHERE id = ?', [newStatus, invoiceId], callback);
      });
    });
  }

  static async getPayments(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT p.*, i.invoice_number, pt.first_name, pt.last_name
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        JOIN patients pt ON i.patient_id = pt.id
      `;

      const params = [];
      const conditions = [];

      if (filters.invoiceId) {
        conditions.push('p.invoice_id = ?');
        params.push(filters.invoiceId);
      }

      if (filters.paymentMethod) {
        conditions.push('p.payment_method = ?');
        params.push(filters.paymentMethod);
      }

      if (filters.dateFrom) {
        conditions.push('DATE(p.payment_date) >= ?');
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        conditions.push('DATE(p.payment_date) <= ?');
        params.push(filters.dateTo);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY p.payment_date DESC';

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = AccountingService;