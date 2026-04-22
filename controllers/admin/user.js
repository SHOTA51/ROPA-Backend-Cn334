const prisma = require('../../config/prisma')
const bcrypt = require('bcrypt')
const { createAuditLog, getClientIp } = require('../../helpers/auditLog')

exports.listUser = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                enabled: true,
                status: true,
                lastActive: true,
                role: true,
                department: true,
                createdAt: true
            }
        })
        res.json(users)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.readUser = async (req, res) => {
    try {
        const { id } = req.params

        const user = await prisma.user.findFirst({
            where: { id: Number(id) },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                enabled: true,
                status: true,
                lastActive: true,
                role: true,
                department: true,
                createdAt: true
            }
        })

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        res.json(user)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.createUser = async (req, res) => {
    try {
        const { username, password, email, name, roleId, departmentId } = req.body

        if (!username || !password || !email || !name || !roleId) {
            return res.status(400).json({
                message: 'Required fields: username, password, email, name, roleId'
            })
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { email }]
            }
        })

        if (existingUser) {
            return res.status(400).json({ message: 'Username or Email already exists' })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                email,
                name,
                roleId: Number(roleId),
                departmentId: departmentId ? Number(departmentId) : null
            },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                department: true
            }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'CREATE',
            description: `Admin created user: ${name} (${username})`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.json({ user: newUser, message: 'Create User Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params
        const { username, password, email, name, roleId, departmentId, enabled } = req.body

        const data = {}
        if (username) data.username = username
        if (email) data.email = email
        if (name) data.name = name
        if (roleId) data.roleId = Number(roleId)
        if (departmentId !== undefined) data.departmentId = departmentId ? Number(departmentId) : null
        if (typeof enabled === 'boolean') data.enabled = enabled

        if (password) {
            const salt = await bcrypt.genSalt(10)
            data.password = await bcrypt.hash(password, salt)
        }

        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data,
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                enabled: true,
                role: true,
                department: true
            }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'UPDATE',
            description: `Admin updated user ID ${id}`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.json({ user: updatedUser, message: 'Update User Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params

        const user = await prisma.user.findUnique({ where: { id: Number(id) } })

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        await prisma.user.delete({ where: { id: Number(id) } })

        await createAuditLog({
            userId: req.user.id,
            activity: 'DELETE',
            description: `Admin deleted user: ${user.name} (${user.username})`,
            ipAddress: getClientIp(req),
            sensitivity: 'HIGH'
        })

        res.json({ message: 'Delete User Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
