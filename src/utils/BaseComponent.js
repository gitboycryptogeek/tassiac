// src/utils/BaseComponent.js
export class BaseComponent {
  constructor() {
    this.apiService = window.apiService;
    this.authService = window.authService;
    this.router = window.router;
    this.eventListeners = [];
  }

  // Create a DOM element
  createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.keys(attributes).forEach(key => {
      if (key === 'style' && typeof attributes[key] === 'object') {
        // Handle style object
        Object.keys(attributes[key]).forEach(styleKey => {
          element.style[styleKey] = attributes[key][styleKey];
        });
      } else if (key === 'className') {
        // Handle className separately
        element.className = attributes[key];
      } else if (key.startsWith('on') && typeof attributes[key] === 'function') {
        // Handle event listeners
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, attributes[key]);
      } else {
        // Handle all other attributes including data attributes
        element.setAttribute(key, attributes[key]);
      }
    });
    
    // Set text content if provided
    if (textContent) {
      element.textContent = textContent;
    }
    
    return element;
  }

  // Append a child to an element
  appendChild(parent, child) {
    if (!parent || !child) return;
    
    if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(child.toString()));
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      console.warn('Invalid child type:', typeof child, child);
    }
  }

  // Create a card element
  createCard(title, content, footer = null, className = '') {
    const card = this.createElement('div', { className: `card ${className}` });
    
    if (title) {
      const cardHeader = this.createElement('div', { className: 'card-header' });
      const cardTitle = this.createElement('h2', { className: 'card-title' }, title);
      cardHeader.appendChild(cardTitle);
      card.appendChild(cardHeader);
    }
    
    const cardBody = this.createElement('div', { className: 'card-body' });
    
    if (typeof content === 'string') {
      cardBody.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      cardBody.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (item instanceof HTMLElement) {
          cardBody.appendChild(item);
        } else if (typeof item === 'string') {
          cardBody.innerHTML += item;
        }
      });
    }
    
    card.appendChild(cardBody);
    
    if (footer) {
      const cardFooter = this.createElement('div', { className: 'card-footer' });
      
      if (typeof footer === 'string') {
        cardFooter.innerHTML = footer;
      } else if (footer instanceof HTMLElement) {
        cardFooter.appendChild(footer);
      }
      
      card.appendChild(cardFooter);
    }
    
    return card;
  }

  // Create a loading spinner
  createLoadingSpinner(text = 'Loading...') {
    const container = this.createElement('div', { className: 'loading-container' });
    const spinner = this.createElement('div', { className: 'loading-spinner' });
    container.appendChild(spinner);
    
    if (text) {
      const message = this.createElement('span', { className: 'loading-text ml-3' }, text);
      container.appendChild(message);
    }
    
    return container;
  }

  // Create an alert box
  createAlert(message, type = 'info') {
    return this.createElement('div', { className: `alert alert-${type}` }, message);
  }

  // Create a table from data
  createTable(columns, data, options = {}) {
    const { className = '', emptyMessage = 'No data available' } = options;
    
    const tableContainer = this.createElement('div', { className: 'table-container' });
    const table = this.createElement('table', { className: `table ${className}` });
    
    // Create header
    const thead = this.createElement('thead');
    const headerRow = this.createElement('tr');
    
    columns.forEach(column => {
      const th = this.createElement('th', {
        className: column.className || '',
        style: column.style || {}
      }, column.label);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = this.createElement('tbody');
    
    if (!data || data.length === 0) {
      const emptyRow = this.createElement('tr');
      const emptyCell = this.createElement('td', {
        colSpan: columns.length,
        className: 'text-center py-4'
      }, emptyMessage);
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      data.forEach((row, rowIndex) => {
        const tr = this.createElement('tr');
        
        columns.forEach(column => {
          let cellContent;
          
          if (column.render) {
            cellContent = column.render(row, rowIndex);
          } else {
            cellContent = row[column.key] || '';
          }
          
          const td = this.createElement('td', {
            className: column.cellClassName || ''
          }, cellContent);
          
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
    }
    
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    return tableContainer;
  }

  // Create a form group
  createFormGroup(labelText, inputElement, errorMessage = null) {
    const formGroup = this.createElement('div', { className: 'form-group' });
    
    if (labelText) {
      const id = inputElement && inputElement.getAttribute ? inputElement.getAttribute('id') : null;
      const label = this.createElement('label', {
        className: 'form-label',
        for: id
      }, labelText);
      formGroup.appendChild(label);
    }
    
    if (inputElement) {
      formGroup.appendChild(inputElement);
    }
    
    if (errorMessage) {
      const error = this.createElement('div', { className: 'text-error text-sm mt-1' }, errorMessage);
      formGroup.appendChild(error);
    }
    
    return formGroup;
  }

  // Create a button
  createButton(text, onClick, options = {}) {
    const { className = 'btn-primary', type = 'button', disabled = false, icon = null } = options;
    
    const button = this.createElement('button', {
      className: `btn ${className}`,
      type,
      disabled,
      onClick
    });
    
    if (icon) {
      const iconElement = this.createElement('span', { className: `icon icon-${icon} mr-2` });
      button.appendChild(iconElement);
    }
    
    button.appendChild(document.createTextNode(text || ''));
    
    return button;
  }

  // Cleanup method to be called when view is unloaded
  cleanup() {
    // Remove all registered event listeners
    if (this.eventListeners && Array.isArray(this.eventListeners)) {
      this.eventListeners.forEach(({ element, eventName, handler }) => {
        if (element && element.removeEventListener) {
          element.removeEventListener(eventName, handler);
        }
      });
      
      // Clear the event listeners array
      this.eventListeners = [];
    }
  }
  
  // Helper to format currency
  formatCurrency(amount, currency = 'KES') {
    if (typeof window.formatCurrency === 'function') {
      return window.formatCurrency(amount, currency);
    }
    
    // Fallback implementation if window.formatCurrency is not available
    if (typeof amount !== 'number') return `${currency} 0.00`;
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  // Helper to format dates
  formatDate(dateString) {
    if (typeof window.formatDate === 'function') {
      return window.formatDate(dateString);
    }
    
    // Fallback implementation if window.formatDate is not available
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateString;
    }
  }
  
  // Show a toast notification
  showToast(message, type = 'info', duration = 5000) {
    const toast = this.createElement('div', {
      className: `toast toast-${type}`,
      style: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '16px',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        zIndex: '9999',
        backgroundColor: type === 'error' ? '#FFEBEE' : 
                         type === 'success' ? '#E8F5E9' : 
                         type === 'warning' ? '#FFF8E1' : '#E1F5FE',
        color: type === 'error' ? '#B71C1C' : 
               type === 'success' ? '#1B5E20' : 
               type === 'warning' ? '#FF6F00' : '#01579B'
      }
    });
    
    // Create close button
    const closeButton = this.createElement('button', {
      style: {
        position: 'absolute',
        top: '5px',
        right: '5px',
        background: 'none',
        border: 'none',
        fontSize: '16px',
        cursor: 'pointer',
        color: 'inherit'
      },
      onClick: () => {
        if (document.body && document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }
    }, '×');
    
    toast.appendChild(closeButton);
    toast.appendChild(document.createTextNode(message || ''));
    
    if (document.body) {
      document.body.appendChild(toast);
      
      // Auto-remove after duration
      setTimeout(() => {
        if (document.body && document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, duration);
    }
    
    return toast;
  }
}