const Utils = {
    generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}${timestamp}${random}`.toUpperCase();
    },

    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...options
        };
        return new Date(date).toLocaleDateString('en-US', defaultOptions);
    },

    formatDateTime(date) {
        return this.formatDate(date, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    formatRelativeTime(date) {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return this.formatDate(then);
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    sanitizeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validateRequired(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    },

    showToast(type, title, message, duration = 5000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${this.getToastIcon(type)}
            </svg>
            <div class="toast-content">
                <div class="toast-title">${this.escapeHtml(title)}</div>
                <div class="toast-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="Dismiss">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toast));

        container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => this.removeToast(toast), duration);
        }

        return toast;
    },

    getToastIcon(type) {
        switch (type) {
            case 'success':
                return '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
            case 'error':
                return '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
            case 'warning':
                return '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
            default:
                return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
        }
    },

    removeToast(toast) {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    },

    openModal(title, bodyHtml, footerHtml = '') {
        const overlay = document.getElementById('modalOverlay');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalFooter = document.getElementById('modalFooter');

        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHtml;
        modalFooter.innerHTML = footerHtml;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        const closeBtn = document.getElementById('modalClose');
        const closeHandler = () => this.closeModal();
        closeBtn.addEventListener('click', closeHandler);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeHandler();
        });

        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeHandler();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);

        overlay._closeHandler = closeHandler;
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        if (overlay._closeHandler) {
            document.removeEventListener('keydown', overlay._closeHandler);
        }
    },

    confirmAction(message, onConfirm, onCancel = null) {
        const bodyHtml = `<p>${this.escapeHtml(message)}</p>`;
        const footerHtml = `
            <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
            <button class="btn btn-danger" id="confirmOk">Confirm</button>
        `;
        this.openModal('Confirm Action', bodyHtml, footerHtml);

        document.getElementById('confirmOk').addEventListener('click', () => {
            this.closeModal();
            if (onConfirm) onConfirm();
        });

        document.getElementById('confirmCancel').addEventListener('click', () => {
            this.closeModal();
            if (onCancel) onCancel();
        });
    },

    showFormErrors(form, errors) {
        this.clearFormErrors(form);
        Object.entries(errors).forEach(([field, message]) => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('error');
                const errorEl = input.parentElement.querySelector('.form-error');
                if (errorEl) {
                    errorEl.textContent = message;
                    errorEl.classList.add('visible');
                }
            }
        });
    },

    clearFormErrors(form) {
        form.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
            el.classList.remove('error');
        });
        form.querySelectorAll('.form-error').forEach(el => {
            el.classList.remove('visible');
            el.textContent = '';
        });
    },

    getFormData(form) {
        const formData = new FormData(form);
        const data = {};
        for (const [key, value] of formData.entries()) {
            if (data[key]) {
                if (!Array.isArray(data[key])) data[key] = [data[key]];
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }
        return data;
    },

    setFormData(form, data) {
        Object.entries(data).forEach(([key, value]) => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else if (input.type === 'radio') {
                    const radio = form.querySelector(`[name="${key}"][value="${value}"]`);
                    if (radio) radio.checked = true;
                } else {
                    input.value = value;
                }
            }
        });
    },

    createElement(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
    },

    renderTemplate(templateId, data) {
        const template = document.getElementById(templateId);
        if (!template) return '';
        let html = template.innerHTML;
        Object.entries(data).forEach(([key, value]) => {
            html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), this.escapeHtml(String(value)));
        });
        return html;
    },

    sortArray(array, key, direction = 'asc') {
        return [...array].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    },

    filterArray(array, filters) {
        return array.filter(item => {
            return Object.entries(filters).every(([key, value]) => {
                if (value === 'all' || value === '') return true;
                const itemValue = item[key];
                if (Array.isArray(itemValue)) {
                    return itemValue.includes(value);
                }
                return itemValue === value;
            });
        });
    },

    searchArray(array, query, searchKeys) {
        if (!query) return array;
        const lowerQuery = query.toLowerCase();
        return array.filter(item => {
            return searchKeys.some(key => {
                const value = item[key];
                return value && String(value).toLowerCase().includes(lowerQuery);
            });
        });
    },

    paginateArray(array, page, pageSize) {
        const start = (page - 1) * pageSize;
        return array.slice(start, start + pageSize);
    },

    getStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },

    setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },

    removeStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch {
            return false;
        }
    }
};

window.Utils = Utils;