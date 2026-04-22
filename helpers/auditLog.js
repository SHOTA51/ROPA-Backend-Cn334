const prisma = require('../config/prisma')

/**
 * Create an audit log entry
 * @param {Object} params
 * @param {number} params.userId - User who performed the action
 * @param {string} params.activity - CREATE, UPDATE, DELETE, LOGIN, LOGOUT
 * @param {string} params.description - What happened
 * @param {string} params.ipAddress - Client IP address
 * @param {string} params.sensitivity - LOW, MEDIUM, HIGH
 */
exports.createAuditLog = async ({ userId, activity, description, ipAddress, sensitivity = 'LOW' }) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                activity,
                description,
                ipAddress: ipAddress || '0.0.0.0',
                sensitivity
            }
        })
    } catch (err) {
        console.error('Failed to create audit log:', err)
    }
}

/**
 * Get client IP from request
 */
exports.getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || '0.0.0.0'
}
