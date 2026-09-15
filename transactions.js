const Transactions = {
    requests: [],
    statuses: ['Pending', 'Approved', 'Rejected', 'Released', 'Returned', 'Overdue', 'Closed'],

    init() {
        this.loadRequests();
    },

    loadRequests() {
        const stored = Utils.getStorage('lab_requests');
        if (stored) {
            this.requests = stored;
        } else {
            this.requests = this.getDefaultRequests();
            this.saveRequests();
        }
    },

    getDefaultRequests() {
        return [
            {
                id: 'REQ-001',
                equipmentId: 'EQP-001',
                requesterId: 'USR-003',
                requesterName: 'Jane Requester',
                equipmentName: 'Laptop Dell XPS 15',
                dateRequested: '2024-07-15T10:30:00.000Z',
                dateNeeded: '2024-07-16',
                purpose: 'Data analysis for research project',
                status: 'Approved',
                approvedBy: 'USR-001',
                approvedAt: '2024-07-15T11:00:00.000Z',
                releasedAt: '2024-07-16T09:00:00.000Z',
                returnedAt: '2024-07-18T17:00:00.000Z',
                returnedCondition: 'Good',
                closedAt: '2024-07-18T17:00:00.000Z',
                notes: ''
            },
            {
                id: 'REQ-002',
                equipmentId: 'EQP-002',
                requesterId: 'USR-003',
                requesterName: 'Jane Requester',
                equipmentName: 'Compound Microscope Olympus CX23',
                dateRequested: '2024-07-16T14:20:00.000Z',
                dateNeeded: '2024-07-17',
                purpose: 'Cell observation experiment',
                status: 'Pending',
                approvedBy: null,
                approvedAt: null,
                releasedAt: null,
                returnedAt: null,
                returnedCondition: null,
                closedAt: null,
                notes: ''
            },
            {
                id: 'REQ-003',
                equipmentId: 'EQP-003',
                requesterId: 'USR-002',
                requesterName: 'John Staff',
                equipmentName: 'UV-Vis Spectrophotometer',
                dateRequested: '2024-07-16T09:15:00.000Z',
                dateNeeded: '2024-07-17',
                purpose: 'Spectral analysis',
                status: 'Rejected',
                approvedBy: 'USR-001',
                approvedAt: '2024-07-16T10:00:00.000Z',
                rejectionReason: 'Equipment under maintenance',
                releasedAt: null,
                returnedAt: null,
                returnedCondition: null,
                closedAt: null,
                notes: ''
            }
        ];
    },

    saveRequests() {
        Utils.setStorage('lab_requests', this.requests);
    },

    getAll() {
        return [...this.requests].sort((a, b) => new Date(b.dateRequested) - new Date(a.dateRequested));
    },

    getById(id) {
        return this.requests.find(req => req.id === id);
    },

    getByRequester(requesterId) {
        return this.requests.filter(req => req.requesterId === requesterId)
            .sort((a, b) => new Date(b.dateRequested) - new Date(a.dateRequested));
    },

    getByStatus(status) {
        if (status === 'all') return this.getAll();
        return this.requests.filter(req => req.status === status)
            .sort((a, b) => new Date(b.dateRequested) - new Date(a.dateRequested));
    },

    search(query) {
        if (!query) return this.getAll();
        const lowerQuery = query.toLowerCase();
        return this.requests.filter(req =>
            req.id.toLowerCase().includes(lowerQuery) ||
            req.equipmentName.toLowerCase().includes(lowerQuery) ||
            req.requesterName.toLowerCase().includes(lowerQuery) ||
            req.purpose.toLowerCase().includes(lowerQuery)
        );
    },

    create(data) {
        if (!Auth.hasPermission('requests', 'create')) {
            throw new Error('Insufficient permissions to create requests');
        }

        Equipment.validateCanBorrow(data.equipmentId);

        const equipment = Equipment.getById(data.equipmentId);
        const requester = Auth.getUserById(data.requesterId) || { name: 'Unknown' };

        const newRequest = {
            id: Utils.generateId('REQ-'),
            equipmentId: data.equipmentId,
            requesterId: data.requesterId,
            requesterName: requester.name,
            equipmentName: equipment.name,
            dateRequested: new Date().toISOString(),
            dateNeeded: data.dateNeeded,
            purpose: data.purpose,
            status: 'Pending',
            approvedBy: null,
            approvedAt: null,
            rejectionReason: null,
            releasedAt: null,
            returnedAt: null,
            returnedCondition: null,
            closedAt: null,
            notes: data.notes || ''
        };

        this.requests.push(newRequest);
        this.saveRequests();
        Audit.log('CREATE', 'Borrowing', newRequest.id, `Created borrowing request for ${equipment.name}`, Auth.getCurrentUser().id);
        return newRequest;
    },

    approve(id, approverId) {
        if (!Auth.hasPermission('requests', 'approve')) {
            throw new Error('Only Administrators may approve requests (BR-A4-03)');
        }

        const request = this.getById(id);
        if (!request) throw new Error('Request not found');

        if (request.requesterId === approverId) {
            throw new Error('Staff cannot approve their own request (BR-A4-02)');
        }

        if (request.status !== 'Pending') {
            throw new Error('Only pending requests can be approved');
        }

        const equipment = Equipment.getById(request.equipmentId);
        if (!equipment || equipment.status !== 'Available') {
            throw new Error('Equipment is no longer available');
        }

        request.status = 'Approved';
        request.approvedBy = approverId;
        request.approvedAt = new Date().toISOString();
        this.saveRequests();

        Equipment.updateStatus(request.equipmentId, 'Borrowed');
        Audit.log('APPROVE', 'Borrowing', id, `Approved borrowing request for ${request.equipmentName}`, approverId);
        Utils.showToast('success', 'Request Approved', `Request ${request.id} has been approved`);
        return request;
    },

    reject(id, approverId, reason) {
        if (!Auth.hasPermission('requests', 'reject')) {
            throw new Error('Only Administrators may reject requests (BR-A4-03)');
        }

        const request = this.getById(id);
        if (!request) throw new Error('Request not found');

        if (request.requesterId === approverId) {
            throw new Error('Staff cannot reject their own request (BR-A4-02)');
        }

        if (request.status !== 'Pending') {
            throw new Error('Only pending requests can be rejected');
        }

        request.status = 'Rejected';
        request.approvedBy = approverId;
        request.approvedAt = new Date().toISOString();
        request.rejectionReason = reason;
        this.saveRequests();

        Audit.log('REJECT', 'Borrowing', id, `Rejected borrowing request for ${request.equipmentName}: ${reason}`, approverId);
        Utils.showToast('warning', 'Request Rejected', `Request ${request.id} has been rejected`);
        return request;
    },

    release(id, releaserId) {
        if (!Auth.hasPermission('requests', 'release')) {
            throw new Error('Insufficient permissions to release equipment');
        }

        const request = this.getById(id);
        if (!request) throw new Error('Request not found');

        if (request.status !== 'Approved') {
            throw new Error('Only approved requests may be released (BR-A4-04)');
        }

        if (request.status === 'Rejected') {
            throw new Error('Rejected requests cannot be released (BR-A4-07)');
        }

        const equipment = Equipment.getById(request.equipmentId);
        if (!equipment || equipment.status !== 'Available') {
            throw new Error('Equipment is not available for release');
        }

        request.status = 'Released';
        request.releasedAt = new Date().toISOString();
        this.saveRequests();

        Equipment.updateStatus(request.equipmentId, 'Borrowed');
        Audit.log('RELEASE', 'Borrowing', id, `Released equipment ${request.equipmentName} to ${request.requesterName}`, releaserId);
        Utils.showToast('success', 'Equipment Released', `Equipment ${request.equipmentName} has been released`);
        return request;
    },

    return(id, returnerId, condition = 'Good', notes = '') {
        if (!Auth.hasPermission('requests', 'return')) {
            throw new Error('Insufficient permissions to process returns');
        }

        const request = this.getById(id);
        if (!request) throw new Error('Request not found');

        if (request.status !== 'Released') {
            throw new Error('Only released equipment can be returned');
        }

        if (request.returnedAt) {
            throw new Error('Returned transactions cannot be processed twice (BR-A4-08)');
        }

        request.status = 'Returned';
        request.returnedAt = new Date().toISOString();
        request.returnedCondition = condition;
        request.notes = notes;
        this.saveRequests();

        const newStatus = condition === 'Damaged' ? 'Damaged' : 'Available';
        Equipment.updateStatus(request.equipmentId, newStatus);

        Audit.log('RETURN', 'Borrowing', id, `Returned equipment ${request.equipmentName} - Condition: ${condition}`, returnerId);
        Utils.showToast('success', 'Equipment Returned', `Equipment ${request.equipmentName} returned as ${condition}`);
        return request;
    },

    close(id, closerId) {
        if (!Auth.hasPermission('requests', 'close')) {
            throw new Error('Insufficient permissions to close requests');
        }

        const request = this.getById(id);
        if (!request) throw new Error('Request not found');

        if (request.status !== 'Returned') {
            throw new Error('Only returned requests can be closed');
        }

        request.status = 'Closed';
        request.closedAt = new Date().toISOString();
        this.saveRequests();

        Audit.log('UPDATE', 'Borrowing', id, `Closed request for ${request.equipmentName}`, closerId);
        Utils.showToast('info', 'Request Closed', `Request ${request.id} has been closed`);
        return request;
    },

    checkOverdue() {
        const now = new Date();
        let updated = 0;

        this.requests.forEach(request => {
            if (request.status === 'Released' && request.releasedAt) {
                const dueDate = new Date(request.releasedAt);
                dueDate.setDate(dueDate.getDate() + 7);

                if (now > dueDate) {
                    request.status = 'Overdue';
                    updated++;
                }
            }
        });

        if (updated > 0) {
            this.saveRequests();
        }

        return updated;
    },

    getStats() {
        const stats = {};
        this.statuses.forEach(status => {
            stats[status.toLowerCase()] = this.requests.filter(r => r.status === status).length;
        });
        stats.total = this.requests.length;
        return stats;
    },

    getUserStats(userId) {
        const userRequests = this.getByRequester(userId);
        const stats = {};
        this.statuses.forEach(status => {
            stats[status.toLowerCase()] = userRequests.filter(r => r.status === status).length;
        });
        stats.total = userRequests.length;
        return stats;
    }
};

window.Transactions = Transactions;