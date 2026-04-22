const prisma = require('../../config/prisma')

exports.listAuditLog = async (req, res) => {
    try {
        const { activity, sensitivity, userId, startDate, endDate, search, page = 1, limit = 50 } = req.query

        const where = {}

        if (activity) where.activity = activity
        if (sensitivity) where.sensitivity = sensitivity
        if (userId) where.userId = Number(userId)
        if (search) {
            where.description = { contains: search }
        }

        // Date range filter (default: last 90 days)
        if (startDate || endDate) {
            where.createdAt = {}
            if (startDate) where.createdAt.gte = new Date(startDate)
            if (endDate) where.createdAt.lte = new Date(endDate)
        } else {
            // Default: last 90 days
            const ninetyDaysAgo = new Date()
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
            where.createdAt = { gte: ninetyDaysAgo }
        }

        const skip = (Number(page) - 1) * Number(limit)

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, username: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.auditLog.count({ where })
        ])

        res.json({
            logs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
