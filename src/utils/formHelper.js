// src/utils/formHelper.js
export class FormHelper {
    // Format currency
    static formatCurrency(amount, currency = 'KES') {
      return `${currency} ${parseFloat(amount).toFixed(2)}`;
    }
    
    // Format date
    static formatDate(date) {
      if (!date) return '';
      
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      
      return new Date(date).toLocaleDateString('en-US', options);
    }
    
    // Format date and time
    static formatDateTime(date) {
      if (!date) return '';
      
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      return new Date(date).toLocaleDateString('en-US', options);
    }
    
    // Get form data as object
    static getFormData(form) {
      const formData = new FormData(form);
      const data = {};
      
      for (const [key, value] of formData.entries()) {
        // Handle checkboxes
        if (form.elements[key].type === 'checkbox') {
          data[key] = value === 'on';
          continue;
        }
        
        // Handle number inputs
        if (form.elements[key].type === 'number') {
          data[key] = value === '' ? null : Number(value);
          continue;
        }
        
        // Handle empty strings
        data[key] = value === '' ? null : value;
      }
      
      return data;
    }
    
    // Show form errors
    static showErrors(form, errors) {
      // Clear previous errors
      this.clearErrors(form);
      
      if (!errors || !errors.length) return;
      
      // Display errors
      errors.forEach(error => {
        const field = form.elements[error.param];
        
        if (field) {
          // Add error class to field
          field.classList.add('border-red-500');
          
          // Create error message element
          const errorElement = document.createElement('p');
          errorElement.className = 'text-red-500 text-xs mt-1';
          errorElement.textContent = error.msg;
          
          // Insert error message after field
          field.parentNode.insertBefore(errorElement, field.nextSibling);
        }
      });
      
      // Scroll to first error
      if (errors.length > 0 && form.elements[errors[0].param]) {
        form.elements[errors[0].param].focus();
      }
    }
    
    // Clear form errors
    static clearErrors(form) {
      // Remove error classes from fields
      Array.from(form.elements).forEach(element => {
        element.classList.remove('border-red-500');
      });
      
      // Remove error message elements
      const errorElements = form.querySelectorAll('.text-red-500.text-xs');
      errorElements.forEach(element => element.remove());
    }
    
    // Show notification
    static showNotification(message, type = 'success', duration = 5000) {
      // Create notification element
      const notification = document.createElement('div');
      notification.className = `fixed top-4 right-4 p-4 rounded-md shadow-md z-50 transition-all duration-500 transform translate-x-full`;
      
      // Set notification type styles
      if (type === 'success') {
        notification.classList.add('bg-green-500', 'text-white');
      } else if (type === 'error') {
        notification.classList.add('bg-red-500', 'text-white');
      } else if (type === 'warning') {
        notification.classList.add('bg-yellow-500', 'text-white');
      } else {
        notification.classList.add('bg-blue-500', 'text-white');
      }
      
      // Set notification content
      notification.innerHTML = `
        <div class="flex items-center">
          <span class="mr-2">
            ${type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <span>${message}</span>
        </div>
      `;
      
      // Add notification to DOM
      document.body.appendChild(notification);
      
      // Trigger animation
      setTimeout(() => {
        notification.classList.remove('translate-x-full');
      }, 10);
      
      // Remove notification after duration
      setTimeout(() => {
        notification.classList.add('translate-x-full');
        
        // Remove from DOM after animation
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 500);
      }, duration);
    }
    
    // Confirm action
    static confirmAction(message, confirmText = 'Confirm', cancelText = 'Cancel') {
      return new Promise(resolve => {
        // Create modal element
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
        
        // Set modal content
        modal.innerHTML = `
          <div class="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-medium text-gray-900 mb-4">${message}</h3>
            <div class="flex justify-end space-x-3">
              <button type="button" class="btn btn-outline" data-action="cancel">
                ${cancelText}
              </button>
              <button type="button" class="btn btn-primary" data-action="confirm">
                ${confirmText}
              </button>
            </div>
          </div>
        `;
        
        // Add modal to DOM
        document.body.appendChild(modal);
        
        // Add event listeners
        const confirmButton = modal.querySelector('[data-action="confirm"]');
        const cancelButton = modal.querySelector('[data-action="cancel"]');
        
        confirmButton.addEventListener('click', () => {
          document.body.removeChild(modal);
          resolve(true);
        });
        
        cancelButton.addEventListener('click', () => {
          document.body.removeChild(modal);
          resolve(false);
        });
        
        // Allow clicking outside to cancel
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            document.body.removeChild(modal);
            resolve(false);
          }
        });
      });
    }
  }