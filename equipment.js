const Equipment = {
    items: [],
    categories: ['Computer', 'Microscope', 'Spectrometer', 'Centrifuge', 'Incubator', 'Balance', 'pH Meter', 'Other'],

    init() {
        this.loadEquipment();
    },

    loadEquipment() {
        const stored = Utils.getStorage('lab_equipment');
        if (stored) {
            this.items = stored;
        } else {
            this.items = this.getDefaultEquipment();
            this.saveEquipment();
        }
    },

    getDefaultEquipment() {
        return [
            {
                id: 'EQP-001',
                name: 'Laptop Dell XPS 15',
                category: 'Computer',
                serialNumber: 'DLXPS15-001',
                status: 'Available',
                location: 'Lab Room A-101',
                condition: 'Excellent',
                purchaseDate: '2024-01-15',
                lastMaintenance: null,
                notes: 'High-performance laptop for data analysis'
            },
            {
                id: 'EQP-002',
                name: 'Compound Microscope Olympus CX23',
                category: 'Microscope',
                serialNumber: 'OLY-CX23-002',
                status: 'Available',
                location: 'Lab Room A-102',
                condition: 'Good',
                purchaseDate: '2023-11-20',
                lastMaintenance: '2024-06-15',
                notes: 'Binocular microscope with 4x, 10x, 40x, 100x objectives'
            },
            {
                id: 'EQP-003',
                name: 'UV-Vis Spectrophotometer',
                category: 'Spectrometer',
                serialNumber: 'UV-VIS-003',
                status: 'Maintenance',
                location: 'Lab Room A-103',
                condition: 'Fair',
                purchaseDate: '2023-08-10',
                lastMaintenance: '2024-07-01',
                notes: 'Scheduled for calibration'
            },
            {
                id: 'EQP-004',
                name: 'High-Speed Centrifuge',
                category: 'Centrifuge',
                serialNumber: 'CENT-004',
                status: 'Borrowed',
                location: 'Lab Room A-104',
                condition: 'Good',
                purchaseDate: '2023-12-05',
                lastMaintenance: '2024-05-20',
                notes: 'Max 15,000 RPM'
            },
            {
                id: 'EQP-005',
                name: 'CO2 Incubator',
                category: 'Incubator',
                serialNumber: 'INC-005',
                status: 'Available',
                location: 'Lab Room B-201',
                condition: 'Excellent',
                purchaseDate: '2024-02-28',
                lastMaintenance: '2024-06-10',
                notes: 'Cell culture incubator with CO2 control'
            },
            {
                id: 'EQP-006',
                name: 'Analytical Balance',
                category: 'Balance',
                serialNumber: 'BAL-006',
                status: 'Available',
                location: 'Lab Room A-101',
                condition: 'Good',
                purchaseDate: '2023-09-12',
                lastMaintenance: '2024-04-15',
                notes: '0.1mg readability'
            },
            {
                id: 'EQP-007',
                name: 'Digital pH Meter',
                category: 'pH Meter',
                serialNumber: 'PH-007',
                status: 'Damaged',
                location: 'Lab Room A-102',
                condition: 'Poor',
                purchaseDate: '2023-07-22',
                lastMaintenance: '2024-03-01',
                notes: 'Electrode needs replacement'
            },
            {
                id: 'EQP-008',
                name: 'Laptop MacBook Pro 16',
                category: 'Computer',
                serialNumber: 'MBP16-008',
                status: 'Available',
                location: 'Lab Room B-202',
                condition: 'Excellent',
                purchaseDate: '2024-03-10',
                lastMaintenance: null,
                notes: 'M3 Max chip for ML workloads'
            }
        ];
    },

    saveEquipment() {
        Utils.setStorage('lab_equipment', this.items);
    },

    getAll() {
        return [...this.items];
    },

    getById(id) {
        return this.items.find(item => item.id === id);
    },

    getAvailable() {
        return this.items.filter(item => item.status === 'Available');
    },

    getByStatus(status) {
        return this.items.filter(item => item.status === status);
    },

    search(query) {
        if (!query) return this.getAll();
        const lowerQuery = query.toLowerCase();
        return this.items.filter(item =>
            item.name.toLowerCase().includes(lowerQuery) ||
            item.category.toLowerCase().includes(lowerQuery) ||
            item.serialNumber.toLowerCase().includes(lowerQuery) ||
            item.location.toLowerCase().includes(lowerQuery) ||
            item.id.toLowerCase().includes(lowerQuery)
        );
    },

    filter(status) {
        if (status === 'all') return this.getAll();
        return this.getByStatus(status);
    },

    create(data) {
        if (!Auth.hasPermission('equipment', 'create')) {
            throw new Error('Insufficient permissions to create equipment');
        }

        const newItem = {
            id: Utils.generateId('EQP-'),
            ...data,
            status: 'Available',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.items.push(newItem);
        this.saveEquipment();
        Audit.log('CREATE', 'Equipment', newItem.id, `Created equipment ${newItem.name}`, Auth.getCurrentUser().id);
        return newItem;
    },

    update(id, updates) {
        if (!Auth.hasPermission('equipment', 'update')) {
            throw new Error('Insufficient permissions to update equipment');
        }

        const index = this.items.findIndex(item => item.id === id);
        if (index === -1) throw new Error('Equipment not found');

        const oldItem = { ...this.items[index] };
        const allowedUpdates = ['name', 'category', 'serialNumber', 'location', 'condition', 'notes', 'status'];
        const filteredUpdates = {};
        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) filteredUpdates[key] = updates[key];
        });
        filteredUpdates.updatedAt = new Date().toISOString();

        this.items[index] = { ...this.items[index], ...filteredUpdates };
        this.saveEquipment();

        const changes = Object.keys(filteredUpdates).filter(k => k !== 'updatedAt').join(', ');
        Audit.log('UPDATE', 'Equipment', id, `Updated equipment ${oldItem.name}: ${changes}`, Auth.getCurrentUser().id);
        return this.items[index];
    },

    delete(id) {
        if (!Auth.hasPermission('equipment', 'delete')) {
            throw new Error('Insufficient permissions to delete equipment');
        }

        const item = this.items.find(item => item.id === id);
        if (!item) throw new Error('Equipment not found');

        if (item.status === 'Borrowed' || item.status === 'Released') {
            throw new Error('Cannot delete equipment that is currently borrowed');
        }

        this.items = this.items.filter(item => item.id !== id);
        this.saveEquipment();
        Audit.log('DELETE', 'Equipment', id, `Deleted equipment ${item.name}`, Auth.getCurrentUser().id);
        return true;
    },

    updateStatus(id, newStatus) {
        const validStatuses = ['Available', 'Borrowed', 'Maintenance', 'Damaged'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error('Invalid status');
        }

        const item = this.getById(id);
        if (!item) throw new Error('Equipment not found');

        const oldStatus = item.status;
        if (oldStatus === newStatus) return item;

        if (oldStatus === 'Maintenance' && newStatus === 'Borrowed') {
            throw new Error('Equipment under maintenance cannot be borrowed (BR-A4-09)');
        }

        return this.update(id, { status: newStatus });
    },

    validateCanBorrow(id) {
        const item = this.getById(id);
        if (!item) throw new Error('Equipment not found');
        if (item.status !== 'Available') throw new Error('Only available equipment may be requested (BR-A4-01)');
        return true;
    }
};

window.Equipment = Equipment;