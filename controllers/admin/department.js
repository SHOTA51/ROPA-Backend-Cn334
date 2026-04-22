const prisma = require('../../config/prisma')

exports.listDepartment = async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            include: {
                _count: { select: { users: true, ropaRecords: true } }
            }
        })
        res.json(departments)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.createDepartment = async (req, res) => {
    try {
        const { name } = req.body

        if (!name) {
            return res.status(400).json({ message: 'Department name is required' })
        }

        const existing = await prisma.department.findUnique({ where: { name } })
        if (existing) {
            return res.status(400).json({ message: 'Department already exists' })
        }

        const department = await prisma.department.create({ data: { name } })
        res.json({ department, message: 'Create Department Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.updateDepartment = async (req, res) => {
    try {
        const { id } = req.params
        const { name } = req.body

        if (!name) {
            return res.status(400).json({ message: 'Department name is required' })
        }

        const department = await prisma.department.update({
            where: { id: Number(id) },
            data: { name }
        })

        res.json({ department, message: 'Update Department Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params

        const usersInDept = await prisma.user.count({ where: { departmentId: Number(id) } })
        if (usersInDept > 0) {
            return res.status(400).json({
                message: `Cannot delete: ${usersInDept} user(s) still in this department`
            })
        }

        await prisma.department.delete({ where: { id: Number(id) } })
        res.json({ message: 'Delete Department Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
