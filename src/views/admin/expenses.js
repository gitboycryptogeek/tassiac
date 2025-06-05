// src/views/admin/expenses.js

export class AdminExpensesView {
    // Static property to manage the jsPDF loading promise, ensuring it's loaded only once.
    static _jsPDFLoadingPromise = null;

    constructor() {
        this.apiService = window.apiService;
        this.authService = window.authService;
        this.user = this.authService.getUser();
        this.expenses = [];
        this.departments = []; // Will be populated from database
        this.users = []; // Will be populated from database
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
        this.currentViewingExpense = null;
        this.isViewingExpenseDetails = false;
        this.dataLoaded = false;
        this.filtersChanged = false;
        this.initialLoadComplete = false;
        this.initialLoadPromise = null; // Add this to track initialization

        // API request queue for throttling
        this.apiRequestQueue = [];
        this.isProcessingQueue = false;
        this.requestThrottleTime = 300;
        
        // Financial data
        this.chartData = {
            payments: 0,
            expenses: 0
        };
        
        // File upload state
        this.selectedFile = null;
        
        // Register resize event for responsive visualization
        this.resizeListener = this.handleResize.bind(this);
        window.addEventListener('resize', this.resizeListener);
        
        // Auto-initialize data loading immediately
        this.ensureDataLoaded();
    }
    
    destroy() {
        window.removeEventListener('resize', this.resizeListener);
        // Potentially clear any pending timeouts or intervals if necessary
    }
    
    handleResize() {
        if (this.showDepartmentBreakdown) {
            this.updateDepartmentBars();
        }
    }
    
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

    /**
     * Ensures data is loaded before any rendering happens
     * This is called automatically and can be called multiple times safely
     */
    ensureDataLoaded() {
        if (!this.initialLoadPromise) {
            this.initialLoadPromise = this.loadInitialData();
        }
        return this.initialLoadPromise;
    }

    /**
     * Alternative PDF generation using browser's print functionality
     * @returns {Promise<void>} A promise that resolves when PDF is ready
     */
    async loadJsPDF() {
        // Since CSP blocks external scripts, we'll use browser's built-in PDF generation
        return Promise.resolve();
    }
    
    async init() {
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = '';
            try {
                // Reset all flags to ensure fresh start
                this.dataLoaded = false;
                this.initialLoadComplete = false;
                this.isLoading = true;
                
                // Show initial loading screen
                appContainer.innerHTML = `
                    <div class="expense-full-page" style="background-color: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
                        <div style="text-align: center;">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">⛪</div>
                            <h2 style="color: #f8fafc; margin-bottom: 1rem;">Loading Expense Management...</h2>
                            <div style="color: #94a3b8;">Please wait while we fetch your data</div>
                        </div>
                    </div>
                `;
                
                // Load data FIRST, then render
                await this.loadInitialData();
                
                // NOW render with actual data
                const content = await this.render();
                appContainer.innerHTML = ''; // Clear loading screen
                appContainer.appendChild(content);
                
            } catch (error) {
                console.error("Error during initial render:", error);
                appContainer.innerHTML = `<div class="neo-alert danger" style="margin: 2rem;">Failed to render page: ${error.message}</div>`;
            }
        }
    }
    
    async render() {
        // CRITICAL: Always ensure data is loaded before rendering
        await this.ensureDataLoaded();
        
        const container = document.createElement('div');
        
        try {
            this.injectFuturisticStyles();
            
            container.className = 'expense-full-page';
            
            const appWrapper = document.createElement('div');
            appWrapper.className = 'neo-app-wrapper';
            
            const topNav = this.renderTopNavigation();
            appWrapper.appendChild(topNav);
            
            const contentArea = document.createElement('div');
            contentArea.className = 'neo-content-area-full';
            
            const headerSection = document.createElement('div');
            headerSection.className = 'neo-header';
            
            const headerTitle = document.createElement('h1');
            headerTitle.textContent = 'Expense Management';
            headerTitle.className = 'neo-title';
            
            const addExpenseButton = document.createElement('button');
            addExpenseButton.textContent = '+ Add New Expense';
            addExpenseButton.className = 'neo-button primary';
            
            addExpenseButton.addEventListener('mouseenter', (e) => e.target.classList.add('glow'));
            addExpenseButton.addEventListener('mouseleave', (e) => e.target.classList.remove('glow'));
            
            addExpenseButton.addEventListener('click', () => {
                this.isAddingExpense = true;
                this.error = null; // Clear previous errors
                this.success = null; // Clear previous success messages
                this.updateView();
            });
            
            headerSection.appendChild(headerTitle);
            headerSection.appendChild(addExpenseButton);
            contentArea.appendChild(headerSection);
            
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
                // Clear success message after a delay or on next interaction
                setTimeout(() => { this.success = null; this.updateView(); }, 5000);
            }
            
            if (this.isAddingExpense) {
                const formCard = this.renderAddExpenseForm();
                contentArea.appendChild(formCard);
            }
            
            if (this.isViewingExpenseDetails && this.currentViewingExpense) {
                // Ensure previous modals are removed before adding a new one
                const existingModal = document.querySelector('.neo-modal-overlay');
                if (existingModal) existingModal.remove();
                const modalOverlay = this.renderExpenseDetailsModal(this.currentViewingExpense);
                document.body.appendChild(modalOverlay); // Append to body to overlay everything
            }
            
            // Always show stats and actions sections when not adding expense (even while loading)
            if (!this.isAddingExpense) {
                contentArea.appendChild(this.renderStatsSection());
                
                const actionButtonsRow = document.createElement('div');
                actionButtonsRow.className = 'neo-actions';
                
                const breakdownButton = document.createElement('button');
                breakdownButton.textContent = this.showDepartmentBreakdown 
                    ? 'Hide Department Analysis' 
                    : 'Show Department Analysis';
                breakdownButton.className = `neo-button ${this.showDepartmentBreakdown ? 'active' : 'outline'}`;
                breakdownButton.addEventListener('click', () => {
                    this.showDepartmentBreakdown = !this.showDepartmentBreakdown;
                    this.updateView();
                });
                
                const exportReportButton = document.createElement('button');
                exportReportButton.textContent = 'Export Expense Report';
                exportReportButton.className = 'neo-button secondary';
                exportReportButton.addEventListener('click', async () => { // Make async for await
                    try {
                        await this.exportExpensePdf(); // Call the consolidated async method
                    } catch (pdfError) {
                        console.error("Error exporting expense report PDF:", pdfError);
                        this.showNotification(pdfError.message || 'Could not export report.', 'error');
                    }
                });
                
                actionButtonsRow.appendChild(breakdownButton);
                actionButtonsRow.appendChild(exportReportButton);
                contentArea.appendChild(actionButtonsRow);
                
                if (this.showDepartmentBreakdown) {
                    contentArea.appendChild(this.renderDepartmentBreakdown());
                }
            }
            
            contentArea.appendChild(this.renderFilterSection());
            contentArea.appendChild(this.renderExpensesTable());
            
            appWrapper.appendChild(contentArea);
            container.appendChild(appWrapper);
            
        } catch (error) {
            console.error("Error in render method:", error);
            const errorMessage = document.createElement('div');
            errorMessage.className = 'neo-alert danger';
            errorMessage.textContent = `Critical error rendering page: ${error.message}`;
            container.innerHTML = ''; // Clear potentially broken content
            container.appendChild(errorMessage);
        }
        
        return container;
    }
    
    renderTopNavigation() {
        const topNav = document.createElement('div');
        topNav.className = 'neo-top-nav';
        
        const logoArea = document.createElement('div');
        logoArea.className = 'neo-logo';
        logoArea.innerHTML = '<span class="church-logo">⛪</span> TASSIAC CHURCH';
        
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
        
        const userMenu = document.createElement('div');
        userMenu.className = 'neo-user-menu';
        
        const userAvatar = document.createElement('div');
        userAvatar.className = 'neo-avatar';
        userAvatar.textContent = this.user && this.user.fullName ? this.user.fullName.charAt(0).toUpperCase() : 'U';
        
        const userName = document.createElement('span');
        userName.className = 'neo-username';
        userName.textContent = this.user && this.user.fullName ? this.user.fullName : 'Admin User';
        
        userMenu.appendChild(userAvatar);
        userMenu.appendChild(userName);
        
        topNav.appendChild(logoArea);
        topNav.appendChild(navLinks);
        topNav.appendChild(userMenu);
        
        return topNav;
    }

    renderStatsSection() {
        const statsSection = document.createElement('div');
        statsSection.className = 'stats-section';
        
        const statsGrid = document.createElement('div');
        statsGrid.className = 'neo-grid';
        
        const statCardsData = [
            {
                title: 'Total Expenses',
                value: `KES ${this.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                icon: 'expenses',
                color: '#ef4444', // Red
                id: 'total-expenses'
            }
        ];
        
        if (this.filterDepartment) {
            const departmentExpenses = this.expenses.reduce((sum, expense) => {
                if (expense.department === this.filterDepartment) {
                    return sum + parseFloat(expense.amount);
                }
                return sum;
            }, 0);
            
            statCardsData.push({
                title: `${this.filterDepartment} Expenses`,
                value: `KES ${departmentExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                icon: 'department',
                color: '#0891b2', // Cyan
                id: 'department-expenses'
            });
        } else {
            const departmentTotals = {};
            this.expenses.forEach(expense => {
                const dept = expense.department || 'Unknown';
                if (!departmentTotals[dept]) {
                    departmentTotals[dept] = 0;
                }
                departmentTotals[dept] += parseFloat(expense.amount);
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
                statCardsData.push({
                    title: `Top Dept: ${topDepartment}`,
                    value: `KES ${topAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    icon: 'top',
                    color: '#0891b2', // Cyan
                    id: 'top-department'
                });
            }
        }
        
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        
        const thisMonthExpenses = this.expenses.reduce((sum, expense) => {
            const expenseDate = new Date(expense.paymentDate);
            if (expenseDate.getMonth() === thisMonth && expenseDate.getFullYear() === thisYear) {
                return sum + parseFloat(expense.amount);
            }
            return sum;
        }, 0);
        
        statCardsData.push({
            title: `This Month's Expenses`,
            value: `KES ${thisMonthExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: 'calendar',
            color: '#8b5cf6', // Purple
            id: 'month-expenses'
        });
        
        statCardsData.forEach((card, index) => {
            const statCard = document.createElement('div');
            statCard.id = card.id;
            statCard.className = 'neo-card stat-card';
            statCard.style.animationDelay = `${index * 0.1}s`;
            
            const cardGlow = document.createElement('div');
            cardGlow.className = 'card-glow';
            
            const iconContainer = document.createElement('div');
            iconContainer.className = 'stat-icon';
            iconContainer.style.backgroundColor = `${card.color}20`; // Hex alpha
            iconContainer.style.borderColor = `${card.color}40`;   // Hex alpha
            
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
        return icons[iconType] || '✨'; // Default icon
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
        
        // Search input
        const searchGroup = this.createFormGroup('Search Expenses', 'filter-search', 'text');
        searchGroup.classList.add('form-group-full'); // Make search full width
        const searchInput = searchGroup.querySelector('input');
        searchInput.placeholder = 'Search by description, amount, or department...';
        searchInput.value = this.searchTerm;
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.filtersChanged = true; // Mark filters as changed but don't apply immediately
        });
         // Add search icon to search input
        const searchInputWrapper = searchInput.parentElement; // Assuming createFormGroup wraps input in a div
        const searchIconSpan = document.createElement('span');
        searchIconSpan.className = 'search-icon';
        searchIconSpan.textContent = '🔍';
        searchInputWrapper.classList.add('search-input-wrapper'); // Add class for styling
        searchInputWrapper.insertBefore(searchIconSpan, searchInput);


        // Department filter
        const departmentGroup = this.createFormGroup('Department', 'filter-department', 'select');
        const departmentSelect = departmentGroup.querySelector('select');
        departmentSelect.innerHTML = '<option value="">All Departments</option>';
        this.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            if (dept === this.filterDepartment) option.selected = true;
            departmentSelect.appendChild(option);
        });
        departmentSelect.addEventListener('change', (e) => {
            this.filterDepartment = e.target.value;
            this.currentPage = 1;
            this.filtersChanged = true;
        });

        // Start date filter
        const startDateGroup = this.createFormGroup('Start Date', 'filter-start-date', 'date');
        const startDateInput = startDateGroup.querySelector('input');
        startDateInput.value = this.filterStartDate;
        startDateInput.addEventListener('change', (e) => {
            this.filterStartDate = e.target.value;
            this.currentPage = 1;
            this.filtersChanged = true;
        });

        // End date filter
        const endDateGroup = this.createFormGroup('End Date', 'filter-end-date', 'date');
        const endDateInput = endDateGroup.querySelector('input');
        endDateInput.value = this.filterEndDate;
        endDateInput.addEventListener('change', (e) => {
            this.filterEndDate = e.target.value;
            this.currentPage = 1;
            this.filtersChanged = true;
        });
        
        const applyButtonGroup = document.createElement('div');
        applyButtonGroup.className = 'form-buttons form-group-full'; // Make buttons span full width if needed
        
        const applyButton = document.createElement('button');
        applyButton.type = 'button'; // Important: type="button" to prevent form submission
        applyButton.textContent = 'Apply Filters';
        applyButton.className = 'neo-button primary';
        applyButton.addEventListener('click', () => {
            if (this.filtersChanged) {
                this.applyFilters();
                this.filtersChanged = false;
            }
        });
        
        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.textContent = 'Reset Filters';
        resetButton.className = 'neo-button outline';
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
            departmentSelect.value = '';
            startDateInput.value = '';
            endDateInput.value = '';
            
            const needsReset = this.searchTerm || this.filterDepartment || this.filterStartDate || this.filterEndDate;
            this.searchTerm = '';
            this.filterDepartment = '';
            this.filterStartDate = '';
            this.filterEndDate = '';
            this.currentPage = 1;
            if (needsReset) {
                this.applyFilters();
            }
            this.filtersChanged = false;
        });
        
        applyButtonGroup.appendChild(applyButton);
        applyButtonGroup.appendChild(resetButton);
        
        filterForm.appendChild(searchGroup);
        filterForm.appendChild(departmentGroup);
        filterForm.appendChild(startDateGroup);
        filterForm.appendChild(endDateGroup);
        filterForm.appendChild(applyButtonGroup);
        
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent default form submission
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
        
        const tableHeaderEl = document.createElement('div');
        tableHeaderEl.className = 'card-header';
        const tableTitle = document.createElement('h2');
        tableTitle.className = 'card-title';
        tableTitle.textContent = 'Expense Records';
        tableHeaderEl.appendChild(tableTitle);
        tableCard.appendChild(tableHeaderEl);
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'card-body'; // card-body for padding
        
        if (this.isLoading) {
            // Modern loading spinner
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-container';
            const spinnerWrapper = document.createElement('div');
            spinnerWrapper.className = 'neo-spinner-wrapper';
            const spinner = document.createElement('div');
            spinner.className = 'neo-spinner';
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
            emptyState.innerHTML = `
                <div class="empty-icon">📋</div>
                <h3 class="empty-title">No Expenses Found</h3>
                <p class="empty-text">No expense records match your filters. Try adjusting your search criteria or add a new expense.</p>
            `;
            tableContainer.appendChild(emptyState);
        } else {
            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'table-wrapper'; // For horizontal scrolling on small screens
            
            const table = document.createElement('table');
            table.className = 'neo-table';
            
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const headers = ['Date', 'Department', 'Amount', 'Description', 'Receipt', 'Actions'];
            headers.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                if (headerText === 'Amount') th.className = 'text-right';
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            // Pagination logic is applied before this loop if itemsPerPage is used for fetching
            // Here, we render the current page's items
            this.expenses.forEach(expense => { // Assuming this.expenses already contains only the current page's items
                const row = document.createElement('tr');
                
                const dateCell = document.createElement('td');
                dateCell.textContent = new Date(expense.paymentDate).toLocaleDateString();
                
                const departmentCell = document.createElement('td');
                departmentCell.textContent = expense.department || 'Unknown';
                
                const amountCell = document.createElement('td');
                amountCell.className = 'expense-amount text-right'; // Added text-right
                amountCell.textContent = `KES ${parseFloat(expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                
                const descriptionCell = document.createElement('td');
                const descText = expense.description || 'No description';
                const maxLength = 30;
                descriptionCell.textContent = descText.length > maxLength ? descText.substring(0, maxLength) + '...' : descText;
                if (descText.length > maxLength) descriptionCell.title = descText; // Full text on hover
                
                const receiptCell = document.createElement('td');
                if (expense.expenseReceiptUrl) {
                    const receiptLink = document.createElement('a');
                    receiptLink.href = expense.expenseReceiptUrl;
                    receiptLink.target = '_blank';
                    receiptLink.textContent = '📎 View';
                    receiptLink.className = 'receipt-link';
                    receiptCell.appendChild(receiptLink);
                } else {
                    receiptCell.textContent = 'No receipt';
                    receiptCell.className = 'no-receipt';
                }
                
                const actionsCell = document.createElement('td');
                actionsCell.className = 'actions-cell';
                
                const viewButton = document.createElement('button');
                viewButton.textContent = 'View';
                viewButton.className = 'neo-button small primary';
                viewButton.addEventListener('click', () => this.viewExpenseDetails(expense));
                
                const downloadButton = document.createElement('button');
                downloadButton.textContent = 'PDF';
                downloadButton.className = 'neo-button small outline';
                downloadButton.addEventListener('click', async () => { // Make async for await
                    try {
                        await this.downloadExpensePdf(expense); // Call the consolidated async method
                    } catch (pdfError) {
                        console.error("Error downloading expense PDF:", pdfError);
                        this.showNotification(pdfError.message || 'Could not download PDF.', 'error');
                    }
                });
                
                actionsCell.appendChild(viewButton);
                actionsCell.appendChild(downloadButton);
                
                row.appendChild(dateCell);
                row.appendChild(departmentCell);
                row.appendChild(amountCell);
                row.appendChild(descriptionCell);
                row.appendChild(receiptCell);
                row.appendChild(actionsCell);
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            tableWrapper.appendChild(table);
            tableContainer.appendChild(tableWrapper);
            
            // Pagination controls
            if (this.totalPages > 1) {
                const paginationContainer = document.createElement('div');
                paginationContainer.className = 'neo-pagination';
                
                const prevButton = document.createElement('button');
                prevButton.innerHTML = '<span class="icon-arrow">◀</span>';
                prevButton.className = `neo-button icon ${this.currentPage <= 1 ? 'disabled' : ''}`;
                prevButton.title = 'Previous page';
                prevButton.disabled = this.currentPage <= 1;
                prevButton.addEventListener('click', () => {
                    if (this.currentPage > 1) {
                        this.currentPage--;
                        this.applyFilters();
                    }
                });
                
                const pageIndicator = document.createElement('div');
                pageIndicator.className = 'page-indicator';
                const maxVisibleDots = 5; // Keep it odd for symmetry
                let startDot = Math.max(1, this.currentPage - Math.floor(maxVisibleDots / 2));
                let endDot = Math.min(this.totalPages, startDot + maxVisibleDots - 1);
                 // Adjust startDot if endDot is at max and there's space
                if (endDot === this.totalPages) {
                    startDot = Math.max(1, this.totalPages - maxVisibleDots + 1);
                }

                if (startDot > 1) {
                    const firstDot = this.createPageDot(1);
                    pageIndicator.appendChild(firstDot);
                    if (startDot > 2) {
                         const ellipsis = document.createElement('span');
                         ellipsis.textContent = '...';
                         ellipsis.className = 'page-ellipsis';
                         pageIndicator.appendChild(ellipsis);
                    }
                }

                for (let i = startDot; i <= endDot; i++) {
                    pageIndicator.appendChild(this.createPageDot(i));
                }

                if (endDot < this.totalPages) {
                    if (endDot < this.totalPages - 1) {
                        const ellipsis = document.createElement('span');
                        ellipsis.textContent = '...';
                        ellipsis.className = 'page-ellipsis';
                        pageIndicator.appendChild(ellipsis);
                    }
                    const lastDot = this.createPageDot(this.totalPages);
                    pageIndicator.appendChild(lastDot);
                }

                const pageCounter = document.createElement('span');
                pageCounter.className = 'page-counter';
                pageCounter.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
                
                const nextButton = document.createElement('button');
                nextButton.innerHTML = '<span class="icon-arrow">▶</span>';
                nextButton.className = `neo-button icon ${this.currentPage >= this.totalPages ? 'disabled' : ''}`;
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
                // paginationContainer.appendChild(pageCounter); // Page counter can be optional if dots are clear
                paginationContainer.appendChild(nextButton);
                tableContainer.appendChild(paginationContainer);
            }
        }
        tableCard.appendChild(tableContainer);
        return tableCard;
    }

    createPageDot(pageNumber) {
        const pageDot = document.createElement('span');
        pageDot.className = `page-dot ${pageNumber === this.currentPage ? 'active' : ''}`;
        pageDot.textContent = pageNumber;
        pageDot.addEventListener('click', () => {
            if (pageNumber !== this.currentPage) {
                this.currentPage = pageNumber;
                this.applyFilters();
            }
        });
        return pageDot;
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
        
        const departmentTotals = {};
        this.expenses.forEach(expense => {
            const dept = expense.department || 'Unknown';
            if (!departmentTotals[dept]) departmentTotals[dept] = 0;
            departmentTotals[dept] += parseFloat(expense.amount);
        });
        
        const visualizationContainer = document.createElement('div');
        visualizationContainer.className = 'visualization-container';
        
        const sortedDepartments = Object.entries(departmentTotals)
            .filter(([_, amount]) => amount > 0) // Only show departments with expenses
            .sort((a, b) => b[1] - a[1]); // Sort descending by amount
            
        if (sortedDepartments.length === 0) {
            visualizationContainer.innerHTML = `<p class="empty-text" style="text-align:center;">No department expenses to display for the current filters.</p>`;
        } else {
            const barContainer = document.createElement('div');
            barContainer.className = 'neo-bar-chart';
            
            const totalForPercentage = this.totalExpenses > 0 ? this.totalExpenses : sortedDepartments.reduce((sum, [,amount]) => sum + amount, 0);


            sortedDepartments.forEach(([deptName, amount], index) => {
                const percentage = totalForPercentage > 0 ? Math.round((amount / totalForPercentage) * 100) : 0;
                
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
                
                const hue = 220 + (index * 30) % 140; // Cycle through hues for variety
                barFill.style.background = `linear-gradient(90deg, hsl(${hue}, 80%, 50%), hsl(${hue + 30}, 80%, 60%))`;
                
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
        }
        
        breakdownContent.appendChild(visualizationContainer);
        breakdownSection.appendChild(breakdownContent);
        return breakdownSection;
    }
    
    updateDepartmentBars() {
        // This method is currently empty. If dynamic updates to bars are needed on resize
        // without a full re-render, the logic would go here.
        // For now, a full re-render on resize (if needed) or data change handles updates.
        // console.log('updateDepartmentBars called - currently no specific action.');
    }

    renderAddExpenseForm() {
        const formCard = document.createElement('div');
        formCard.className = 'neo-card form-card'; // Added form-card for specific styling if needed
        
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
            this.error = null; // Clear form-specific errors
            this.updateView();
        });
        cardHeader.appendChild(cardTitle);
        cardHeader.appendChild(closeButton);
        formCard.appendChild(cardHeader);
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        
        const form = document.createElement('form');
        form.id = 'addExpenseForm';
        form.className = 'neo-form'; // Use neo-form for consistent grid layout
        form.enctype = 'multipart/form-data'; // Important for file uploads
        
        // Department selection
        const departmentGroup = this.createFormGroup('Department *', 'department', 'select');
        const departmentSelect = departmentGroup.querySelector('select');
        departmentSelect.required = true;
        departmentSelect.innerHTML = '<option value="">Select department</option>';
        this.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
        const customDeptOption = document.createElement('option');
        customDeptOption.value = 'custom';
        customDeptOption.textContent = 'Other (specify)';
        departmentSelect.appendChild(customDeptOption);
        
        const customDeptGroup = this.createFormGroup('Custom Department *', 'customDepartment', 'text');
        customDeptGroup.style.display = 'none'; // Hidden by default
        const customDeptInput = customDeptGroup.querySelector('input');
        customDeptInput.placeholder = 'Enter department name';
        
        departmentSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customDeptGroup.style.display = 'block'; // Or 'grid' if it's a grid item
                customDeptInput.required = true;
            } else {
                customDeptGroup.style.display = 'none';
                customDeptInput.required = false;
                customDeptInput.value = '';
            }
        });
        
        const amountGroup = this.createFormGroup('Amount *', 'amount', 'number');
        const amountInput = amountGroup.querySelector('input');
        amountInput.required = true;
        amountInput.min = '0.01';
        amountInput.step = '0.01';
        amountInput.placeholder = '0.00';
        
        const dateGroup = this.createFormGroup('Date *', 'paymentDate', 'date');
        const dateInput = dateGroup.querySelector('input');
        dateInput.required = true;
        dateInput.valueAsDate = new Date(); // Default to today
        
        const userGroup = this.createFormGroup('Associated User', 'userId', 'select');
        const userSelect = userGroup.querySelector('select');
        userSelect.innerHTML = '<option value="">Select a user (optional)</option>';
        this.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.fullName} (${user.username})`;
            userSelect.appendChild(option);
        });
        
        const referenceGroup = this.createFormGroup('Reference Number', 'reference', 'text');
        referenceGroup.querySelector('input').placeholder = 'Optional reference number';
        
        const fileGroup = this.createFormGroup('Receipt File', 'expenseReceiptImage', 'file');
        fileGroup.classList.add('form-group-full'); // Make file input span full width
        const fileInput = fileGroup.querySelector('input');
        fileInput.accept = '.jpg,.jpeg,.png,.pdf';
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.textContent = 'Upload receipt image or PDF (max 5MB)';
        fileGroup.appendChild(fileInfo); // Append info text below the input
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    fileInfo.textContent = 'File too large. Maximum 5MB allowed.';
                    fileInfo.style.color = 'var(--danger-color)';
                    e.target.value = ''; // Clear the input
                    this.selectedFile = null;
                    return;
                }
                this.selectedFile = file;
                fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                fileInfo.style.color = 'var(--success-color)';
            } else {
                this.selectedFile = null;
                fileInfo.textContent = 'Upload receipt image or PDF (max 5MB)';
                fileInfo.style.color = ''; // Reset color
            }
        });
        
        const descriptionGroup = this.createFormGroup('Description *', 'description', 'textarea');
        descriptionGroup.classList.add('form-group-full');
        const descriptionTextarea = descriptionGroup.querySelector('textarea');
        descriptionTextarea.required = true;
        descriptionTextarea.placeholder = 'Detailed description of the expense...';
        descriptionTextarea.rows = 4;
        
        const requiredNote = document.createElement('div');
        requiredNote.className = 'required-note form-group-full';
        requiredNote.textContent = '* Required fields';
        
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'form-buttons form-group-full';
        
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'neo-button outline';
        cancelButton.addEventListener('click', () => {
            this.isAddingExpense = false;
            this.error = null;
            this.updateView();
        });
        
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Add Expense';
        submitButton.className = 'neo-button primary';
        
        buttonGroup.appendChild(cancelButton);
        buttonGroup.appendChild(submitButton);
        
        form.appendChild(departmentGroup);
        form.appendChild(customDeptGroup);
        form.appendChild(amountGroup);
        form.appendChild(dateGroup);
        form.appendChild(userGroup);
        form.appendChild(referenceGroup);
        form.appendChild(fileGroup);
        form.appendChild(descriptionGroup);
        form.appendChild(requiredNote);
        form.appendChild(buttonGroup);
        
        form.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
        
        cardBody.appendChild(form);
        formCard.appendChild(cardBody);
        return formCard;
    }

    renderExpenseDetailsModal(expense) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'neo-modal-overlay';
        
        const modalContainer = document.createElement('div');
        modalContainer.className = 'neo-modal';
        
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
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const idBadge = document.createElement('div');
        idBadge.className = 'expense-id-badge';
        idBadge.innerHTML = `<span>Expense ID: ${expense.id || 'N/A'}</span>`;
        
        const detailsGrid = document.createElement('div');
        detailsGrid.className = 'details-grid';
        
        const expenseDate = expense.paymentDate ? new Date(expense.paymentDate) : null;
        const formattedDate = expenseDate ? expenseDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No date';
        
        const detailItemsData = [
            { label: 'Department', value: expense.department || 'Unknown', icon: '🏢' },
            { label: 'Amount', value: `KES ${parseFloat(expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: '💰' },
            { label: 'Date', value: formattedDate, icon: '📅' },
            { label: 'Status', value: expense.status || 'Completed', icon: '✅' },
            { label: 'Reference', value: expense.reference || 'None', icon: '🔖' },
            { label: 'Receipt', value: expense.expenseReceiptUrl ? 'Available' : 'None', icon: '📎', url: expense.expenseReceiptUrl },
            { label: 'Added By', value: expense.processor?.fullName || `Admin #${expense.processedById}` || 'System', icon: '👤' },
            { label: 'Created On', value: expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : 'Unknown', icon: '⏱️' }
        ];
        
        detailItemsData.forEach(item => {
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
            if (item.label === 'Receipt' && item.url) {
                const receiptLink = document.createElement('a');
                receiptLink.href = item.url;
                receiptLink.target = '_blank';
                receiptLink.textContent = 'View Receipt';
                receiptLink.className = 'receipt-link';
                value.appendChild(receiptLink);
            } else {
                value.textContent = item.value;
            }
            detailItem.appendChild(itemIcon);
            detailItem.appendChild(label);
            detailItem.appendChild(value);
            detailsGrid.appendChild(detailItem);
        });
        
        const descriptionSection = document.createElement('div');
        descriptionSection.className = 'description-section';
        descriptionSection.innerHTML = `
            <div class="description-label">Description</div>
            <div class="description-terminal">${expense.description || 'No description provided'}<span class="terminal-cursor"></span></div>
        `;
        
        const actionsSection = document.createElement('div');
        actionsSection.className = 'modal-actions';
        const downloadPdfButton = document.createElement('button');
        downloadPdfButton.className = 'neo-button download primary'; // Added primary for better visibility
        downloadPdfButton.innerHTML = '<span class="download-icon">📄</span> Download as PDF <div class="button-glow"></div>';
        downloadPdfButton.addEventListener('click', async () => { // Make async for await
             try {
                await this.downloadExpensePdf(expense);
            } catch (pdfError) {
                console.error("Error downloading single expense PDF from modal:", pdfError);
                this.showNotification(pdfError.message || 'Could not download PDF.', 'error');
            }
        });
        actionsSection.appendChild(downloadPdfButton);
        
        modalContent.appendChild(idBadge);
        modalContent.appendChild(detailsGrid);
        modalContent.appendChild(descriptionSection);
        modalContent.appendChild(actionsSection);
        
        modalContainer.appendChild(modalHeader);
        modalContainer.appendChild(modalContent);
        modalOverlay.appendChild(modalContainer);
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.isViewingExpenseDetails = false;
                this.currentViewingExpense = null;
                modalOverlay.remove();
            }
        });
        
        setTimeout(() => modalContainer.classList.add('show'), 10); // Animation
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
        } else if (type === 'select') {
            inputElement = document.createElement('select');
        } else {
            inputElement = document.createElement('input');
            inputElement.type = type;
        }
        inputElement.id = name;
        inputElement.name = name;
        inputElement.className = 'neo-input'; // All inputs get this base class
        
        const inputWrapper = document.createElement('div'); // Wrapper for input and glow effect
        inputWrapper.className = 'input-wrapper';
        inputWrapper.appendChild(inputElement);
        const inputGlow = document.createElement('div');
        inputGlow.className = 'input-glow';
        inputWrapper.appendChild(inputGlow);
        
        formGroup.appendChild(labelElement);
        formGroup.appendChild(inputWrapper);
        return formGroup;
    }

    async loadInitialData() {
        // Check if API service is available
        if (!this.apiService) {
            this.error = 'API Service not initialized. Please refresh the page.';
            this.isLoading = false;
            return;
        }
        
        this.isLoading = true;
        this.error = null; // Clear any previous errors
        
        try {
            // Always fetch fresh data, regardless of previous state
            const results = await Promise.allSettled([
                this.fetchExpenses(),
                this.fetchUsers(),
                this.fetchDepartments()
            ]);
            
            // Check if any requests failed
            const failedRequests = results.filter(result => result.status === 'rejected');
            if (failedRequests.length > 0) {
                // Don't throw error, just log it - partial data is better than no data
            }
            
        } catch (error) {
            this.error = 'Failed to load initial data. Please refresh the page or check connectivity.';
        } finally {
            this.isLoading = false;
            this.dataLoaded = true;
            this.initialLoadComplete = true;
        }
    }

    /**
     * Generates and downloads a PDF for a single expense using browser print.
     * @param {object} expense The expense object.
     */
    async generatePdf(expense) {
        try {
            await this.loadJsPDF();
        } catch (loadError) {
            this.showNotification(loadError.message || 'Failed to load PDF library.', 'error');
            console.error("PDF load error in generatePdf:", loadError);
            throw loadError;
        }

        // Create a printable HTML version
        const departmentName = expense.department || 'Unknown Department';
        const expenseDateObj = expense.paymentDate ? new Date(expense.paymentDate) : new Date();
        const formattedDate = expenseDateObj.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Expense Receipt - ${expense.id || 'N/A'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0033cc; padding-bottom: 15px; }
                    .header h1 { color: #0033cc; margin: 0; font-size: 24px; }
                    .header h2 { color: #0033cc; margin: 5px 0; font-size: 18px; }
                    .receipt-info { display: flex; justify-content: space-between; margin: 20px 0; font-size: 12px; color: #666; }
                    .section-title { background: #f0f0f0; padding: 8px; text-align: center; font-weight: bold; margin: 20px 0 10px; }
                    .field { margin: 8px 0; display: flex; }
                    .field-label { width: 120px; color: #666; font-weight: bold; }
                    .field-value { flex: 1; }
                    .description { margin: 20px 0; }
                    .description-content { background: #f9f9f9; padding: 15px; border-radius: 5px; white-space: pre-wrap; }
                    .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
                    .signature-line { border-bottom: 1px solid #333; width: 200px; margin: 20px 0 10px; }
                    .generated-info { text-align: center; font-size: 10px; color: #999; margin-top: 30px; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>EXPENSE RECEIPT</h1>
                    <h2>TASSIAC CHURCH</h2>
                </div>
                
                <div class="receipt-info">
                    <span>Receipt ID: EXP-${expense.id || new Date().getTime()}</span>
                    <span>Date: ${formattedDate}</span>
                </div>

                <div class="section-title">EXPENSE DETAILS</div>
                
                <div class="field">
                    <div class="field-label">Department:</div>
                    <div class="field-value">${departmentName}</div>
                </div>
                <div class="field">
                    <div class="field-label">Amount:</div>
                    <div class="field-value">KES ${parseFloat(expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div class="field">
                    <div class="field-label">Payment Type:</div>
                    <div class="field-value">EXPENSE</div>
                </div>
                <div class="field">
                    <div class="field-label">Reference:</div>
                    <div class="field-value">${expense.reference || 'N/A'}</div>
                </div>
                <div class="field">
                    <div class="field-label">Status:</div>
                    <div class="field-value">${expense.status || 'Completed'}</div>
                </div>
                <div class="field">
                    <div class="field-label">Added By:</div>
                    <div class="field-value">${expense.processor?.fullName || `Admin #${expense.processedById}` || 'System'}</div>
                </div>

                <div class="section-title">DESCRIPTION</div>
                <div class="description">
                    <div class="description-content">${expense.description || 'No description provided'}</div>
                </div>

                <div class="footer">
                    <div class="signature-line"></div>
                    <div style="text-align: center; width: 200px;">Authorized Signature</div>
                </div>

                <div class="generated-info">
                    Generated on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;

        // Open in new window and trigger print
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait a moment for content to load, then print
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);

        this.showNotification('Expense receipt is ready for printing/saving as PDF.');
    }

    /**
     * Wrapper function to call generatePdf for a single expense.
     * @param {object} expense The expense object.
     */
    async downloadExpensePdf(expense) {
        await this.generatePdf(expense);
    }

    /**
     * Generates and downloads a PDF report for all currently filtered expenses.
     */
    async exportExpensePdf() {
        try {
            await this.loadJsPDF();
        } catch (loadError) {
            this.showNotification(loadError.message || 'Failed to load PDF library for report.', 'error');
            console.error("PDF load error for report:", loadError);
            throw loadError;
        }

        // Get all filtered expenses for report
        const allFilteredExpenses = await this.apiService.getAllAdminPayments({
            search: this.searchTerm, 
            department: this.filterDepartment, 
            startDate: this.filterStartDate, 
            endDate: this.filterEndDate,
            isExpense: 'true',
            sortBy: 'id',
            sortOrder: 'desc',
            limit: 10000 // A large limit to fetch all for report summary
        });
        const reportExpenses = allFilteredExpenses.payments.filter(p => p.isExpense === true || p.isExpense === 'true');
        // Ensure consistent sorting
        reportExpenses.sort((a, b) => (b.id || 0) - (a.id || 0));
        const reportTotalExpenses = reportExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        let filterText = '';
        if (this.filterDepartment) filterText += `Department: ${this.filterDepartment}, `;
        if (this.filterStartDate && this.filterEndDate) filterText += `Date Range: ${this.filterStartDate} to ${this.filterEndDate}, `;
        if (this.searchTerm) filterText += `Search: "${this.searchTerm}", `;
        if (filterText) {
            filterText = `Filters: ${filterText.slice(0, -2)}`;
        }

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Expense Report - TASSIAC Church</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; font-size: 12px; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0033cc; padding-bottom: 15px; }
                    .header h1 { color: #0033cc; margin: 0; font-size: 24px; }
                    .header h2 { color: #0033cc; margin: 5px 0; font-size: 18px; }
                    .report-info { margin: 20px 0; font-size: 11px; color: #666; }
                    .summary { background: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px; }
                    .summary h3 { margin: 0 0 10px; color: #0033cc; }
                    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .table th { background: #f0f0f0; padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 11px; }
                    .table td { padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; }
                    .table tbody tr:nth-child(even) { background: #f9f9f9; }
                    .amount { text-align: right; font-weight: bold; }
                    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px; }
                    @media print { 
                        body { margin: 0; font-size: 11px; }
                        .table th, .table td { font-size: 9px; padding: 4px 6px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>EXPENSE REPORT</h1>
                    <h2>TASSIAC CHURCH</h2>
                </div>
                
                <div class="report-info">
                    <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
                    ${filterText ? `<strong>${filterText}</strong>` : ''}
                </div>

                <div class="summary">
                    <h3>Summary</h3>
                    <strong>Total Expenses:</strong> KES ${reportTotalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>
                    <strong>Total Records:</strong> ${reportExpenses.length}
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th style="width: 15%;">Date</th>
                            <th style="width: 25%;">Department</th>
                            <th style="width: 20%;">Amount (KES)</th>
                            <th style="width: 40%;">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportExpenses.map(expense => {
                            const expenseDateStr = new Date(expense.paymentDate).toLocaleDateString();
                            const departmentNameStr = expense.department || 'Unknown';
                            const amountStr = parseFloat(expense.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            const descriptionStr = expense.description || '';
                            const truncatedDesc = descriptionStr.length > 50 ? descriptionStr.substring(0, 47) + '...' : descriptionStr;
                            
                            return `
                                <tr>
                                    <td>${expenseDateStr}</td>
                                    <td>${departmentNameStr}</td>
                                    <td class="amount">${amountStr}</td>
                                    <td>${truncatedDesc}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    TASSIAC Church Financial System - Expense Report
                </div>
            </body>
            </html>
        `;

        // Open in new window and trigger print
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait a moment for content to load, then print
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);

        this.showNotification('Expense report is ready for printing/saving as PDF.');
    }
    
    async fetchExpenses() {
        this.isLoading = true;
        
        try {
            const queryParams = {
                page: this.currentPage,
                limit: this.itemsPerPage,
                isExpense: 'true',
                sortBy: 'id',
                sortOrder: 'desc'
            };
            if (this.searchTerm) queryParams.search = this.searchTerm;
            if (this.filterDepartment) queryParams.department = this.filterDepartment;
            if (this.filterStartDate) queryParams.startDate = this.filterStartDate;
            if (this.filterEndDate) queryParams.endDate = this.filterEndDate;
            
            // Direct API call instead of using queue to debug the issue
            const response = await this.apiService.getAllAdminPayments(queryParams);
            
            if (response && response.payments && Array.isArray(response.payments)) {
                // Filter for expenses
                this.expenses = response.payments.filter(payment => {
                    const isExpense = payment.isExpense === true || 
                                    payment.isExpense === 'true' || 
                                    String(payment.isExpense).toLowerCase() === 'true';
                    return isExpense;
                });
                
                // Sort by ID descending as backup if API doesn't handle sorting
                this.expenses.sort((a, b) => (b.id || 0) - (a.id || 0));
                
                this.totalPages = response.totalPages || Math.ceil(this.expenses.length / this.itemsPerPage) || 1;
                this.totalExpenses = this.expenses.reduce((sum, expense) => {
                    const amount = parseFloat(expense.amount) || 0;
                    return sum + amount;
                }, 0);
                
            } else {
                this.expenses = [];
                this.totalPages = 1;
                this.totalExpenses = 0;
            }
        } catch (error) {
            this.error = `Failed to load expenses: ${error.message}. Please try again or check connectivity.`;
            this.expenses = [];
            this.totalPages = 1;
            this.totalExpenses = 0;
        } finally {
            this.isLoading = false;
        }
    }

    async fetchUsers() {
        try {
            const response = await this.apiService.getAllUsers();
            this.users = response.users || [];
        } catch (error) {
            console.error('Failed to fetch users:', error);
            this.users = []; // Default to empty array on error
        }
    }

    async fetchDepartments() {
        try {
            // Fetch a larger set of payments to derive departments, or use a dedicated endpoint if available
            const response = await this.apiService.getAllAdminPayments({ 
                limit: 1000, 
                isExpense: 'true',
                sortBy: 'id',
                sortOrder: 'desc'
            });
            
            if (response && response.payments) {
                const expensesOnly = response.payments.filter(p => p.isExpense === true || String(p.isExpense).toLowerCase() === 'true');
                const departmentSet = new Set();
                expensesOnly.forEach(expense => {
                    if (expense.department) departmentSet.add(expense.department);
                });
                this.departments = Array.from(departmentSet).sort();
                if (this.departments.length === 0) { // Fallback if no departments found
                    this.departments = ['MUSIC', 'CHILDREN', 'COMMUNICATION', 'DEVELOPMENT', 'EDUCATION', 'FAMILY', 'HEALTH', 'MINISTERIAL', 'PLANNED_GIVING', 'TREASURY', 'PUBLIC_AFFAIRS', 'PUBLISHING', 'SABBATH_SCHOOL', 'WOMEN', 'YOUTH', 'OTHER'];
                }
            } else {
                 this.departments = ['MUSIC', 'CHILDREN', 'COMMUNICATION', 'DEVELOPMENT', 'EDUCATION', 'FAMILY', 'HEALTH', 'MINISTERIAL', 'PLANNED_GIVING', 'TREASURY', 'PUBLIC_AFFAIRS', 'PUBLISHING', 'SABBATH_SCHOOL', 'WOMEN', 'YOUTH', 'OTHER'];
            }
        } catch (error) {
            console.error('Failed to fetch departments:', error);
            // Fallback departments on error
            this.departments = ['MUSIC', 'CHILDREN', 'COMMUNICATION', 'DEVELOPMENT', 'EDUCATION', 'FAMILY', 'HEALTH', 'MINISTERIAL', 'PLANNED_GIVING', 'TREASURY', 'PUBLIC_AFFAIRS', 'PUBLISHING', 'SABBATH_SCHOOL', 'WOMEN', 'YOUTH', 'OTHER'];
        }
    }
    
    async fetchPaymentStats() {
        // This method seems for a different purpose (dashboard stats maybe).
        // If it's purely for expense stats, it might be redundant if fetchExpenses calculates totals.
        try {
            const response = await this.queueApiRequest(() => this.apiService.get('/payment/stats'));
            if (response) {
                this.chartData = {
                    payments: parseFloat(response.revenue) || 0, // This might be total revenue, not just expense-related
                    expenses: parseFloat(response.expenses) || 0 // This could be the overall total expenses
                };
            }
        } catch (error) {
            console.error('Failed to fetch payment stats:', error);
            // Fallback or use calculated totals
            this.chartData = {
                payments: 0, // Or some default
                expenses: this.totalExpenses // Use the already calculated total expenses
            };
        }
    }

    async handleExpenseSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        this.error = null; // Clear previous errors
        this.success = null;

        const amount = parseFloat(formData.get('amount'));
        if (isNaN(amount) || amount <= 0) {
            this.error = 'Please enter a valid amount greater than zero.';
            this.updateView(); return;
        }
        const paymentDate = formData.get('paymentDate');
        if (!paymentDate) {
            this.error = 'Please select a valid date.';
            this.updateView(); return;
        }
        let department = formData.get('department');
        const customDepartment = formData.get('customDepartment');
        if (!department) {
            this.error = 'Please select a department.';
            this.updateView(); return;
        }
        if (department === 'custom') {
            if (!customDepartment || customDepartment.trim().length === 0) {
                this.error = 'Please enter a custom department name.';
                this.updateView(); return;
            }
            department = customDepartment.trim();
        }
        const description = formData.get('description');
        if (!description || description.trim().length === 0) {
            this.error = 'Please enter a description for the expense.';
            this.updateView(); return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="neo-spinner" style="width:1em; height:1em; border-width: .15em; display:inline-block; margin-right: .5em;"></span>Saving...';


        const expenseFormData = new FormData();
        expenseFormData.append('userId', formData.get('userId') || (this.user ? this.user.id : ''));
        expenseFormData.append('amount', amount.toString());
        expenseFormData.append('department', department);
        expenseFormData.append('description', description.trim());
        expenseFormData.append('paymentDate', paymentDate);
        expenseFormData.append('reference', formData.get('reference') || '');
        expenseFormData.append('paymentType', 'EXPENSE'); // Hardcoded as it's an expense form
        expenseFormData.append('isExpense', 'true');      // Hardcoded
        expenseFormData.append('paymentMethod', 'MANUAL'); // Assuming manual entry

        if (this.selectedFile) { // this.selectedFile is set by fileInput event listener
            expenseFormData.append('expenseReceiptImage', this.selectedFile);
        }
        
        try {
            const response = await this.apiService.uploadFile('/payment/manual', expenseFormData); // Assuming this endpoint handles file uploads
            
            if (response && response.payment) { // Check for successful payment object in response
                this.success = 'Expense added successfully!';
                this.isAddingExpense = false;
                this.selectedFile = null; // Reset selected file
                form.reset(); // Reset the form fields
                await this.loadInitialData(); // Refresh all data including expenses and departments
            } else {
                this.error = response.message || 'Failed to add expense. Unexpected response from server.';
                this.updateView();
            }
        } catch (error) {
            console.error('Error submitting expense:', error);
            this.error = error.message || 'An unexpected error occurred while adding the expense.';
            this.updateView();
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }
    
    viewExpenseDetails(expense) {
        this.currentViewingExpense = expense;
        this.isViewingExpenseDetails = true;
        this.updateView();
    }
    
    showNotification(message, type = 'success') {
        const existingNotification = document.querySelector('.neo-notification');
        if (existingNotification) existingNotification.remove(); // Remove old one first

        const notification = document.createElement('div');
        notification.className = `neo-notification ${type}`; // success or error
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✓' : '✕'}</span>
                <span class="notification-message">${message}</span>
            </div>
            <div class="notification-glow"></div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 500);
        }, 4000); // Display for 4 seconds
    }

    applyFilters() {
        console.log('AdminExpensesView: applyFilters() called');
        this.isLoading = true;
        this.updateView();
        this.fetchExpenses().finally(() => {
            this.isLoading = false;
            this.updateView();
        });
    }
    
    async updateView() {
        console.log('AdminExpensesView: updateView() called with state:', {
            isLoading: this.isLoading,
            expensesCount: this.expenses.length,
            totalExpenses: this.totalExpenses,
            dataLoaded: this.dataLoaded
        });
        
        const appContainer = document.getElementById('app');
        if (appContainer) {
            const currentScrollY = window.scrollY; // Preserve scroll position
            appContainer.innerHTML = ''; // Clear previous content
            try {
                const content = await this.render(); // Re-render the entire view
                appContainer.appendChild(content);
                window.scrollTo(0, currentScrollY); // Restore scroll position
                console.log('AdminExpensesView: View updated successfully');
            } catch (error) {
                console.error("Error during view update:", error);
                appContainer.innerHTML = `<div class="neo-alert danger" style="margin: 2rem;">Failed to update view: ${error.message}</div>`;
            }
        }
    }
    
    injectFuturisticStyles() {
        if (document.getElementById('neo-expenses-styles')) return;
        const styleElement = document.createElement('style');
        styleElement.id = 'neo-expenses-styles';
        // CSS content remains the same as provided, ensure it's complete and correct
        styleElement.textContent = `
            /* Complete dark theme for full page */
            .expense-full-page {
                background-color: #0f172a; /* slate-900 */
                color: #e2e8f0; /* slate-200 */
                margin: 0;
                padding: 0;
                min-height: 100vh;
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
                line-height: 1.6;
                position: relative;
                width: 100%;
                overflow-x: hidden;
            }
            
            body, html {
                margin: 0;
                padding: 0;
                background-color: #0f172a; /* Ensure body matches */
                min-height: 100vh;
                overflow-x: hidden; /* Prevent horizontal scroll on body */
            }
            
            .neo-app-wrapper {
                display: flex;
                flex-direction: column;
                min-height: 100vh;
                background-color: #0f172a;
                position: relative;
            }
            
            .neo-app-wrapper:before { /* Background radial gradients */
                content: "";
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: 
                    radial-gradient(circle at 20% 30%, rgba(79, 70, 229, 0.1), transparent 40%), /* indigo-600 */
                    radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.08), transparent 40%); /* violet-500 */
                z-index: -1; pointer-events: none;
            }

            .neo-app-wrapper:after { /* Background grid lines */
                content: "";
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: 
                    linear-gradient(to right, rgba(55, 65, 81, 0.1) 1px, transparent 1px), /* slate-700 */
                    linear-gradient(to bottom, rgba(55, 65, 81, 0.1) 1px, transparent 1px);
                background-size: 40px 40px;
                z-index: -1; opacity: 0.3; pointer-events: none;
            }

            .neo-top-nav {
                background: rgba(15, 23, 42, 0.85); /* Slightly more transparent */
                backdrop-filter: blur(12px);
                height: 64px; /* Increased height slightly */
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 2rem;
                border-bottom: 1px solid rgba(55, 65, 81, 0.4); /* slate-700/40 */
                position: sticky; top: 0; z-index: 100;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            }

            .neo-logo { font-size: 1.25rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; }
            .church-logo { margin-right: 0.75rem; font-size: 1.6rem; }
            .neo-nav-links { display: flex; gap: 0.5rem; } /* Reduced gap */
            .neo-nav-link { 
                color: #94a3b8; /* slate-400 */
                text-decoration: none; padding: 0.6rem 1rem; /* Adjusted padding */
                border-radius: 8px; transition: all 0.3s ease; 
                display: flex; align-items: center; font-weight: 500;
            }
            .neo-nav-link:hover { color: #f8fafc; background: rgba(55, 65, 81, 0.6); } /* slate-700/60 */
            .neo-nav-link.active { 
                color: #f8fafc; background: rgba(79, 70, 229, 0.25); /* indigo-600/25 */
                box-shadow: 0 0 10px rgba(79, 70, 229, 0.4); 
            }
            .nav-icon { margin-right: 0.5rem; }
            .neo-user-menu { display: flex; align-items: center; gap: 0.75rem; }
            .neo-avatar { 
                width: 40px; height: 40px; border-radius: 50%;
                background: linear-gradient(135deg, #4f46e5, #8b5cf6); /* indigo to violet */
                display: flex; align-items: center; justify-content: center;
                color: #f8fafc; font-weight: 700; font-size: 1rem;
                box-shadow: 0 0 12px rgba(79, 70, 229, 0.5);
            }
            .neo-username { color: #f1f5f9; /* slate-100 */ font-weight: 500; }

            .neo-content-area-full {
                flex: 1; padding: 2rem; width: 100%; 
                max-width: 1400px; /* Max width for very large screens */
                margin: 0 auto; box-sizing: border-box; /* Ensure padding is included in width */
            }
            
            :root {
                --primary-color: #4f46e5; --primary-light: #6366f1; --primary-dark: #4338ca;
                --primary-glow: rgba(79, 70, 229, 0.4);
                --secondary-color: #3730a3; --accent-color: #8b5cf6;
                --success-color: #10b981; --danger-color: #ef4444; --warning-color: #f59e0b;
                --bg-dark: #0f172a; --bg-medium: #1e293b; --bg-light: #334155;
                --text-bright: #f8fafc; --text-light: #e2e8f0; --text-muted: #94a3b8;
                --border-color: rgba(148, 163, 184, 0.2);
                --card-bg: rgba(30, 41, 59, 0.6); /* slate-800/60 */
                --card-bg-hover: rgba(30, 41, 59, 0.8);
                --glass-border: rgba(255, 255, 255, 0.1);
                --glass-shine: rgba(255, 255, 255, 0.05);
                --glass-shadow: rgba(0, 0, 0, 0.25);
                --glass-bg: rgba(30, 41, 59, 0.4); /* Added missing glass-bg */
                --input-bg: rgba(15, 23, 42, 0.7); /* slate-900/70 */
            }

            .neo-header { 
                display: flex; justify-content: space-between; align-items: center; 
                margin-bottom: 2.5rem; padding-bottom: 1rem; 
                border-bottom: 1px solid var(--border-color);
                flex-wrap: wrap; gap: 1rem; position: relative; 
            }
            .neo-title { 
                font-size: 2.25rem; font-weight: 700; margin: 0;
                background: linear-gradient(to right, var(--text-bright), var(--accent-color));
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                text-shadow: 0 0 15px var(--primary-glow);
            }

            .neo-button {
                background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
                color: var(--text-bright); border: none; border-radius: 8px;
                padding: 0.8rem 1.6rem; font-size: 0.95rem; font-weight: 500;
                cursor: pointer; position: relative; overflow: hidden;
                transition: all 0.3s ease;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
                backdrop-filter: blur(5px);
            }
            .neo-button:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 8px 20px rgba(0,0,0,0.25), 0 0 10px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.15); }
            .neo-button:active { transform: translateY(0px) scale(0.98); }
            .neo-button:before { /* Shimmer effect */
                content: ""; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
                transition: left 0.8s ease;
            }
            .neo-button:hover:before { left: 100%; }
            .neo-button.glow { box-shadow: 0 0 15px var(--primary-glow), 0 0 30px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.2); }
            .neo-button.primary { background: linear-gradient(135deg, var(--primary-color), var(--primary-dark)); }
            .neo-button.secondary { background: linear-gradient(135deg, var(--accent-color), var(--secondary-color)); }
            .neo-button.outline { 
                background: transparent; border: 1px solid var(--primary-light); 
                color: var(--primary-light); box-shadow: none;
            }
            .neo-button.outline:hover { background: rgba(79, 70, 229, 0.15); box-shadow: 0 0 10px var(--primary-glow); color: var(--text-bright); }
            .neo-button.active { /* For active filter/tab like buttons */
                background: var(--primary-color); color: var(--text-bright);
                box-shadow: 0 0 15px var(--primary-glow), inset 0 0 5px rgba(0,0,0,0.3);
            }
            .neo-button.small { padding: 0.6rem 1.2rem; font-size: 0.85rem; }
            .neo-button.icon { width: 42px; height: 42px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
            .neo-button.disabled, .neo-button:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
            .neo-button.download { background: linear-gradient(135deg, var(--success-color), var(--primary-color)); }
            .button-glow { /* For specific button glow effects, if needed */
                position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                background: radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, transparent 60%);
                animation: rotateGlow 4s infinite linear; pointer-events: none;
            }

            .actions-cell { display: flex; gap: 0.5rem; justify-content: flex-start; align-items: center; }

            .neo-card {
                background: var(--card-bg); backdrop-filter: blur(12px);
                border-radius: 16px; border: 1px solid var(--glass-border);
                box-shadow: 0 8px 30px var(--glass-shadow);
                overflow: hidden; position: relative; margin-bottom: 2.5rem;
                transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            }
            .neo-card:hover { 
                background: var(--card-bg-hover); transform: translateY(-6px); 
                box-shadow: 0 12px 40px var(--glass-shadow), 0 0 15px var(--primary-glow);
            }
            .neo-card:before { /* Top highlight */
                content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px;
                background: linear-gradient(90deg, transparent, var(--glass-shine), transparent);
            }
            .card-glow { /* General card hover glow origin */
                position: absolute; top: -150px; left: -150px; width: 300px; height: 300px;
                background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
                border-radius: 50%; opacity: 0; transition: opacity 0.5s ease;
                pointer-events: none; z-index: 0; /* Behind content */
            }
            .neo-card:hover .card-glow { opacity: 0.3; }

            .card-header { 
                padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-color);
                display: flex; justify-content: space-between; align-items: center; position: relative;
            }
            .card-header:before { /* Bottom highlight for header */
                content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
                background: linear-gradient(90deg, transparent, rgba(79, 70, 229, 0.3), transparent);
            }
            .card-header.with-actions { justify-content: space-between; }
            .card-title { margin: 0; font-size: 1.3rem; font-weight: 600; color: var(--text-bright); position: relative; z-index: 1; }
            .card-body { padding: 1.75rem; position: relative; z-index: 1; }

            .stats-section { margin-bottom: 2.5rem; }
            .neo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.75rem; }
            .stat-card { padding: 1.75rem; display: flex; align-items: center; animation: fadeInUp 0.5s ease forwards; opacity: 0; }
            .stat-icon {
                width: 64px; height: 64px; border-radius: 12px;
                display: flex; align-items: center; justify-content: center;
                margin-right: 1.25rem; font-size: 2rem; flex-shrink: 0;
                background: var(--glass-bg); border: 1px solid var(--glass-border);
                box-shadow: 0 5px 15px var(--glass-shadow); position: relative; overflow: hidden;
            }
            .hologram-icon { animation: pulse 2.5s infinite ease-in-out; position: relative; }
            .hologram-icon:before { /* Ripple effect */
                content: ""; position: absolute; top: -10px; left: -10px; right: -10px; bottom: -10px;
                border-radius: 50%; border: 1px solid rgba(255,255,255,0.15);
                animation: ripple 2.5s infinite cubic-bezier(0.65,0,0.35,1); opacity: 0;
            }
            .stat-content { flex: 1; }
            .stat-title { font-size: 0.9rem; color: var(--text-muted); margin: 0 0 0.5rem; }
            .stat-value { font-size: 1.75rem; font-weight: 700; color: var(--text-bright); margin: 0; text-shadow: 0 0 8px var(--primary-glow); }

            .search-input-wrapper { position: relative; display: flex; align-items: center; }
            .search-icon { 
                position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
                color: var(--text-muted); font-size: 1rem; pointer-events: none; 
            }
            .input-wrapper input[type="text"].neo-input, .input-wrapper input[type="search"].neo-input { padding-left: 3rem; } /* Ensure this targets correctly */
            
            .neo-actions { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2.5rem; }
            .modal-actions { margin-top: 2rem; display: flex; justify-content: center; }

            .breakdown-card { overflow: hidden; animation: fadeInUp 0.6s ease forwards; }
            .visualization-container { min-height: 250px; /* Reduced min-height */ }
            .neo-bar-chart { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0; }
            .bar-item { 
                display: grid; grid-template-columns: minmax(120px, 200px) 1fr auto; /* Adjusted department name column */
                align-items: center; gap: 1rem; animation: fadeInLeft 0.5s ease forwards; opacity: 0;
            }
            .bar-label { font-size: 0.9rem; color: var(--text-light); font-weight: 500; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .bar-value-container { flex: 1; }
            .bar-track { height: 10px; background: var(--glass-bg); border-radius: 5px; overflow: hidden; position: relative; box-shadow: inset 0 1px 3px var(--glass-shadow); }
            .bar-fill { 
                height: 100%; border-radius: 5px; position: relative; 
                box-shadow: 0 0 10px var(--primary-glow);
                transform: translateX(-100%); animation: fillBar 1s cubic-bezier(0.19,1,0.22,1) forwards; animation-delay: 0.3s; 
            }
            .bar-highlight { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.4); animation: highlightPulse 3s infinite; }
            .bar-amount { font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; }

            .filter-card { margin-bottom: 2.5rem; animation: fadeInUp 0.7s ease forwards; }
            .filter-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
            .form-group { margin-bottom: 0; /* Handled by grid gap */ }
            .form-group-full { grid-column: 1 / -1; }
            .form-label { display: block; margin-bottom: 0.6rem; font-weight: 500; font-size: 0.9rem; color: var(--text-light); }
            .input-wrapper { position: relative; }
            .neo-input {
                width: 100%; box-sizing: border-box; padding: 0.8rem 1rem; background: var(--input-bg);
                border: 1px solid var(--border-color); border-radius: 8px;
                color: var(--text-bright); font-size: 0.95rem; transition: all 0.3s ease;
                box-shadow: inset 0 2px 4px var(--glass-shadow); backdrop-filter: blur(5px);
            }
            .neo-input:focus { 
                outline: none; border-color: var(--primary-light); 
                box-shadow: 0 0 0 3px var(--primary-glow), inset 0 2px 4px var(--glass-shadow);
            }
            .neo-input::placeholder { color: var(--text-muted); opacity: 0.7; }
            .input-glow {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                border-radius: 8px; pointer-events: none; opacity: 0;
                transition: opacity 0.3s ease; box-shadow: 0 0 15px var(--primary-glow);
            }
            .neo-input:focus + .input-glow { opacity: 1; }
            .form-buttons { display: flex; align-items: flex-end; gap: 1rem; margin-top: 1.25rem; }
            .required-note { grid-column: 1 / -1; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.75rem; }
            .file-info { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; }
            
            .receipt-link { 
                color: var(--primary-light); text-decoration: none; padding: 0.3rem 0.6rem; 
                border-radius: 6px; background: rgba(79,70,229,0.1); transition: all 0.3s ease; font-size: 0.85rem;
            }
            .receipt-link:hover { background: rgba(79,70,229,0.2); color: var(--text-bright); }
            .no-receipt { color: var(--text-muted); font-style: italic; font-size: 0.85rem; }

            .neo-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; }
            
            .table-card { animation: fadeInUp 0.8s ease forwards; }
            .table-wrapper { overflow-x: auto; }
            .neo-table { width: 100%; border-collapse: separate; border-spacing: 0; }
            .neo-table th {
                padding: 1rem 1.25rem; text-align: left; font-size: 0.8rem; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); 
                background: rgba(30, 41, 59, 0.7); /* slate-800/70 */
                position: sticky; top: 0; z-index: 2; backdrop-filter: blur(8px);
            }
            .neo-table td { 
                padding: 1rem 1.25rem; font-size: 0.9rem; color: var(--text-light); 
                border-bottom: 1px solid var(--border-color); transition: background-color 0.3s ease;
            }
            .neo-table tr:hover td { background-color: rgba(55, 65, 81, 0.3); /* slate-700/30 */ }
            .neo-table tr:last-child td { border-bottom: none; }
            .text-right { text-align: right !important; } /* Ensure alignment */
            .expense-amount { font-weight: 600; color: var(--danger-color); text-shadow: 0 0 5px rgba(239,68,68,0.4); }

            .neo-pagination { 
                display: flex; justify-content: center; align-items: center; 
                padding: 1.5rem 1rem; border-top: 1px solid var(--border-color); gap: 0.75rem; flex-wrap: wrap;
            }
            .page-indicator { display: flex; gap: 0.5rem; align-items: center; }
            .page-dot { 
                width: 36px; height: 36px; border-radius: 50%; background: var(--glass-bg);
                transition: all 0.3s ease; cursor: pointer; display: flex; align-items: center; justify-content: center;
                color: var(--text-muted); font-size: 0.9rem; font-weight: 500;
            }
            .page-dot.active { 
                background: var(--primary-light); box-shadow: 0 0 10px var(--primary-glow); 
                transform: scale(1.1); color: var(--text-bright);
            }
            .page-dot:hover:not(.active) { background: var(--glass-border); color: var(--text-bright); }
            .page-ellipsis { color: var(--text-muted); padding: 0 0.25rem; }
            .page-counter { margin: 0 1rem; color: var(--text-muted); font-size: 0.9rem; }
            .icon-arrow { font-size: 0.85rem; line-height: 1; }

            .neo-modal-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15, 23, 42, 0.7); /* Darker overlay */
                display: flex; justify-content: center; align-items: center;
                z-index: 1000; padding: 1rem; /* Padding for small screens */
                backdrop-filter: blur(8px); animation: fadeIn 0.3s ease;
            }
            .neo-modal {
                background: var(--bg-medium); border-radius: 16px;
                border: 1px solid var(--glass-border);
                box-shadow: 0 20px 45px var(--glass-shadow), 0 0 0 1px var(--glass-border);
                width: 100%; max-width: 700px; max-height: 90vh;
                overflow-y: auto; /* Changed to auto for vertical scroll only if needed */
                position: relative; backdrop-filter: blur(10px); /* Inner blur */
                transform: translateY(20px) scale(0.98); opacity: 0;
                transition: all 0.4s cubic-bezier(0.19,1,0.22,1);
            }
            .neo-modal.show { transform: translateY(0) scale(1); opacity: 1; }
            .modal-header { 
                padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-color);
                display: flex; justify-content: space-between; align-items: center;
                position: sticky; top: 0; background: rgba(30, 41, 59, 0.85); /* bg-medium with alpha */
                backdrop-filter: blur(10px); z-index: 2;
            }
            .modal-title { 
                margin: 0; font-size: 1.5rem; font-weight: 600; 
                background: linear-gradient(to right, var(--text-bright), var(--accent-color));
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            }
            .close-button { 
                background: none; border: none; font-size: 1.8rem; line-height: 1;
                color: var(--text-muted); cursor: pointer; padding: 0.25rem;
                transition: all 0.2s ease; border-radius: 50%;
            }
            .close-button:hover { color: var(--text-bright); transform: rotate(90deg) scale(1.1); background: rgba(255,255,255,0.1); }
            .modal-content { padding: 1.75rem; }
            .expense-id-badge { 
                display: inline-block; padding: 0.6rem 1.2rem; border-radius: 8px;
                background: var(--glass-bg); border: 1px solid var(--glass-border);
                margin-bottom: 1.75rem; font-weight: 500; letter-spacing: 0.5px;
                color: var(--text-light); position: relative; overflow: hidden;
            }
            .expense-id-badge:before { /* Shimmer */
                content: ""; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
                background: linear-gradient(45deg, transparent, rgba(255,255,255,0.08), transparent);
                transform: rotate(30deg); animation: shimmer 3.5s infinite linear;
            }
            .details-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
            .detail-item { 
                padding: 1.25rem; background: var(--glass-bg); border-radius: 12px;
                backdrop-filter: blur(10px); border: 1px solid var(--glass-border);
                position: relative; overflow: hidden; box-shadow: 0 5px 15px var(--glass-shadow);
                transition: all 0.3s ease;
            }
            .detail-item:hover { transform: translateY(-5px) scale(1.01); box-shadow: 0 8px 20px var(--glass-shadow), 0 0 10px var(--primary-glow); }
            .detail-item:before { /* Subtle shine on hover */
                content: ""; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
                transition: left 0.6s ease; pointer-events: none;
            }
            .detail-item:hover:before { left: 100%; }
            .detail-icon { font-size: 1.6rem; margin-bottom: 0.75rem; display: block; color: var(--primary-light); }
            .detail-label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.3rem; }
            .detail-value { font-size: 1rem; font-weight: 500; color: var(--text-bright); }
            
            .description-section { margin-bottom: 2rem; }
            .description-label { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.75rem; font-weight: 500; }
            .description-terminal { 
                padding: 1.25rem; background: #0A0F1A; /* Darker terminal */
                border-radius: 10px; color: #66ff66; /* Brighter green */
                font-family: 'Fira Code', 'Courier New', monospace; font-size: 0.9rem;
                white-space: pre-wrap; word-break: break-all; position: relative;
                box-shadow: inset 0 0 15px rgba(0,0,0,0.6), 0 0 15px rgba(102,255,102,0.15);
                border: 1px solid rgba(102,255,102,0.2); line-height: 1.7;
            }
            .terminal-cursor { display: inline-block; width: 9px; height: 17px; background: #66ff66; animation: blink 1s infinite; vertical-align: text-bottom; margin-left: 5px; }

            .neo-alert {
                padding: 1.25rem 1.5rem; border-radius: 12px; margin-bottom: 1.75rem;
                font-weight: 500; backdrop-filter: blur(5px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.15);
                animation: alertPulse 3s infinite ease-in-out; position: relative; overflow: hidden;
                border: 1px solid var(--glass-border);
            }
            .neo-alert:before { /* Side accent bar */
                content: ""; position: absolute; top: 0; left: 0; width: 6px; height: 100%;
            }
            .neo-alert.success { background: rgba(16,185,129,0.2); color: #34d399; } /* green-500 */
            .neo-alert.success:before { background: linear-gradient(to bottom, #10b981, #059669); }
            .neo-alert.danger { background: rgba(239,68,68,0.2); color: #f87171; } /* red-400 */
            .neo-alert.danger:before { background: linear-gradient(to bottom, #ef4444, #dc2626); }

            .neo-notification {
                position: fixed; bottom: 25px; right: 25px; padding: 0;
                border-radius: 12px; 
                box-shadow: 0 10px 35px rgba(0,0,0,0.25), 0 0 0 1px var(--glass-border), 0 0 20px var(--primary-glow);
                color: var(--text-bright); font-size: 0.95rem; max-width: 380px;
                z-index: 1050; backdrop-filter: blur(12px); overflow: hidden;
                transform: translateX(100%) translateY(20px); opacity: 0; /* Start off-screen */
                transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1); /* Smooth bounce */
            }
            .neo-notification.show { transform: translateX(0) translateY(0); opacity: 1; }
            .neo-notification.hide { transform: translateX(120%); opacity: 0; }
            .notification-content { display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1.5rem; background: rgba(30,41,59,0.7); position: relative; z-index: 1; }
            .notification-icon { 
                width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
                border-radius: 50%; background: var(--primary-color); font-weight: 700; font-size: 1.1rem; flex-shrink: 0;
            }
            .notification-message { flex: 1; line-height: 1.4; }
            .notification-glow { /* Subtle inner glow */
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: linear-gradient(135deg, transparent 30%, var(--glass-shine) 50%, transparent 70%);
                z-index: 0; pointer-events: none; animation: shimmer 4s infinite;
            }

            .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3.5rem 2rem; text-align: center; min-height: 200px; }
            .neo-spinner-wrapper { width: 70px; height: 70px; position: relative; margin-bottom: 1.5rem; }
            .neo-spinner { width: 100%; height: 100%; position: relative; }
            .spinner-ring { 
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                border: 4px solid transparent; border-top-color: var(--primary-light); 
                border-radius: 50%; animation: spinnerRotate 1.2s cubic-bezier(0.5,0,0.5,1) infinite;
            }
            .spinner-ring:nth-child(1) { animation-delay: 0s; }
            .spinner-ring:nth-child(2) { width: 80%; height: 80%; top: 10%; left: 10%; border-top-color: var(--accent-color); animation-delay: -0.2s; }
            .spinner-ring:nth-child(3) { width: 60%; height: 60%; top: 20%; left: 20%; border-top-color: var(--primary-dark); animation-delay: -0.4s; }
            .loading-text { color: var(--text-light); font-size: 1.05rem; margin-top: 1rem; animation: pulse 1.8s infinite ease-in-out; }

            .empty-state { padding: 3.5rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; }
            .empty-icon { font-size: 3.5rem; margin-bottom: 1.5rem; position: relative; animation: floatIcon 3.5s infinite ease-in-out; }
            .empty-icon:after { /* Shadow for icon */
                content: ""; position: absolute; width: 50px; height: 12px; 
                background: var(--primary-glow); border-radius: 50%; 
                bottom: -15px; left: 50%; transform: translateX(-50%); 
                filter: blur(12px); opacity: 0.4; animation: shadowPulse 3.5s infinite ease-in-out;
            }
            .empty-title { font-size: 1.6rem; font-weight: 600; color: var(--text-bright); margin: 0 0 0.8rem; }
            .empty-text { font-size: 1rem; color: var(--text-muted); max-width: 420px; margin: 0 auto 2rem; line-height: 1.7; }

            /* Animations */
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(25px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-25px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes pulse { 0%, 100% { opacity: 0.7; transform: scale(0.98); } 50% { opacity: 1; transform: scale(1); } }
            @keyframes ripple { from { opacity: 1; transform: scale(0.7); } to { opacity: 0; transform: scale(2.2); } }
            @keyframes rotateGlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes shimmer { 0% { transform: translateX(-150%) rotate(25deg); } 100% { transform: translateX(150%) rotate(25deg); } }
            @keyframes fillBar { from { transform: translateX(-100%); } to { transform: translateX(0); } }
            @keyframes alertPulse { 0%,100% { box-shadow: 0 5px 15px rgba(0,0,0,0.15); } 50% { box-shadow: 0 5px 15px rgba(0,0,0,0.15), 0 0 18px var(--primary-glow); } }
            @keyframes blink { 0%, 49.9% { opacity: 1; } 50%, 99.9% { opacity: 0; } 100% { opacity: 1; } }
            @keyframes highlightPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }
            @keyframes spinnerRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes floatIcon { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
            @keyframes shadowPulse { 0%,100% { opacity: 0.25; width: 40px; } 50% { opacity: 0.4; width: 50px; } }

            /* Responsive Adjustments */
            @media (max-width: 1024px) { /* Tablet landscape and smaller */
                .neo-nav-links { display: none; } /* Hide full nav links, consider a burger menu if needed */
                .neo-content-area-full { padding: 1.5rem; }
                .neo-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
                .bar-item { grid-template-columns: minmax(100px, 150px) 1fr auto; gap: 0.75rem; }
            }
            @media (max-width: 768px) { /* Tablet portrait */
                .neo-top-nav { padding: 0 1rem; height: 60px; }
                .neo-logo { font-size: 1.1rem; } .church-logo { font-size: 1.4rem; }
                .neo-title { font-size: 1.8rem; }
                .neo-grid { grid-template-columns: 1fr; } /* Stack stat cards */
                .filter-form, .neo-form, .details-grid { grid-template-columns: 1fr; } /* Stack form elements */
                .form-buttons { flex-direction: column; width: 100%; }
                .form-buttons .neo-button { width: 100%; }
                .card-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
                .card-header.with-actions { flex-direction: row; align-items: center; } /* Keep actions button next to title */
                .neo-actions { flex-direction: column; }
                .neo-actions .neo-button { width: 100%; }
                .bar-item { grid-template-columns: 1fr; gap: 0.5rem; } /* Stack bar chart items */
                .bar-label { text-align: left; }
                .bar-amount { text-align: right; width: 100%; }
                .neo-modal { max-width: calc(100% - 2rem); margin: 1rem; max-height: calc(100vh - 2rem); }
            }
            @media (max-width: 480px) { /* Mobile */
                .neo-top-nav { height: 56px; }
                .neo-username { display: none; } /* Hide username on very small screens */
                .neo-content-area-full { padding: 1rem; }
                .neo-title { font-size: 1.6rem; }
                .neo-button { padding: 0.7rem 1.2rem; font-size: 0.9rem; }
                .neo-button.small { padding: 0.5rem 1rem; font-size: 0.8rem; }
                .actions-cell { flex-direction: column; align-items: flex-start; gap: 0.4rem; }
                .actions-cell .neo-button { width: 100%; text-align: center; }
                .neo-notification { left: 15px; right: 15px; bottom: 15px; max-width: none; font-size: 0.9rem; }
                .neo-table th, .neo-table td { padding: 0.75rem 0.5rem; font-size: 0.85rem; }
                .stat-icon { width: 50px; height: 50px; font-size: 1.5rem; margin-right: 1rem; }
                .stat-value { font-size: 1.5rem; }
                .page-dot { width: 32px; height: 32px; font-size: 0.8rem; }
                .neo-pagination { gap: 0.5rem; }
            }
        `;
        document.head.appendChild(styleElement);
    }
}

// Export the AdminExpensesView
export default AdminExpensesView;