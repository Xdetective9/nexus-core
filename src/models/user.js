import { DataTypes } from 'sequelize';
import { getDatabase } from '../core/database.js';

const { sequelize } = getDatabase();

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        validate: {
            len: [3, 50],
            is: /^[a-zA-Z0-9_.-]+$/
        }
    },
    email: {
        type: DataTypes.STRING(255),
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100)
    },
    phone: {
        type: DataTypes.STRING(20)
    },
    avatar: {
        type: DataTypes.STRING(500)
    },
    role: {
        type: DataTypes.ENUM('admin', 'moderator', 'user', 'guest'),
        defaultValue: 'user'
    },
    permissions: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    isVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    lastLogin: {
        type: DataTypes.DATE
    },
    loginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lockUntil: {
        type: DataTypes.DATE
    },
    settings: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
        get() {
            const value = this.getDataValue('settings');
            return value ? JSON.parse(value) : {};
        },
        set(value) {
            this.setDataValue('settings', JSON.stringify(value || {}));
        }
    },
    metadata: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
        get() {
            const value = this.getDataValue('metadata');
            return value ? JSON.parse(value) : {};
        },
        set(value) {
            this.setDataValue('metadata', JSON.stringify(value || {}));
        }
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['username'], unique: true },
        { fields: ['email'], unique: true },
        { fields: ['role'] },
        { fields: ['isActive'] }
    ]
});

export default User;
