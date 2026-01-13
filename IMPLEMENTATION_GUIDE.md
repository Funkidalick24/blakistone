# Step-by-Step Implementation Guide

This guide provides detailed instructions for implementing the fixes outlined in the APPOINTMENT_PATIENT_FIX_PLAN.md document.

## Phase 1: Fix User Context and Session Management

### Step 1.1: Fix User Context in main.js (Priority: HIGH)

**File**: `src/main.js`
**Lines to modify**: Around line 388

**Current Code**:
```javascript
const currentUser = { id: 1 }; // TODO: Implement proper session management
```

**New Code**:
```javascript
const currentUser = await sessionManager.getCurrentUser();
if (!currentUser) {
  throw new Error('No active session found');
}
```

**Changes Required**:
1. Replace hardcoded user object with session retrieval
2. Add null check for session
3. Add proper error handling

**Testing**:
- Verify user context is properly passed to all service calls
- Test audit logging with correct user information
- Ensure session persistence across app restarts

### Step 1.2: Update All IPC Handlers for User Context (Priority: HIGH)

**Files to modify**: `src/main.js`
**Lines to modify**: All patient, appointment, and accounting IPC handlers

**Current Pattern**:
```javascript
ipcMain.handle('patients:update', async (event, id, patientData) => {
  validateSender(event);
  try {
    initializeDatabase();
    const currentUser = { id: 1 }; // TODO: Implement proper session management
    const result = await PatientService.updatePatient(id, patientData, currentUser.id);
    return result;
  } catch (error) {
    console.error('Patient update error:', error);
    return { success: false, error: error.message };
  }
});
```

**New Pattern**:
```javascript
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
```

**Files and Functions to Update**:
- `patients:update` (line ~395)
- `patients:delete` (line ~408)
- `appointments:create` (line ~442)
- `appointments:update` (line ~453)
- `appointments:delete` (line ~464)
- `accounting:createInvoice` (line ~498)
- `accounting:updateInvoice` (line ~592)
- `accounting:createExpense` (line ~530)
- `accounting:updateExpense` (line ~541)
- `accounting:recordPayment` (line ~670)

**Testing**:
- Test all CRUD operations with proper user context
- Verify audit logs contain correct user information
- Test permission checking with real user roles

## Phase 2: Fix Patient Update Functionality

### Step 2.1: Fix Field Mapping in PatientService (Priority: HIGH)

**File**: `src/patientService.js`
**Lines to modify**: Around line 198

**Current Code**:
```javascript
const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
```

**New Code**:
```javascript
const dbKey = key
  .replace(/([A-Z])/g, '_$1')
  .toLowerCase()
  .replace(/^_/, ''); // Remove leading underscore if present
```

**Additional Improvements**:
```javascript
// Add field validation
const validFields = [
  'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'email',
  'address', 'emergency_contact_name', 'emergency_contact_phone',
  'medical_history', 'allergies', 'current_medications', 'notes'
];

const dbKey = key
  .replace(/([A-Z])/g, '_$1')
  .toLowerCase()
  .replace(/^_/, '');

// Validate field exists in database
if (!validFields.includes(dbKey)) {
  console.warn(`Unknown field: ${key} -> ${dbKey}`);
  continue;
}
```

**Testing**:
- Test patient updates with all possible field combinations
- Verify field mapping works for complex field names
- Test audit logging with correct field mappings

### Step 2.2: Improve Error Handling in Patient Updates (Priority: MEDIUM)

**File**: `src/patientService.js`
**Lines to modify**: Around lines 179-219

**Current Code**:
```javascript
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
      // ... rest of function
    });
  });
}
```

**New Code**:
```javascript
static async updatePatient(id, patientData, userId) {
  return new Promise((resolve, reject) => {
    // Validate input
    if (!id || !patientData || !userId) {
      reject(new Error('Missing required parameters'));
      return;
    }

    // Get old values for audit
    db.get('SELECT * FROM patients WHERE id = ?', [id], (err, oldPatient) => {
      if (err) {
        console.error('Database error in updatePatient:', err);
        reject(new Error('Database error occurred'));
        return;
      }

      if (!oldPatient) {
        reject(new Error('Patient not found'));
        return;
      }

      // Validate patient data
      const validFields = Object.keys(oldPatient).filter(key => 
        !['id', 'patient_id', 'created_at', 'updated_at'].includes(key)
      );

      const fieldsToUpdate = Object.keys(patientData).filter(key => 
        patientData[key] !== undefined && patientData[key] !== null
      );

      // Validate fields
      for (const field of fieldsToUpdate) {
        const dbKey = field.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        if (!validFields.includes(dbKey)) {
          reject(new Error(`Invalid field: ${field}`));
          return;
        }
      }

      // Continue with update logic...
    });
  });
}
```

**Testing**:
- Test error scenarios (invalid data, database errors)
- Verify error messages are user-friendly
- Test rollback behavior on errors

## Phase 3: Fix Modal Functionality

### Step 3.1: Fix Cancel Button in Patient Modal (Priority: HIGH)

**File**: `src/renderer.js`
**Lines to modify**: Around lines 1702-1784

**Current Issues**:
1. Modal ID may not be consistent
2. Event handlers may not be properly delegated
3. `closeModal` function may not be accessible

**Fixes Required**:

1. **Ensure Modal Has Correct ID**:
```javascript
// In openPatientModal function around line 1704
modal.id = 'patient-modal';
```

2. **Fix Event Handler Delegation**:
```javascript
// Add proper event delegation for cancel button
modal.querySelector('.modal-close').addEventListener('click', () => {
  closeModal('patient-modal');
});

// Add click outside to close
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal('patient-modal');
  }
});

// Add keyboard escape to close
modal.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('patient-modal');
  }
});
```

3. **Verify closeModal Function**:
```javascript
// Ensure closeModal is globally accessible
window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    // Clean up event listeners if needed
  }
};
```

**Testing**:
- Test cancel button functionality
- Test clicking outside modal to close
- Test keyboard escape key to close
- Verify modal state is properly cleaned up

### Step 3.2: Fix Appointment Modal Structure (Priority: MEDIUM)

**File**: `src/renderer.js`
**Lines to modify**: Around lines 1702-1784

**Similar fixes as patient modal**:
1. Ensure consistent modal ID usage
2. Fix event handler delegation
3. Improve modal accessibility

**Testing**:
- Test appointment modal creation and closing
- Test form submission and cancellation
- Verify modal accessibility features

## Phase 4: Fix Appointment Section Issues

### Step 4.1: Fix Default Billing Code Mappings (Priority: MEDIUM)

**File**: `src/appointmentService.js`
**Lines to modify**: Around lines 164-183

**Current Code**:
```javascript
// Determine default billing code based on appointment type
let defaultCode;
switch (appointment.appointment_type) {
  case 'consultation':
    defaultCode = 'CONSULT';
    break;
  case 'follow-up':
    defaultCode = 'FOLLOWUP';
    break;
  case 'surgery':
    defaultCode = 'SURGERY_CONSULT';
    break;
  case 'therapy':
    defaultCode = 'PHYSIO';
    break;
  case 'assessment':
    defaultCode = 'CONSULT';
    break;
  default:
    defaultCode = 'CONSULT';
}
```

**New Code**:
```javascript
// Get default billing code dynamically
async function getDefaultBillingCode(appointmentType) {
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
}

// Use dynamic lookup
const billingCode = await getDefaultBillingCode(appointment.appointment_type);
if (!billingCode) {
  console.warn('No billing code available for appointment type:', appointment.appointment_type);
  return; // Skip billing creation
}
```

**Testing**:
- Test appointment completion with various types
- Verify billing codes are created correctly
- Test fallback behavior when codes are missing

### Step 4.2: Improve Error Handling in Appointment Operations (Priority: MEDIUM)

**File**: `src/appointmentService.js`
**Lines to modify**: All service methods

**Add comprehensive error handling**:
```javascript
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

      // Continue with existing logic...
    } catch (error) {
      console.error('Error in createAppointment:', error);
      reject(new Error('Failed to create appointment'));
    }
  });
}
```

**Testing**:
- Test error scenarios for all appointment operations
- Verify error messages are user-friendly
- Test rollback behavior on errors

## Phase 5: Fix Data Caching Issues

### Step 5.1: Implement Proper Cache Invalidation (Priority: MEDIUM)

**File**: `src/renderer.js`
**Lines to modify**: Around lines 12-33

**Current Code**:
```javascript
function clearPatientCache() {
  // Clear all patient-related cache entries
  for (const [key] of dataCache) {
    if (key.startsWith('patients_')) {
      dataCache.delete(key);
      cacheExpiry.delete(key);
    }
  }
}
```

**New Code**:
```javascript
// Enhanced cache invalidation functions
function invalidatePatientCache() {
  clearPatientCache();
  // Also clear related caches
  clearAppointmentCache();
  clearInvoiceCache();
  clearAuditLogCache();
}

function clearPatientCache() {
  for (const [key] of dataCache) {
    if (key.startsWith('patients_')) {
      dataCache.delete(key);
      cacheExpiry.delete(key);
    }
  }
}

function clearAppointmentCache() {
  for (const [key] of dataCache) {
    if (key.startsWith('appointments_')) {
      dataCache.delete(key);
      cacheExpiry.delete(key);
    }
  }
}

function clearInvoiceCache() {
  for (const [key] of dataCache) {
    if (key.startsWith('invoices_') || key.startsWith('expenses_') || key.startsWith('payments_')) {
      dataCache.delete(key);
      cacheExpiry.delete(key);
    }
  }
}

function clearAuditLogCache() {
  for (const [key] of dataCache) {
    if (key.startsWith('audit_')) {
      dataCache.delete(key);
      cacheExpiry.delete(key);
    }
  }
}
```

**Integration with Update Functions**:
```javascript
// In handlePatientSubmit function around line 1135
async function handlePatientSubmit(e) {
  e.preventDefault();
  
  try {
    // ... existing validation and data processing ...
    
    if (isEdit) {
      const result = await window.electronAPI.updatePatient(parseInt(isEdit), patientData);
      if (result && result.success) {
        showSuccess('Patient updated successfully');
        // Clear patient cache to ensure fresh data is loaded
        invalidatePatientCache();
      } else {
        showError('Error updating patient: ' + (result?.error || 'Unknown error'));
        return;
      }
    } else {
      await window.electronAPI.savePatient(patientData);
      showSuccess('Patient created successfully');
      // Clear patient cache to ensure fresh data is loaded
      invalidatePatientCache();
    }
    
    closeModal('patient-modal');
    // Force reload patients list to show immediate changes
    loadPatients('', {}, true);
  } catch (error) {
    console.error('Patient save error:', error);
    showError('Error saving patient: ' + (error.message || 'Unknown error occurred'));
  }
}
```

**Testing**:
- Test cache invalidation after updates
- Verify fresh data is loaded after cache clear
- Test cache performance with invalidation

### Step 5.2: Fix Force Refresh Logic (Priority: LOW)

**File**: `src/renderer.js`
**Lines to modify**: Around lines 146-183

**Current Issues**:
- Inconsistent force refresh behavior
- Cache bypass logic may not work properly

**Fixes Required**:
```javascript
// Improve loadPatients function
async function loadPatients(searchTerm = '', filters = {}, forceRefresh = false) {
  const cacheKey = `patients_${searchTerm}_${JSON.stringify(filters)}`;
  
  // If forceRefresh is true, bypass cache and fetch fresh data
  if (!forceRefresh) {
    const cached = getCachedData(cacheKey);
    if (cached) {
      renderPatientsTable(cached);
      return;
    }
  }

  try {
    // Add loading state to table
    const tableContainer = document.querySelector('.data-table');
    if (tableContainer) {
      tableContainer.classList.add('loading');
    }

    const patients = await window.electronAPI.getPatients(searchTerm, undefined, undefined, filters);

    // Only cache if not forcing refresh
    if (!forceRefresh) {
      setCachedData(cacheKey, patients);
    }

    renderPatientsTable(patients);
  } catch (error) {
    console.error('Error loading patients:', error);
    showError('Failed to load patients: ' + (error.message || 'Unknown error'));
  } finally {
    // Remove loading state
    const tableContainer = document.querySelector('.data-table');
    if (tableContainer) {
      tableContainer.classList.remove('loading');
    }
  }
}
```

**Testing**:
- Test force refresh functionality
- Verify cache is properly bypassed
- Test performance impact of force refresh

## Phase 6: Comprehensive Error Handling

### Step 6.1: Add Global Error Handling (Priority: MEDIUM)

**File**: `src/renderer.js`
**Lines to modify**: Add at the end of the file

**New Code**:
```javascript
// Global Error Handling
(function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred. Please try again.');
    event.preventDefault(); // Prevent default browser behavior
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (!event.error.message.includes('ResizeObserver')) {
      showError('An unexpected error occurred. Please try again.');
    }
  });

  // Add error boundary for components
  window.withErrorBoundary = function(component) {
    try {
      return component();
    } catch (error) {
      console.error('Component error:', error);
      return createErrorComponent(error);
    }
  };

  // Create error component
  function createErrorComponent(error) {
    const container = document.createElement('div');
    container.className = 'error-boundary';
    container.innerHTML = `
      <div class="error-message">
        <h3>Something went wrong</h3>
        <p>${error.message || 'An unexpected error occurred'}</p>
        <button onclick="window.location.reload()">Reload Page</button>
      </div>
    `;
    return container;
  }
})();
```

**Testing**:
- Test error boundary functionality
- Verify error messages are displayed correctly
- Test error logging

### Step 6.2: Improve Service Layer Error Handling (Priority: MEDIUM)

**Files**: `src/patientService.js`, `src/appointmentService.js`, `src/accountingService.js`

**Add comprehensive error handling to all service methods**:
```javascript
// Example for patientService.js
static async getPatients(searchTerm = '', limit = 50, offset = 0, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
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
          console.error('Database error in getPatients:', err);
          reject(new Error('Failed to retrieve patients'));
        } else {
          resolve(rows);
        }
      });
    } catch (error) {
      console.error('Error in getPatients:', error);
      reject(new Error('An unexpected error occurred while retrieving patients'));
    }
  });
}
```

**Testing**:
- Test all service methods with error scenarios
- Verify error messages are consistent
- Test error recovery

## Implementation Order

Follow this exact order to avoid overwhelming yourself:

1. **Week 1, Day 1**: Step 1.1 (Fix user context in main.js)
2. **Week 1, Day 2**: Step 1.2 (Update all IPC handlers)
3. **Week 1, Day 3**: Step 2.1 (Fix field mapping in PatientService)
4. **Week 1, Day 4**: Step 3.1 (Fix cancel button in patient modal)
5. **Week 1, Day 5**: Step 2.2 (Improve error handling in patient updates)
6. **Week 2, Day 1**: Step 4.1 (Fix default billing code mappings)
7. **Week 2, Day 2**: Step 5.1 (Implement proper cache invalidation)
8. **Week 2, Day 3**: Step 3.2 (Fix appointment modal structure)
9. **Week 2, Day 4**: Step 4.2 (Improve error handling in appointment operations)
10. **Week 3, Day 1**: Step 6.1 (Add global error handling)
11. **Week 3, Day 2**: Step 6.2 (Improve service layer error handling)
12. **Week 3, Day 3**: Step 5.2 (Fix force refresh logic)

## Testing After Each Step

After implementing each step:

1. **Test the specific functionality** that was fixed
2. **Verify no regressions** in existing functionality
3. **Check console for errors** or warnings
4. **Test user workflows** that use the fixed functionality
5. **Document any issues** found for future reference

## Rollback Plan

If any step causes issues:

1. **Revert the specific changes** made in that step
2. **Test the previous functionality** to ensure it still works
3. **Investigate the issue** before proceeding
4. **Consider alternative approaches** if needed

This step-by-step approach ensures you can implement all fixes systematically without becoming overwhelmed, while maintaining the stability of the application throughout the process.