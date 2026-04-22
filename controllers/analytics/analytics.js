const prisma = require('../../config/prisma')

// ---------- Build month-year buckets for last N months ----------
const buildMonthBuckets = (n) => {
    const buckets = []
    const now = new Date()
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        buckets.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            count: 0
        })
    }
    return buckets
}

exports.getAnalytics = async (req, res) => {
    try {
        const userRole = req.user.role.name
        const where = {}

        // DataOwner sees only their department
        if (userRole === 'DataOwner' && req.user.departmentId) {
            where.departmentId = req.user.departmentId
        }

        const [
            total,
            statusGroups,
            riskGroups,
            legalBasisGroups,
            recordTypeGroups,
            dataTypeGroups,
            departmentGroups,
            categoryGroups,
            transferGroups,
            recent12mRecords
        ] = await Promise.all([
            prisma.ropaRecord.count({ where }),
            prisma.ropaRecord.groupBy({ by: ['status'], _count: true, where }),
            prisma.ropaRecord.groupBy({ by: ['riskLevel'], _count: true, where }),
            prisma.ropaRecord.groupBy({ by: ['legalBasis'], _count: true, where }),
            prisma.ropaRecord.groupBy({ by: ['recordType'], _count: true, where }),
            prisma.ropaRecord.groupBy({ by: ['dataType'], _count: true, where }),
            prisma.ropaRecord.groupBy({ by: ['departmentId'], _count: true, where }),
            prisma.ropaRecord.groupBy({ by: ['dataCategory'], _count: true, where }),
            prisma.ropaRecord.groupBy({ by: ['transferExists'], _count: true, where }),
            prisma.ropaRecord.findMany({
                where: {
                    ...where,
                    createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 11, 1)) }
                },
                select: { createdAt: true }
            })
        ])

        // Resolve department names
        const deptIds = departmentGroups.map(d => d.departmentId).filter(Boolean)
        const depts = await prisma.department.findMany({ where: { id: { in: deptIds } } })
        const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]))

        const toKV = (groups, keyField) => groups.map(g => ({
            label: g[keyField] ?? 'Unassigned',
            value: g._count
        }))

        const byMonth = buildMonthBuckets(12)
        for (const r of recent12mRecords) {
            const d = new Date(r.createdAt)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const bucket = byMonth.find(b => b.key === key)
            if (bucket) bucket.count++
        }

        // Compliance score = APPROVED+ACTIVE / total
        const completedCount = statusGroups
            .filter(s => ['APPROVED', 'ACTIVE'].includes(s.status))
            .reduce((sum, s) => sum + s._count, 0)
        const complianceScore = total > 0 ? Math.round((completedCount / total) * 100) : 0

        const pendingReview = statusGroups.find(s => s.status === 'PENDING_REVIEW')?._count || 0
        const highRiskCount = riskGroups.find(r => r.riskLevel === 'HIGH')?._count || 0
        const sensitiveCount = dataTypeGroups.find(d => d.dataType === 'SENSITIVE')?._count || 0
        const crossBorderCount = transferGroups.find(t => t.transferExists === true)?._count || 0

        // Top dataCategory (limit 8 for chart readability)
        const topCategories = toKV(categoryGroups, 'dataCategory')
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)

        res.json({
            total,
            complianceScore,
            pendingReview,
            highRiskCount,
            sensitiveCount,
            crossBorderCount,
            statusDistribution: toKV(statusGroups, 'status'),
            riskDistribution: toKV(riskGroups, 'riskLevel'),
            legalBasisDistribution: toKV(legalBasisGroups, 'legalBasis'),
            recordTypeDistribution: toKV(recordTypeGroups, 'recordType'),
            dataTypeDistribution: toKV(dataTypeGroups, 'dataType'),
            departmentDistribution: departmentGroups.map(d => ({
                label: deptMap[d.departmentId] || 'Unassigned',
                value: d._count
            })).sort((a, b) => b.value - a.value),
            categoryDistribution: topCategories,
            crossBorderDistribution: transferGroups.map(t => ({
                label: t.transferExists ? 'Transferred' : 'No Transfer',
                value: t._count
            })),
            recordsByMonth: byMonth.map(b => ({ label: b.label, value: b.count }))
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
