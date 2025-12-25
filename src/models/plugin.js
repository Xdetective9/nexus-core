import { DataTypes } from 'sequelize';
import { getDatabase } from '../core/database.js';
import logger from '../utils/logger.js';

const { sequelize } = getDatabase();

const Plugin = sequelize.define('Plugin', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [2, 255]
        }
    },
    version: {
        type: DataTypes.STRING(50),
        defaultValue: '1.0.0',
        validate: {
            is: /^(\d+\.)?(\d+\.)?(\*|\d+)$/
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [10, 2000]
        }
    },
    author: {
        type: DataTypes.STRING(255),
        defaultValue: 'NexusCore',
        validate: {
            len: [2, 255]
        }
    },
    route: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            is: /^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/,
            len: [2, 255]
        }
    },
    icon: {
        type: DataTypes.STRING(100),
        defaultValue: 'box'
    },
    iconColor: {
        type: DataTypes.STRING(50),
        defaultValue: 'primary',
        validate: {
            isIn: [['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'dark', 'light']]
        }
    },
    category: {
        type: DataTypes.STRING(100),
        defaultValue: 'utility',
        validate: {
            isIn: [['ai', 'automation', 'tools', 'media', 'development', 'social', 'productivity', 'security', 'utility']]
        }
    },
    tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    dependencies: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
            const value = this.getDataValue('dependencies');
            try {
                return value ? JSON.parse(value) : [];
            } catch {
                return [];
            }
        },
        set(value) {
            this.setDataValue('dependencies', JSON.stringify(value || []));
        }
    },
    config: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
        get() {
            const value = this.getDataValue('config');
            try {
                return value ? JSON.parse(value) : {};
            } catch {
                return {};
            }
        },
        set(value) {
            this.setDataValue('config', JSON.stringify(value || {}));
        }
    },
    settings: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
        get() {
            const value = this.getDataValue('settings');
            try {
                return value ? JSON.parse(value) : {};
            } catch {
                return {};
            }
        },
        set(value) {
            this.setDataValue('settings', JSON.stringify(value || {}));
        }
    },
    permissions: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: ['user']
    },
    requiresAuth: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isPremium: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    rating: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 5
        }
    },
    downloads: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    lastUpdated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    installedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    size: {
        type: DataTypes.STRING(50),
        defaultValue: '0 KB'
    },
    compatibility: {
        type: DataTypes.STRING(100),
        defaultValue: '^3.0.0'
    },
    repository: {
        type: DataTypes.STRING(500),
        validate: {
            isUrl: true
        }
    },
    documentation: {
        type: DataTypes.STRING(500),
        validate: {
            isUrl: true
        }
    },
    supportEmail: {
        type: DataTypes.STRING(255),
        validate: {
            isEmail: true
        }
    },
    changelog: {
        type: DataTypes.TEXT
    },
    screenshots: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'pending', 'deprecated', 'beta'),
        defaultValue: 'active'
    },
    metadata: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
        get() {
            const value = this.getDataValue('metadata');
            try {
                return value ? JSON.parse(value) : {};
            } catch {
                return {};
            }
        },
        set(value) {
            this.setDataValue('metadata', JSON.stringify(value || {}));
        }
    }
}, {
    tableName: 'plugins',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            name: 'plugins_name_idx',
            fields: ['name'],
            unique: true
        },
        {
            name: 'plugins_category_idx',
            fields: ['category']
        },
        {
            name: 'plugins_active_idx',
            fields: ['active']
        },
        {
            name: 'plugins_featured_idx',
            fields: ['featured']
        },
        {
            name: 'plugins_rating_idx',
            fields: ['rating']
        },
        {
            name: 'plugins_downloads_idx',
            fields: ['downloads']
        },
        {
            name: 'plugins_created_at_idx',
            fields: ['created_at']
        }
    ],
    hooks: {
        beforeValidate: (plugin) => {
            if (plugin.name) {
                plugin.name = plugin.name.trim();
            }
            if (plugin.route && !plugin.route.startsWith('/')) {
                plugin.route = '/' + plugin.route;
            }
        },
        afterCreate: (plugin) => {
            logger.info(`Plugin created: ${plugin.name} v${plugin.version}`);
        },
        afterUpdate: (plugin) => {
            logger.info(`Plugin updated: ${plugin.name} v${plugin.version}`);
        },
        afterDestroy: (plugin) => {
            logger.info(`Plugin deleted: ${plugin.name}`);
        }
    }
});

// Instance methods
Plugin.prototype.activate = function() {
    this.active = true;
    this.lastUpdated = new Date();
    return this.save();
};

Plugin.prototype.deactivate = function() {
    this.active = false;
    this.lastUpdated = new Date();
    return this.save();
};

Plugin.prototype.incrementDownloads = function() {
    this.downloads += 1;
    return this.save();
};

Plugin.prototype.updateRating = async function(newRating, userId) {
    // In a real app, you'd have a separate ratings table
    const currentRating = this.rating;
    const totalRatings = this.downloads || 1;
    this.rating = ((currentRating * totalRatings) + newRating) / (totalRatings + 1);
    return this.save();
};

// Class methods
Plugin.findByCategory = function(category) {
    return this.findAll({
        where: { 
            category,
            active: true 
        },
        order: [['featured', 'DESC'], ['rating', 'DESC'], ['downloads', 'DESC']]
    });
};

Plugin.findFeatured = function() {
    return this.findAll({
        where: { 
            featured: true,
            active: true 
        },
        limit: 10,
        order: [['rating', 'DESC'], ['downloads', 'DESC']]
    });
};

Plugin.search = function(query) {
    const { Op } = require('sequelize');
    return this.findAll({
        where: {
            [Op.or]: [
                { name: { [Op.iLike]: `%${query}%` } },
                { description: { [Op.iLike]: `%${query}%` } },
                { tags: { [Op.contains]: [query] } }
            ],
            active: true
        },
        order: [['rating', 'DESC'], ['downloads', 'DESC']]
    });
};

export default Plugin;
