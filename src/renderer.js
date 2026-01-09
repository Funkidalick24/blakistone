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

// Clear patient cache specifically to ensure fresh data
function clearPatientCache() {
  // Clear all patient-related cache entries
  for (const [key] of dataCache) {
    if (key.startsWith('patients_')) {
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
  document.getElementById('add-billing-code-btn').addEventListener('click', () => openBillingCodeModal());
  document.getElementById('record-payment-btn').addEventListener('click', () => openPaymentModal());
  document.getElementById('clear-invoices-btn').addEventListener('click', clearAllInvoices);

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
  document.getElementById('patient-gender-filter').addEventListener('change', () => {
    const filters = {
      gender: document.getElementById('patient-gender-filter').value,
      smokingStatus: document.getElementById('patient-smoking-filter').value,
      insuranceProvider: document.getElementById('patient-insurance-filter').value
    };
    loadPatients('', filters, true); // Force refresh for filters
  });
  document.getElementById('patient-smoking-filter').addEventListener('change', () => {
    const filters = {
      gender: document.getElementById('patient-gender-filter').value,
      smokingStatus: document.getElementById('patient-smoking-filter').value,
      insuranceProvider: document.getElementById('patient-insurance-filter').value
    };
    loadPatients('', filters, true); // Force refresh for filters
  });
  document.getElementById('patient-insurance-filter').addEventListener('input', debounce(() => {
    const filters = {
      gender: document.getElementById('patient-gender-filter').value,
      smokingStatus: document.getElementById('patient-smoking-filter').value,
      insuranceProvider: document.getElementById('patient-insurance-filter').value
    };
    loadPatients('', filters, true); // Force refresh for filters
  }, 300));

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
      loadPatients('', {}, true); // Force refresh when switching to patients screen
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
    case 'billing-codes':
      loadBillingCodes();
      break;
    case 'payments':
      loadPayments();
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

  // Initialize chart with empty data (will be populated from database)
  const chartData = {
    labels: [],
    datasets: [{
      label: 'Monthly Revenue',
      data: [],
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
      labels: [],
      datasets: [{
        data: [],
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
        title: {
          display: true,
          text: 'Patient Demographics'
        },
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

async function loadAppointmentTrendsChart() {
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

  // Get appointment stats
  const stats = await window.electronAPI.getAppointmentStats();
  if (!stats.monthlyData || stats.monthlyData.length === 0) {
    container.innerHTML = `
      <div class="chart-header">
        <h3><i class="fas fa-calendar-alt"></i> Appointment Trends</h3>
      </div>
      <div class="empty-state">
        <p>No appointment data available yet.</p>
        <button onclick="switchScreen('appointments')">Create First Appointment</button>
      </div>
    `;
    return;
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.monthlyData.map(d => d.month),
      datasets: [{
        label: 'Appointments',
        data: stats.monthlyData.map(d => d.count),
        backgroundColor: 'rgba(33, 150, 243, 0.6)',
        borderColor: '#2196F3',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Appointment Trends'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Appointments'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Month'
          }
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
      labels: [],
      datasets: [
        {
          label: 'Revenue',
          data: [],
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        },
        {
          label: 'Expenses',
          data: [],
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
        title: {
          display: true,
          text: 'Financial Analytics'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Amount ($)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Month'
          }
        }
      }
    }
  });
}


// Alternative function name to avoid conflicts
async function loadPatientsData(searchTerm = '', filters = {}, forceRefresh = false) {
  return loadPatients(searchTerm, filters, forceRefresh);
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
               onchange="window.updatePatientSelection(${patient.id}, this.checked)"
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
  loadPatients(searchTerm, {}, true); // Force refresh for search to ensure latest data
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
      const result = await window.electronAPI.updatePatient(parseInt(isEdit), patientData);
      if (result && result.success) {
        showSuccess('Patient updated successfully');
        // Clear patient cache to ensure fresh data is loaded
        clearPatientCache();
      } else {
        showError('Error updating patient: ' + (result?.error || 'Unknown error'));
        return;
      }
    } else {
      await window.electronAPI.savePatient(patientData);
      showSuccess('Patient created successfully');
      // Clear patient cache to ensure fresh data is loaded
      clearPatientCache();
    }
    closeModal('patient-modal');
    // Force reload patients list to show immediate changes
    loadPatients('', {}, true);
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

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function deletePatientRecord(patientId) {
  if (!confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
    return;
  }

  try {
    const result = await window.electronAPI.deletePatient(parseInt(patientId));
    if (result && result.success) {
      // Clear patient cache to ensure fresh data is loaded
      clearPatientCache();
      // Force reload patients list to show immediate changes
      loadPatients('', {}, true);
      showSuccess('Patient deleted successfully');
    } else {
      showError('Error deleting patient: ' + (result?.error || 'Unknown error'));
    }
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

async function renderAppointmentsTable(appointments) {
  const tbody = document.getElementById('appointments-tbody');
  tbody.innerHTML = '';

  // Get billing information for each appointment
  const appointmentsWithBilling = await Promise.all(
    appointments.map(async (appointment) => {
      try {
        const billings = await window.electronAPI.getAppointmentBillings(appointment.id);
        const totalBilled = billings.reduce((sum, billing) => sum + billing.total_price, 0);
        const hasInvoice = billings.some(billing => billing.invoice_id);
        return { ...appointment, billings, totalBilled, hasInvoice };
      } catch (error) {
        console.error('Error loading billing for appointment:', appointment.id, error);
        return { ...appointment, billings: [], totalBilled: 0, hasInvoice: false };
      }
    })
  );

  appointmentsWithBilling.forEach(appointment => {
    const row = document.createElement('tr');
    const billingInfo = appointment.totalBilled > 0 ?
      `<br><small class="billing-info">Billed: $${appointment.totalBilled.toFixed(2)} ${appointment.hasInvoice ? '(Invoiced)' : ''}</small>` : '';

    row.innerHTML = `
      <td>${new Date(appointment.appointment_date).toLocaleString()}${billingInfo}</td>
      <td>${appointment.first_name} ${appointment.last_name}</td>
      <td>${appointment.doctor_name}</td>
      <td>${appointment.appointment_type || ''}</td>
      <td><span class="status-${appointment.status}">${appointment.status}</span></td>
      <td>
        <button class="action-btn edit" onclick="editAppointment(${appointment.id})">Edit</button>
        ${appointment.status === 'completed' && appointment.totalBilled > 0 && !appointment.hasInvoice ?
          `<button class="action-btn primary" onclick="createInvoiceFromAppointment(${appointment.id})">Create Invoice</button>` : ''}
        ${currentUser.role === 'admin' ? `<button class="action-btn delete" onclick="deleteAppointment(${appointment.id})">Delete</button>` : ''}
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadPatientsForAppointment() {
  try {
    const patients = await window.electronAPI.getPatients();
    const select = document.getElementById('appointment-patient');

    patients.forEach(patient => {
      const option = document.createElement('option');
      option.value = patient.id;
      option.textContent = `${patient.patient_id} - ${patient.first_name} ${patient.last_name}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading patients for appointment:', error);
  }
}

async function loadDoctorsForAppointment() {
  try {
    const doctors = await window.electronAPI.getUsers({ role: 'doctor' });
    const select = document.getElementById('appointment-doctor');

    doctors.forEach(doctor => {
      const option = document.createElement('option');
      option.value = doctor.id;
      option.textContent = `${doctor.name}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading doctors for appointment:', error);
  }
}

async function loadAppointmentForEdit(appointmentId) {
  try {
    const appointments = await window.electronAPI.getAppointments({ id: appointmentId });
    if (appointments.length > 0) {
      const appointment = appointments[0];

      document.getElementById('appointment-patient').value = appointment.patient_id;
      document.getElementById('appointment-doctor').value = appointment.doctor_id;
      document.getElementById('appointment-date').value = new Date(appointment.appointment_date).toISOString().slice(0, 16);
      document.getElementById('appointment-type').value = appointment.appointment_type;
      document.getElementById('appointment-notes').value = appointment.notes || '';

      // Store ID for update
      document.getElementById('appointment-form').dataset.appointmentId = appointmentId;
    }
  } catch (error) {
    console.error('Error loading appointment for edit:', error);
  }
}

async function handleAppointmentSubmit(e, appointmentId) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const appointmentData = {
    patientId: parseInt(formData.get('patientId')),
    doctorId: parseInt(formData.get('doctorId')),
    appointmentDate: formData.get('appointmentDate'),
    appointmentType: formData.get('appointmentType'),
    notes: formData.get('notes')
  };

  try {
    if (appointmentId) {
      await window.electronAPI.updateAppointment(appointmentId, appointmentData);
      showSuccess('Appointment updated successfully');
    } else {
      await window.electronAPI.createAppointment(appointmentData);
      showSuccess('Appointment scheduled successfully');
    }
    closeModal('appointment-modal');
    loadAppointments();
  } catch (error) {
    showError('Error saving appointment: ' + error.message);
  }
}

async function loadExpenseForEdit(expenseId) {
  try {
    const expenses = await window.electronAPI.getExpenses();
    const expense = expenses.find(e => e.id === expenseId);
    if (expense) {
      document.getElementById('expense-description').value = expense.description;
      document.getElementById('expense-category').value = expense.category;
      document.getElementById('expense-amount').value = expense.amount;
      document.getElementById('expense-date').value = expense.expense_date.split('T')[0];
      document.getElementById('expense-vendor').value = expense.vendor || '';
      document.getElementById('expense-receipt').value = expense.receipt_path || '';
      document.getElementById('expense-notes').value = expense.notes || '';

      // Store ID for update
      document.getElementById('expense-form').dataset.expenseId = expenseId;
    }
  } catch (error) {
    console.error('Error loading expense for edit:', error);
  }
}

async function handleExpenseSubmit(e, expenseId) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const expenseData = {
    description: formData.get('description'),
    category: formData.get('category'),
    amount: parseFloat(formData.get('amount')),
    expenseDate: formData.get('expenseDate'),
    vendor: formData.get('vendor') || null,
    receiptPath: formData.get('receiptPath') || null,
    notes: formData.get('notes') || null
  };

  try {
    if (expenseId) {
      await window.electronAPI.updateExpense(expenseId, expenseData);
      showSuccess('Expense updated successfully');
    } else {
      await window.electronAPI.createExpense(expenseData);
      showSuccess('Expense added successfully');
    }
    closeModal('expense-modal');
    loadExpenses();
    loadFinancialReports(); // Refresh financial stats
  } catch (error) {
    showError('Error saving expense: ' + error.message);
  }
}

async function loadUserForEdit(userId) {
  try {
    const users = await window.electronAPI.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      document.getElementById('user-username').value = user.username;
      document.getElementById('user-name').value = user.name;
      document.getElementById('user-email').value = user.email || '';
      document.getElementById('user-phone').value = user.phone || '';
      document.getElementById('user-role').value = user.role;

      // Store ID for update
      document.getElementById('user-form').dataset.userId = userId;
    }
  } catch (error) {
    console.error('Error loading user for edit:', error);
  }
}

async function handleUserSubmit(e, userId) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const userData = {
    username: formData.get('username'),
    name: formData.get('name'),
    email: formData.get('email') || null,
    phone: formData.get('phone') || null,
    role: formData.get('role'),
    password: formData.get('password') || null
  };

  try {
    if (userId) {
      await window.electronAPI.updateUser(userId, userData);
      showSuccess('User updated successfully');
    } else {
      await window.electronAPI.createUser(userData);
      showSuccess('User created successfully');
    }
    closeModal('user-modal');
    loadUsers();
  } catch (error) {
    showError('Error saving user: ' + error.message);
  }
}

function openAppointmentModal(appointmentId = null) {
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'appointment-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${appointmentId ? 'Edit' : 'Schedule'} Appointment</h3>
        <span class="modal-close">&times;</span>
      </div>
      <form id="appointment-form">
        <div class="form-row">
          <div class="form-group">
            <label for="appointment-patient">Patient *</label>
            <select id="appointment-patient" name="patientId" required>
              <option value="">Select Patient</option>
            </select>
          </div>
          <div class="form-group">
            <label for="appointment-doctor">Doctor *</label>
            <select id="appointment-doctor" name="doctorId" required>
              <option value="">Select Doctor</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="appointment-date">Date & Time *</label>
            <input type="datetime-local" id="appointment-date" name="appointmentDate" required
                   value="${new Date().toISOString().slice(0, 16)}">
          </div>
          <div class="form-group">
            <label for="appointment-type">Type *</label>
            <select id="appointment-type" name="appointmentType" required>
              <option value="">Select Type</option>
              <option value="consultation">Consultation</option>
              <option value="follow-up">Follow-up</option>
              <option value="surgery">Surgery</option>
              <option value="therapy">Therapy</option>
              <option value="assessment">Assessment</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="appointment-notes">Notes</label>
          <textarea id="appointment-notes" name="notes" rows="3" placeholder="Appointment notes"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal('appointment-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">${appointmentId ? 'Update' : 'Schedule'} Appointment</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Load patients and doctors
  loadPatientsForAppointment();
  loadDoctorsForAppointment();

  // Load data if editing
  if (appointmentId) {
    loadAppointmentForEdit(appointmentId);
  }

  // Add form submit handler
  modal.querySelector('#appointment-form').addEventListener('submit', (e) => handleAppointmentSubmit(e, appointmentId));

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
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
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'invoice-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h3>Create Invoice</h3>
        <span class="modal-close">&times;</span>
      </div>
      <form id="invoice-form">
        <div class="form-row">
          <div class="form-group">
            <label for="invoice-patient">Patient *</label>
            <select id="invoice-patient" name="patientId" required>
              <option value="">Select Patient</option>
            </select>
          </div>
          <div class="form-group">
            <label for="invoice-due-date">Due Date *</label>
            <input type="date" id="invoice-due-date" name="dueDate" required
                   value="${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="form-group">
          <label for="invoice-notes">Notes</label>
          <textarea id="invoice-notes" name="notes" rows="2" placeholder="Invoice notes"></textarea>
        </div>

        <div class="invoice-items-section">
          <h4>Invoice Items</h4>
          <div id="invoice-items">
            <div class="invoice-item" data-item-id="1">
              <div class="form-row">
                <div class="form-group">
                  <label>Billing Code *</label>
                  <select name="billingCodeId" required>
                    <option value="">Select Billing Code</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Quantity *</label>
                  <input type="number" name="quantity" min="1" value="1" required>
                </div>
                <div class="form-group">
                  <label>Unit Price *</label>
                  <input type="number" name="unitPrice" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                  <label>Total</label>
                  <input type="number" name="totalPrice" step="0.01" readonly>
                </div>
                <div class="form-group">
                  <button type="button" class="btn btn-danger btn-sm remove-item" style="margin-top: 24px;">Remove</button>
                </div>
              </div>
            </div>
          </div>
          <button type="button" id="add-invoice-item" class="btn btn-secondary">Add Item</button>
        </div>

        <div class="invoice-totals">
          <div class="total-row">
            <strong>Subtotal: $<span id="invoice-subtotal">0.00</span></strong>
          </div>
          <div class="total-row">
            <strong>Tax (15%): $<span id="invoice-tax">0.00</span></strong>
          </div>
          <div class="total-row">
            <strong>Total: $<span id="invoice-total">0.00</span></strong>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal('invoice-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Invoice</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Load patients and billing codes
  loadPatientsForInvoice();
  loadBillingCodesForInvoice();

  // Add form submit handler
  modal.querySelector('#invoice-form').addEventListener('submit', handleInvoiceSubmit);

  // Add item management
  setupInvoiceItemManagement(modal);

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function loadPatientsForInvoice() {
  try {
    const patients = await window.electronAPI.getPatients();
    const select = document.getElementById('invoice-patient');

    patients.forEach(patient => {
      const option = document.createElement('option');
      option.value = patient.id;
      option.textContent = `${patient.patient_id} - ${patient.first_name} ${patient.last_name}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading patients for invoice:', error);
  }
}

async function loadBillingCodesForInvoice() {
  try {
    const billingCodes = await window.electronAPI.getBillingCodes({ active: true });
    const selects = document.querySelectorAll('#invoice-items select[name="billingCodeId"]');

    selects.forEach(select => {
      select.innerHTML = '<option value="">Select Billing Code</option>';
      billingCodes.forEach(code => {
        const option = document.createElement('option');
        option.value = code.id;
        option.textContent = `${code.code} - ${code.description} ($${code.default_price.toFixed(2)})`;
        option.dataset.price = code.default_price;
        option.dataset.taxRate = code.tax_rate;
        select.appendChild(option);
      });
    });
  } catch (error) {
    console.error('Error loading billing codes for invoice:', error);
  }
}

function setupInvoiceItemManagement(modal) {
  const itemsContainer = modal.querySelector('#invoice-items');
  const addItemBtn = modal.querySelector('#add-invoice-item');

  addItemBtn.addEventListener('click', () => {
    const itemCount = itemsContainer.children.length + 1;
    const itemHtml = `
      <div class="invoice-item" data-item-id="${itemCount}">
        <div class="form-row">
          <div class="form-group">
            <label>Billing Code *</label>
            <select name="billingCodeId" required>
              <option value="">Select Billing Code</option>
            </select>
          </div>
          <div class="form-group">
            <label>Quantity *</label>
            <input type="number" name="quantity" min="1" value="1" required>
          </div>
          <div class="form-group">
            <label>Unit Price *</label>
            <input type="number" name="unitPrice" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label>Total</label>
            <input type="number" name="totalPrice" step="0.01" readonly>
          </div>
          <div class="form-group">
            <button type="button" class="btn btn-danger btn-sm remove-item" style="margin-top: 24px;">Remove</button>
          </div>
        </div>
      </div>
    `;

    itemsContainer.insertAdjacentHTML('beforeend', itemHtml);

    // Load billing codes for new item
    loadBillingCodesForInvoice();

    // Add event listeners for new item
    const newItem = itemsContainer.lastElementChild;
    setupItemEventListeners(newItem);
  });

  // Setup event listeners for existing items
  itemsContainer.querySelectorAll('.invoice-item').forEach(setupItemEventListeners);

  function setupItemEventListeners(item) {
    const billingCodeSelect = item.querySelector('select[name="billingCodeId"]');
    const quantityInput = item.querySelector('input[name="quantity"]');
    const unitPriceInput = item.querySelector('input[name="unitPrice"]');
    const totalInput = item.querySelector('input[name="totalPrice"]');
    const removeBtn = item.querySelector('.remove-item');

    billingCodeSelect.addEventListener('change', (e) => {
      const selectedOption = e.target.selectedOptions[0];
      if (selectedOption && selectedOption.dataset.price) {
        unitPriceInput.value = selectedOption.dataset.price;
        calculateItemTotal(item);
      }
    });

    quantityInput.addEventListener('input', () => calculateItemTotal(item));
    unitPriceInput.addEventListener('input', () => calculateItemTotal(item));

    removeBtn.addEventListener('click', () => {
      if (itemsContainer.children.length > 1) {
        item.remove();
        calculateInvoiceTotals();
      } else {
        showError('Invoice must have at least one item');
      }
    });
  }

  function calculateItemTotal(item) {
    const quantity = parseFloat(item.querySelector('input[name="quantity"]').value) || 0;
    const unitPrice = parseFloat(item.querySelector('input[name="unitPrice"]').value) || 0;
    const total = quantity * unitPrice;
    item.querySelector('input[name="totalPrice"]').value = total.toFixed(2);
    calculateInvoiceTotals();
  }
}

function calculateInvoiceTotals() {
  const items = document.querySelectorAll('.invoice-item');
  let subtotal = 0;

  items.forEach(item => {
    const total = parseFloat(item.querySelector('input[name="totalPrice"]').value) || 0;
    subtotal += total;
  });

  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  document.getElementById('invoice-subtotal').textContent = subtotal.toFixed(2);
  document.getElementById('invoice-tax').textContent = tax.toFixed(2);
  document.getElementById('invoice-total').textContent = total.toFixed(2);
}

async function handleInvoiceSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const items = [];

  // Collect invoice items
  document.querySelectorAll('.invoice-item').forEach(item => {
    const billingCodeSelect = item.querySelector('select[name="billingCodeId"]');
    const billingCodeId = billingCodeSelect.value;
    const quantity = parseInt(item.querySelector('input[name="quantity"]').value);
    const unitPrice = parseFloat(item.querySelector('input[name="unitPrice"]').value);
    const totalPrice = parseFloat(item.querySelector('input[name="totalPrice"]').value);

    if (billingCodeId && quantity && unitPrice) {
      const selectedOption = billingCodeSelect.selectedOptions[0];
      const description = selectedOption ? selectedOption.textContent.split(' - ')[1].split(' (')[0] : 'Service';

      items.push({
        billingCodeId: parseInt(billingCodeId),
        description: description,
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice
      });
    }
  });

  if (items.length === 0) {
    showError('Invoice must have at least one item');
    return;
  }

  const invoiceData = {
    patientId: parseInt(formData.get('patientId')),
    amount: parseFloat(document.getElementById('invoice-subtotal').textContent),
    taxAmount: parseFloat(document.getElementById('invoice-tax').textContent),
    totalAmount: parseFloat(document.getElementById('invoice-total').textContent),
    dueDate: formData.get('dueDate'),
    notes: formData.get('notes'),
    items: items
  };

  try {
    await window.electronAPI.createInvoice(invoiceData);
    showSuccess('Invoice created successfully');
    closeModal('invoice-modal');
    loadInvoices();
  } catch (error) {
    showError('Error creating invoice: ' + error.message);
  }
}

function openExpenseModal(expenseId = null) {
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'expense-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${expenseId ? 'Edit' : 'Add'} Expense</h3>
        <span class="modal-close">&times;</span>
      </div>
      <form id="expense-form">
        <div class="form-row">
          <div class="form-group">
            <label for="expense-description">Description *</label>
            <input type="text" id="expense-description" name="description" required placeholder="Expense description">
          </div>
          <div class="form-group">
            <label for="expense-category">Category *</label>
            <select id="expense-category" name="category" required>
              <option value="">Select Category</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Medical Equipment">Medical Equipment</option>
              <option value="Utilities">Utilities</option>
              <option value="Rent">Rent</option>
              <option value="Insurance">Insurance</option>
              <option value="Marketing">Marketing</option>
              <option value="Salaries">Salaries</option>
              <option value="Training">Training</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="expense-amount">Amount *</label>
            <input type="number" id="expense-amount" name="amount" step="0.01" min="0" required placeholder="0.00">
          </div>
          <div class="form-group">
            <label for="expense-date">Expense Date *</label>
            <input type="date" id="expense-date" name="expenseDate" required value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="expense-vendor">Vendor</label>
            <input type="text" id="expense-vendor" name="vendor" placeholder="Vendor name">
          </div>
          <div class="form-group">
            <label for="expense-receipt">Receipt Path</label>
            <input type="text" id="expense-receipt" name="receiptPath" placeholder="Path to receipt file">
          </div>
        </div>
        <div class="form-group">
          <label for="expense-notes">Notes</label>
          <textarea id="expense-notes" name="notes" rows="2" placeholder="Additional notes"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal('expense-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">${expenseId ? 'Update' : 'Add'} Expense</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Load data if editing
  if (expenseId) {
    loadExpenseForEdit(expenseId);
  }

  // Add form submit handler
  modal.querySelector('#expense-form').addEventListener('submit', (e) => handleExpenseSubmit(e, expenseId));

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function loadBillingCodes() {
  try {
    const billingCodes = await window.electronAPI.getBillingCodes();
    renderBillingCodesTable(billingCodes);
  } catch (error) {
    console.error('Error loading billing codes:', error);
  }
}

function renderBillingCodesTable(billingCodes) {
  const tbody = document.getElementById('billing-codes-tbody');
  tbody.innerHTML = '';

  billingCodes.forEach(code => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${code.code}</td>
      <td>${code.description}</td>
      <td>${code.category}</td>
      <td>$${code.default_price.toFixed(2)}</td>
      <td><span class="status-${code.active ? 'active' : 'inactive'}">${code.active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="action-btn edit" onclick="editBillingCode(${code.id})">Edit</button>
        <button class="action-btn delete" onclick="deleteBillingCode(${code.id})"
                ${currentUser.role !== 'admin' ? 'style="display: none;"' : ''}>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadPayments() {
  try {
    const payments = await window.electronAPI.getPayments();
    renderPaymentsTable(payments);
  } catch (error) {
    console.error('Error loading payments:', error);
  }
}

function renderPaymentsTable(payments) {
  const tbody = document.getElementById('payments-tbody');
  tbody.innerHTML = '';

  payments.forEach(payment => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
      <td>${payment.invoice_number}</td>
      <td>${payment.first_name} ${payment.last_name}</td>
      <td>$${payment.amount.toFixed(2)}</td>
      <td>${payment.payment_method}</td>
      <td>${payment.reference_number || ''}</td>
    `;
    tbody.appendChild(row);
  });
}

function openBillingCodeModal(billingCodeId = null) {
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'billing-code-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${billingCodeId ? 'Edit' : 'Add'} Billing Code</h3>
        <span class="modal-close">&times;</span>
      </div>
      <form id="billing-code-form">
        <div class="form-row">
          <div class="form-group">
            <label for="billing-code">Code *</label>
            <input type="text" id="billing-code" name="code" required placeholder="e.g., CONSULT">
          </div>
          <div class="form-group">
            <label for="billing-category">Category *</label>
            <select id="billing-category" name="category" required>
              <option value="">Select Category</option>
              <option value="Consultation">Consultation</option>
              <option value="Diagnostic">Diagnostic</option>
              <option value="Therapy">Therapy</option>
              <option value="Emergency">Emergency</option>
              <option value="Preventive">Preventive</option>
              <option value="Medication">Medication</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="billing-description">Description *</label>
          <input type="text" id="billing-description" name="description" required placeholder="Brief description of the service">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="billing-price">Default Price *</label>
            <input type="number" id="billing-price" name="defaultPrice" step="0.01" min="0" required placeholder="0.00">
          </div>
          <div class="form-group">
            <label for="billing-tax-rate">Tax Rate (%)</label>
            <input type="number" id="billing-tax-rate" name="taxRate" step="0.01" min="0" max="100" value="15.00" placeholder="15.00">
          </div>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="billing-active" name="active" checked> Active
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal('billing-code-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Billing Code</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Load data if editing
  if (billingCodeId) {
    loadBillingCodeForEdit(billingCodeId);
  }

  // Add form submit handler
  modal.querySelector('#billing-code-form').addEventListener('submit', handleBillingCodeSubmit);

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function loadBillingCodeForEdit(billingCodeId) {
  try {
    const billingCodes = await window.electronAPI.getBillingCodes();
    const code = billingCodes.find(c => c.id === billingCodeId);
    if (code) {
      document.getElementById('billing-code').value = code.code;
      document.getElementById('billing-description').value = code.description;
      document.getElementById('billing-category').value = code.category;
      document.getElementById('billing-price').value = code.default_price;
      document.getElementById('billing-tax-rate').value = (code.tax_rate * 100).toFixed(2);
      document.getElementById('billing-active').checked = code.active === 1;

      // Store ID for update
      document.getElementById('billing-code-form').dataset.billingCodeId = billingCodeId;
    }
  } catch (error) {
    console.error('Error loading billing code:', error);
  }
}

async function handleBillingCodeSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const billingCodeData = {
    code: formData.get('code'),
    description: formData.get('description'),
    category: formData.get('category'),
    defaultPrice: parseFloat(formData.get('defaultPrice')),
    taxRate: parseFloat(formData.get('taxRate')) / 100,
    active: formData.has('active')
  };

  try {
    const isEdit = e.target.dataset.billingCodeId;
    if (isEdit) {
      await window.electronAPI.updateBillingCode(parseInt(isEdit), billingCodeData);
      showSuccess('Billing code updated successfully');
    } else {
      await window.electronAPI.createBillingCode(billingCodeData);
      showSuccess('Billing code created successfully');
    }
    closeModal('billing-code-modal');
    loadBillingCodes();
  } catch (error) {
    showError('Error saving billing code: ' + error.message);
  }
}

function openPaymentModal() {
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'payment-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Record Payment</h3>
        <span class="modal-close">&times;</span>
      </div>
      <form id="payment-form">
        <div class="form-row">
          <div class="form-group">
            <label for="payment-invoice">Invoice *</label>
            <select id="payment-invoice" name="invoiceId" required>
              <option value="">Select Invoice</option>
            </select>
          </div>
          <div class="form-group">
            <label for="payment-amount">Amount *</label>
            <input type="number" id="payment-amount" name="amount" step="0.01" min="0" required placeholder="0.00">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="payment-date">Payment Date *</label>
            <input type="date" id="payment-date" name="paymentDate" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label for="payment-method">Payment Method *</label>
            <select id="payment-method" name="paymentMethod" required>
              <option value="">Select Method</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="check">Check</option>
              <option value="insurance">Insurance</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="payment-reference">Reference Number</label>
          <input type="text" id="payment-reference" name="referenceNumber" placeholder="Check #, Transaction ID, etc.">
        </div>
        <div class="form-group">
          <label for="payment-notes">Notes</label>
          <textarea id="payment-notes" name="notes" rows="2" placeholder="Additional notes"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal('payment-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">Record Payment</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Load unpaid/overdue invoices
  loadInvoicesForPayment();

  // Add form submit handler
  modal.querySelector('#payment-form').addEventListener('submit', handlePaymentSubmit);

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function loadInvoicesForPayment() {
  try {
    const invoices = await window.electronAPI.getInvoices({ status: ['unpaid', 'overdue', 'partial'] });
    const select = document.getElementById('payment-invoice');

    invoices.forEach(invoice => {
      const option = document.createElement('option');
      option.value = invoice.id;
      option.textContent = `${invoice.invoice_number} - ${invoice.first_name} ${invoice.last_name} ($${invoice.total_amount.toFixed(2)})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading invoices for payment:', error);
  }
}

async function handlePaymentSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const paymentData = {
    invoiceId: parseInt(formData.get('invoiceId')),
    amount: parseFloat(formData.get('amount')),
    paymentDate: formData.get('paymentDate'),
    paymentMethod: formData.get('paymentMethod'),
    referenceNumber: formData.get('referenceNumber') || null,
    notes: formData.get('notes') || null
  };

  try {
    await window.electronAPI.recordPayment(paymentData);
    showSuccess('Payment recorded successfully');
    closeModal('payment-modal');
    loadPayments();
    loadInvoices(); // Refresh invoices to show updated status
  } catch (error) {
    showError('Error recording payment: ' + error.message);
  }
}

async function createInvoiceFromAppointment(appointmentId) {
  if (!confirm('Create an invoice for this appointment?')) {
    return;
  }

  try {
    const result = await window.electronAPI.generateInvoiceFromAppointment(appointmentId);
    showSuccess(`Invoice ${result.invoiceNumber} created successfully`);
    loadAppointments(); // Refresh to show updated billing status
    loadInvoices(); // Refresh invoices list
  } catch (error) {
    showError('Error creating invoice: ' + error.message);
  }
}

async function clearAllInvoices() {
  if (!confirm('Are you sure you want to delete ALL invoices, payments, and related billing data? This action cannot be undone.')) {
    return;
  }

  if (!confirm('This will permanently delete all invoice data. Are you absolutely sure?')) {
    return;
  }

  try {
    const result = await window.electronAPI.clearInvoices();
    showSuccess(result.message);
    loadInvoices(); // Refresh the invoices list
    loadPayments(); // Refresh payments list
    loadFinancialReports(); // Refresh financial stats
    loadDashboard(); // Refresh dashboard to update financial stats display
  } catch (error) {
    showError('Error clearing invoices: ' + error.message);
  }
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

function openUserModal(userId = null) {
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'user-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${userId ? 'Edit' : 'Add'} User</h3>
        <span class="modal-close">&times;</span>
      </div>
      <form id="user-form">
        <div class="form-row">
          <div class="form-group">
            <label for="user-username">Username *</label>
            <input type="text" id="user-username" name="username" required placeholder="Username">
          </div>
          <div class="form-group">
            <label for="user-name">Full Name *</label>
            <input type="text" id="user-name" name="name" required placeholder="Full name">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="user-email">Email</label>
            <input type="email" id="user-email" name="email" placeholder="user@example.com">
          </div>
          <div class="form-group">
            <label for="user-phone">Phone</label>
            <input type="tel" id="user-phone" name="phone" placeholder="Phone number">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="user-role">Role *</label>
            <select id="user-role" name="role" required>
              <option value="">Select Role</option>
              <option value="admin">Administrator</option>
              <option value="doctor">Doctor</option>
              <option value="receptionist">Receptionist</option>
              <option value="accountant">Accountant</option>
            </select>
          </div>
          <div class="form-group">
            <label for="user-password">Password ${userId ? '(leave blank to keep current)' : '*'}</label>
            <input type="password" id="user-password" name="password" ${userId ? '' : 'required'} placeholder="Password">
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal('user-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">${userId ? 'Update' : 'Create'} User</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Load data if editing
  if (userId) {
    loadUserForEdit(userId);
  }

  // Add form submit handler
  modal.querySelector('#user-form').addEventListener('submit', (e) => handleUserSubmit(e, userId));

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function createBackup() {
  try {
    const result = await window.electronAPI.createBackup();
    if (result.success) {
      const fileName = result.path.split(/[/\\]/).pop();
      showSuccess(`Backup created successfully: ${fileName}`);
      // Update backup status
      document.getElementById('backup-status').innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Last backup: ${new Date().toLocaleString()}</span>
      `;
    } else {
      showError('Failed to create backup');
    }
  } catch (error) {
    showError('Error creating backup: ' + error.message);
  }
}

async function restoreBackup() {
  if (!confirm('Are you sure you want to restore from backup? This will replace all current data.')) {
    return;
  }

  if (!confirm('This action cannot be undone. All current data will be lost. Continue?')) {
    return;
  }

  try {
    const result = await window.electronAPI.restoreBackup();
    if (result && result.success) {
      showSuccess('Database restored successfully. The application will restart.');
      // Reload the app
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      showError('Restore cancelled or failed');
    }
  } catch (error) {
    showError('Error restoring backup: ' + error.message);
  }
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

  try {
    // Ctrl/Cmd key combinations
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          handleNewRecordShortcut();
          break;
        case 'f':
          e.preventDefault();
          focusSearchField();
          break;
        case 's':
          e.preventDefault();
          saveCurrentForm();
          break;
        case 'e':
          e.preventDefault();
          handleEditShortcut();
          break;
        case 'd':
          e.preventDefault();
          handleDeleteShortcut();
          break;
        case 'b':
          e.preventDefault();
          handleBulkOperationsShortcut();
          break;
        case 'p':
          e.preventDefault();
          handlePrintShortcut();
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
        case 'i':
          e.preventDefault();
          handleInvoiceShortcut();
          break;
        case 'r':
          e.preventDefault();
          handleReportShortcut();
          break;
        case 'u':
          e.preventDefault();
          handleUserShortcut();
          break;
      }
    }

    // Function keys
    switch (e.key) {
      case 'F1':
        e.preventDefault();
        showKeyboardShortcutsHelp();
        break;
      case 'F2':
        e.preventDefault();
        handleRenameShortcut();
        break;
      case 'F3':
        e.preventDefault();
        handleSearchShortcut();
        break;
      case 'F5':
        e.preventDefault();
        // Refresh current screen data
        refreshCurrentScreen();
        break;
      case 'F12':
        e.preventDefault();
        toggleSidebar();
        break;
    }

    // Shift combinations
    if (e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'f1':
          e.preventDefault();
          showAdvancedHelp();
          break;
        case 'f5':
          e.preventDefault();
          forceRefresh();
          break;
      }
    }
  } catch (error) {
    console.error('Keyboard shortcut error:', error);
    showWarning('An error occurred while processing keyboard shortcut: ' + error.message);
  }
});

// Helper functions for keyboard shortcuts
function handleNewRecordShortcut() {
  try {
    if (!currentScreen) {
      showWarning('No active screen to create record for');
      return;
    }

    switch (currentScreen) {
      case 'patients':
        openPatientModal();
        break;
      case 'appointments':
        openAppointmentModal();
        break;
      case 'accounting':
        if (document.querySelector('#invoices-tab.active')) {
          openInvoiceModal();
        } else if (document.querySelector('#expenses-tab.active')) {
          openExpenseModal();
        } else if (document.querySelector('#billing-codes-tab.active')) {
          openBillingCodeModal();
        } else if (document.querySelector('#payments-tab.active')) {
          openPaymentModal();
        } else {
          showWarning('Please select a specific tab in Accounting section');
        }
        break;
      case 'admin':
        if (document.querySelector('#users-tab.active')) {
          openUserModal();
        } else {
          showWarning('Please select Users tab in Admin section');
        }
        break;
      default:
        showWarning('New record shortcut not available for this screen');
    }
  } catch (error) {
    console.error('Error in handleNewRecordShortcut:', error);
    showWarning('Failed to create new record: ' + error.message);
  }
}

function focusSearchField() {
  try {
    let searchInput;
    
    switch (currentScreen) {
      case 'patients':
        searchInput = document.getElementById('patient-search');
        break;
      case 'appointments':
        searchInput = document.getElementById('appointment-search');
        break;
      case 'accounting':
        searchInput = document.getElementById('invoice-search');
        break;
      default:
        searchInput = document.getElementById('patient-search');
    }
    
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    } else {
      showWarning('Search field not found for current screen');
    }
  } catch (error) {
    console.error('Error in focusSearchField:', error);
    showWarning('Failed to focus search field: ' + error.message);
  }
}

function saveCurrentForm() {
  try {
    const activeForm = document.querySelector('form.active, #patient-form, #appointment-form, #invoice-form, #expense-form, #billing-code-form, #payment-form, #user-form');
    if (activeForm) {
      const submitBtn = activeForm.querySelector('button[type="submit"]');
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
      } else {
        showWarning('Form is not ready to save or submit button is disabled');
      }
    } else {
      showWarning('No active form found to save');
    }
  } catch (error) {
    console.error('Error in saveCurrentForm:', error);
    showWarning('Failed to save form: ' + error.message);
  }
}

function handleEditShortcut() {
  const selectedItems = document.querySelectorAll('.patient-checkbox:checked, .appointment-checkbox:checked, .invoice-checkbox:checked');
  if (selectedItems.length === 1) {
    const itemId = selectedItems[0].dataset.patientId || selectedItems[0].dataset.appointmentId || selectedItems[0].dataset.invoiceId;
    if (itemId) {
      switch (currentScreen) {
        case 'patients':
          openPatientModal(itemId);
          break;
        case 'appointments':
          openAppointmentModal(itemId);
          break;
        case 'accounting':
          if (document.querySelector('#invoices-tab.active')) {
            editInvoice(itemId);
          } else if (document.querySelector('#expenses-tab.active')) {
            editExpense(itemId);
          } else if (document.querySelector('#billing-codes-tab.active')) {
            editBillingCode(itemId);
          }
          break;
      }
    }
  } else if (selectedItems.length > 1) {
    showWarning('Please select only one item to edit');
  } else {
    showWarning('Please select an item to edit');
  }
}

function handleDeleteShortcut() {
  const selectedItems = document.querySelectorAll('.patient-checkbox:checked, .appointment-checkbox:checked, .invoice-checkbox:checked');
  if (selectedItems.length > 0) {
    const itemIds = Array.from(selectedItems).map(item => item.dataset.patientId || item.dataset.appointmentId || item.dataset.invoiceId);
    const itemType = currentScreen === 'patients' ? 'patient' : currentScreen === 'appointments' ? 'appointment' : 'invoice';
    
    if (confirm(`Are you sure you want to delete ${selectedItems.length} ${itemType}${selectedItems.length > 1 ? 's' : ''}?`)) {
      itemIds.forEach(id => {
        switch (currentScreen) {
          case 'patients':
            deletePatientRecord(id);
            break;
          case 'appointments':
            deleteAppointment(id);
            break;
          case 'accounting':
            if (document.querySelector('#invoices-tab.active')) {
              deleteInvoice(id);
            } else if (document.querySelector('#expenses-tab.active')) {
              deleteExpense(id);
            }
            break;
        }
      });
    }
  } else {
    showWarning('Please select items to delete');
  }
}

function handleBulkOperationsShortcut() {
  if (currentScreen === 'patients') {
    const selectedCount = document.querySelectorAll('.patient-checkbox:checked').length;
    if (selectedCount > 0) {
      // Show bulk operations menu
      const bulkControls = document.getElementById('bulk-selection-controls');
      if (bulkControls) {
        bulkControls.style.display = 'flex';
      }
    } else {
      showWarning('Please select patients for bulk operations');
    }
  } else {
    showWarning('Bulk operations are only available for patients');
  }
}

function handlePrintShortcut() {
  switch (currentScreen) {
    case 'patients':
      bulkPrintLabels();
      break;
    case 'appointments':
      printAppointmentSchedule();
      break;
    case 'accounting':
      printFinancialReport();
      break;
    default:
      window.print();
  }
}

function handleInvoiceShortcut() {
  if (currentScreen === 'accounting') {
    openInvoiceModal();
  } else {
    showWarning('Invoice creation is only available in the Accounting section');
  }
}

function handleReportShortcut() {
  if (currentScreen === 'accounting') {
    switchTab('accounting', 'reports');
  } else {
    showWarning('Reports are only available in the Accounting section');
  }
}

function handleUserShortcut() {
  if (currentScreen === 'admin') {
    openUserModal();
  } else {
    showWarning('User management is only available in the Admin section');
  }
}

function handleRenameShortcut() {
  // For renaming selected items
  const selectedItems = document.querySelectorAll('.patient-checkbox:checked, .appointment-checkbox:checked');
  if (selectedItems.length === 1) {
    const itemId = selectedItems[0].dataset.patientId || selectedItems[0].dataset.appointmentId;
    if (itemId) {
      switch (currentScreen) {
        case 'patients':
          openPatientModal(itemId);
          break;
        case 'appointments':
          openAppointmentModal(itemId);
          break;
      }
    }
  }
}

function handleSearchShortcut() {
  focusSearchField();
}

function refreshCurrentScreen() {
  switch (currentScreen) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'patients':
      loadPatients('', {}, true); // Force refresh for patients
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

function forceRefresh() {
  // Force reload data and clear cache
  clearExpiredCache();
  if (currentScreen === 'patients') {
    loadPatients('', {}, true); // Force refresh for patients
  } else {
    refreshCurrentScreen();
  }
}

function showAdvancedHelp() {
  // Show advanced help modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'advanced-help-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3>Advanced Keyboard Shortcuts</h3>
        <span class="modal-close">×</span>
      </div>
      <div class="help-content" style="padding: 1.5rem;">
        <div class="help-section">
          <h4>Navigation Shortcuts</h4>
          <ul>
            <li><kbd>Ctrl+Alt+1-5</kbd> - Switch screens with confirmation</li>
            <li><kbd>Ctrl+Tab</kbd> - Switch between tabs in current screen</li>
            <li><kbd>Ctrl+Shift+Tab</kbd> - Switch to previous tab</li>
          </ul>
        </div>
        <div class="help-section">
          <h4>Form Shortcuts</h4>
          <ul>
            <li><kbd>Ctrl+Enter</kbd> - Save current form</li>
            <li><kbd>Ctrl+Shift+S</kbd> - Save and close form</li>
            <li><kbd>Ctrl+Shift+N</kbd> - Create new record and keep form open</li>
            <li><kbd>Ctrl+Shift+E</kbd> - Edit selected item</li>
          </ul>
        </div>
        <div class="help-section">
          <h4>Selection Shortcuts</h4>
          <ul>
            <li><kbd>Ctrl+A</kbd> - Select all items</li>
            <li><kbd>Ctrl+Shift+A</kbd> - Deselect all items</li>
            <li><kbd>Ctrl+Click</kbd> - Add/remove single item from selection</li>
            <li><kbd>Shift+Click</kbd> - Select range of items</li>
          </ul>
        </div>
        <div class="help-section">
          <h4>Search Shortcuts</h4>
          <ul>
            <li><kbd>Ctrl+F</kbd> - Focus search field</li>
            <li><kbd>Ctrl+Shift+F</kbd> - Open advanced search</li>
            <li><kbd>Ctrl+G</kbd> - Find next search result</li>
            <li><kbd>Ctrl+Shift+G</kbd> - Find previous search result</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function showWarning(message) {
  const warningDiv = document.createElement('div');
  warningDiv.className = 'message warning';
  warningDiv.textContent = message;
  document.querySelector('.app-main').prepend(warningDiv);
  setTimeout(() => warningDiv.remove(), 3000);
}

// Additional helper functions for missing features
function deleteInvoice(id) {
  if (confirm('Are you sure you want to delete this invoice?')) {
    window.electronAPI.deleteInvoice(id).then(() => {
      loadInvoices();
      showSuccess('Invoice deleted successfully');
    }).catch(error => {
      showError('Error deleting invoice: ' + error.message);
    });
  }
}

function printAppointmentSchedule() {
  const appointments = document.querySelectorAll('.data-table tbody tr');
  if (appointments.length > 0) {
    window.print();
  } else {
    showWarning('No appointments to print');
  }
}

function printFinancialReport() {
  if (currentScreen === 'accounting') {
    const reportData = document.querySelector('.financial-reports-content');
    if (reportData) {
      window.print();
    } else {
      showWarning('No financial data to print');
    }
  }
}

// Test function for keyboard shortcuts (development only)
function testKeyboardShortcuts() {
  console.log('Testing keyboard shortcuts...');
  
  // Test basic navigation
  console.log('Testing Alt+1 (Dashboard):');
  const dashboardEvent = new KeyboardEvent('keydown', { altKey: true, key: '1' });
  document.dispatchEvent(dashboardEvent);
  
  console.log('Testing Alt+2 (Patients):');
  const patientsEvent = new KeyboardEvent('keydown', { altKey: true, key: '2' });
  document.dispatchEvent(patientsEvent);
  
  console.log('Testing F1 (Help):');
  const helpEvent = new KeyboardEvent('keydown', { key: 'F1' });
  document.dispatchEvent(helpEvent);
  
  console.log('Keyboard shortcuts test completed. Check console for errors.');
}

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
            <button class="btn btn-primary" onclick="window.startTour('dashboard')">Dashboard Tour</button>
            <button class="btn btn-primary" onclick="window.startTour('patients')">Patient Management Tour</button>
            <button class="btn btn-primary" onclick="window.startTour('appointments')">Appointments Tour</button>
            <button class="btn btn-primary" onclick="window.startTour('accounting')">Accounting Tour</button>
            <button class="btn btn-primary" onclick="window.startTour('admin')">Admin Tour</button>
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

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function startTour(tourType) {
  // Close help modal
  document.getElementById('help-modal')?.remove();

  // Switch to appropriate screen
  if (tourType !== 'dashboard') {
    switchScreen(tourType);
  }

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
    case 'accounting':
      tourSteps = [
        {
          element: '#accounting-screen',
          title: 'Accounting Dashboard',
          content: 'Welcome to the accounting section. Here you can manage invoices, track payments, and monitor your clinic\'s financial health.',
          position: 'bottom'
        },
        {
          element: '#add-invoice-btn',
          title: 'Create New Invoices',
          content: 'Click here to create new invoices for patient services. You can add multiple billing items and calculate taxes automatically.',
          position: 'bottom'
        },
        {
          element: '#invoices-tab',
          title: 'Invoice Management',
          content: 'View and manage all your invoices here. Track payment status, due dates, and outstanding balances.',
          position: 'top'
        },
        {
          element: '#billing-codes-tab',
          title: 'Billing Codes',
          content: 'Manage your billing codes and pricing. These codes are used when creating invoices and determine service pricing.',
          position: 'top'
        },
        {
          element: '#record-payment-btn',
          title: 'Record Payments',
          content: 'Record payments received from patients. You can track different payment methods and reference numbers.',
          position: 'bottom'
        },
        {
          element: '#reports-tab',
          title: 'Financial Reports',
          content: 'View comprehensive financial reports including revenue, expenses, and profit/loss statements.',
          position: 'top'
        }
      ];
      break;
    case 'admin':
      tourSteps = [
        {
          element: '#admin-screen',
          title: 'Administration Panel',
          content: 'This is the administration section where you can manage users, system settings, and perform maintenance tasks.',
          position: 'bottom'
        },
        {
          element: '#users-tab',
          title: 'User Management',
          content: 'Manage user accounts and permissions. You can add doctors, receptionists, accountants, and other staff members.',
          position: 'top'
        },
        {
          element: '#add-user-btn',
          title: 'Add New Users',
          content: 'Click here to add new users to the system. Set appropriate roles and permissions for each user type.',
          position: 'bottom'
        },
        {
          element: '#audit-tab',
          title: 'Audit Log',
          content: 'View the audit log to track all system activities. This helps with compliance and troubleshooting.',
          position: 'top'
        },
        {
          element: '#backup-btn',
          title: 'Data Backup',
          content: 'Regularly backup your data to prevent loss. You can also restore from previous backups if needed.',
          position: 'bottom'
        },
        {
          element: '#sync-tab',
          title: 'Data Synchronization',
          content: 'Configure settings for synchronizing data with external systems or cloud services.',
          position: 'top'
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

  // Position tooltip after it's rendered
  requestAnimationFrame(() => {
    positionTourTooltip(overlay, element, step.position);
  });

  // Highlight target element
  element.classList.add('tour-highlight');
}

function positionTourTooltip(overlay, element, preferredPosition) {
  const tooltip = overlay.querySelector('.tour-tooltip');
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Set initial position to center as fallback
  let finalLeft = (viewportWidth - 300) / 2; // Default width
  let finalTop = (viewportHeight - 200) / 2; // Default height
  let finalPosition = 'center';

  // Define position attempts in order of preference
  const positionAttempts = [preferredPosition];

  // Add fallback positions
  switch (preferredPosition) {
    case 'top':
      positionAttempts.push('bottom', 'left', 'right', 'center');
      break;
    case 'bottom':
      positionAttempts.push('top', 'left', 'right', 'center');
      break;
    case 'left':
      positionAttempts.push('right', 'top', 'bottom', 'center');
      break;
    case 'right':
      positionAttempts.push('left', 'top', 'bottom', 'center');
      break;
    default:
      positionAttempts.push('top', 'bottom', 'left', 'right');
      break;
  }

  // Try each position until one fits
  for (const position of positionAttempts) {
    // Force tooltip to be visible to measure its dimensions
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    tooltip.style.position = 'fixed';
    tooltip.style.left = '0';
    tooltip.style.top = '0';
    
    // Trigger reflow to get accurate dimensions
    tooltip.offsetHeight;
    
    const tooltipRect = tooltip.getBoundingClientRect();
    tooltip.style.visibility = 'visible';

    let left, top;
    const margin = 20;

    switch (position) {
      case 'top':
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        top = rect.top - tooltipRect.height - 10;
        break;
      case 'bottom':
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        top = rect.bottom + 10;
        break;
      case 'left':
        left = rect.left - tooltipRect.width - 10;
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        break;
      case 'right':
        left = rect.right + 10;
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        break;
      case 'center':
        left = (viewportWidth - tooltipRect.width) / 2;
        top = (viewportHeight - tooltipRect.height) / 2;
        break;
    }

    // Check if position fits within viewport with some margin
    const fits = left >= margin &&
                 top >= margin &&
                 left + tooltipRect.width <= viewportWidth - margin &&
                 top + tooltipRect.height <= viewportHeight - margin;

    if (fits) {
      finalPosition = position;
      finalLeft = left;
      finalTop = top;
      break;
    }
  }

  // Apply the position with bounds checking
  const clampedLeft = Math.max(10, Math.min(finalLeft, viewportWidth - 320));
  const clampedTop = Math.max(10, Math.min(finalTop, viewportHeight - 220));

  tooltip.style.left = clampedLeft + 'px';
  tooltip.style.top = clampedTop + 'px';
  tooltip.style.position = 'fixed';
  tooltip.style.zIndex = '10000';

  // Update tooltip class for styling
  tooltip.className = `tour-tooltip ${finalPosition}`;
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
    // Navigation Shortcuts
    { category: 'Navigation', keys: 'Alt+1-5', description: 'Switch to Dashboard/Patients/Appointments/Accounting/Admin' },
    { category: 'Navigation', keys: 'F12', description: 'Toggle Sidebar' },
    { category: 'Navigation', keys: 'Ctrl+Tab', description: 'Switch to next tab' },
    { category: 'Navigation', keys: 'Ctrl+Shift+Tab', description: 'Switch to previous tab' },
    
    // Basic Operations
    { category: 'Basic Operations', keys: 'Ctrl+N', description: 'Create New Record (context-sensitive)' },
    { category: 'Basic Operations', keys: 'Ctrl+E', description: 'Edit Selected Item' },
    { category: 'Basic Operations', keys: 'Ctrl+D', description: 'Delete Selected Item(s)' },
    { category: 'Basic Operations', keys: 'Ctrl+S', description: 'Save Current Form' },
    { category: 'Basic Operations', keys: 'Ctrl+Esc', description: 'Close Modal/Dialog' },
    
    // Search and Filter
    { category: 'Search & Filter', keys: 'Ctrl+F', description: 'Focus Search Field' },
    { category: 'Search & Filter', keys: 'F3', description: 'Quick Search' },
    { category: 'Search & Filter', keys: 'Ctrl+Shift+F', description: 'Open Advanced Search' },
    
    // Screen-Specific Shortcuts
    { category: 'Patients', keys: 'Ctrl+N', description: 'Add New Patient' },
    { category: 'Patients', keys: 'Ctrl+B', description: 'Bulk Operations' },
    { category: 'Patients', keys: 'Ctrl+P', description: 'Print Patient Labels' },
    
    { category: 'Appointments', keys: 'Ctrl+N', description: 'Schedule New Appointment' },
    { category: 'Appointments', keys: 'Ctrl+P', description: 'Print Appointment Schedule' },
    
    { category: 'Accounting', keys: 'Ctrl+N', description: 'Create New Invoice' },
    { category: 'Accounting', keys: 'Alt+I', description: 'Create Invoice' },
    { category: 'Accounting', keys: 'Alt+R', description: 'View Reports' },
    { category: 'Accounting', keys: 'Ctrl+P', description: 'Print Financial Report' },
    
    { category: 'Admin', keys: 'Ctrl+N', description: 'Add New User' },
    { category: 'Admin', keys: 'Alt+U', description: 'User Management' },
    
    // Advanced Shortcuts
    { category: 'Advanced', keys: 'F1', description: 'Show Basic Help' },
    { category: 'Advanced', keys: 'Shift+F1', description: 'Show Advanced Help' },
    { category: 'Advanced', keys: 'F5', description: 'Refresh Current Screen' },
    { category: 'Advanced', keys: 'Shift+F5', description: 'Force Refresh (Clear Cache)' },
    { category: 'Advanced', keys: 'F2', description: 'Rename Selected Item' },
    
    // Selection Shortcuts
    { category: 'Selection', keys: 'Ctrl+A', description: 'Select All Items' },
    { category: 'Selection', keys: 'Ctrl+Shift+A', description: 'Deselect All Items' },
    { category: 'Selection', keys: 'Ctrl+Click', description: 'Toggle Single Item Selection' },
    { category: 'Selection', keys: 'Shift+Click', description: 'Select Range of Items' }
  ];

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'shortcuts-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px;">
      <div class="modal-header">
        <h3>Keyboard Shortcuts</h3>
        <span class="modal-close">&times;</span>
      </div>
      <div class="shortcuts-content" style="padding: 1.5rem;">
        ${Object.entries(groupByCategory(shortcuts)).map(([category, categoryShortcuts]) => `
          <div class="shortcut-category">
            <h4 style="margin: 1.5rem 0 0.75rem 0; color: var(--text-primary); font-size: 1rem; font-weight: 600; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">${category}</h4>
            ${categoryShortcuts.map(shortcut => `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0.5rem; border-radius: 6px; background: var(--bg-secondary); transition: background-color 0.2s;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <kbd style="background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); font-family: monospace; font-weight: 600; min-width: 80px; text-align: center;">${shortcut.keys}</kbd>
                  <span style="flex: 1; color: var(--text-primary);">${shortcut.description}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); background: var(--bg-secondary);">
        <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
          <strong>Note:</strong> Shortcuts are context-sensitive and may only work on specific screens or when certain conditions are met.
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Helper function to group shortcuts by category
function groupByCategory(shortcuts) {
  return shortcuts.reduce((groups, shortcut) => {
    const category = shortcut.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(shortcut);
    return groups;
  }, {});
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
window.switchScreen = switchScreen;
window.editPatient = (id) => openPatientModal(id);
window.deletePatient = (id) => deletePatientRecord(id);
window.editAppointment = (id) => openAppointmentModal(id);
window.updatePatientSelection = (patientId, selected) => updatePatientSelection(patientId, selected);
window.deleteAppointment = async (id) => {
  if (confirm('Are you sure you want to delete this appointment?')) {
    try {
      const result = await window.electronAPI.deleteAppointment(parseInt(id));
      if (result && result.success) {
        // Clear cache to ensure fresh data is loaded
        clearExpiredCache();
        // Force reload appointments list to show immediate changes
        loadAppointments();
        showSuccess('Appointment deleted successfully');
      } else {
        showError('Error deleting appointment: ' + (result?.error || 'Unknown error'));
      }
    } catch (error) {
      showError('Error deleting appointment: ' + error.message);
    }
  }
};
window.createInvoiceFromAppointment = (id) => createInvoiceFromAppointment(id);
async function viewInvoice(invoiceId) {
  try {
    const invoice = await window.electronAPI.getInvoiceWithDetails(invoiceId);
    showInvoiceDetailsModal(invoice);
  } catch (error) {
    showError('Error loading invoice details: ' + error.message);
  }
}

function showInvoiceDetailsModal(invoice) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'invoice-details-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h3>Invoice ${invoice.invoice_number}</h3>
        <span class="modal-close">&times;</span>
      </div>
      <div class="invoice-details-content" style="padding: 1.5rem;">
        <div class="invoice-header-info" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
          <div>
            <h4>Invoice Information</h4>
            <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
            <p><strong>Date:</strong> ${new Date(invoice.created_at).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span class="status-${invoice.status}">${invoice.status}</span></p>
          </div>
          <div>
            <h4>Patient Information</h4>
            <p><strong>Name:</strong> ${invoice.first_name} ${invoice.last_name}</p>
            <p><strong>Patient ID:</strong> ${invoice.patient_id}</p>
          </div>
        </div>

        <div class="invoice-items-section">
          <h4>Invoice Items</h4>
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.unit_price.toFixed(2)}</td>
                  <td>$${item.total_price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="invoice-totals" style="margin: 2rem 0; text-align: right;">
          <div class="total-row">
            <strong>Subtotal: $${invoice.amount.toFixed(2)}</strong>
          </div>
          <div class="total-row">
            <strong>Tax (15%): $${invoice.tax_amount.toFixed(2)}</strong>
          </div>
          <div class="total-row">
            <strong>Total: $${invoice.total_amount.toFixed(2)}</strong>
          </div>
        </div>

        ${invoice.payments && invoice.payments.length > 0 ? `
          <div class="invoice-payments-section">
            <h4>Payment History</h4>
            <table class="data-table" style="width: 100%;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.payments.map(payment => `
                  <tr>
                    <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                    <td>$${payment.amount.toFixed(2)}</td>
                    <td>${payment.payment_method}</td>
                    <td>${payment.reference_number || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${invoice.notes ? `
          <div class="invoice-notes" style="margin-top: 2rem;">
            <h4>Notes</h4>
            <p>${invoice.notes}</p>
          </div>
        ` : ''}
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal('invoice-details-modal')">Close</button>
        <button type="button" class="btn btn-primary" onclick="window.electronAPI.generateInvoicePDF(${invoice.id})">Download PDF</button>
        <button type="button" class="btn btn-primary" onclick="editInvoice(${invoice.id})">Edit Invoice</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

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

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function editInvoice(invoiceId) {
  try {
    const invoice = await window.electronAPI.getInvoiceWithDetails(invoiceId);
    openEditInvoiceModal(invoice);
  } catch (error) {
    showError('Error loading invoice for editing: ' + error.message);
  }
}

function openEditInvoiceModal(invoice) {
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'edit-invoice-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h3>Edit Invoice ${invoice.invoice_number}</h3>
        <span class="modal-close">&times;</span>
      </div>
      <form id="edit-invoice-form">
        <div class="form-row">
          <div class="form-group">
            <label for="edit-invoice-patient">Patient *</label>
            <select id="edit-invoice-patient" name="patientId" required disabled>
              <option value="">Select Patient</option>
            </select>
          </div>
          <div class="form-group">
            <label for="edit-invoice-due-date">Due Date *</label>
            <input type="date" id="edit-invoice-due-date" name="dueDate" required
                   value="${invoice.due_date.split('T')[0]}">
          </div>
        </div>
        <div class="form-group">
          <label for="edit-invoice-notes">Notes</label>
          <textarea id="edit-invoice-notes" name="notes" rows="2" placeholder="Invoice notes">${invoice.notes || ''}</textarea>
        </div>

        <div class="invoice-items-section">
          <h4>Invoice Items</h4>
          <div id="edit-invoice-items">
            <!-- Items will be populated here -->
          </div>
          <button type="button" id="edit-add-invoice-item" class="btn btn-secondary">Add Item</button>
        </div>

        <div class="invoice-totals">
          <div class="total-row">
            <strong>Subtotal: $<span id="edit-invoice-subtotal">0.00</span></strong>
          </div>
          <div class="total-row">
            <strong>Tax (15%): $<span id="edit-invoice-tax">0.00</span></strong>
          </div>
          <div class="total-row">
            <strong>Total: $<span id="edit-invoice-total">0.00</span></strong>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal('edit-invoice-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Invoice</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Load patients and billing codes
  loadPatientsForEditInvoice(invoice);
  loadBillingCodesForEditInvoice(invoice);

  // Add form submit handler
  modal.querySelector('#edit-invoice-form').addEventListener('submit', (e) => handleEditInvoiceSubmit(e, invoice.id));

  // Add item management
  setupEditInvoiceItemManagement(modal, invoice);

  // Close modal functionality
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function loadPatientsForEditInvoice(invoice) {
  try {
    const patients = await window.electronAPI.getPatients();
    const select = document.getElementById('edit-invoice-patient');

    patients.forEach(patient => {
      const option = document.createElement('option');
      option.value = patient.id;
      option.textContent = `${patient.patient_id} - ${patient.first_name} ${patient.last_name}`;
      if (patient.id === invoice.patient_id) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading patients for edit invoice:', error);
  }
}

async function loadBillingCodesForEditInvoice(invoice) {
  try {
    const billingCodes = await window.electronAPI.getBillingCodes({ active: true });
    const selects = document.querySelectorAll('#edit-invoice-items select[name="billingCodeId"]');

    selects.forEach(select => {
      select.innerHTML = '<option value="">Select Billing Code</option>';
      billingCodes.forEach(code => {
        const option = document.createElement('option');
        option.value = code.id;
        option.textContent = `${code.code} - ${code.description} ($${code.default_price.toFixed(2)})`;
        option.dataset.price = code.default_price;
        option.dataset.taxRate = code.tax_rate;
        select.appendChild(option);
      });
    });
  } catch (error) {
    console.error('Error loading billing codes for edit invoice:', error);
  }
}

function setupEditInvoiceItemManagement(modal, invoice) {
  const itemsContainer = modal.querySelector('#edit-invoice-items');
  const addItemBtn = modal.querySelector('#edit-add-invoice-item');

  // Populate existing items
  invoice.items.forEach(item => {
    const itemHtml = `
      <div class="invoice-item" data-item-id="${item.id || Date.now()}">
        <div class="form-row">
          <div class="form-group">
            <label>Billing Code *</label>
            <select name="billingCodeId" required>
              <option value="">Select Billing Code</option>
            </select>
          </div>
          <div class="form-group">
            <label>Quantity *</label>
            <input type="number" name="quantity" min="1" value="${item.quantity}" required>
          </div>
          <div class="form-group">
            <label>Unit Price *</label>
            <input type="number" name="unitPrice" step="0.01" min="0" value="${item.unit_price}" required>
          </div>
          <div class="form-group">
            <label>Total</label>
            <input type="number" name="totalPrice" step="0.01" value="${item.total_price}" readonly>
          </div>
          <div class="form-group">
            <button type="button" class="btn btn-danger btn-sm remove-item" style="margin-top: 24px;">Remove</button>
          </div>
        </div>
      </div>
    `;

    itemsContainer.insertAdjacentHTML('beforeend', itemHtml);
  });

  // Load billing codes and set selected values
  loadBillingCodesForEditInvoice(invoice).then(() => {
    invoice.items.forEach((item, index) => {
      const itemElement = itemsContainer.children[index];
      if (itemElement) {
        const select = itemElement.querySelector('select[name="billingCodeId"]');
        if (select && item.billing_code_id) {
          select.value = item.billing_code_id;
        }
      }
    });
  });

  addItemBtn.addEventListener('click', () => {
    const itemCount = itemsContainer.children.length + 1;
    const itemHtml = `
      <div class="invoice-item" data-item-id="${Date.now()}">
        <div class="form-row">
          <div class="form-group">
            <label>Billing Code *</label>
            <select name="billingCodeId" required>
              <option value="">Select Billing Code</option>
            </select>
          </div>
          <div class="form-group">
            <label>Quantity *</label>
            <input type="number" name="quantity" min="1" value="1" required>
          </div>
          <div class="form-group">
            <label>Unit Price *</label>
            <input type="number" name="unitPrice" step="0.01" min="0" required>
          </div>
          <div class="form-group">
            <label>Total</label>
            <input type="number" name="totalPrice" step="0.01" readonly>
          </div>
          <div class="form-group">
            <button type="button" class="btn btn-danger btn-sm remove-item" style="margin-top: 24px;">Remove</button>
          </div>
        </div>
      </div>
    `;

    itemsContainer.insertAdjacentHTML('beforeend', itemHtml);

    // Load billing codes for new item
    loadBillingCodesForEditInvoice(invoice);

    // Add event listeners for new item
    const newItem = itemsContainer.lastElementChild;
    setupEditItemEventListeners(newItem);
  });

  // Setup event listeners for existing items
  itemsContainer.querySelectorAll('.invoice-item').forEach(setupEditItemEventListeners);

  function setupEditItemEventListeners(item) {
    const billingCodeSelect = item.querySelector('select[name="billingCodeId"]');
    const quantityInput = item.querySelector('input[name="quantity"]');
    const unitPriceInput = item.querySelector('input[name="unitPrice"]');
    const totalInput = item.querySelector('input[name="totalPrice"]');
    const removeBtn = item.querySelector('.remove-item');

    billingCodeSelect.addEventListener('change', (e) => {
      const selectedOption = e.target.selectedOptions[0];
      if (selectedOption && selectedOption.dataset.price) {
        unitPriceInput.value = selectedOption.dataset.price;
        calculateEditItemTotal(item);
      }
    });

    quantityInput.addEventListener('input', () => calculateEditItemTotal(item));
    unitPriceInput.addEventListener('input', () => calculateEditItemTotal(item));

    removeBtn.addEventListener('click', () => {
      if (itemsContainer.children.length > 1) {
        item.remove();
        calculateEditInvoiceTotals();
      } else {
        showError('Invoice must have at least one item');
      }
    });
  }

  function calculateEditItemTotal(item) {
    const quantity = parseFloat(item.querySelector('input[name="quantity"]').value) || 0;
    const unitPrice = parseFloat(item.querySelector('input[name="unitPrice"]').value) || 0;
    const total = quantity * unitPrice;
    item.querySelector('input[name="totalPrice"]').value = total.toFixed(2);
    calculateEditInvoiceTotals();
  }

  // Calculate initial totals
  calculateEditInvoiceTotals();
}

function calculateEditInvoiceTotals() {
  const items = document.querySelectorAll('#edit-invoice-items .invoice-item');
  let subtotal = 0;

  items.forEach(item => {
    const total = parseFloat(item.querySelector('input[name="totalPrice"]').value) || 0;
    subtotal += total;
  });

  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  document.getElementById('edit-invoice-subtotal').textContent = subtotal.toFixed(2);
  document.getElementById('edit-invoice-tax').textContent = tax.toFixed(2);
  document.getElementById('edit-invoice-total').textContent = total.toFixed(2);
}

async function handleEditInvoiceSubmit(e, invoiceId) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const items = [];

  // Collect invoice items
  document.querySelectorAll('#edit-invoice-items .invoice-item').forEach(item => {
    const billingCodeSelect = item.querySelector('select[name="billingCodeId"]');
    const billingCodeId = billingCodeSelect.value;
    const quantity = parseInt(item.querySelector('input[name="quantity"]').value);
    const unitPrice = parseFloat(item.querySelector('input[name="unitPrice"]').value);
    const totalPrice = parseFloat(item.querySelector('input[name="totalPrice"]').value);

    if (billingCodeId && quantity && unitPrice) {
      const selectedOption = billingCodeSelect.selectedOptions[0];
      const description = selectedOption ? selectedOption.textContent.split(' - ')[1].split(' (')[0] : 'Service';

      items.push({
        billingCodeId: parseInt(billingCodeId),
        description: description,
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice
      });
    }
  });

  if (items.length === 0) {
    showError('Invoice must have at least one item');
    return;
  }

  const invoiceData = {
    patientId: parseInt(formData.get('patientId')),
    amount: parseFloat(document.getElementById('edit-invoice-subtotal').textContent),
    taxAmount: parseFloat(document.getElementById('edit-invoice-tax').textContent),
    totalAmount: parseFloat(document.getElementById('edit-invoice-total').textContent),
    dueDate: formData.get('dueDate'),
    notes: formData.get('notes'),
    items: items
  };

  try {
    await window.electronAPI.updateInvoice(invoiceId, invoiceData);
    showSuccess('Invoice updated successfully');
    closeModal('edit-invoice-modal');
    loadInvoices();
  } catch (error) {
    showError('Error updating invoice: ' + error.message);
  }
}

window.viewInvoice = (id) => viewInvoice(id);
window.editInvoice = (id) => editInvoice(id);
window.editBillingCode = (id) => openBillingCodeModal(id);
window.deleteBillingCode = (id) => showError('Delete billing code not implemented yet');
window.editExpense = (id) => showError('Edit expense not implemented yet');
window.deleteExpense = (id) => showError('Delete expense not implemented yet');
window.editUser = (id) => showError('Edit user not implemented yet');
window.deleteUser = (id) => showError('Delete user not implemented yet');
window.removeFilter = (key) => removeFilter(key);
window.startTour = startTour;
window.nextTourStep = nextTourStep;
window.endTour = endTour;
window.showKeyboardShortcutsHelp = showKeyboardShortcutsHelp;

// Sync settings functions
async function loadSyncSettings() {
  try {
    const credentials = await window.electronAPI.invoke('sync:loadCredentials');
    if (credentials) {
      document.getElementById('db-host').value = credentials.host || '';
      document.getElementById('db-port').value = credentials.port || '5432';
      document.getElementById('db-name').value = credentials.database || '';
      document.getElementById('db-user').value = credentials.user || '';
      document.getElementById('ssl-enabled').checked = credentials.ssl !== false;
    }
  } catch (error) {
    console.error('Failed to load sync settings:', error);
  }
}

async function saveSyncSettings(credentials) {
  try {
    await window.electronAPI.invoke('sync:saveCredentials', credentials);
    showSuccess('Sync settings saved successfully!');
  } catch (error) {
    showError('Failed to save settings: ' + error.message);
  }
}

async function testConnection(credentials) {
  try {
    const result = await window.electronAPI.invoke('sync:testConnection', credentials);
    if (result.success) {
      showSuccess('Connection successful!');
    } else {
      showError('Connection failed: ' + result.error);
    }
  } catch (error) {
    showError('Test failed: ' + error.message);
  }
}

// Initialize sync settings when admin tab is activated
document.addEventListener('DOMContentLoaded', () => {
  // ... existing code ...

  // Add sync settings event listeners
  const syncForm = document.getElementById('sync-form');
  if (syncForm) {
    syncForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const credentials = {
        host: document.getElementById('db-host').value,
        port: parseInt(document.getElementById('db-port').value),
        database: document.getElementById('db-name').value,
        user: document.getElementById('db-user').value,
        password: document.getElementById('db-password').value,
        ssl: document.getElementById('ssl-enabled').checked
      };

      await saveSyncSettings(credentials);
    });

    const testBtn = document.getElementById('test-connection');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const credentials = {
          host: document.getElementById('db-host').value,
          port: parseInt(document.getElementById('db-port').value),
          database: document.getElementById('db-name').value,
          user: document.getElementById('db-user').value,
          password: document.getElementById('db-password').value,
          ssl: document.getElementById('ssl-enabled').checked
        };

        await testConnection(credentials);
      });
    }
  }

  // Load sync settings when admin screen is shown
  const adminTabObserver = new MutationObserver(() => {
    if (document.getElementById('admin-screen').classList.contains('active') &&
        document.getElementById('sync-tab').classList.contains('active')) {
      loadSyncSettings();
    }
  });

  adminTabObserver.observe(document.getElementById('admin-screen'), {
    attributes: true,
    attributeFilter: ['class']
  });
});
