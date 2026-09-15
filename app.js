/**
 * LABORATORY ASSET MANAGEMENT SYSTEM — LAB 4-A
 * Role-Based Governance, Approval Workflow, and Audit Trail
 * Platform: Vanilla JavaScript + Supabase JS SDK v2
 *
 * State Machine: Pending → Approved/Rejected → Released → Returned → Closed
 * Business Rules: BR-A4-01 through BR-A4-10
 */

// ============================================================
// VALIDATED USER CREDENTIALS (Lab 4-A Functional Testing)
// ============================================================
const VALID_CREDENTIALS = {
    'Rona':    { role: 'Administrator',         id: 'admin-999', name: 'Rona' },
    'Icy':     { role: 'Requester / Viewer',   id: 'user-101',  name: 'Icy' },
    'Bevelyn': { role: 'Laboratory Staff',     id: 'staff-555', name: 'Bevelyn' }
};
const TEST_PASSWORD = '12345';

// ============================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================
const SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
let supabaseClient = null;

// Only initialize Supabase client when real credentials are provided.
// Falls back to mock data for local testing when URL/key are placeholders.
const isPlaceholder = SUPABASE_URL.includes('YOUR_') || SUPABASE_ANON_KEY.includes('YOUR_');

if (typeof supabase !== 'undefined' && !isPlaceholder) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ============================================================
// APPLICATION STATE
// ============================================================

let currentUser = {
    id: "user-101",
    name: "Juan Dela Cruz",
    role: "Requester / Viewer"
};

// State machine for borrowing request statuses
const STATUS_MACHINE = {
    Pending:    ['Approved', 'Rejected'],
    Approved:   ['Released'],
    Rejected:   ['Closed'],
    Released:   ['Returned', 'Overdue'],
    Returned:   ['Closed'],
    Overdue:    ['Returned', 'Closed'],
    Closed:    []
};

// Valid transitions: key = current status, value = array of allowed next statuses
const VALID_TRANSITIONS = STATUS_MACHINE;

// Business rule constants
const BUSINESS_RULES = {
    BR_A4_01: "Only Available (not under maintenance) equipment can be requested",
    BR_A4_02: "Staff/Admin cannot approve their own borrowing request",
    BR_A4_03: "Only Administrator can approve or reject requests",
    BR_A4_04: "Only Approved requests can be released",
    BR_A4_05: "Only Released requests can be returned",
    BR_A4_06: "Returned equipment becomes Available (unless damaged)",
    BR_A4_07: "Rejected requests cannot be released",
    BR_A4_08: "Return transactions cannot be processed twice",
    BR_A4_09: "Equipment under maintenance cannot be borrowed",
    BR_A4_10: "Audit trail is immutable"
};

// ============================================================
// MOCK DATA (fallback for local testing without Supabase)
// ============================================================
let mockEquipment = [
    { id: "eq-1", asset_tag: "LAP-001", name: "Dell Latitude 5420 Laptop", category: "Electronics", status: "Available", location: "Lab Room 301" },
    { id: "eq-2", asset_tag: "MIC-002", name: "Digital Compound Microscope", category: "Scientific", status: "Available", location: "Lab Room 302" },
    { id: "eq-3", asset_tag: "OSC-003", name: "Tektronix Digital Oscilloscope", category: "Electronics", status: "Under Maintenance", location: "Lab Storage B" },
    { id: "eq-4", asset_tag: "PROJ-004", name: "Epson LCD Projector", category: "AV Equipment", status: "Borrowed", location: "Lab Room 301" },
    { id: "eq-5", asset_tag: "BAL-005", name: "Analytical Balance 0.001g", category: "Scientific", status: "Available", location: "Lab Room 201" },
    { id: "eq-6", asset_tag: "CEN-006", name: "Centrifuge 15000 RPM", category: "Scientific", status: "Available", location: "Lab Room 202" },
    { id: "eq-7", asset_tag: "PHM-007", name: "pH Meter Multi-Parameter", category: "Scientific", status: "Available", location: "Lab Room 203" },
    { id: "eq-8", asset_tag: "HOT-008", name: "Digital Hot Plate 500W", category: "Electronics", status: "Damaged", location: "Lab Storage A" },
    { id: "eq-9", asset_tag: "SPC-009", name: "UV-Vis Spectrophotometer", category: "Scientific", status: "Borrowed", location: "Lab Room 302" },
    { id: "eq-10", asset_tag: "INC-010", name: "CO2 Incubator 170L", category: "Scientific", status: "Available", location: "Lab Room 205" },
    { id: "eq-11", asset_tag: "VAC-011", name: "Vacuum Pump 5CFM", category: "Electronics", status: "Available", location: "Lab Room 301" },
    { id: "eq-12", asset_tag: "CHM-012", name: "Gas Chromatograph", category: "Scientific", status: "Under Maintenance", location: "Lab Storage C" },
    { id: "eq-13", asset_tag: "TAB-013", name: "Android Tablet 10-inch", category: "Electronics", status: "Available", location: "Lab Room 301" },
    { id: "eq-14", asset_tag: "CAM-014", name: "Lab Camera Microscope Adapter", category: "AV Equipment", status: "Borrowed", location: "Lab Room 302" },
    { id: "eq-15", asset_tag: "WAS-015", name: "Laboratory Washing Machine", category: "Equipment", status: "Available", location: "Lab Room 105" },
    { id: "eq-16", name: "Canon EOS R5 Mirrorless Camera", asset_tag: "CAM-016", category: "AV Equipment", status: "Available", location: "Lab Room 301" },
    { id: "eq-17", asset_tag: "TMP-017", name: "Digital Temperature Probe", category: "Electronics", status: "Available", location: "Lab Room 203" },
    { id: "eq-18", asset_tag: "FAN-018", name: "Laboratory Fume Hood", category: "Equipment", status: "Available", location: "Lab Room 204" },
    { id: "eq-19", asset_tag: "PC-019", name: "Desktop PC Intel i7 32GB", category: "Electronics", status: "Borrowed", location: "Lab Room 301" },
    { id: "eq-20", asset_tag: "WTH-020", name: "Laboratory Water Bath", category: "Electronics", status: "Available", location: "Lab Room 202" }
];

let mockRequests = [
    {
        id: "req-101", requester_id: "user-102", requester_name: "Maria Santos (Staff)",
        equipment_id: "eq-1", equipment_name: "Dell Latitude 5420 Laptop",
        purpose: "Class Presentation", status: "Pending", requested_date: "2026-09-14 10:00"
    }
];

let mockAuditLogs = [
    { id: "log-1", user_name: "System Admin", user_id: "admin-999", action: "SYSTEM_INIT", module: "Core", record_id: "000", description: "Audit trail system initialized", created_at: "2026-09-14 08:00:00" }
];

// ============================================================
// STATE MACHINE VALIDATION
// ============================================================

/**
 * Checks if a transition from currentStatus to nextStatus is valid.
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {boolean}
 */
function isValidTransition(currentStatus, nextStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
}

/**
 * Returns available next statuses from a given status.
 * @param {string} status
 * @returns {string[]}
 */
function getNextValidStatuses(status) {
    return VALID_TRANSITIONS[status] || [];
}

// ============================================================
// BUSINESS RULE VALIDATION (BR-A4-01 through BR-A4-10)
// ============================================================

/**
 * Validates all business rules before a status transition.
 * Returns { valid: boolean, violation: string|null, rule: string|null }
 */
function validateBusinessRules(action, requestId, equipmentId, context = {}) {
    const req = mockRequests.find(r => r.id === requestId);
    const eq = mockEquipment.find(e => e.id === equipmentId);

    switch (action) {

        // --- SUBMIT BORROW REQUEST ---
        case 'submit':
            if (!eq) {
                return { valid: false, violation: "Equipment not found.", rule: null };
            }
            // BR-A4-01: Only Available equipment can be requested
            if (eq.status !== 'Available') {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_01, rule: "BR-A4-01" };
            }
            // BR-A4-09: Equipment under maintenance cannot be borrowed
            if (eq.status === 'Under Maintenance') {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_09, rule: "BR-A4-09" };
            }
            break;

        // --- APPROVE REQUEST ---
        case 'approve':
            if (!isValidTransition(req.status, 'Approved')) {
                return { valid: false, violation: `Cannot transition from ${req.status} to Approved.`, rule: null };
            }
            // BR-A4-03: Only Administrator may approve
            if (currentUser.role !== 'Administrator') {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_03, rule: "BR-A4-03" };
            }
            // BR-A4-02: Cannot approve own request
            if (req.requester_id === currentUser.id) {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_02, rule: "BR-A4-02" };
            }
            break;

        // --- REJECT REQUEST ---
        case 'reject':
            if (!isValidTransition(req.status, 'Rejected')) {
                return { valid: false, violation: `Cannot transition from ${req.status} to Rejected.`, rule: null };
            }
            // BR-A4-03: Only Administrator may reject
            if (currentUser.role !== 'Administrator') {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_03, rule: "BR-A4-03" };
            }
            break;

        // --- RELEASE EQUIPMENT ---
        case 'release':
            // BR-A4-04: Only Approved requests can be released
            if (req.status !== 'Approved') {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_04, rule: "BR-A4-04" };
            }
            // BR-A4-07: Rejected requests cannot be released
            if (req.status === 'Rejected') {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_07, rule: "BR-A4-07" };
            }
            // Check state machine transition
            if (!isValidTransition(req.status, 'Released')) {
                return { valid: false, violation: `Cannot transition from ${req.status} to Released.`, rule: null };
            }
            break;

        // --- RETURN EQUIPMENT ---
        case 'return':
            // BR-A4-05: Only Released requests can be returned
            if (req.status !== 'Released') {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_05, rule: "BR-A4-05" };
            }
            // BR-A4-08: Cannot process return twice
            if (req.status === 'Returned' || req.status === 'Closed') {
                return { valid: false, violation: BUSINESS_RULES.BR_A4_08, rule: "BR-A4-08" };
            }
            // Check state machine transition
            if (!isValidTransition(req.status, 'Returned')) {
                return { valid: false, violation: `Cannot transition from ${req.status} to Returned.`, rule: null };
            }
            break;

        // --- CLOSE REQUEST ---
        case 'close':
            if (!isValidTransition(req.status, 'Closed')) {
                return { valid: false, violation: `Cannot transition from ${req.status} to Closed.`, rule: null };
            }
            break;

        // --- MARK OVERDUE ---
        case 'overdue':
            if (!isValidTransition(req.status, 'Overdue')) {
                return { valid: false, violation: `Cannot transition from ${req.status} to Overdue.`, rule: null };
            }
            break;
    }

    return { valid: true, violation: null, rule: null };
}

// ============================================================
// USER STATE MANAGEMENT
// ============================================================

/**
 * Updates the role badge in the navbar.
 */
function updateUserBadge() {
    const badge = document.getElementById('current-role-badge');
    if (badge) badge.innerText = `${currentUser.name} (${currentUser.role})`;
}

/**
 * Applies role-based visibility to navbar items and UI elements.
 * - admin-only elements: visible only to Administrator
 * - staff-only elements: visible to Administrator and Laboratory Staff
 */
function applyRoleGuard() {
    const adminElements = document.querySelectorAll('.admin-only');
    const staffElements = document.querySelectorAll('.staff-only');
    const requesterElements = document.querySelectorAll('.requester-only');

    adminElements.forEach(el => {
        el.style.display = (currentUser.role === 'Administrator') ? 'block' : 'none';
    });

    staffElements.forEach(el => {
        const isStaffOrAdmin = (currentUser.role === 'Administrator' || currentUser.role === 'Laboratory Staff');
        el.style.display = isStaffOrAdmin ? 'block' : 'none';
    });

    // Requester-only elements are always visible to all roles
    requesterElements.forEach(el => {
        el.style.display = 'block';
    });

    // Role-based tab access control
    const activeTab = document.querySelector('.nav-link.active');
    if (activeTab && activeTab.getAttribute('data-target') === 'admin-tab' && currentUser.role !== 'Administrator') {
        switchTab('equipment-tab');
        showToast("Access Denied: Administrator privileges required (TC-A4-01)", "danger");
    }

    // Re-render to reflect role-based action visibility
    renderBorrowRequests();
}

// ============================================================
// TAB NAVIGATION
// ============================================================

/**
 * Switches between tab content panes.
 * @param {string} tabId - The ID of the tab content to show
 */
function switchTab(tabId) {
    // Admin-only tab access check
    if (tabId === 'admin-tab' && currentUser.role !== 'Administrator') {
        showToast("Access Denied: Only Administrators can view Audit Logs (TC-A4-01)", "danger");
        return;
    }

    // Hide all tab-content elements
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('d-none');
    });

    // Deactivate all nav links
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show target tab and activate its nav link
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('d-none');

    const targetNav = document.querySelector(`[data-target="${tabId}"]`);
    if (targetNav) targetNav.classList.add('active');
}

// ============================================================
// INITIALIZATION
// ============================================================

// ============================================================
// LOGIN & INITIALIZATION
// ============================================================

/**
 * Shows the dashboard and hides the login screen.
 */
function showDashboard() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('dashboard').style.display = 'block';

    // Update badge with login info
    updateUserBadge();
    applyRoleGuard();
    renderEquipmentCatalog();
    renderBorrowRequests();
    renderAuditLogs();
}

/**
 * Handles login form submission.
 * Validates username/password against predefined test credentials.
 */
function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username) {
        showToast('Please enter a username.', 'danger');
        return;
    }

    if (!password || password.length < 4) {
        showToast('Password must be at least 4 characters.', 'danger');
        return;
    }

    // Validate against predefined credentials (Lab 4-A Functional Testing)
    const user = VALID_CREDENTIALS[username];
    if (!user) {
        showInlineError('loginUsername', 'loginUsernameError',
            'Access denied: username not recognized.');
        showToast('Access denied: username not recognized.', 'danger');
        return;
    }

    if (password !== TEST_PASSWORD) {
        showInlineError('loginPassword', 'loginPasswordError',
            'Access denied: incorrect password.');
        showToast('Access denied: incorrect password.', 'danger');
        return;
    }

    // Set current user based on validated credentials
    currentUser.id = user.id;
    currentUser.name = user.name;
    currentUser.role = user.role;

    logAuditEvent('LOGIN', 'Auth', currentUser.id,
        `User ${username} logged in with role: ${currentUser.role}`);

    showDashboard();
    showToast(`Welcome, ${username}! Role: ${user.role}`, 'success');
}

/**
 * Logs the user out and returns to the login screen.
 */
function handleLogout() {
    logAuditEvent('LOGOUT', 'Auth', currentUser.id,
        `User ${currentUser.name} logged out (role: ${currentUser.role})`);

    // Hide dashboard, show login screen
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('loginScreen').classList.remove('d-none');

    // Reset the login form
    document.getElementById('loginForm').reset();
    document.getElementById('loginUsername').focus();

    showToast('Logged out successfully. Please log in again.', 'info');
}

/**
 * Clears an inline login error message.
 * @param {string} errorElementId - The ID of the error element to clear
 */
function clearLoginError(errorElementId) {
    const errorEl = document.getElementById(errorElementId);
    if (errorEl) errorEl.classList.add('d-none');

    const inputId = errorElementId.replace('Error', '');
    const input = document.getElementById(inputId);
    if (input) input.classList.remove('is-invalid');
}

/**
 * Shows an inline error message for a login form field.
 * @param {string} inputId - The ID of the input element
 * @param {string} errorElementId - The ID of the error message element
 * @param {string} message - The error message to display
 */
function showInlineError(inputId, errorElementId, message) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorElementId);

    if (input) {
        input.classList.add('is-invalid');
    }
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('d-none');
    }
}

/**
 * Auto-selects the role dropdown based on the username entered.
 * Uses VALID_CREDENTIALS map to determine the correct role.
 */
function autoSelectRole(username) {
    const roleSelect = document.getElementById('loginRole');
    if (!roleSelect) return;

    const user = VALID_CREDENTIALS[username];
    if (user) {
        roleSelect.value = user.role;
    } else {
        roleSelect.value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Set up login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Set up borrow form handler
    setupBorrowForm();

    // Set up add equipment form handler
    const addEqForm = document.getElementById('addEquipmentForm');
    if (addEqForm) {
        addEqForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addEquipment();
            const modal = bootstrap.Modal.getInstance(document.getElementById('addEquipmentModal'));
            if (modal) modal.hide();
        });
    }
});

function initApp() {
    updateUserBadge();
    applyRoleGuard();
    renderEquipmentCatalog();
    renderBorrowRequests();
    renderAuditLogs();
}

// ============================================================
// EQUIPMENT CATALOG
// ============================================================

/**
 * Renders equipment cards from mock data.
 */
function renderEquipmentCatalog() {
    const container = document.getElementById('equipment-list');
    if (!container) return;

    container.innerHTML = mockEquipment.map(eq => {
        const badgeClass = getStatusBadgeClass(eq.status);
        const canBorrow = eq.status === 'Available';

        return `
            <div class="col-md-6 col-lg-3 mb-3">
                <div class="card h-100 shadow-sm equipment-card">
                    <div class="card-body d-flex flex-column">
                        <span class="badge ${badgeClass} float-end">${eq.status}</span>
                        <h6 class="card-subtitle text-muted mb-1">${eq.asset_tag}</h6>
                        <h5 class="card-title">${eq.name}</h5>
                        <p class="card-text text-secondary mb-2">
                            <small>Category: ${eq.category} | Location: ${eq.location || 'N/A'}</small>
                        </p>
                        ${canBorrow
                            ? `<button class="btn btn-sm btn-outline-primary w-100 mt-auto"
                                    onclick="openBorrowModal('${eq.id}', '${eq.name}')">Request Borrow</button>`
                            : `<button class="btn btn-sm btn-secondary w-100 mt-auto" disabled>Not Borrowable</button>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// BORROWING REQUEST WORKFLOW
// ============================================================

/**
 * Opens the borrow request modal.
 */
function openBorrowModal(eqId, eqName) {
    document.getElementById('borrowEquipmentId').value = eqId;
    document.getElementById('borrowEquipmentName').value = eqName;
    document.getElementById('borrowPurpose').value = '';
    document.getElementById('borrowDuration').value = 1;

    const borrowModal = new bootstrap.Modal(document.getElementById('borrowModal'));
    borrowModal.show();
}

/**
 * Sets up the borrow form submit handler.
 */
function setupBorrowForm() {
    const borrowForm = document.getElementById('borrowForm');
    if (borrowForm) {
        borrowForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const eqId = document.getElementById('borrowEquipmentId').value;
            const purpose = document.getElementById('borrowPurpose').value.trim();

            // Validate purpose length
            if (purpose.length < 10) {
                showToast("Purpose must be at least 10 characters.", "danger");
                return;
            }

            submitBorrowRequest(eqId, purpose);

            // Close the modal
            const borrowModalEl = document.getElementById('borrowModal');
            const borrowModal = bootstrap.Modal.getInstance(borrowModalEl);
            if (borrowModal) borrowModal.hide();
        });
    }
}

// ============================================================
// EQUIPMENT MANAGEMENT (Admin/Staff)
// ============================================================

/**
 * Opens the add equipment modal.
 */
function openAddEquipmentModal() {
    document.getElementById('eqAssetTag').value = '';
    document.getElementById('eqName').value = '';
    document.getElementById('eqCategory').value = '';
    document.getElementById('eqLocation').value = '';
    document.getElementById('equipmentStatus').value = 'Available';

    const modal = new bootstrap.Modal(document.getElementById('addEquipmentModal'));
    modal.show();
}

/**
 * Creates a new equipment entry.
 * Validates: Asset tag uniqueness, required fields.
 */
async function addEquipment() {
    const assetTag = document.getElementById('eqAssetTag').value.trim();
    const name = document.getElementById('eqName').value.trim();
    const category = document.getElementById('eqCategory').value.trim();
    const location = document.getElementById('eqLocation').value.trim();
    const status = document.getElementById('equipmentStatus').value;

    if (!assetTag || !name || !category) {
        showToast('Please fill in all required fields.', 'danger');
        return;
    }

    // Check for duplicate asset tag (case-insensitive)
    const existing = mockEquipment.find(e => e.asset_tag.toLowerCase() === assetTag.toLowerCase());
    if (existing) {
        showToast('BR-A4-01 Violation: Asset tag must be unique.', 'danger');
        return;
    }

    const newEquipment = {
        id: `eq-${Date.now().toString().slice(-6)}`,
        asset_tag: assetTag,
        name: name,
        category: category,
        status: status,
        location: location || 'N/A'
    };

    // Persist to Supabase
    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('equipment')
            .insert([newEquipment]);
        if (error) {
            console.error('Supabase insert error:', error);
            showToast(`Failed to add equipment: ${error.message}`, 'danger');
            return;
        }
    }

    mockEquipment.push(newEquipment);
    logAuditEvent('EQUIPMENT_ADDED', 'Equipment', newEquipment.id,
        `Added new equipment: ${assetTag} - ${name} (Category: ${category}, Status: ${status})`);

    showToast(`Equipment ${assetTag} added successfully!`, 'success');
    renderEquipmentCatalog();
}

/**
 * SUBMIT: Creates a new borrowing request.
 * Validates: BR-A4-01, BR-A4-09
 */
async function submitBorrowRequest(equipmentId, purpose) {
    const eq = mockEquipment.find(e => e.id === equipmentId);

    // BR-A4-01: Only Available equipment can be requested
    if (!eq || eq.status !== 'Available') {
        showToast("BR-A4-01 Violation: Only available equipment can be requested!", "danger");
        return;
    }

    // BR-A4-09: Equipment under maintenance cannot be borrowed
    if (eq.status === 'Under Maintenance') {
        showToast("BR-A4-09 Violation: Equipment under maintenance cannot be borrowed!", "danger");
        return;
    }

    const newRequest = {
        id: `req-${Date.now().toString().slice(-6)}`,
        requester_id: currentUser.id,
        requester_name: currentUser.name,
        equipment_id: eq.id,
        equipment_name: eq.name,
        purpose: purpose,
        status: 'Pending',
        requested_date: new Date().toLocaleString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        }),
        approved_by: null,
        approved_at: null,
        released_by: null,
        released_at: null,
        returned_at: null,
        remarks: null
    };

    // Persist to Supabase (if available)
    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('borrowing_requests')
            .insert([{
                requester_id: newRequest.requester_id,
                equipment_id: newRequest.equipment_id,
                purpose: newRequest.purpose,
                status: newRequest.status
            }]);
        if (error) {
            console.error('Supabase insert error:', error);
            showToast(`Failed to submit request: ${error.message}`, "danger");
            return;
        }
    }

    // Update local state
    mockRequests.push(newRequest);

    // Log audit event
    logAuditEvent("SUBMITTED", "Borrowing", newRequest.id,
        `Submitted borrowing request for ${eq.name}`);

    showToast("Borrowing request submitted successfully! Status: Pending (TC-A4-02)", "success");
    renderBorrowRequests();
}

/**
 * APPROVE: Administrator approves a borrowing request.
 * Validates: BR-A4-02 (not own request), BR-A4-03 (admin only)
 */
async function approveRequest(requestId) {
    const req = mockRequests.find(r => r.id === requestId);
    if (!req) return;

    // BR-A4-03: Only Administrator may approve
    if (currentUser.role !== 'Administrator') {
        showToast("BR-A4-03 Violation: Only Administrators can approve requests!", "danger");
        return;
    }

    // BR-A4-02: Cannot approve own request
    if (req.requester_id === currentUser.id) {
        showToast("BR-A4-02 Violation: Staff/Admin cannot approve their own borrowing request!", "danger");
        return;
    }

    // Validate state machine transition
    const result = validateBusinessRules('approve', requestId, req.equipment_id);
    if (!result.valid) {
        showToast(`${result.rule} Violation: ${result.violation}`, "danger");
        return;
    }

    // Update request
    req.status = 'Approved';
    req.approved_by = currentUser.id;
    req.approved_at = new Date().toLocaleString();

    // Persist to Supabase
    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('borrowing_requests')
            .update({
                status: 'Approved',
                approved_by: currentUser.id,
                approved_at: new Date().toISOString()
            })
            .eq('id', requestId);
        if (error) {
            console.error('Supabase update error:', error);
            showToast(`Failed to approve request: ${error.message}`, "danger");
            return;
        }
    }

    logAuditEvent("APPROVED", "Borrowing", req.id, `Approved borrowing request for ${req.equipment_name}`);
    showToast("Request Approved! Status updated and logged in Audit Trail (TC-A4-03)", "success");
    renderBorrowRequests();
}

/**
 * REJECT: Administrator rejects a borrowing request.
 * Validates: BR-A4-03 (admin only), state machine
 */
async function rejectRequest(requestId) {
    const req = mockRequests.find(r => r.id === requestId);
    if (!req) return;

    // BR-A4-03: Only Administrator may reject
    if (currentUser.role !== 'Administrator') {
        showToast("BR-A4-03 Violation: Only Administrators can reject requests!", "danger");
        return;
    }

    // Validate state machine transition
    const result = validateBusinessRules('reject', requestId, req.equipment_id);
    if (!result.valid) {
        showToast(`${result.rule ? result.rule : 'STATE'} Violation: ${result.violation}`, "danger");
        return;
    }

    req.status = 'Rejected';

    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('borrowing_requests')
            .update({ status: 'Rejected' })
            .eq('id', requestId);
        if (error) {
            console.error('Supabase update error:', error);
            showToast(`Failed to reject request: ${error.message}`, "danger");
            return;
        }
    }

    logAuditEvent("REJECTED", "Borrowing", req.id, `Rejected borrowing request for ${req.equipment_name}`);
    showToast("Request Rejected! Status updated to Rejected (TC-A4-04)", "warning");
    renderBorrowRequests();
}

/**
 * RELEASE: Staff releases equipment for a borrowing request.
 * Validates: BR-A4-04 (must be Approved), BR-A4-07 (not Rejected)
 */
async function releaseEquipment(requestId) {
    const req = mockRequests.find(r => r.id === requestId);
    if (!req) return;

    // BR-A4-04: Only Approved requests may be released
    if (req.status !== 'Approved') {
        showToast("BR-A4-04 Violation: Only Approved requests can be released!", "danger");
        return;
    }

    // BR-A4-07: Rejected requests cannot be released
    if (req.status === 'Rejected') {
        showToast("BR-A4-07 Violation: Rejected requests cannot be released.", "danger");
        logAuditEvent("RELEASE_BLOCKED", "Borrowing", req.id, "Attempted release on rejected request was blocked");
        return;
    }

    // Validate state machine transition
    const result = validateBusinessRules('release', requestId, req.equipment_id);
    if (!result.valid) {
        showToast(`${result.rule} Violation: ${result.violation}`, "danger");
        return;
    }

    req.status = 'Released';
    req.released_by = currentUser.id;
    req.released_at = new Date().toLocaleString();

    // BR-A4-06: Released equipment becomes Borrowed
    const eq = mockEquipment.find(e => e.id === req.equipment_id);
    if (eq) eq.status = 'Borrowed';

    if (supabaseClient) {
        const { error: reqError } = await supabaseClient
            .from('borrowing_requests')
            .update({
                status: 'Released',
                released_by: currentUser.id,
                released_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (eq) {
            const { error: eqError } = await supabaseClient
                .from('equipment')
                .update({ status: 'Borrowed' })
                .eq('id', req.equipment_id);
            if (eqError) console.error('Equipment update error:', eqError);
        }
        if (reqError) {
            console.error('Supabase update error:', reqError);
            showToast(`Failed to release: ${reqError.message}`, "danger");
            return;
        }
    }

    logAuditEvent("RELEASED", "Borrowing", req.id,
        `Released equipment ${req.equipment_name} to ${req.requester_name}`);
    showToast("Equipment Released! Asset status updated to 'Borrowed' (TC-A4-06)", "success");
    renderBorrowRequests();
    renderEquipmentCatalog();
}

/**
 * RETURN: Staff processes the return of borrowed equipment.
 * Validates: BR-A4-05 (must be Released), BR-A4-08 (not already returned),
 *            BR-A4-06 (equipment status on return)
 */
async function processReturn(requestId, condition = 'Good') {
    const req = mockRequests.find(r => r.id === requestId);
    if (!req) return;

    // BR-A4-08: Cannot process return twice
    if (req.status === 'Returned' || req.status === 'Closed') {
        showToast("BR-A4-08 Violation: Transaction already processed! Cannot return twice.", "danger");
        return;
    }

    // BR-A4-05: Only Released requests can be returned
    if (req.status !== 'Released') {
        showToast("BR-A4-05 Violation: Only Released items can be returned!", "danger");
        return;
    }

    // Validate state machine transition
    const result = validateBusinessRules('return', requestId, req.equipment_id);
    if (!result.valid) {
        showToast(`${result.rule} Violation: ${result.violation}`, "danger");
        return;
    }

    // BR-A4-06: Returned equipment becomes Available (unless damaged)
    req.status = 'Returned';
    req.returned_at = new Date().toLocaleString();

    const eq = mockEquipment.find(e => e.id === req.equipment_id);
    if (eq) {
        eq.status = (condition === 'Damaged') ? 'Damaged' : 'Available';
    }

    // Close the request (final state)
    req.status = 'Closed';

    if (supabaseClient) {
        // Update request
        const { error: reqError } = await supabaseClient
            .from('borrowing_requests')
            .update({
                status: 'Closed',
                returned_at: new Date().toISOString()
            })
            .eq('id', requestId);

        // Update equipment
        if (eq) {
            const { error: eqError } = await supabaseClient
                .from('equipment')
                .update({ status: eq.status })
                .eq('id', req.equipment_id);
            if (eqError) console.error('Equipment update error:', eqError);
        }
        if (reqError) {
            console.error('Supabase update error:', reqError);
            showToast(`Failed to process return: ${reqError.message}`, "danger");
            return;
        }
    }

    logAuditEvent("RETURNED", "Borrowing", req.id,
        `Processed return for ${req.equipment_name}. Condition: ${condition}. Equipment reset to ${eq ? eq.status : 'Available'}`);
    showToast(`Return processed! Equipment reset to ${eq ? eq.status : 'Available'} (TC-A4-07)`, "success");
    renderBorrowRequests();
    renderEquipmentCatalog();
}

// ============================================================
// AUDIT TRAIL LOGGING (BR-A4-10: Immutable)
// ============================================================

/**
 * Logs an audit event to both local state and Supabase.
 * @param {string} action - The action being logged (e.g., APPROVED, REJECTED)
 * @param {string} module - The module (e.g., "Borrowing", "Auth")
 * @param {string} recordId - The record ID being acted upon
 * @param {string} description - Human-readable description
 */
async function logAuditEvent(action, module, recordId, description) {
    const entry = {
        id: `log-${Date.now().toString().slice(-6)}`,
        user_id: currentUser.id,
        user_name: currentUser.name,
        action: action,
        module: module,
        record_id: recordId,
        description: description,
        created_at: new Date().toLocaleString()
    };

    // Prepend to local array (most recent first)
    mockAuditLogs.unshift(entry);

    // Persist to Supabase
    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('audit_logs')
            .insert([{
                user_id: currentUser.id,
                user_name: currentUser.name,
                action: action,
                module: module,
                record_id: String(recordId),
                description: description
            }]);
        if (error) {
            console.error('Supabase audit log error:', error);
        }
    }

    renderAuditLogs();
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================

/**
 * Renders the audit log table (admin only).
 */
function renderAuditLogs() {
    const tbody = document.getElementById('audit-log-body');
    if (!tbody) return;

    tbody.innerHTML = mockAuditLogs.map(log => `
        <tr>
            <td><code>${log.id}</code></td>
            <td><strong>${log.user_name || 'System'}</strong></td>
            <td><span class="badge bg-dark">${log.action || 'N/A'}</span></td>
            <td>${log.module}</td>
            <td><code>${log.record_id}</code></td>
            <td>${log.description}</td>
            <td><small class="text-muted">${log.created_at}</small></td>
        </tr>
    `).join('');
}

/**
 * Renders the borrowing requests table with role-aware action buttons.
 */
function renderBorrowRequests() {
    const tbody = document.getElementById('requests-table-body');
    if (!tbody) return;

    const isAdmin = currentUser.role === 'Administrator';
    const isStaff = isAdmin || currentUser.role === 'Laboratory Staff';

    // Update tab title based on role
    const titleEl = document.getElementById('requestsTabTitle');
    if (titleEl) {
        titleEl.textContent = isStaff
            ? 'Borrowing Approval Workflow Pipeline'
            : 'My Borrowing Requests';
    }

    // Requesters / Viewers can only see their own requests (BR-A4 per Section III)
    let visibleRequests = mockRequests;
    if (!isStaff) {
        visibleRequests = mockRequests.filter(r => r.requester_id === currentUser.id);
    }

    tbody.innerHTML = visibleRequests.length > 0
        ? visibleRequests.map(r => {
            const badgeClass = getStatusBadgeClass(r.status);

            // Determine available actions based on role and status
            const canApprove = isAdmin && r.status === 'Pending';
            const canReject = isAdmin && r.status === 'Pending';
            const canRelease = isStaff && r.status === 'Approved';
            const canReturn = isStaff && r.status === 'Released';

            return `
            <tr>
                <td><code>${r.id}</code></td>
                <td>${r.requester_name || r.requester_id}</td>
                <td>${r.equipment_name || r.equipment_id}</td>
                <td><small>${r.purpose || 'N/A'}</small></td>
                <td><span class="badge ${badgeClass}">${r.status}</span></td>
                <td class="workflow-actions">
                    ${canApprove
                        ? `<button class="btn btn-xs btn-success me-1" onclick="approveRequest('${r.id}')">Approve</button>`
                        : ''
                    }
                    ${canReject
                        ? `<button class="btn btn-xs btn-danger me-1" onclick="rejectRequest('${r.id}')">Reject</button>`
                        : ''
                    }
                    ${canRelease
                        ? `<button class="btn btn-xs btn-primary me-1" onclick="releaseEquipment('${r.id}')">Release</button>`
                        : ''
                    }
                    ${canReturn
                        ? `<button class="btn btn-xs btn-outline-dark me-1" onclick="processReturn('${r.id}', 'Good')">Return (Good)</button>
                          <button class="btn btn-xs btn-outline-danger me-1" onclick="processReturn('${r.id}', 'Damaged')">Return (Damaged)</button>`
                        : ''
                    }
                </td>
            </tr>
        `;
        }).join('')
        : `<tr><td colspan="6" class="text-center text-muted py-4">No borrowing requests found.</td></tr>`;
}

// ============================================================
// HELPER: Status Badge Class
// ============================================================

/**
 * Returns the CSS badge class for a given status.
 */
function getStatusBadgeClass(status) {
    const badgeClasses = {
        'Available': 'badge-available',
        'Approved': 'badge-approved',
        'Pending': 'badge-pending',
        'Rejected': 'badge-rejected',
        'Released': 'badge-released',
        'Returned': 'badge-returned',
        'Overdue': 'badge-overdue',
        'Closed': 'badge-closed',
        'Borrowed': 'badge-borrowed',
        'Under Maintenance': 'badge-under-maintenance',
        'Damaged': 'badge-damaged'
    };
    return badgeClasses[status] || 'badge bg-secondary';
}

// ============================================================
// NOTIFICATION HELPER
// ============================================================

/**
 * Displays a toast notification.
 * @param {string} message - The message to display
 * @param {string} type - "info", "success", "warning", "danger"
 */
function showToast(message, type = "info") {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `alert alert-${type} alert-dismissible fade show shadow-sm mb-2`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <span>${message}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => toast.remove(), 5000);
}
