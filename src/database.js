const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.resourcesPath || path.join(__dirname, '..'), 'clinic.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Initialize database tables
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

  // Patients table with comprehensive medical fields
  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth DATE,
      gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
      phone TEXT,
      email TEXT,
      address TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      medical_history TEXT,
      allergies TEXT,
      current_medications TEXT,
      notes TEXT,

      -- Insurance & Billing Information
      insurance_provider TEXT,
      insurance_policy_number TEXT,
      insurance_group_id TEXT,
      insurance_subscriber_id TEXT,
      primary_care_physician TEXT,
      preferred_pharmacy TEXT,
      billing_address TEXT,

      -- Demographic & Social Information
      marital_status TEXT CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed', 'Other')),
      occupation TEXT,
      employer TEXT,
      education_level TEXT,
      language_preferences TEXT,
      interpreter_needed BOOLEAN DEFAULT 0,
      race_ethnicity TEXT,
      religion TEXT,

      -- Lifestyle & Preventive Care
      smoking_status TEXT CHECK (smoking_status IN ('Never', 'Former', 'Current')),
      alcohol_consumption TEXT,
      exercise_habits TEXT,
      diet_nutrition TEXT,
      sleep_patterns TEXT,
      stress_levels TEXT,
      mental_health_screening TEXT,
      immunization_history TEXT,
      cancer_screening_history TEXT,

      -- Family & Genetic History
      family_medical_history TEXT,
      genetic_testing_results TEXT,
      hereditary_conditions TEXT,
      consanguinity TEXT,

      -- Vital Signs & Biometrics (stored as JSON for multiple readings)
      vital_signs_history TEXT, -- JSON array of {date, height, weight, bmi, bp_systolic, bp_diastolic, heart_rate, temperature, measurements}

      -- Advanced Medical Information
      chronic_conditions TEXT,
      hospitalization_records TEXT,
      laboratory_results TEXT,
      imaging_studies TEXT,
      medication_allergies TEXT,
      drug_interactions TEXT,

      -- Communication & Preferences
      preferred_contact_method TEXT CHECK (preferred_contact_method IN ('Phone', 'Email', 'Text', 'Mail')),
      emergency_notification_preferences TEXT,
      advance_directives TEXT,
      power_of_attorney TEXT,
      dnr_orders TEXT,
      organ_donation TEXT,

      -- Quality of Life & Functional Assessment
      adl_assessment TEXT, -- Activities of Daily Living
      iadl_assessment TEXT, -- Instrumental Activities of Daily Living
      pain_assessment TEXT,
      functional_independence TEXT,
      quality_of_life_scores TEXT,
      patient_satisfaction TEXT,

      -- Research & Population Health
      clinical_trials_participation TEXT,
      population_health_risk_score REAL,
      health_risk_assessment TEXT,
      preventive_care_reminders TEXT,

      -- Digital Health Integration
      wearable_device_data TEXT,
      telemedicine_history TEXT,
      patient_portal_access BOOLEAN DEFAULT 0,
      mobile_health_apps TEXT,

      -- Regulatory & Compliance
      hipaa_authorization BOOLEAN DEFAULT 1,
      consent_forms TEXT,
      privacy_preferences TEXT,
      data_sharing_permissions TEXT,

      -- Orthopedic-specific fields (keeping existing ones)
      orthopedic_history TEXT,
      previous_surgeries TEXT,
      implant_types TEXT,
      current_condition TEXT,
      pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
      range_of_motion TEXT,
      functional_assessment TEXT,
      treatment_plan TEXT,
      rehabilitation_notes TEXT,
      follow_up_schedule TEXT,
      imaging_results TEXT,
      surgical_procedures TEXT,
      outcome_measures TEXT,
      comorbidities TEXT,
      lifestyle_factors TEXT,
      activity_level TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Appointments table with orthopedic enhancements
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appointment_date DATETIME NOT NULL,
      appointment_type TEXT CHECK (appointment_type IN ('consultation', 'follow-up', 'surgery', 'therapy', 'assessment')),
      status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
      notes TEXT,

      -- Orthopedic-specific appointment fields
      pre_op_assessment TEXT,
      post_op_care TEXT,
      therapy_session TEXT,
      pain_assessment TEXT,
      mobility_assessment TEXT,
      treatment_progress TEXT,
      next_appointment_notes TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients (id),
      FOREIGN KEY (doctor_id) REFERENCES users (id)
    )
  `);

  // Invoices table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      invoice_number TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'overdue', 'cancelled')),
      due_date DATE,
      payment_date DATE,
      payment_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients (id)
    )
  `);

  // Invoice items table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      billing_code_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices (id),
      FOREIGN KEY (billing_code_id) REFERENCES billing_codes (id)
    )
  `);

  // Billing codes table - defines billable services
  db.run(`
    CREATE TABLE IF NOT EXISTS billing_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      default_price REAL NOT NULL,
      tax_rate REAL DEFAULT 0.15,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Appointment billings table - links appointments to billing items
  db.run(`
    CREATE TABLE IF NOT EXISTS appointment_billings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      billing_code_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      billed BOOLEAN DEFAULT 0,
      invoice_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments (id),
      FOREIGN KEY (billing_code_id) REFERENCES billing_codes (id),
      FOREIGN KEY (invoice_id) REFERENCES invoices (id)
    )
  `);

  // Payments table - tracks all payments made
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'insurance', 'other')),
      reference_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices (id)
    )
  `);

  // Billing rules table - defines automatic billing triggers
  db.run(`
    CREATE TABLE IF NOT EXISTS billing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_type TEXT CHECK (trigger_type IN ('appointment_completed', 'appointment_scheduled', 'manual')),
      billing_code_id INTEGER NOT NULL,
      condition_json TEXT, -- JSON string for complex conditions
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (billing_code_id) REFERENCES billing_codes (id)
    )
  `);

  // Expenses table
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date DATE NOT NULL,
      vendor TEXT,
      receipt_path TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Audit log table
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      table_name TEXT,
      record_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Insert default admin user if not exists
  db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", (err, row) => {
    if (!err && row.count === 0) {
      const bcrypt = require('bcryptjs');
      const saltRounds = 10;
      const defaultPassword = 'admin123';
      bcrypt.hash(defaultPassword, saltRounds, (err, hash) => {
        if (!err) {
          db.run(`
            INSERT INTO users (username, password_hash, role, name, email)
            VALUES ('admin', ?, 'admin', 'System Administrator', 'admin@blackistone.com')
          `, [hash]);
        }
      });
    }
  });

  // Insert default billing codes if not exists
  db.get("SELECT COUNT(*) as count FROM billing_codes", (err, row) => {
    if (!err && row.count === 0) {
      const defaultBillingCodes = [
        { code: 'CONSULT', description: 'General Consultation', category: 'Consultation', default_price: 150.00 },
        { code: 'FOLLOWUP', description: 'Follow-up Visit', category: 'Consultation', default_price: 100.00 },
        { code: 'XRAY', description: 'X-Ray Examination', category: 'Diagnostic', default_price: 200.00 },
        { code: 'BLOOD_TEST', description: 'Blood Test', category: 'Diagnostic', default_price: 75.00 },
        { code: 'ULTRASOUND', description: 'Ultrasound', category: 'Diagnostic', default_price: 300.00 },
        { code: 'PHYSIO', description: 'Physiotherapy Session', category: 'Therapy', default_price: 120.00 },
        { code: 'SURGERY_CONSULT', description: 'Surgical Consultation', category: 'Consultation', default_price: 250.00 },
        { code: 'EMERGENCY', description: 'Emergency Visit', category: 'Emergency', default_price: 300.00 },
        { code: 'VACCINE', description: 'Vaccination', category: 'Preventive', default_price: 50.00 },
        { code: 'PRESCRIPTION', description: 'Prescription Fee', category: 'Medication', default_price: 25.00 }
      ];

      defaultBillingCodes.forEach(code => {
        db.run(`
          INSERT INTO billing_codes (code, description, category, default_price, tax_rate)
          VALUES (?, ?, ?, ?, 0.15)
        `, [code.code, code.description, code.category, code.default_price], (err) => {
          if (err) {
            console.error('Error inserting default billing code:', err.message);
          }
        });
      });
    }
  });

  // Data migration: Update existing patients with default values for new required fields
  // This ensures backward compatibility with existing patient records
  db.run(`
    UPDATE patients SET
      hipaa_authorization = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE hipaa_authorization IS NULL
  `, (err) => {
    if (err) {
      console.error('Error updating existing patients with default HIPAA authorization:', err.message);
    } else {
      console.log('Successfully updated existing patients with default values');
    }
  });

  // Add new columns to existing patients table if they don't exist
  // This handles schema evolution for existing databases
  const newColumns = [
    // Insurance & Billing
    "ALTER TABLE patients ADD COLUMN insurance_provider TEXT",
    "ALTER TABLE patients ADD COLUMN insurance_policy_number TEXT",
    "ALTER TABLE patients ADD COLUMN insurance_group_id TEXT",
    "ALTER TABLE patients ADD COLUMN insurance_subscriber_id TEXT",
    "ALTER TABLE patients ADD COLUMN primary_care_physician TEXT",
    "ALTER TABLE patients ADD COLUMN preferred_pharmacy TEXT",
    "ALTER TABLE patients ADD COLUMN billing_address TEXT",

    // Demographics & Social
    "ALTER TABLE patients ADD COLUMN marital_status TEXT CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed', 'Other'))",
    "ALTER TABLE patients ADD COLUMN occupation TEXT",
    "ALTER TABLE patients ADD COLUMN employer TEXT",
    "ALTER TABLE patients ADD COLUMN education_level TEXT",
    "ALTER TABLE patients ADD COLUMN language_preferences TEXT",
    "ALTER TABLE patients ADD COLUMN interpreter_needed BOOLEAN DEFAULT 0",
    "ALTER TABLE patients ADD COLUMN race_ethnicity TEXT",
    "ALTER TABLE patients ADD COLUMN religion TEXT",

    // Lifestyle & Preventive Care
    "ALTER TABLE patients ADD COLUMN smoking_status TEXT CHECK (smoking_status IN ('Never', 'Former', 'Current'))",
    "ALTER TABLE patients ADD COLUMN alcohol_consumption TEXT",
    "ALTER TABLE patients ADD COLUMN exercise_habits TEXT",
    "ALTER TABLE patients ADD COLUMN diet_nutrition TEXT",
    "ALTER TABLE patients ADD COLUMN sleep_patterns TEXT",
    "ALTER TABLE patients ADD COLUMN stress_levels TEXT",
    "ALTER TABLE patients ADD COLUMN mental_health_screening TEXT",
    "ALTER TABLE patients ADD COLUMN immunization_history TEXT",
    "ALTER TABLE patients ADD COLUMN cancer_screening_history TEXT",

    // Family & Genetic
    "ALTER TABLE patients ADD COLUMN family_medical_history TEXT",
    "ALTER TABLE patients ADD COLUMN genetic_testing_results TEXT",
    "ALTER TABLE patients ADD COLUMN hereditary_conditions TEXT",
    "ALTER TABLE patients ADD COLUMN consanguinity TEXT",

    // Vital Signs
    "ALTER TABLE patients ADD COLUMN vital_signs_history TEXT",

    // Advanced Medical
    "ALTER TABLE patients ADD COLUMN chronic_conditions TEXT",
    "ALTER TABLE patients ADD COLUMN hospitalization_records TEXT",
    "ALTER TABLE patients ADD COLUMN laboratory_results TEXT",
    "ALTER TABLE patients ADD COLUMN imaging_studies TEXT",
    "ALTER TABLE patients ADD COLUMN medication_allergies TEXT",
    "ALTER TABLE patients ADD COLUMN drug_interactions TEXT",

    // Communication & Preferences
    "ALTER TABLE patients ADD COLUMN preferred_contact_method TEXT CHECK (preferred_contact_method IN ('Phone', 'Email', 'Text', 'Mail'))",
    "ALTER TABLE patients ADD COLUMN emergency_notification_preferences TEXT",
    "ALTER TABLE patients ADD COLUMN advance_directives TEXT",
    "ALTER TABLE patients ADD COLUMN power_of_attorney TEXT",
    "ALTER TABLE patients ADD COLUMN dnr_orders TEXT",
    "ALTER TABLE patients ADD COLUMN organ_donation TEXT",

    // Quality of Life
    "ALTER TABLE patients ADD COLUMN adl_assessment TEXT",
    "ALTER TABLE patients ADD COLUMN iadl_assessment TEXT",
    "ALTER TABLE patients ADD COLUMN pain_assessment TEXT",
    "ALTER TABLE patients ADD COLUMN functional_independence TEXT",
    "ALTER TABLE patients ADD COLUMN quality_of_life_scores TEXT",
    "ALTER TABLE patients ADD COLUMN patient_satisfaction TEXT",

    // Research & Population Health
    "ALTER TABLE patients ADD COLUMN clinical_trials_participation TEXT",
    "ALTER TABLE patients ADD COLUMN population_health_risk_score REAL",
    "ALTER TABLE patients ADD COLUMN health_risk_assessment TEXT",
    "ALTER TABLE patients ADD COLUMN preventive_care_reminders TEXT",

    // Digital Health
    "ALTER TABLE patients ADD COLUMN wearable_device_data TEXT",
    "ALTER TABLE patients ADD COLUMN telemedicine_history TEXT",
    "ALTER TABLE patients ADD COLUMN patient_portal_access BOOLEAN DEFAULT 0",
    "ALTER TABLE patients ADD COLUMN mobile_health_apps TEXT",

    // Regulatory & Compliance
    "ALTER TABLE patients ADD COLUMN hipaa_authorization BOOLEAN DEFAULT 1",
    "ALTER TABLE patients ADD COLUMN consent_forms TEXT",
    "ALTER TABLE patients ADD COLUMN privacy_preferences TEXT",
    "ALTER TABLE patients ADD COLUMN data_sharing_permissions TEXT"
  ];

  // Execute ALTER TABLE statements sequentially
  newColumns.forEach(sql => {
    db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding column:', err.message);
      }
    });
  });

  // Add new columns to invoice_items table
  const invoiceItemsColumns = [
    "ALTER TABLE invoice_items ADD COLUMN billing_code_id INTEGER REFERENCES billing_codes (id)"
  ];

  invoiceItemsColumns.forEach(sql => {
    db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding invoice_items column:', err.message);
      }
    });
  });
});

module.exports = db;