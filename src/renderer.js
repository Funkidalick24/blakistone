// Blackistone Medical Centre App - Renderer Process

import './index.css';
import Chart from 'chart.js/auto';
// FontAwesome is now loaded via CDN in index.html

// Global state
let currentUser = null;
let currentScreen = 'dashboard';

// Performance optimization: Data caching and lazy loading
const dataCache = new Map();
const cacheExpiry = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData(key) {
  const cached = dataCache.get(key);
  const expiry = cacheExpiry.get(key);

  if (cached && expiry && Date.now() < expiry) {
    return cached;
  }

  // Cache miss or expired
  dataCache.delete(key);
  cacheExpiry.delete(key);
  return null;
}

function setCachedData(key, data) {
  dataCache.set(key, data);
  cacheExpiry.set(key, Date.now() + CACHE_DURATION);
}

function clearExpiredCache() {
  const now = Date.now();
  for (const [key, expiry] of cacheExpiry) {
    if (now > expiry) {
      dataCache.delete(key);
      cacheExpiry.delete(key);
    }
  }
}

// Lazy loading for images and heavy components
function lazyLoadImages() {
  const images = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy-load');
        observer.unobserve(img);
      }
    });
  });

  images.forEach(img => imageObserver.observe(img));
}

// Virtual scrolling for large tables
function initializeVirtualScrolling() {
  const tableContainer = document.querySelector('.data-table');
  if (!tableContainer) return;

  let virtualItems = [];
  let visibleRange = { start: 0, end: 50 };
  const ITEM_HEIGHT = 50;
  const CONTAINER_HEIGHT = 400;

  tableContainer.style.height = CONTAINER_HEIGHT + 'px';
  tableContainer.style.overflow = 'auto';
  tableContainer.style.position = 'relative';

  function updateVisibleItems() {
    const scrollTop = tableContainer.scrollTop;
    const start = Math.floor(scrollTop / ITEM_HEIGHT);
    const end = Math.min(start + Math.ceil(CONTAINER_HEIGHT / ITEM_HEIGHT) + 5, virtualItems.length);

    if (start !== visibleRange.start || end !== visibleRange.end) {
      visibleRange = { start, end };
      renderVirtualItems();
    }
  }

  function renderVirtualItems() {
    const tbody = tableContainer.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      if (virtualItems[i]) {
        const item = virtualItems[i];
        const row = document.createElement('tr');
        row.className = 'virtual-scroll-item';
        row.style.transform = `translateY(${(i - visibleRange.start) * ITEM_HEIGHT}px)`;
        row.innerHTML = item.html;
        tbody.appendChild(row);
      }
    }
  }

  tableContainer.addEventListener('scroll', updateVisibleItems);
}

// Performance monitoring
function initializePerformanceMonitoring() {
  // Monitor long tasks
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 50) { // Tasks longer than 50ms
        console.warn('Long task detected:', entry);
      }
    }
  });

  observer.observe({ entryTypes: ['longtask'] });

  // Monitor memory usage
  if ('memory' in performance) {
    setInterval(() => {
      const memInfo = performance.memory;
      if (memInfo.usedJSHeapSize > memInfo.totalJSHeapSize * 0.8) {
        console.warn('High memory usage detected');
        // Trigger garbage collection hints
        if (window.gc) window.gc();
      }
    }, 30000); // Check every 30 seconds
  }
}

// Optimized data loading with debouncing and caching
async function loadPatients(searchTerm = '', filters = {}) {
  const cacheKey = `patients_${searchTerm}_${JSON.stringify(filters)}`;
  const cached = getCachedData(cacheKey);

  if (cached) {
    renderPatientsTable(cached);
    return;
  }

  try {
    // Add loading state to table
    const tableContainer = document.querySelector('.data-table');
    if (tableContainer) {
      tableContainer.classList.add('loading');
    }

    const patients = await window.electronAPI.getPatients(searchTerm, undefined, undefined, filters);

    // Cache the results
    setCachedData(cacheKey, patients);

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

// Periodic cache cleanup
setInterval(clearExpiredCache, CACHE_DURATION);

// DOM elements
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const currentUserSpan = document.getElementById('current-user');
const navBtns = document.querySelectorAll('.nav-btn');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // FontAwesome icons are loaded via CDN, no initialization needed

  setupEventListeners();
  initializeSidebarState();
  checkAuthStatus();

  // Log window dimensions and div heights for debugging
  console.log('Window dimensions:', { width: window.innerWidth, height: window.innerHeight });
  console.log('Document body height:', document.body.offsetHeight);

  // Log main container heights
  setTimeout(() => {
    const appLayout = document.querySelector('.app-layout');
    const appMain = document.querySelector('.app-main');
    const dashboard = document.querySelector('.dashboard-grid');
    const chartContainer = document.querySelector('.chart-container');
    const statCards = document.querySelectorAll('.stat-card');

    console.log('App layout height:', appLayout ? appLayout.offsetHeight : 'not found');
    console.log('App main height:', appMain ? appMain.offsetHeight : 'not found');
    console.log('Dashboard grid height:', dashboard ? dashboard.offsetHeight : 'not found');
    console.log('Chart container height:', chartContainer ? chartContainer.offsetHeight : 'not found');
    console.log('Number of stat cards:', statCards.length);
    statCards.forEach((card, index) => {
      console.log(`Stat card ${index + 1} height:`, card.offsetHeight);
    });

    // Log after advanced analytics load
    setTimeout(() => {
      const allChartContainers = document.querySelectorAll('.chart-container');
      console.log('Total chart containers after analytics:', allChartContainers.length);
      allChartContainers.forEach((container, index) => {
        console.log(`Chart container ${index + 1} height:`, container.offsetHeight);
      });
    }, 100);
  }, 1000);
});

// Setup event listeners
function setupEventListeners() {
  // Login form
  loginForm.addEventListener('submit', handleLogin);

  // Logout
  logoutBtn.addEventListener('click', handleLogout);

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
  }

  // Navigation
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });

  // Patient management
  document.getElementById('add-patient-btn').addEventListener('click', () => openPatientModal());
  document.getElementById('patient-search').addEventListener('input', debounce(searchPatients, 300));

  // Appointment management
  document.getElementById('add-appointment-btn').addEventListener('click', () => openAppointmentModal());
  document.getElementById('appointment-status-filter').addEventListener('change', loadAppointments);

  // Accounting
  document.getElementById('add-invoice-btn').addEventListener('click', () => openInvoiceModal());
  document.getElementById('add-expense-btn').addEventListener('click', () => openExpenseModal());

  // Accounting tabs
  document.querySelectorAll('.accounting-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab('accounting', btn.dataset.tab));
  });

  // Admin tabs
  document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab('admin', btn.dataset.tab));
  });

  // Admin actions
  document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());
  document.getElementById('backup-btn').addEventListener('click', createBackup);
  document.getElementById('restore-btn').addEventListener('click', restoreBackup);

  // Patient form
  document.getElementById('patient-form').addEventListener('submit', handlePatientSubmit);

  // Patient form tabs
  document.querySelectorAll('.form-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchFormTab(btn.dataset.tab));
  });

  // Patient search and filters
  document.getElementById('patient-search').addEventListener('input', debounce(searchPatients, 300));
  document.getElementById('patient-gender-filter').addEventListener('change', loadPatients);
  document.getElementById('patient-smoking-filter').addEventListener('change', loadPatients);
  document.getElementById('patient-insurance-filter').addEventListener('input', debounce(loadPatients, 300));

  // Modal close
  document.querySelectorAll('.modal-close').forEach(close => {
    close.addEventListener('click', () => {
      close.closest('.modal').classList.remove('active');
    });
  });

  // Make closeModal globally available
  window.closeModal = closeModal;
}

// Authentication functions
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  console.log('Renderer: Attempting login for:', username);

  try {
    console.log('Renderer: Calling electronAPI.login...');
    const result = await window.electronAPI.login(username, password);
    console.log('Renderer: Login result received:', result);

    if (result) {
      currentUser = result;
      showMainApp();
      loadDashboard();
    } else {
      showError('Invalid username or password');
    }
  } catch (error) {
    console.error('Renderer: Login failed:', error);
    showError('Login failed: ' + error.message);
  }
}

function handleLogout() {
  currentUser = null;
  showLoginScreen();
}

function checkAuthStatus() {
  // Check if user is already logged in (from main process)
  // For now, show login screen
  showLoginScreen();
}

function showLoginScreen() {
  loginScreen.classList.add('active');
  mainScreen.classList.remove('active');
}

function showMainApp() {
  loginScreen.classList.remove('active');
  mainScreen.classList.add('active');
  currentUserSpan.textContent = `${currentUser.name} (${currentUser.role})`;
}

// Screen switching
function switchScreen(screenName) {
  // Check permissions
  if (!checkScreenPermission(screenName)) {
    showError('You do not have permission to access this section');
    return;
  }

  // Update navigation
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenName);
  });

  // Hide all screens
  document.querySelectorAll('.content-screen').forEach(screen => {
    screen.classList.remove('active');
  });

  // Show selected screen
  document.getElementById(`${screenName}-screen`).classList.add('active');
  currentScreen = screenName;

  // Load screen data
  switch (screenName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'patients':
      loadPatients();
      break;
    case 'appointments':
      loadAppointments();
      break;
    case 'accounting':
      loadInvoices();
      break;
    case 'admin':
      loadUsers();
      break;
  }
}

function switchTab(section, tabName) {
  // Update tab buttons
  document.querySelectorAll(`.${section}-tabs .tab-btn`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Hide all tab contents
  document.querySelectorAll(`#${section}-screen .tab-content`).forEach(content => {
    content.classList.remove('active');
  });

  // Show selected tab content
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Load tab data
  switch (tabName) {
    case 'invoices':
      loadInvoices();
      break;
    case 'expenses':
      loadExpenses();
      break;
    case 'reports':
      loadFinancialReports();
      break;
    case 'users':
      loadUsers();
      break;
    case 'audit':
      loadAuditLog();
      break;
  }
}

function switchFormTab(tabName) {
  // Update form tab buttons
  document.querySelectorAll('.form-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Hide all form tab contents
  document.querySelectorAll('.form-tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Show selected form tab content
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Permission checking
function checkScreenPermission(screenName) {
  const permissions = {
    dashboard: ['admin', 'doctor', 'receptionist', 'accountant'],
    patients: ['admin', 'doctor', 'receptionist'],
    appointments: ['admin', 'doctor', 'receptionist'],
    accounting: ['admin', 'accountant'],
    admin: ['admin']
  };

  return permissions[screenName]?.includes(currentUser.role) || false;
}

// Dashboard functions
async function loadDashboard() {
  try {
    const [patientStats, appointmentStats, financialStats] = await Promise.all([
      window.electronAPI.getPatientStats(),
      window.electronAPI.getAppointmentStats(),
      window.electronAPI.getFinancialStats()
    ]);

    document.getElementById('total-patients').textContent = patientStats.total;
    document.getElementById('today-appointments').textContent = appointmentStats.today;
    document.getElementById('pending-invoices').textContent = financialStats.pendingRevenue;
    document.getElementById('monthly-revenue').textContent = `$${financialStats.monthlyRevenue.toFixed(2)}`;

    // Load revenue chart
    loadRevenueChart();

    // Load advanced analytics if on dashboard
    loadAdvancedAnalytics();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

function loadRevenueChart() {
  const ctx = document.getElementById('revenue-chart');
  if (!ctx) return;

  // Add chart controls
  const chartContainer = ctx.parentElement;
  if (!chartContainer.querySelector('.chart-controls')) {
    const controls = document.createElement('div');
    controls.className = 'chart-controls';
    controls.innerHTML = `
      <div class="chart-control-group">
        <label for="chart-type">Chart Type:</label>
        <select id="chart-type">
          <option value="line">Line Chart</option>
          <option value="bar">Bar Chart</option>
          <option value="area">Area Chart</option>
        </select>
      </div>
      <div class="chart-control-group">
        <label for="time-range">Time Range:</label>
        <select id="time-range">
          <option value="6">Last 6 Months</option>
          <option value="12">Last 12 Months</option>
          <option value="24">Last 2 Years</option>
        </select>
      </div>
      <button id="export-chart" class="btn btn-secondary">
        <i class="fas fa-file-export"></i> Export
      </button>
    `;
    chartContainer.insertBefore(controls, ctx);
  }

  // Initialize chart with sample data
  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Monthly Revenue',
      data: [1200, 1900, 3000, 5000, 2000, 3000],
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      fill: false,
      tension: 0.1
    }]
  };

  const chart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Revenue Overview'
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1a202c',
          bodyColor: '#4a5568',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return `$${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          }
        }
      }
    }
  });

  // Chart controls event listeners
  document.getElementById('chart-type').addEventListener('change', (e) => {
    const newType = e.target.value;
    chart.config.type = newType;

    // Update fill based on type
    if (newType === 'area') {
      chart.data.datasets[0].fill = true;
      chart.data.datasets[0].backgroundColor = 'rgba(76, 175, 80, 0.2)';
    } else {
      chart.data.datasets[0].fill = false;
    }

    chart.update();
  });

  document.getElementById('time-range').addEventListener('change', (e) => {
    const months = parseInt(e.target.value);
    updateChartData(chart, months);
  });

  document.getElementById('export-chart').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `revenue-chart-${new Date().toISOString().split('T')[0]}.png`;
    link.href = chart.toBase64Image();
    link.click();
  });

  // Store chart instance for later use
  ctx.chartInstance = chart;
}

function updateChartData(chart, months) {
  // Generate sample data for different time ranges
  const now = new Date();
  const labels = [];
  const data = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

    // Generate realistic sample data
    const baseRevenue = 2000;
    const variation = (Math.random() - 0.5) * 1000;
    data.push(Math.max(500, baseRevenue + variation));
  }

  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.update();
}

// Advanced Analytics Dashboard
function loadAdvancedAnalytics() {
  // Patient demographics chart
  loadPatientDemographicsChart();

  // Appointment trends
  loadAppointmentTrendsChart();

  // Financial analytics
  loadFinancialAnalyticsChart();
}

function loadPatientDemographicsChart() {
  const ctx = document.createElement('canvas');
  ctx.id = 'demographics-chart';
  ctx.style.height = '300px';

  const container = document.createElement('div');
  container.className = 'chart-container';
  container.innerHTML = `
    <div class="chart-header">
      <h3><i class="fas fa-users"></i> Patient Demographics</h3>
    </div>
  `;
  container.appendChild(ctx);

  // Add to dashboard after the main chart container
  const mainChartContainer = document.querySelector('.chart-container');
  if (mainChartContainer && mainChartContainer.parentNode) {
    mainChartContainer.parentNode.insertBefore(container, mainChartContainer.nextSibling);
  }

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['18-30', '31-50', '51-70', '71+'],
      datasets: [{
        data: [25, 35, 30, 10],
        backgroundColor: [
          '#4CAF50',
          '#2196F3',
          '#FF9800',
          '#E91E63'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed}%`;
            }
          }
        }
      }
    }
  });
}

function loadAppointmentTrendsChart() {
  const ctx = document.createElement('canvas');
  ctx.id = 'appointment-trends-chart';
  ctx.style.height = '300px';

  const container = document.createElement('div');
  container.className = 'chart-container';
  container.innerHTML = `
    <div class="chart-header">
      <h3><i class="fas fa-calendar-alt"></i> Appointment Trends</h3>
    </div>
  `;
  container.appendChild(ctx);

  // Add to dashboard after the main chart container
  const mainChartContainer = document.querySelector('.chart-container');
  if (mainChartContainer && mainChartContainer.parentNode) {
    mainChartContainer.parentNode.insertBefore(container, mainChartContainer.nextSibling);
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Appointments',
        data: [12, 19, 15, 25, 22, 8, 5],
        backgroundColor: 'rgba(33, 150, 243, 0.6)',
        borderColor: '#2196F3',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function loadFinancialAnalyticsChart() {
  const ctx = document.createElement('canvas');
  ctx.id = 'financial-analytics-chart';
  ctx.style.height = '300px';

  const container = document.createElement('div');
  container.className = 'chart-container';
  container.innerHTML = `
    <div class="chart-header">
      <h3><i class="fas fa-chart-line"></i> Financial Analytics</h3>
    </div>
  `;
  container.appendChild(ctx);

  // Add to dashboard after the main chart container
  const mainChartContainer = document.querySelector('.chart-container');
  if (mainChartContainer && mainChartContainer.parentNode) {
    mainChartContainer.parentNode.insertBefore(container, mainChartContainer.nextSibling);
  }

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Revenue',
          data: [1200, 1900, 3000, 5000, 2000, 3000],
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        },
        {
          label: 'Expenses',
          data: [800, 1200, 1500, 1800, 1400, 1600],
          borderColor: '#F44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      }
    }
  });
}


// Alternative function name to avoid conflicts
async function loadPatientsData(searchTerm = '', filters = {}) {
  return loadPatients(searchTerm, filters);
}

function renderPatientsTable(patients) {
  const tbody = document.getElementById('patients-tbody');
  tbody.innerHTML = '';

  patients.forEach(patient => {
    const row = document.createElement('tr');
    row.setAttribute('role', 'row');
    row.innerHTML = `
      <td role="gridcell">
        <input type="checkbox" class="patient-checkbox" data-patient-id="${patient.id}"
               onchange="updatePatientSelection(${patient.id}, this.checked)"
               aria-label="Select patient ${patient.first_name} ${patient.last_name}">
      </td>
      <td role="gridcell">${patient.patient_id}</td>
      <td role="gridcell">${patient.first_name} ${patient.last_name}</td>
      <td role="gridcell">${patient.phone || ''}</td>
      <td role="gridcell">${patient.email || ''}</td>
      <td role="gridcell">${patient.insurance_provider || 'Not specified'}</td>
      <td role="gridcell">${patient.smoking_status || 'Not specified'}</td>
      <td role="gridcell">
        <button class="action-btn view" onclick="viewPatient(${patient.id})"
                aria-label="View details for ${patient.first_name} ${patient.last_name}">View</button>
        <button class="action-btn edit" onclick="editPatient(${patient.id})"
                aria-label="Edit patient ${patient.first_name} ${patient.last_name}">Edit</button>
        ${currentUser.role === 'admin' ? `<button class="action-btn delete" onclick="deletePatient(${patient.id})"
                aria-label="Delete patient ${patient.first_name} ${patient.last_name}">Delete</button>` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });

  // Update select all checkbox state
  updateSelectAllCheckbox();

  // Announce table update to screen readers
  const liveRegion = document.getElementById('table-update-region') ||
    (() => {
      const region = document.createElement('div');
      region.id = 'table-update-region';
      region.setAttribute('aria-live', 'polite');
      region.className = 'sr-only';
      document.body.appendChild(region);
      return region;
    })();

  liveRegion.textContent = `Table updated. ${patients.length} patients displayed.`;
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-patients');
  if (!selectAllCheckbox) return;

  const checkboxes = document.querySelectorAll('.patient-checkbox');
  const checkedBoxes = document.querySelectorAll('.patient-checkbox:checked');

  selectAllCheckbox.checked = checkboxes.length > 0 && checkedBoxes.length === checkboxes.length;
  selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
}

function searchPatients() {
  const searchTerm = document.getElementById('patient-search').value;
  loadPatients(searchTerm);
}

function openPatientModal(patientId = null) {
  const modal = document.getElementById('patient-modal');
  const form = document.getElementById('patient-form');
  const title = document.getElementById('patient-modal-title');

  if (patientId) {
    title.textContent = 'Edit Patient';
    // Load patient data
    loadPatientForEdit(patientId);
  } else {
    title.textContent = 'Add Patient';
    form.reset();
    delete form.dataset.patientId; // Remove edit mode
    // Switch to basic tab for new patients
    switchFormTab('basic');
  }

  modal.classList.add('active');
}

async function loadPatientForEdit(patientId) {
  try {
    const patient = await window.electronAPI.getPatientById(patientId);
    // Populate form
    const form = document.getElementById('patient-form');
    form.dataset.patientId = patientId;

    // Map database fields to form field names
    const fieldMapping = {
      // Basic Information
      first_name: 'first-name',
      last_name: 'last-name',
      date_of_birth: 'dob',
      gender: 'gender',
      phone: 'phone',
      email: 'email',
      address: 'address',
      emergency_contact_name: 'emergency-contact-name',
      emergency_contact_phone: 'emergency-contact-phone',

      // Insurance Information
      insurance_provider: 'insurance-provider',
      insurance_policy_number: 'insurance-policy-number',
      insurance_group_id: 'insurance-group-id',
      insurance_subscriber_id: 'insurance-subscriber-id',
      primary_care_physician: 'primary-care-physician',
      preferred_pharmacy: 'preferred-pharmacy',
      billing_address: 'billing-address',

      // Demographics
      marital_status: 'marital-status',
      occupation: 'occupation',
      employer: 'employer',
      education_level: 'education-level',
      language_preferences: 'language-preferences',
      interpreter_needed: 'interpreter-needed',
      race_ethnicity: 'race-ethnicity',
      religion: 'religion',

      // Lifestyle
      smoking_status: 'smoking-status',
      alcohol_consumption: 'alcohol-consumption',
      exercise_habits: 'exercise-habits',
      diet_nutrition: 'diet-nutrition',
      sleep_patterns: 'sleep-patterns',
      stress_levels: 'stress-levels',

      // Medical Information
      medical_history: 'medical-history',
      allergies: 'allergies',
      current_medications: 'current-medications',
      family_medical_history: 'family-medical-history',
      chronic_conditions: 'chronic-conditions',
      immunization_history: 'immunization-history',

      // Advanced
      preferred_contact_method: 'preferred-contact-method',
      advance_directives: 'advance-directives',
      notes: 'notes'
    };

    Object.keys(fieldMapping).forEach(dbField => {
      const formField = fieldMapping[dbField];
      const input = document.getElementById(`patient-${formField}`);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = patient[dbField] === 1 || patient[dbField] === true;
        } else {
          input.value = patient[dbField] || '';
        }
      }
    });
  } catch (error) {
    console.error('Error loading patient:', error);
  }
}

async function handlePatientSubmit(e) {
  e.preventDefault();

  // Add loading state to form
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const formData = new FormData(e.target);
    const patientData = {
      // Basic Information (always required)
      firstName: formData.get('first-name'),
      lastName: formData.get('last-name'),
      dateOfBirth: formData.get('dob'),
      gender: formData.get('gender'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      address: formData.get('address'),
      emergencyContactName: formData.get('emergency-contact-name'),
      emergencyContactPhone: formData.get('emergency-contact-phone'),

      // Insurance Information (optional - can be added later)
      insuranceProvider: formData.get('insurance-provider') || null,
      insurancePolicyNumber: formData.get('insurance-policy-number') || null,
      insuranceGroupId: formData.get('insurance-group-id') || null,
      insuranceSubscriberId: formData.get('insurance-subscriber-id') || null,
      primaryCarePhysician: formData.get('primary-care-physician') || null,
      preferredPharmacy: formData.get('preferred-pharmacy') || null,
      billingAddress: formData.get('billing-address') || null,

      // Demographics (optional - can be collected progressively)
      maritalStatus: formData.get('marital-status') || null,
      occupation: formData.get('occupation') || null,
      employer: formData.get('employer') || null,
      educationLevel: formData.get('education-level') || null,
      languagePreferences: formData.get('language-preferences') || null,
      interpreterNeeded: formData.get('interpreter-needed') === 'on',
      raceEthnicity: formData.get('race-ethnicity') || null,
      religion: formData.get('religion') || null,

      // Lifestyle (optional - collected during visits)
      smokingStatus: formData.get('smoking-status') || null,
      alcoholConsumption: formData.get('alcohol-consumption') || null,
      exerciseHabits: formData.get('exercise-habits') || null,
      dietNutrition: formData.get('diet-nutrition') || null,
      sleepPatterns: formData.get('sleep-patterns') || null,
      stressLevels: formData.get('stress-levels') || null,

      // Medical Information (core medical data - can be expanded)
      medicalHistory: formData.get('medical-history') || null,
      allergies: formData.get('allergies') || null,
      currentMedications: formData.get('current-medications') || null,
      familyMedicalHistory: formData.get('family-medical-history') || null,
      chronicConditions: formData.get('chronic-conditions') || null,
      immunizationHistory: formData.get('immunization-history') || null,

      // Advanced (optional - collected as needed)
      preferredContactMethod: formData.get('preferred-contact-method') || null,
      advanceDirectives: formData.get('advance-directives') || null,
      notes: formData.get('notes') || null
    };

    // Validate only essential required fields for initial patient creation
    if (!patientData.firstName || patientData.firstName.trim() === '') {
      showError('First name is required');
      return;
    }
    if (!patientData.lastName || patientData.lastName.trim() === '') {
      showError('Last name is required');
      return;
    }

    // For new patients, only require basic contact info
    const isEdit = e.target.dataset.patientId;
    if (!isEdit) {
      if (!patientData.phone || patientData.phone.trim() === '') {
        showError('Phone number is required for new patients');
        return;
      }
    }

    if (isEdit) {
      await window.electronAPI.updatePatient(isEdit, patientData);
      showSuccess('Patient updated successfully');
    } else {
      await window.electronAPI.savePatient(patientData);
      showSuccess('Patient created successfully');
    }
    closeModal('patient-modal');
    loadPatients();
  } catch (error) {
    console.error('Patient save error:', error);
    showError('Error saving patient: ' + (error.message || 'Unknown error occurred'));
  } finally {
    // Remove loading state
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function viewPatientDetails(patientId) {
  try {
    const patient = await window.electronAPI.getPatientById(patientId);
    showPatientDetailsModal(patient);
  } catch (error) {
    showError('Error loading patient details: ' + error.message);
  }
}

function showPatientDetailsModal(patient) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'patient-details-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Patient Details - ${patient.patient_id}</h3>
        <span class="modal-close">&times;</span>
      </div>
      <div class="patient-details-content">
        <div class="patient-details-tabs">
          <button class="detail-tab-btn active" data-tab="overview">Overview</button>
          <button class="detail-tab-btn" data-tab="insurance">Insurance</button>
          <button class="detail-tab-btn" data-tab="medical">Medical</button>
          <button class="detail-tab-btn" data-tab="lifestyle">Lifestyle</button>
          <button class="detail-tab-btn" data-tab="advanced">Advanced</button>
        </div>

        <div id="overview-tab" class="detail-tab-content active">
          <div class="details-grid">
            <div class="detail-section">
              <h4>Personal Information</h4>
              <div class="detail-row">
                <strong>Name:</strong> ${patient.first_name} ${patient.last_name}
              </div>
              <div class="detail-row">
                <strong>Date of Birth:</strong> ${patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Gender:</strong> ${patient.gender || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Phone:</strong> ${patient.phone || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Email:</strong> ${patient.email || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Address:</strong> ${patient.address || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Marital Status:</strong> ${patient.marital_status || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Occupation:</strong> ${patient.occupation || 'Not specified'}
              </div>
            </div>
            <div class="detail-section">
              <h4>Emergency Contact</h4>
              <div class="detail-row">
                <strong>Name:</strong> ${patient.emergency_contact_name || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Phone:</strong> ${patient.emergency_contact_phone || 'Not specified'}
              </div>
            </div>
            <div class="detail-section">
              <h4>Basic Medical</h4>
              <div class="detail-row">
                <strong>Medical History:</strong> ${patient.medical_history || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Allergies:</strong> ${patient.allergies || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Current Medications:</strong> ${patient.current_medications || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Smoking Status:</strong> ${patient.smoking_status || 'Not specified'}
              </div>
            </div>
          </div>
        </div>

        <div id="insurance-tab" class="detail-tab-content">
          <div class="details-grid">
            <div class="detail-section">
              <h4>Insurance Information</h4>
              <div class="detail-row">
                <strong>Provider:</strong> ${patient.insurance_provider || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Policy Number:</strong> ${patient.insurance_policy_number || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Group ID:</strong> ${patient.insurance_group_id || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Subscriber ID:</strong> ${patient.insurance_subscriber_id || 'Not specified'}
              </div>
            </div>
            <div class="detail-section">
              <h4>Care Providers</h4>
              <div class="detail-row">
                <strong>Primary Care Physician:</strong> ${patient.primary_care_physician || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Preferred Pharmacy:</strong> ${patient.preferred_pharmacy || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Billing Address:</strong> ${patient.billing_address || 'Not specified'}
              </div>
            </div>
          </div>
        </div>

        <div id="medical-tab" class="detail-tab-content">
          <div class="details-grid">
            <div class="detail-section">
              <h4>Medical History</h4>
              <div class="detail-row">
                <strong>Medical History:</strong> ${patient.medical_history || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Family Medical History:</strong> ${patient.family_medical_history || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Chronic Conditions:</strong> ${patient.chronic_conditions || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Allergies:</strong> ${patient.allergies || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Medication Allergies:</strong> ${patient.medication_allergies || 'Not specified'}
              </div>
            </div>
            <div class="detail-section">
              <h4>Treatment & Records</h4>
              <div class="detail-row">
                <strong>Current Medications:</strong> ${patient.current_medications || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Hospitalization Records:</strong> ${patient.hospitalization_records || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Laboratory Results:</strong> ${patient.laboratory_results || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Imaging Studies:</strong> ${patient.imaging_studies || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Immunization History:</strong> ${patient.immunization_history || 'Not specified'}
              </div>
            </div>
          </div>
        </div>

        <div id="lifestyle-tab" class="detail-tab-content">
          <div class="details-grid">
            <div class="detail-section">
              <h4>Lifestyle Factors</h4>
              <div class="detail-row">
                <strong>Smoking Status:</strong> ${patient.smoking_status || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Alcohol Consumption:</strong> ${patient.alcohol_consumption || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Exercise Habits:</strong> ${patient.exercise_habits || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Diet & Nutrition:</strong> ${patient.diet_nutrition || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Sleep Patterns:</strong> ${patient.sleep_patterns || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Stress Levels:</strong> ${patient.stress_levels || 'Not specified'}
              </div>
            </div>
            <div class="detail-section">
              <h4>Demographics</h4>
              <div class="detail-row">
                <strong>Education Level:</strong> ${patient.education_level || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Language Preferences:</strong> ${patient.language_preferences || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Interpreter Needed:</strong> ${patient.interpreter_needed ? 'Yes' : 'No'}
              </div>
              <div class="detail-row">
                <strong>Race/Ethnicity:</strong> ${patient.race_ethnicity || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Religion:</strong> ${patient.religion || 'Not specified'}
              </div>
            </div>
          </div>
        </div>

        <div id="advanced-tab" class="detail-tab-content">
          <div class="details-grid">
            <div class="detail-section">
              <h4>Communication Preferences</h4>
              <div class="detail-row">
                <strong>Preferred Contact Method:</strong> ${patient.preferred_contact_method || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Emergency Notifications:</strong> ${patient.emergency_notification_preferences || 'Not specified'}
              </div>
            </div>
            <div class="detail-section">
              <h4>Legal & Compliance</h4>
              <div class="detail-row">
                <strong>HIPAA Authorization:</strong> ${patient.hipaa_authorization ? 'Granted' : 'Not granted'}
              </div>
              <div class="detail-row">
                <strong>Advance Directives:</strong> ${patient.advance_directives || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>DNR Orders:</strong> ${patient.dnr_orders || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Organ Donation:</strong> ${patient.organ_donation || 'Not specified'}
              </div>
            </div>
            <div class="detail-section">
              <h4>Additional Information</h4>
              <div class="detail-row">
                <strong>Notes:</strong> ${patient.notes || 'Not specified'}
              </div>
              <div class="detail-row">
                <strong>Created:</strong> ${new Date(patient.created_at).toLocaleString()}
              </div>
              <div class="detail-row">
                <strong>Last Updated:</strong> ${patient.updated_at ? new Date(patient.updated_at).toLocaleString() : 'Never'}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal('patient-details-modal')">Close</button>
        <button type="button" class="btn btn-primary" onclick="editPatient(${patient.id})">Edit Patient</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Add tab switching functionality
  modal.querySelectorAll('.detail-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update tab buttons
      modal.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update tab content
      modal.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'));
      modal.querySelector(`#${btn.dataset.tab}-tab`).classList.add('active');
    });
  });

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Also handle close button in form actions
  const closeBtn = modal.querySelector('.form-actions .btn-secondary');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });
  }
}

async function deletePatientRecord(patientId) {
  if (!confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
    return;
  }

  try {
    await window.electronAPI.deletePatient(patientId);
    loadPatients();
    showSuccess('Patient deleted successfully');
  } catch (error) {
    showError('Error deleting patient: ' + error.message);
  }
}

// Appointment functions
async function loadAppointments() {
  try {
    const status = document.getElementById('appointment-status-filter').value;
    const filters = status ? { status } : {};
    const appointments = await window.electronAPI.getAppointments(filters);
    renderAppointmentsTable(appointments);
  } catch (error) {
    console.error('Error loading appointments:', error);
  }
}

function renderAppointmentsTable(appointments) {
  const tbody = document.getElementById('appointments-tbody');
  tbody.innerHTML = '';

  appointments.forEach(appointment => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(appointment.appointment_date).toLocaleString()}</td>
      <td>${appointment.first_name} ${appointment.last_name}</td>
      <td>${appointment.doctor_name}</td>
      <td>${appointment.appointment_type || ''}</td>
      <td><span class="status-${appointment.status}">${appointment.status}</span></td>
      <td>
        <button class="action-btn edit" onclick="editAppointment(${appointment.id})">Edit</button>
        ${currentUser.role === 'admin' ? `<button class="action-btn delete" onclick="deleteAppointment(${appointment.id})">Delete</button>` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });
}

function openAppointmentModal() {
  // Implementation for appointment modal
  showError('Appointment modal not implemented yet');
}

// Workflow Automation Functions
function initializeWorkflowAutomation() {
  document.getElementById('workflow-automation-btn').addEventListener('click', () => {
    const panel = document.getElementById('workflow-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
  });
}

function createWorkflowRule(ruleConfig) {
  // Store workflow rules in localStorage for persistence
  const workflows = JSON.parse(localStorage.getItem('workflows') || '[]');
  workflows.push({
    id: Date.now(),
    ...ruleConfig,
    created: new Date().toISOString(),
    active: true
  });
  localStorage.setItem('workflows', JSON.stringify(workflows));
  return workflows[workflows.length - 1];
}

function executeWorkflowRules(context) {
  const workflows = JSON.parse(localStorage.getItem('workflows') || '[]');
  const activeWorkflows = workflows.filter(w => w.active);

  activeWorkflows.forEach(workflow => {
    if (checkWorkflowConditions(workflow, context)) {
      executeWorkflowActions(workflow, context);
    }
  });
}

function checkWorkflowConditions(workflow, context) {
  // Simple condition checking - can be expanded
  switch (workflow.trigger) {
    case 'appointment_completed':
      return context.type === 'appointment' && context.status === 'completed';
    case 'patient_created':
      return context.type === 'patient' && context.action === 'created';
    case 'invoice_overdue':
      return context.type === 'invoice' && context.status === 'overdue';
    default:
      return false;
  }
}

function executeWorkflowActions(workflow, context) {
  workflow.actions.forEach(action => {
    switch (action.type) {
      case 'schedule_followup':
        scheduleAutomatedAppointment(context.patientId, action.days);
        break;
      case 'send_notification':
        sendAutomatedNotification(context.patientId, action.message);
        break;
      case 'update_status':
        updateRecordStatus(context.recordId, action.newStatus);
        break;
    }
  });
}

async function scheduleAutomatedAppointment(patientId, daysFromNow) {
  try {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + daysFromNow);

    const appointmentData = {
      patientId: patientId,
      appointmentDate: followUpDate.toISOString(),
      appointmentType: 'follow-up',
      status: 'scheduled',
      notes: 'Automated follow-up appointment'
    };

    await window.electronAPI.createAppointment(appointmentData);
    showSuccess(`Follow-up appointment scheduled for ${followUpDate.toLocaleDateString()}`);
  } catch (error) {
    console.error('Failed to schedule automated appointment:', error);
  }
}

function sendAutomatedNotification(patientId, message) {
  // In a real implementation, this would integrate with SMS/email services
  console.log(`Sending notification to patient ${patientId}: ${message}`);
  showSuccess('Automated notification sent');
}

async function updateRecordStatus(recordId, newStatus) {
  try {
    // This would need to be implemented based on the record type
    console.log(`Updating record ${recordId} status to ${newStatus}`);
  } catch (error) {
    console.error('Failed to update record status:', error);
  }
}

// Initialize workflow automation
document.addEventListener('DOMContentLoaded', () => {
  initializeWorkflowAutomation();
});

// Accounting functions
async function loadInvoices() {
  try {
    const invoices = await window.electronAPI.getInvoices();
    renderInvoicesTable(invoices);
  } catch (error) {
    console.error('Error loading invoices:', error);
  }
}

function renderInvoicesTable(invoices) {
  const tbody = document.getElementById('invoices-tbody');
  tbody.innerHTML = '';

  invoices.forEach(invoice => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${invoice.invoice_number}</td>
      <td>${invoice.first_name} ${invoice.last_name}</td>
      <td>$${invoice.total_amount.toFixed(2)}</td>
      <td><span class="status-${invoice.status}">${invoice.status}</span></td>
      <td>${new Date(invoice.due_date).toLocaleDateString()}</td>
      <td>
        <button class="action-btn view" onclick="viewInvoice(${invoice.id})">View</button>
        <button class="action-btn edit" onclick="editInvoice(${invoice.id})">Edit</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadExpenses() {
  try {
    const expenses = await window.electronAPI.getExpenses();
    renderExpensesTable(expenses);
  } catch (error) {
    console.error('Error loading expenses:', error);
  }
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expenses-tbody');
  tbody.innerHTML = '';

  expenses.forEach(expense => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${expense.description}</td>
      <td>${expense.category}</td>
      <td>$${expense.amount.toFixed(2)}</td>
      <td>${new Date(expense.expense_date).toLocaleDateString()}</td>
      <td>
        <button class="action-btn edit" onclick="editExpense(${expense.id})">Edit</button>
        <button class="action-btn delete" onclick="deleteExpense(${expense.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadFinancialReports() {
  try {
    const stats = await window.electronAPI.getFinancialStats();
    document.getElementById('total-revenue').textContent = `$${stats.totalRevenue.toFixed(2)}`;
    document.getElementById('total-expenses').textContent = `$${stats.totalExpenses.toFixed(2)}`;
    document.getElementById('net-profit').textContent = `$${stats.netProfit.toFixed(2)}`;
  } catch (error) {
    console.error('Error loading financial reports:', error);
  }
}

function openInvoiceModal() {
  showError('Invoice modal not implemented yet');
}

function openExpenseModal() {
  showError('Expense modal not implemented yet');
}

// Admin functions
async function loadUsers() {
  try {
    const users = await window.electronAPI.getUsers();
    renderUsersTable(users);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '';

  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.username}</td>
      <td>${user.name}</td>
      <td>${user.role}</td>
      <td>${user.email || ''}</td>
      <td>
        <button class="action-btn edit" onclick="editUser(${user.id})">Edit</button>
        ${currentUser.role === 'admin' ? `<button class="action-btn delete" onclick="deleteUser(${user.id})">Delete</button>` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadAuditLog() {
  try {
    const logs = await window.electronAPI.getAuditLog();
    renderAuditTable(logs);
  } catch (error) {
    console.error('Error loading audit log:', error);
  }
}

function renderAuditTable(logs) {
  const tbody = document.getElementById('audit-tbody');
  tbody.innerHTML = '';

  logs.forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(log.timestamp).toLocaleString()}</td>
      <td>${log.user_id || 'System'}</td>
      <td>${log.action}</td>
      <td>${log.table_name}</td>
      <td>${log.record_id}</td>
    `;
    tbody.appendChild(row);
  });
}

function openUserModal() {
  showError('User modal not implemented yet');
}

function createBackup() {
  showError('Backup functionality not implemented yet');
}

function restoreBackup() {
  showError('Restore functionality not implemented yet');
}

// Utility functions
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function showError(message) {
  const errorDiv = document.getElementById('login-error') || document.createElement('div');
  errorDiv.className = 'message error';
  errorDiv.textContent = message;

  if (!document.getElementById('login-error')) {
    document.querySelector('.app-main').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'message success';
  successDiv.textContent = message;
  document.querySelector('.app-main').prepend(successDiv);
  setTimeout(() => successDiv.remove(), 3000);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Only handle shortcuts when not typing in input fields
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }

  // Ctrl/Cmd key combinations
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        if (currentScreen === 'patients') {
          openPatientModal();
        }
        break;
      case 'f':
        e.preventDefault();
        const searchInput = document.getElementById('patient-search');
        if (searchInput) {
          searchInput.focus();
        }
        break;
      case 's':
        e.preventDefault();
        // Quick save current form if open
        const activeForm = document.querySelector('form.active, #patient-form');
        if (activeForm) {
          const submitBtn = activeForm.querySelector('button[type="submit"]');
          if (submitBtn && !submitBtn.disabled) {
            submitBtn.click();
          }
        }
        break;
      case 'escape':
        e.preventDefault();
        // Close modals or go back
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
          closeModal(activeModal.id);
        }
        break;
    }
  }

  // Alt key combinations
  if (e.altKey) {
    switch (e.key.toLowerCase()) {
      case '1':
        e.preventDefault();
        switchScreen('dashboard');
        break;
      case '2':
        e.preventDefault();
        switchScreen('patients');
        break;
      case '3':
        e.preventDefault();
        switchScreen('appointments');
        break;
      case '4':
        e.preventDefault();
        switchScreen('accounting');
        break;
      case '5':
        e.preventDefault();
        switchScreen('admin');
        break;
    }
  }

  // Function keys
  switch (e.key) {
    case 'F1':
      e.preventDefault();
      showKeyboardShortcutsHelp();
      break;
    case 'F5':
      e.preventDefault();
      // Refresh current screen data
      switch (currentScreen) {
        case 'dashboard':
          loadDashboard();
          break;
        case 'patients':
          loadPatients();
          break;
        case 'appointments':
          loadAppointments();
          break;
      }
      break;
  }
});

// Guided Tours and Help System
let currentTourStep = 0;
let tourSteps = [];

function initializeGuidedTours() {
  // Add help button to header
  const headerRight = document.querySelector('.header-right');
  if (headerRight) {
    const helpBtn = document.createElement('button');
    helpBtn.className = 'btn btn-secondary';
    helpBtn.innerHTML = '<i class="fas fa-circle-question"></i> Help';
    helpBtn.onclick = showHelpMenu;
    headerRight.insertBefore(helpBtn, headerRight.firstChild);
  }

  // Contextual help tooltips
  initializeContextualHelp();
}

function showHelpMenu() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'help-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3><i class="fas fa-circle-question"></i> Help & Learning Center</h3>
        <span class="modal-close">&times;</span>
      </div>
      <div class="help-content" style="padding: 1.5rem;">
        <div class="help-section">
          <h4><i class="fas fa-route"></i> Guided Tours</h4>
          <p>Take an interactive tour to learn about app features:</p>
          <div class="tour-options">
            <button class="btn btn-primary" onclick="startTour('dashboard')">Dashboard Tour</button>
            <button class="btn btn-primary" onclick="startTour('patients')">Patient Management Tour</button>
            <button class="btn btn-primary" onclick="startTour('appointments')">Appointments Tour</button>
          </div>
        </div>

        <div class="help-section">
          <h4><i class="fas fa-keyboard"></i> Keyboard Shortcuts</h4>
          <p>Learn keyboard shortcuts for faster navigation:</p>
          <button class="btn btn-secondary" onclick="showKeyboardShortcutsHelp()">View Shortcuts</button>
        </div>

        <div class="help-section">
          <h4><i class="fas fa-book"></i> Documentation</h4>
          <p>Access user guides and documentation:</p>
          <button class="btn btn-secondary" onclick="showDocumentation()">Open Documentation</button>
        </div>

        <div class="help-section">
          <h4><i class="fas fa-video"></i> Video Tutorials</h4>
          <p>Watch video guides for complex workflows:</p>
          <button class="btn btn-secondary" onclick="showVideoTutorials()">Browse Tutorials</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
}

function startTour(tourType) {
  // Close help modal
  document.getElementById('help-modal')?.remove();

  // Define tour steps based on type
  switch (tourType) {
    case 'dashboard':
      tourSteps = [
        {
          element: '.dashboard-grid',
          title: 'Dashboard Overview',
          content: 'Welcome to your dashboard! Here you can see key metrics and statistics at a glance.',
          position: 'bottom'
        },
        {
          element: '.stat-card:first-child',
          title: 'Patient Statistics',
          content: 'This card shows your total patient count and recent additions.',
          position: 'right'
        },
        {
          element: '.chart-container',
          title: 'Revenue Analytics',
          content: 'Track your clinic\'s financial performance with interactive charts.',
          position: 'top'
        }
      ];
      break;
    case 'patients':
      tourSteps = [
        {
          element: '#add-patient-btn',
          title: 'Add New Patients',
          content: 'Click here to add new patients to your clinic database.',
          position: 'bottom'
        },
        {
          element: '.search-bar',
          title: 'Patient Search',
          content: 'Use this search bar to quickly find patients by name, ID, or contact information.',
          position: 'bottom'
        },
        {
          element: '#advanced-search-btn',
          title: 'Advanced Search',
          content: 'For complex searches, use the advanced search panel with multiple filters.',
          position: 'bottom'
        }
      ];
      break;
    case 'appointments':
      tourSteps = [
        {
          element: '#add-appointment-btn',
          title: 'Schedule Appointments',
          content: 'Schedule new appointments for your patients.',
          position: 'bottom'
        },
        {
          element: '#appointment-status-filter',
          title: 'Filter Appointments',
          content: 'Filter appointments by status to focus on what matters most.',
          position: 'bottom'
        }
      ];
      break;
  }

  currentTourStep = 0;
  showTourStep();
}

function showTourStep() {
  if (currentTourStep >= tourSteps.length) {
    endTour();
    return;
  }

  const step = tourSteps[currentTourStep];
  const element = document.querySelector(step.element);

  if (!element) {
    currentTourStep++;
    showTourStep();
    return;
  }

  // Create tour overlay
  const overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  overlay.innerHTML = `
    <div class="tour-tooltip ${step.position}">
      <div class="tour-header">
        <h4>${step.title}</h4>
        <span class="tour-close" onclick="endTour()">&times;</span>
      </div>
      <div class="tour-content">
        <p>${step.content}</p>
      </div>
      <div class="tour-actions">
        <button class="btn btn-secondary" onclick="endTour()">Skip Tour</button>
        <button class="btn btn-primary" onclick="nextTourStep()">
          ${currentTourStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Position tooltip
  const tooltip = overlay.querySelector('.tour-tooltip');
  const rect = element.getBoundingClientRect();

  tooltip.style.position = 'fixed';
  tooltip.style.zIndex = '10000';

  switch (step.position) {
    case 'top':
      tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
      tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
      break;
    case 'bottom':
      tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
      tooltip.style.top = rect.bottom + 10 + 'px';
      break;
    case 'left':
      tooltip.style.left = rect.left - tooltip.offsetWidth - 10 + 'px';
      tooltip.style.top = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2) + 'px';
      break;
    case 'right':
      tooltip.style.left = rect.right + 10 + 'px';
      tooltip.style.top = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2) + 'px';
      break;
  }

  // Highlight target element
  element.classList.add('tour-highlight');
}

function nextTourStep() {
  // Remove current overlay
  document.querySelector('.tour-overlay')?.remove();

  // Remove highlight from current element
  if (currentTourStep < tourSteps.length) {
    const currentElement = document.querySelector(tourSteps[currentTourStep].element);
    currentElement?.classList.remove('tour-highlight');
  }

  currentTourStep++;
  showTourStep();
}

function endTour() {
  // Remove overlay
  document.querySelector('.tour-overlay')?.remove();

  // Remove all highlights
  document.querySelectorAll('.tour-highlight').forEach(el => {
    el.classList.remove('tour-highlight');
  });

  tourSteps = [];
  currentTourStep = 0;
}

function initializeContextualHelp() {
  // Add help tooltips to complex UI elements
  const helpElements = [
    { selector: '#advanced-search-btn', content: 'Use advanced search to filter patients by multiple criteria' },
    { selector: '#bulk-actions-btn', content: 'Select multiple patients to perform bulk operations' },
    { selector: '.patient-checkbox', content: 'Check to select patients for bulk operations' },
    { selector: '#add-patient-btn', content: 'Add a new patient to the system' }
  ];

  helpElements.forEach(({ selector, content }) => {
    const element = document.querySelector(selector);
    if (element) {
      element.setAttribute('title', content);
      element.setAttribute('aria-label', content);
    }
  });
}

// Show keyboard shortcuts help
function showKeyboardShortcutsHelp() {
  const shortcuts = [
    { keys: 'Ctrl+N', description: 'New Patient (on Patients screen)' },
    { keys: 'Ctrl+F', description: 'Focus Search' },
    { keys: 'Ctrl+S', description: 'Save Current Form' },
    { keys: 'Ctrl+Esc', description: 'Close Modal' },
    { keys: 'Alt+1-5', description: 'Switch to Dashboard/Patients/Appointments/Accounting/Admin' },
    { keys: 'F1', description: 'Show This Help' },
    { keys: 'F5', description: 'Refresh Current Screen' }
  ];

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'shortcuts-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Keyboard Shortcuts</h3>
        <span class="modal-close">&times;</span>
      </div>
      <div class="shortcuts-content" style="padding: 1.5rem;">
        ${shortcuts.map(shortcut => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; padding: 0.5rem; border-radius: 6px; background: var(--bg-secondary);">
            <kbd style="background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); font-family: monospace; font-weight: 600;">${shortcut.keys}</kbd>
            <span style="flex: 1; margin-left: 1rem;">${shortcut.description}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });
}

function showDocumentation() {
  showSuccess('Documentation feature coming soon!');
}

function showVideoTutorials() {
  showSuccess('Video tutorials feature coming soon!');
}

// Advanced Search and Filtering
let currentFilters = {};
let selectedPatients = new Set();

function initializeAdvancedSearch() {
  // Advanced search toggle
  document.getElementById('advanced-search-btn').addEventListener('click', () => {
    const panel = document.getElementById('advanced-search-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
  });

  // Apply filters
  document.getElementById('apply-filters-btn').addEventListener('click', applyAdvancedFilters);

  // Clear filters
  document.getElementById('clear-filters-btn').addEventListener('click', clearAllFilters);

  // Save search
  document.getElementById('save-search-btn').addEventListener('click', saveSearchQuery);

  // Quick search with clear button
  const searchInput = document.getElementById('patient-search');
  const clearBtn = document.getElementById('clear-search-btn');

  searchInput.addEventListener('input', debounce(() => {
    const hasValue = searchInput.value.trim().length > 0;
    clearBtn.style.display = hasValue ? 'block' : 'none';
    loadPatients(searchInput.value);
  }, 300));

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    loadPatients('');
  });
}

function applyAdvancedFilters() {
  const filters = {
    gender: document.getElementById('patient-gender-filter').value,
    smokingStatus: document.getElementById('patient-smoking-filter').value,
    insuranceProvider: document.getElementById('patient-insurance-filter').value,
    ageMin: document.getElementById('age-min').value,
    ageMax: document.getElementById('age-max').value,
    chronicConditions: document.getElementById('chronic-conditions-filter').value,
    lastVisitDays: document.getElementById('last-visit-filter').value
  };

  currentFilters = filters;
  updateActiveFiltersDisplay();
  loadPatients('', filters);
}

function clearAllFilters() {
  // Reset all filter inputs
  document.querySelectorAll('#advanced-search-panel select, #advanced-search-panel input').forEach(input => {
    input.value = '';
  });

  currentFilters = {};
  updateActiveFiltersDisplay();
  loadPatients('');
}

function updateActiveFiltersDisplay() {
  const activeFiltersDiv = document.getElementById('active-filters');
  const filterTagsDiv = document.getElementById('filter-tags');

  const activeFilters = Object.entries(currentFilters).filter(([key, value]) => value && value !== '');

  if (activeFilters.length > 0) {
    activeFiltersDiv.style.display = 'flex';
    filterTagsDiv.innerHTML = activeFilters.map(([key, value]) => `
      <span class="filter-tag">
        ${formatFilterLabel(key)}: ${value}
        <span class="remove-filter" onclick="removeFilter('${key}')">×</span>
      </span>
    `).join('');
  } else {
    activeFiltersDiv.style.display = 'none';
  }
}

function formatFilterLabel(key) {
  const labels = {
    gender: 'Gender',
    smokingStatus: 'Smoking',
    insuranceProvider: 'Insurance',
    ageMin: 'Min Age',
    ageMax: 'Max Age',
    chronicConditions: 'Conditions',
    lastVisitDays: 'Last Visit'
  };
  return labels[key] || key;
}

function removeFilter(key) {
  currentFilters[key] = '';
  document.getElementById(`${key === 'gender' ? 'patient-gender-filter' :
                          key === 'smokingStatus' ? 'patient-smoking-filter' :
                          key === 'insuranceProvider' ? 'patient-insurance-filter' :
                          key === 'ageMin' ? 'age-min' :
                          key === 'ageMax' ? 'age-max' :
                          key === 'chronicConditions' ? 'chronic-conditions-filter' :
                          'last-visit-filter'}`).value = '';
  updateActiveFiltersDisplay();
  loadPatients('', currentFilters);
}

function saveSearchQuery() {
  const queryName = prompt('Enter a name for this search query:');
  if (queryName) {
    const savedSearches = JSON.parse(localStorage.getItem('savedSearches') || '[]');
    savedSearches.push({
      name: queryName,
      filters: currentFilters,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('savedSearches', JSON.stringify(savedSearches));
    showSuccess(`Search "${queryName}" saved successfully`);
  }
}

// Bulk Operations
function initializeBulkOperations() {
  const selectAllCheckbox = document.getElementById('select-all-patients');
  const bulkControls = document.getElementById('bulk-selection-controls');
  const bulkBtn = document.getElementById('bulk-actions-btn');

  selectAllCheckbox.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.patient-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      updatePatientSelection(cb.dataset.patientId, cb.checked);
    });
    updateBulkControlsVisibility();
  });

  // Bulk action buttons
  document.getElementById('bulk-export-btn').addEventListener('click', bulkExportPatients);
  document.getElementById('bulk-email-btn').addEventListener('click', bulkSendEmail);
  document.getElementById('bulk-print-btn').addEventListener('click', bulkPrintLabels);
  document.getElementById('bulk-delete-btn').addEventListener('click', bulkDeletePatients);
  document.getElementById('clear-all-filters-btn').addEventListener('click', clearAllFilters);
}

function updatePatientSelection(patientId, selected) {
  if (selected) {
    selectedPatients.add(patientId);
  } else {
    selectedPatients.delete(patientId);
  }
  updateBulkControlsVisibility();
}

function updateBulkControlsVisibility() {
  const bulkControls = document.getElementById('bulk-selection-controls');
  const bulkBtn = document.getElementById('bulk-actions-btn');
  const selectedCount = document.getElementById('selected-count');

  if (selectedPatients.size > 0) {
    bulkControls.style.display = 'flex';
    bulkBtn.style.display = 'inline-block';
    selectedCount.textContent = selectedPatients.size;
  } else {
    bulkControls.style.display = 'none';
    bulkBtn.style.display = 'none';
  }
}

async function bulkExportPatients() {
  try {
    const patientIds = Array.from(selectedPatients);
    const patients = await Promise.all(patientIds.map(id => window.electronAPI.getPatientById(id)));

    // Create CSV content
    const headers = ['Patient ID', 'First Name', 'Last Name', 'Phone', 'Email', 'Insurance', 'Smoking Status'];
    const csvContent = [
      headers.join(','),
      ...patients.map(patient => [
        patient.patient_id,
        patient.first_name,
        patient.last_name,
        patient.phone || '',
        patient.email || '',
        patient.insurance_provider || '',
        patient.smoking_status || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showSuccess(`Exported ${patients.length} patients to CSV`);
  } catch (error) {
    showError('Failed to export patients: ' + error.message);
  }
}

function bulkSendEmail() {
  const emails = Array.from(selectedPatients).length;
  showSuccess(`Email composition opened for ${emails} patients`);
  // In a real app, this would open an email client or send bulk emails
}

function bulkPrintLabels() {
  const count = selectedPatients.size;
  showSuccess(`Printing labels for ${count} patients`);
  // In a real app, this would generate and print address labels
}

async function bulkDeletePatients() {
  if (!confirm(`Are you sure you want to delete ${selectedPatients.size} patients? This action cannot be undone.`)) {
    return;
  }

  try {
    const deletePromises = Array.from(selectedPatients).map(id => window.electronAPI.deletePatient(id));
    await Promise.all(deletePromises);

    selectedPatients.clear();
    updateBulkControlsVisibility();
    loadPatients();
    showSuccess('Selected patients deleted successfully');
  } catch (error) {
    showError('Failed to delete patients: ' + error.message);
  }
}

// Mobile optimization and touch gestures
function initializeMobileOptimizations() {
  // Touch gesture support for swipe navigation
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  });

  document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipeGesture();
  });

  function handleSwipeGesture() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 50;

    // Only handle horizontal swipes that are longer than vertical movement
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right - go to previous screen
        navigateToPreviousScreen();
      } else {
        // Swipe left - go to next screen
        navigateToNextScreen();
      }
    }
  }

  function navigateToPreviousScreen() {
    const screens = ['dashboard', 'patients', 'appointments', 'accounting', 'admin'];
    const currentIndex = screens.indexOf(currentScreen);
    if (currentIndex > 0) {
      switchScreen(screens[currentIndex - 1]);
    }
  }

  function navigateToNextScreen() {
    const screens = ['dashboard', 'patients', 'appointments', 'accounting', 'admin'];
    const currentIndex = screens.indexOf(currentScreen);
    if (currentIndex < screens.length - 1) {
      switchScreen(screens[currentIndex + 1]);
    }
  }

  // Mobile table scrolling improvements
  const tables = document.querySelectorAll('.data-table table');
  tables.forEach(table => {
    table.addEventListener('touchstart', (e) => {
      // Prevent default scrolling when touching table headers
      if (e.target.closest('th')) {
        e.preventDefault();
      }
    }, { passive: false });
  });

  // Mobile-friendly modal improvements
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener('touchstart', (e) => {
      // Close modal when tapping outside content area
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Improve button touch targets on mobile
  if ('ontouchstart' in window) {
    const buttons = document.querySelectorAll('button, .action-btn');
    buttons.forEach(btn => {
      btn.style.minHeight = '44px';
      btn.style.minWidth = '44px';
    });
  }

  // Mobile keyboard optimizations
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      // Scroll input into view on mobile
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
  });
}

// Initialize features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeAdvancedSearch();
  initializeBulkOperations();
  initializeMobileOptimizations();
  initializeGuidedTours();
  initializePerformanceMonitoring();
  lazyLoadImages();
  initializeVirtualScrolling();
});

// Sidebar toggle functionality
function toggleSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const toggleIcon = toggleBtn.querySelector('i');

  sidebar.classList.toggle('collapsed');

  // Update toggle button icon
  if (sidebar.classList.contains('collapsed')) {
    toggleIcon.className = 'fas fa-chevron-right';
  } else {
    toggleIcon.className = 'fas fa-bars';
  }

  // Store sidebar state in localStorage
  const isCollapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem('sidebarCollapsed', isCollapsed);
}

// Initialize sidebar state on load
function initializeSidebarState() {
  const sidebar = document.querySelector('.app-sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

  if (isCollapsed) {
    sidebar.classList.add('collapsed');
    const toggleIcon = toggleBtn.querySelector('i');
    toggleIcon.className = 'fas fa-chevron-right';
  }
}

// Global functions for onclick handlers
window.viewPatient = (id) => viewPatientDetails(id);
window.editPatient = (id) => openPatientModal(id);
window.deletePatient = (id) => deletePatientRecord(id);
window.editAppointment = (id) => showError('Edit appointment not implemented yet');
window.deleteAppointment = (id) => showError('Delete appointment not implemented yet');
window.viewInvoice = (id) => showError('View invoice not implemented yet');
window.editInvoice = (id) => showError('Edit invoice not implemented yet');
window.editExpense = (id) => showError('Edit expense not implemented yet');
window.deleteExpense = (id) => showError('Delete expense not implemented yet');
window.editUser = (id) => showError('Edit user not implemented yet');
window.deleteUser = (id) => showError('Delete user not implemented yet');
window.removeFilter = (key) => removeFilter(key);
