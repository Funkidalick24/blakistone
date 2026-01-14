# Guided Tours - Detailed Step Definitions

This document defines the detailed steps for all guided tours in the Blackistone Medical Centre application.

## Dashboard Tour

**Purpose:** Introduce users to the main dashboard and key metrics.

**Steps:**
1. **Welcome to Dashboard**
   - Element: `.dashboard-grid`
   - Title: "Welcome to Your Dashboard"
   - Content: "This is your main dashboard where you can see key metrics and statistics at a glance. Let's explore the main features."
   - Position: bottom

2. **Patient Statistics**
   - Element: `.stat-card:nth-child(1)`
   - Title: "Patient Statistics"
   - Content: "This card shows your total patient count and recent additions. Click here to view detailed patient information."
   - Position: right

3. **Today's Appointments**
   - Element: `.stat-card:nth-child(2)`
   - Title: "Today's Appointments"
   - Content: "See how many appointments are scheduled for today. This helps you prepare for your day."
   - Position: right

4. **Monthly Revenue**
   - Element: `.stat-card:nth-child(3)`
   - Title: "Monthly Revenue"
   - Content: "Track your clinic's financial performance with monthly revenue statistics."
   - Position: right

5. **Revenue Chart**
   - Element: `.chart-container`
   - Title: "Revenue Analytics"
   - Content: "This interactive chart shows your revenue trends over time. You can change the chart type and time range using the controls above."
   - Position: top

6. **Advanced Analytics**
   - Element: `.chart-container:nth-child(2)`
   - Title: "Patient Demographics"
   - Content: "View patient demographics and appointment trends to understand your patient base better."
   - Position: top

## Patient Management Tour

**Purpose:** Guide users through patient management features.

**Steps:**
1. **Add New Patient**
   - Element: `#add-patient-btn`
   - Title: "Add New Patients"
   - Content: "Click here to add new patients to your clinic database. You can enter comprehensive patient information including contact details, medical history, and insurance information."
   - Position: bottom

2. **Patient Search**
   - Element: `#patient-search`
   - Title: "Search Patients"
   - Content: "Use this search bar to quickly find patients by name, ID, phone number, or email. The search is fast and works across all patient data."
   - Position: bottom

3. **Advanced Search**
   - Element: `#advanced-search-btn`
   - Title: "Advanced Filtering"
   - Content: "For complex searches, use the advanced search panel with multiple filters including gender, smoking status, insurance provider, age range, and medical conditions."
   - Position: bottom

4. **Patient Table**
   - Element: `.data-table`
   - Title: "Patient List"
   - Content: "This table shows all your patients. You can sort by any column, view patient details, edit information, or perform bulk operations."
   - Position: top

5. **Bulk Operations**
   - Element: `#bulk-actions-btn`
   - Title: "Bulk Operations"
   - Content: "Select multiple patients using the checkboxes to perform bulk operations like exporting data, sending emails, or printing labels."
   - Position: bottom

## Appointments Tour

**Purpose:** Teach users how to manage appointments effectively.

**Steps:**
1. **Schedule Appointment**
   - Element: `#add-appointment-btn`
   - Title: "Schedule Appointments"
   - Content: "Click here to schedule new appointments. You can assign patients to doctors and set specific dates and times."
   - Position: bottom

2. **Appointment Filters**
   - Element: `#appointment-status-filter`
   - Title: "Filter Appointments"
   - Content: "Use this filter to view appointments by status (scheduled, completed, cancelled). This helps you focus on what matters most."
   - Position: bottom

3. **Appointment Table**
   - Element: `.data-table`
   - Title: "Appointment Management"
   - Content: "View all appointments in this table. You can see patient names, doctors, dates, and billing status. Completed appointments can be converted to invoices."
   - Position: top

4. **Create Invoice**
   - Element: `.action-btn.primary`
   - Title: "Create Invoices"
   - Content: "For completed appointments, you can automatically create invoices. This streamlines your billing process."
   - Position: left

## Accounting Tour

**Purpose:** Guide users through financial management features.

**Steps:**
1. **Accounting Overview**
   - Element: `#accounting-screen`
   - Title: "Accounting Dashboard"
   - Content: "Welcome to the accounting section. Here you can manage invoices, track payments, and monitor your clinic's financial health."
   - Position: bottom

2. **Create Invoice**
   - Element: `#add-invoice-btn`
   - Title: "Create New Invoices"
   - Content: "Click here to create new invoices for patient services. You can add multiple billing items and calculate taxes automatically."
   - Position: bottom

3. **Invoice Management**
   - Element: `#invoices-tab`
   - Title: "Invoice Management"
   - Content: "View and manage all your invoices here. Track payment status, due dates, and outstanding balances."
   - Position: top

4. **Billing Codes**
   - Element: `#billing-codes-tab`
   - Title: "Billing Codes"
   - Content: "Manage your billing codes and pricing. These codes are used when creating invoices and determine service pricing."
   - Position: top

5. **Record Payment**
   - Element: `#record-payment-btn`
   - Title: "Record Payments"
   - Content: "Record payments received from patients. You can track different payment methods and reference numbers."
   - Position: bottom

6. **Financial Reports**
   - Element: `#reports-tab`
   - Title: "Financial Reports"
   - Content: "View comprehensive financial reports including revenue, expenses, and profit/loss statements."
   - Position: top

## Admin Tour

**Purpose:** Introduce administrative features and system management.

**Steps:**
1. **Admin Overview**
   - Element: `#admin-screen`
   - Title: "Administration Panel"
   - Content: "This is the administration section where you can manage users, system settings, and perform maintenance tasks."
   - Position: bottom

2. **User Management**
   - Element: `#users-tab`
   - Title: "User Management"
   - Content: "Manage user accounts and permissions. You can add doctors, receptionists, accountants, and other staff members."
   - Position: top

3. **Add User**
   - Element: `#add-user-btn`
   - Title: "Add New Users"
   - Content: "Click here to add new users to the system. Set appropriate roles and permissions for each user type."
   - Position: bottom

4. **Audit Log**
   - Element: `#audit-tab`
   - Title: "Audit Log"
   - Content: "View the audit log to track all system activities. This helps with compliance and troubleshooting."
   - Position: top

5. **Backup System**
   - Element: `#backup-btn`
   - Title: "Data Backup"
   - Content: "Regularly backup your data to prevent loss. You can also restore from previous backups if needed."
   - Position: bottom

6. **Sync Settings**
   - Element: `#sync-tab`
   - Title: "Data Synchronization"
   - Content: "Configure settings for synchronizing data with external systems or cloud services."
   - Position: top

## Advanced Features Tour

**Purpose:** Showcase advanced features for power users.

**Steps:**
1. **Workflow Automation**
   - Element: `#workflow-automation-btn`
   - Title: "Workflow Automation"
   - Content: "Set up automated workflows to streamline your clinic operations, such as follow-up appointments and notifications."
   - Position: bottom

2. **Advanced Search**
   - Element: `#advanced-search-panel`
   - Title: "Advanced Patient Search"
   - Content: "Use advanced filters to find patients based on medical conditions, demographics, and other criteria."
   - Position: bottom

3. **Bulk Operations**
   - Element: `#bulk-selection-controls`
   - Title: "Bulk Patient Operations"
   - Content: "Perform operations on multiple patients at once, including exports, communications, and updates."
   - Position: top

4. **Keyboard Shortcuts**
   - Element: `.header-right .btn`
   - Title: "Keyboard Shortcuts"
   - Content: "Access the help menu to learn keyboard shortcuts for faster navigation and improved productivity."
   - Position: bottom

5. **Performance Monitoring**
   - Element: `.app-layout`
   - Title: "Performance Features"
   - Content: "The app includes performance optimizations like data caching, lazy loading, and virtual scrolling for large datasets."
   - Position: top

6. **Mobile Optimization**
   - Element: `body`
   - Title: "Mobile Support"
   - Content: "The application is optimized for mobile devices with touch gestures, responsive design, and mobile-friendly controls."
   - Position: bottom

## Tour System Features

### Progress Indicators
- Show current step number (e.g., "Step 3 of 6")
- Visual progress bar
- Estimated completion time

### Skip/Resume Functionality
- Allow users to skip tours
- Resume incomplete tours from last step
- Save tour progress in localStorage

### Completion Tracking
- Mark tours as completed
- Prevent showing completed tours again (optional)
- Track completion statistics

### Accessibility
- Screen reader support
- Keyboard navigation (Tab, Enter, Escape)
- High contrast mode support
- Adjustable timing for auto-advance

### Customization
- Allow admins to modify tour content
- Support for multiple languages
- Conditional steps based on user role
- Dynamic content based on user actions