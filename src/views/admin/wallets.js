// src/views/admin/wallets.js

export class AdminWalletsView {
    constructor() {
        this.apiService = window.apiService;
        this.authService = window.authService;
        this.user = this.authService?.getUser() || this.apiService?.getCurrentUser() || { fullName: 'Admin User' };
        
        // Data state
        this.wallets = [];
        this.groupedWallets = {};
        this.withdrawalRequests = [];
        this.totalBalance = 0;
        this.isLoading = false; // Start as false to show interface immediately
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
        
        // Initialize with fallback data immediately
        this.createFallbackWallets();
        
        // Bind methods
        this.closeWithdrawalModal = this.closeWithdrawalModal.bind(this);
        this.closeWalletDetailsModal = this.closeWalletDetailsModal.bind(this);
        this.closeApprovalModal = this.closeApprovalModal.bind(this);
        this.handleWithdrawalSubmit = this.handleWithdrawalSubmit.bind(this);
        this.handleApprovalSubmit = this.handleApprovalSubmit.bind(this);
        this.toggleMethodFields = this.toggleMethodFields.bind(this);
        this.refreshData = this.refreshData.bind(this);
        this.openWithdrawalModal = this.openWithdrawalModal.bind(this);
        this.openWalletDetails = this.openWalletDetails.bind(this);
        this.openApprovalModal = this.openApprovalModal.bind(this);
        this.viewWithdrawalDetails = this.viewWithdrawalDetails.bind(this);
        this.printWalletReport = this.printWalletReport.bind(this);
        this.downloadWalletData = this.downloadWalletData.bind(this);
        
        console.log('💰 AdminWalletsView initialized with fallback data');
    }

    async init() {
        console.log('🚀 Initializing Wallets View');
        
        // Always show interface first, then try to load real data
        try {
            // Check if API service is available
            if (!this.apiService) {
                console.warn('⚠️ API Service not available, using fallback data');
                this.showAlert('API Service not available. Using demo data.', 'info');
                return; // Use fallback data already created in constructor
            }
            
            console.log('📡 API Service available, loading real data...');
            await this.loadInitialData();
            console.log('✅ Wallet data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading wallet data:', error);
            this.showAlert('Could not load wallet data from server. Using demo data.', 'info');
            // Keep fallback data, don't throw error
        }
    }

    async loadInitialData() {
        console.log('📡 Loading wallet data...');
        this.isLoading = true;
        this.error = null;
        
        try {
            // Load wallets
            console.log('📊 Fetching wallets...');
            try {
                const walletsResponse = await this.apiService.getAllWallets();
                console.log('📊 Wallets response:', walletsResponse);
                
                if (walletsResponse?.wallets) {
                    this.groupedWallets = walletsResponse.wallets;
                    this.totalBalance = walletsResponse.summary?.totalBalance || 0;
                    
                    // Flatten wallets for easier access
                    this.wallets = [];
                    Object.values(this.groupedWallets).forEach(categoryWallets => {
                        if (Array.isArray(categoryWallets)) {
                            this.wallets.push(...categoryWallets);
                        }
                    });
                    
                    console.log('💰 Total balance:', this.totalBalance);
                    console.log('🏦 Total wallets:', this.wallets.length);
                } else {
                    console.warn('⚠️ No wallets data received, using fallback');
                    this.createFallbackWallets();
                }
            } catch (walletError) {
                console.warn('⚠️ Wallets API failed, using fallback:', walletError.message);
                this.createFallbackWallets();
            }
            
            // Load withdrawal requests
            try {
                console.log('💸 Fetching withdrawal requests...');
                const withdrawalsResponse = await this.apiService.getWithdrawalRequests();
                console.log('💸 Withdrawals response:', withdrawalsResponse);
                
                if (withdrawalsResponse?.withdrawalRequests) {
                    this.withdrawalRequests = withdrawalsResponse.withdrawalRequests;
                    this.pendingApprovals = this.withdrawalRequests.filter(w => w.status === 'PENDING');
                    console.log('⏳ Pending approvals:', this.pendingApprovals.length);
                } else {
                    this.withdrawalRequests = [];
                    this.pendingApprovals = [];
                }
            } catch (withdrawalError) {
                console.warn('⚠️ Could not load withdrawals:', withdrawalError.message);
                this.withdrawalRequests = [];
                this.pendingApprovals = [];
            }
            
        } catch (error) {
            console.error('❌ Error loading wallet data:', error);
            this.error = null; // Don't show error, just use fallback
            this.createFallbackWallets();
        } finally {
            // Always ensure loading is set to false
            this.isLoading = false;
            console.log('✅ Wallet data loading completed');
        }
    }

    createFallbackWallets() {
        console.log('🔄 Creating fallback wallet data...');
        
        // Create fallback wallet structure with common church wallet types
        this.groupedWallets = {
            'TITHE': [
                {
                    id: 1,
                    walletType: 'TITHE',
                    subType: 'welfare',
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 2,
                    walletType: 'TITHE',
                    subType: 'campMeetingExpenses',
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 3,
                    walletType: 'TITHE',
                    subType: 'thanksgiving',
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 4,
                    walletType: 'TITHE',
                    subType: 'stationFund',
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 5,
                    walletType: 'TITHE',
                    subType: 'mediaMinistry',
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ],
            'OFFERING': [
                {
                    id: 6,
                    walletType: 'OFFERING',
                    subType: null,
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ],
            'DONATION': [
                {
                    id: 7,
                    walletType: 'DONATION',
                    subType: null,
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ],
            'SPECIAL_OFFERING': [
                {
                    id: 8,
                    walletType: 'SPECIAL_OFFERING',
                    subType: 'Building Fund',
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 9,
                    walletType: 'SPECIAL_OFFERING',
                    subType: 'Rice Project',
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 10,
                    walletType: 'SPECIAL_OFFERING',
                    subType: 'Youth Ministry',
                    balance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    isActive: true,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]
        };
        
        this.totalBalance = 0;
        this.withdrawalRequests = [];
        this.pendingApprovals = [];
        
        // Flatten wallets for easier access
        this.wallets = [];
        Object.values(this.groupedWallets).forEach(categoryWallets => {
            if (Array.isArray(categoryWallets)) {
                this.wallets.push(...categoryWallets);
            }
        });
        
        console.log('✅ Fallback wallet data created with', this.wallets.length, 'wallets');
    }

    async render() {
        console.log('🎨 Rendering wallet view...');

        // Inject styles first
        this.injectStyles();

        // Create the main container element
        const container = document.createElement('div');
        container.className = 'wallet-page';

        const html = `
            <!-- Navigation -->
            <nav class="top-nav">
                <div class="nav-brand">
                    <span class="brand-icon">⛪</span>
                    <span class="brand-text">TASSIAC CHURCH</span>
                </div>
                <div class="nav-links">
                    <a href="/admin/dashboard" class="nav-link">
                        <span>📊</span> Dashboard
                    </a>
                    <a href="/admin/wallets" class="nav-link active">
                        <span>💰</span> Wallets
                    </a>
                    <a href="/admin/add-payment" class="nav-link">
                        <span>💳</span> Add Payment
                    </a>
                    <a href="/admin/payments" class="nav-link">
                        <span>💸</span> Payments
                    </a>
                    <a href="/admin/users" class="nav-link">
                        <span>👥</span> Users
                    </a>
                </div>
                <div class="nav-user">
                    <div class="user-avatar">${(this.user?.fullName || 'U').charAt(0).toUpperCase()}</div>
                    <span class="user-name">${this.user?.fullName || 'Admin User'}</span>
                </div>
            </nav>

            <!-- Main Content -->
            <main class="main-content">
                <!-- Header -->
                <header class="page-header">
                    <h1 class="page-title">Wallet Management</h1>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="refresh-btn">
                            <span>🔄</span> Refresh
                        </button>
                        <button class="btn btn-primary btn-withdraw" id="withdrawal-btn">
                            <span>💸</span> Request Withdrawal
                        </button>
                    </div>
                </header>

                <!-- Alerts -->
                <div id="alerts-container"></div>

                <!-- Hero Section -->
                <section class="hero-section">
                    <div class="hero-card">
                        <div class="balance-display">
                            <div class="balance-label">Total Church Balance</div>
                            <div class="balance-amount">KES ${this.formatCurrency(this.totalBalance)}</div>
                            <div class="balance-info">Across ${Object.keys(this.groupedWallets).length} wallet categories</div>
                        </div>
                        <div class="quick-stats">
                            ${this.renderQuickStats()}
                        </div>
                    </div>
                </section>

                <!-- Pending Approvals -->
                ${this.pendingApprovals.length > 0 ? `
                <section class="pending-approvals">
                    <div class="card">
                        <div class="card-header">
                            <h2>⏳ Pending Withdrawal Approvals</h2>
                        </div>
                        <div class="card-body">
                            ${this.renderPendingApprovals()}
                        </div>
                    </div>
                </section>
                ` : ''}

                <!-- Wallets Grid -->
                <section class="wallets-section">
                    <h2 class="section-title">Wallet Categories</h2>
                    <div class="wallets-grid">
                        ${this.renderWalletsGrid()}
                    </div>
                </section>

                <!-- Recent Withdrawals -->
                <section class="withdrawals-section">
                    <div class="card">
                        <div class="card-header">
                            <h2>Recent Withdrawals</h2>
                        </div>
                        <div class="card-body">
                            ${this.renderRecentWithdrawals()}
                        </div>
                    </div>
                </section>
            </main>
        `;

        container.innerHTML = html;
        
        // Add event listeners after DOM is created
        this.attachEventListeners(container);
        
        window.walletsView = this; // Make available globally for fallback
        console.log('✅ Wallet view rendered successfully');
        
        // Return the DOM element for the router
        return container;
    }

    attachEventListeners(container) {
        console.log('🔗 Attaching event listeners...');
        
        // Header buttons
        const refreshBtn = container.querySelector('#refresh-btn');
        const withdrawalBtn = container.querySelector('#withdrawal-btn');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', this.refreshData);
        }
        
        if (withdrawalBtn) {
            withdrawalBtn.addEventListener('click', this.openWithdrawalModal);
        }
        
        // Wallet cards - delegate to parent container
        const walletsGrid = container.querySelector('.wallets-grid');
        if (walletsGrid) {
            walletsGrid.addEventListener('click', (e) => {
                const walletCard = e.target.closest('.wallet-card');
                if (walletCard) {
                    const walletId = walletCard.getAttribute('data-wallet-id');
                    if (walletId && !e.target.closest('.view-btn')) {
                        this.openWalletDetails(parseInt(walletId));
                    }
                }
                
                const viewBtn = e.target.closest('.view-btn');
                if (viewBtn) {
                    e.stopPropagation();
                    const walletId = viewBtn.getAttribute('data-wallet-id');
                    if (walletId) {
                        this.openWalletDetails(parseInt(walletId));
                    }
                }
            });
        }
        
        // Pending approvals section
        const pendingApprovalsSection = container.querySelector('.pending-approvals');
        if (pendingApprovalsSection) {
            pendingApprovalsSection.addEventListener('click', (e) => {
                const approvalBtn = e.target.closest('.approval-btn');
                if (approvalBtn) {
                    const withdrawalId = approvalBtn.getAttribute('data-withdrawal-id');
                    if (withdrawalId) {
                        this.openApprovalModal(parseInt(withdrawalId));
                    }
                }
            });
        }
        
        // Withdrawals section
        const withdrawalsSection = container.querySelector('.withdrawals-section');
        if (withdrawalsSection) {
            withdrawalsSection.addEventListener('click', (e) => {
                const viewWithdrawalBtn = e.target.closest('.view-withdrawal-btn');
                if (viewWithdrawalBtn) {
                    const withdrawalId = viewWithdrawalBtn.getAttribute('data-withdrawal-id');
                    if (withdrawalId) {
                        this.viewWithdrawalDetails(parseInt(withdrawalId));
                    }
                }
            });
        }
        
        console.log('✅ Event listeners attached successfully');
    }

    renderQuickStats() {
        const titheTotal = this.groupedWallets.TITHE ? 
            this.groupedWallets.TITHE.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;
        const offeringTotal = this.groupedWallets.OFFERING ? 
            this.groupedWallets.OFFERING.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;
        const specialTotal = this.groupedWallets.SPECIAL_OFFERING ? 
            this.groupedWallets.SPECIAL_OFFERING.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;
        const donationTotal = this.groupedWallets.DONATION ? 
            this.groupedWallets.DONATION.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;

        return `
            <div class="stat-item">
                <div class="stat-icon" style="background-color: rgba(79, 70, 229, 0.2); color: #4f46e5;">📿</div>
                <div class="stat-content">
                    <div class="stat-label">Tithe Funds</div>
                    <div class="stat-value">KES ${this.formatCurrency(titheTotal)}</div>
                </div>
            </div>
            <div class="stat-item">
                <div class="stat-icon" style="background-color: rgba(5, 150, 105, 0.2); color: #059669;">🙏</div>
                <div class="stat-content">
                    <div class="stat-label">Offerings</div>
                    <div class="stat-value">KES ${this.formatCurrency(offeringTotal)}</div>
                </div>
            </div>
            <div class="stat-item">
                <div class="stat-icon" style="background-color: rgba(124, 58, 237, 0.2); color: #7c3aed;">✨</div>
                <div class="stat-content">
                    <div class="stat-label">Special Funds</div>
                    <div class="stat-value">KES ${this.formatCurrency(specialTotal)}</div>
                </div>
            </div>
            <div class="stat-item">
                <div class="stat-icon" style="background-color: rgba(239, 68, 68, 0.2); color: #ef4444;">💝</div>
                <div class="stat-content">
                    <div class="stat-label">Donations</div>
                    <div class="stat-value">KES ${this.formatCurrency(donationTotal)}</div>
                </div>
            </div>
        `;
    }

    renderPendingApprovals() {
        return this.pendingApprovals.map(withdrawal => `
            <div class="approval-item">
                <div class="approval-info">
                    <div class="approval-ref">${withdrawal.withdrawalReference}</div>
                    <div class="approval-details">
                        <span class="approval-amount">KES ${this.formatCurrency(withdrawal.amount)}</span>
                        <span class="approval-purpose">${withdrawal.purpose}</span>
                        <span class="approval-progress">${withdrawal.currentApprovals}/${withdrawal.requiredApprovals} approvals</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-small approval-btn" data-withdrawal-id="${withdrawal.id}">
                    Approve
                </button>
            </div>
        `).join('');
    }

    renderWalletsGrid() {
        if (Object.keys(this.groupedWallets).length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">💰</div>
                    <h3>No Wallets Found</h3>
                    <p>No wallet data available. Please check your configuration.</p>
                </div>
            `;
        }

        return Object.entries(this.groupedWallets).map(([category, wallets]) => {
            if (!Array.isArray(wallets) || wallets.length === 0) return '';

            const categoryTotal = wallets.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);

            return `
                <div class="wallet-category">
                    <div class="category-header">
                        <h3 class="category-title">
                            ${this.getCategoryIcon(category)} ${this.formatCategoryName(category)}
                        </h3>
                        <div class="category-total">KES ${this.formatCurrency(categoryTotal)}</div>
                    </div>
                    <div class="category-wallets">
                        ${wallets.map(wallet => `
                            <div class="wallet-card" data-wallet-id="${wallet.id}">
                                <div class="wallet-info">
                                    <div class="wallet-name">${this.formatWalletName(wallet)}</div>
                                    <div class="wallet-balance">KES ${this.formatCurrency(wallet.balance || 0)}</div>
                                    <div class="wallet-meta">
                                        <span>Deposits: KES ${this.formatCurrency(wallet.totalDeposits || 0)}</span>
                                        <span>Withdrawals: KES ${this.formatCurrency(wallet.totalWithdrawals || 0)}</span>
                                    </div>
                                </div>
                                <div class="wallet-action">
                                    <button class="view-btn" data-wallet-id="${wallet.id}">👁️</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRecentWithdrawals() {
        if (this.withdrawalRequests.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">💸</div>
                    <h3>No Withdrawals Yet</h3>
                    <p>No withdrawal requests have been made. Click "Request Withdrawal" to create your first withdrawal.</p>
                </div>
            `;
        }

        return `
            <div class="withdrawals-table">
                <div class="table-header">
                    <div>Reference</div>
                    <div>Amount</div>
                    <div>Purpose</div>
                    <div>Status</div>
                    <div>Date</div>
                    <div>Actions</div>
                </div>
                ${this.withdrawalRequests.slice(0, 10).map(withdrawal => `
                    <div class="table-row">
                        <div data-label="Reference">${withdrawal.withdrawalReference}</div>
                        <div data-label="Amount">KES ${this.formatCurrency(withdrawal.amount)}</div>
                        <div data-label="Purpose">${withdrawal.purpose}</div>
                        <div data-label="Status">
                            <span class="status-badge status-${withdrawal.status.toLowerCase()}">${withdrawal.status}</span>
                        </div>
                        <div data-label="Date">${this.formatDate(withdrawal.createdAt)}</div>
                        <div data-label="Actions">
                            <button class="btn btn-small btn-secondary view-withdrawal-btn" data-withdrawal-id="${withdrawal.id}">View</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Modal Methods
    openWithdrawalModal() {
        console.log('💸 Opening withdrawal modal');
        this.isCreatingWithdrawal = true;
        this.showWithdrawalModal();
    }

    openApprovalModal(withdrawalId) {
        console.log('✅ Opening approval modal for withdrawal:', withdrawalId);
        const withdrawal = this.withdrawalRequests.find(w => w.id === withdrawalId);
        if (withdrawal) {
            this.currentWithdrawal = withdrawal;
            this.isApprovingWithdrawal = true;
            this.showApprovalModal();
        }
    }

    openWalletDetails(walletId) {
        console.log('👁️ Opening wallet details for wallet:', walletId);
        const wallet = this.wallets.find(w => w.id === walletId);
        if (wallet) {
            this.currentWallet = wallet;
            this.isViewingWalletDetails = true;
            this.showWalletDetailsModal();
        }
    }

    showWithdrawalModal() {
        const modalHtml = `
            <div class="modal-overlay" id="withdrawalModal">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Request Withdrawal</h2>
                        <button class="modal-close" id="close-withdrawal-modal">&times;</button>
                    </div>
                    <div class="modal-content">
                        <form id="withdrawalForm">
                            <div class="form-grid">
                                <div class="form-group form-group-full">
                                    <label>Select Wallet *</label>
                                    <select name="walletId" required>
                                        <option value="">Select wallet to withdraw from</option>
                                        ${this.renderWalletOptions()}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label>Amount *</label>
                                    <input type="number" name="amount" step="0.01" min="0.01" placeholder="0.00" required>
                                </div>
                                
                                <div class="form-group">
                                    <label>Purpose *</label>
                                    <input type="text" name="purpose" placeholder="Brief description" required>
                                </div>
                                
                                <div class="form-group form-group-full">
                                    <label>Withdrawal Method *</label>
                                    <select name="withdrawalMethod" id="withdrawal-method-select" required>
                                        <option value="">Select method</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="MPESA">M-Pesa</option>
                                        <option value="CASH">Cash</option>
                                    </select>
                                </div>
                                
                                <div class="form-group method-field" id="bankField" style="display: none;">
                                    <label>Bank Account Number</label>
                                    <input type="text" name="destinationAccount" placeholder="Enter account number">
                                </div>
                                
                                <div class="form-group method-field" id="mpesaField" style="display: none;">
                                    <label>M-Pesa Phone Number</label>
                                    <input type="tel" name="destinationPhone" placeholder="0712345678">
                                </div>
                                
                                <div class="form-group form-group-full">
                                    <label>Description *</label>
                                    <textarea name="description" rows="3" placeholder="Detailed description of the withdrawal..." required></textarea>
                                </div>
                                
                                <div class="form-group form-group-full">
                                    <label>Expense Receipt/Document</label>
                                    <input type="file" name="expenseDocument" accept=".jpg,.jpeg,.png,.pdf">
                                    <small class="file-info">Upload expense receipt or supporting document (max 5MB)</small>
                                </div>
                                
                                <div class="form-group form-group-full">
                                    <div class="info-box">
                                        <div class="info-icon">ℹ️</div>
                                        <div class="info-text">
                                            <strong>Multi-Admin Approval Required</strong><br>
                                            This withdrawal will require approval from 3 different administrators before processing.
                                            All withdrawals are automatically treated as expenses.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-withdrawal">Cancel</button>
                                <button type="submit" class="btn btn-primary">Submit Withdrawal Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('withdrawalModal');
        modal.style.display = 'flex';
        
        // Attach modal event listeners
        this.attachWithdrawalModalListeners();
        
        setTimeout(() => {
            document.querySelector('#withdrawalModal .modal').classList.add('show');
        }, 10);
    }

    attachWithdrawalModalListeners() {
        const modal = document.getElementById('withdrawalModal');
        if (!modal) return;
        
        // Close button
        const closeBtn = modal.querySelector('#close-withdrawal-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeWithdrawalModal);
        }
        
        // Cancel button
        const cancelBtn = modal.querySelector('#cancel-withdrawal');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', this.closeWithdrawalModal);
        }
        
        // Form submission
        const form = modal.querySelector('#withdrawalForm');
        if (form) {
            form.addEventListener('submit', this.handleWithdrawalSubmit);
        }
        
        // Method selection
        const methodSelect = modal.querySelector('#withdrawal-method-select');
        if (methodSelect) {
            methodSelect.addEventListener('change', (e) => {
                this.toggleMethodFields(e.target.value);
            });
        }
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeWithdrawalModal();
            }
        });
    }

    showApprovalModal() {
        if (!this.currentWithdrawal) return;

        const modalHtml = `
            <div class="modal-overlay" id="approvalModal">
                <div class="modal">
                    <div class="modal-header">
                        <h2>Approve Withdrawal</h2>
                        <button class="modal-close" id="close-approval-modal">&times;</button>
                    </div>
                    <div class="modal-content">
                        <div class="withdrawal-details">
                            <div class="detail-row">
                                <span class="detail-label">Reference:</span>
                                <span class="detail-value">${this.currentWithdrawal.withdrawalReference}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Amount:</span>
                                <span class="detail-value">KES ${this.formatCurrency(this.currentWithdrawal.amount)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Purpose:</span>
                                <span class="detail-value">${this.currentWithdrawal.purpose}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Method:</span>
                                <span class="detail-value">${this.currentWithdrawal.withdrawalMethod}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Approvals:</span>
                                <span class="detail-value">${this.currentWithdrawal.currentApprovals}/${this.currentWithdrawal.requiredApprovals}</span>
                            </div>
                        </div>
                        
                        <form id="approvalForm">
                            <div class="form-group">
                                <label>Withdrawal Password *</label>
                                <input type="password" name="password" placeholder="Enter withdrawal approval password" required>
                            </div>
                            
                            <div class="form-group">
                                <label>Comment (Optional)</label>
                                <textarea name="comment" rows="3" placeholder="Optional comment about this approval..."></textarea>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-approval">Cancel</button>
                                <button type="submit" class="btn btn-primary">Approve Withdrawal</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('approvalModal');
        modal.style.display = 'flex';
        
        // Attach modal event listeners
        this.attachApprovalModalListeners();
        
        setTimeout(() => {
            document.querySelector('#approvalModal .modal').classList.add('show');
        }, 10);
    }

    attachApprovalModalListeners() {
        const modal = document.getElementById('approvalModal');
        if (!modal) return;
        
        // Close button
        const closeBtn = modal.querySelector('#close-approval-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeApprovalModal);
        }
        
        // Cancel button
        const cancelBtn = modal.querySelector('#cancel-approval');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', this.closeApprovalModal);
        }
        
        // Form submission
        const form = modal.querySelector('#approvalForm');
        if (form) {
            form.addEventListener('submit', this.handleApprovalSubmit);
        }
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeApprovalModal();
            }
        });
    }

    showWalletDetailsModal() {
        if (!this.currentWallet) return;

        const modalHtml = `
            <div class="modal-overlay" id="walletDetailsModal">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h2>${this.formatWalletName(this.currentWallet)} Details</h2>
                        <button class="modal-close" id="close-wallet-details-modal">&times;</button>
                    </div>
                    <div class="modal-content">
                        <div class="wallet-overview">
                            <div class="overview-stat">
                                <div class="stat-label">Current Balance</div>
                                <div class="stat-value">KES ${this.formatCurrency(this.currentWallet.balance || 0)}</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-label">Total Deposits</div>
                                <div class="stat-value">KES ${this.formatCurrency(this.currentWallet.totalDeposits || 0)}</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-label">Total Withdrawals</div>
                                <div class="stat-value">KES ${this.formatCurrency(this.currentWallet.totalWithdrawals || 0)}</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-label">Last Updated</div>
                                <div class="stat-value">${this.formatDate(this.currentWallet.lastUpdated || this.currentWallet.updatedAt)}</div>
                            </div>
                        </div>
                        
                        <div class="chart-container">
                            <h3>Balance Trend</h3>
                            <div class="chart-placeholder">
                                <div class="chart-icon">📈</div>
                                <div class="chart-text">Chart visualization would go here</div>
                            </div>
                        </div>
                        
                        <div class="modal-actions">
                            <button class="btn btn-secondary" id="print-wallet-report">🖨️ Print Report</button>
                            <button class="btn btn-secondary" id="download-wallet-data">💾 Download Data</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('walletDetailsModal');
        modal.style.display = 'flex';
        
        // Attach modal event listeners
        this.attachWalletDetailsModalListeners();
        
        setTimeout(() => {
            document.querySelector('#walletDetailsModal .modal').classList.add('show');
        }, 10);
    }

    attachWalletDetailsModalListeners() {
        const modal = document.getElementById('walletDetailsModal');
        if (!modal) return;
        
        // Close button
        const closeBtn = modal.querySelector('#close-wallet-details-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeWalletDetailsModal);
        }
        
        // Print button
        const printBtn = modal.querySelector('#print-wallet-report');
        if (printBtn) {
            printBtn.addEventListener('click', this.printWalletReport);
        }
        
        // Download button
        const downloadBtn = modal.querySelector('#download-wallet-data');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', this.downloadWalletData);
        }
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeWalletDetailsModal();
            }
        });
    }

    closeWithdrawalModal() {
        console.log('❌ Closing withdrawal modal');
        const modal = document.getElementById('withdrawalModal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        this.isCreatingWithdrawal = false;
        this.selectedFile = null;
    }

    closeApprovalModal() {
        console.log('❌ Closing approval modal');
        const modal = document.getElementById('approvalModal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        this.isApprovingWithdrawal = false;
        this.currentWithdrawal = null;
    }

    closeWalletDetailsModal() {
        console.log('❌ Closing wallet details modal');
        const modal = document.getElementById('walletDetailsModal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        this.isViewingWalletDetails = false;
        this.currentWallet = null;
    }

    // Event handlers
    async handleWithdrawalSubmit(event) {
        event.preventDefault();
        console.log('💸 Handling withdrawal submission');
        
        const form = event.target;
        const formData = new FormData(form);
        const submitButton = form.querySelector('button[type="submit"]');
        
        // Disable submit button
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

            console.log('📤 Sending withdrawal request:', withdrawalData);

            let response;
            const fileInput = form.querySelector('input[type="file"]');
            
            if (fileInput && fileInput.files[0]) {
                // Create FormData for file upload
                const uploadFormData = new FormData();
                Object.keys(withdrawalData).forEach(key => {
                    if (withdrawalData[key] !== null) {
                        uploadFormData.append(key, withdrawalData[key]);
                    }
                });
                uploadFormData.append('expenseReceiptImage', fileInput.files[0]);
                
                response = await this.apiService.uploadFile('/wallets/withdraw', uploadFormData);
            } else {
                response = await this.apiService.createWithdrawalRequest(withdrawalData);
            }

            console.log('✅ Withdrawal request response:', response);

            if (response && response.withdrawalRequest) {
                this.showAlert('Withdrawal request created successfully! Waiting for approvals.', 'success');
                this.closeWithdrawalModal();
                await this.loadInitialData();
                await this.render();
            }
        } catch (error) {
            console.error('❌ Error creating withdrawal request:', error);
            this.showAlert(error.message || 'Failed to create withdrawal request.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Withdrawal Request';
        }
    }

    async handleApprovalSubmit(event) {
        event.preventDefault();
        console.log('✅ Handling approval submission');
        
        const form = event.target;
        const formData = new FormData(form);
        const submitButton = form.querySelector('button[type="submit"]');
        
        // Disable submit button
        submitButton.disabled = true;
        submitButton.textContent = 'Approving...';
        
        try {
            const approvalData = {
                password: formData.get('password'),
                comment: formData.get('comment') || null
            };

            console.log('📤 Sending approval request for withdrawal:', this.currentWithdrawal.id);

            const response = await this.apiService.approveWithdrawalRequest(
                this.currentWithdrawal.id, 
                approvalData
            );

            console.log('✅ Approval response:', response);

            if (response) {
                if (response.processed) {
                    this.showAlert('Withdrawal approved and processed successfully!', 'success');
                } else {
                    this.showAlert(`Approval recorded. ${response.requiredApprovals - response.currentApprovals} more approvals needed.`, 'success');
                }
                
                this.closeApprovalModal();
                await this.loadInitialData();
                await this.render();
            }
        } catch (error) {
            console.error('❌ Error approving withdrawal:', error);
            this.showAlert(error.message || 'Failed to approve withdrawal.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Approve Withdrawal';
        }
    }

    // Utility methods
    renderWalletOptions() {
        let options = '';
        Object.entries(this.groupedWallets).forEach(([category, wallets]) => {
            if (Array.isArray(wallets)) {
                wallets.forEach(wallet => {
                    if ((wallet.balance || 0) > 0) {
                        options += `<option value="${wallet.id}">${this.formatWalletName(wallet)} - KES ${this.formatCurrency(wallet.balance || 0)}</option>`;
                    }
                });
            }
        });
        return options;
    }

    toggleMethodFields(method) {
        const bankField = document.getElementById('bankField');
        const mpesaField = document.getElementById('mpesaField');
        
        if (bankField && mpesaField) {
            bankField.style.display = method === 'BANK_TRANSFER' ? 'block' : 'none';
            mpesaField.style.display = method === 'MPESA' ? 'block' : 'none';
            
            // Update required status
            const bankInput = bankField.querySelector('input');
            const mpesaInput = mpesaField.querySelector('input');
            
            if (bankInput) bankInput.required = method === 'BANK_TRANSFER';
            if (mpesaInput) mpesaInput.required = method === 'MPESA';
        }
    }

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

    formatCurrency(amount) {
        return parseFloat(amount || 0).toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    }

    formatDate(date) {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString();
    }

    async refreshData() {
        console.log('🔄 Refreshing wallet data');
        this.showAlert('Refreshing data...', 'info');
        try {
            await this.loadInitialData();
            
            // Re-render the entire view
            const container = document.querySelector('.wallet-page');
            if (container && container.parentNode) {
                const newContainer = await this.render();
                container.parentNode.replaceChild(newContainer, container);
            }
            
            this.showAlert('Data refreshed successfully.', 'success');
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            this.showAlert('Failed to refresh data.', 'error');
        }
    }

    viewWithdrawalDetails(withdrawalId) {
        const withdrawal = this.withdrawalRequests.find(w => w.id === withdrawalId);
        if (withdrawal) {
            const details = `
Reference: ${withdrawal.withdrawalReference}
Amount: KES ${this.formatCurrency(withdrawal.amount)}
Purpose: ${withdrawal.purpose}
Status: ${withdrawal.status}
Method: ${withdrawal.withdrawalMethod}
Date: ${this.formatDate(withdrawal.createdAt)}
            `.trim();
            alert(details);
        }
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
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4f46e5; padding-bottom: 15px; }
                    .header h1 { color: #4f46e5; margin: 0; font-size: 24px; }
                    .overview { display: flex; justify-content: space-between; margin: 20px 0; }
                    .stat { text-align: center; flex: 1; }
                    .stat-label { font-size: 12px; color: #666; }
                    .stat-value { font-size: 18px; font-weight: bold; color: #4f46e5; }
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
                        <div class="stat-value">KES ${this.formatCurrency(this.currentWallet.balance || 0)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Total Deposits</div>
                        <div class="stat-value">KES ${this.formatCurrency(this.currentWallet.totalDeposits || 0)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Total Withdrawals</div>
                        <div class="stat-value">KES ${this.formatCurrency(this.currentWallet.totalWithdrawals || 0)}</div>
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
            ['Current Balance', this.currentWallet.balance || 0],
            ['Total Deposits', this.currentWallet.totalDeposits || 0],
            ['Total Withdrawals', this.currentWallet.totalWithdrawals || 0],
            ['Last Updated', this.currentWallet.lastUpdated || this.currentWallet.updatedAt || ''],
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

    showAlert(message, type) {
        console.log(`🔔 Alert (${type}):`, message);
        
        // Try to find alerts container
        let alertsContainer = document.getElementById('alerts-container');
        
        // If container doesn't exist, try to create it or find app container
        if (!alertsContainer) {
            const appContainer = document.getElementById('app') || document.body;
            const tempDiv = document.createElement('div');
            tempDiv.id = 'alerts-container';
            tempDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; max-width: 400px;';
            appContainer.appendChild(tempDiv);
            alertsContainer = tempDiv;
        }

        if (!alertsContainer) {
            console.warn('Could not create alerts container, using console only');
            return;
        }

        const alertClass = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-error' : 'alert-info';
        const alertIcon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

        const alertElement = document.createElement('div');
        alertElement.className = `alert ${alertClass}`;
        alertElement.style.cssText = `
            margin-bottom: 1rem; 
            padding: 1rem; 
            border-radius: 8px; 
            display: flex; 
            align-items: center; 
            gap: 1rem; 
            background: ${type === 'success' ? 'rgba(16, 185, 129, 0.1)' : type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; 
            color: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#2563eb'}; 
            border: 1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.2)' : type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'};
        `;

        alertElement.innerHTML = `
            <span>${alertIcon}</span>
            <span>${message}</span>
            <button style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: inherit; opacity: 0.7; margin-left: auto;">&times;</button>
        `;

        // Add close functionality
        const closeBtn = alertElement.querySelector('button');
        closeBtn.addEventListener('click', () => {
            alertElement.remove();
        });

        alertsContainer.insertAdjacentElement('afterbegin', alertElement);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertElement.parentNode) {
                alertElement.remove();
            }
        }, 5000);
    }

    injectStyles() {
        if (document.getElementById('wallet-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'wallet-styles';
        style.textContent = `
            /* Reset and base */
            * { box-sizing: border-box; margin: 0; padding: 0; }
            
            .wallet-page {
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            /* Navigation */
            .top-nav {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem 2rem;
                box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
                position: sticky;
                top: 0;
                z-index: 100;
            }

            .nav-brand {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 1.25rem;
                font-weight: 700;
                color: #4f46e5;
            }

            .brand-icon { font-size: 1.5rem; }

            .nav-links {
                display: flex;
                gap: 0.5rem;
            }

            .nav-link {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                border-radius: 8px;
                text-decoration: none;
                color: #64748b;
                font-weight: 500;
                transition: all 0.3s ease;
            }

            .nav-link:hover {
                background: rgba(79, 70, 229, 0.1);
                color: #4f46e5;
            }

            .nav-link.active {
                background: #4f46e5;
                color: white;
            }

            .nav-user {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .user-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, #4f46e5, #7c3aed);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
            }

            .user-name {
                font-weight: 600;
                color: #374151;
            }

            /* Main content */
            .main-content {
                padding: 2rem;
                max-width: 1400px;
                margin: 0 auto;
            }

            .page-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2rem;
            }

            .page-title {
                font-size: 2.5rem;
                font-weight: 800;
                background: linear-gradient(135deg, #1a202c, #4f46e5);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .header-actions {
                display: flex;
                gap: 1rem;
            }

            /* Buttons */
            .btn {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                font-size: 0.9rem;
            }

            .btn-primary {
                background: linear-gradient(135deg, #4f46e5, #7c3aed);
                color: white;
                box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
            }

            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
            }

            .btn-secondary {
                background: rgba(255, 255, 255, 0.9);
                color: #374151;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            .btn-secondary:hover {
                background: white;
                transform: translateY(-2px);
            }

            .btn-withdraw {
                background: linear-gradient(135deg, #ef4444, #dc2626);
            }

            .btn-small {
                padding: 0.5rem 1rem;
                font-size: 0.8rem;
            }

            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none !important;
            }

            /* Cards */
            .card {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                overflow: hidden;
                margin-bottom: 2rem;
                transition: all 0.3s ease;
            }

            .card:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
            }

            .card-header {
                padding: 1.5rem 2rem;
                border-bottom: 1px solid rgba(226, 232, 240, 0.5);
                background: rgba(248, 250, 252, 0.5);
            }

            .card-header h2 {
                font-size: 1.4rem;
                font-weight: 700;
                color: #1a202c;
                margin: 0;
            }

            .card-body {
                padding: 2rem;
            }

            /* Hero section */
            .hero-section {
                margin-bottom: 3rem;
            }

            .hero-card {
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95));
                border: 1px solid rgba(79, 70, 229, 0.2);
                border-radius: 20px;
                padding: 3rem 2rem;
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 3rem;
                align-items: center;
            }

            .balance-display {
                text-align: center;
            }

            .balance-label {
                font-size: 1.1rem;
                color: #64748b;
                margin-bottom: 0.5rem;
                font-weight: 500;
            }

            .balance-amount {
                font-size: 3.5rem;
                font-weight: 900;
                background: linear-gradient(135deg, #4f46e5, #7c3aed);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 0.5rem;
                line-height: 1;
            }

            .balance-info {
                font-size: 0.95rem;
                color: #64748b;
            }

            .quick-stats {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1.5rem;
            }

            .stat-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1.5rem;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 12px;
                border: 1px solid rgba(226, 232, 240, 0.5);
                transition: all 0.3s ease;
            }

            .stat-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            }

            .stat-icon {
                width: 50px;
                height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                font-size: 1.5rem;
            }

            .stat-content {
                flex: 1;
            }

            .stat-label {
                font-size: 0.9rem;
                color: #64748b;
                margin-bottom: 0.25rem;
                font-weight: 500;
            }

            .stat-value {
                font-size: 1.2rem;
                font-weight: 700;
                color: #1a202c;
            }

            /* Wallets section */
            .wallets-section {
                margin-bottom: 3rem;
            }

            .section-title {
                font-size: 2rem;
                font-weight: 700;
                color: #1a202c;
                margin-bottom: 2rem;
            }

            .wallets-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 2rem;
            }

            .wallet-category {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }

            .category-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem 2rem;
                background: linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(124, 58, 237, 0.1));
                border-bottom: 1px solid rgba(226, 232, 240, 0.5);
            }

            .category-title {
                font-size: 1.3rem;
                font-weight: 700;
                color: #1a202c;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .category-total {
                font-size: 1.2rem;
                font-weight: 800;
                color: #4f46e5;
            }

            .category-wallets {
                padding: 1.5rem 2rem;
            }

            .wallet-card {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                margin-bottom: 1rem;
                background: rgba(248, 250, 252, 0.8);
                border: 1px solid rgba(226, 232, 240, 0.5);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .wallet-card:hover {
                background: rgba(79, 70, 229, 0.05);
                border-color: rgba(79, 70, 229, 0.2);
                transform: translateX(5px);
            }

            .wallet-card:last-child {
                margin-bottom: 0;
            }

            .wallet-info {
                flex: 1;
            }

            .wallet-name {
                font-weight: 700;
                color: #1a202c;
                margin-bottom: 0.5rem;
                font-size: 1.1rem;
            }

            .wallet-balance {
                font-size: 1.3rem;
                font-weight: 800;
                color: #059669;
                margin-bottom: 0.5rem;
            }

            .wallet-meta {
                display: flex;
                gap: 1.5rem;
                font-size: 0.9rem;
                color: #64748b;
            }

            .wallet-action {
                flex-shrink: 0;
            }

            .view-btn {
                background: rgba(79, 70, 229, 0.1);
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0.75rem;
                border-radius: 50%;
                color: #4f46e5;
                transition: all 0.3s ease;
                width: 45px;
                height: 45px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .view-btn:hover {
                background: #4f46e5;
                color: white;
                transform: scale(1.1);
            }

            /* Tables */
            .withdrawals-table {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .table-header {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
                gap: 1rem;
                padding: 1rem 1.5rem;
                background: rgba(79, 70, 229, 0.1);
                border-radius: 8px;
                font-weight: 700;
                color: #1a202c;
                font-size: 0.9rem;
            }

            .table-row {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
                gap: 1rem;
                padding: 1rem 1.5rem;
                background: rgba(248, 250, 252, 0.8);
                border: 1px solid rgba(226, 232, 240, 0.5);
                border-radius: 8px;
                align-items: center;
                transition: all 0.3s ease;
                font-size: 0.9rem;
                color: #374151;
            }

            .table-row:hover {
                background: rgba(79, 70, 229, 0.05);
                border-color: rgba(79, 70, 229, 0.2);
            }

            .status-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
            }

            .status-pending {
                background: rgba(245, 158, 11, 0.2);
                color: #f59e0b;
            }

            .status-completed {
                background: rgba(16, 185, 129, 0.2);
                color: #10b981;
            }

            .status-rejected {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }

            /* Pending approvals */
            .pending-approvals {
                margin-bottom: 3rem;
            }

            .approval-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                background: rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(226, 232, 240, 0.5);
                border-radius: 12px;
                margin-bottom: 1rem;
                transition: all 0.3s ease;
            }

            .approval-item:hover {
                background: white;
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            }

            .approval-item:last-child {
                margin-bottom: 0;
            }

            .approval-info {
                flex: 1;
            }

            .approval-ref {
                font-weight: 700;
                color: #1a202c;
                margin-bottom: 0.5rem;
                font-size: 1.1rem;
            }

            .approval-details {
                display: flex;
                gap: 1.5rem;
                flex-wrap: wrap;
                align-items: center;
            }

            .approval-amount {
                color: #f59e0b;
                font-weight: 700;
            }

            .approval-purpose {
                color: #374151;
                font-weight: 500;
            }

            .approval-progress {
                color: #64748b;
                font-size: 0.9rem;
            }

            /* Modals */
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                padding: 1rem;
                backdrop-filter: blur(8px);
            }

            .modal {
                background: white;
                border-radius: 16px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
                width: 100%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                transform: translateY(20px) scale(0.95);
                opacity: 0;
                transition: all 0.3s ease;
            }

            .modal.modal-large {
                max-width: 900px;
            }

            .modal.show {
                transform: translateY(0) scale(1);
                opacity: 1;
            }

            .modal-header {
                padding: 1.5rem 2rem;
                border-bottom: 1px solid rgba(226, 232, 240, 0.5);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(248, 250, 252, 0.8);
            }

            .modal-header h2 {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 700;
                color: #1a202c;
            }

            .modal-close {
                background: none;
                border: none;
                font-size: 1.8rem;
                color: #64748b;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }

            .modal-close:hover {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
            }

            .modal-content {
                padding: 2rem;
            }

            .modal-actions {
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: 1px solid rgba(226, 232, 240, 0.5);
            }

            /* Forms */
            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .form-group {
                margin-bottom: 0;
            }

            .form-group-full {
                grid-column: 1 / -1;
            }

            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: #374151;
                font-size: 0.9rem;
            }

            .form-group input,
            .form-group select,
            .form-group textarea {
                width: 100%;
                padding: 0.75rem;
                background: rgba(248, 250, 252, 0.8);
                border: 2px solid rgba(226, 232, 240, 0.5);
                border-radius: 8px;
                color: #1a202c;
                font-size: 0.9rem;
                transition: all 0.3s ease;
                font-family: inherit;
            }

            .form-group input:focus,
            .form-group select:focus,
            .form-group textarea:focus {
                outline: none;
                border-color: #4f46e5;
                background: white;
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
            }

            .file-info {
                font-size: 0.8rem;
                color: #64748b;
                margin-top: 0.5rem;
            }

            .info-box {
                display: flex;
                gap: 1rem;
                padding: 1.5rem;
                background: rgba(79, 70, 229, 0.05);
                border: 1px solid rgba(79, 70, 229, 0.2);
                border-radius: 8px;
            }

            .info-icon {
                font-size: 1.5rem;
                color: #4f46e5;
                flex-shrink: 0;
            }

            .info-text {
                color: #374151;
                font-size: 0.9rem;
                line-height: 1.6;
            }

            /* Wallet details modal */
            .wallet-overview {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .overview-stat {
                text-align: center;
                padding: 1.5rem;
                background: rgba(79, 70, 229, 0.05);
                border: 1px solid rgba(79, 70, 229, 0.1);
                border-radius: 12px;
            }

            .overview-stat .stat-label {
                font-size: 0.9rem;
                color: #64748b;
                margin-bottom: 0.5rem;
                font-weight: 500;
            }

            .overview-stat .stat-value {
                font-size: 1.4rem;
                font-weight: 700;
                color: #1a202c;
            }

            .chart-container {
                margin-bottom: 2rem;
            }

            .chart-container h3 {
                color: #1a202c;
                margin-bottom: 1rem;
                font-size: 1.2rem;
                font-weight: 700;
            }

            .chart-placeholder {
                min-height: 200px;
                background: rgba(248, 250, 252, 0.8);
                border: 1px solid rgba(226, 232, 240, 0.5);
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                color: #64748b;
            }

            .chart-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                opacity: 0.7;
            }

            .chart-text {
                font-size: 1.1rem;
                font-weight: 500;
            }

            /* Approval modal */
            .withdrawal-details {
                margin-bottom: 2rem;
                padding: 1.5rem;
                background: rgba(248, 250, 252, 0.8);
                border-radius: 8px;
                border: 1px solid rgba(226, 232, 240, 0.5);
            }

            .detail-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 0.75rem;
                border-bottom: 1px solid rgba(226, 232, 240, 0.5);
            }

            .detail-row:last-child {
                margin-bottom: 0;
                border-bottom: none;
            }

            .detail-label {
                font-weight: 600;
                color: #64748b;
                font-size: 0.9rem;
            }

            .detail-value {
                font-weight: 700;
                color: #1a202c;
                font-size: 0.9rem;
            }

            /* Alerts */
            .alert {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                font-weight: 500;
                margin-bottom: 1rem;
            }

            .alert-success {
                background: rgba(16, 185, 129, 0.1);
                color: #059669;
                border: 1px solid rgba(16, 185, 129, 0.2);
            }

            .alert-error {
                background: rgba(239, 68, 68, 0.1);
                color: #dc2626;
                border: 1px solid rgba(239, 68, 68, 0.2);
            }

            .alert-info {
                background: rgba(59, 130, 246, 0.1);
                color: #2563eb;
                border: 1px solid rgba(59, 130, 246, 0.2);
            }

            /* Empty states */
            .empty-state {
                padding: 3rem 2rem;
                text-align: center;
                color: #64748b;
            }

            .empty-icon {
                font-size: 4rem;
                margin-bottom: 1.5rem;
                opacity: 0.7;
            }

            .empty-state h3 {
                font-size: 1.5rem;
                color: #1a202c;
                margin-bottom: 1rem;
            }

            .empty-state p {
                font-size: 1rem;
                line-height: 1.6;
                max-width: 400px;
                margin: 0 auto;
            }

            /* Responsive design */
            @media (max-width: 1024px) {
                .nav-links { display: none; }
                .main-content { padding: 1.5rem; }
                .hero-card { grid-template-columns: 1fr; gap: 2rem; text-align: center; }
                .balance-amount { font-size: 2.5rem; }
                .wallets-grid { grid-template-columns: 1fr; }
                .quick-stats { grid-template-columns: 1fr; }
            }

            @media (max-width: 768px) {
                .top-nav { padding: 1rem; }
                .nav-brand { font-size: 1rem; }
                .user-name { display: none; }
                .main-content { padding: 1rem; }
                .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
                .page-title { font-size: 2rem; }
                .header-actions { width: 100%; justify-content: space-between; }
                .hero-card { padding: 2rem 1.5rem; }
                .balance-amount { font-size: 2rem; }
                .table-header, .table-row { grid-template-columns: 1fr; gap: 0.5rem; }
                .table-row { padding: 1rem; }
                .table-row > div::before { content: attr(data-label) ": "; font-weight: 700; color: #64748b; }
                .modal { max-width: 95vw; margin: 0.5rem; }
                .form-grid { grid-template-columns: 1fr; }
                .modal-actions { flex-direction: column; }
                .approval-item { flex-direction: column; align-items: flex-start; gap: 1rem; }
                .approval-details { flex-direction: column; gap: 0.5rem; align-items: flex-start; }
            }

            @media (max-width: 480px) {
                .main-content { padding: 0.75rem; }
                .page-title { font-size: 1.5rem; }
                .balance-amount { font-size: 1.8rem; }
                .header-actions { flex-direction: column; gap: 0.75rem; }
                .btn { width: 100%; justify-content: center; }
                .wallet-card { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
                .view-btn { align-self: flex-end; }
                .stat-item { flex-direction: column; text-align: center; gap: 0.75rem; }
                .modal-header { padding: 1rem 1.5rem; }
                .modal-content { padding: 1.5rem; }
            }

            /* Print styles */
            @media print {
                .top-nav, .header-actions, .modal-actions, .view-btn, .btn { display: none !important; }
                .main-content { padding: 0; max-width: none; }
                .card { box-shadow: none; border: 1px solid #ddd; }
                .wallet-page { background: white !important; }
            }
        `;
        
        document.head.appendChild(style);
        console.log('💄 Styles injected successfully');
    }

    // Cleanup
    cleanup() {
        const style = document.getElementById('wallet-styles');
        if (style) style.remove();
        
        // Remove global reference
        if (window.walletsView === this) {
            delete window.walletsView;
        }
        
        console.log('🧹 Wallet view cleanup completed');
    }
}

// Auto-initialize
if (typeof window !== 'undefined') {
    window.AdminWalletsView = AdminWalletsView;
    console.log('💰 AdminWalletsView class loaded and available globally');
}

export default AdminWalletsView;