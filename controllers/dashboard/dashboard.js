const prisma = require('../../config/prisma')

exports.getDashboard = async (req, res) => {
    try {
        const userRole = req.user.role.name
        const departmentFilter = {}

        // DataOwner sees only their department
        if (userRole === 'DataOwner' && req.user.departmentId) {
            departmentFilter.departmentId = req.user.departmentId
        }

        // 1. Total records & status breakdown
        const [totalRecords, statusCounts, riskCounts, legalBasisCounts] = await Promise.all([
            prisma.ropaRecord.count({ where: departmentFilter }),
            prisma.ropaRecord.groupBy({
                by: ['status'],
                _count: true,
                where: departmentFilter
            }),
            prisma.ropaRecord.groupBy({
                by: ['riskLevel'],
                _count: true,
                where: departmentFilter
            }),
            prisma.ropaRecord.groupBy({
                by: ['legalBasis'],
                _count: true,
                where: departmentFilter
            })
        ])

        // 2. Compliance score (approved+active / total * 100)
        const completedCount = statusCounts
            .filter(s => ['APPROVED', 'ACTIVE'].includes(s.status))
            .reduce((sum, s) => sum + s._count, 0)

        const complianceScore = totalRecords > 0
            ? Math.round((completedCount / totalRecords) * 100)
            : 0

        // 3. Department breakdown
        const departmentStats = await prisma.ropaRecord.groupBy({
            by: ['departmentId'],
            _count: true,
            where: departmentFilter
        })

        // Get department names
        const departmentIds = departmentStats.map(d => d.departmentId).filter(Boolean)
        const departments = await prisma.department.findMany({
            where: { id: { in: departmentIds } }
        })
        const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))

        const departmentBreakdown = departmentStats.map(d => ({
            departmentId: d.departmentId,
            departmentName: deptMap[d.departmentId] || 'Unassigned',
            count: d._count
        }))

        // 4. Pending review count
        const pendingReview = statusCounts.find(s => s.status === 'PENDING_REVIEW')?._count || 0

        // 5. High risk count
        const highRiskCount = riskCounts.find(r => r.riskLevel === 'HIGH')?._count || 0

        // 6. Recent activity (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const recentActivity = await prisma.auditLog.count({
            where: { createdAt: { gte: sevenDaysAgo } }
        })

        // 7. Status distribution formatted
        const statusDistribution = {}
        for (const s of statusCounts) {
            statusDistribution[s.status] = s._count
        }

        // 8. Risk distribution formatted
        const riskDistribution = {}
        for (const r of riskCounts) {
            riskDistribution[r.riskLevel] = r._count
        }

        // 9. Legal basis distribution formatted
        const legalBasisDistribution = {}
        for (const l of legalBasisCounts) {
            legalBasisDistribution[l.legalBasis] = l._count
        }

        res.json({
            totalRecords,
            complianceScore,
            pendingReview,
            highRiskCount,
            recentActivity,
            statusDistribution,
            riskDistribution,
            legalBasisDistribution,
            departmentBreakdown
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
