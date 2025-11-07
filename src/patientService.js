const db = require('./database');
const Auth = require('./auth');

class PatientService {
  static async createPatient(patientData, userId) {
    return new Promise((resolve, reject) => {
      // Generate unique patient ID
      const patientId = 'P' + Date.now().toString().slice(-8);

      // Build dynamic SQL based on provided fields
      const fields = ['patient_id', 'first_name', 'last_name'];
      const values = [patientId, patientData.firstName, patientData.lastName];
      const placeholders = ['?', '?', '?'];

      // Map of database fields to input data
      const fieldMapping = {
        dateOfBirth: 'date_of_birth',
        gender: 'gender',
        phone: 'phone',
        email: 'email',
        address: 'address',
        emergencyContactName: 'emergency_contact_name',
        emergencyContactPhone: 'emergency_contact_phone',
        medicalHistory: 'medical_history',
        allergies: 'allergies',
        currentMedications: 'current_medications',
        notes: 'notes',
        insuranceProvider: 'insurance_provider',
        insurancePolicyNumber: 'insurance_policy_number',
        insuranceGroupId: 'insurance_group_id',
        insuranceSubscriberId: 'insurance_subscriber_id',
        primaryCarePhysician: 'primary_care_physician',
        preferredPharmacy: 'preferred_pharmacy',
        billingAddress: 'billing_address',
        maritalStatus: 'marital_status',
        occupation: 'occupation',
        employer: 'employer',
        educationLevel: 'education_level',
        languagePreferences: 'language_preferences',
        interpreterNeeded: 'interpreter_needed',
        raceEthnicity: 'race_ethnicity',
        religion: 'religion',
        smokingStatus: 'smoking_status',
        alcoholConsumption: 'alcohol_consumption',
        exerciseHabits: 'exercise_habits',
        dietNutrition: 'diet_nutrition',
        sleepPatterns: 'sleep_patterns',
        stressLevels: 'stress_levels',
        mentalHealthScreening: 'mental_health_screening',
        immunizationHistory: 'immunization_history',
        cancerScreeningHistory: 'cancer_screening_history',
        familyMedicalHistory: 'family_medical_history',
        geneticTestingResults: 'genetic_testing_results',
        hereditaryConditions: 'hereditary_conditions',
        consanguinity: 'consanguinity',
        chronicConditions: 'chronic_conditions',
        hospitalizationRecords: 'hospitalization_records',
        laboratoryResults: 'laboratory_results',
        imagingStudies: 'imaging_studies',
        medicationAllergies: 'medication_allergies',
        drugInteractions: 'drug_interactions',
        preferredContactMethod: 'preferred_contact_method',
        emergencyNotificationPreferences: 'emergency_notification_preferences',
        advanceDirectives: 'advance_directives',
        powerOfAttorney: 'power_of_attorney',
        dnrOrders: 'dnr_orders',
        organDonation: 'organ_donation',
        adlAssessment: 'adl_assessment',
        iadlAssessment: 'iadl_assessment',
        painAssessment: 'pain_assessment',
        functionalIndependence: 'functional_independence',
        qualityOfLifeScores: 'quality_of_life_scores',
        patientSatisfaction: 'patient_satisfaction',
        clinicalTrialsParticipation: 'clinical_trials_participation',
        populationHealthRiskScore: 'population_health_risk_score',
        healthRiskAssessment: 'health_risk_assessment',
        preventiveCareReminders: 'preventive_care_reminders',
        telemedicineHistory: 'telemedicine_history',
        patientPortalAccess: 'patient_portal_access',
        mobileHealthApps: 'mobile_health_apps',
        hipaaAuthorization: 'hipaa_authorization',
        consentForms: 'consent_forms',
        privacyPreferences: 'privacy_preferences',
        dataSharingPermissions: 'data_sharing_permissions'
      };

      // Add provided fields
      Object.keys(fieldMapping).forEach(key => {
        if (patientData[key] !== undefined && patientData[key] !== null) {
          fields.push(fieldMapping[key]);
          values.push(patientData[key]);
          placeholders.push('?');
        }
      });

      const sql = `INSERT INTO patients (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;

      db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          // Log creation
          Auth.logAudit(userId, 'CREATE_PATIENT', 'patients', this.lastID, null, patientData);
          resolve({ id: this.lastID, patientId });
        }
      });
    });
  }

  static async getPatients(searchTerm = '', limit = 50, offset = 0, filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT id, patient_id, first_name, last_name, date_of_birth, gender,
               phone, email, address, medical_history, allergies, current_medications,
               emergency_contact_name, emergency_contact_phone, notes, created_at,
               insurance_provider, marital_status, occupation, smoking_status,
               preferred_contact_method, chronic_conditions
        FROM patients
      `;

      const params = [];
      const conditions = [];

      if (searchTerm) {
        conditions.push(`(first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ? OR phone LIKE ? OR email LIKE ?)`);
        const searchPattern = `%${searchTerm}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Add filter conditions
      if (filters.gender) {
        conditions.push('gender = ?');
        params.push(filters.gender);
      }
      if (filters.smokingStatus) {
        conditions.push('smoking_status = ?');
        params.push(filters.smokingStatus);
      }
      if (filters.insuranceProvider) {
        conditions.push('insurance_provider LIKE ?');
        params.push(`%${filters.insuranceProvider}%`);
      }
      if (filters.chronicConditions) {
        conditions.push('chronic_conditions LIKE ?');
        params.push(`%${filters.chronicConditions}%`);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
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

  static async getPatientById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM patients WHERE id = ?
      `, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async updatePatient(id, patientData, userId) {
    return new Promise((resolve, reject) => {
      // Get old values for audit
      db.get('SELECT * FROM patients WHERE id = ?', [id], (err, oldPatient) => {
        if (err) {
          reject(err);
          return;
        }

        if (!oldPatient) {
          reject(new Error('Patient not found'));
          return;
        }

        const fields = [];
        const values = [];

        Object.keys(patientData).forEach(key => {
          if (patientData[key] !== undefined) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            fields.push(`${dbKey} = ?`);
            values.push(patientData[key]);
          }
        });

        values.push(id);

        const sql = `UPDATE patients SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        db.run(sql, values, function(err) {
          if (err) {
            reject(err);
          } else {
            // Log update
            Auth.logAudit(userId, 'UPDATE_PATIENT', 'patients', id, oldPatient, patientData);
            resolve(this.changes);
          }
        });
      });
    });
  }

  static async deletePatient(id, userId) {
    return new Promise((resolve, reject) => {
      // Get patient for audit
      db.get('SELECT * FROM patients WHERE id = ?', [id], (err, patient) => {
        if (err) {
          reject(err);
          return;
        }

        db.run('DELETE FROM patients WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
          } else {
            // Log deletion
            Auth.logAudit(userId, 'DELETE_PATIENT', 'patients', id, patient, null);
            resolve(this.changes);
          }
        });
      });
    });
  }

  static async getPatientStats() {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as total FROM patients',
        'SELECT COUNT(*) as today FROM patients WHERE DATE(created_at) = DATE(\'now\')',
        'SELECT COUNT(*) as thisMonth FROM patients WHERE strftime(\'%Y-%m\', created_at) = strftime(\'%Y-%m\', \'now\')'
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
          else if (index === 2) results.thisMonth = row.thisMonth;

          completed++;
          if (completed === queries.length) {
            resolve(results);
          }
        });
      });
    });
  }
}

module.exports = PatientService;