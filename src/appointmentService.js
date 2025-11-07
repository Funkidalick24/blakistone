const db = require('./database');
const Auth = require('./auth');

class AppointmentService {
  static async createAppointment(appointmentData, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO appointments (
          patient_id, doctor_id, appointment_date, appointment_type, notes
        ) VALUES (?, ?, ?, ?, ?)
      `;

      const values = [
        appointmentData.patientId,
        appointmentData.doctorId,
        appointmentData.appointmentDate,
        appointmentData.appointmentType,
        appointmentData.notes
      ];

      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          // Log creation
          Auth.logAudit(userId, 'CREATE_APPOINTMENT', 'appointments', this.lastID, null, appointmentData);
          resolve(this.lastID);
        }
      });
    });
  }

  static async getAppointments(filters = {}, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
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
          reject(err);
        } else {
          resolve(rows);
        }
      });
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
            // Log update
            Auth.logAudit(userId, 'UPDATE_APPOINTMENT', 'appointments', id, oldAppointment, appointmentData);
            resolve(this.changes);
          }
        });
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