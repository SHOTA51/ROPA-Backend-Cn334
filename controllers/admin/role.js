const prisma = require('../../config/prisma')

exports.listRole = async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: { _count: { select: { users: true } } }
        })
        res.json(roles)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.createRole = async (req, res) => {
    try {
        const { name } = req.body

        if (!name) {
            return res.status(400).json({ message: 'Role name is required' })
        }

        const existing = await prisma.role.findUnique({ where: { name } })
        if (existing) {
            return res.status(400).json({ message: 'Role already exists' })
        }

        const role = await prisma.role.create({ data: { name } })
        res.json({ role, message: 'Create Role Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params
        const { name } = req.body

        if (!name) {
            return res.status(400).json({ message: 'Role name is required' })
        }

        const role = await prisma.role.update({
            where: { id: Number(id) },
            data: { name }
        })

        res.json({ role, message: 'Update Role Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params

        const usersWithRole = await prisma.user.count({ where: { roleId: Number(id) } })
        if (usersWithRole > 0) {
            return res.status(400).json({
                message: `Cannot delete: ${usersWithRole} user(s) still assigned to this role`
            })
        }

        await prisma.role.delete({ where: { id: Number(id) } })
        res.json({ message: 'Delete Role Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
