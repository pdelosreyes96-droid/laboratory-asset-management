const Maintenance = {
    records: [],
    types: ['Calibration', 'Repair', 'Inspection', 'Cleaning', 'Upgrade'],
    statuses: ['Scheduled', 'In Progress', 'Completed'],

    init() {
        this.loadRecords();
    },

    loadRecords() {
        const stored = Utils.getStorage('lab_maintenance');
        if (stored) {
            this.records = stored;
        } else {
            this.records = this.getDefaultRecords();
            this.saveRecords();
        }
    },

    getDefaultRecords() {
        return [
            {
                id: 'MNT-001',
                equipmentId: 'EQP-003',
                equipmentName: 'UV-Vis Spectrophotometer',
                type: 'Calibration',
                scheduledDate: '2024-07-20',
                status: 'Scheduled',
                technician: 'John Staff',
                technicianId: 'USR-002',
                notes: 'Annual calibration',
                completedAt: null,
                completedBy: null
            },
            {
                id: 'MNT-002',
                equipmentId: 'EQP-007',
                equipmentName: 'Digital pH Meter',
                type: 'Repair',
                scheduledDate: '2024-07-18',
                status: 'In Progress',
                technician: 'Maria Santos',
                technicianId: 'USR-004',
                notes: 'Electrode replacement',
                completedAt: null,
                completedBy: null
            },
            {
                id: 'MNT-003',
                equipmentId: 'EQP-004',
                equipmentName: 'High-Speed Centrifuge',
                type: 'Inspection',
                scheduledDate: '2024-07-10',
                status: 'Completed',
                technician: 'John Staff',
                technicianId: 'USR-002',
                notes: 'Routine inspection',
                completedAt: '2024-07-10T14:30:00.000Z',
                completedBy: 'USR-002'
            }
        ];
    },

    saveRecords() {
        Utils.setStorage('lab_maintenance', this.records);
    },

    getAll() {
        return [...this.records].sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    },

    getById(id) {
        return this.records.find(record => record.id === id);
    },

    getByEquipment(equipmentId) {
        return this.records.filter(record => record.equipmentId === equipmentId)
            .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
    },

    getByStatus(status) {
        if (status === 'all') return this.getAll();
        return this.records.filter(record => record.status === status)
            .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    },

    search(query) {
        if (!query) return this.getAll();
        const lowerQuery = query.toLowerCase();
        return this.records.filter(record =>
            record.equipmentName.toLowerCase().includes(lowerQuery) ||
            record.type.toLowerCase().includes(lowerQuery) ||
            record.technician.toLowerCase().includes(lowerQuery) ||
            record.id.toLowerCase().includes(lowerQuery)
        );
    },

    filter(status) {
        if (status === 'all') return this.getAll();
        return this.getByStatus(status);
    },

    create(data) {
        if (!Auth.hasPermission('maintenance', 'create')) {
            throw new Error('Insufficient permissions to schedule maintenance');
        }

        const equipment = Equipment.getById(data.equipmentId);
        if (!equipment) throw new Error('Equipment not found');

        const technician = Auth.getUserById(data.technicianId) || { name: 'Unknown' };

        const newRecord = {
            id: Utils.generateId('MNT-'),
            equipmentId: data.equipmentId,
            equipmentName: equipment.name,
            type: data.type,
            scheduledDate: data.scheduledDate,
            status: 'Scheduled',
            technician: technician.name,
            technicianId: data.technicianId,
            notes: data.notes || '',
            completedAt: null,
            completedBy: null
        };

        this.records.push(newRecord);
        this.saveRecords();

        Equipment.updateStatus(data.equipmentId, 'Maintenance');
        Audit.log('CREATE', 'Maintenance', newRecord.id, `Scheduled ${data.type} maintenance for ${equipment.name}`, Auth.getCurrentUser().id);
        Utils.showToast('success', 'Maintenance Scheduled', `Maintenance for ${equipment.name} has been scheduled`);
        return newRecord;
    },

    update(id, updates) {
        if (!Auth.hasPermission('maintenance', 'update')) {
            throw new Error('Insufficient permissions to update maintenance');
        }

        const index = this.records.findIndex(record => record.id === id);
        if (index === -1) throw new Error('Maintenance record not found');

        const oldRecord = { ...this.records[index] };
        const allowedUpdates = ['type', 'scheduledDate', 'status', 'technicianId', 'notes'];
        const filteredUpdates = {};
        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) filteredUpdates[key] = updates[key];
        });

        if (filteredUpdates.technicianId) {
            const technician = Auth.getUserById(filteredUpdates.technicianId);
            if (technician) {
                filteredUpdates.technician = technician.name;
            }
        }

        if (filteredUpdates.status === 'Completed' && oldRecord.status !== 'Completed') {
            filteredUpdates.completedAt = new Date().toISOString();
            filteredUpdates.completedBy = Auth.getCurrentUser().id;

            const equipment = Equipment.getById(oldRecord.equipmentId);
            if (equipment) {
                Equipment.updateStatus(equipment.id, 'Available');
            }
        }

        this.records[index] = { ...this.records[index], ...filteredUpdates };
        this.saveRecords();

        Audit.log('UPDATE', 'Maintenance', id, `Updated maintenance for ${oldRecord.equipmentName}`, Auth.getCurrentUser().id);
        Utils.showToast('success', 'Maintenance Updated', 'Maintenance record has been updated');
        return this.records[index];
    },

    delete(id) {
        if (!Auth.hasPermission('maintenance', 'delete')) {
            throw new Error('Insufficient permissions to delete maintenance');
        }

        const record = this.records.find(r => r.id === id);
        if (!record) throw new Error('Maintenance record not found');

        this.records = this.records.filter(r => r.id !== id);
        this.saveRecords();

        Audit.log('DELETE', 'Maintenance', id, `Deleted maintenance for ${record.equipmentName}`, Auth.getCurrentUser().id);
        Utils.showToast('success', 'Maintenance Deleted', 'Maintenance record has been deleted');
        return true;
    },

    getStats() {
        const stats = {};
        this.statuses.forEach(status => {
            stats[status.toLowerCase().replace(' ', '-')] = this.records.filter(r => r.status === status).length;
        });
        stats.total = this.records.length;
        stats.upcoming = this.records.filter(r => r.status === 'Scheduled' && new Date(r.scheduledDate) >= new Date()).length;
        stats.overdue = this.records.filter(r => r.status === 'Scheduled' && new Date(r.scheduledDate) < new Date()).length;
        return stats;
    }
};

window.Maintenance = Maintenance;