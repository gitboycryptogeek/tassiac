// src/views/admin/wallets.js

export class AdminWalletsView {
    constructor() {
        this.apiService = window.apiService;
        this.authService = window.authService;
        this.user = this.authService.getUser();
        
        // Data state
        this.wallets = [];
        this.groupedWallets = {};
        this.withdrawalRequests = [];
        this.totalBalance = 0;
        this.isLoading = true;
        this.error = null;
        this.success = null;
        
        // View state
        this.isCreatingWithdrawal = false;
        this.isViewingWalletDetails = false;
        this.isApprovingWithdrawal = false;
        this.currentWallet = null;
        this.currentWithdrawal = null;
        this.selectedFile = null;
        
        // Filter state for wallet details
        this.detailsStartDate = '';
        this.detailsEndDate = '';
        this.walletTransactions = [];
        
        // Chart data for wallet details
        this.chartData = [];
        
        // Withdrawal approval state
        this.pendingApprovals = [];
        this.approvalPassword = '';
        
        this.initialLoadPromise = null;
        this.ensureDataLoaded();
    }

    ensureDataLoaded() {
        if (!this.initialLoadPromise) {
            this.initialLoadPromise = this.loadInitialData();
        }
        return this.initialLoadPromise;
    }

    async init() {
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = '';
            try {
                appContainer.innerHTML = `
                    <div class="wallet-full-page" style="background-color: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
                        <div style="text-align: center;">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">💰</div>
                            <h2 style="color: #f8fafc; margin-bottom: 1rem;">Loading Wallet System...</h2>
                            <div style="color: #94a3b8;">Please wait while we fetch your wallet data</div>
                        </div>
                    </div>
                `;
                
                await this.loadInitialData();
                const content = await this.render();
                appContainer.innerHTML = '';
                appContainer.appendChild(content);
                
            } catch (error) {
                console.error("Error during initial render:", error);
                appContainer.innerHTML = `<div class="neo-alert danger" style="margin: 2rem;">Failed to render page: ${error.message}</div>`;
            }
        }
    }

    async render() {
        await this.ensureDataLoaded();
        
        const container = document.createElement('div');
        container.className = 'wallet-full-page';
        
        try {
            this.injectWalletStyles();
            
            const appWrapper = document.createElement('div');
            appWrapper.className = 'neo-app-wrapper';
            
            const topNav = this.renderTopNavigation();
            appWrapper.appendChild(topNav);
            
            const contentArea = document.createElement('div');
            contentArea.className = 'neo-content-area-full';
            
            // Header section
            const headerSection = this.renderHeader();
            contentArea.appendChild(headerSection);
            
            // Alert messages
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
                setTimeout(() => { this.success = null; this.updateView(); }, 5000);
            }
            
            // Hero section
            const heroSection = this.renderHeroSection();
            contentArea.appendChild(heroSection);
            
            // Pending approvals section
            if (this.pendingApprovals.length > 0) {
                const approvalsSection = this.renderPendingApprovals();
                contentArea.appendChild(approvalsSection);
            }
            
            // Wallets grid
            const walletsSection = this.renderWalletsGrid();
            contentArea.appendChild(walletsSection);
            
            // Recent withdrawals
            const withdrawalsSection = this.renderRecentWithdrawals();
            contentArea.appendChild(withdrawalsSection);
            
            appWrapper.appendChild(contentArea);
            container.appendChild(appWrapper);
            
            // Modals
            if (this.isCreatingWithdrawal) {
                const withdrawalModal = this.renderWithdrawalModal();
                document.body.appendChild(withdrawalModal);
            }
            
            if (this.isViewingWalletDetails && this.currentWallet) {
                const detailsModal = this.renderWalletDetailsModal();
                document.body.appendChild(detailsModal);
            }
            
            if (this.isApprovingWithdrawal && this.currentWithdrawal) {
                const approvalModal = this.renderApprovalModal();
                document.body.appendChild(approvalModal);
            }
            
        } catch (error) {
            console.error("Error in render method:", error);
            const errorMessage = document.createElement('div');
            errorMessage.className = 'neo-alert danger';
            errorMessage.textContent = `Critical error rendering page: ${error.message}`;
            container.innerHTML = '';
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
            { text: 'Wallets', link: '/admin/wallets', icon: '💰', active: true },
            { text: 'Add Payment', link: '/admin/add-payment', icon: '💳' },
            { text: 'Payments', link: '/admin/payments', icon: '💸' },
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
        userAvatar.textContent = this.user?.fullName?.charAt(0).toUpperCase() || 'U';
        
        const userName = document.createElement('span');
        userName.className = 'neo-username';
        userName.textContent = this.user?.fullName || 'Admin User';
        
        userMenu.appendChild(userAvatar);
        userMenu.appendChild(userName);
        
        topNav.appendChild(logoArea);
        topNav.appendChild(navLinks);
        topNav.appendChild(userMenu);
        
        return topNav;
    }

    renderHeader() {
        const headerSection = document.createElement('div');
        headerSection.className = 'neo-header';
        
        const headerTitle = document.createElement('h1');
        headerTitle.textContent = 'Wallet Management';
        headerTitle.className = 'neo-title';
        
        const actionButtons = document.createElement('div');
        actionButtons.className = 'header-actions';
        
        const withdrawButton = document.createElement('button');
        withdrawButton.textContent = '💸 Request Withdrawal';
        withdrawButton.className = 'neo-button primary withdraw-btn';
        withdrawButton.addEventListener('click', () => {
            this.isCreatingWithdrawal = true;
            this.updateView();
        });
        
        const refreshButton = document.createElement('button');
        refreshButton.textContent = '🔄 Refresh';
        refreshButton.className = 'neo-button outline';
        refreshButton.addEventListener('click', () => this.refreshData());
        
        actionButtons.appendChild(withdrawButton);
        actionButtons.appendChild(refreshButton);
        
        headerSection.appendChild(headerTitle);
        headerSection.appendChild(actionButtons);
        
        return headerSection;
    }

    renderHeroSection() {
        const heroSection = document.createElement('div');
        heroSection.className = 'hero-section';
        
        const heroCard = document.createElement('div');
        heroCard.className = 'neo-card hero-card';
        
        const heroContent = document.createElement('div');
        heroContent.className = 'hero-content';
        
        const balanceSection = document.createElement('div');
        balanceSection.className = 'balance-section';
        
        const balanceLabel = document.createElement('div');
        balanceLabel.className = 'balance-label';
        balanceLabel.textContent = 'Total Church Balance';
        
        const balanceAmount = document.createElement('div');
        balanceAmount.className = 'balance-amount';
        balanceAmount.textContent = `KES ${this.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        const balanceSubtext = document.createElement('div');
        balanceSubtext.className = 'balance-subtext';
        balanceSubtext.textContent = `Across ${Object.keys(this.groupedWallets).length} wallet categories`;
        
        balanceSection.appendChild(balanceLabel);
        balanceSection.appendChild(balanceAmount);
        balanceSection.appendChild(balanceSubtext);
        
        const quickStats = document.createElement('div');
        quickStats.className = 'quick-stats';
        
        // Calculate quick stats
        const titheTotal = this.groupedWallets.TITHE ? 
            this.groupedWallets.TITHE.reduce((sum, w) => sum + w.balance, 0) : 0;
        const offeringTotal = this.groupedWallets.OFFERING ? 
            this.groupedWallets.OFFERING.reduce((sum, w) => sum + w.balance, 0) : 0;
        const specialTotal = this.groupedWallets.SPECIAL_OFFERING ? 
            this.groupedWallets.SPECIAL_OFFERING.reduce((sum, w) => sum + w.balance, 0) : 0;
        
        const stats = [
            { label: 'Tithe Funds', amount: titheTotal, icon: '📿' },
            { label: 'Offerings', amount: offeringTotal, icon: '🙏' },
            { label: 'Special Funds', amount: specialTotal, icon: '✨' }
        ];
        
        stats.forEach(stat => {
            const statItem = document.createElement('div');
            statItem.className = 'stat-item';
            statItem.innerHTML = `
                <div class="stat-icon">${stat.icon}</div>
                <div class="stat-details">
                    <div class="stat-label">${stat.label}</div>
                    <div class="stat-amount">KES ${stat.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
            `;
            quickStats.appendChild(statItem);
        });
        
        heroContent.appendChild(balanceSection);
        heroContent.appendChild(quickStats);
        
        heroCard.appendChild(heroContent);
        heroSection.appendChild(heroCard);
        
        return heroSection;
    }

    renderPendingApprovals() {
        const approvalsSection = document.createElement('div');
        approvalsSection.className = 'neo-card pending-approvals-card';
        
        const header = document.createElement('div');
        header.className = 'card-header';
        const title = document.createElement('h2');
        title.className = 'card-title';
        title.innerHTML = '⏳ Pending Withdrawal Approvals';
        header.appendChild(title);
        
        const content = document.createElement('div');
        content.className = 'card-body';
        
        const approvalsList = document.createElement('div');
        approvalsList.className = 'approvals-list';
        
        this.pendingApprovals.forEach(withdrawal => {
            const approvalItem = document.createElement('div');
            approvalItem.className = 'approval-item';
            
            const approvalInfo = document.createElement('div');
            approvalInfo.className = 'approval-info';
            approvalInfo.innerHTML = `
                <div class="approval-reference">${withdrawal.withdrawalReference}</div>
                <div class="approval-details">
                    <span class="approval-amount">KES ${withdrawal.amount.toLocaleString()}</span>
                    <span class="approval-purpose">${withdrawal.purpose}</span>
                    <span class="approval-progress">${withdrawal.currentApprovals}/${withdrawal.requiredApprovals} approvals</span>
                </div>
            `;
            
            const approveButton = document.createElement('button');
            approveButton.textContent = 'Approve';
            approveButton.className = 'neo-button primary small';
            approveButton.addEventListener('click', () => {
                this.currentWithdrawal = withdrawal;
                this.isApprovingWithdrawal = true;
                this.updateView();
            });
            
            approvalItem.appendChild(approvalInfo);
            approvalItem.appendChild(approveButton);
            approvalsList.appendChild(approvalItem);
        });
        
        content.appendChild(approvalsList);
        approvalsSection.appendChild(header);
        approvalsSection.appendChild(content);
        
        return approvalsSection;
    }

    renderWalletsGrid() {
        const walletsSection = document.createElement('div');
        walletsSection.className = 'wallets-section';
        
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'section-header';
        const sectionTitle = document.createElement('h2');
        sectionTitle.textContent = 'Wallet Categories';
        sectionHeader.appendChild(sectionTitle);
        walletsSection.appendChild(sectionHeader);
        
        if (this.isLoading) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-container';
            loadingDiv.innerHTML = `
                <div class="neo-spinner-wrapper">
                    <div class="neo-spinner">
                        <div class="spinner-ring"></div>
                        <div class="spinner-ring"></div>
                        <div class="spinner-ring"></div>
                    </div>
                </div>
                <div class="loading-text">Loading wallets...</div>
            `;
            walletsSection.appendChild(loadingDiv);
            return walletsSection;
        }
        
        const walletsGrid = document.createElement('div');
        walletsGrid.className = 'wallets-grid';
        
        Object.entries(this.groupedWallets).forEach(([category, wallets]) => {
            if (wallets.length === 0) return;
            
            const categoryCard = document.createElement('div');
            categoryCard.className = 'wallet-category-card neo-card';
            
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            
            const categoryTitle = document.createElement('h3');
            categoryTitle.className = 'category-title';
            categoryTitle.innerHTML = `${this.getCategoryIcon(category)} ${this.formatCategoryName(category)}`;
            
            const categoryTotal = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
            const categoryAmount = document.createElement('div');
            categoryAmount.className = 'category-amount';
            categoryAmount.textContent = `KES ${categoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            categoryHeader.appendChild(categoryTitle);
            categoryHeader.appendChild(categoryAmount);
            
            const walletsContainer = document.createElement('div');
            walletsContainer.className = 'wallets-container';
            
            wallets.forEach(wallet => {
                const walletItem = document.createElement('div');
                walletItem.className = 'wallet-item';
                walletItem.addEventListener('click', () => this.openWalletDetails(wallet));
                
                const walletInfo = document.createElement('div');
                walletInfo.className = 'wallet-info';
                
                const walletName = document.createElement('div');
                walletName.className = 'wallet-name';
                walletName.textContent = this.formatWalletName(wallet);
                
                const walletBalance = document.createElement('div');
                walletBalance.className = 'wallet-balance';
                walletBalance.textContent = `KES ${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                
                const walletMeta = document.createElement('div');
                walletMeta.className = 'wallet-meta';
                walletMeta.innerHTML = `
                    <span class="wallet-deposits">Deposits: KES ${wallet.totalDeposits.toLocaleString()}</span>
                    <span class="wallet-withdrawals">Withdrawals: KES ${wallet.totalWithdrawals.toLocaleString()}</span>
                `;
                
                walletInfo.appendChild(walletName);
                walletInfo.appendChild(walletBalance);
                walletInfo.appendChild(walletMeta);
                
                const viewButton = document.createElement('button');
                viewButton.className = 'wallet-view-btn';
                viewButton.innerHTML = '👁️';
                viewButton.title = 'View Details';
                
                walletItem.appendChild(walletInfo);
                walletItem.appendChild(viewButton);
                walletsContainer.appendChild(walletItem);
            });
            
            categoryCard.appendChild(categoryHeader);
            categoryCard.appendChild(walletsContainer);
            walletsGrid.appendChild(categoryCard);
        });
        
        walletsSection.appendChild(walletsGrid);
        return walletsSection;
    }

    renderRecentWithdrawals() {
        const withdrawalsSection = document.createElement('div');
        withdrawalsSection.className = 'neo-card recent-withdrawals-card';
        
        const header = document.createElement('div');
        header.className = 'card-header';
        const title = document.createElement('h2');
        title.className = 'card-title';
        title.textContent = 'Recent Withdrawals';
        header.appendChild(title);
        
        const content = document.createElement('div');
        content.className = 'card-body';
        
        if (this.withdrawalRequests.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div class="empty-icon">💸</div>
                <h3 class="empty-title">No Withdrawals Yet</h3>
                <p class="empty-text">No withdrawal requests have been made. Click "Request Withdrawal" to create your first withdrawal.</p>
            `;
            content.appendChild(emptyState);
        } else {
            const withdrawalsTable = document.createElement('div');
            withdrawalsTable.className = 'withdrawals-table';
            
            // Table header
            const tableHeader = document.createElement('div');
            tableHeader.className = 'table-header';
            tableHeader.innerHTML = `
                <div class="header-cell">Reference</div>
                <div class="header-cell">Amount</div>
                <div class="header-cell">Purpose</div>
                <div class="header-cell">Status</div>
                <div class="header-cell">Date</div>
                <div class="header-cell">Actions</div>
            `;
            withdrawalsTable.appendChild(tableHeader);
            
            // Table rows
            this.withdrawalRequests.slice(0, 10).forEach(withdrawal => {
                const row = document.createElement('div');
                row.className = 'table-row';
                
                const statusClass = withdrawal.status.toLowerCase();
                row.innerHTML = `
                    <div class="table-cell">${withdrawal.withdrawalReference}</div>
                    <div class="table-cell">KES ${withdrawal.amount.toLocaleString()}</div>
                    <div class="table-cell">${withdrawal.purpose}</div>
                    <div class="table-cell">
                        <span class="status-badge ${statusClass}">${withdrawal.status}</span>
                    </div>
                    <div class="table-cell">${new Date(withdrawal.createdAt).toLocaleDateString()}</div>
                    <div class="table-cell">
                        <button class="neo-button small outline view-withdrawal-btn" data-id="${withdrawal.id}">View</button>
                    </div>
                `;
                
                const viewBtn = row.querySelector('.view-withdrawal-btn');
                viewBtn.addEventListener('click', () => this.viewWithdrawalDetails(withdrawal));
                
                withdrawalsTable.appendChild(row);
            });
            
            content.appendChild(withdrawalsTable);
        }
        
        withdrawalsSection.appendChild(header);
        withdrawalsSection.appendChild(content);
        
        return withdrawalsSection;
    }

    renderWithdrawalModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'neo-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'neo-modal large';
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        const title = document.createElement('h2');
        title.className = 'modal-title';
        title.textContent = 'Request Withdrawal';
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => this.closeWithdrawalModal());
        header.appendChild(title);
        header.appendChild(closeButton);
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        const form = document.createElement('form');
        form.className = 'withdrawal-form';
        form.addEventListener('submit', (e) => this.handleWithdrawalSubmit(e));
        
        // Wallet selection
        const walletGroup = this.createFormGroup('Select Wallet *', 'walletId', 'select');
        const walletSelect = walletGroup.querySelector('select');
        walletSelect.required = true;
        walletSelect.innerHTML = '<option value="">Select wallet to withdraw from</option>';
        
        Object.entries(this.groupedWallets).forEach(([category, wallets]) => {
            wallets.forEach(wallet => {
                if (wallet.balance > 0) {
                    const option = document.createElement('option');
                    option.value = wallet.id;
                    option.textContent = `${this.formatWalletName(wallet)} - KES ${wallet.balance.toLocaleString()}`;
                    walletSelect.appendChild(option);
                }
            });
        });
        
        // Amount
        const amountGroup = this.createFormGroup('Amount *', 'amount', 'number');
        const amountInput = amountGroup.querySelector('input');
        amountInput.required = true;
        amountInput.min = '0.01';
        amountInput.step = '0.01';
        amountInput.placeholder = '0.00';
        
        // Purpose
        const purposeGroup = this.createFormGroup('Purpose *', 'purpose', 'text');
        const purposeInput = purposeGroup.querySelector('input');
        purposeInput.required = true;
        purposeInput.placeholder = 'Brief description of withdrawal purpose';
        
        // Withdrawal method
        const methodGroup = this.createFormGroup('Withdrawal Method *', 'withdrawalMethod', 'select');
        const methodSelect = methodGroup.querySelector('select');
        methodSelect.required = true;
        methodSelect.innerHTML = `
            <option value="">Select withdrawal method</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="MPESA">M-Pesa</option>
            <option value="CASH">Cash</option>
        `;
        
        // Bank details (conditional)
        const bankGroup = this.createFormGroup('Bank Account Number', 'destinationAccount', 'text');
        bankGroup.style.display = 'none';
        bankGroup.querySelector('input').placeholder = 'Enter bank account number';
        
        // M-Pesa details (conditional)
        const mpesaGroup = this.createFormGroup('M-Pesa Phone Number', 'destinationPhone', 'tel');
        mpesaGroup.style.display = 'none';
        mpesaGroup.querySelector('input').placeholder = '0712345678';
        
        methodSelect.addEventListener('change', (e) => {
            bankGroup.style.display = e.target.value === 'BANK_TRANSFER' ? 'block' : 'none';
            mpesaGroup.style.display = e.target.value === 'MPESA' ? 'block' : 'none';
            
            bankGroup.querySelector('input').required = e.target.value === 'BANK_TRANSFER';
            mpesaGroup.querySelector('input').required = e.target.value === 'MPESA';
        });
        
        // Description
        const descGroup = this.createFormGroup('Description *', 'description', 'textarea');
        descGroup.classList.add('form-group-full');
        const descTextarea = descGroup.querySelector('textarea');
        descTextarea.required = true;
        descTextarea.placeholder = 'Detailed description of the withdrawal...';
        descTextarea.rows = 4;
        
        // Receipt upload
        const fileGroup = this.createFormGroup('Supporting Document', 'supportingDocument', 'file');
        fileGroup.classList.add('form-group-full');
        const fileInput = fileGroup.querySelector('input');
        fileInput.accept = '.jpg,.jpeg,.png,.pdf';
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.textContent = 'Upload receipt or supporting document (max 5MB)';
        fileGroup.appendChild(fileInfo);
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    fileInfo.textContent = 'File too large. Maximum 5MB allowed.';
                    fileInfo.style.color = 'var(--danger-color)';
                    e.target.value = '';
                    this.selectedFile = null;
                    return;
                }
                this.selectedFile = file;
                fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                fileInfo.style.color = 'var(--success-color)';
            } else {
                this.selectedFile = null;
                fileInfo.textContent = 'Upload receipt or supporting document (max 5MB)';
                fileInfo.style.color = '';
            }
        });
        
        // Note about approval
        const approvalNote = document.createElement('div');
        approvalNote.className = 'approval-note form-group-full';
        approvalNote.innerHTML = `
            <div class="note-icon">ℹ️</div>
            <div class="note-text">
                <strong>Multi-Admin Approval Required</strong><br>
                This withdrawal will require approval from 3 different administrators before processing.
            </div>
        `;
        
        // Buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'form-buttons form-group-full';
        
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'neo-button outline';
        cancelButton.addEventListener('click', () => this.closeWithdrawalModal());
        
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Submit Withdrawal Request';
        submitButton.className = 'neo-button primary';
        
        buttonGroup.appendChild(cancelButton);
        buttonGroup.appendChild(submitButton);
        
        form.appendChild(walletGroup);
        form.appendChild(amountGroup);
        form.appendChild(purposeGroup);
        form.appendChild(methodGroup);
        form.appendChild(bankGroup);
        form.appendChild(mpesaGroup);
        form.appendChild(descGroup);
        form.appendChild(fileGroup);
        form.appendChild(approvalNote);
        form.appendChild(buttonGroup);
        
        content.appendChild(form);
        modal.appendChild(header);
        modal.appendChild(content);
        modalOverlay.appendChild(modal);
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) this.closeWithdrawalModal();
        });
        
        setTimeout(() => modal.classList.add('show'), 10);
        return modalOverlay;
    }

    renderWalletDetailsModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'neo-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'neo-modal extra-large';
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        const title = document.createElement('h2');
        title.className = 'modal-title';
        title.textContent = `${this.formatWalletName(this.currentWallet)} Details`;
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => this.closeWalletDetailsModal());
        header.appendChild(title);
        header.appendChild(closeButton);
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        // Wallet overview
        const overview = document.createElement('div');
        overview.className = 'wallet-overview';
        overview.innerHTML = `
            <div class="overview-stat">
                <div class="stat-label">Current Balance</div>
                <div class="stat-value">KES ${this.currentWallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="overview-stat">
                <div class="stat-label">Total Deposits</div>
                <div class="stat-value">KES ${this.currentWallet.totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="overview-stat">
                <div class="stat-label">Total Withdrawals</div>
                <div class="stat-value">KES ${this.currentWallet.totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="overview-stat">
                <div class="stat-label">Last Updated</div>
                <div class="stat-value">${new Date(this.currentWallet.lastUpdated).toLocaleDateString()}</div>
            </div>
        `;
        
        // Date filters
        const filtersSection = document.createElement('div');
        filtersSection.className = 'details-filters';
        
        const filterForm = document.createElement('form');
        filterForm.className = 'filter-form';
        
        const startDateGroup = this.createFormGroup('Start Date', 'startDate', 'date');
        const startDateInput = startDateGroup.querySelector('input');
        startDateInput.value = this.detailsStartDate;
        
        const endDateGroup = this.createFormGroup('End Date', 'endDate', 'date');
        const endDateInput = endDateGroup.querySelector('input');
        endDateInput.value = this.detailsEndDate;
        
        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.textContent = 'Apply Filters';
        applyButton.className = 'neo-button primary';
        applyButton.addEventListener('click', () => {
            this.detailsStartDate = startDateInput.value;
            this.detailsEndDate = endDateInput.value;
            this.loadWalletTransactions();
        });
        
        filterForm.appendChild(startDateGroup);
        filterForm.appendChild(endDateGroup);
        filterForm.appendChild(applyButton);
        filtersSection.appendChild(filterForm);
        
        // Chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h3>Balance Trend</h3>
            <div class="chart-canvas" id="walletChart">
                <div class="chart-placeholder">
                    <div class="chart-icon">📈</div>
                    <div class="chart-text">Loading chart data...</div>
                </div>
            </div>
        `;
        
        // Actions
        const actionsSection = document.createElement('div');
        actionsSection.className = 'modal-actions';
        
        const printButton = document.createElement('button');
        printButton.textContent = '🖨️ Print Report';
        printButton.className = 'neo-button secondary';
        printButton.addEventListener('click', () => this.printWalletReport());
        
        const downloadButton = document.createElement('button');
        downloadButton.textContent = '💾 Download Data';
        downloadButton.className = 'neo-button outline';
        downloadButton.addEventListener('click', () => this.downloadWalletData());
        
        actionsSection.appendChild(printButton);
        actionsSection.appendChild(downloadButton);
        
        content.appendChild(overview);
        content.appendChild(filtersSection);
        content.appendChild(chartContainer);
        content.appendChild(actionsSection);
        
        modal.appendChild(header);
        modal.appendChild(content);
        modalOverlay.appendChild(modal);
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) this.closeWalletDetailsModal();
        });
        
        setTimeout(() => {
            modal.classList.add('show');
            this.loadWalletTransactions();
        }, 10);
        
        return modalOverlay;
    }

    renderApprovalModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'neo-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'neo-modal';
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        const title = document.createElement('h2');
        title.className = 'modal-title';
        title.textContent = 'Approve Withdrawal';
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => this.closeApprovalModal());
        header.appendChild(title);
        header.appendChild(closeButton);
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        // Withdrawal details
        const withdrawalDetails = document.createElement('div');
        withdrawalDetails.className = 'withdrawal-details';
        withdrawalDetails.innerHTML = `
            <div class="detail-group">
                <div class="detail-label">Reference:</div>
                <div class="detail-value">${this.currentWithdrawal.withdrawalReference}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Amount:</div>
                <div class="detail-value">KES ${this.currentWithdrawal.amount.toLocaleString()}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Purpose:</div>
                <div class="detail-value">${this.currentWithdrawal.purpose}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Method:</div>
                <div class="detail-value">${this.currentWithdrawal.withdrawalMethod}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Approvals:</div>
                <div class="detail-value">${this.currentWithdrawal.currentApprovals}/${this.currentWithdrawal.requiredApprovals}</div>
            </div>
        `;
        
        // Password form
        const approvalForm = document.createElement('form');
        approvalForm.className = 'approval-form';
        approvalForm.addEventListener('submit', (e) => this.handleApprovalSubmit(e));
        
        const passwordGroup = this.createFormGroup('Withdrawal Password *', 'password', 'password');
        const passwordInput = passwordGroup.querySelector('input');
        passwordInput.required = true;
        passwordInput.placeholder = 'Enter withdrawal approval password';
        
        const commentGroup = this.createFormGroup('Comment (Optional)', 'comment', 'textarea');
        const commentTextarea = commentGroup.querySelector('textarea');
        commentTextarea.placeholder = 'Optional comment about this approval...';
        commentTextarea.rows = 3;
        
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'form-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'neo-button outline';
        cancelButton.addEventListener('click', () => this.closeApprovalModal());
        
        const approveButton = document.createElement('button');
        approveButton.type = 'submit';
        approveButton.textContent = 'Approve Withdrawal';
        approveButton.className = 'neo-button primary';
        
        buttonGroup.appendChild(cancelButton);
        buttonGroup.appendChild(approveButton);
        
        approvalForm.appendChild(passwordGroup);
        approvalForm.appendChild(commentGroup);
        approvalForm.appendChild(buttonGroup);
        
        content.appendChild(withdrawalDetails);
        content.appendChild(approvalForm);
        
        modal.appendChild(header);
        modal.appendChild(content);
        modalOverlay.appendChild(modal);
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) this.closeApprovalModal();
        });
        
        setTimeout(() => modal.classList.add('show'), 10);
        return modalOverlay;
    }

    // Utility methods for form creation
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
        inputElement.className = 'neo-input';
        
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-wrapper';
        inputWrapper.appendChild(inputElement);
        
        const inputGlow = document.createElement('div');
        inputGlow.className = 'input-glow';
        inputWrapper.appendChild(inputGlow);
        
        formGroup.appendChild(labelElement);
        formGroup.appendChild(inputWrapper);
        return formGroup;
    }

    // Helper methods
    formatCategoryName(category) {
        const names = {
            'TITHE': 'Tithe Funds',
            'OFFERING': 'Offerings',
            'DONATION': 'Donations',
            'SPECIAL_OFFERING': 'Special Offerings'
        };
        return names[category] || category;
    }

    getCategoryIcon(category) {
        const icons = {
            'TITHE': '📿',
            'OFFERING': '🙏',
            'DONATION': '💝',
            'SPECIAL_OFFERING': '✨'
        };
        return icons[category] || '💰';
    }

    formatWalletName(wallet) {
        if (wallet.subType) {
            if (wallet.walletType === 'TITHE') {
                const titheNames = {
                    'campMeetingExpenses': 'Camp Meeting Expenses',
                    'welfare': 'Welfare Fund',
                    'thanksgiving': 'Thanksgiving',
                    'stationFund': 'Station Fund',
                    'mediaMinistry': 'Media Ministry'
                };
                return titheNames[wallet.subType] || wallet.subType;
            }
            return wallet.subType;
        }
        return this.formatCategoryName(wallet.walletType);
    }

    // Data loading methods
    async loadInitialData() {
        this.isLoading = true;
        this.error = null;
        
        try {
            const [walletsResult, withdrawalsResult] = await Promise.allSettled([
                this.apiService.getAllWallets(),
                this.apiService.getWithdrawalRequests()
            ]);
            
            if (walletsResult.status === 'fulfilled') {
                this.groupedWallets = walletsResult.value.wallets || {};
                this.totalBalance = walletsResult.value.summary?.totalBalance || 0;
                
                // Flatten wallets for easier access
                this.wallets = [];
                Object.values(this.groupedWallets).forEach(categoryWallets => {
                    this.wallets.push(...categoryWallets);
                });
            } else {
                console.error('Failed to load wallets:', walletsResult.reason);
            }
            
            if (withdrawalsResult.status === 'fulfilled') {
                this.withdrawalRequests = withdrawalsResult.value.withdrawalRequests || [];
                this.pendingApprovals = this.withdrawalRequests.filter(w => w.status === 'PENDING');
            } else {
                console.error('Failed to load withdrawals:', withdrawalsResult.reason);
            }
            
        } catch (error) {
            this.error = 'Failed to load wallet data. Please refresh the page.';
            console.error('Error loading initial data:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async loadWalletTransactions() {
        if (!this.currentWallet) return;
        
        try {
            // This would ideally be a dedicated endpoint for wallet transactions
            // For now, we'll simulate with payment data filtered by wallet type
            const params = {
                paymentType: this.currentWallet.walletType,
                limit: 100
            };
            
            if (this.detailsStartDate) params.startDate = this.detailsStartDate;
            if (this.detailsEndDate) params.endDate = this.detailsEndDate;
            
            const response = await this.apiService.getAllAdminPayments(params);
            this.walletTransactions = response.payments || [];
            
            // Generate chart data
            this.generateChartData();
            this.renderChart();
            
        } catch (error) {
            console.error('Error loading wallet transactions:', error);
        }
    }

    generateChartData() {
        // Group transactions by date and calculate running balance
        const transactionsByDate = {};
        
        this.walletTransactions.forEach(transaction => {
            const date = new Date(transaction.paymentDate).toDateString();
            if (!transactionsByDate[date]) {
                transactionsByDate[date] = { deposits: 0, withdrawals: 0 };
            }
            
            if (transaction.isExpense) {
                transactionsByDate[date].withdrawals += parseFloat(transaction.amount);
            } else {
                transactionsByDate[date].deposits += parseFloat(transaction.amount);
            }
        });
        
        // Convert to chart data with running balance
        let runningBalance = 0;
        this.chartData = Object.entries(transactionsByDate)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .map(([date, data]) => {
                runningBalance += data.deposits - data.withdrawals;
                return {
                    date,
                    balance: runningBalance,
                    deposits: data.deposits,
                    withdrawals: data.withdrawals
                };
            });
    }

    renderChart() {
        const chartCanvas = document.getElementById('walletChart');
        if (!chartCanvas || this.chartData.length === 0) return;
        
        // Simple SVG chart
        const chartSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chartSvg.setAttribute('width', '100%');
        chartSvg.setAttribute('height', '200');
        chartSvg.setAttribute('viewBox', '0 0 800 200');
        
        if (this.chartData.length > 1) {
            const maxBalance = Math.max(...this.chartData.map(d => d.balance));
            const minBalance = Math.min(...this.chartData.map(d => d.balance));
            const balanceRange = maxBalance - minBalance || 1;
            
            let pathData = '';
            this.chartData.forEach((point, index) => {
                const x = (index / (this.chartData.length - 1)) * 750 + 25;
                const y = 175 - ((point.balance - minBalance) / balanceRange) * 150;
                pathData += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
            });
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', '#4f46e5');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            
            chartSvg.appendChild(path);
        }
        
        chartCanvas.innerHTML = '';
        chartCanvas.appendChild(chartSvg);
    }

    // Event handlers
    async handleWithdrawalSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        this.error = null;
        this.success = null;
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Creating Request...';
        
        try {
            const withdrawalData = {
                walletId: parseInt(formData.get('walletId')),
                amount: parseFloat(formData.get('amount')),
                purpose: formData.get('purpose'),
                description: formData.get('description'),
                withdrawalMethod: formData.get('withdrawalMethod'),
                destinationAccount: formData.get('destinationAccount') || null,
                destinationPhone: formData.get('destinationPhone') || null
            };
            
            const response = await this.apiService.createWithdrawalRequest(withdrawalData);
            
            if (response && response.withdrawalRequest) {
                this.success = 'Withdrawal request created successfully! Waiting for approvals.';
                this.isCreatingWithdrawal = false;
                this.selectedFile = null;
                await this.loadInitialData();
                this.updateView();
            }
        } catch (error) {
            this.error = error.message || 'Failed to create withdrawal request.';
            this.updateView();
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    async handleApprovalSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Approving...';
        
        try {
            const approvalData = {
                password: formData.get('password'),
                comment: formData.get('comment') || null
            };
            
            const response = await this.apiService.approveWithdrawalRequest(
                this.currentWithdrawal.id, 
                approvalData
            );
            
            if (response) {
                if (response.processed) {
                    this.success = 'Withdrawal approved and processed successfully!';
                } else {
                    this.success = `Approval recorded. ${response.requiredApprovals - response.currentApprovals} more approvals needed.`;
                }
                
                this.isApprovingWithdrawal = false;
                this.currentWithdrawal = null;
                await this.loadInitialData();
                this.updateView();
            }
        } catch (error) {
            this.error = error.message || 'Failed to approve withdrawal.';
            this.updateView();
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    }

    // Modal control methods
    openWalletDetails(wallet) {
        this.currentWallet = wallet;
        this.isViewingWalletDetails = true;
        this.detailsStartDate = '';
        this.detailsEndDate = '';
        this.updateView();
    }

    closeWithdrawalModal() {
        this.isCreatingWithdrawal = false;
        this.selectedFile = null;
        this.error = null;
        this.updateView();
    }

    closeWalletDetailsModal() {
        this.isViewingWalletDetails = false;
        this.currentWallet = null;
        this.walletTransactions = [];
        this.chartData = [];
        this.updateView();
    }

    closeApprovalModal() {
        this.isApprovingWithdrawal = false;
        this.currentWithdrawal = null;
        this.approvalPassword = '';
        this.updateView();
    }

    // Utility methods
    async refreshData() {
        await this.loadInitialData();
        this.success = 'Data refreshed successfully.';
        this.updateView();
    }

    viewWithdrawalDetails(withdrawal) {
        // For now, just show an alert with details
        // This could be expanded to a full modal
        alert(`
            Reference: ${withdrawal.withdrawalReference}
            Amount: KES ${withdrawal.amount.toLocaleString()}
            Purpose: ${withdrawal.purpose}
            Status: ${withdrawal.status}
            Method: ${withdrawal.withdrawalMethod}
            Date: ${new Date(withdrawal.createdAt).toLocaleDateString()}
        `);
    }

    printWalletReport() {
        if (!this.currentWallet) return;
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Wallet Report - ${this.formatWalletName(this.currentWallet)}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0033cc; padding-bottom: 15px; }
                    .header h1 { color: #0033cc; margin: 0; font-size: 24px; }
                    .overview { display: flex; justify-content: space-between; margin: 20px 0; }
                    .stat { text-align: center; }
                    .stat-label { font-size: 12px; color: #666; }
                    .stat-value { font-size: 18px; font-weight: bold; color: #0033cc; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>WALLET REPORT</h1>
                    <h2>${this.formatWalletName(this.currentWallet)}</h2>
                    <p>Generated on ${new Date().toLocaleDateString()}</p>
                </div>
                
                <div class="overview">
                    <div class="stat">
                        <div class="stat-label">Current Balance</div>
                        <div class="stat-value">KES ${this.currentWallet.balance.toLocaleString()}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Total Deposits</div>
                        <div class="stat-value">KES ${this.currentWallet.totalDeposits.toLocaleString()}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Total Withdrawals</div>
                        <div class="stat-value">KES ${this.currentWallet.totalWithdrawals.toLocaleString()}</div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 40px; font-size: 10px; color: #999;">
                    TASSIAC Church Financial System - Wallet Report
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }

    downloadWalletData() {
        if (!this.currentWallet) return;
        
        const csvData = [
            ['Wallet Report'],
            ['Wallet Name', this.formatWalletName(this.currentWallet)],
            ['Current Balance', this.currentWallet.balance],
            ['Total Deposits', this.currentWallet.totalDeposits],
            ['Total Withdrawals', this.currentWallet.totalWithdrawals],
            ['Last Updated', this.currentWallet.lastUpdated],
            ['Generated On', new Date().toISOString()]
        ];
        
        const csvContent = csvData.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallet-${this.formatWalletName(this.currentWallet).replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    async updateView() {
        const appContainer = document.getElementById('app');
        if (appContainer) {
            const currentScrollY = window.scrollY;
            appContainer.innerHTML = '';
            try {
                const content = await this.render();
                appContainer.appendChild(content);
                window.scrollTo(0, currentScrollY);
            } catch (error) {
                console.error("Error during view update:", error);
                appContainer.innerHTML = `<div class="neo-alert danger" style="margin: 2rem;">Failed to update view: ${error.message}</div>`;
            }
        }
    }

    injectWalletStyles() {
        if (document.getElementById('neo-wallet-styles')) return;
        const styleElement = document.createElement('style');
        styleElement.id = 'neo-wallet-styles';
        styleElement.textContent = `
            /* Wallet-specific styles extending the base neo styles */
            .wallet-full-page {
                background-color: #0f172a;
                color: #e2e8f0;
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
                background-color: #0f172a;
                min-height: 100vh;
                overflow-x: hidden;
            }
            
            .neo-app-wrapper {
                display: flex;
                flex-direction: column;
                min-height: 100vh;
                background-color: #0f172a;
                position: relative;
            }
            
            .neo-app-wrapper:before {
                content: "";
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: 
                    radial-gradient(circle at 20% 30%, rgba(79, 70, 229, 0.1), transparent 40%),
                    radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.08), transparent 40%);
                z-index: -1; pointer-events: none;
            }

            .neo-app-wrapper:after {
                content: "";
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: 
                    linear-gradient(to right, rgba(55, 65, 81, 0.1) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(55, 65, 81, 0.1) 1px, transparent 1px);
                background-size: 40px 40px;
                z-index: -1; opacity: 0.3; pointer-events: none;
            }

            .neo-top-nav {
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(12px);
                height: 64px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 2rem;
                border-bottom: 1px solid rgba(55, 65, 81, 0.4);
                position: sticky; top: 0; z-index: 100;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            }

            .neo-logo { font-size: 1.25rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; }
            .church-logo { margin-right: 0.75rem; font-size: 1.6rem; }
            .neo-nav-links { display: flex; gap: 0.5rem; }
            .neo-nav-link { 
                color: #94a3b8;
                text-decoration: none; padding: 0.6rem 1rem;
                border-radius: 8px; transition: all 0.3s ease; 
                display: flex; align-items: center; font-weight: 500;
            }
            .neo-nav-link:hover { color: #f8fafc; background: rgba(55, 65, 81, 0.6); }
            .neo-nav-link.active { 
                color: #f8fafc; background: rgba(79, 70, 229, 0.25);
                box-shadow: 0 0 10px rgba(79, 70, 229, 0.4); 
            }
            .nav-icon { margin-right: 0.5rem; }
            .neo-user-menu { display: flex; align-items: center; gap: 0.75rem; }
            .neo-avatar { 
                width: 40px; height: 40px; border-radius: 50%;
                background: linear-gradient(135deg, #4f46e5, #8b5cf6);
                display: flex; align-items: center; justify-content: center;
                color: #f8fafc; font-weight: 700; font-size: 1rem;
                box-shadow: 0 0 12px rgba(79, 70, 229, 0.5);
            }
            .neo-username { color: #f1f5f9; font-weight: 500; }

            .neo-content-area-full {
                flex: 1; padding: 2rem; width: 100%; 
                max-width: 1400px;
                margin: 0 auto; box-sizing: border-box;
            }
            
            :root {
                --primary-color: #4f46e5; --primary-light: #6366f1; --primary-dark: #4338ca;
                --primary-glow: rgba(79, 70, 229, 0.4);
                --secondary-color: #3730a3; --accent-color: #8b5cf6;
                --success-color: #10b981; --danger-color: #ef4444; --warning-color: #f59e0b;
                --bg-dark: #0f172a; --bg-medium: #1e293b; --bg-light: #334155;
                --text-bright: #f8fafc; --text-light: #e2e8f0; --text-muted: #94a3b8;
                --border-color: rgba(148, 163, 184, 0.2);
                --card-bg: rgba(30, 41, 59, 0.6);
                --card-bg-hover: rgba(30, 41, 59, 0.8);
                --glass-border: rgba(255, 255, 255, 0.1);
                --glass-shine: rgba(255, 255, 255, 0.05);
                --glass-shadow: rgba(0, 0, 0, 0.25);
                --glass-bg: rgba(30, 41, 59, 0.4);
                --input-bg: rgba(15, 23, 42, 0.7);
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

            .header-actions {
                display: flex; gap: 1rem; align-items: center;
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
            .neo-button.primary { background: linear-gradient(135deg, var(--primary-color), var(--primary-dark)); }
            .neo-button.secondary { background: linear-gradient(135deg, var(--accent-color), var(--secondary-color)); }
            .neo-button.outline { 
                background: transparent; border: 1px solid var(--primary-light); 
                color: var(--primary-light); box-shadow: none;
            }
            .neo-button.outline:hover { background: rgba(79, 70, 229, 0.15); box-shadow: 0 0 10px var(--primary-glow); color: var(--text-bright); }
            .neo-button.small { padding: 0.6rem 1.2rem; font-size: 0.85rem; }
            .neo-button:disabled { opacity: 0.5; cursor: not-allowed; }

            .withdraw-btn {
                background: linear-gradient(135deg, var(--danger-color), #dc2626);
            }

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

            .card-header { 
                padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-color);
                display: flex; justify-content: space-between; align-items: center; position: relative;
            }
            .card-title { margin: 0; font-size: 1.3rem; font-weight: 600; color: var(--text-bright); }
            .card-body { padding: 1.75rem; position: relative; z-index: 1; }

            /* Hero Section */
            .hero-section {
                margin-bottom: 3rem;
            }

            .hero-card {
                background: linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(139, 92, 246, 0.1));
                border: 1px solid rgba(79, 70, 229, 0.3);
                margin-bottom: 0;
            }

            .hero-content {
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 3rem;
                align-items: center;
            }

            .balance-section {
                text-align: center;
            }

            .balance-label {
                font-size: 1rem;
                color: var(--text-muted);
                margin-bottom: 0.5rem;
            }

            .balance-amount {
                font-size: 3rem;
                font-weight: 800;
                color: var(--text-bright);
                text-shadow: 0 0 20px var(--primary-glow);
                margin-bottom: 0.5rem;
            }

            .balance-subtext {
                font-size: 0.9rem;
                color: var(--text-muted);
            }

            .quick-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1.5rem;
            }

            .stat-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                border: 1px solid var(--glass-border);
            }

            .stat-icon {
                font-size: 2rem;
                width: 50px;
                height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(79, 70, 229, 0.2);
                border-radius: 50%;
                flex-shrink: 0;
            }

            .stat-details {
                flex: 1;
            }

            .stat-label {
                font-size: 0.8rem;
                color: var(--text-muted);
                margin-bottom: 0.25rem;
            }

            .stat-amount {
                font-size: 1rem;
                font-weight: 600;
                color: var(--text-bright);
            }

            /* Pending Approvals */
            .pending-approvals-card {
                background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.1));
                border: 1px solid rgba(245, 158, 11, 0.3);
            }

            .approvals-list {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .approval-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                border: 1px solid var(--glass-border);
            }

            .approval-info {
                flex: 1;
            }

            .approval-reference {
                font-weight: 600;
                color: var(--text-bright);
                margin-bottom: 0.5rem;
            }

            .approval-details {
                display: flex;
                gap: 1rem;
                flex-wrap: wrap;
            }

            .approval-amount {
                color: var(--warning-color);
                font-weight: 600;
            }

            .approval-purpose {
                color: var(--text-light);
            }

            .approval-progress {
                color: var(--text-muted);
                font-size: 0.9rem;
            }

            /* Wallets Grid */
            .wallets-section {
                margin-bottom: 3rem;
            }

            .section-header {
                margin-bottom: 2rem;
            }

            .section-header h2 {
                font-size: 1.8rem;
                font-weight: 600;
                color: var(--text-bright);
                margin: 0;
            }

            .wallets-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 2rem;
            }

            .wallet-category-card {
                margin-bottom: 0;
            }

            .category-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                border-bottom: 1px solid var(--border-color);
                background: rgba(79, 70, 229, 0.1);
            }

            .category-title {
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--text-bright);
                margin: 0;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .category-amount {
                font-size: 1.1rem;
                font-weight: 700;
                color: var(--primary-light);
            }

            .wallets-container {
                padding: 1rem;
            }

            .wallet-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem;
                margin-bottom: 0.75rem;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid var(--glass-border);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .wallet-item:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: var(--primary-light);
                transform: translateX(5px);
            }

            .wallet-item:last-child {
                margin-bottom: 0;
            }

            .wallet-info {
                flex: 1;
            }

            .wallet-name {
                font-weight: 600;
                color: var(--text-bright);
                margin-bottom: 0.25rem;
            }

            .wallet-balance {
                font-size: 1.1rem;
                font-weight: 700;
                color: var(--success-color);
                margin-bottom: 0.5rem;
            }

            .wallet-meta {
                display: flex;
                gap: 1rem;
                font-size: 0.8rem;
                color: var(--text-muted);
            }

            .wallet-view-btn {
                background: none;
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 50%;
                color: var(--text-muted);
                transition: all 0.3s ease;
            }

            .wallet-view-btn:hover {
                background: rgba(79, 70, 229, 0.2);
                color: var(--primary-light);
            }

            /* Recent Withdrawals */
            .recent-withdrawals-card {
                margin-bottom: 0;
            }

            .withdrawals-table {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .table-header {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
                gap: 1rem;
                padding: 1rem;
                background: rgba(79, 70, 229, 0.1);
                border-radius: 8px;
                font-weight: 600;
                color: var(--text-bright);
                font-size: 0.9rem;
            }

            .table-row {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
                gap: 1rem;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid var(--glass-border);
                border-radius: 8px;
                align-items: center;
                transition: all 0.3s ease;
            }

            .table-row:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: var(--primary-light);
            }

            .header-cell, .table-cell {
                font-size: 0.9rem;
            }

            .table-cell {
                color: var(--text-light);
            }

            .status-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 500;
                text-transform: uppercase;
            }

            .status-badge.pending {
                background: rgba(245, 158, 11, 0.2);
                color: #fbbf24;
                border: 1px solid rgba(245, 158, 11, 0.3);
            }

            .status-badge.completed {
                background: rgba(16, 185, 129, 0.2);
                color: #34d399;
                border: 1px solid rgba(16, 185, 129, 0.3);
            }

            .status-badge.rejected {
                background: rgba(239, 68, 68, 0.2);
                color: #f87171;
                border: 1px solid rgba(239, 68, 68, 0.3);
            }

            /* Modal Styles */
            .neo-modal-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15, 23, 42, 0.8);
                display: flex; justify-content: center; align-items: center;
                z-index: 1000; padding: 1rem;
                backdrop-filter: blur(8px); animation: fadeIn 0.3s ease;
            }

            .neo-modal {
                background: var(--bg-medium); border-radius: 16px;
                border: 1px solid var(--glass-border);
                box-shadow: 0 20px 45px var(--glass-shadow), 0 0 0 1px var(--glass-border);
                width: 100%; max-width: 600px; max-height: 90vh;
                overflow-y: auto; position: relative; backdrop-filter: blur(10px);
                transform: translateY(20px) scale(0.98); opacity: 0;
                transition: all 0.4s cubic-bezier(0.19,1,0.22,1);
            }

            .neo-modal.large {
                max-width: 800px;
            }

            .neo-modal.extra-large {
                max-width: 1000px;
            }

            .neo-modal.show { transform: translateY(0) scale(1); opacity: 1; }

            .modal-header { 
                padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-color);
                display: flex; justify-content: space-between; align-items: center;
                position: sticky; top: 0; background: rgba(30, 41, 59, 0.85);
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

            /* Form Styles */
            .withdrawal-form, .approval-form {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1.5rem;
            }

            .form-group { margin-bottom: 0; }
            .form-group-full { grid-column: 1 / -1; }

            .form-label { 
                display: block; margin-bottom: 0.6rem; font-weight: 500; 
                font-size: 0.9rem; color: var(--text-light); 
            }

            .input-wrapper { position: relative; }

            .neo-input {
                width: 100%; box-sizing: border-box; padding: 0.8rem 1rem; 
                background: var(--input-bg); border: 1px solid var(--border-color); 
                border-radius: 8px; color: var(--text-bright); font-size: 0.95rem; 
                transition: all 0.3s ease; box-shadow: inset 0 2px 4px var(--glass-shadow); 
                backdrop-filter: blur(5px);
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

            .form-buttons { 
                display: flex; gap: 1rem; margin-top: 1.25rem; 
                grid-column: 1 / -1; justify-content: flex-end;
            }

            .file-info { 
                font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; 
            }

            .approval-note {
                display: flex;
                gap: 1rem;
                padding: 1rem;
                background: rgba(79, 70, 229, 0.1);
                border: 1px solid rgba(79, 70, 229, 0.2);
                border-radius: 8px;
                margin-top: 1rem;
            }

            .note-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
            }

            .note-text {
                color: var(--text-light);
                font-size: 0.9rem;
                line-height: 1.5;
            }

            /* Wallet Details Modal */
            .wallet-overview {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .overview-stat {
                text-align: center;
                padding: 1.5rem;
                background: rgba(79, 70, 229, 0.1);
                border: 1px solid rgba(79, 70, 229, 0.2);
                border-radius: 8px;
            }

            .details-filters {
                margin-bottom: 2rem;
                padding: 1.5rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
                border: 1px solid var(--glass-border);
            }

            .filter-form {
                display: flex;
                gap: 1rem;
                align-items: end;
            }

            .chart-container {
                margin-bottom: 2rem;
            }

            .chart-container h3 {
                color: var(--text-bright);
                margin-bottom: 1rem;
                font-size: 1.2rem;
            }

            .chart-canvas {
                height: 200px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid var(--glass-border);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .chart-placeholder {
                text-align: center;
                color: var(--text-muted);
            }

            .chart-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
            }

            .modal-actions {
                display: flex;
                gap: 1rem;
                justify-content: center;
                margin-top: 2rem;
            }

            /* Approval Modal */
            .withdrawal-details {
                margin-bottom: 2rem;
                padding: 1.5rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
                border: 1px solid var(--glass-border);
            }

            .detail-group {
                display: flex;
                justify-content: space-between;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--border-color);
            }

            .detail-group:last-child {
                margin-bottom: 0;
                border-bottom: none;
            }

            .detail-label {
                font-weight: 500;
                color: var(--text-muted);
            }

            .detail-value {
                font-weight: 600;
                color: var(--text-bright);
            }

            /* Loading and Empty States */
            .loading-container { 
                display: flex; flex-direction: column; align-items: center; 
                justify-content: center; padding: 3.5rem 2rem; text-align: center; 
                min-height: 200px; 
            }
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

            .empty-state { 
                padding: 3.5rem 2rem; text-align: center; display: flex; 
                flex-direction: column; align-items: center; justify-content: center; 
                min-height: 200px; 
            }
            .empty-icon { 
                font-size: 3.5rem; margin-bottom: 1.5rem; position: relative; 
                animation: floatIcon 3.5s infinite ease-in-out; 
            }
            .empty-title { 
                font-size: 1.6rem; font-weight: 600; color: var(--text-bright); 
                margin: 0 0 0.8rem; 
            }
            .empty-text { 
                font-size: 1rem; color: var(--text-muted); max-width: 420px; 
                margin: 0 auto; line-height: 1.7; 
            }

            /* Alerts */
            .neo-alert {
                padding: 1.25rem 1.5rem; border-radius: 12px; margin-bottom: 1.75rem;
                font-weight: 500; backdrop-filter: blur(5px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.15);
                position: relative; overflow: hidden;
                border: 1px solid var(--glass-border);
            }
            .neo-alert:before {
                content: ""; position: absolute; top: 0; left: 0; width: 6px; height: 100%;
            }
            .neo-alert.success { background: rgba(16,185,129,0.2); color: #34d399; }
            .neo-alert.success:before { background: linear-gradient(to bottom, #10b981, #059669); }
            .neo-alert.danger { background: rgba(239,68,68,0.2); color: #f87171; }
            .neo-alert.danger:before { background: linear-gradient(to bottom, #ef4444, #dc2626); }

            /* Animations */
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
            @keyframes spinnerRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes floatIcon { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }

            /* Responsive Design */
            @media (max-width: 1024px) {
                .neo-nav-links { display: none; }
                .neo-content-area-full { padding: 1.5rem; }
                .hero-content { grid-template-columns: 1fr; gap: 2rem; }
                .balance-amount { font-size: 2.5rem; }
                .wallets-grid { grid-template-columns: 1fr; }
                .quick-stats { grid-template-columns: 1fr; }
            }

            @media (max-width: 768px) {
                .neo-top-nav { padding: 0 1rem;height: 60px;
                flex-direction: column;
                gap: 0.5rem;
                align-items: flex-start;
            }
            .neo-logo {
                font-size: 1rem;
            }
            .church-logo {
                margin-right: 0.5rem;
                font-size: 1.4rem;
            }
            .neo-nav-links {
                display: none;
            }
            .neo-user-menu {
                position: absolute;
                top: 0.5rem;
                right: 1rem;
                gap: 0.5rem;
            }
            .neo-avatar {
                width: 32px;
                height: 32px;
                font-size: 0.9rem;
            }
            .neo-username {
                display: none;
            }
            .neo-content-area-full {
                padding: 1rem;
            }
            .neo-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 1rem;
            }
            .neo-title {
                font-size: 1.8rem;
            }
            .header-actions {
                width: 100%;
                justify-content: space-between;
            }
            .hero-content {
                grid-template-columns: 1fr;
                gap: 1.5rem;
                text-align: center;
            }
            .balance-amount {
                font-size: 2rem;
            }
            .quick-stats {
                grid-template-columns: 1fr;
                gap: 1rem;
            }
            .stat-item {
                flex-direction: column;
                text-align: center;
                gap: 0.75rem;
            }
            .wallets-grid {
                grid-template-columns: 1fr;
                gap: 1.5rem;
            }
            .category-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.5rem;
            }
            .table-header,
            .table-row {
                grid-template-columns: 1fr;
                gap: 0.5rem;
            }
            .table-row {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                padding: 1rem;
            }
            .header-cell,
            .table-cell {
                font-size: 0.8rem;
                padding: 0.25rem 0;
            }
            .table-cell:before {
                content: attr(data-label) ": ";
                font-weight: 600;
                color: var(--text-muted);
                display: inline-block;
                margin-right: 0.5rem;
            }
            .neo-modal {
                max-width: 95vw;
                margin: 0.5rem;
            }
            .withdrawal-form,
            .approval-form {
                grid-template-columns: 1fr;
            }
            .filter-form {
                flex-direction: column;
                gap: 1rem;
            }
            .modal-actions {
                flex-direction: column;
                gap: 0.75rem;
            }
            .form-buttons {
                flex-direction: column;
                gap: 0.75rem;
            }
            .neo-button {
                padding: 0.75rem 1.25rem;
                font-size: 0.9rem;
            }
            .overview-stat {
                padding: 1rem;
            }
            .details-filters {
                padding: 1rem;
            }
        }

        @media (max-width: 480px) {
            .neo-content-area-full {
                padding: 0.75rem;
            }
            .neo-title {
                font-size: 1.5rem;
            }
            .balance-amount {
                font-size: 1.8rem;
            }
            .header-actions {
                flex-direction: column;
                gap: 0.75rem;
            }
            .neo-button {
                width: 100%;
                justify-content: center;
            }
            .wallet-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.75rem;
            }
            .wallet-view-btn {
                align-self: flex-end;
            }
            .approval-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 1rem;
            }
            .approval-details {
                flex-direction: column;
                gap: 0.5rem;
            }
            .detail-group {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.25rem;
            }
            .stat-icon {
                width: 40px;
                height: 40px;
                font-size: 1.5rem;
            }
        }

        /* Print Styles */
        @media print {
            .neo-top-nav,
            .header-actions,
            .modal-actions,
            .form-buttons,
            .wallet-view-btn,
            .neo-button {
                display: none !important;
            }
            .neo-content-area-full {
                padding: 0;
                max-width: none;
            }
            .neo-card {
                box-shadow: none;
                border: 1px solid #ddd;
                page-break-inside: avoid;
            }
            .hero-section {
                page-break-after: avoid;
            }
            .wallets-grid {
                page-break-inside: avoid;
            }
        }

        /* Animation Keyframes */
        @keyframes slideInModal {
            from {
                opacity: 0;
                transform: translateY(-50px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes slideOutModal {
            from {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            to {
                opacity: 0;
                transform: translateY(-50px) scale(0.9);
            }
        }

        @keyframes balanceCountUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes cardHover {
            from { transform: translateY(0); }
            to { transform: translateY(-6px); }
        }

        @keyframes progressFill {
            from { width: 0%; }
            to { width: var(--progress-width, 0%); }
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: rgba(55, 65, 81, 0.3);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
            background: rgba(79, 70, 229, 0.6);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: rgba(79, 70, 229, 0.8);
        }

        /* Focus States for Accessibility */
        .neo-button:focus,
        .neo-input:focus,
        .wallet-item:focus,
        .approval-item:focus {
            outline: 2px solid var(--primary-light);
            outline-offset: 2px;
        }

        /* High Contrast Mode Support */
        @media (prefers-contrast: high) {
            .neo-card {
                border-width: 2px;
            }
            .status-badge {
                border-width: 2px;
            }
            .neo-button {
                border: 2px solid currentColor;
            }
        }

        /* Reduced Motion Support */
        @media (prefers-reduced-motion: reduce) {
            .neo-card,
            .wallet-item,
            .neo-button,
            .neo-modal {
                transition: none;
            }
            .neo-spinner {
                animation: none;
            }
        }

        /* Dark Mode Variables Override */
        @media (prefers-color-scheme: dark) {
            :root {
                --bg-dark: #000814;
                --bg-medium: #001122;
                --bg-light: #002244;
                --text-bright: #f8fafc;
                --text-light: #e2e8f0;
                --text-muted: #94a3b8;
            }
        }
        `;
        
        document.head.appendChild(styleElement);
        console.log('💄 Wallet-specific styles injected successfully');
    }

    // ================================================================================================
    // ADVANCED UTILITY METHODS
    // ================================================================================================

    /**
     * Calculate wallet analytics for dashboard display
     * @returns {Object} Wallet analytics data
     */
    calculateWalletAnalytics() {
        if (!this.wallets || this.wallets.length === 0) {
            return {
                totalBalance: 0,
                averageBalance: 0,
                topWallet: null,
                balanceDistribution: [],
                monthlyGrowth: 0
            };
        }

        const totalBalance = this.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
        const averageBalance = totalBalance / this.wallets.length;
        const topWallet = this.wallets.reduce((max, wallet) => 
            wallet.balance > (max?.balance || 0) ? wallet : max, null);

        const balanceDistribution = Object.entries(this.groupedWallets).map(([category, wallets]) => ({
            category: this.formatCategoryName(category),
            total: wallets.reduce((sum, wallet) => sum + wallet.balance, 0),
            count: wallets.length
        }));

        return {
            totalBalance,
            averageBalance,
            topWallet,
            balanceDistribution,
            monthlyGrowth: 0 // Could be calculated with historical data
        };
    }

    /**
     * Export wallet data to CSV format
     * @returns {string} CSV formatted wallet data
     */
    exportWalletDataToCSV() {
        const headers = [
            'Wallet ID',
            'Category',
            'Sub Type',
            'Current Balance',
            'Total Deposits',
            'Total Withdrawals',
            'Net Change',
            'Last Updated',
            'Status'
        ];

        const rows = this.wallets.map(wallet => [
            wallet.id,
            this.formatCategoryName(wallet.walletType),
            wallet.subType || 'General',
            wallet.balance.toFixed(2),
            wallet.totalDeposits.toFixed(2),
            wallet.totalWithdrawals.toFixed(2),
            (wallet.totalDeposits - wallet.totalWithdrawals).toFixed(2),
            new Date(wallet.lastUpdated || wallet.updatedAt).toLocaleDateString(),
            wallet.isActive ? 'Active' : 'Inactive'
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        return csvContent;
    }

    /**
     * Download wallet analytics report
     */
    async downloadWalletAnalytics() {
        const analytics = this.calculateWalletAnalytics();
        const csvData = this.exportWalletDataToCSV();
        
        const reportContent = `
TASSIA CENTRAL SDA CHURCH
WALLET ANALYTICS REPORT
Generated: ${new Date().toLocaleString()}

SUMMARY STATISTICS:
Total Church Balance: KES ${analytics.totalBalance.toLocaleString()}
Average Wallet Balance: KES ${analytics.averageBalance.toLocaleString()}
Top Performing Wallet: ${analytics.topWallet ? this.formatWalletName(analytics.topWallet) : 'None'}
Number of Active Wallets: ${this.wallets.filter(w => w.isActive).length}

BALANCE DISTRIBUTION:
${analytics.balanceDistribution.map(dist => 
    `${dist.category}: KES ${dist.total.toLocaleString()} (${dist.count} wallets)`
).join('\n')}

DETAILED WALLET DATA:
${csvData}
        `.trim();

        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallet-analytics-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    /**
     * Validate withdrawal request data
     * @param {Object} data - Withdrawal request data
     * @returns {Object} Validation result
     */
    validateWithdrawalRequest(data) {
        const errors = [];

        // Validate wallet selection
        if (!data.walletId) {
            errors.push('Please select a wallet');
        } else {
            const selectedWallet = this.wallets.find(w => w.id === parseInt(data.walletId));
            if (!selectedWallet) {
                errors.push('Selected wallet not found');
            } else if (selectedWallet.balance < parseFloat(data.amount)) {
                errors.push('Insufficient wallet balance');
            }
        }

        // Validate amount
        if (!data.amount || parseFloat(data.amount) <= 0) {
            errors.push('Please enter a valid amount');
        }

        // Validate purpose
        if (!data.purpose || data.purpose.trim().length < 5) {
            errors.push('Purpose must be at least 5 characters');
        }

        // Validate withdrawal method
        if (!data.withdrawalMethod) {
            errors.push('Please select a withdrawal method');
        } else {
            if (data.withdrawalMethod === 'BANK_TRANSFER' && !data.destinationAccount) {
                errors.push('Bank account number is required for bank transfers');
            }
            if (data.withdrawalMethod === 'MPESA' && !data.destinationPhone) {
                errors.push('Phone number is required for M-Pesa transfers');
            }
        }

        // Validate description
        if (!data.description || data.description.trim().length < 10) {
            errors.push('Description must be at least 10 characters');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Format validation errors for display
     * @param {Array} errors - Array of error messages
     * @returns {string} Formatted error message
     */
    formatValidationErrors(errors) {
        if (errors.length === 0) return '';
        
        return `Please correct the following errors:\n• ${errors.join('\n• ')}`;
    }

    /**
     * Auto-save form data to localStorage
     * @param {string} formType - Type of form (withdrawal, approval)
     * @param {Object} data - Form data to save
     */
    autoSaveFormData(formType, data) {
        try {
            const key = `wallet_form_${formType}_autosave`;
            localStorage.setItem(key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Failed to auto-save form data:', error);
        }
    }

    /**
     * Restore auto-saved form data
     * @param {string} formType - Type of form (withdrawal, approval)
     * @returns {Object|null} Restored form data or null
     */
    restoreFormData(formType) {
        try {
            const key = `wallet_form_${formType}_autosave`;
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only restore if saved within last hour
                if (Date.now() - parsed.timestamp < 3600000) {
                    return parsed.data;
                } else {
                    localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.warn('Failed to restore form data:', error);
        }
        return null;
    }

    /**
     * Clear auto-saved form data
     * @param {string} formType - Type of form (withdrawal, approval)
     */
    clearAutoSaveData(formType) {
        try {
            const key = `wallet_form_${formType}_autosave`;
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('Failed to clear auto-save data:', error);
        }
    }

    /**
     * Show notification toast
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.wallet-notification');
        existing.forEach(el => el.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `wallet-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

        // Add notification styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '10000',
            background: this.getNotificationColor(type),
            color: 'white',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            maxWidth: '400px',
            animation: 'slideInFromRight 0.3s ease'
        });

        // Add close functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.style.animation = 'slideOutToRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutToRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);

        document.body.appendChild(notification);
    }

    /**
     * Get notification icon for type
     * @param {string} type - Notification type
     * @returns {string} Icon character
     */
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * Get notification background color for type
     * @param {string} type - Notification type
     * @returns {string} CSS background color
     */
    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    /**
     * Setup keyboard shortcuts for the wallet interface
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when no modal is open and no input is focused
            if (this.isCreatingWithdrawal || this.isViewingWalletDetails || this.isApprovingWithdrawal) {
                return;
            }

            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'SELECT') {
                return;
            }

            switch (e.key) {
                case 'w':
                case 'W':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.isCreatingWithdrawal = true;
                        this.updateView();
                    }
                    break;
                case 'r':
                case 'R':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.refreshData();
                    }
                    break;
                case 'Escape':
                    this.closeAllModals();
                    break;
            }
        });
    }

    /**
     * Close all open modals
     */
    closeAllModals() {
        this.isCreatingWithdrawal = false;
        this.isViewingWalletDetails = false;
        this.isApprovingWithdrawal = false;
        this.currentWallet = null;
        this.currentWithdrawal = null;
        this.updateView();
    }

    /**
     * Setup periodic data refresh
     */
    setupPeriodicRefresh() {
        // Refresh data every 5 minutes
        setInterval(() => {
            if (!this.isCreatingWithdrawal && !this.isViewingWalletDetails && !this.isApprovingWithdrawal) {
                this.loadInitialData();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Handle window beforeunload event
     */
    setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', (e) => {
            // Warn user if they have unsaved changes in modals
            if (this.isCreatingWithdrawal || this.isApprovingWithdrawal) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }

    /**
     * Initialize all event handlers and setup
     */
    initializeAdvancedFeatures() {
        this.setupKeyboardShortcuts();
        this.setupPeriodicRefresh();
        this.setupBeforeUnloadHandler();
        
        console.log('⚡ Advanced wallet features initialized');
    }

    /**
     * Cleanup method for removing event listeners and timers
     */
    cleanup() {
        // Clear any intervals
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Remove event listeners
        document.removeEventListener('keydown', this.keyboardHandler);
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);

        // Clear any pending timeouts
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        console.log('🧹 Wallet view cleanup completed');
    }

    /**
     * Get service status for debugging
     * @returns {Object} Current service status
     */
    getServiceStatus() {
        return {
            isLoading: this.isLoading,
            isAuthenticated: this.authService?.isAuthenticated() || false,
            dataLoaded: this.wallets.length > 0,
            totalBalance: this.totalBalance,
            walletsCount: this.wallets.length,
            pendingApprovals: this.pendingApprovals.length,
            modalsOpen: {
                withdrawal: this.isCreatingWithdrawal,
                details: this.isViewingWalletDetails,
                approval: this.isApprovingWithdrawal
            },
            errors: this.error,
            lastUpdate: new Date().toISOString()
        };
    }
}

// Export the AdminWalletsView class for use in other modules
export { AdminWalletsView };

// Auto-initialize if running in browser environment
if (typeof window !== 'undefined') {
    window.AdminWalletsView = AdminWalletsView;
    console.log('💰 AdminWalletsView class loaded and available globally');
}