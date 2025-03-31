// src/views/admin/expenses.js
export class AdminExpensesView {
  constructor() {
      this.apiService = window.apiService;
      this.authService = window.authService;
      this.user = this.authService.getUser();
      this.expenses = [];
      this.departments = [
          { id: 'MUSIC', name: 'Music Ministry' },
          { id: 'CHILDREN', name: 'Children\'s Ministry' },
          { id: 'COMMUNICATION', name: 'Communication' },
          { id: 'DEVELOPMENT', name: 'Development' },
          { id: 'EDUCATION', name: 'Education' },
          { id: 'FAMILY', name: 'Family Ministries' },
          { id: 'HEALTH', name: 'Health Ministries' },
          { id: 'MINISTERIAL', name: 'Ministerial Association' },
          { id: 'PLANNED_GIVING', name: 'Planned Giving & Trust Services' },
          { id: 'TREASURY', name: 'Treasury' },
          { id: 'PUBLIC_AFFAIRS', name: 'Public Affairs & Religious Liberty' },
          { id: 'PUBLISHING', name: 'Publishing' },
          { id: 'SABBATH_SCHOOL', name: 'Sabbath School & Personal Ministries' },
          { id: 'WOMEN', name: 'Women\'s Ministries' },
          { id: 'YOUTH', name: 'Youth Ministries' },
          { id: 'OTHER', name: 'Other' }
      ];
      this.totalExpenses = 0;
      this.filterDepartment = '';
      this.filterStartDate = '';
      this.filterEndDate = '';
      this.searchTerm = '';
      this.currentPage = 1;
      this.totalPages = 1;
      this.itemsPerPage = 10;
      this.isLoading = true;
      this.isAddingExpense = false;
      this.error = null;
      this.success = null;
      this.showDepartmentBreakdown = false;
      this.showIncomeVsExpenses = false;
      this.currentViewingExpense = null;
      this.isViewingExpenseDetails = false;
      this.dataLoaded = false;
      this.filtersChanged = false;
      
      // API request queue for throttling
      this.apiRequestQueue = [];
      this.isProcessingQueue = false;
      this.requestThrottleTime = 300; // ms between API calls
      
      // Financial data
      this.chartData = {
          payments: 0,
          expenses: 0
      };
      
      // Register resize event for responsive visualization
      this.resizeListener = this.handleResize.bind(this);
      window.addEventListener('resize', this.resizeListener);
  }
  
  // Clean up event listeners when component is destroyed
  destroy() {
      window.removeEventListener('resize', this.resizeListener);
  }
  
  handleResize() {
      if (this.showDepartmentBreakdown) {
          this.updateDepartmentBars();
      }
  }
  
  // API Request Throttling
  queueApiRequest(requestFunction) {
      return new Promise((resolve, reject) => {
          this.apiRequestQueue.push({
              request: requestFunction,
              resolve,
              reject
          });
          
          if (!this.isProcessingQueue) {
              this.processApiRequestQueue();
          }
      });
  }

  processApiRequestQueue() {
      if (this.apiRequestQueue.length === 0) {
          this.isProcessingQueue = false;
          return;
      }
      
      this.isProcessingQueue = true;
      const { request, resolve, reject } = this.apiRequestQueue.shift();
      
      request()
          .then(result => resolve(result))
          .catch(error => reject(error))
          .finally(() => {
              setTimeout(() => {
                  this.processApiRequestQueue();
              }, this.requestThrottleTime);
          });
  }
  
  async init() {
      const appContainer = document.getElementById('app');
      if (appContainer) {
          appContainer.innerHTML = '';
          const content = await this.render();
          appContainer.appendChild(content);
      }
  }
  
  async render() {
      // Main container
      const container = document.createElement('div');
      
      try {
          // Inject futuristic styles
          this.injectFuturisticStyles();
          
          // Full-page container with dark theme
          container.className = 'expense-full-page';
          
          // App wrapper (replaces Layout)
          const appWrapper = document.createElement('div');
          appWrapper.className = 'neo-app-wrapper';
          
          // Top navigation bar (fixed at top)
          const topNav = this.renderTopNavigation();
          appWrapper.appendChild(topNav);
          
          // Main content area with sidebar and content
          const mainContainer = document.createElement('div');
          mainContainer.className = 'neo-main-container';
          
          // Sidebar
          const sidebar = this.renderSidebar();
          mainContainer.appendChild(sidebar);
          
          // Content area
          const contentArea = document.createElement('div');
          contentArea.className = 'neo-content-area';
          
          // Futuristic header with animated background
          const headerSection = document.createElement('div');
          headerSection.className = 'neo-header';
          
          const headerTitle = document.createElement('h1');
          headerTitle.textContent = 'Expense Management';
          headerTitle.className = 'neo-title';
          
          const addExpenseButton = document.createElement('button');
          addExpenseButton.textContent = '+ Add New Expense';
          addExpenseButton.className = 'neo-button primary';
          
          // Add hover effect glow
          addExpenseButton.addEventListener('mouseenter', (e) => {
              e.target.classList.add('glow');
          });
          
          addExpenseButton.addEventListener('mouseleave', (e) => {
              e.target.classList.remove('glow');
          });
          
          addExpenseButton.addEventListener('click', () => {
              this.isAddingExpense = true;
              this.updateView();
          });
          
          headerSection.appendChild(headerTitle);
          headerSection.appendChild(addExpenseButton);
          contentArea.appendChild(headerSection);
          
          // Error or success messages
          if (this.error) {
              const errorBox = document.createElement('div');
              errorBox.className = 'neo-alert danger';
              errorBox.textContent = this.error;
              contentArea.appendChild(errorBox);
          }
          
          if (this.success) {
              const successBox = document.createElement('div');
              successBox.className = 'neo-alert success';
              successBox.textContent = this.success;
              contentArea.appendChild(successBox);
          }
          
          // Add Expense Form (conditionally displayed)
          if (this.isAddingExpense) {
              const formCard = this.renderAddExpenseForm();
              contentArea.appendChild(formCard);
          }
          
          // Expense Details Modal (conditionally displayed)
          if (this.isViewingExpenseDetails && this.currentViewingExpense) {
              const modalOverlay = this.renderExpenseDetailsModal(this.currentViewingExpense);
              document.body.appendChild(modalOverlay);
          }
          
          // Stats Cards - create only if expenses are loaded
          if (!this.isLoading && !this.isAddingExpense) {
              contentArea.appendChild(this.renderStatsSection());
              
              // Action buttons for visualizations
              const actionButtonsRow = document.createElement('div');
              actionButtonsRow.className = 'neo-actions';
              
              // Department Breakdown button
              const breakdownButton = document.createElement('button');
              breakdownButton.textContent = this.showDepartmentBreakdown 
                  ? 'Hide Department Analysis' 
                  : 'Show Department Analysis';
              breakdownButton.className = `neo-button ${this.showDepartmentBreakdown ? 'active' : 'outline'}`;
              
              breakdownButton.addEventListener('click', () => {
                  this.showDepartmentBreakdown = !this.showDepartmentBreakdown;
                  this.updateView();
              });
              
              // Export Reports button
              const exportReportButton = document.createElement('button');
              exportReportButton.textContent = 'Export Expense Report';
              exportReportButton.className = 'neo-button secondary';
              
              exportReportButton.addEventListener('click', () => {
                  this.exportExpensePdf();
              });
              
              actionButtonsRow.appendChild(breakdownButton);
              actionButtonsRow.appendChild(exportReportButton);
              
              contentArea.appendChild(actionButtonsRow);
              
              // Department Breakdown
              if (this.showDepartmentBreakdown) {
                  contentArea.appendChild(this.renderDepartmentBreakdown());
              }
          }
          
          // Filter section with enhanced search
          contentArea.appendChild(this.renderFilterSection());
          
          // Expenses table
          contentArea.appendChild(this.renderExpensesTable());
          
          mainContainer.appendChild(contentArea);
          appWrapper.appendChild(mainContainer);
          container.appendChild(appWrapper);
          
          // Only fetch data if it's the first load or filters were changed
          if (!this.dataLoaded) {
              this.fetchExpenses();
          }
          
      } catch (error) {
          const errorMessage = document.createElement('div');
          errorMessage.className = 'neo-alert danger';
          errorMessage.textContent = `Error loading page: ${error.message}`;
          container.appendChild(errorMessage);
      }
      
      return container;
  }
  
  renderTopNavigation() {
    const topNav = document.createElement('div');
    topNav.className = 'neo-top-nav';
    
    // Logo area
    const logoArea = document.createElement('div');
    logoArea.className = 'neo-logo';
    logoArea.innerHTML = '<span class="church-logo">⛪</span> TASSIAC CHURCH';
    
    // Center nav links - ONLY INCLUDE REAL PAGES
    const navLinks = document.createElement('div');
    navLinks.className = 'neo-nav-links';
    
    const links = [
        { text: 'Dashboard', link: '/admin/dashboard', icon: '📊' },
        { text: 'Expenses', link: '/admin/expenses', icon: '💸', active: true },
        { text: 'Add Payment', link: '/admin/add-payment', icon: '💳' },
        { text: 'Payments', link: '/admin/payments', icon: '💰' },
        { text: 'Users', link: '/admin/users', icon: '👥' }
    ];
    
    links.forEach(item => {
        const link = document.createElement('a');
        link.href = item.link;
        link.className = `neo-nav-link ${item.active ? 'active' : ''}`;
        link.innerHTML = `<span class="nav-icon">${item.icon}</span> ${item.text}`;
        navLinks.appendChild(link);
    });
    
    // User menu
    const userMenu = document.createElement('div');
    userMenu.className = 'neo-user-menu';
    
    const userAvatar = document.createElement('div');
    userAvatar.className = 'neo-avatar';
    userAvatar.textContent = this.user.fullName ? this.user.fullName.charAt(0) : 'U';
    
    const userName = document.createElement('span');
    userName.className = 'neo-username';
    userName.textContent = this.user.fullName || 'Admin User';
    
    userMenu.appendChild(userAvatar);
    userMenu.appendChild(userName);
    
    // Assemble top nav
    topNav.appendChild(logoArea);
    topNav.appendChild(navLinks);
    topNav.appendChild(userMenu);
    
    return topNav;
}

  
renderSidebar() {
  const sidebar = document.createElement('div');
  sidebar.className = 'neo-sidebar';
  
  // ONLY INCLUDE ACTUAL PAGES THAT EXIST
  const sidebarItems = [
      { text: 'Dashboard', link: '/admin/dashboard', icon: '📊' },
      { text: 'Expense Management', link: '/admin/expenses', icon: '💸', active: true },
      { text: 'Add Payment', link: '/admin/add-payment', icon: '💳' },
      { text: 'Payment Records', link: '/admin/payments', icon: '💰' },
      { text: 'User Management', link: '/admin/users', icon: '👥' }
  ];
  
  const navList = document.createElement('ul');
  navList.className = 'neo-sidebar-nav';
  
  sidebarItems.forEach(item => {
      const navItem = document.createElement('li');
      navItem.className = `neo-sidebar-item ${item.active ? 'active' : ''}`;
      
      const navLink = document.createElement('a');
      navLink.href = item.link;
      navLink.className = 'neo-sidebar-link';
      
      const navIcon = document.createElement('span');
      navIcon.className = 'neo-sidebar-icon';
      navIcon.textContent = item.icon;
      
      const navText = document.createElement('span');
      navText.className = 'neo-sidebar-text';
      navText.textContent = item.text;
      
      navLink.appendChild(navIcon);
      navLink.appendChild(navText);
      navItem.appendChild(navLink);
      navList.appendChild(navItem);
  });
  
  sidebar.appendChild(navList);
  
  const toggleButton = document.createElement('button');
  toggleButton.className = 'neo-sidebar-toggle';
  toggleButton.innerHTML = '◀';
  toggleButton.title = 'Toggle sidebar';
  
  toggleButton.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      toggleButton.innerHTML = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  });
  
  sidebar.appendChild(toggleButton);
  
  return sidebar;
}
  
  renderStatsSection() {
      const statsSection = document.createElement('div');
      statsSection.className = 'stats-section';
      
      const statsGrid = document.createElement('div');
      statsGrid.className = 'neo-grid';
      
      // Create stat cards
      const statCards = [
          {
              title: 'Total Expenses',
              value: `KES ${this.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              icon: 'expenses',
              color: '#ef4444',
              id: 'total-expenses'
          }
      ];
      
      if (this.filterDepartment) {
          const departmentExpenses = this.expenses.reduce((sum, expense) => {
              if (expense.department === this.filterDepartment) {
                  return sum + expense.amount;
              }
              return sum;
          }, 0);
          
          const departmentName = this.departments.find(dept => dept.id === this.filterDepartment)?.name || this.filterDepartment;
          
          statCards.push({
              title: `${departmentName} Expenses`,
              value: `KES ${departmentExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              icon: 'department',
              color: '#0891b2',
              id: 'department-expenses'
          });
      } else {
          // Get department with most expenses
          const departmentTotals = {};
          this.expenses.forEach(expense => {
              if (!departmentTotals[expense.department]) {
                  departmentTotals[expense.department] = 0;
              }
              departmentTotals[expense.department] += expense.amount;
          });
          
          let topDepartment = null;
          let topAmount = 0;
          
          Object.entries(departmentTotals).forEach(([dept, amount]) => {
              if (amount > topAmount) {
                  topDepartment = dept;
                  topAmount = amount;
              }
          });
          
          if (topDepartment) {
              const departmentName = this.departments.find(dept => dept.id === topDepartment)?.name || 'Unknown';
              
              statCards.push({
                  title: `Top Department: ${departmentName}`,
                  value: `KES ${topAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  icon: 'top',
                  color: '#0891b2',
                  id: 'top-department'
              });
          }
      }
      
      // Add this month's expenses
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      
      const thisMonthExpenses = this.expenses.reduce((sum, expense) => {
          const expenseDate = new Date(expense.paymentDate);
          if (expenseDate.getMonth() === thisMonth && expenseDate.getFullYear() === thisYear) {
              return sum + expense.amount;
          }
          return sum;
      }, 0);
      
      statCards.push({
          title: `This Month's Expenses`,
          value: `KES ${thisMonthExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          icon: 'calendar',
          color: '#8b5cf6',
          id: 'month-expenses'
      });
      
      // Render stat cards
      statCards.forEach((card, index) => {
          const statCard = document.createElement('div');
          statCard.id = card.id;
          statCard.className = 'neo-card stat-card';
          statCard.style.animationDelay = `${index * 0.1}s`;
          
          const cardGlow = document.createElement('div');
          cardGlow.className = 'card-glow';
          
          const iconContainer = document.createElement('div');
          iconContainer.className = 'stat-icon';
          iconContainer.style.backgroundColor = `${card.color}20`;
          iconContainer.style.borderColor = `${card.color}40`;
          
          // Add icon with holographic effect
          const icon = document.createElement('span');
          icon.className = `hologram-icon icon-${card.icon}`;
          icon.textContent = this.getIconForCard(card.icon);
          
          iconContainer.appendChild(icon);
          
          const contentContainer = document.createElement('div');
          contentContainer.className = 'stat-content';
          
          const statTitle = document.createElement('p');
          statTitle.className = 'stat-title';
          statTitle.textContent = card.title;
          
          const statValue = document.createElement('h3');
          statValue.className = 'stat-value';
          statValue.textContent = card.value;
          
          contentContainer.appendChild(statTitle);
          contentContainer.appendChild(statValue);
          
          statCard.appendChild(cardGlow);
          statCard.appendChild(iconContainer);
          statCard.appendChild(contentContainer);
          
          statsGrid.appendChild(statCard);
      });
      
      statsSection.appendChild(statsGrid);
      return statsSection;
  }
  
  getIconForCard(iconType) {
      const icons = {
          'expenses': '💸',
          'department': '📊',
          'top': '🏆',
          'calendar': '📅'
      };
      
      return icons[iconType] || '📊';
  }
  
  renderFilterSection() {
      const filterCard = document.createElement('div');
      filterCard.className = 'neo-card filter-card';
      
      const filterHeader = document.createElement('div');
      filterHeader.className = 'card-header';
      
      const filterTitle = document.createElement('h2');
      filterTitle.className = 'card-title';
      filterTitle.textContent = 'Search & Filter Expenses';
      
      filterHeader.appendChild(filterTitle);
      filterCard.appendChild(filterHeader);
      
      const filterContent = document.createElement('div');
      filterContent.className = 'card-body';
      
      const filterForm = document.createElement('form');
      filterForm.id = 'expenseFilterForm';
      filterForm.className = 'filter-form';
      
      // Search input (new)
      const searchGroup = document.createElement('div');
      searchGroup.className = 'form-group form-group-full';
      
      const searchLabel = document.createElement('label');
      searchLabel.textContent = 'Search Expenses';
      searchLabel.className = 'form-label';
      searchLabel.htmlFor = 'filter-search';
      
      const searchInputWrapper = document.createElement('div');
      searchInputWrapper.className = 'search-input-wrapper';
      
      const searchIcon = document.createElement('span');
      searchIcon.className = 'search-icon';
      searchIcon.textContent = '🔍';
      
      const searchInput = document.createElement('input');
      searchInput.id = 'filter-search';
      searchInput.type = 'text';
      searchInput.className = 'neo-input';
      searchInput.placeholder = 'Search by description, amount, or department...';
      searchInput.value = this.searchTerm;
      
      searchInput.addEventListener('input', (e) => {
          this.searchTerm = e.target.value;
          this.filtersChanged = true;
      });
      
      searchInputWrapper.appendChild(searchIcon);
      searchInputWrapper.appendChild(searchInput);
      
      searchGroup.appendChild(searchLabel);
      searchGroup.appendChild(searchInputWrapper);
      
      // Department filter
      const departmentGroup = document.createElement('div');
      departmentGroup.className = 'form-group';
      
      const departmentLabel = document.createElement('label');
      departmentLabel.textContent = 'Department';
      departmentLabel.className = 'form-label';
      departmentLabel.htmlFor = 'filter-department';
      
      const departmentSelect = document.createElement('select');
      departmentSelect.id = 'filter-department';
      departmentSelect.className = 'neo-input';
      
      const allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = 'All Departments';
      departmentSelect.appendChild(allOption);
      
      this.departments.forEach(dept => {
          const option = document.createElement('option');
          option.value = dept.id;
          option.textContent = dept.name;
          if (dept.id === this.filterDepartment) {
              option.selected = true;
          }
          departmentSelect.appendChild(option);
      });
      
      departmentSelect.addEventListener('change', (e) => {
          this.filterDepartment = e.target.value;
          this.currentPage = 1;
          this.filtersChanged = true;
      });
      
      departmentGroup.appendChild(departmentLabel);
      departmentGroup.appendChild(departmentSelect);
      
      // Start date filter
      const startDateGroup = document.createElement('div');
      startDateGroup.className = 'form-group';
      
      const startDateLabel = document.createElement('label');
      startDateLabel.textContent = 'Start Date';
      startDateLabel.className = 'form-label';
      startDateLabel.htmlFor = 'filter-start-date';
      
      const startDateInput = document.createElement('input');
      startDateInput.id = 'filter-start-date';
      startDateInput.type = 'date';
      startDateInput.className = 'neo-input';
      startDateInput.value = this.filterStartDate;
      
      startDateInput.addEventListener('change', (e) => {
          this.filterStartDate = e.target.value;
          this.currentPage = 1;
          this.filtersChanged = true;
      });
      
      startDateGroup.appendChild(startDateLabel);
      startDateGroup.appendChild(startDateInput);
      
      // End date filter
      const endDateGroup = document.createElement('div');
      endDateGroup.className = 'form-group';
      
      const endDateLabel = document.createElement('label');
      endDateLabel.textContent = 'End Date';
      endDateLabel.className = 'form-label';
      endDateLabel.htmlFor = 'filter-end-date';
      
      const endDateInput = document.createElement('input');
      endDateInput.id = 'filter-end-date';
      endDateInput.type = 'date';
      endDateInput.className = 'neo-input';
      endDateInput.value = this.filterEndDate;
      
      endDateInput.addEventListener('change', (e) => {
          this.filterEndDate = e.target.value;
          this.currentPage = 1;
          this.filtersChanged = true;
      });
      
      endDateGroup.appendChild(endDateLabel);
      endDateGroup.appendChild(endDateInput);
      
      // Apply Filters button
      const applyButtonGroup = document.createElement('div');
      applyButtonGroup.className = 'form-buttons';
      
      const applyButton = document.createElement('button');
      applyButton.type = 'button';
      applyButton.textContent = 'Apply Filters';
      applyButton.className = 'neo-button primary';
      
      applyButton.addEventListener('click', () => {
          if (this.filtersChanged) {
              this.applyFilters();
              this.filtersChanged = false;
          }
      });
      
      // Reset Filters button
      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.textContent = 'Reset Filters';
      resetButton.className = 'neo-button outline';
      
      resetButton.addEventListener('click', () => {
          searchInput.value = '';
          departmentSelect.value = '';
          startDateInput.value = '';
          endDateInput.value = '';
          
          if (this.searchTerm || this.filterDepartment || this.filterStartDate || this.filterEndDate) {
              this.searchTerm = '';
              this.filterDepartment = '';
              this.filterStartDate = '';
              this.filterEndDate = '';
              this.currentPage = 1;
              this.applyFilters();
          }
      });
      
      applyButtonGroup.appendChild(applyButton);
      applyButtonGroup.appendChild(resetButton);
      
      // Assemble filter form
      filterForm.appendChild(searchGroup);
      filterForm.appendChild(departmentGroup);
      filterForm.appendChild(startDateGroup);
      filterForm.appendChild(endDateGroup);
      filterForm.appendChild(applyButtonGroup);
      
      // Add submit handler to the form
      filterForm.addEventListener('submit', (e) => {
          e.preventDefault();
          if (this.filtersChanged) {
              this.applyFilters();
              this.filtersChanged = false;
          }
      });
      
      filterContent.appendChild(filterForm);
      filterCard.appendChild(filterContent);
      
      return filterCard;
  }
  
  renderExpensesTable() {
      const tableCard = document.createElement('div');
      tableCard.className = 'neo-card table-card';
      
      const tableHeader = document.createElement('div');
      tableHeader.className = 'card-header';
      
      const tableTitle = document.createElement('h2');
      tableTitle.className = 'card-title';
      tableTitle.textContent = 'Expense Records';
      
      tableHeader.appendChild(tableTitle);
      tableCard.appendChild(tableHeader);
      
      const tableContainer = document.createElement('div');
      tableContainer.className = 'card-body';
      
      if (this.isLoading) {
          const loadingDiv = document.createElement('div');
          loadingDiv.className = 'loading-container';
          
          const spinnerWrapper = document.createElement('div');
          spinnerWrapper.className = 'neo-spinner-wrapper';
          
          const spinner = document.createElement('div');
          spinner.className = 'neo-spinner';
          
          // Create spinner rings
          for (let i = 0; i < 3; i++) {
              const ring = document.createElement('div');
              ring.className = 'spinner-ring';
              spinner.appendChild(ring);
          }
          
          spinnerWrapper.appendChild(spinner);
          loadingDiv.appendChild(spinnerWrapper);
          
          const loadingText = document.createElement('div');
          loadingText.className = 'loading-text';
          loadingText.textContent = 'Loading expenses...';
          loadingDiv.appendChild(loadingText);
          
          tableContainer.appendChild(loadingDiv);
      } else if (this.expenses.length === 0) {
          const emptyState = document.createElement('div');
          emptyState.className = 'empty-state';
          
          const emptyIcon = document.createElement('div');
          emptyIcon.className = 'empty-icon';
          emptyIcon.textContent = '📋';
          
          const emptyTitle = document.createElement('h3');
          emptyTitle.className = 'empty-title';
          emptyTitle.textContent = 'No Expenses Found';
          
          const emptyText = document.createElement('p');
          emptyText.className = 'empty-text';
          emptyText.textContent = 'No expense records match your filters. Try adjusting your search criteria.';
          
          emptyState.appendChild(emptyIcon);
          emptyState.appendChild(emptyTitle);
          emptyState.appendChild(emptyText);
          
          tableContainer.appendChild(emptyState);
      } else {
          // Create expenses table
          const tableWrapper = document.createElement('div');
          tableWrapper.className = 'table-wrapper';
          
          const table = document.createElement('table');
          table.className = 'neo-table';
          
          // Table header
          const thead = document.createElement('thead');
          
          const headerRow = document.createElement('tr');
          
          const headers = ['Date', 'Department', 'Amount', 'Description', 'Added By', 'Actions'];
          
          headers.forEach(headerText => {
              const th = document.createElement('th');
              th.textContent = headerText;
              th.className = headerText === 'Amount' ? 'text-right' : '';
              headerRow.appendChild(th);
          });
          
          thead.appendChild(headerRow);
          table.appendChild(thead);
          
          // Table body
          const tbody = document.createElement('tbody');
          
          // Display expenses for current page
          const startIndex = (this.currentPage - 1) * this.itemsPerPage;
          const endIndex = Math.min(startIndex + this.itemsPerPage, this.expenses.length);
          
          for (let i = startIndex; i < endIndex; i++) {
              const expense = this.expenses[i];
              const row = document.createElement('tr');
              
              // Date cell
              const dateCell = document.createElement('td');
              
              const expenseDate = new Date(expense.paymentDate);
              dateCell.textContent = expenseDate.toLocaleDateString();
              
              // Department cell
              const departmentCell = document.createElement('td');
              
              const departmentName = this.departments.find(dept => dept.id === expense.department)?.name || 'Unknown';
              departmentCell.textContent = departmentName;
              
              // Amount cell
              const amountCell = document.createElement('td');
              amountCell.className = 'expense-amount';
              
              amountCell.textContent = `KES ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              
              // Description cell
              const descriptionCell = document.createElement('td');
              
              // Truncate description if too long
              const maxLength = 30;
              const description = expense.description || 'No description provided';
              descriptionCell.textContent = description.length > maxLength ? 
                  description.substring(0, maxLength) + '...' : 
                  description;
              
              // Added tooltip for long descriptions
              if (description.length > maxLength) {
                  descriptionCell.title = description;
                  descriptionCell.style.cursor = 'help';
              }
              
              // Added By cell
              const addedByCell = document.createElement('td');
              
              const addedBy = expense.AdminUser?.fullName || 
                             (expense.addedBy ? `Admin #${expense.addedBy}` : 'System');
              addedByCell.textContent = addedBy;
              
              // Actions cell
              const actionsCell = document.createElement('td');
              actionsCell.className = 'actions-cell';
              
              const viewButton = document.createElement('button');
              viewButton.textContent = 'View';
              viewButton.className = 'neo-button small primary';
              
              viewButton.addEventListener('click', () => {
                  this.viewExpenseDetails(expense);
              });
              
              const downloadButton = document.createElement('button');
              downloadButton.textContent = 'PDF';
              downloadButton.className = 'neo-button small outline';
              
              downloadButton.addEventListener('click', () => {
                  this.downloadExpensePdf(expense);
              });
              
              actionsCell.appendChild(viewButton);
              actionsCell.appendChild(downloadButton);
              
              // Add cells to row
              row.appendChild(dateCell);
              row.appendChild(departmentCell);
              row.appendChild(amountCell);
              row.appendChild(descriptionCell);
              row.appendChild(addedByCell);
              row.appendChild(actionsCell);
              
              tbody.appendChild(row);
          }
          
          table.appendChild(tbody);
          tableWrapper.appendChild(table);
          tableContainer.appendChild(tableWrapper);
          
          // Pagination controls
          if (this.totalPages > 1) {
              const paginationContainer = document.createElement('div');
              paginationContainer.className = 'neo-pagination';
              
              // Previous page button
              const prevButton = document.createElement('button');
              prevButton.innerHTML = '<span class="icon-arrow">◀</span>';
              prevButton.className = `neo-button icon ${this.currentPage > 1 ? '' : 'disabled'}`;
              prevButton.title = 'Previous page';
              prevButton.disabled = this.currentPage <= 1;
              
              prevButton.addEventListener('click', () => {
                  if (this.currentPage > 1) {
                      this.currentPage--;
                      this.applyFilters();
                  }
              });
              
              // Page indicators with animated dots
              const pageIndicator = document.createElement('div');
              pageIndicator.className = 'page-indicator';
              
              // Only show a range of page dots
              const maxVisibleDots = 7;
              const startDot = Math.max(1, this.currentPage - Math.floor(maxVisibleDots / 2));
              const endDot = Math.min(this.totalPages, startDot + maxVisibleDots - 1);
              
              for (let i = startDot; i <= endDot; i++) {
                  const pageDot = document.createElement('span');
                  pageDot.className = `page-dot ${i === this.currentPage ? 'active' : ''}`;
                  pageDot.textContent = i;
                  
                  pageDot.addEventListener('click', () => {
                      if (i !== this.currentPage) {
                          this.currentPage = i;
                          this.applyFilters();
                      }
                  });
                  
                  pageIndicator.appendChild(pageDot);
              }
              
              // Page counter
              const pageCounter = document.createElement('span');
              pageCounter.className = 'page-counter';
              pageCounter.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
              
              // Next page button
              const nextButton = document.createElement('button');
              nextButton.innerHTML = '<span class="icon-arrow">▶</span>';
              nextButton.className = `neo-button icon ${this.currentPage < this.totalPages ? '' : 'disabled'}`;
              nextButton.title = 'Next page';
              nextButton.disabled = this.currentPage >= this.totalPages;
              
              nextButton.addEventListener('click', () => {
                  if (this.currentPage < this.totalPages) {
                      this.currentPage++;
                      this.applyFilters();
                  }
              });
              
              paginationContainer.appendChild(prevButton);
              paginationContainer.appendChild(pageIndicator);
              paginationContainer.appendChild(pageCounter);
              paginationContainer.appendChild(nextButton);
              
              tableContainer.appendChild(paginationContainer);
          }
      }
      
      tableCard.appendChild(tableContainer);
      return tableCard;
  }
  
  renderDepartmentBreakdown() {
      const breakdownSection = document.createElement('div');
      breakdownSection.className = 'neo-card breakdown-card';
      
      const breakdownHeader = document.createElement('div');
      breakdownHeader.className = 'card-header';
      
      const breakdownTitle = document.createElement('h2');
      breakdownTitle.className = 'card-title';
      breakdownTitle.textContent = 'Department Expense Analysis';
      
      breakdownHeader.appendChild(breakdownTitle);
      breakdownSection.appendChild(breakdownHeader);
      
      const breakdownContent = document.createElement('div');
      breakdownContent.className = 'card-body';
      
      // Calculate department totals
      const departmentTotals = {};
      this.departments.forEach(dept => {
          departmentTotals[dept.id] = 0;
      });
      
      this.expenses.forEach(expense => {
          if (departmentTotals[expense.department] !== undefined) {
              departmentTotals[expense.department] += expense.amount;
          } else {
              departmentTotals[expense.department] = expense.amount;
          }
      });
      
      // Create advanced visualization container
      const visualizationContainer = document.createElement('div');
      visualizationContainer.className = 'visualization-container';
      
      // Filter out departments with no expenses and sort by amount
      const sortedDepartments = Object.entries(departmentTotals)
          .filter(([_, amount]) => amount > 0)
          .sort((a, b) => b[1] - a[1]);
      
      // Create futuristic bar chart with gradient and glow effects
      const barContainer = document.createElement('div');
      barContainer.className = 'neo-bar-chart';
      
      sortedDepartments.forEach(([deptId, amount], index) => {
          const deptName = this.departments.find(dept => dept.id === deptId)?.name || deptId;
          const percentage = Math.round((amount / this.totalExpenses) * 100);
          
          const barItem = document.createElement('div');
          barItem.className = 'bar-item';
          barItem.style.animationDelay = `${index * 0.1}s`;
          
          const barLabel = document.createElement('div');
          barLabel.className = 'bar-label';
          barLabel.textContent = deptName;
          
          const barValueContainer = document.createElement('div');
          barValueContainer.className = 'bar-value-container';
          
          const barTrack = document.createElement('div');
          barTrack.className = 'bar-track';
          
          const barFill = document.createElement('div');
          barFill.className = 'bar-fill';
          barFill.style.width = `${percentage}%`;
          
          // Add gradient based on position (color variety)
          const hue = 220 + (index * 30) % 140;
          barFill.style.background = `linear-gradient(90deg, hsl(${hue}, 80%, 50%), hsl(${hue + 30}, 80%, 60%))`;
          
          // Add pulsing highlight
          const barHighlight = document.createElement('div');
          barHighlight.className = 'bar-highlight';
          barFill.appendChild(barHighlight);
          
          barTrack.appendChild(barFill);
          barValueContainer.appendChild(barTrack);
          
          const barAmount = document.createElement('div');
          barAmount.className = 'bar-amount';
          barAmount.textContent = `KES ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage}%)`;
          
          barItem.appendChild(barLabel);
          barItem.appendChild(barValueContainer);
          barItem.appendChild(barAmount);
          
          barContainer.appendChild(barItem);
      });
      
      visualizationContainer.appendChild(barContainer);
      breakdownContent.appendChild(visualizationContainer);
      
      breakdownSection.appendChild(breakdownContent);
      
      return breakdownSection;
  }
  
  updateDepartmentBars() {
      // If we want to redraw the department bars when the window resizes
      const barContainer = document.querySelector('.neo-bar-chart');
      if (!barContainer) return;
      
      // Update bar widths or animation effects if needed
  }
  
  renderAddExpenseForm() {
      const formCard = document.createElement('div');
      formCard.className = 'neo-card form-card';
      
      const cardHeader = document.createElement('div');
      cardHeader.className = 'card-header with-actions';
      
      const cardTitle = document.createElement('h2');
      cardTitle.className = 'card-title';
      cardTitle.textContent = 'Add New Expense';
      
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '&times;';
      closeButton.className = 'close-button';
      closeButton.title = 'Close form';
      
      closeButton.addEventListener('click', () => {
          this.isAddingExpense = false;
          this.updateView();
      });
      
      cardHeader.appendChild(cardTitle);
      cardHeader.appendChild(closeButton);
      formCard.appendChild(cardHeader);
      
      const cardBody = document.createElement('div');
      cardBody.className = 'card-body';
      
      const form = document.createElement('form');
      form.id = 'addExpenseForm';
      form.className = 'neo-form';
      
      // Department selection (required first)
      const departmentGroup = this.createFormGroup('Department *', 'department', 'select');
      
      const departmentSelect = departmentGroup.querySelector('select');
      departmentSelect.required = true;
      
      departmentSelect.innerHTML = '<option value="">Select department</option>';
      this.departments.forEach(dept => {
          const option = document.createElement('option');
          option.value = dept.id;
          option.textContent = dept.name;
          departmentSelect.appendChild(option);
      });
      
      // Amount
      const amountGroup = this.createFormGroup('Amount *', 'amount', 'number');
      const amountInput = amountGroup.querySelector('input');
      amountInput.required = true;
      amountInput.min = '0.01';
      amountInput.step = '0.01';
      amountInput.placeholder = '0.00';
      
      // Date
      const dateGroup = this.createFormGroup('Date *', 'paymentDate', 'date');
      const dateInput = dateGroup.querySelector('input');
      dateInput.required = true;
      dateInput.valueAsDate = new Date();
      
      // User selection
      const userGroup = this.createFormGroup('Associated User', 'userId', 'select');
      
      const userSelect = userGroup.querySelector('select');
      userSelect.innerHTML = '<option value="">Select a user (optional)</option>';
      
      // Reference Number
      const referenceGroup = this.createFormGroup('Reference Number', 'reference', 'text');
      const referenceInput = referenceGroup.querySelector('input');
      referenceInput.placeholder = 'Optional reference number';
      
      // Description
      const descriptionGroup = this.createFormGroup('Description *', 'description', 'textarea');
      descriptionGroup.classList.add('form-group-full');
      const descriptionTextarea = descriptionGroup.querySelector('textarea');
      descriptionTextarea.required = true;
      descriptionTextarea.placeholder = 'Detailed description of the expense...';
      descriptionTextarea.rows = 4;
      
      // Required fields note
      const requiredNote = document.createElement('div');
      requiredNote.className = 'required-note';
      requiredNote.textContent = '* Required fields';
      
      // Submit and cancel buttons
      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'form-buttons';
      
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = 'Cancel';
      cancelButton.className = 'neo-button outline';
      
      cancelButton.addEventListener('click', () => {
          this.isAddingExpense = false;
          this.updateView();
      });
      
      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.textContent = 'Add Expense';
      submitButton.className = 'neo-button primary';
      
      buttonGroup.appendChild(cancelButton);
      buttonGroup.appendChild(submitButton);
      
      // Add form groups to form
      form.appendChild(departmentGroup);
      form.appendChild(amountGroup);
      form.appendChild(dateGroup);
      form.appendChild(userGroup);
      form.appendChild(referenceGroup);
      form.appendChild(descriptionGroup);
      form.appendChild(requiredNote);
      form.appendChild(buttonGroup);
      
      // Handle form submission
      form.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
      
      // Populate users
      this.fetchUsers().then(users => {
          userSelect.innerHTML = '<option value="">Select a user (optional)</option>';
          users.forEach(user => {
              const option = document.createElement('option');
              option.value = user.id;
              option.textContent = `${user.fullName} (${user.username})`;
              userSelect.appendChild(option);
          });
      });
      
      cardBody.appendChild(form);
      formCard.appendChild(cardBody);
      
      return formCard;
  }
  
  renderExpenseDetailsModal(expense) {
      const modalOverlay = document.createElement('div');
      modalOverlay.className = 'neo-modal-overlay';
      
      const modalContainer = document.createElement('div');
      modalContainer.className = 'neo-modal';
      
      // Modal header
      const modalHeader = document.createElement('div');
      modalHeader.className = 'modal-header';
      
      const modalTitle = document.createElement('h2');
      modalTitle.className = 'modal-title';
      modalTitle.textContent = 'Expense Details';
      
      const closeButton = document.createElement('button');
      closeButton.className = 'close-button';
      closeButton.innerHTML = '&times;';
      
      closeButton.addEventListener('click', () => {
          this.isViewingExpenseDetails = false;
          this.currentViewingExpense = null;
          modalOverlay.remove();
      });
      
      modalHeader.appendChild(modalTitle);
      modalHeader.appendChild(closeButton);
      
      // Modal content
      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';
      
      // Expense ID badge
      const idBadge = document.createElement('div');
      idBadge.className = 'expense-id-badge';
      
      const expenseId = document.createElement('span');
      expenseId.textContent = `Expense ID: ${expense.id || 'N/A'}`;
      
      idBadge.appendChild(expenseId);
      
      // Details grid with glass card design
      const detailsGrid = document.createElement('div');
      detailsGrid.className = 'details-grid';
      
      // Format date
      const expenseDate = expense.paymentDate ? new Date(expense.paymentDate) : null;
      const formattedDate = expenseDate ? expenseDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
      }) : 'No date provided';
      
      // Get department name
      const departmentName = this.departments.find(dept => dept.id === expense.department)?.name || 'Unknown';
      
      // Detail items
      const detailItems = [
          { label: 'Department', value: departmentName, icon: '🏢' },
          { label: 'Amount', value: `KES ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: '💰' },
          { label: 'Date', value: formattedDate, icon: '📅' },
          { label: 'Status', value: expense.status || 'Completed', icon: '✅' },
          { label: 'Reference', value: expense.reference || 'None', icon: '🔖' },
          { label: 'Added By', value: expense.AdminUser?.fullName || `Admin #${expense.addedBy}` || 'System', icon: '👤' },
          { label: 'Created On', value: expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : 'Unknown', icon: '⏱️' },
          { label: 'Last Updated', value: expense.updatedAt ? new Date(expense.updatedAt).toLocaleDateString() : 'Unknown', icon: '🔄' }
      ];
      
      detailItems.forEach(item => {
          const detailItem = document.createElement('div');
          detailItem.className = 'detail-item';
          
          const itemIcon = document.createElement('span');
          itemIcon.className = 'detail-icon';
          itemIcon.textContent = item.icon;
          
          const label = document.createElement('div');
          label.className = 'detail-label';
          label.textContent = item.label;
          
          const value = document.createElement('div');
          value.className = 'detail-value';
          value.textContent = item.value;
          
          detailItem.appendChild(itemIcon);
          detailItem.appendChild(label);
          detailItem.appendChild(value);
          
          detailsGrid.appendChild(detailItem);
      });
      
      // Description section with futuristic terminal look
      const descriptionSection = document.createElement('div');
      descriptionSection.className = 'description-section';
      
      const descriptionLabel = document.createElement('div');
      descriptionLabel.className = 'description-label';
      descriptionLabel.textContent = 'Description';
      
      const descriptionValue = document.createElement('div');
      descriptionValue.className = 'description-terminal';
      descriptionValue.textContent = expense.description || 'No description provided';
      
      // Create a cursor effect for the terminal
      const cursor = document.createElement('span');
      cursor.className = 'terminal-cursor';
      descriptionValue.appendChild(cursor);
      
      descriptionSection.appendChild(descriptionLabel);
      descriptionSection.appendChild(descriptionValue);
      
      // Download buttons section with holographic effect
      const actionsSection = document.createElement('div');
      actionsSection.className = 'modal-actions';
      
      const downloadPdfButton = document.createElement('button');
      downloadPdfButton.className = 'neo-button download';
      downloadPdfButton.innerHTML = '<span class="download-icon">📄</span> Download as PDF';
      
      // Holographic glow effect
      const buttonGlow = document.createElement('div');
      buttonGlow.className = 'button-glow';
      downloadPdfButton.appendChild(buttonGlow);
      
      downloadPdfButton.addEventListener('click', () => {
          this.downloadExpensePdf(expense);
      });
      
      actionsSection.appendChild(downloadPdfButton);
      
      // Assemble modal
      modalContent.appendChild(idBadge);
      modalContent.appendChild(detailsGrid);
      modalContent.appendChild(descriptionSection);
      modalContent.appendChild(actionsSection);
      
      modalContainer.appendChild(modalHeader);
      modalContainer.appendChild(modalContent);
      modalOverlay.appendChild(modalContainer);
      
      // Close on overlay click
      modalOverlay.addEventListener('click', (e) => {
          if (e.target === modalOverlay) {
              this.isViewingExpenseDetails = false;
              this.currentViewingExpense = null;
              modalOverlay.remove();
          }
      });
      
      // Add entrance animation
      setTimeout(() => {
          modalContainer.classList.add('show');
      }, 10);
      
      return modalOverlay;
  }
  
  createFormGroup(label, name, type) {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';
      
      const labelElement = document.createElement('label');
      labelElement.htmlFor = name;
      labelElement.textContent = label;
      labelElement.className = 'form-label';
      
      let inputElement;
      
      if (type === 'textarea') {
          inputElement = document.createElement('textarea');
          inputElement.className = 'neo-input';
      } else if (type === 'select') {
          inputElement = document.createElement('select');
          inputElement.className = 'neo-input';
      } else {
          inputElement = document.createElement('input');
          inputElement.type = type;
          inputElement.className = 'neo-input';
      }
      
      inputElement.id = name;
      inputElement.name = name;
      
      // Add input glow for focus effect
      const inputGlow = document.createElement('div');
      inputGlow.className = 'input-glow';
      
      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'input-wrapper';
      inputWrapper.appendChild(inputElement);
      inputWrapper.appendChild(inputGlow);
      
      formGroup.appendChild(labelElement);
      formGroup.appendChild(inputWrapper);
      
      return formGroup;
  }
  
  async fetchExpenses() {
      try {
          // Show loading indicator 
          this.isLoading = true;
          
          // Build query parameters
          const queryParams = {
              isExpense: true, // CRITICAL: Only fetch actual expenses
              page: this.currentPage,
              limit: this.itemsPerPage,
              sort: 'paymentDate', // Sort by date
              order: 'DESC'        // Newest first
          };
          
          // Add search term if provided
          if (this.searchTerm) {
              queryParams.search = this.searchTerm;
          }
          
          // Add department filter if provided
          if (this.filterDepartment) {
              queryParams.department = this.filterDepartment;
          }
          
          // Add date range filters if provided
          if (this.filterStartDate && this.filterEndDate) {
              queryParams.startDate = this.filterStartDate;
              queryParams.endDate = this.filterEndDate;
          }
          
          // Use the throttled API request
          const response = await this.queueApiRequest(() => 
              this.apiService.get('/payment/all', queryParams)
          );
          
          if (response) {
              // Ensure we filter out any non-expense items (special offerings, etc.)
              this.expenses = (response.payments || []).filter(payment => 
                  payment.isExpense === true && 
                  !payment.paymentType?.startsWith('SPECIAL_')
              );
              
              this.totalPages = response.totalPages || 1;
              
              // Calculate total expenses
              if (this.expenses && this.expenses.length > 0) {
                  this.totalExpenses = this.expenses
                      .filter(expense => expense.status === 'COMPLETED')
                      .reduce((sum, expense) => sum + expense.amount, 0);
              } else {
                  this.totalExpenses = 0;
              }
              
              // Also fetch payment stats for charts
              await this.fetchPaymentStats();
          }
      } catch (error) {
          this.error = 'Failed to load expenses. Please try again.';
      } finally {
          this.isLoading = false;
          this.dataLoaded = true;
          this.updateView();
      }
  }
  
  async fetchPaymentStats() {
      try {
          // Use the throttled API request
          const response = await this.queueApiRequest(() => 
              this.apiService.getPaymentStats()
          );
          
          if (response && response.success) {
              // Update chart data
              this.chartData = {
                  payments: response.data.revenue || 0,
                  expenses: response.data.expenses || 0
              };
          }
      } catch (error) {
          // Handle error silently
          this.chartData = {
              payments: this.totalExpenses * 1.5, // Placeholder
              expenses: this.totalExpenses
          };
      }
  }
  
  async fetchUsers() {
      try {
          // Use the throttled API request
          const response = await this.queueApiRequest(() => 
              this.apiService.get('/auth/users')
          );
          return response.users || [];
      } catch (error) {
          return [];
      }
  }
  
  async handleExpenseSubmit(e) {
      e.preventDefault();
      
      const form = e.target;
      const formData = new FormData(form);
      
      // Validate amount
      const amount = parseFloat(formData.get('amount'));
      if (isNaN(amount) || amount <= 0) {
          this.error = 'Please enter a valid amount greater than zero.';
          this.updateView();
          return;
      }
      
      // Validate date
      const paymentDate = formData.get('paymentDate');
      if (!paymentDate) {
          this.error = 'Please select a valid date.';
          this.updateView();
          return;
      }
      
      // Validate department
      const department = formData.get('department');
      if (!department) {
          this.error = 'Please select a department.';
          this.updateView();
          return;
      }
      
      // Validate description
      const description = formData.get('description');
      if (!description || description.trim().length === 0) {
          this.error = 'Please enter a description for the expense.';
          this.updateView();
          return;
      }
      
      // Create expense data
      const expenseData = {
          userId: formData.get('userId') || this.user.id,
          amount: amount,
          department: department,
          description: description,
          paymentDate: paymentDate,
          reference: formData.get('reference') || null,
          paymentType: 'EXPENSE', // Explicitly mark as EXPENSE type
          isExpense: true,        // Explicitly set isExpense flag
          status: 'COMPLETED'
      };
      
      try {
          // Show loading indicator
          const submitButton = form.querySelector('button[type="submit"]');
          const originalText = submitButton.textContent;
          submitButton.disabled = true;
          submitButton.textContent = 'Saving...';
          
          // Send to API using the throttled request
          const response = await this.queueApiRequest(() => 
              this.apiService.post('/payment/manual', expenseData)
          );
          
          if (response && response.payment) {
              this.success = 'Expense added successfully!';
              this.isAddingExpense = false;
              
              // Refresh the expenses list
              this.isLoading = true;
              this.fetchExpenses();
          } else {
              this.error = 'Failed to add expense. Please try again.';
              submitButton.disabled = false;
              submitButton.textContent = originalText;
              this.updateView();
          }
      } catch (error) {
          this.error = error.response?.data?.message || 'Failed to add expense. Please try again.';
          
          // Re-enable submit button
          const submitButton = form.querySelector('button[type="submit"]');
          submitButton.disabled = false;
          submitButton.textContent = 'Add Expense';
          
          this.updateView();
      }
  }
  
  viewExpenseDetails(expense) {
      this.currentViewingExpense = expense;
      this.isViewingExpenseDetails = true;
      this.updateView();
  }
  
  downloadExpensePdf(expense) {
      // Create actual PDF using a template
      this.generatePdf(expense);
  }
  
  generatePdf(expense) {
      // Use jspdf library to create a PDF
      const { jsPDF } = window.jspdf;
      if (!jsPDF) {
          // If jsPDF isn't available, load it dynamically
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => {
              // Retry after script loads
              this.generatePdf(expense);
          };
          document.head.appendChild(script);
          return;
      }
      
      // Create PDF document
      const doc = new jsPDF();
      
      // Get department name
      const departmentName = this.departments.find(dept => dept.id === expense.department)?.name || 'Unknown Department';
      
      // Format date
      const expenseDate = expense.paymentDate ? new Date(expense.paymentDate) : new Date();
      const formattedDate = expenseDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
      });
      
      // Add title
      doc.setFontSize(20);
      doc.setTextColor(0, 51, 102);
      doc.text('EXPENSE RECEIPT', 105, 20, { align: 'center' });
      
      // Add church name
      doc.setFontSize(16);
      doc.text('TASSIAC CHURCH', 105, 30, { align: 'center' });
      
      // Add horizontal line
      doc.setDrawColor(0, 51, 102);
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      // Add receipt ID and date
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Receipt ID: EXP-${expense.id || new Date().getTime()}`, 20, 45);
      doc.text(`Date: ${formattedDate}`, 190, 45, { align: 'right' });
      
      // Add expense details
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      
      // Details table
      const startY = 60;
      const lineHeight = 7;
      let currentY = startY;
      
      // Header
      doc.setFillColor(240, 240, 240);
      doc.rect(20, currentY, 170, lineHeight, 'F');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('EXPENSE DETAILS', 105, currentY + 5, { align: 'center' });
      currentY += lineHeight + 3;
      
      // Fields
      const fields = [
          { label: 'Department:', value: departmentName },
          { label: 'Amount:', value: `KES ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Payment Type:', value: 'EXPENSE' },
          { label: 'Reference:', value: expense.reference || 'N/A' },
          { label: 'Status:', value: expense.status || 'Completed' },
          { label: 'Added By:', value: expense.AdminUser?.fullName || `Admin #${expense.addedBy}` || 'System' }
      ];
      
      doc.setFontSize(10);
      
      fields.forEach(field => {
          doc.setTextColor(100, 100, 100);
          doc.text(field.label, 25, currentY);
          doc.setTextColor(0, 0, 0);
          doc.text(field.value, 70, currentY);
          currentY += 7;
      });
      
      // Description
      currentY += 5;
      doc.setFillColor(240, 240, 240);
      doc.rect(20, currentY, 170, lineHeight, 'F');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('DESCRIPTION', 105, currentY + 5, { align: 'center' });
      currentY += lineHeight + 3;
      
      // Format description text to fit in the PDF
      const description = expense.description || 'No description provided';
      const textLines = doc.splitTextToSize(description, 160);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      textLines.forEach(line => {
          doc.text(line, 25, currentY);
          currentY += 6;
      });
      
      // Add footer
      currentY = 270;
      doc.setDrawColor(0, 51, 102);
      doc.setLineWidth(0.3);
      doc.line(20, currentY, 80, currentY);
      doc.setFontSize(9);
      doc.text('Authorized Signature', 50, currentY + 5, { align: 'center' });
      
      // Add generation note
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });
      
      // Save PDF
      const filename = `Expense_${expense.id}_${departmentName.replace(/\s+/g, '_')}.pdf`;
      doc.save(filename);
      
      // Show success notification
      this.showNotification('Expense PDF downloaded successfully');
  }
  
  exportExpensePdf() {
      // Use jspdf library to create a PDF
      const { jsPDF } = window.jspdf;
      if (!jsPDF) {
          // If jsPDF isn't available, load it dynamically
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => {
              // Retry after script loads
              this.exportExpensePdf();
          };
          document.head.appendChild(script);
          return;
      }
      
      // Create PDF document
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.setTextColor(0, 51, 102);
      doc.text('EXPENSE REPORT', 105, 20, { align: 'center' });
      
      // Add church name
      doc.setFontSize(16);
      doc.text('TASSIAC CHURCH', 105, 30, { align: 'center' });
      
      // Add horizontal line
      doc.setDrawColor(0, 51, 102);
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      // Add report details
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 45);
      
      // Add filter info if applied
      let filterText = '';
      if (this.filterDepartment) {
          const deptName = this.departments.find(d => d.id === this.filterDepartment)?.name || this.filterDepartment;
          filterText += `Department: ${deptName}, `;
      }
      
      if (this.filterStartDate && this.filterEndDate) {
          filterText += `Date Range: ${this.filterStartDate} to ${this.filterEndDate}, `;
      }
      
      if (this.searchTerm) {
          filterText += `Search: "${this.searchTerm}", `;
      }
      
      if (filterText) {
          filterText = `Filters: ${filterText.slice(0, -2)}`;
          doc.text(filterText, 20, 52);
      }
      
      // Add summary
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Summary:', 20, 62);
      doc.setFontSize(10);
      doc.text(`Total Expenses: KES ${this.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 25, 70);
      doc.text(`Total Records: ${this.expenses.length}`, 25, 77);
      
      // Draw table
      const startY = 90;
      const lineHeight = 10;
      let currentY = startY;
      
      // Table headers
      const headers = ['Date', 'Department', 'Amount (KES)', 'Description'];
      const colWidths = [30, 50, 30, 60];
      const startX = 20;
      
      // Draw header cells
      doc.setFillColor(240, 240, 240);
      doc.rect(startX, currentY, 170, lineHeight, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      
      let currentX = startX + 5;
      headers.forEach((header, i) => {
          doc.text(header, currentX, currentY + 7);
          currentX += colWidths[i];
      });
      
      currentY += lineHeight;
      doc.setFont(undefined, 'normal');
      
      // Table rows (max 20 for this report)
      const maxRows = Math.min(20, this.expenses.length);
      for (let i = 0; i < maxRows; i++) {
          const expense = this.expenses[i];
          
          // Check for page overflow
          if (currentY > 270) {
              doc.addPage();
              currentY = 20;
              
              // Add column headers on new page
              doc.setFillColor(240, 240, 240);
              doc.rect(startX, currentY, 170, lineHeight, 'F');
              
              doc.setFont(undefined, 'bold');
              currentX = startX + 5;
              headers.forEach((header, i) => {
                  doc.text(header, currentX, currentY + 7);
                  currentX += colWidths[i];
              });
              
              currentY += lineHeight;
              doc.setFont(undefined, 'normal');
          }
          
          // Date
          const expenseDate = new Date(expense.paymentDate).toLocaleDateString();
          doc.text(expenseDate, startX + 5, currentY + 7);
          
          // Department
          const departmentName = this.departments.find(dept => dept.id === expense.department)?.name || 'Unknown';
          doc.text(departmentName, startX + 35, currentY + 7);
          
          // Amount
          const amount = expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          doc.text(amount, startX + 85, currentY + 7);
          
          // Description (truncated)
          const description = expense.description || '';
          const truncatedDesc = description.length > 30 ? description.substring(0, 27) + '...' : description;
          doc.text(truncatedDesc, startX + 115, currentY + 7);
          
          // Draw row border
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.1);
          doc.line(startX, currentY, startX + 170, currentY);
          
          currentY += lineHeight;
      }
      
      // Draw final line
      doc.line(startX, currentY, startX + 170, currentY);
      
      // Add note if results were limited
      if (this.expenses.length > maxRows) {
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text(`Note: This report shows only ${maxRows} of ${this.expenses.length} total records.`, 105, currentY + 10, { align: 'center' });
      }
      
      // Add footer
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('TASSIAC Church Financial System - Expense Report', 105, 285, { align: 'center' });
      
      // Save PDF
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `Expenses_Report_${timestamp}.pdf`;
      doc.save(filename);
      
      // Show success notification
      this.showNotification('Expense report exported successfully');
  }
  
  showNotification(message, type = 'success') {
      const notification = document.createElement('div');
      notification.className = `neo-notification ${type}`;
      
      const notificationContent = document.createElement('div');
      notificationContent.className = 'notification-content';
      
      const notificationIcon = document.createElement('span');
      notificationIcon.className = 'notification-icon';
      notificationIcon.textContent = type === 'success' ? '✓' : '!';
      
      const notificationMessage = document.createElement('span');
      notificationMessage.className = 'notification-message';
      notificationMessage.textContent = message;
      
      notificationContent.appendChild(notificationIcon);
      notificationContent.appendChild(notificationMessage);
      
      // Add glowing border effect
      const notificationGlow = document.createElement('div');
      notificationGlow.className = 'notification-glow';
      
      notification.appendChild(notificationContent);
      notification.appendChild(notificationGlow);
      
      // Add notification to the DOM
      document.body.appendChild(notification);
      
      // Show with animation
      setTimeout(() => {
          notification.classList.add('show');
      }, 10);
      
      // Remove the notification after 3 seconds
      setTimeout(() => {
          notification.classList.remove('show');
          notification.classList.add('hide');
          
          setTimeout(() => {
              if (notification.parentNode) {
                  document.body.removeChild(notification);
              }
          }, 500);
      }, 3000);
  }
  
  applyFilters() {
      this.isLoading = true;
      this.fetchExpenses();
  }
  
  updateView() {
      const appContainer = document.getElementById('app');
      if (appContainer) {
          appContainer.innerHTML = '';
          this.render().then(content => {
              appContainer.appendChild(content);
          });
      }
  }
  
  injectFuturisticStyles() {
      if (document.getElementById('neo-expenses-styles')) return;
      
      const styleElement = document.createElement('style');
      styleElement.id = 'neo-expenses-styles';
      styleElement.textContent = `
          /* Complete dark theme for full page */
          .expense-full-page {
              background-color: #0f172a;
              color: #e2e8f0;
              margin: 0;
              padding: 0;
              min-height: 100vh;
              font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
              line-height: 1.5;
              position: relative;
              width: 100%;
              overflow-x: hidden;
          }
          
          /* Reset all margin/padding to ensure full dark theme */
          body, html {
              margin: 0;
              padding: 0;
              background-color: #0f172a;
              min-height: 100vh;
              overflow-x: hidden;
          }
          
          /* App layout */
          .neo-app-wrapper {
              display: flex;
              flex-direction: column;
              min-height: 100vh;
              background-color: #0f172a;
              position: relative;
          }
          
          .neo-app-wrapper:before {
              content: "";
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: 
                  radial-gradient(circle at 20% 30%, rgba(79, 70, 229, 0.15), transparent 40%),
                  radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.1), transparent 40%);
              z-index: -1;
          }
          
          .neo-app-wrapper:after {
              content: "";
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: 
                  linear-gradient(to right, transparent 99%, rgba(79, 70, 229, 0.1) 100%),
                  linear-gradient(to bottom, transparent 99%, rgba(79, 70, 229, 0.1) 100%);
              background-size: 40px 40px;
              z-index: -1;
              opacity: 0.3;
              pointer-events: none;
          }
          
          /* Top navigation */
          .neo-top-nav {
              background: rgba(15, 23, 42, 0.95);
              backdrop-filter: blur(10px);
              height: 60px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0 2rem;
              border-bottom: 1px solid rgba(55, 65, 81, 0.5);
              position: sticky;
              top: 0;
              z-index: 100;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          }
          
          .neo-logo {
              font-size: 1.25rem;
              font-weight: 700;
              color: #f8fafc;
              display: flex;
              align-items: center;
          }
          
          .church-logo {
              margin-right: 0.75rem;
              font-size: 1.5rem;
          }
          
          .neo-nav-links {
              display: flex;
              gap: 1rem;
          }
          
          .neo-nav-link {
              color: #94a3b8;
              text-decoration: none;
              padding: 0.5rem 1rem;
              border-radius: 8px;
              transition: all 0.3s ease;
              display: flex;
              align-items: center;
              font-weight: 500;
          }
          
          .neo-nav-link:hover {
              color: #f8fafc;
              background: rgba(55, 65, 81, 0.5);
          }
          
          .neo-nav-link.active {
              color: #f8fafc;
              background: rgba(79, 70, 229, 0.2);
              box-shadow: 0 0 10px rgba(79, 70, 229, 0.5);
          }
          
          .nav-icon {
              margin-right: 0.5rem;
          }
          
          .neo-user-menu {
              display: flex;
              align-items: center;
              gap: 0.75rem;
          }
          
          .neo-avatar {
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background: linear-gradient(135deg, #4f46e5, #8b5cf6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #f8fafc;
              font-weight: 700;
              box-shadow: 0 0 10px rgba(79, 70, 229, 0.5);
          }
          
          .neo-username {
              color: #f8fafc;
              font-weight: 500;
          }
          
          /* Main container with sidebar and content */
          .neo-main-container {
              display: flex;
              flex: 1;
              position: relative;
          }
          
          /* Sidebar */
          .neo-sidebar {
              width: 240px;
              background: rgba(15, 23, 42, 0.9);
              backdrop-filter: blur(10px);
              padding: 2rem 0;
              border-right: 1px solid rgba(55, 65, 81, 0.5);
              height: calc(100vh - 60px);
              position: sticky;
              top: 60px;
              transition: all 0.3s ease;
              box-shadow: 4px 0 15px rgba(0, 0, 0, 0.2);
              z-index: 10;
          }
          
          .neo-sidebar.collapsed {
              width: 60px;
          }
          
          .neo-sidebar-nav {
              list-style: none;
              padding: 0;
              margin: 0;
          }
          
          .neo-sidebar-item {
              margin: 0.25rem 0;
          }
          
          .neo-sidebar-link {
              display: flex;
              align-items: center;
              color: #94a3b8;
              text-decoration: none;
              padding: 0.75rem 1.5rem;
              transition: all 0.3s ease;
          }
          
          .neo-sidebar-link:hover {
              color: #f8fafc;
              background: rgba(55, 65, 81, 0.5);
          }
          
          .neo-sidebar-item.active .neo-sidebar-link {
              color: #f8fafc;
              background: rgba(79, 70, 229, 0.2);
              border-left: 3px solid #4f46e5;
              box-shadow: 0 0 10px rgba(79, 70, 229, 0.3);
          }
          
          .neo-sidebar-icon {
              margin-right: 1rem;
              font-size: 1.25rem;
              transition: margin 0.3s ease;
          }
          
          .collapsed .neo-sidebar-text {
              display: none;
          }
          
          .collapsed .neo-sidebar-icon {
              margin-right: 0;
          }
          
          .collapsed .neo-sidebar-link {
              justify-content: center;
          }
          
          .neo-sidebar-toggle {
              position: absolute;
              bottom: 1rem;
              right: -12px;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: #4f46e5;
              color: #f8fafc;
              border: none;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              font-size: 12px;
              box-shadow: 0 0 10px rgba(79, 70, 229, 0.5);
              z-index: 20;
              transition: all 0.3s ease;
          }
          
          .neo-sidebar-toggle:hover {
              transform: scale(1.1);
          }
          
          /* Content area */
          .neo-content-area {
              flex: 1;
              padding: 2rem;
              overflow-x: hidden;
          }
          
          /* Base styles from original template */
          :root {
              --primary-color: #4f46e5;
              --primary-light: #6366f1;
              --primary-dark: #4338ca;
              --primary-glow: rgba(79, 70, 229, 0.5);
              --secondary-color: #3730a3;
              --secondary-glow: rgba(55, 48, 163, 0.5);
              --accent-color: #8b5cf6;
              --success-color: #10b981;
              --danger-color: #ef4444;
              --warning-color: #f59e0b;
              --bg-dark: #0f172a;
              --bg-medium: #1e293b;
              --bg-light: #334155;
              --text-bright: #f8fafc;
              --text-light: #e2e8f0;
              --text-muted: #94a3b8;
              --border-color: rgba(148, 163, 184, 0.2);
              --card-bg: rgba(15, 23, 42, 0.6);
              --card-bg-hover: rgba(30, 41, 59, 0.8);
              --glass-bg: rgba(30, 41, 59, 0.4);
              --glass-border: rgba(255, 255, 255, 0.1);
              --glass-shine: rgba(255, 255, 255, 0.05);
              --glass-shadow: rgba(0, 0, 0, 0.25);
              --shadow-glow: 0 0 20px var(--primary-glow);
              --input-bg: rgba(15, 23, 42, 0.7);
          }
          
          /* Neo Headers */
          .neo-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 2rem;
              padding: 1rem 0;
              flex-wrap: wrap;
              gap: 1rem;
              position: relative;
          }
          
          .neo-title {
              font-size: 2rem;
              font-weight: 700;
              margin: 0;
              background: linear-gradient(to right, var(--text-bright), var(--text-light));
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              text-shadow: 0 0 15px var(--primary-glow);
          }
          
          /* Neo Buttons */
          .neo-button {
              background: linear-gradient(135deg, rgba(79, 70, 229, 0.9), rgba(79, 70, 229, 0.7));
              color: var(--text-bright);
              border: none;
              border-radius: 8px;
              padding: 0.75rem 1.5rem;
              font-size: 0.9rem;
              font-weight: 500;
              cursor: pointer;
              position: relative;
              overflow: hidden;
              transition: all 0.3s ease;
              box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2),
                          inset 0 1px 0 rgba(255, 255, 255, 0.15);
              backdrop-filter: blur(5px);
              z-index: 1;
          }
          
          .neo-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3),
                          0 0 10px var(--primary-glow),
                          inset 0 1px 0 rgba(255, 255, 255, 0.2);
          }
          
          .neo-button:active {
              transform: translateY(1px);
          }
          
          .neo-button:before {
              content: "";
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
              transition: left 0.7s ease;
          }
          
          .neo-button:hover:before {
              left: 100%;
          }
          
          .neo-button.glow {
              box-shadow: 0 0 15px var(--primary-glow),
                          0 0 30px var(--primary-glow),
                          inset 0 1px 0 rgba(255, 255, 255, 0.2);
          }
          
          .neo-button.primary {
              background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
          }
          
          .neo-button.secondary {
              background: linear-gradient(135deg, var(--secondary-color), var(--primary-dark));
          }
          
          .neo-button.outline {
              background: transparent;
              border: 1px solid var(--primary-color);
              color: var(--primary-light);
              box-shadow: none;
          }
          
          .neo-button.outline:hover {
              background: rgba(79, 70, 229, 0.1);
              box-shadow: 0 0 10px var(--primary-glow);
          }
          
          .neo-button.active {
              background: var(--primary-color);
              color: var(--text-bright);
              box-shadow: 0 0 15px var(--primary-glow),
                          inset 0 0 5px rgba(255, 255, 255, 0.2);
          }
          
          .neo-button.small {
              padding: 0.5rem 1rem;
              font-size: 0.8rem;
          }
          
          .neo-button.icon {
              width: 40px;
              height: 40px;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
          }
          
          // Continuation of the injectFuturisticStyles method
            .neo-button.disabled {
                opacity: 0.5;
                cursor: not-allowed;
                pointer-events: none;
            }
            
            .neo-button.download {
                background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
                position: relative;
                overflow: hidden;
            }
            
            .button-glow {
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(ellipse at center, rgba(255,255,255,0.3) 0%, transparent 60%);
                transform: rotate(20deg);
                animation: rotateGlow 3s infinite linear;
                pointer-events: none;
            }
            
            /* Enhanced actions cell styling */
            .actions-cell {
                display: flex;
                gap: 0.5rem;
                justify-content: flex-start;
            }
            
            /* Neo Cards */
            .neo-card {
                background: var(--card-bg);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                border: 1px solid var(--glass-border);
                box-shadow: 0 10px 25px var(--glass-shadow);
                overflow: hidden;
                position: relative;
                margin-bottom: 2rem;
                transform: translateZ(0);
                transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            }
            
            .neo-card:hover {
                background: var(--card-bg-hover);
                transform: translateY(-5px);
                box-shadow: 0 15px 35px var(--glass-shadow),
                            0 0 10px var(--primary-glow);
            }
            
            .neo-card:before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, 
                    transparent, 
                    var(--glass-shine), 
                    transparent);
            }
            
            .card-glow {
                position: absolute;
                top: -100px;
                left: -100px;
                width: 200px;
                height: 200px;
                background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
                border-radius: 50%;
                opacity: 0.2;
                transition: all 0.5s ease;
                pointer-events: none;
                z-index: -1;
            }
            
            .neo-card:hover .card-glow {
                opacity: 0.5;
            }
            
            .card-header {
                padding: 1.25rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
            }
            
            .card-header:before {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                bottom: -1px;
                height: 1px;
                background: linear-gradient(90deg, transparent, var(--primary-light), transparent);
            }
            
            .card-header.with-actions {
                justify-content: space-between;
            }
            
            .card-title {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--text-bright);
                position: relative;
                z-index: 1;
            }
            
            .card-body {
                padding: 1.5rem;
                position: relative;
                z-index: 1;
            }
            
            /* Stat Cards */
            .stats-section {
                margin-bottom: 2rem;
            }
            
            .neo-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 1.5rem;
            }
            
            .stat-card {
                padding: 1.5rem;
                display: flex;
                align-items: center;
                animation: fadeInUp 0.5s ease forwards;
                opacity: 0;
            }
            
            .stat-icon {
                width: 60px;
                height: 60px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 1rem;
                font-size: 1.75rem;
                flex-shrink: 0;
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                box-shadow: 0 5px 15px var(--glass-shadow);
                position: relative;
                overflow: hidden;
            }
            
            .hologram-icon {
                animation: pulse 2s infinite ease-in-out;
                position: relative;
            }
            
            .hologram-icon:before {
                content: "";
                position: absolute;
                top: -10px;
                left: -10px;
                right: -10px;
                bottom: -10px;
                border-radius: 50%;
                border: 1px solid rgba(255, 255, 255, 0.2);
                animation: ripple 2s infinite cubic-bezier(0.65, 0, 0.35, 1);
                opacity: 0;
            }
            
            .stat-content {
                flex: 1;
            }
            
            .stat-title {
                font-size: 0.9rem;
                color: var(--text-muted);
                margin: 0 0 0.5rem;
            }
            
            .stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-bright);
                margin: 0;
                text-shadow: 0 0 5px var(--primary-glow);
            }
            
            /* Search input styling */
            .search-input-wrapper {
                position: relative;
                display: flex;
                align-items: center;
            }
            
            .search-icon {
                position: absolute;
                left: 1rem;
                color: var(--text-muted);
                font-size: 0.9rem;
                pointer-events: none;
            }
            
            input[type="text"].neo-input {
                padding-left: 2.5rem;
            }
            
            /* Action Buttons */
            .neo-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 1rem;
                margin-bottom: 2rem;
            }
            
            .modal-actions {
                margin-top: 2rem;
                display: flex;
                justify-content: center;
            }
            
            /* Department Breakdown */
            .breakdown-card {
                overflow: hidden;
                animation: fadeInUp 0.6s ease forwards;
            }
            
            .visualization-container {
                min-height: 300px;
            }
            
            .neo-bar-chart {
                display: flex;
                flex-direction: column;
                gap: 1.25rem;
                padding: 1rem 0;
            }
            
            .bar-item {
                display: grid;
                grid-template-columns: 200px 1fr auto;
                align-items: center;
                gap: 1.25rem;
                animation: fadeInLeft 0.5s ease forwards;
                opacity: 0;
            }
            
            .bar-label {
                font-size: 0.9rem;
                color: var(--text-light);
                font-weight: 500;
                text-align: right;
            }
            
            .bar-value-container {
                flex: 1;
            }
            
            .bar-track {
                height: 8px;
                background: var(--glass-bg);
                border-radius: 4px;
                overflow: hidden;
                position: relative;
                box-shadow: inset 0 1px 3px var(--glass-shadow);
            }
            
            .bar-fill {
                height: 100%;
                border-radius: 4px;
                position: relative;
                box-shadow: 0 0 10px var(--primary-glow);
                transform: translateX(-100%);
                animation: fillBar 1s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                animation-delay: 0.3s;
            }
            
            .bar-highlight {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: rgba(255, 255, 255, 0.5);
                animation: highlightPulse 3s infinite;
            }
            
            .bar-amount {
                font-size: 0.85rem;
                color: var(--text-muted);
                white-space: nowrap;
            }
            
            /* Filter Form */
            .filter-card {
                margin-bottom: 2rem;
                animation: fadeInUp 0.7s ease forwards;
            }
            
            .filter-form {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 1.25rem;
            }
            
            .form-group {
                margin-bottom: 1rem;
            }
            
            .form-group-full {
                grid-column: 1 / -1;
            }
            
            .form-label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                font-size: 0.9rem;
                color: var(--text-light);
            }
            
            .input-wrapper {
                position: relative;
            }
            
            .neo-input {
                width: 100%;
                padding: 0.75rem 1rem;
                background: var(--input-bg);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                color: var(--text-bright);
                font-size: 0.9rem;
                transition: all 0.3s ease;
                box-shadow: inset 0 2px 4px var(--glass-shadow);
                backdrop-filter: blur(5px);
            }
            
            .neo-input:focus {
                outline: none;
                border-color: var(--primary-light);
                box-shadow: 0 0 0 3px var(--primary-glow),
                            inset 0 2px 4px var(--glass-shadow);
            }
            
            .neo-input::placeholder {
                color: var(--text-muted);
            }
            
            .input-glow {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                border-radius: 8px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
                box-shadow: 0 0 15px var(--primary-glow);
            }
            
            .neo-input:focus + .input-glow {
                opacity: 1;
            }
            
            .form-buttons {
                display: flex;
                align-items: flex-end;
                gap: 1rem;
                margin-top: 1rem;
            }
            
            .required-note {
                grid-column: 1 / -1;
                font-size: 0.8rem;
                color: var(--text-muted);
                margin-top: 0.75rem;
            }
            
            /* Neo Form */
            .neo-form {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1.25rem;
            }
            
            /* Table */
            .table-card {
                animation: fadeInUp 0.8s ease forwards;
            }
            
            .table-wrapper {
                overflow-x: auto;
            }
            
            .neo-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
            }
            
            .neo-table th {
                padding: 1rem 1.25rem;
                text-align: left;
                font-size: 0.8rem;
                font-weight: 600;
                text-transform: uppercase;
                color: var(--text-muted);
                background: var(--glass-bg);
                position: sticky;
                top: 0;
                z-index: 2;
                backdrop-filter: blur(5px);
            }
            
            .neo-table td {
                padding: 1rem 1.25rem;
                font-size: 0.9rem;
                color: var(--text-light);
                border-bottom: 1px solid var(--border-color);
                transition: all 0.3s ease;
            }
            
            .neo-table tr {
                transition: background-color 0.3s ease;
            }
            
            .neo-table tr:hover td {
                background-color: var(--glass-bg);
            }
            
            .neo-table tr:last-child td {
                border-bottom: none;
            }
            
            .text-right {
                text-align: right;
            }
            
            .expense-amount {
                font-weight: 600;
                color: var(--danger-color);
                text-shadow: 0 0 5px rgba(239, 68, 68, 0.5);
                text-align: right;
            }
            
            /* Pagination */
            .neo-pagination {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 1.25rem 1rem;
                border-top: 1px solid var(--border-color);
                gap: 1rem;
            }
            
            .page-indicator {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            
            .page-dot {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: var(--glass-bg);
                transition: all 0.3s ease;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-muted);
                font-size: 0.8rem;
            }
            
            .page-dot.active {
                background: var(--primary-light);
                box-shadow: 0 0 8px var(--primary-glow);
                transform: scale(1.1);
                color: var(--text-bright);
            }
            
            .page-dot:hover:not(.active) {
                background: var(--glass-border);
                color: var(--text-bright);
            }
            
            .page-counter {
                margin: 0 1rem;
                color: var(--text-muted);
                font-size: 0.9rem;
            }
            
            .icon-arrow {
                font-size: 0.85rem;
                line-height: 1;
            }
            
            /* Modal */
            .neo-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(15, 23, 42, 0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                padding: 2rem;
                backdrop-filter: blur(10px);
                animation: fadeIn 0.3s ease;
            }
            
            .neo-modal {
                background: var(--bg-medium);
                border-radius: 16px;
                border: 1px solid var(--glass-border);
                box-shadow: 0 25px 50px var(--glass-shadow),
                            0 0 0 1px var(--glass-border);
                width: 100%;
                max-width: 700px;
                max-height: 90vh;
                overflow: auto;
                position: relative;
                backdrop-filter: blur(10px);
                transform: translateY(30px);
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
            }
            
            .neo-modal.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .modal-header {
                padding: 1.25rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                background: var(--bg-medium);
                backdrop-filter: blur(10px);
                z-index: 2;
            }
            
            .modal-title {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--text-bright);
                background: linear-gradient(to right, var(--text-bright), var(--text-light));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .close-button {
                background: none;
                border: none;
                font-size: 1.75rem;
                line-height: 1;
                color: var(--text-muted);
                cursor: pointer;
                padding: 0;
                transition: all 0.2s ease;
            }
            
            .close-button:hover {
                color: var(--text-bright);
                transform: rotate(90deg);
            }
            
            .modal-content {
                padding: 1.5rem;
            }
            
            .expense-id-badge {
                display: inline-block;
                padding: 0.5rem 1rem;
                border-radius: 10px;
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                margin-bottom: 1.5rem;
                font-weight: 500;
                letter-spacing: 0.5px;
                color: var(--text-light);
                position: relative;
                overflow: hidden;
            }
            
            .expense-id-badge:before {
                content: "";
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
                transform: rotate(30deg);
                animation: shimmer 3s infinite linear;
            }
            
            /* Details Grid */
            .details-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1.25rem;
                margin-bottom: 2rem;
            }
            
            .detail-item {
                padding: 1.25rem;
                background: var(--glass-bg);
                border-radius: 12px;
                backdrop-filter: blur(10px);
                border: 1px solid var(--glass-border);
                position: relative;
                overflow: hidden;
                box-shadow: 0 5px 15px var(--glass-shadow);
                transition: all 0.3s ease;
            }
            
            .detail-item:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 20px var(--glass-shadow),
                            0 0 8px var(--primary-glow);
            }
            
            .detail-item:before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(45deg, transparent, rgba(255,255,255,0.05), transparent);
                pointer-events: none;
            }
            
            .detail-icon {
                font-size: 1.5rem;
                margin-bottom: 0.75rem;
                display: block;
            }
            
            .detail-label {
                font-size: 0.8rem;
                color: var(--text-muted);
                margin-bottom: 0.25rem;
            }
            
            .detail-value {
                font-size: 1rem;
                font-weight: 600;
                color: var(--text-bright);
            }
            
            /* Description Terminal */
            .description-section {
                margin-bottom: 2rem;
            }
            
            .description-label {
                font-size: 0.9rem;
                color: var(--text-muted);
                margin-bottom: 0.75rem;
            }
            
            .description-terminal {
                padding: 1.25rem;
                background: var(--bg-dark);
                border-radius: 10px;
                color: #33ff33; /* Terminal green */
                font-family: 'Courier New', monospace;
                white-space: pre-wrap;
                position: relative;
                box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5),
                            0 0 10px rgba(51, 255, 51, 0.2);
                border: 1px solid rgba(51, 255, 51, 0.2);
                line-height: 1.6;
            }
            
            .terminal-cursor {
                display: inline-block;
                width: 8px;
                height: 16px;
                background: #33ff33;
                animation: blink 1s infinite;
                vertical-align: middle;
                margin-left: 5px;
            }
            
            /* Download section */
            .download-section {
                margin-top: 2rem;
                text-align: center;
            }
            
            .download-icon {
                margin-right: 0.5rem;
            }
            
            /* Alerts */
            .neo-alert {
                padding: 1rem 1.25rem;
                border-radius: 12px;
                margin-bottom: 1.5rem;
                font-weight: 500;
                backdrop-filter: blur(5px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                animation: alertPulse 3s infinite;
                position: relative;
                overflow: hidden;
                border: 1px solid var(--glass-border);
            }
            
            .neo-alert:before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 5px;
                height: 100%;
            }
            
            .neo-alert.success {
                background: rgba(16, 185, 129, 0.15);
                color: #34d399;
            }
            
            .neo-alert.success:before {
                background: linear-gradient(to bottom, #10b981, #059669);
            }
            
            .neo-alert.danger {
                background: rgba(239, 68, 68, 0.15);
                color: #f87171;
            }
            
            .neo-alert.danger:before {
                background: linear-gradient(to bottom, #ef4444, #dc2626);
            }
            
            /* Notifications */
            .neo-notification {
                position: fixed;
                bottom: 30px;
                right: 30px;
                padding: 0;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2), 
                            0 0 0 1px var(--glass-border),
                            0 0 15px var(--primary-glow);
                color: var(--text-bright);
                font-size: 0.9rem;
                max-width: 350px;
                z-index: 1050;
                backdrop-filter: blur(10px);
                overflow: hidden;
                transform: translateY(100px);
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
            }
            
            .neo-notification.show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .neo-notification.hide {
                transform: translateY(30px);
                opacity: 0;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem 1.25rem;
                background: var(--glass-bg);
                position: relative;
                z-index: 1;
            }
            
            .notification-icon {
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: var(--primary-color);
                font-weight: 700;
                flex-shrink: 0;
            }
            
            .notification-message {
                flex: 1;
            }
            
            .notification-glow {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, transparent, var(--glass-shine));
                z-index: 0;
                pointer-events: none;
            }
            
            /* Loading */
            .loading-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 3rem 2rem;
                text-align: center;
            }
            
            .neo-spinner-wrapper {
                width: 80px;
                height: 80px;
                position: relative;
                margin-bottom: 1.5rem;
            }
            
            .neo-spinner {
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            .spinner-ring {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border: 3px solid transparent;
                border-top-color: var(--primary-light);
                border-radius: 50%;
                animation: spinnerRotate 1.5s ease-in-out infinite;
            }
            
            .spinner-ring:nth-child(1) {
                animation-delay: 0s;
            }
            
            .spinner-ring:nth-child(2) {
                width: 80%;
                height: 80%;
                top: 10%;
                left: 10%;
                border-top-color: var(--accent-color);
                animation-delay: 0.2s;
            }
            
            .spinner-ring:nth-child(3) {
                width: 60%;
                height: 60%;
                top: 20%;
                left: 20%;
                border-top-color: var(--primary-color);
                animation-delay: 0.4s;
            }
            
            .loading-text {
                color: var(--text-light);
                font-size: 1rem;
                margin-top: 1rem;
                animation: pulse 1.5s infinite ease-in-out;
            }
            
            /* Empty state */
            .empty-state {
                padding: 3rem 2rem;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            
            .empty-icon {
                font-size: 3rem;
                margin-bottom: 1.5rem;
                position: relative;
                animation: floatIcon 3s infinite ease-in-out;
            }
            
            .empty-icon:after {
                content: "";
                position: absolute;
                width: 40px;
                height: 10px;
                background: var(--primary-glow);
                border-radius: 50%;
                bottom: -10px;
                left: 50%;
                transform: translateX(-50%);
                filter: blur(10px);
                opacity: 0.5;
                animation: shadowPulse 3s infinite ease-in-out;
            }
            
            .empty-title {
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--text-bright);
                margin: 0 0 0.75rem;
            }
            
            .empty-text {
                font-size: 1rem;
                color: var(--text-muted);
                max-width: 400px;
                margin: 0 auto 2rem;
            }
            
            /* Animations */
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            @keyframes fadeInUp {
                from { 
                    opacity: 0;
                    transform: translateY(30px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes fadeInLeft {
                from { 
                    opacity: 0;
                    transform: translateX(-30px);
                }
                to { 
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes pulse {
                0% { opacity: 0.6; transform: scale(0.98); }
                50% { opacity: 1; transform: scale(1); }
                100% { opacity: 0.6; transform: scale(0.98); }
            }
            
            @keyframes ripple {
                from { 
                    opacity: 1;
                    transform: scale(0.8);
                }
                to { 
                    opacity: 0;
                    transform: scale(2);
                }
            }
            
            @keyframes borderPulse {
                0% { box-shadow: 0 0 0 0 var(--primary-glow); }
                70% { box-shadow: 0 0 0 5px rgba(79, 70, 229, 0); }
                100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
            }
            
            @keyframes rotateGlow {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%) rotate(30deg); }
                100% { transform: translateX(100%) rotate(30deg); }
            }
            
            @keyframes fillBar {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
            }
            
            @keyframes alertPulse {
                0% { box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
                50% { box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1), 0 0 15px var(--primary-glow); }
                100% { box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
            }
            
            @keyframes blink {
                0%, 49% { opacity: 1; }
                50%, 100% { opacity: 0; }
            }
            
            @keyframes highlightPulse {
                0% { opacity: 0.2; }
                50% { opacity: 0.5; }
                100% { opacity: 0.2; }
            }
            
            @keyframes spinnerRotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes floatIcon {
                0% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
                100% { transform: translateY(0); }
            }
            
            @keyframes shadowPulse {
                0% { opacity: 0.3; width: 30px; }
                50% { opacity: 0.5; width: 40px; }
                100% { opacity: 0.3; width: 30px; }
            }
            
            /* Responsive Adjustments */
            @media (max-width: 992px) {
                .neo-nav-links {
                    display: none;
                }
                
                .neo-content-area {
                    padding: 1.5rem;
                }
                
                .neo-grid {
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                }
                
                .bar-item {
                    grid-template-columns: 140px 1fr auto;
                }
            }
            
            @media (max-width: 768px) {
                .neo-top-nav {
                    padding: 0 1rem;
                }
                
                .neo-sidebar {
                    width: 60px;
                }
                
                .neo-sidebar.collapsed {
                    width: 0;
                    padding: 0;
                }
                
                .neo-sidebar-text {
                    display: none;
                }
                
                .neo-sidebar-icon {
                    margin-right: 0;
                }
                
                .neo-sidebar-link {
                    justify-content: center;
                    padding: 0.75rem 0;
                }
                
                .neo-title {
                    font-size: 1.75rem;
                }
                
                .neo-grid {
                    grid-template-columns: 1fr;
                }
                
                .filter-form,
                .neo-form,
                .details-grid {
                    grid-template-columns: 1fr;
                }
                
                .form-buttons {
                    flex-direction: column;
                    width: 100%;
                }
                
                .form-buttons .neo-button {
                    width: 100%;
                }
                
                .card-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 1rem;
                }
                
                .card-header.with-actions {
                    flex-direction: row;
                }
                
                .neo-actions {
                    flex-direction: column;
                }
                
                .neo-actions .neo-button {
                    width: 100%;
                }
                
                .bar-item {
                    grid-template-columns: 1fr;
                    gap: 0.5rem;
                }
                
                .bar-label {
                    text-align: left;
                }
                
                .bar-amount {
                    text-align: right;
                    width: 100%;
                }
            }
            
            @media (max-width: 480px) {
                .neo-top-nav {
                    height: 50px;
                }
                
                .neo-username {
                    display: none;
                }
                
                .neo-content-area {
                    padding: 1rem;
                }
                
                .neo-notification {
                    left: 20px;
                    right: 20px;
                    max-width: none;
                }
                
                .neo-modal {
                    max-height: 85vh;
                }
                
                .neo-table th, 
                .neo-table td {
                    padding: 0.75rem 0.5rem;
                    font-size: 0.8rem;
                }
                
                .neo-button.small {
                    padding: 0.4rem 0.8rem;
                    font-size: 0.7rem;
                }
                
                .actions-cell {
                    flex-direction: column;
                    gap: 0.3rem;
                }
            }
        `;
        document.head.appendChild(styleElement);
    }
}

// Export the AdminExpensesView
export default AdminExpensesView;