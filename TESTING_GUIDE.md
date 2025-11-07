# Blackistone Medical Centre App - Testing Guide

## Overview

This comprehensive testing guide covers all aspects of testing the Blackistone Medical Centre desktop application. The app is built with Electron and provides a complete clinic management system with patient records, appointments, accounting, and administrative functions.

## Prerequisites

### System Requirements
- **Operating System**: Windows 11, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Node.js**: Version 16.x or higher
- **npm**: Version 7.x or higher
- **SQLite3**: Version 5.1.7 (included in dependencies)
- **Electron**: Version 39.1.0 (included in dependencies)

### Test Environment Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Ensure SQLite3 is properly installed
4. Verify Electron installation

## Testing Categories

### 1. Setup and Installation Testing

#### 1.1 First-Time Installation
**Test Case ID**: SETUP-001
**Objective**: Verify clean installation works correctly

**Steps**:
1. Download/clone the application
2. Run `npm install`
3. Execute `npm start`
4. Verify application launches without errors
5. Check database initialization
6. Confirm default admin user is created

**Expected Results**:
- Application starts successfully
- Login screen appears
- Database file `clinic.db` is created
- Default user credentials work

#### 1.2 Dependency Installation
**Test Case ID**: SETUP-002
**Objective**: Ensure all dependencies install correctly

**Steps**:
1. Clear node_modules: `rm -rf node_modules package-lock.json`
2. Run `npm install`
3. Check for any installation errors
4. Verify all packages are installed: `npm list`

**Expected Results**:
- No installation errors
- All dependencies listed in package.json are installed
- SQLite3 binary is available

#### 1.3 Database Initialization
**Test Case ID**: SETUP-003
**Objective**: Verify database schema creation

**Steps**:
1. Delete existing `clinic.db` file
2. Start the application
3. Check database file creation
4. Verify all required tables exist:
   - users
   - patients
   - appointments
   - invoices
   - expenses
   - audit_log

**Expected Results**:
- Database file created automatically
- All tables created with correct schema
- Foreign key relationships established

### 2. User Authentication and Role Testing

#### 2.1 Login Functionality
**Test Case ID**: AUTH-001
**Objective**: Test user login with valid credentials

**Steps**:
1. Launch application
2. Enter valid username and password
3. Click "Login" button
4. Verify dashboard loads

**Expected Results**:
- User successfully authenticated
- Main application screen appears
- User name and role displayed in header
- Navigation menu accessible

#### 2.2 Invalid Login Attempts
**Test Case ID**: AUTH-002
**Objective**: Test login with invalid credentials

**Steps**:
1. Enter wrong username
2. Enter wrong password
3. Try various combinations
4. Verify error messages

**Expected Results**:
- Login rejected with appropriate error message
- Application remains on login screen
- No access to main application

#### 2.3 Role-Based Access Control
**Test Case ID**: AUTH-003
**Objective**: Verify role-based permissions

**Test Data**:
- Admin user: Full access to all sections
- Doctor user: Access to dashboard, patients, appointments
- Receptionist user: Access to dashboard, patients, appointments
- Accountant user: Access to dashboard, accounting

**Steps**:
1. Login with different user roles
2. Attempt to access restricted sections
3. Verify appropriate access/denial

**Expected Results**:
- Users can only access permitted sections
- Unauthorized access shows error message
- Navigation reflects user permissions

#### 2.4 Session Management
**Test Case ID**: AUTH-004
**Objective**: Test session persistence and logout

**Steps**:
1. Login to application
2. Close and reopen application
3. Test logout functionality
4. Verify session ends properly

**Expected Results**:
- Session persists across application restarts
- Logout clears session
- Login required after logout

### 3. Patient Management Testing

#### 3.1 Add New Patient
**Test Case ID**: PATIENT-001
**Objective**: Create new patient record

**Steps**:
1. Navigate to Patients section
2. Click "Add Patient" button
3. Fill all required fields (name, phone)
4. Fill optional fields across all tabs
5. Save patient record

**Expected Results**:
- Patient record created successfully
- All data saved correctly
- Patient appears in patient list
- Success message displayed

#### 3.2 Patient Search and Filtering
**Test Case ID**: PATIENT-002
**Objective**: Test patient search functionality

**Steps**:
1. Use quick search bar
2. Test advanced search filters:
   - Gender
   - Smoking status
   - Insurance provider
   - Age range
   - Chronic conditions
3. Combine multiple filters

**Expected Results**:
- Search results update in real-time
- Filters work individually and combined
- Active filters displayed
- Clear filters functionality works

#### 3.3 Patient Data Validation
**Test Case ID**: PATIENT-003
**Objective**: Verify data validation rules

**Steps**:
1. Try to save patient with missing required fields
2. Enter invalid data formats
3. Test field length limits
4. Verify email format validation

**Expected Results**:
- Required field validation works
- Appropriate error messages shown
- Invalid data rejected
- Valid data accepted

#### 3.4 Bulk Patient Operations
**Test Case ID**: PATIENT-004
**Objective**: Test bulk selection and operations

**Steps**:
1. Select multiple patients using checkboxes
2. Test bulk export to CSV
3. Test bulk email functionality
4. Test bulk delete with confirmation

**Expected Results**:
- Multiple selection works
- Bulk operations execute correctly
- Confirmation dialogs appear for destructive actions
- Progress feedback provided

#### 3.5 Patient Record Updates
**Test Case ID**: PATIENT-005
**Objective**: Test patient data modification

**Steps**:
1. Edit existing patient record
2. Modify data across all tabs
3. Save changes
4. Verify audit trail

**Expected Results**:
- Changes saved successfully
- Data integrity maintained
- Audit log records changes
- Original data recoverable if needed

### 4. Appointment Scheduling Testing

#### 4.1 Create Appointment
**Test Case ID**: APPT-001
**Objective**: Schedule new appointment

**Steps**:
1. Navigate to Appointments section
2. Click "Schedule Appointment"
3. Select patient, doctor, date/time
4. Add appointment details
5. Save appointment

**Expected Results**:
- Appointment created successfully
- Appears in appointment list
- Calendar integration works
- Notifications triggered

#### 4.2 Appointment Status Management
**Test Case ID**: APPT-002
**Objective**: Test appointment status changes

**Steps**:
1. Change appointment status (scheduled → completed)
2. Test all status transitions
3. Verify status-dependent actions

**Expected Results**:
- Status changes save correctly
- UI updates reflect new status
- Related workflows trigger appropriately

#### 4.3 Appointment Filtering
**Test Case ID**: APPT-003
**Objective**: Test appointment filtering

**Steps**:
1. Filter by status
2. Filter by date range
3. Filter by doctor/patient

**Expected Results**:
- Filters work correctly
- Results update dynamically
- Filter combinations work

#### 4.4 Workflow Automation
**Test Case ID**: APPT-004
**Objective**: Test automated workflows

**Steps**:
1. Complete an appointment
2. Check for automated follow-up scheduling
3. Verify notification triggers

**Expected Results**:
- Automated actions execute
- Follow-up appointments created
- Notifications sent appropriately

### 5. Accounting and Billing Testing

#### 5.1 Invoice Creation
**Test Case ID**: ACCT-001
**Objective**: Create and manage invoices

**Steps**:
1. Navigate to Accounting → Invoices
2. Click "Create Invoice"
3. Select patient and services
4. Add line items
5. Generate invoice

**Expected Results**:
- Invoice created with correct calculations
- PDF generation works
- Invoice appears in list

#### 5.2 Payment Processing
**Test Case ID**: ACCT-002
**Objective**: Test payment recording

**Steps**:
1. Record payment against invoice
2. Update payment status
3. Verify financial calculations

**Expected Results**:
- Payment recorded correctly
- Invoice status updates
- Financial reports reflect changes

#### 5.3 Expense Tracking
**Test Case ID**: ACCT-003
**Objective**: Test expense management

**Steps**:
1. Add new expense
2. Categorize expense
3. Verify expense reporting

**Expected Results**:
- Expenses recorded correctly
- Categories work properly
- Reports include expense data

#### 5.4 Financial Reporting
**Test Case ID**: ACCT-004
**Objective**: Test financial reports

**Steps**:
1. Generate revenue reports
2. Check expense summaries
3. Verify profit calculations

**Expected Results**:
- Reports generate accurately
- Data matches source records
- Charts display correctly

### 6. Admin Functions Testing

#### 6.1 User Management
**Test Case ID**: ADMIN-001
**Objective**: Test user account management

**Steps**:
1. Create new user accounts
2. Assign roles and permissions
3. Update user information
4. Deactivate/delete users

**Expected Results**:
- Users created with correct roles
- Permissions enforced properly
- User data updates work
- Deactivation prevents login

#### 6.2 Audit Logging
**Test Case ID**: ADMIN-002
**Objective**: Verify audit trail functionality

**Steps**:
1. Perform various operations
2. Check audit log entries
3. Filter audit logs
4. Export audit data

**Expected Results**:
- All operations logged
- Log entries contain correct information
- Filtering works
- Export functionality available

#### 6.3 System Settings
**Test Case ID**: ADMIN-003
**Objective**: Test system configuration

**Steps**:
1. Modify system settings
2. Test setting persistence
3. Verify setting effects

**Expected Results**:
- Settings save correctly
- Changes take effect immediately
- Settings persist across sessions

### 7. Data Integrity and Backup Testing

#### 7.1 Database Backup
**Test Case ID**: BACKUP-001
**Objective**: Test backup functionality

**Steps**:
1. Navigate to Admin → Backup & Restore
2. Click "Create Backup"
3. Verify backup file creation
4. Test backup file integrity

**Expected Results**:
- Backup created successfully
- File contains all data
- Backup file is valid SQLite database

#### 7.2 Data Restore
**Test Case ID**: BACKUP-002
**Objective**: Test data restoration

**Steps**:
1. Create backup
2. Modify/delete some data
3. Restore from backup
4. Verify data integrity

**Expected Results**:
- Restore process completes
- All data restored correctly
- No data corruption
- Application functions normally after restore

#### 7.3 Data Consistency
**Test Case ID**: BACKUP-003
**Objective**: Verify referential integrity

**Steps**:
1. Create related records (patient → appointment → invoice)
2. Delete parent records
3. Check cascade behavior
4. Verify foreign key constraints

**Expected Results**:
- Referential integrity maintained
- Cascade operations work correctly
- No orphaned records
- Data consistency preserved

### 8. Performance and Security Testing

#### 8.1 Performance Testing
**Test Case ID**: PERF-001
**Objective**: Test application performance

**Steps**:
1. Load large datasets (1000+ patients)
2. Test search performance
3. Monitor memory usage
4. Test concurrent operations

**Expected Results**:
- Application remains responsive
- Memory usage stays within limits
- Operations complete within reasonable time
- No performance degradation

#### 8.2 Security Testing
**Test Case ID**: SEC-001
**Objective**: Test security measures

**Steps**:
1. Test SQL injection prevention
2. Verify input sanitization
3. Check file access restrictions
4. Test session security

**Expected Results**:
- No SQL injection vulnerabilities
- Input properly sanitized
- File access restricted appropriately
- Sessions secure and properly managed

#### 8.3 UI/UX Testing
**Test Case ID**: UI-001
**Objective**: Test user interface and experience

**Steps**:
1. Test responsive design
2. Verify accessibility features
3. Test keyboard navigation
4. Check mobile/touch support

**Expected Results**:
- Interface works on different screen sizes
- Accessibility standards met
- Keyboard navigation works
- Touch interactions function properly

## Test Data Management

### Sample Data Creation
Create test data using these scripts:

```sql
-- Sample patients
INSERT INTO patients (first_name, last_name, phone, email) VALUES
('John', 'Doe', '+1234567890', 'john.doe@email.com'),
('Jane', 'Smith', '+1234567891', 'jane.smith@email.com');

-- Sample users
INSERT INTO users (username, password, role, name, email) VALUES
('admin', '$2a$10$hashedpassword', 'admin', 'System Admin', 'admin@clinic.com'),
('doctor1', '$2a$10$hashedpassword', 'doctor', 'Dr. Smith', 'doctor@clinic.com');
```

### Test Data Cleanup
```sql
-- Clear all test data
DELETE FROM audit_log;
DELETE FROM invoice_payments;
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM expenses;
DELETE FROM appointments;
DELETE FROM patients;
DELETE FROM users WHERE username LIKE 'test%';
```

## Automated Testing

### Unit Tests
```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration
```

### End-to-End Tests
```bash
# Run E2E tests
npm run test:e2e
```

## Bug Reporting Template

```
**Bug Report**

**Test Case ID**: [ID]
**Severity**: [Critical/High/Medium/Low]
**Environment**: [OS, Node version, App version]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshots/Logs**:
[Attach if applicable]

**Additional Information**:
[Any other relevant details]
```

## Regression Testing Checklist

- [ ] All previously reported bugs are fixed
- [ ] No new bugs introduced
- [ ] Performance benchmarks met
- [ ] Security requirements satisfied
- [ ] Data integrity maintained
- [ ] User interface consistent
- [ ] Documentation updated

## Release Testing

### Pre-Release Checklist
- [ ] All automated tests pass
- [ ] Manual testing completed
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Installation packages created
- [ ] Release notes prepared

### Post-Release Monitoring
- [ ] Monitor error logs
- [ ] Track user feedback
- [ ] Monitor performance metrics
- [ ] Plan for hotfixes if needed

---

**Note**: This testing guide should be updated as new features are added or existing functionality is modified. Regular review and updates ensure comprehensive test coverage.