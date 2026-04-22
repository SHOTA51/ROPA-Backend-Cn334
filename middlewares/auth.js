const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')

// Verify JWT token
exports.auth = async (req, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1]

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: No token provided' })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const user = await prisma.user.findUnique({
            where: { id: decoded.user.id },
            include: { role: true, department: true }
        })

        if (!user || !user.enabled) {
            return res.status(401).json({ message: 'Unauthorized: User not found or disabled' })
        }

        req.user = user
        next()
    } catch (err) {
        console.log(err)
        res.status(401).json({ message: 'Unauthorized: Invalid token' })
    }
}

// Check if user has one of the allowed roles
exports.requireRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role.name)) {
            return res.status(403).json({
                message: `Forbidden: Requires one of [${roles.join(', ')}] role`
            })
        }
        next()
    }
}

// Shorthand: Admin only
exports.adminOnly = (req, res, next) => {
    if (req.user.role.name !== 'Admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' })
    }
    next()
}
