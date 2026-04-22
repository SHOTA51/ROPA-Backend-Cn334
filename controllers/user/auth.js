const prisma = require('../../config/prisma')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { createAuditLog, getClientIp } = require('../../helpers/auditLog')

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body

        if (!username) {
            return res.status(400).json({ message: 'Username is required' })
        }

        if (!password) {
            return res.status(400).json({ message: 'Password is required' })
        }

        const user = await prisma.user.findUnique({
            where: { username },
            include: { role: true, department: true }
        })

        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' })
        }

        if (!user.enabled) {
            return res.status(403).json({ message: 'Account is disabled' })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' })
        }

        // Update user status
        await prisma.user.update({
            where: { id: user.id },
            data: { status: 'ONLINE', lastActive: new Date() }
        })

        const payload = {
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role.name,
                department: user.department?.name || null
            }
        }

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' })

        await createAuditLog({
            userId: user.id,
            activity: 'LOGIN',
            description: `User ${user.name} logged in`,
            ipAddress: getClientIp(req),
            sensitivity: 'LOW'
        })

        res.json({ user: payload.user, token, message: 'Login Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.logout = async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { status: 'OFFLINE', lastActive: new Date() }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'LOGOUT',
            description: `User ${req.user.name} logged out`,
            ipAddress: getClientIp(req),
            sensitivity: 'LOW'
        })

        res.json({ message: 'Logout Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.currentUser = async (req, res) => {
    try {
        const { password, ...user } = req.user
        res.json(user)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' })
        }

        const isMatch = await bcrypt.compare(currentPassword, req.user.password)

        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(newPassword, salt)

        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'UPDATE',
            description: `User ${req.user.name} changed password`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.json({ message: 'Password changed successfully' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
