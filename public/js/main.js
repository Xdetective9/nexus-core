// NEXUSCORE v3.0 - MAIN JAVASCRIPT

// Configuration
const CONFIG = window.APP_CONFIG || {};
const IS_PRODUCTION = CONFIG.env === 'production';

// Utility Functions
const Utils = {
    // Debounce function
    debounce: (func, wait) => {
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

    // Throttle function
    throttle: (func, limit) => {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },

    // Format bytes
    formatBytes: (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    // Format date
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Copy to clipboard
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    },

    // Generate random ID
    generateId: (length = 8) => {
        return Math.random().toString(36).substr(2, length);
    },

    // Validate email
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Sanitize HTML
    sanitizeHTML: (str) => {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    // Get query parameter
    getQueryParam: (name) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },

    // Set query parameter
    setQueryParam: (name, value) => {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.pushState({}, '', url);
    },

    // Remove query parameter
    removeQueryParam: (name) => {
        const url = new URL(window.location);
        url.searchParams.delete(name);
        window.history.pushState({}, '', url);
    },

    // Scroll to element
    scrollToElement: (selector, offset = 80) => {
        const element = document.querySelector(selector);
        if (element) {
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    },

    // Toggle class
    toggleClass: (element, className) => {
        element.classList.toggle(className);
    },

    // Add class
    addClass: (element, className) => {
        element.classList.add(className);
    },

    // Remove class
    removeClass: (element, className) => {
        element.classList.remove(className);
    },

    // Check if element is in viewport
    isInViewport: (element) => {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },

    // Get current theme
    getTheme: () => {
        return localStorage.getItem('theme') || 'dark';
    },

    // Set theme
    setTheme: (theme) => {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    },

    // Toggle theme
    toggleTheme: () => {
        const currentTheme = Utils.getTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        Utils.setTheme(newTheme);
        return newTheme;
    }
};

// Notification System
class NotificationSystem {
    constructor() {
        this.container = this.createContainer();
        this.notifications = new Map();
        this.position = 'top-right';
    }

    createContainer() {
        const container = document.createElement('div');
        container.className = 'notifications-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    }

    show(options) {
        const id = Utils.generateId();
        const notification = this.createNotification(id, options);
        
        this.notifications.set(id, notification);
        this.container.appendChild(notification.element);

        // Auto remove after delay
        if (options.duration !== 0) {
            setTimeout(() => this.remove(id), options.duration || 5000);
        }

        return id;
    }

    createNotification(id, options) {
        const element = document.createElement('div');
        element.className = `notification notification-${options.type || 'info'}`;
        element.setAttribute('role', 'alert');
        
        const icon = this.getIcon(options.type);
        const progress = options.duration !== 0 ? '<div class="notification-progress"></div>' : '';
        
        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-body">
                    <div class="notification-title">${options.title || ''}</div>
                    <div class="notification-message">${options.message}</div>
                </div>
                <button class="notification-close" aria-label="Close notification">
                    <i class="ti ti-x"></i>
                </button>
            </div>
            ${progress}
        `;

        const closeBtn = element.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.remove(id));

        if (options.onClick) {
            element.addEventListener('click', options.onClick);
        }

        // Animate in
        setTimeout(() => element.classList.add('show'), 10);

        return { id, element, options };
    }

    getIcon(type) {
        const icons = {
            success: '<i class="ti ti-check"></i>',
            error: '<i class="ti ti-x"></i>',
            warning: '<i class="ti ti-alert-triangle"></i>',
            info: '<i class="ti ti-info-circle"></i>',
            loading: '<i class="ti ti-loader animate-spin"></i>'
        };
        return icons[type] || icons.info;
    }

    remove(id) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.element.classList.remove('show');
            setTimeout(() => {
                if (notification.element.parentNode) {
                    notification.element.parentNode.removeChild(notification.element);
                }
                this.notifications.delete(id);
            }, 300);
        }
    }

    success(message, title = 'Success', duration = 5000) {
        return this.show({ type: 'success', title, message, duration });
    }

    error(message, title = 'Error', duration = 5000) {
        return this.show({ type: 'error', title, message, duration });
    }

    warning(message, title = 'Warning', duration = 5000) {
        return this.show({ type: 'warning', title, message, duration });
    }

    info(message, title = 'Info', duration = 5000) {
        return this.show({ type: 'info', title, message, duration });
    }

    loading(message, title = 'Loading') {
        return this.show({ type: 'loading', title, message, duration: 0 });
    }

    clearAll() {
        this.notifications.forEach((notification, id) => this.remove(id));
    }
}

// Plugin Manager
class PluginManager {
    constructor() {
        this.plugins = CONFIG.plugins || [];
        this.features = CONFIG.features || [];
        this.categories = this.getCategories();
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.searchQuery = '';
        this.selectedCategory = 'all';
    }

    getCategories() {
        const categories = new Set(['all']);
        this.plugins.forEach(plugin => {
            if (plugin.category) categories.add(plugin.category);
        });
        return Array.from(categories);
    }

    filterPlugins() {
        let filtered = [...this.plugins];

        // Apply search
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(plugin =>
                plugin.name.toLowerCase().includes(query) ||
                plugin.description.toLowerCase().includes(query) ||
                (plugin.tags && plugin.tags.some(tag => tag.toLowerCase().includes(query)))
            );
        }

        // Apply category filter
        if (this.selectedCategory !== 'all') {
            filtered = filtered.filter(plugin => plugin.category === this.selectedCategory);
        }

        return filtered;
    }

    getPaginatedPlugins() {
        const filtered = this.filterPlugins();
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    }

    renderPluginsGrid(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const plugins = this.getPaginatedPlugins();
        const totalPages = Math.ceil(this.filterPlugins().length / this.itemsPerPage);

        if (plugins.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ti ti-puzzle-off text-5xl text-gray-500 mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">No plugins found</h3>
                    <p class="text-gray-400">Try adjusting your search or filter criteria</p>
                </div>
            `;
            return;
        }

        let html = '<div class="plugins-grid">';
        plugins.forEach(plugin => {
            html += this.createPluginCard(plugin);
        });
        html += '</div>';

        // Add pagination
        if (totalPages > 1) {
            html += this.createPagination(totalPages);
        }

        container.innerHTML = html;

        // Add event listeners
        this.addPluginCardListeners();
    }

    createPluginCard(plugin) {
        return `
            <div class="plugin-card" data-plugin="${plugin.name}" data-route="${plugin.route}">
                <div class="plugin-card-header">
                    <div class="plugin-icon" style="background: var(--${plugin.iconColor || 'primary'}-bg)">
                        <i class="ti ti-${plugin.icon || 'box'}"></i>
                    </div>
                    <div class="plugin-badges">
                        ${plugin.featured ? '<span class="badge badge-primary">Featured</span>' : ''}
                        ${plugin.isPremium ? '<span class="badge badge-warning">Premium</span>' : ''}
                    </div>
                </div>
                <div class="plugin-card-body">
                    <h3 class="plugin-title">${plugin.name}</h3>
                    <p class="plugin-description">${plugin.description}</p>
                    <div class="plugin-meta">
                        <span class="plugin-version">v${plugin.version}</span>
                        <span class="plugin-category">${plugin.category}</span>
                        <div class="plugin-rating">
                            <i class="ti ti-star-filled text-yellow-400"></i>
                            <span>${plugin.rating?.toFixed(1) || '0.0'}</span>
                        </div>
                    </div>
                </div>
                <div class="plugin-card-footer">
                    <a href="${plugin.route}" class="btn btn-sm btn-primary w-full">
                        <i class="ti ti-external-link"></i>
                        Open Plugin
                    </a>
                </div>
            </div>
        `;
    }

    createPagination(totalPages) {
        let html = '<div class="pagination">';
        
        // Previous button
        html += `
            <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                    data-page="${this.currentPage - 1}">
                <i class="ti ti-chevron-left"></i>
            </button>
        `;

        // Page numbers
        const maxVisible = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                        data-page="${i}">
                    ${i}
                </button>
            `;
        }

        // Next button
        html += `
            <button class="pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}" 
                    data-page="${this.currentPage + 1}">
                <i class="ti ti-chevron-right"></i>
            </button>
        `;

        html += '</div>';
        return html;
    }

    addPluginCardListeners() {
        document.querySelectorAll('.plugin-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.pagination-btn') && !e.target.closest('.plugin-card-footer a')) {
                    const pluginName = card.dataset.plugin;
                    const pluginRoute = card.dataset.route;
                    this.showPluginDetails(pluginName, pluginRoute);
                }
            });
        });

        document.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!btn.classList.contains('disabled') && !btn.classList.contains('active')) {
                    const page = parseInt(btn.dataset.page);
                    this.currentPage = page;
                    this.renderPluginsGrid('plugins-grid-container');
                }
            });
        });
    }

    showPluginDetails(pluginName, pluginRoute) {
        // This would show a modal with plugin details
        console.log('Show details for:', pluginName);
        // In a real implementation, you'd fetch plugin details and show a modal
    }

    searchPlugins(query) {
        this.searchQuery = query;
        this.currentPage = 1;
        this.renderPluginsGrid('plugins-grid-container');
    }

    filterByCategory(category) {
        this.selectedCategory = category;
        this.currentPage = 1;
        this.renderPluginsGrid('plugins-grid-container');
    }
}

// API Client
class ApiClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-Token': CONFIG.csrfToken || ''
        };
    }

    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
        
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            },
            credentials: 'include'
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    get(endpoint, params = {}) {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        return this.request(url.toString(), { method: 'GET' });
    }

    post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    upload(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            headers: {},
            body: formData
        });
    }
}

// Theme Manager
class ThemeManager {
    constructor() {
        this.theme = Utils.getTheme();
        this.init();
    }

    init() {
        this.applyTheme();
        this.addThemeToggleListener();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Update theme color meta tag
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = this.theme === 'dark' ? '#0f172a' : '#f8fafc';
    }

    addThemeToggleListener() {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }
    }

    toggle() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        Utils.setTheme(this.theme);
        this.applyTheme();
        
        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: this.theme } }));
    }
}

// Scroll Animations
class ScrollAnimator {
    constructor() {
        this.observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };
        this.observers = new Map();
    }

    init() {
        this.initScrollReveal();
        this.initParallax();
        this.initProgressBars();
        this.initBackToTop();
        this.initNavbarScroll();
    }

    initScrollReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, this.observerOptions);

        document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
        document.querySelectorAll('.scroll-fade').forEach(el => observer.observe(el));
        document.querySelectorAll('.scroll-scale').forEach(el => observer.observe(el));
    }

    initParallax() {
        window.addEventListener('scroll', Utils.throttle(() => {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.parallax');
            
            parallaxElements.forEach(el => {
                const speed = parseFloat(el.dataset.speed) || 0.5;
                const yPos = -(scrolled * speed);
                el.style.transform = `translateY(${yPos}px)`;
            });
        }, 16));
    }

    initProgressBars() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const progressBar = entry.target.querySelector('.progress-bar');
                    if (progressBar) {
                        const width = progressBar.style.width || progressBar.dataset.width || '0%';
                        setTimeout(() => {
                            progressBar.style.width = width;
                        }, 300);
                    }
                    observer.unobserve(entry.target);
                }
            });
        }, this.observerOptions);

        document.querySelectorAll('.progress-container').forEach(el => observer.observe(el));
    }

    initBackToTop() {
        const backToTop = document.getElementById('backToTop');
        if (!backToTop) return;

        window.addEventListener('scroll', Utils.throttle(() => {
            if (window.pageYOffset > 300) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }, 100));

        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    initNavbarScroll() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        window.addEventListener('scroll', Utils.throttle(() => {
            if (window.pageYOffset > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }, 100));
    }
}

// Form Handler
class FormHandler {
    constructor(formId, options = {}) {
        this.form = document.getElementById(formId);
        if (!this.form) return;

        this.options = {
            validate: true,
            showErrors: true,
            successMessage: 'Form submitted successfully!',
            errorMessage: 'Something went wrong. Please try again.',
            ...options
        };

        this.notifications = new NotificationSystem();
        this.api = new ApiClient();
        this.init();
    }

    init() {
        if (this.options.validate) {
            this.setupValidation();
        }

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    setupValidation() {
        const inputs = this.form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Required validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Email validation
        if (field.type === 'email' && value && !Utils.validateEmail(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }

        // Min length validation
        if (field.hasAttribute('minlength') && value.length < field.getAttribute('minlength')) {
            isValid = false;
            errorMessage = `Minimum length is ${field.getAttribute('minlength')} characters`;
        }

        // Max length validation
        if (field.hasAttribute('maxlength') && value.length > field.getAttribute('maxlength')) {
            isValid = false;
            errorMessage = `Maximum length is ${field.getAttribute('maxlength')} characters`;
        }

        // Pattern validation
        if (field.hasAttribute('pattern') && value) {
            const pattern = new RegExp(field.getAttribute('pattern'));
            if (!pattern.test(value)) {
                isValid = false;
                errorMessage = field.getAttribute('data-pattern-error') || 'Invalid format';
            }
        }

        if (!isValid && this.options.showErrors) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }

        return isValid;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        
        field.classList.add('error');
        field.parentNode.appendChild(errorElement);
    }

    clearFieldError(field) {
        field.classList.remove('error');
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.options.validate && !this.validateForm()) {
            return;
        }

        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Processing...';

        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData);
            
            // Send request
            const response = await this.api.post(this.form.action, data);
            
            // Success
            this.notifications.success(this.options.successMessage);
            this.form.reset();
            
            // Call success callback if provided
            if (this.options.onSuccess) {
                this.options.onSuccess(response);
            }
            
        } catch (error) {
            console.error('Form submission error:', error);
            this.notifications.error(this.options.errorMessage);
            
            // Call error callback if provided
            if (this.options.onError) {
                this.options.onError(error);
            }
            
        } finally {
            // Reset button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    validateForm() {
        const inputs = this.form.querySelectorAll('input, textarea, select');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
}

// Mobile Menu
class MobileMenu {
    constructor() {
        this.menuBtn = document.getElementById('mobileMenuBtn');
        this.menuCloseBtn = document.getElementById('mobileMenuClose');
        this.menu = document.getElementById('mobileMenu');
        
        if (!this.menuBtn || !this.menu) return;
        
        this.init();
    }

    init() {
        this.menuBtn.addEventListener('click', () => this.open());
        this.menuCloseBtn.addEventListener('click', () => this.close());
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.menu.classList.contains('open') && 
                !this.menu.contains(e.target) && 
                !this.menuBtn.contains(e.target)) {
                this.close();
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.menu.classList.contains('open')) {
                this.close();
            }
        });

        // Close menu when clicking a link
        this.menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => this.close());
        });
    }

    open() {
        this.menu.classList.add('open');
        document.body.style.overflow = 'hidden';
        this.menuBtn.setAttribute('aria-expanded', 'true');
    }

    close() {
        this.menu.classList.remove('open');
        document.body.style.overflow = '';
        this.menuBtn.setAttribute('aria-expanded', 'false');
    }

    toggle() {
        if (this.menu.classList.contains('open')) {
            this.close();
        } else {
            this.open();
        }
    }
}

// Initialize everything
document.addEventListener('DOMContentLoaded', function() {
    // Initialize components
    const notifications = new NotificationSystem();
    const pluginManager = new PluginManager();
    const themeManager = new ThemeManager();
    const scrollAnimator = new ScrollAnimator();
    const mobileMenu = new MobileMenu();
    
    // Make them globally available
    window.NexusCore = {
        Utils,
        notifications,
        pluginManager,
        themeManager,
        ApiClient,
        FormHandler,
        CONFIG
    };

    // Initialize animations
    scrollAnimator.init();

    // Initialize plugin search if on plugins page
    const searchInput = document.getElementById('pluginSearch');
    if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce((e) => {
            pluginManager.searchPlugins(e.target.value);
        }, 300));
    }

    // Initialize category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            pluginManager.filterByCategory(e.target.value);
        });
    }

    // Initialize form handlers
    document.querySelectorAll('[data-form-handler]').forEach(form => {
        const formId = form.id;
        const options = JSON.parse(form.dataset.options || '{}');
        new FormHandler(formId, options);
    });

    // Add active class to current nav link
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Console greeting
    if (!IS_PRODUCTION) {
        console.log('%c🚀 NexusCore v' + CONFIG.version + ' is ready!', 
            'color: #6366f1; font-size: 18px; font-weight: bold;');
        console.log('%c👤 Owner: ' + CONFIG.owner, 'color: #8b5cf6;');
        console.log('%c📞 Contact: ' + CONFIG.owner.number, 'color: #10b981;');
        console.log('%c🔌 Plugins: ' + CONFIG.plugins?.length, 'color: #0ea5e9;');
    }

    // Service worker registration for PWA
    if ('serviceWorker' in navigator && IS_PRODUCTION) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(error => {
                console.log('Service Worker registration failed:', error);
            });
        });
    }

    // Handle offline/online status
    window.addEventListener('online', () => {
        notifications.info('You are back online!', 'Connection Restored');
    });

    window.addEventListener('offline', () => {
        notifications.warning('You are offline. Some features may not work.', 'Connection Lost');
    });

    // Performance monitoring
    if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.entryType === 'largest-contentful-paint') {
                    console.log('LCP:', entry.startTime);
                }
            }
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
});

// Error handling
window.addEventListener('error', function(e) {
    if (!IS_PRODUCTION) {
        console.error('Uncaught error:', e.error);
    }
});

window.addEventListener('unhandledrejection', function(e) {
    if (!IS_PRODUCTION) {
        console.error('Unhandled promise rejection:', e.reason);
    }
});

// Export for modules
export {
    Utils,
    NotificationSystem,
    PluginManager,
    ApiClient,
    ThemeManager,
    ScrollAnimator,
    FormHandler,
    MobileMenu
};
