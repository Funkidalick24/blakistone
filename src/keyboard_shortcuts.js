// Global functions for keyboard shortcuts
window.viewPayment = (id) => {
  if (typeof viewPayment === 'function') {
    viewPayment(id);
  } else {
    console.error('viewPayment function not found');
  }
};
window.editPayment = (id) => {
  if (typeof openPaymentModal === 'function') {
    openPaymentModal(id);
  } else {
    console.error('openPaymentModal function not found');
  }
};
window.deletePayment = (id) => {
  if (typeof deletePayment === 'function') {
    deletePayment(id);
  } else {
    console.error('deletePayment function not found');
  }
};
window.viewExpense = (id) => {
  if (typeof viewExpense === 'function') {
    viewExpense(id);
  } else {
    console.error('viewExpense function not found');
  }
};
window.editExpense = (id) => {
  if (typeof openExpenseModal === 'function') {
    openExpenseModal(id);
  } else {
    console.error('openExpenseModal function not found');
  }
};
window.deleteExpense = (id) => {
  if (typeof deleteExpense === 'function') {
    deleteExpense(id);
  } else {
    console.error('deleteExpense function not found');
  }
};
window.viewUser = (id) => {
  if (typeof viewUser === 'function') {
    viewUser(id);
  } else {
    console.error('viewUser function not found');
  }
};
window.editUser = (id) => {
  if (typeof openUserModal === 'function') {
    openUserModal(id);
  } else {
    console.error('openUserModal function not found');
  }
};
window.deleteUser = (id) => {
  if (typeof deleteUser === 'function') {
    deleteUser(id);
  } else {
    console.error('deleteUser function not found');
  }
};
window.viewAuditLog = (id) => {
  if (typeof viewAuditLog === 'function') {
    viewAuditLog(id);
  } else {
    console.error('viewAuditLog function not found');
  }
};
window.viewPatient = (id) => {
  if (typeof viewPatientDetails === 'function') {
    viewPatientDetails(id);
  } else {
    console.error('viewPatientDetails function not found');
  }
};
window.editPatient = (id) => {
  if (typeof openPatientModal === 'function') {
    openPatientModal(id);
  } else {
    console.error('openPatientModal function not found');
  }
};
window.deletePatient = (id) => {
  if (typeof deletePatient === 'function') {
    deletePatient(id);
  } else {
    console.error('deletePatient function not found');
  }
};
window.viewAppointment = (id) => {
  if (typeof viewAppointment === 'function') {
    viewAppointment(id);
  } else {
    console.error('viewAppointment function not found');
  }
};
window.editAppointment = (id) => {
  if (typeof openAppointmentModal === 'function') {
    openAppointmentModal(id);
  } else {
    console.error('openAppointmentModal function not found');
  }
};
window.deleteAppointment = async (id) => {
  if (typeof deleteAppointment === 'function') {
    try {
      const result = await window.electronAPI.deleteAppointment(id);
      if (result.success) {
        // Clear cache to ensure fresh data is loaded
        clearExpiredCache();
        // Force reload appointments list to show immediate changes
        loadAppointments();
        showSuccess('Appointment deleted successfully');
      } else {
        showError('Error deleting appointment: ' + result.error);
      }
    } catch (error) {
      showError('Error deleting appointment: ' + error.message);
    }
  } else {
    console.error('deleteAppointment function not found');
  }
};
window.showKeyboardShortcutsHelp = () => {
  if (typeof showKeyboardShortcutsHelp === 'function') {
    showKeyboardShortcutsHelp();
  } else {
    console.error('showKeyboardShortcutsHelp function not found');
  }
};