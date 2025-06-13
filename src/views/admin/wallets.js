// src/views/admin/wallets.js - Production Ready Version

export class AdminWalletsView {
    constructor() {
        this.apiService = window.apiService;
        this.authService = window.authService;
        this.user = this.authService?.getUser() || this.apiService?.getCurrentUser() || null;
        
        // Validate dependencies
        if (!this.apiService) {
            throw new Error('API Service is required but not available');
        }
        
        if (!this.user) {
            throw new Error('User authentication is required');
        }

        // Check if user is admin and not view-only
        if (!this.user.isAdmin) {
            throw new Error('Admin access required');
        }

        // Data state
        this.wallets = [];
        this.groupedWallets = {
            TITHE: [],
            OFFERING: [],
            DONATION: [],
            SPECIAL_OFFERING: []
        };
        this.withdrawalRequests = [];
        this.totalBalance = 0;
        this.isLoading = false;
        this.error = null;
        this.summary = {
            totalBalance: 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            walletsCount: 0
        };
        
        // View state
        this.activeModals = new Set();
        this.currentWallet = null;
        this.currentWithdrawal = null;
        this.walletTransactions = [];
        
        // Auto-refresh state
        this.autoRefreshInterval = null;
        this.lastRefreshTime = null;
        this.refreshInterval = 30000; // 30 seconds
        
        // Event abort controllers for cleanup
        this.abortControllers = new Map();
        
        // Bind methods properly
        this.bindMethods();
        
        console.log('💰 AdminWalletsView initialized for admin:', this.user.fullName);
    }

    bindMethods() {
        // Bind all event handlers to maintain proper context
        const methodsToBind = [
            'refreshData', 'openWithdrawalModal', 'openWalletDetails', 'openApprovalModal',
            'closeWithdrawalModal', 'closeWalletDetailsModal', 'closeApprovalModal',
            'handleWithdrawalSubmit', 'handleApprovalSubmit', 'toggleMethodFields',
            'viewWithdrawalDetails', 'printWalletReport', 'downloadWalletData'
        ];
        
        methodsToBind.forEach(method => {
            if (this[method]) {
                this[method] = this[method].bind(this);
            }
        });
    }

    async init() {
        console.log('🚀 Initializing Wallets View');
        
        try {
            await this.loadInitialData();
            if (this.error) {
                console.warn('⚠️ Wallet initialization notice:', this.error);
            } else {
                console.log('✅ Wallet data loaded successfully');
                // Start auto-refresh after successful initialization
                this.startAutoRefresh();
            }
        } catch (error) {
            console.error('❌ Error during initialization:', error);
            this.error = error.message;
        }
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        this.autoRefreshInterval = setInterval(async () => {
            if (!this.isLoading) {
                await this.refreshData();
            }
        }, this.refreshInterval);
        
        console.log('🔄 Auto-refresh started');
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
        console.log('⏹️ Auto-refresh stopped');
    }

    async loadInitialData() {
        console.log('📡 Loading wallet data...');
        this.isLoading = true;
        this.error = null;
        
        const abortController = new AbortController();
        this.abortControllers.set('loadData', abortController);
        
        try {
            // Try to load wallets first
            let walletsResponse;
            try {
                walletsResponse = await this.apiService.getAllWallets();
                console.log('🔍 Raw wallets response:', walletsResponse);
            } catch (walletError) {
                // If wallets don't exist (404 or initialization error), initialize them
                if (walletError.message.includes('No wallets found') || walletError.message.includes('404')) {
                    console.log('⚡ Initializing wallet system...');
                    try {
                        await this.apiService.initializeWallets();
                        console.log('✅ Wallets initialized, retrying load...');
                        walletsResponse = await this.apiService.getAllWallets();
                    } catch (initError) {
                        console.error('❌ Failed to initialize wallets:', initError);
                        // Continue with empty structure
                        walletsResponse = null;
                    }
                } else {
                    throw walletError;
                }
            }

            // Load withdrawal requests
            let withdrawalsResponse;
            try {
                withdrawalsResponse = await this.apiService.getWithdrawalRequests();
            } catch (withdrawalError) {
                console.warn('⚠️ Could not load withdrawal requests:', withdrawalError.message);
                withdrawalsResponse = { withdrawalRequests: [] };
            }

            // Process wallets response
            if (walletsResponse?.wallets || walletsResponse?.data?.wallets) {
                const rawWalletData = walletsResponse.wallets || walletsResponse.data?.wallets || {};
                const summaryData = walletsResponse.summary || walletsResponse.data?.summary || {};
                
                console.log('🔍 Processing wallet data structure:', rawWalletData);
                
                // Handle nested structure: {TITHE: {wallets: [...], count: 6}, ...}
                // Convert to flat structure: {TITHE: [...], OFFERING: [...]}
                const processedWalletData = {};
                Object.keys(rawWalletData).forEach(category => {
                    const categoryData = rawWalletData[category];
                    if (categoryData && categoryData.wallets && Array.isArray(categoryData.wallets)) {
                        // Nested structure - extract the wallets array
                        processedWalletData[category] = categoryData.wallets;
                    } else if (Array.isArray(categoryData)) {
                        // Direct array structure
                        processedWalletData[category] = categoryData;
                    } else {
                        // Fallback to empty array
                        processedWalletData[category] = [];
                    }
                });
                
                // Ensure all categories exist, including SPECIAL_OFFERING
                const requiredCategories = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL_OFFERING'];
                requiredCategories.forEach(category => {
                    if (!processedWalletData[category]) {
                        processedWalletData[category] = [];
                    }
                });
                
                // Ensure all categories are arrays
                this.groupedWallets = this.ensureWalletStructure(processedWalletData);
                this.summary = summaryData;
                this.totalBalance = summaryData.totalBalance || 0;
                
                // Flatten wallets for easier access
                this.wallets = [];
                Object.values(this.groupedWallets).forEach(categoryWallets => {
                    if (Array.isArray(categoryWallets)) {
                        this.wallets.push(...categoryWallets);
                    }
                });
                
                console.log('💰 Wallets processed:', {
                    totalBalance: this.totalBalance,
                    categories: Object.keys(this.groupedWallets).length,
                    totalWallets: this.wallets.length,
                    structure: Object.keys(this.groupedWallets).reduce((acc, key) => {
                        acc[key] = this.groupedWallets[key].length;
                        return acc;
                    }, {}),
                    sampleWallet: this.wallets[0] || null
                });
            } else {
                // Initialize empty structure
                this.groupedWallets = this.ensureWalletStructure();
                this.summary = {
                    totalBalance: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    walletsCount: 0
                };
                this.totalBalance = 0;
                this.wallets = [];
                console.log('💳 Showing empty wallet structure');
            }

            // Process withdrawals response
            const withdrawalData = withdrawalsResponse?.withdrawalRequests || 
                                 withdrawalsResponse?.data?.withdrawalRequests || 
                                 withdrawalsResponse || [];
            
            this.withdrawalRequests = Array.isArray(withdrawalData) ? withdrawalData : [];
            console.log('💸 Withdrawal requests loaded:', this.withdrawalRequests.length);

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('📡 Load data request was cancelled');
                return;
            }
            console.error('❌ Error loading wallet data:', error);
            
            // Set empty state instead of throwing
            this.groupedWallets = this.ensureWalletStructure();
            this.summary = {
                totalBalance: 0,
                totalDeposits: 0,
                totalWithdrawals: 0,
                walletsCount: 0
            };
            this.totalBalance = 0;
            this.wallets = [];
            this.withdrawalRequests = [];
            
            this.error = `Could not load wallet data: ${error.message}`;
        } finally {
            this.isLoading = false;
            this.abortControllers.delete('loadData');
        }
    }

    async render() {
        console.log('🎨 Rendering wallet view...');

        // Inject styles first
        this.injectStyles();

        // Create the main container element
        const container = document.createElement('div');
        container.className = 'wallet-page';

        if (this.error) {
            container.innerHTML = this.renderErrorState();
        } else if (this.isLoading) {
            container.innerHTML = this.renderLoadingState();
        } else {
            container.innerHTML = this.renderMainContent();
        }
        
        // Add event listeners after DOM is created
        this.attachEventListeners(container);
        
        console.log('✅ Wallet view rendered successfully');
        return container;
    }

    renderErrorState() {
        return `
            ${this.renderNavigation()}
            
            <main class="main-content">
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <h2>Unable to Load Wallet Data</h2>
                    <p>${this.error}</p>
                    <button class="btn btn-primary" id="retry-btn">🔄 Retry</button>
                </div>
            </main>
        `;
    }

    renderLoadingState() {
        return `
            ${this.renderNavigation()}
            
            <main class="main-content">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <h2>Loading Wallet Data...</h2>
                    <p>Please wait while we load your wallet information.</p>
                </div>
            </main>
        `;
    }

    renderMainContent() {
        const pendingApprovals = this.withdrawalRequests.filter(w => w.status === 'PENDING');
        
        return `
            ${this.renderNavigation()}

            <main class="main-content">
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

                <div id="alerts-container"></div>

                <section class="hero-section">
                    <div class="hero-card">
                        <div class="balance-display">
                            <div class="balance-label">Total Church Balance</div>
                            <div class="balance-amount">KES ${this.formatCurrency(this.totalBalance)}</div>
                            <div class="balance-info">Across ${Object.keys(this.groupedWallets).length} wallet categories • ${this.wallets.length} total wallets</div>
                        </div>
                        <div class="quick-stats">
                            ${this.renderQuickStats()}
                        </div>
                    </div>
                </section>

                <section class="system-stats">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">💰</div>
                            <div class="stat-content">
                                <div class="stat-value">KES ${this.formatCurrency(this.summary?.totalDeposits || 0)}</div>
                                <div class="stat-label">Total Deposits</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">💸</div>
                            <div class="stat-content">
                                <div class="stat-value">KES ${this.formatCurrency(this.summary?.totalWithdrawals || 0)}</div>
                                <div class="stat-label">Total Withdrawals</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">📊</div>
                            <div class="stat-content">
                                <div class="stat-value">${this.summary?.walletsCount || 0}</div>
                                <div class="stat-label">Active Wallets</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⏳</div>
                            <div class="stat-content">
                                <div class="stat-value">${pendingApprovals.length}</div>
                                <div class="stat-label">Pending Approvals</div>
                            </div>
                        </div>
                    </div>
                </section>

                ${pendingApprovals.length > 0 ? `
                <section class="pending-approvals">
                    <div class="card">
                        <div class="card-header">
                            <h2>⏳ Pending Withdrawal Approvals</h2>
                        </div>
                        <div class="card-body">
                            ${this.renderPendingApprovals(pendingApprovals)}
                        </div>
                    </div>
                </section>
                ` : ''}

                <section class="wallets-section">
                    <h2 class="section-title">Wallet Categories</h2>
                    <div class="wallets-grid">
                        ${this.renderWalletsGrid()}
                    </div>
                </section>

                <section class="withdrawals-section">
                    <div class="card">
                        <div class="card-header">
                            <h2>Recent Withdrawals</h2>
                            <div class="card-actions">
                                <button class="btn btn-small btn-secondary" id="view-all-withdrawals">View All</button>
                            </div>
                        </div>
                        <div class="card-body">
                            ${this.renderRecentWithdrawals()}
                        </div>
                    </div>
                </section>
            </main>
        `;
    }

    renderNavigation() {
        return `
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
        `;
    }

    attachEventListeners(container) {
        console.log('🔗 Attaching event listeners...');
        
        // Header buttons
        this.attachHeaderEventListeners(container);
        
        // Wallet cards interaction
        this.attachWalletCardListeners(container);
        
        // Pending approvals interaction
        this.attachApprovalListeners(container);
        
        // Withdrawals interaction
        this.attachWithdrawalListeners(container);
        
        // Error state retry
        const retryBtn = container.querySelector('#retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', this.refreshData);
        }
        
        console.log('✅ Event listeners attached successfully');
    }

    attachHeaderEventListeners(container) {
        const refreshBtn = container.querySelector('#refresh-btn');
        const withdrawalBtn = container.querySelector('#withdrawal-btn');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', this.refreshData);
        }
        
        if (withdrawalBtn) {
            withdrawalBtn.addEventListener('click', this.openWithdrawalModal);
        }
    }

    attachWalletCardListeners(container) {
        const walletsGrid = container.querySelector('.wallets-grid');
        if (walletsGrid) {
            walletsGrid.addEventListener('click', (e) => {
                const walletCard = e.target.closest('.wallet-card');
                if (walletCard) {
                    const walletId = parseInt(walletCard.getAttribute('data-wallet-id'));
                    if (walletId && !e.target.closest('.view-btn')) {
                        this.openWalletDetails(walletId);
                    }
                }
                
                const viewBtn = e.target.closest('.view-btn');
                if (viewBtn) {
                    e.stopPropagation();
                    const walletId = parseInt(viewBtn.getAttribute('data-wallet-id'));
                    if (walletId) {
                        this.openWalletDetails(walletId);
                    }
                }
                
                // Manual initialization button
                const initBtn = e.target.closest('#manual-init-btn');
                if (initBtn) {
                    this.initializeWalletSystem();
                }
            });
        }
    }

    attachApprovalListeners(container) {
        const pendingApprovalsSection = container.querySelector('.pending-approvals');
        if (pendingApprovalsSection) {
            pendingApprovalsSection.addEventListener('click', (e) => {
                const approvalBtn = e.target.closest('.approval-btn');
                if (approvalBtn) {
                    const withdrawalId = parseInt(approvalBtn.getAttribute('data-withdrawal-id'));
                    if (withdrawalId) {
                        this.openApprovalModal(withdrawalId);
                    }
                }
            });
        }
    }

    attachWithdrawalListeners(container) {
        const withdrawalsSection = container.querySelector('.withdrawals-section');
        if (withdrawalsSection) {
            withdrawalsSection.addEventListener('click', (e) => {
                const viewWithdrawalBtn = e.target.closest('.view-withdrawal-btn');
                if (viewWithdrawalBtn) {
                    const withdrawalId = parseInt(viewWithdrawalBtn.getAttribute('data-withdrawal-id'));
                    if (withdrawalId) {
                        this.viewWithdrawalDetails(withdrawalId);
                    }
                }
            });
        }
    }

    renderQuickStats() {
        const titheTotal = (this.groupedWallets.TITHE && Array.isArray(this.groupedWallets.TITHE)) ? 
            this.groupedWallets.TITHE.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;
        const offeringTotal = (this.groupedWallets.OFFERING && Array.isArray(this.groupedWallets.OFFERING)) ? 
            this.groupedWallets.OFFERING.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;
        const specialTotal = (this.groupedWallets.SPECIAL_OFFERING && Array.isArray(this.groupedWallets.SPECIAL_OFFERING)) ? 
            this.groupedWallets.SPECIAL_OFFERING.reduce((sum, w) => sum + (w.balance || 0), 0) : 0;
        const donationTotal = (this.groupedWallets.DONATION && Array.isArray(this.groupedWallets.DONATION)) ? 
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

    renderPendingApprovals(pendingApprovals) {
        return pendingApprovals.map(withdrawal => `
            <div class="approval-item">
                <div class="approval-info">
                    <div class="approval-ref">${withdrawal.withdrawalReference}</div>
                    <div class="approval-details">
                        <span class="approval-amount">KES ${this.formatCurrency(withdrawal.amount)}</span>
                        <span class="approval-purpose">${this.escapeHtml(withdrawal.purpose)}</span>
                        <span class="approval-progress">${withdrawal.currentApprovals}/${withdrawal.requiredApprovals} approvals</span>
                        <span class="approval-wallet">${this.formatWalletName(withdrawal.wallet)}</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-small approval-btn" data-withdrawal-id="${withdrawal.id}">
                    Approve
                </button>
            </div>
        `).join('');
    }

    renderWalletsGrid() {
        // Always show all categories, even with empty wallets
        const allCategories = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL_OFFERING'];
        
        // Check if we have any wallets at all
        const hasAnyWallets = this.wallets.length > 0;
        
        if (!hasAnyWallets && this.error) {
            return `
                <div class="wallet-initialization">
                    <div class="init-card">
                        <div class="init-icon">🏦</div>
                        <h3>Wallet System Setup Required</h3>
                        <p>The wallet system needs to be initialized to track church finances.</p>
                        <div class="init-info">
                            <div class="info-item">✨ Creates default wallet categories</div>
                            <div class="info-item">📊 Enables financial tracking</div>
                            <div class="info-item">💰 Sets up balance management</div>
                        </div>
                        <button class="btn btn-primary" id="manual-init-btn">
                            <span>⚡</span> Initialize Wallet System
                        </button>
                        <small class="init-note">This is a one-time setup process.</small>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="wallets-grid">
                ${allCategories.map(category => `
                    <div class="wallet-category" data-category="${category}">
                        <div class="category-header">
                            <span class="category-icon">${this.getCategoryIcon(category)}</span>
                            <h3>${category.charAt(0) + category.slice(1).toLowerCase().replace(/_/g, ' ')}</h3>
                        </div>
                        <div class="category-wallets">
                            ${this.renderCategoryWallets(category)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderCategoryWallets(category) {
        const wallets = this.groupedWallets[category] || [];
        
        if (wallets.length === 0) {
            return `
                <div class="empty-wallet-state">
                    <p>No ${category.toLowerCase().replace(/_/g, ' ')} wallets available</p>
                </div>
            `;
        }
        
        return wallets.map(wallet => `
            <div class="wallet-card" data-wallet-id="${wallet.id}">
                <div class="wallet-header">
                    <h4>${this.formatWalletName(wallet)}</h4>
                    <span class="wallet-status ${wallet.isActive ? 'active' : 'inactive'}">
                        ${wallet.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="wallet-balance">
                    <span class="balance-label">Current Balance</span>
                    <span class="balance-amount">KES ${this.formatCurrency(wallet.balance || 0)}</span>
                </div>
                <div class="wallet-stats">
                    <div class="stat">
                        <span class="stat-label">Total Deposits</span>
                        <span class="stat-value">KES ${this.formatCurrency(wallet.totalDeposits || 0)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Total Withdrawals</span>
                        <span class="stat-value">KES ${this.formatCurrency(wallet.totalWithdrawals || 0)}</span>
                    </div>
                </div>
                <div class="wallet-actions">
                    <button class="btn btn-secondary view-btn" data-wallet-id="${wallet.id}">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderRecentWithdrawals() {
        if (this.withdrawalRequests.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">💸</div>
                    <h3>No Withdrawals Yet</h3>
                    <p>No withdrawal requests have been made.</p>
                </div>
            `;
        }

        return `
            <div class="withdrawals-table">
                <div class="table-header">
                    <div>Reference</div>
                    <div>Wallet</div>
                    <div>Amount</div>
                    <div>Purpose</div>
                    <div>Status</div>
                    <div>Progress</div>
                    <div>Date</div>
                    <div>Actions</div>
                </div>
                ${this.withdrawalRequests.slice(0, 10).map(withdrawal => `
                    <div class="table-row">
                        <div data-label="Reference">${withdrawal.withdrawalReference}</div>
                        <div data-label="Wallet">${this.formatWalletName(withdrawal.wallet)}</div>
                        <div data-label="Amount">KES ${this.formatCurrency(withdrawal.amount)}</div>
                        <div data-label="Purpose">${this.escapeHtml(withdrawal.purpose)}</div>
                        <div data-label="Status">
                            <span class="status-badge status-${withdrawal.status.toLowerCase()}">${withdrawal.status}</span>
                        </div>
                        <div data-label="Progress">${withdrawal.currentApprovals}/${withdrawal.requiredApprovals}</div>
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
        if (this.activeModals.has('withdrawal')) return;
        
        this.activeModals.add('withdrawal');
        this.showWithdrawalModal();
    }

    openApprovalModal(withdrawalId) {
        console.log('✅ Opening approval modal for withdrawal:', withdrawalId);
        if (this.activeModals.has('approval')) return;
        
        const withdrawal = this.withdrawalRequests.find(w => w.id === withdrawalId);
        if (withdrawal) {
            this.currentWithdrawal = withdrawal;
            this.activeModals.add('approval');
            this.showApprovalModal();
        }
    }

    async openWalletDetails(walletId) {
        console.log('👁️ Opening wallet details for wallet:', walletId);
        if (this.activeModals.has('walletDetails')) return;
        
        const wallet = this.wallets.find(w => w.id === walletId);
        if (wallet) {
            this.currentWallet = wallet;
            this.activeModals.add('walletDetails');
            
            // Try to load wallet transactions with proper error handling
            this.walletTransactions = [];
            try {
                console.log('📊 Loading transactions for wallet:', walletId);
                const transactions = await this.apiService.getWalletTransactions(walletId, {
                    page: 1,
                    limit: 50,
                    include: ['specialOffering', 'payment', 'withdrawal']
                });
                
                if (transactions?.transactions) {
                    this.walletTransactions = transactions.transactions;
                } else if (Array.isArray(transactions)) {
                    this.walletTransactions = transactions;
                }
                
                console.log('✅ Loaded transactions:', this.walletTransactions.length);
            } catch (error) {
                console.warn('⚠️ Could not load wallet transactions:', error.message);
                this.showAlert('Could not load transaction history. Please try again.', 'warning');
                // Continue with empty transactions - don't block the modal
                this.walletTransactions = [];
            }
            
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
                                    <label>Amount (KES) *</label>
                                    <input type="number" name="amount" step="0.01" min="0.01" placeholder="0.00" required>
                                </div>
                                
                                <div class="form-group">
                                    <label>Purpose *</label>
                                    <input type="text" name="purpose" placeholder="Brief description" required maxlength="100">
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
                                    <input type="tel" name="destinationPhone" placeholder="0712345678" pattern="^(\\+254|0)?[17]\\d{8}$">
                                </div>
                                
                                <div class="form-group form-group-full">
                                    <label>Description *</label>
                                    <textarea name="description" rows="3" placeholder="Detailed description of the withdrawal..." required maxlength="500"></textarea>
                                </div>
                                
                                <div class="form-group form-group-full">
                                    <div class="info-box">
                                        <div class="info-icon">ℹ️</div>
                                        <div class="info-text">
                                            <strong>Multi-Admin Approval Required</strong><br>
                                            This withdrawal will require approval from 3 different administrators before processing.
                                            All withdrawals are automatically treated as expenses and will be recorded in the system.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-withdrawal">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="submit-withdrawal">Submit Withdrawal Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('withdrawalModal');
        modal.style.display = 'flex';
        
        this.attachWithdrawalModalListeners();
        
        // Show modal with animation
        requestAnimationFrame(() => {
            const modalElement = modal.querySelector('.modal');
            if (modalElement) {
                modalElement.classList.add('show');
            }
        });
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
        
        // Escape key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeWithdrawalModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
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
                                <span class="detail-label">Wallet:</span>
                                <span class="detail-value">${this.formatWalletName(this.currentWithdrawal.wallet)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Amount:</span>
                                <span class="detail-value">KES ${this.formatCurrency(this.currentWithdrawal.amount)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Purpose:</span>
                                <span class="detail-value">${this.escapeHtml(this.currentWithdrawal.purpose)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Method:</span>
                                <span class="detail-value">${this.currentWithdrawal.withdrawalMethod}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Progress:</span>
                                <span class="detail-value">${this.currentWithdrawal.currentApprovals}/${this.currentWithdrawal.requiredApprovals} approvals</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Requested by:</span>
                                <span class="detail-value">${this.currentWithdrawal.requester?.fullName || 'Unknown'}</span>
                            </div>
                        </div>
                        
                        <form id="approvalForm">
                            <div class="form-group">
                                <label>Withdrawal Password *</label>
                                <input type="password" name="password" placeholder="Enter withdrawal approval password" required autocomplete="new-password">
                                <small class="form-help">Contact your system administrator for the withdrawal password.</small>
                            </div>
                            
                            <div class="form-group">
                                <label>Comment (Optional)</label>
                                <textarea name="comment" rows="3" placeholder="Optional comment about this approval..." maxlength="300"></textarea>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" id="cancel-approval">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="submit-approval">Approve Withdrawal</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('approvalModal');
        modal.style.display = 'flex';
        
        this.attachApprovalModalListeners();
        
        // Show modal with animation
        requestAnimationFrame(() => {
            const modalElement = modal.querySelector('.modal');
            if (modalElement) {
                modalElement.classList.add('show');
            }
        });
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
        
        // Escape key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeApprovalModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    showWalletDetailsModal() {
        if (!this.currentWallet) return;

        // Handle missing data gracefully
        const walletType = this.currentWallet.walletType || 'Unknown';
        const subType = this.currentWallet.subType || null;
        const isActive = this.currentWallet.isActive !== undefined ? this.currentWallet.isActive : true;
        const createdAt = this.currentWallet.createdAt || this.currentWallet.updatedAt || new Date();
        const lastUpdated = this.currentWallet.lastUpdated || this.currentWallet.updatedAt || new Date();
        
        // Ensure deposits and withdrawals are properly displayed
        const totalDeposits = this.currentWallet.totalDeposits || 0;
        const totalWithdrawals = this.currentWallet.totalWithdrawals || 0;

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
                                <div class="stat-value">KES ${this.formatCurrency(totalDeposits)}</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-label">Total Withdrawals</div>
                                <div class="stat-value">KES ${this.formatCurrency(totalWithdrawals)}</div>
                            </div>
                            <div class="overview-stat">
                                <div class="stat-label">Last Updated</div>
                                <div class="stat-value">${this.formatDate(lastUpdated)}</div>
                            </div>
                        </div>
                        
                        <div class="wallet-meta-info">
                            <div class="meta-row">
                                <span class="meta-label">Wallet ID:</span>
                                <span class="meta-value">${this.currentWallet.id}</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Type:</span>
                                <span class="meta-value">${walletType}</span>
                            </div>
                            ${subType ? `
                                <div class="meta-row">
                                    <span class="meta-label">Sub-type:</span>
                                    <span class="meta-value">${subType}</span>
                                </div>
                            ` : ''}
                            <div class="meta-row">
                                <span class="meta-label">Status:</span>
                                <span class="meta-value">
                                    <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">
                                        ${isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Created:</span>
                                <span class="meta-value">${this.formatDate(createdAt)}</span>
                            </div>
                            ${this.currentWallet.specialOffering ? `
                                <div class="meta-row">
                                    <span class="meta-label">Special Offering:</span>
                                    <span class="meta-value">${this.escapeHtml(this.currentWallet.specialOffering.name)}</span>
                                </div>
                            ` : ''}
                        </div>

                        ${this.walletTransactions.length > 0 ? `
                            <div class="wallet-transactions">
                                <h3>Recent Transactions (${this.walletTransactions.length})</h3>
                                <div class="transactions-list">
                                    ${this.walletTransactions.slice(0, 10).map(tx => `
                                        <div class="transaction-item">
                                            <div class="transaction-type">${tx.type || 'Transaction'}</div>
                                            <div class="transaction-amount ${tx.amount > 0 ? 'positive' : 'negative'}">
                                                ${tx.amount > 0 ? '+' : ''}KES ${this.formatCurrency(Math.abs(tx.amount || 0))}
                                            </div>
                                            <div class="transaction-date">${this.formatDate(tx.createdAt || tx.date)}</div>
                                            <div class="transaction-description">${this.escapeHtml(tx.description || 'No description')}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : `
                            <div class="wallet-transactions">
                                <h3>Transaction History</h3>
                                <div class="empty-transactions">
                                    <div class="empty-icon">📊</div>
                                    <p>No transaction history available</p>
                                    <small>Transactions will appear here when wallet activity occurs</small>
                                </div>
                            </div>
                        `}
                        
                        <div class="modal-actions">
                            <button class="btn btn-secondary" id="print-wallet-report">🖨️ Print Report</button>
                            <button class="btn btn-secondary" id="download-wallet-data">💾 Download CSV</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('walletDetailsModal');
        modal.style.display = 'flex';
        
        this.attachWalletDetailsModalListeners();
        
        // Show modal with animation
        requestAnimationFrame(() => {
            const modalElement = modal.querySelector('.modal');
            if (modalElement) {
                modalElement.classList.add('show');
            }
        });
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
        
        // Escape key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeWalletDetailsModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Modal close methods
    closeWithdrawalModal() {
        console.log('❌ Closing withdrawal modal');
        const modal = document.getElementById('withdrawalModal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        this.activeModals.delete('withdrawal');
    }

    closeApprovalModal() {
        console.log('❌ Closing approval modal');
        const modal = document.getElementById('approvalModal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        this.activeModals.delete('approval');
        this.currentWithdrawal = null;
    }

    closeWalletDetailsModal() {
        console.log('❌ Closing wallet details modal');
        const modal = document.getElementById('walletDetailsModal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        this.activeModals.delete('walletDetails');
        this.currentWallet = null;
        this.walletTransactions = [];
    }

    // Event handlers
    async handleWithdrawalSubmit(event) {
        event.preventDefault();
        console.log('💸 Handling withdrawal submission');
        
        const form = event.target;
        const formData = new FormData(form);
        const submitButton = form.querySelector('#submit-withdrawal');
        
        // Disable submit button
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Creating Request...';
        }
        
        try {
            // Validate form data
            const withdrawalData = this.validateWithdrawalData(formData);
            
            console.log('📤 Sending withdrawal request:', withdrawalData);

            const response = await this.apiService.createWithdrawalRequest(withdrawalData);

            console.log('✅ Withdrawal request response:', response);

            if (response?.withdrawalRequest) {
                this.showAlert('Withdrawal request created successfully! Waiting for approvals.', 'success');
                this.closeWithdrawalModal();
                await this.refreshData();
            } else {
                throw new Error('Failed to create withdrawal request');
            }
        } catch (error) {
            console.error('❌ Error creating withdrawal request:', error);
            this.showAlert(error.message || 'Failed to create withdrawal request.', 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Withdrawal Request';
            }
        }
    }

    validateWithdrawalData(formData) {
        const walletId = parseInt(formData.get('walletId'));
        const amount = parseFloat(formData.get('amount'));
        const purpose = formData.get('purpose')?.trim();
        const description = formData.get('description')?.trim();
        const withdrawalMethod = formData.get('withdrawalMethod');
        const destinationAccount = formData.get('destinationAccount')?.trim();
        const destinationPhone = formData.get('destinationPhone')?.trim();

        // Validation
        if (!walletId || isNaN(walletId)) {
            throw new Error('Please select a valid wallet');
        }

        if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error('Please enter a valid amount greater than 0');
        }

        if (!purpose || purpose.length < 3) {
            throw new Error('Purpose must be at least 3 characters long');
        }

        if (!description || description.length < 10) {
            throw new Error('Description must be at least 10 characters long');
        }

        if (!withdrawalMethod) {
            throw new Error('Please select a withdrawal method');
        }

        // Find wallet and validate balance
        const wallet = this.wallets.find(w => w.id === walletId);
        if (!wallet) {
            throw new Error('Selected wallet not found');
        }

        if (amount > (wallet.balance || 0)) {
            throw new Error(`Insufficient wallet balance. Available: KES ${this.formatCurrency(wallet.balance || 0)}`);
        }

        // Method-specific validation
        if (withdrawalMethod === 'BANK_TRANSFER' && !destinationAccount) {
            throw new Error('Bank account number is required for bank transfers');
        }

        if (withdrawalMethod === 'MPESA') {
            if (!destinationPhone) {
                throw new Error('Phone number is required for M-Pesa transfers');
            }
            // Validate Kenyan phone number format
            const phonePattern = /^(\+254|0)?[17]\d{8}$/;
            if (!phonePattern.test(destinationPhone)) {
                throw new Error('Please enter a valid Kenyan phone number');
            }
        }

        return {
            walletId,
            amount,
            purpose,
            description,
            withdrawalMethod,
            destinationAccount: destinationAccount || null,
            destinationPhone: destinationPhone || null
        };
    }

    async handleApprovalSubmit(event) {
        event.preventDefault();
        console.log('✅ Handling approval submission');
        
        const form = event.target;
        const formData = new FormData(form);
        const submitButton = form.querySelector('#submit-approval');
        
        // Disable submit button
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Approving...';
        }
        
        try {
            const password = formData.get('password')?.trim();
            const comment = formData.get('comment')?.trim();

            if (!password) {
                throw new Error('Withdrawal password is required');
            }

            const approvalData = {
                password,
                comment: comment || null
            };

            console.log('📤 Sending approval request for withdrawal:', this.currentWithdrawal.id);

            const response = await this.apiService.approveWithdrawalRequest(
                this.currentWithdrawal.id, 
                approvalData
            );

            console.log('✅ Approval response:', response);

            if (response?.processed) {
                this.showAlert('Withdrawal approved and processed successfully!', 'success');
            } else if (response?.requiresMoreApprovals) {
                const remaining = response.requiredApprovals - response.currentApprovals;
                this.showAlert(`Approval recorded. ${remaining} more approval${remaining !== 1 ? 's' : ''} needed.`, 'success');
            } else {
                this.showAlert('Approval recorded successfully.', 'success');
            }
            
            this.closeApprovalModal();
            await this.refreshData();
        } catch (error) {
            console.error('❌ Error approving withdrawal:', error);
            this.showAlert(error.message || 'Failed to approve withdrawal.', 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Approve Withdrawal';
            }
        }
    }

    // System operation methods
    async initializeWalletSystem() {
        console.log('⚡ Manually initializing wallet system');
        
        const confirmMessage = 'Are you sure you want to manually initialize the wallet system?\n\nNote: This should only be done once. Existing wallet balances will be preserved.';
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            this.showAlert('Initializing wallet system...', 'info');
            
            const response = await this.apiService.initializeWallets();
            
            if (response?.walletsCreated) {
                const created = response.walletsCreated.length || 0;
                this.showAlert(`Wallet system initialized successfully. ${created} wallets created.`, 'success');
                // Clear error state
                this.error = null;
                await this.refreshData();
            } else {
                throw new Error('Failed to initialize wallet system');
            }
        } catch (error) {
            console.error('❌ Error initializing wallet system:', error);
            this.showAlert(error.message || 'Failed to initialize wallet system.', 'error');
        }
    }
    // Utility methods
    ensureWalletStructure(walletData = {}) {
        // Ensure all wallet categories are arrays
        return {
            TITHE: Array.isArray(walletData.TITHE) ? walletData.TITHE : [],
            OFFERING: Array.isArray(walletData.OFFERING) ? walletData.OFFERING : [],
            DONATION: Array.isArray(walletData.DONATION) ? walletData.DONATION : [],
            SPECIAL_OFFERING: Array.isArray(walletData.SPECIAL_OFFERING) ? walletData.SPECIAL_OFFERING : []
        };
    }

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
        
        if (!options) {
            options = '<option value="" disabled>No wallets with available balance</option>';
        }
        
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
            'SPECIAL_OFFERING': 'Special Offerings',
            'UNKNOWN': 'Unknown Category'
        };
        return names[category] || category || 'Unknown Category';
    }

    getCategoryIcon(category) {
        const icons = {
            'TITHE': '💰',
            'OFFERING': '🎁',
            'DONATION': '💝',
            'SPECIAL_OFFERING': '✨'
        };
        return icons[category] || '💳';
    }

    formatWalletName(wallet) {
        if (!wallet) return 'Unknown Wallet';
        
        const type = wallet.walletType || 'Unknown';
        const subType = wallet.subType;
        
        // Handle null subtypes for OFFERING and DONATION
        if ((type === 'OFFERING' || type === 'DONATION') && !subType) {
            return type.charAt(0) + type.slice(1).toLowerCase();
        }
        
        // Handle SPECIAL_OFFERING with offering name
        if (type === 'SPECIAL_OFFERING' && wallet.specialOffering) {
            return wallet.specialOffering.name || 'Special Offering';
        }
        
        // Handle TITHE subtypes
        if (type === 'TITHE') {
            if (!subType) return 'General Tithe';
            return `${subType.charAt(0).toUpperCase() + subType.slice(1).replace(/([A-Z])/g, ' $1')} Tithe`;
        }
        
        // Default formatting
        return `${type.charAt(0) + type.slice(1).toLowerCase()}${subType ? ` - ${subType}` : ''}`;
    }

    formatCurrency(amount) {
        return parseFloat(amount || 0).toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    }

    formatDate(date) {
        if (!date) return 'N/A';
        try {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async refreshData() {
        console.log('🔄 Refreshing wallet data');
        
        try {
            this.showAlert('Refreshing data...', 'info');
            await this.loadInitialData();
            
            // Re-render the entire view
            const container = document.querySelector('.wallet-page');
            if (container && container.parentNode) {
                const newContainer = await this.render();
                container.parentNode.replaceChild(newContainer, container);
            }
            
            // Only show success if we actually have data or if initialization worked
            if (this.wallets.length > 0 || !this.error) {
                this.showAlert('Data refreshed successfully.', 'success');
            } else if (this.error) {
                this.showAlert(this.error, 'warning');
            }
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            this.showAlert('Failed to refresh data: ' + error.message, 'error');
        }
    }

    viewWithdrawalDetails(withdrawalId) {
        const withdrawal = this.withdrawalRequests.find(w => w.id === withdrawalId);
        if (withdrawal) {
            let detailsHtml = `
                <div class="withdrawal-details-popup">
                    <h3>Withdrawal Details</h3>
                    <div class="detail-grid">
                        <div><strong>Reference:</strong> ${withdrawal.withdrawalReference}</div>
                        <div><strong>Wallet:</strong> ${this.formatWalletName(withdrawal.wallet)}</div>
                        <div><strong>Amount:</strong> KES ${this.formatCurrency(withdrawal.amount)}</div>
                        <div><strong>Purpose:</strong> ${this.escapeHtml(withdrawal.purpose)}</div>
                        <div><strong>Method:</strong> ${withdrawal.withdrawalMethod}</div>
                        <div><strong>Status:</strong> ${withdrawal.status}</div>
                        <div><strong>Progress:</strong> ${withdrawal.currentApprovals}/${withdrawal.requiredApprovals} approvals</div>
                        <div><strong>Requested by:</strong> ${withdrawal.requester?.fullName || 'Unknown'}</div>
                        <div><strong>Created:</strong> ${this.formatDate(withdrawal.createdAt)}</div>
            `;
            
            if (withdrawal.description) {
                detailsHtml += `<div class="full-width"><strong>Description:</strong><br>${this.escapeHtml(withdrawal.description)}</div>`;
            }
            
            if (withdrawal.processedAt) {
                detailsHtml += `<div><strong>Processed:</strong> ${this.formatDate(withdrawal.processedAt)}</div>`;
            }
            
            detailsHtml += `</div></div>`;
            
            // Create modal for details
            const modalHtml = `
                <div class="modal-overlay" id="withdrawalDetailsModal">
                    <div class="modal">
                        <div class="modal-header">
                            <h2>Withdrawal Details</h2>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-content">
                            ${detailsHtml}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = document.getElementById('withdrawalDetailsModal');
            modal.style.display = 'flex';
            
            // Add close functionality
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('modal-close')) {
                    modal.remove();
                }
            });
            
            // Show modal with animation
            requestAnimationFrame(() => {
                const modalElement = modal.querySelector('.modal');
                if (modalElement) {
                    modalElement.classList.add('show');
                }
            });
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
                    .overview { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
                    .stat { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
                    .stat-label { font-size: 12px; color: #666; margin-bottom: 5px; }
                    .stat-value { font-size: 18px; font-weight: bold; color: #4f46e5; }
                    .meta-info { margin-top: 20px; }
                    .meta-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                    .meta-label { font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>TASSIAC CHURCH - WALLET REPORT</h1>
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
                    <div class="stat">
                        <div class="stat-label">Net Activity</div>
                        <div class="stat-value">KES ${this.formatCurrency((this.currentWallet.totalDeposits || 0) - (this.currentWallet.totalWithdrawals || 0))}</div>
                    </div>
                </div>
                
                <div class="meta-info">
                    <div class="meta-row">
                        <span class="meta-label">Wallet ID:</span>
                        <span>${this.currentWallet.id}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Type:</span>
                        <span>${this.currentWallet.walletType}</span>
                    </div>
                    ${this.currentWallet.subType ? `
                        <div class="meta-row">
                            <span class="meta-label">Sub-type:</span>
                            <span>${this.currentWallet.subType}</span>
                        </div>
                    ` : ''}
                    <div class="meta-row">
                        <span class="meta-label">Status:</span>
                        <span>${this.currentWallet.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Last Updated:</span>
                        <span>${this.formatDate(this.currentWallet.lastUpdated || this.currentWallet.updatedAt)}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Created:</span>
                        <span>${this.formatDate(this.currentWallet.createdAt)}</span>
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
            ['Wallet ID', this.currentWallet.id],
            ['Type', this.currentWallet.walletType],
            ['Sub-type', this.currentWallet.subType || ''],
            ['Current Balance', this.currentWallet.balance || 0],
            ['Total Deposits', this.currentWallet.totalDeposits || 0],
            ['Total Withdrawals', this.currentWallet.totalWithdrawals || 0],
            ['Status', this.currentWallet.isActive ? 'Active' : 'Inactive'],
            ['Last Updated', this.currentWallet.lastUpdated || this.currentWallet.updatedAt || ''],
            ['Created', this.currentWallet.createdAt || ''],
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

    showAlert(message, type = 'info') {
        console.log(`🔔 Alert (${type}):`, message);
        
        // Don't show alerts for info messages during initialization
        if (type === 'info' && message.includes('Refreshing data')) {
            return;
        }
        
        // Get or create alerts container
        let alertsContainer = document.getElementById('alerts-container');
        
        if (!alertsContainer) {
            const appContainer = document.getElementById('app') || document.body;
            const tempDiv = document.createElement('div');
            tempDiv.id = 'alerts-container';
            tempDiv.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 10000; max-width: 400px;';
            appContainer.appendChild(tempDiv);
            alertsContainer = tempDiv;
        }

        const alertClass = type === 'success' ? 'alert-success' : 
                          type === 'error' ? 'alert-error' : 
                          type === 'warning' ? 'alert-warning' : 'alert-info';
        const alertIcon = type === 'success' ? '✅' : 
                         type === 'error' ? '❌' : 
                         type === 'warning' ? '⚠️' : 'ℹ️';

        const alertElement = document.createElement('div');
        alertElement.className = `alert ${alertClass}`;
        alertElement.style.cssText = `
            margin-bottom: 1rem; 
            padding: 1rem; 
            border-radius: 8px; 
            display: flex; 
            align-items: center; 
            gap: 1rem; 
            background: ${type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 
                       type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 
                       type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; 
            color: ${type === 'success' ? '#059669' : 
                   type === 'error' ? '#dc2626' : 
                   type === 'warning' ? '#d97706' : '#2563eb'}; 
            border: 1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 
                              type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 
                              type === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'};
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            animation: slideInRight 0.3s ease-out;
        `;

        alertElement.innerHTML = `
            <span>${alertIcon}</span>
            <span style="flex: 1;">${message}</span>
            <button style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: inherit; opacity: 0.7; margin-left: auto;">&times;</button>
        `;

        // Add close functionality
        const closeBtn = alertElement.querySelector('button');
        closeBtn.addEventListener('click', () => {
            alertElement.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.remove();
                }
            }, 300);
        });

        alertsContainer.insertAdjacentElement('afterbegin', alertElement);

        // Auto-remove after appropriate time
        const autoRemoveTime = type === 'warning' ? 7000 : 5000;
        setTimeout(() => {
            if (alertElement.parentNode) {
                alertElement.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (alertElement.parentNode) {
                        alertElement.remove();
                    }
                }, 300);
            }
        }, autoRemoveTime);
    }

    injectStyles() {
        if (document.getElementById('wallet-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'wallet-styles';
        style.textContent = `
            /* Animations */
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Reset and base */
            * { box-sizing: border-box; margin: 0; padding: 0; }
            
            .wallet-page {
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            /* Error and Loading States */
            .error-state, .loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 60vh;
                text-align: center;
                color: white;
            }
            
            .error-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top: 4px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 1rem;
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
                flex-wrap: wrap;
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
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .card-header h2 {
                font-size: 1.4rem;
                font-weight: 700;
                color: #1a202c;
                margin: 0;
            }

            .card-actions {
                display: flex;
                gap: 0.5rem;
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

            /* System stats */
            .system-stats {
                margin-bottom: 3rem;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
            }

            .stat-card {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 16px;
                padding: 2rem;
                display: flex;
                align-items: center;
                gap: 1.5rem;
                border: 1px solid rgba(255, 255, 255, 0.3);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                transition: all 0.3s ease;
            }

            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
            }

            .stat-card .stat-icon {
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #4f46e5, #7c3aed);
                color: white;
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.8rem;
            }

            .stat-card .stat-content {
                flex: 1;
            }

            .stat-card .stat-value {
                font-size: 1.8rem;
                font-weight: 800;
                color: #1a202c;
                margin-bottom: 0.25rem;
            }

            .stat-card .stat-label {
                font-size: 0.9rem;
                color: #64748b;
                font-weight: 500;
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
                font-size: 0.8rem;
                color: #64748b;
                flex-wrap: wrap;
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

            /* Empty transactions */
            .empty-transactions {
                padding: 3rem 2rem;
                text-align: center;
                color: #64748b;
                border: 1px solid rgba(226, 232, 240, 0.5);
                border-radius: 8px;
                background: rgba(248, 250, 252, 0.5);
            }

            .empty-transactions .empty-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                opacity: 0.7;
            }

            .empty-transactions p {
                font-size: 1.1rem;
                margin-bottom: 0.5rem;
                color: #374151;
            }

            .empty-transactions small {
                font-size: 0.9rem;
                color: #9ca3af;
            }

            /* Wallet initialization */
            .wallet-initialization {
                display: flex;
                justify-content: center;
                padding: 2rem;
                grid-column: 1 / -1;
            }

            .init-card {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 20px;
                padding: 3rem 2rem;
                text-align: center;
                max-width: 500px;
                border: 2px solid rgba(79, 70, 229, 0.2);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }

            .init-icon {
                font-size: 4rem;
                margin-bottom: 1.5rem;
                color: #4f46e5;
            }

            .init-card h3 {
                font-size: 1.8rem;
                font-weight: 700;
                color: #1a202c;
                margin-bottom: 1rem;
            }

            .init-card p {
                font-size: 1.1rem;
                color: #64748b;
                margin-bottom: 2rem;
                line-height: 1.6;
            }

            .init-info {
                margin: 2rem 0;
                text-align: left;
                background: rgba(79, 70, 229, 0.05);
                border-radius: 12px;
                padding: 1.5rem;
            }

            .info-item {
                display: flex;
                align-items: center;
                margin-bottom: 0.75rem;
                color: #374151;
                font-weight: 500;
            }

            .info-item:last-child {
                margin-bottom: 0;
            }

            .init-note {
                display: block;
                margin-top: 1rem;
                color: #9ca3af;
                font-size: 0.9rem;
            }

            /* Empty wallet message */
            .empty-wallet-message {
                text-align: center;
                padding: 3rem 2rem;
                color: #64748b;
            }

            .empty-wallet-message .empty-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                opacity: 0.7;
            }

            .empty-wallet-message p {
                font-size: 1.1rem;
                margin-bottom: 0.5rem;
                color: #374151;
            }

            .empty-wallet-message small {
                font-size: 0.9rem;
                color: #9ca3af;
            }

            /* Tables */
            .withdrawals-table {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .table-header {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
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
                grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
                gap: 1rem;
                padding: 1rem 1.5rem;
                background: rgba(248, 250, 252, 0.8);
                border: 1px solid rgba(226, 232, 240, 0.5);
                border-radius: 8px;
                align-items: center;
                transition: all 0.3s ease;
                font-size: 0.85rem;
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

            .status-approved {
                background: rgba(59, 130, 246, 0.2);
                color: #3b82f6;
            }

            .status-active {
                background: rgba(16, 185, 129, 0.2);
                color: #10b981;
            }

            .status-inactive {
                background: rgba(156, 163, 175, 0.2);
                color: #9ca3af;
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

            .approval-wallet {
                color: #4f46e5;
                font-size: 0.9rem;
                font-weight: 500;
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

            .form-help {
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

            .wallet-meta-info {
                margin-bottom: 2rem;
                padding: 1.5rem;
                background: rgba(248, 250, 252, 0.8);
                border-radius: 8px;
                border: 1px solid rgba(226, 232, 240, 0.5);
            }

            .meta-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 0.75rem;
                border-bottom: 1px solid rgba(226, 232, 240, 0.5);
            }

            .meta-row:last-child {
                margin-bottom: 0;
                border-bottom: none;
            }

            .meta-label {
                font-weight: 600;
                color: #64748b;
                font-size: 0.9rem;
            }

            .meta-value {
                font-weight: 700;
                color: #1a202c;
                font-size: 0.9rem;
            }

            /* Wallet transactions */
            .wallet-transactions {
                margin-bottom: 2rem;
            }

            .wallet-transactions h3 {
                color: #1a202c;
                margin-bottom: 1rem;
                font-size: 1.2rem;
                font-weight: 700;
            }

            .transactions-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid rgba(226, 232, 240, 0.5);
                border-radius: 8px;
            }

            .transaction-item {
                display: grid;
                grid-template-columns: 1fr auto auto 2fr;
                gap: 1rem;
                padding: 1rem;
                border-bottom: 1px solid rgba(226, 232, 240, 0.3);
                align-items: center;
                font-size: 0.9rem;
            }

            .transaction-item:last-child {
                border-bottom: none;
            }

            .transaction-type {
                font-weight: 600;
                color: #374151;
            }

            .transaction-amount {
                font-weight: 700;
                font-size: 1rem;
            }

            .transaction-amount.positive {
                color: #059669;
            }

            .transaction-amount.negative {
                color: #dc2626;
            }

            .transaction-date {
                color: #64748b;
                font-size: 0.8rem;
            }

            .transaction-description {
                color: #64748b;
                font-size: 0.85rem;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
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

            /* Withdrawal details popup */
            .withdrawal-details-popup {
                max-width: 600px;
            }

            .withdrawal-details-popup h3 {
                color: #1a202c;
                margin-bottom: 1.5rem;
                font-size: 1.3rem;
                font-weight: 700;
            }

            .detail-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
            }

            .detail-grid .full-width {
                grid-column: 1 / -1;
                margin-top: 0.5rem;
                padding-top: 1rem;
                border-top: 1px solid rgba(226, 232, 240, 0.5);
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

            .alert-warning {
                background: rgba(245, 158, 11, 0.1);
                color: #d97706;
                border: 1px solid rgba(245, 158, 11, 0.2);
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
                margin: 0 auto 1.5rem;
            }

            /* Responsive design */
            @media (max-width: 1024px) {
                .nav-links { display: none; }
                .main-content { padding: 1.5rem; }
                .hero-card { grid-template-columns: 1fr; gap: 2rem; text-align: center; }
                .balance-amount { font-size: 2.5rem; }
                .wallets-grid { grid-template-columns: 1fr; }
                .quick-stats { grid-template-columns: 1fr; }
                .stats-grid { grid-template-columns: repeat(2, 1fr); }
            }

            @media (max-width: 768px) {
                .top-nav { padding: 1rem; }
                .nav-brand { font-size: 1rem; }
                .user-name { display: none; }
                .main-content { padding: 1rem; }
                .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
                .page-title { font-size: 2rem; }
                .header-actions { width: 100%; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; }
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
                .stats-grid { grid-template-columns: 1fr; }
                .wallet-overview { grid-template-columns: repeat(2, 1fr); }
                .transaction-item { grid-template-columns: 1fr; gap: 0.5rem; text-align: left; }
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
                .wallet-overview { grid-template-columns: 1fr; }
                .detail-grid { grid-template-columns: 1fr; }
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

    // Cleanup method
    cleanup() {
        this.stopAutoRefresh();
        // Clear any existing abort controllers
        this.abortControllers.forEach(controller => controller.abort());
        this.abortControllers.clear();
        console.log('🧹 Wallet view cleanup completed');
    }
}

// Auto-initialize and export
if (typeof window !== 'undefined') {
    window.AdminWalletsView = AdminWalletsView;
    console.log('💰 AdminWalletsView class loaded and available globally');
}

export default AdminWalletsView;