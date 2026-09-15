const Audit = {
    logs: [],

    init() {
        this.loadLogs();
    },

    loadLogs() {
        const stored = Utils.getStorage('lab_audit_logs');
        if (stored) {
            this.logs = stored;
        } else {
            this.logs = [];
            this.saveLogs();
        }
    },

    saveLogs() {
        Utils.setStorage('lab_audit_logs', this.logs);
    },

    log(action, module, recordId, description, userId = null) {
        const user = userId ? Auth.getUserById(userId) : Auth.getCurrentUser();
        const logEntry = {
            id: Utils.generateId('LOG-'),
            userId: user?.id || 'SYSTEM',
            userName: user?.name || 'System',
            action: action.toUpperCase(),
            module: module,
            recordId: recordId,
            description: description,
            createdAt: new Date().toISOString()
        };

        this.logs.unshift(logEntry);

        if (this.logs.length > 10000) {
            this.logs = this.logs.slice(0, 10000);
        }

        this.saveLogs();
        return logEntry;
    },

    getAll() {
        return [...this.logs];
    },

    getByUser(userId) {
        return this.logs.filter(log => log.userId === userId);
    },

    getByModule(module) {
        return this.logs.filter(log => log.module === module);
    },

    getByAction(action) {
        return this.logs.filter(log => log.action === action.toUpperCase());
    },

    getByRecord(recordId) {
        return this.logs.filter(log => log.recordId === recordId);
    },

    search(query) {
        if (!query) return this.getAll();
        const lowerQuery = query.toLowerCase();
        return this.logs.filter(log =>
            log.userName.toLowerCase().includes(lowerQuery) ||
            log.action.toLowerCase().includes(lowerQuery) ||
            log.module.toLowerCase().includes(lowerQuery) ||
            log.recordId.toLowerCase().includes(lowerQuery) ||
            log.description.toLowerCase().includes(lowerQuery)
        );
    },

    filter(filters) {
        return this.logs.filter(log => {
            if (filters.module && filters.module !== 'all' && log.module !== filters.module) return false;
            if (filters.action && filters.action !== 'all' && log.action !== filters.action.toUpperCase()) return false;
            if (filters.userId && log.userId !== filters.userId) return false;
            if (filters.dateFrom && new Date(log.createdAt) < new Date(filters.dateFrom)) return false;
            if (filters.dateTo && new Date(log.createdAt) > new Date(filters.dateTo)) return false;
            return true;
        });
    },

    getModules() {
        const modules = [...new Set(this.logs.map(log => log.module))];
        return modules.sort();
    },

    getActions() {
        const actions = [...new Set(this.logs.map(log => log.action))];
        return actions.sort();
    },

    clearLogs() {
        if (!Auth.hasPermission('audit', 'view')) {
            throw new Error('Insufficient permissions');
        }
        this.logs = [];
        this.saveLogs();
        Audit.log('DELETE', 'Audit', 'ALL', 'Audit logs cleared', Auth.getCurrentUser().id);
    }
};

window.Audit = Audit;