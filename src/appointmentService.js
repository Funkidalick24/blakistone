const db = require('./database');
const Auth = require('./auth');

class AppointmentService {
  static async createAppointment(appointmentData, userId) {
    return new Promise((resolve, reject) => {
      try {
        // Validate input
        if (!appointmentData || !userId) {
          reject(new Error('Missing required parameters'));
          return;
        }

        // Validate appointment data
        if (!appointmentData.patientId || !appointmentData.doctorId || !appointmentData.appointmentDate) {
          reject(new Error('Missing required appointment fields'));
          return;
        }

        const sql = `
          INSERT INTO appointments (
            patient_id, doctor_id, appointment_date, appointment_type, notes
          ) VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
          appointmentData.patientId,
          appointmentData.doctorId,
          appointmentData.appointmentDate,
          appointmentData.appointmentType || 'consultation',
          appointmentData.notes || null
        ];

        db.run(sql, values, function(err) {
          if (err) {
            console.error('Database error in createAppointment:', err);
            reject(new Error('Failed to create appointment'));
          } else {
            // Log creation
            Auth.logAudit(userId, 'CREATE_APPOINTMENT', 'appointments', this.lastID, null, appointmentData);
            resolve(this.lastID);
          }
        });
      } catch (error) {
        console.error('Error in createAppointment:', error);
        reject(new Error('Failed to create appointment'));
      }
    });
  }

  static async getAppointments(filters = {}, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      try {
        let sql = `
          SELECT a.*, p.first_name, p.last_name, p.patient_id,
                 u.name as doctor_name
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id
          JOIN users u ON a.doctor_id = u.id
        `;

        const params = [];
        const conditions = [];

        if (filters.patientId) {
          conditions.push('a.patient_id = ?');
          params.push(filters.patientId);
        }

        if (filters.doctorId) {
          conditions.push('a.doctor_id = ?');
          params.push(filters.doctorId);
        }

        if (filters.status) {
          conditions.push('a.status = ?');
          params.push(filters.status);
        }

        if (filters.dateFrom) {
          conditions.push('DATE(a.appointment_date) >= ?');
          params.push(filters.dateFrom);
        }

        if (filters.dateTo) {
          conditions.push('DATE(a.appointment_date) <= ?');
          params.push(filters.dateTo);
        }

        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY a.appointment_date DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        db.all(sql, params, (err, rows) => {
          if (err) {
            console.error('Database error in getAppointments:', err);
            reject(new Error('Failed to retrieve appointments'));
          } else {
            resolve(rows);
          }
        });
      } catch (error) {
        console.error('Error in getAppointments:', error);
        reject(new Error('An unexpected error occurred while retrieving appointments'));
      }
    });
  }

  static async updateAppointment(id, appointmentData, userId) {
    return new Promise((resolve, reject) => {
      // Get old values for audit
      db.get('SELECT * FROM appointments WHERE id = ?', [id], (err, oldAppointment) => {
        if (err) {
          reject(err);
          return;
        }

        if (!oldAppointment) {
          reject(new Error('Appointment not found'));
          return;
        }

        const fields = [];
        const values = [];

        if (appointmentData.appointmentDate !== undefined) {
          fields.push('appointment_date = ?');
          values.push(appointmentData.appointmentDate);
        }
        if (appointmentData.appointmentType !== undefined) {
          fields.push('appointment_type = ?');
          values.push(appointmentData.appointmentType);
        }
        if (appointmentData.status !== undefined) {
          fields.push('status = ?');
          values.push(appointmentData.status);
        }
        if (appointmentData.notes !== undefined) {
          fields.push('notes = ?');
          values.push(appointmentData.notes);
        }

        if (fields.length === 0) {
          resolve(0);
          return;
        }

        values.push(id);

        const sql = `UPDATE appointments SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        db.run(sql, values, function(err) {
          if (err) {
            reject(err);
          } else {
            // If appointment status changed to completed, create default billing
            if (appointmentData.status === 'completed' && oldAppointment.status !== 'completed') {
              createDefaultBillingForAppointment(id, userId);
            }

            // Log update
            Auth.logAudit(userId, 'UPDATE_APPOINTMENT', 'appointments', id, oldAppointment, appointmentData);
            resolve(this.changes);
          }
        });
      });
    });
  }

  // Helper function to create default billing when appointment is completed
  static createDefaultBillingForAppointment(appointmentId, userId) {
    // Get appointment details
    db.get(`
      SELECT a.*, u.name as doctor_name
      FROM appointments a
      JOIN users u ON a.doctor_id = u.id
      WHERE a.id = ?
    `, [appointmentId], (err, appointment) => {
      if (err || !appointment) {
        console.error('Error getting appointment for billing:', err);
        return;
      }

      // Get default billing code dynamically
      getDefaultBillingCode(appointment.appointment_type)
        .then(billingCode => {
          if (!billingCode) {
            console.warn('No billing code available for appointment type:', appointment.appointment_type);
            return;
          }

          // Create appointment billing
          const billingData = {
            billingCodeId: billingCode.id,
            quantity: 1,
            unitPrice: billingCode.default_price
          };

          const AccountingService = require('./accountingService');
          return AccountingService.createAppointmentBilling(appointmentId, billingData, userId);
        })
        .then(() => {
          console.log(`Default billing created for appointment ${appointmentId}`);
        })
        .catch(error => {
          console.error('Error creating default billing:', error);
        });
    });
  }

  // Get default billing code dynamically
  static getDefaultBillingCode(appointmentType) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM billing_codes
        WHERE category = ? AND active = 1
        ORDER BY default_price DESC
        LIMIT 1
      `;
      
      db.get(sql, [appointmentType], (err, billingCode) => {
        if (err) {
          console.error('Error getting billing code:', err);
          resolve(null);
          return;
        }
        
        if (billingCode) {
          resolve(billingCode);
        } else {
          // Fallback to consultation code
          db.get('SELECT * FROM billing_codes WHERE code = ? AND active = 1', ['CONSULT'], (err, fallbackCode) => {
            if (err || !fallbackCode) {
              console.warn('No billing code found, using defaults');
              resolve({ id: 1, code: 'CONSULT', default_price: 100 });
            } else {
              resolve(fallbackCode);
            }
          });
        }
      });
    });
  }

  static async deleteAppointment(id, userId) {
    return new Promise((resolve, reject) => {
      // Get appointment for audit
      db.get('SELECT * FROM appointments WHERE id = ?', [id], (err, appointment) => {
        if (err) {
          reject(err);
          return;
        }

        db.run('DELETE FROM appointments WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
          } else {
            // Log deletion
            Auth.logAudit(userId, 'DELETE_APPOINTMENT', 'appointments', id, appointment, null);
            resolve(this.changes);
          }
        });
      });
    });
  }

  static async getAppointmentStats() {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as total FROM appointments',
        'SELECT COUNT(*) as today FROM appointments WHERE DATE(appointment_date) = DATE(\'now\')',
        'SELECT COUNT(*) as upcoming FROM appointments WHERE appointment_date > datetime(\'now\') AND status = \'scheduled\'',
        'SELECT COUNT(*) as completed FROM appointments WHERE status = \'completed\''
      ];

      const results = {};

      let completed = 0;
      queries.forEach((query, index) => {
        db.get(query, (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (index === 0) results.total = row.total;
          else if (index === 1) results.today = row.today;
          else if (index === 2) results.upcoming = row.upcoming;
          else if (index === 3) results.completed = row.completed;

          completed++;
          if (completed === queries.length) {
            resolve(results);
          }
        });
      });
    });
  }

  static async getAvailableDoctors(date) {
    return new Promise((resolve, reject) => {
      // Get doctors who don't have appointments at the specified date/time
      const sql = `
        SELECT u.id, u.name
        FROM users u
        WHERE u.role = 'doctor'
        AND u.id NOT IN (
          SELECT a.doctor_id
          FROM appointments a
          WHERE DATE(a.appointment_date) = DATE(?)
          AND a.status = 'scheduled'
        )
      `;

      db.all(sql, [date], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = AppointmentService;