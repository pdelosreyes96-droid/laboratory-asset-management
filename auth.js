const Auth = {
    currentUser: null,
    users: [],
    roles: {
        ADMINISTRATOR: 'Administrator',
        STAFF: 'Laboratory Staff',
        REQUESTER: 'Requester'
    },

    permissions: {
        'Administrator': {
            equipment: ['view', 'create', 'update', 'delete'],
            requests: ['view', 'create', 'approve', 'reject', 'release', 'return', 'close'],
            users: ['view', 'create', 'update', 'delete'],
            maintenance: ['view', 'create', 'update', 'delete'],
            audit: ['view'],
            reports: ['view'],
            dashboard: ['view']
        },
        'Laboratory Staff': {
            equipment: ['view', 'create', 'update'],
            requests: ['view', 'create', 'release', 'return'],
            users: ['view'],
            maintenance: ['view', 'create', 'update'],
            audit: [],
            reports: [],
            dashboard: ['view']
        },
        'Requester': {
            equipment: ['view'],
            requests: ['view', 'create'],
            users: [],
            maintenance: [],
            audit: [],
            reports: [],
            dashboard: ['view']
        }
    },

    navigationConfig: {
        'Administrator': [
            { id: 'dashboard', label: 'Dashboard', icon: this.getIcon('dashboard') },
            { id: 'equipment', label: 'Equipment', icon: this.getIcon('equipment') },
            { id: 'requests', label: 'Requests', icon: this.getIcon('requests') },
            { id: 'users', label: 'Users', icon: this.getIcon('users') },
            { id: 'maintenance', label: 'Maintenance', icon: this.getIcon('maintenance') },
            { id: 'audit', label: 'Audit Logs', icon: this.getIcon('audit') },
            { id: 'reports', label: 'Reports', icon: this.getIcon('reports') }
        ],
        'Laboratory Staff': [
            { id: 'dashboard', label: 'Dashboard', icon: this.getIcon('dashboard') },
            { id: 'equipment', label: 'Equipment', icon: this.getIcon('equipment') },
            { id: 'requests', label: 'Requests', icon: this.getIcon('requests') },
            { id: 'maintenance', label: 'Maintenance', icon: this.getIcon('maintenance') }
        ],
        'Requester': [
            { id: 'dashboard', label: 'Dashboard', icon: this.getIcon('dashboard') },
            { id: 'equipment', label: 'Equipment', icon: this.getIcon('equipment') },
            { id: 'requests', label: 'My Requests', icon: this.getIcon('requests') }
        ]
    },

    getIcon(type) {
        const icons = {
            dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>',
            equipment: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path></svg>',
            requests: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
            users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
            maintenance: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
            audit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
            reports: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
        };
        return icons[type] || '';
    },

    init() {
        this.loadUsers();
        this.loadSession();
        this.bindEvents();
    },

    loadUsers() {
        const stored = Utils.getStorage('lab_users');
        if (stored) {
            this.users = stored;
        } else {
            this.users = this.getDefaultUsers();
            this.saveUsers();
        }
    },

    getDefaultUsers() {
        return [
            {
                id: 'USR-001',
                name: 'Admin User',
                email: 'admin@lab.com',
                password: 'admin123',
                role: 'Administrator',
                status: 'Active',
                createdAt: new Date().toISOString()
            },
            {
                id: 'USR-002',
                name: 'John Staff',
                email: 'staff@lab.com',
                password: 'staff123',
                role: 'Laboratory Staff',
                status: 'Active',
                createdAt: new Date().toISOString()
            },
            {
                id: 'USR-003',
                name: 'Jane Requester',
                email: 'requester@lab.com',
                password: 'requester123',
                role: 'Requester',
                status: 'Active',
                createdAt: new Date().toISOString()
            },
            {
                id: 'USR-004',
                name: 'Maria Santos',
                email: 'maria@lab.com',
                password: 'maria123',
                role: 'Administrator',
                status: 'Active',
                createdAt: new Date().toISOString()
            }
        ];
    },

    saveUsers() {
        Utils.setStorage('lab_users', this.users);
    },

    loadSession() {
        const session = Utils.getStorage('lab_session');
        if (session && session.userId) {
            const user = this.users.find(u => u.id === session.userId);
            if (user) {
                this.currentUser = { ...user };
                delete this.currentUser.password;
            }
        }
    },

    saveSession() {
        if (this.currentUser) {
            Utils.setStorage('lab_session', { userId: this.currentUser.id });
        } else {
            Utils.removeStorage('lab_session');
        }
    },

    bindEvents() {
        const logoutBtn = document.getElementById('logoutBtn');
        const userBtn = document.getElementById('userBtn');
        const userDropdown = document.getElementById('userDropdown');

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        if (userBtn) {
            userBtn.addEventListener('click', () => {
                const expanded = userBtn.getAttribute('aria-expanded') === 'true';
                userBtn.setAttribute('aria-expanded', !expanded);
                userDropdown.classList.toggle('open');
            });
        }

        document.addEventListener('click', (e) => {
            if (!userBtn?.contains(e.target) && !userDropdown?.contains(e.target)) {
                userBtn?.setAttribute('aria-expanded', 'false');
                userDropdown?.classList.remove('open');
            }
        });
    },

    login(email, password) {
        const user = this.users.find(u => u.email === email && u.password === password && u.status === 'Active');
        if (user) {
            this.currentUser = { ...user };
            delete this.currentUser.password;
            this.saveSession();
            return { success: true, user: this.currentUser };
        }
        return { success: false, message: 'Invalid credentials or account inactive' };
    },

    logout() {
        if (this.currentUser) {
            Audit.log('LOGOUT', 'Authentication', this.currentUser.id, `User ${this.currentUser.name} logged out`);
        }
        this.currentUser = null;
        Utils.removeStorage('lab_session');
        window.location.reload();
    },

    isAuthenticated() {
        return !!this.currentUser;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    getUserRole() {
        return this.currentUser?.role || null;
    },

    hasPermission(module, action) {
        if (!this.currentUser) return false;
        const rolePerms = this.permissions[this.currentUser.role];
        if (!rolePerms) return false;
        const modulePerms = rolePerms[module];
        if (!modulePerms) return false;
        return modulePerms.includes(action);
    },

    canAccessPage(pageId) {
        if (!this.currentUser) return false;
        const navConfig = this.navigationConfig[this.currentUser.role];
        return navConfig?.some(item => item.id === pageId) ?? false;
    },

    getNavigationItems() {
        if (!this.currentUser) return [];
        return this.navigationConfig[this.currentUser.role] || [];
    },

    getAllUsers() {
        return this.users.map(u => {
            const { password, ...user } = u;
            return user;
        });
    },

    getUserById(id) {
        const user = this.users.find(u => u.id === id);
        if (user) {
            const { password, ...u } = user;
            return u;
        }
        return null;
    },

    createUser(userData) {
        if (!this.hasPermission('users', 'create')) {
            throw new Error('Insufficient permissions to create users');
        }

        const newUser = {
            id: Utils.generateId('USR-'),
            ...userData,
            status: 'Active',
            createdAt: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveUsers();
        Audit.log('CREATE', 'User Management', newUser.id, `Created user ${newUser.name} with role ${newUser.role}`, this.currentUser.id);

        const { password, ...user } = newUser;
        return user;
    },

    updateUser(id, updates) {
        if (!this.hasPermission('users', 'update')) {
            throw new Error('Insufficient permissions to update users');
        }

        const index = this.users.findIndex(u => u.id === id);
        if (index === -1) throw new Error('User not found');

        const oldUser = { ...this.users[index] };
        this.users[index] = { ...this.users[index], ...updates };
        this.saveUsers();

        Audit.log('UPDATE', 'User Management', id, `Updated user ${oldUser.name}`, this.currentUser.id);

        const { password, ...user } = this.users[index];
        return user;
    },

    deleteUser(id) {
        if (!this.hasPermission('users', 'delete')) {
            throw new Error('Insufficient permissions to delete users');
        }

        const user = this.users.find(u => u.id === id);
        if (!user) throw new Error('User not found');

        if (user.id === this.currentUser.id) {
            throw new Error('Cannot delete your own account');
        }

        this.users = this.users.filter(u => u.id !== id);
        this.saveUsers();
        Audit.log('DELETE', 'User Management', id, `Deleted user ${user.name}`, this.currentUser.id);
        return true;
    },

    updateProfile(updates) {
        if (!this.currentUser) throw new Error('Not authenticated');

        const allowedUpdates = ['name', 'email'];
        const filteredUpdates = {};
        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) filteredUpdates[key] = updates[key];
        });

        return this.updateUser(this.currentUser.id, filteredUpdates);
    },

    changePassword(currentPassword, newPassword) {
        if (!this.currentUser) throw new Error('Not authenticated');

        const user = this.users.find(u => u.id === this.currentUser.id);
        if (!user) throw new Error('User not found');
        if (user.password !== currentPassword) throw new Error('Current password is incorrect');

        user.password = newPassword;
        this.saveUsers();
        Audit.log('UPDATE', 'Authentication', user.id, 'Password changed', user.id);
        return true;
    }
};

window.Auth = Auth;