const prisma = require('../../config/prisma')
const { createAuditLog, getClientIp } = require('../../helpers/auditLog')

// ---------- Allowed ROPA fields (kept in sync with Prisma schema) ----------
const ROPA_FIELDS = [
    'recordType', 'purpose', 'dataSubject', 'processingActivity', 'personalDataItems',
    'dataCategory', 'dataType', 'collectionMethod', 'sourceDirect', 'sourceIndirect',
    'dataSource', 'legalBasis', 'minorConsent', 'processorAddress',
    'recipient', 'dataProcessor',
    'transferExists', 'transferDestination', 'intraGroupTransfer', 'transferMethod',
    'destinationStandard', 'article28Exception',
    'storageType', 'storageMethod', 'retentionPeriod', 'exerciseOfRights', 'deletionMethod',
    'disclosureExempt', 'rightsRejection',
    'securityMeasures', 'organizationalMeasures', 'technicalMeasures', 'physicalMeasures',
    'accessControl', 'userResponsibility', 'auditMeasure',
    'riskLevel', 'status'
]

const BOOLEAN_FIELDS = new Set(['sourceDirect', 'transferExists'])
const NUMERIC_FIELDS = new Set(['departmentId'])

// ---------- Helper: track field changes ----------
const trackChanges = async (oldRecord, newData, userId) => {
    const histories = []
    for (const field of ROPA_FIELDS) {
        if (newData[field] !== undefined && String(newData[field]) !== String(oldRecord[field] ?? '')) {
            histories.push({
                ropaRecordId: oldRecord.id,
                fieldName: field,
                oldValue: oldRecord[field] != null ? String(oldRecord[field]) : null,
                newValue: newData[field] != null ? String(newData[field]) : null,
                changedById: userId
            })
        }
    }

    if (histories.length > 0) {
        await prisma.ropaHistory.createMany({ data: histories })
    }

    return histories.length
}

// ---------- Helper: pick + coerce fields from body ----------
const pickFields = (body) => {
    const out = {}
    for (const f of ROPA_FIELDS) {
        if (body[f] === undefined) continue
        if (BOOLEAN_FIELDS.has(f)) {
            out[f] = body[f] === true || body[f] === 'true' || body[f] === 1 || body[f] === '1'
        } else if (body[f] === '' || body[f] === null) {
            out[f] = null
        } else {
            out[f] = body[f]
        }
    }
    return out
}

// ---------- List ROPA records ----------
exports.listRopa = async (req, res) => {
    try {
        const { status, riskLevel, departmentId, legalBasis, recordType, dataType, search, page = 1, limit = 20 } = req.query
        const userRole = req.user.role.name

        const where = {}

        if (userRole === 'DataOwner' && req.user.departmentId) {
            where.departmentId = req.user.departmentId
        }

        if (status) where.status = status
        if (riskLevel) where.riskLevel = riskLevel
        if (departmentId) where.departmentId = Number(departmentId)
        if (legalBasis) where.legalBasis = legalBasis
        if (recordType) where.recordType = recordType
        if (dataType) where.dataType = dataType
        if (search) {
            where.OR = [
                { purpose: { contains: search } },
                { dataSubject: { contains: search } },
                { dataCategory: { contains: search } },
                { processingActivity: { contains: search } },
                { personalDataItems: { contains: search } },
                { recipient: { contains: search } }
            ]
        }

        const skip = (Number(page) - 1) * Number(limit)

        const [records, total] = await Promise.all([
            prisma.ropaRecord.findMany({
                where,
                include: {
                    department: true,
                    createdBy: { select: { id: true, name: true } },
                    updatedBy: { select: { id: true, name: true } }
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.ropaRecord.count({ where })
        ])

        res.json({
            records,
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

// ---------- Read single ROPA record ----------
exports.readRopa = async (req, res) => {
    try {
        const { id } = req.params

        const record = await prisma.ropaRecord.findUnique({
            where: { id: Number(id) },
            include: {
                department: true,
                createdBy: { select: { id: true, name: true } },
                updatedBy: { select: { id: true, name: true } },
                rejectedBy: { select: { id: true, name: true, username: true } },
                histories: {
                    include: { changedBy: { select: { id: true, name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        })

        if (!record) {
            return res.status(404).json({ message: 'ROPA record not found' })
        }

        if (req.user.role.name === 'DataOwner' && record.departmentId !== req.user.departmentId) {
            return res.status(403).json({ message: 'Forbidden: You can only view your department records' })
        }

        res.json(record)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Create ROPA record ----------
exports.createRopa = async (req, res) => {
    try {
        const { purpose, dataSubject, dataCategory, legalBasis, retentionPeriod } = req.body

        if (!purpose || !dataSubject || !dataCategory || !legalBasis || !retentionPeriod) {
            return res.status(400).json({
                message: 'Required: purpose, dataSubject, dataCategory, legalBasis, retentionPeriod'
            })
        }

        const picked = pickFields(req.body)
        const departmentId = req.body.departmentId
            ? Number(req.body.departmentId)
            : req.user.departmentId

        const record = await prisma.ropaRecord.create({
            data: {
                ...picked,
                status: 'PENDING_REVIEW',
                departmentId,
                createdById: req.user.id
            },
            include: {
                department: true,
                createdBy: { select: { id: true, name: true } }
            }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'CREATE',
            description: `Created ROPA record ID ${record.id}: ${String(purpose).substring(0, 80)}`,
            ipAddress: getClientIp(req),
            sensitivity: picked.riskLevel === 'HIGH' ? 'HIGH' : 'LOW'
        })

        res.json({ record, message: 'Create ROPA Record Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Update ROPA record ----------
exports.updateRopa = async (req, res) => {
    try {
        const { id } = req.params

        const oldRecord = await prisma.ropaRecord.findUnique({ where: { id: Number(id) } })

        if (!oldRecord) {
            return res.status(404).json({ message: 'ROPA record not found' })
        }

        if (req.user.role.name === 'DataOwner') {
            if (oldRecord.departmentId !== req.user.departmentId) {
                return res.status(403).json({ message: 'Forbidden: Not your department' })
            }
            if (!['DRAFT', 'REJECTED'].includes(oldRecord.status)) {
                return res.status(400).json({ message: 'Can only edit DRAFT or REJECTED records' })
            }
        }

        const picked = pickFields(req.body)
        const data = { ...picked, updatedById: req.user.id }

        if (req.body.departmentId !== undefined) {
            data.departmentId = req.body.departmentId ? Number(req.body.departmentId) : null
        }

        await trackChanges(oldRecord, data, req.user.id)

        const record = await prisma.ropaRecord.update({
            where: { id: Number(id) },
            data,
            include: {
                department: true,
                createdBy: { select: { id: true, name: true } },
                updatedBy: { select: { id: true, name: true } }
            }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'UPDATE',
            description: `Updated ROPA record ID ${id}`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.json({ record, message: 'Update ROPA Record Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Delete ROPA record ----------
exports.deleteRopa = async (req, res) => {
    try {
        const { id } = req.params
        const { reason } = req.body || {}

        const record = await prisma.ropaRecord.findUnique({ where: { id: Number(id) } })

        if (!record) {
            return res.status(404).json({ message: 'ROPA record not found' })
        }

        await prisma.ropaRecord.delete({ where: { id: Number(id) } })

        await createAuditLog({
            userId: req.user.id,
            activity: 'DELETE',
            description: `Deleted ROPA record ID ${id} (purpose: ${String(record.purpose).substring(0, 80)})${reason ? ' | Reason: ' + reason : ''}`,
            ipAddress: getClientIp(req),
            sensitivity: 'HIGH'
        })

        res.json({ message: 'Delete ROPA Record Success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Workflow: Submit for Review ----------
exports.submitForReview = async (req, res) => {
    try {
        const { id } = req.params

        const record = await prisma.ropaRecord.findUnique({ where: { id: Number(id) } })

        if (!record) {
            return res.status(404).json({ message: 'ROPA record not found' })
        }

        if (!['DRAFT', 'REJECTED'].includes(record.status)) {
            return res.status(400).json({ message: 'Only DRAFT or REJECTED records can be submitted for review' })
        }

        await trackChanges(record, { status: 'PENDING_REVIEW' }, req.user.id)

        const updated = await prisma.ropaRecord.update({
            where: { id: Number(id) },
            data: {
                status: 'PENDING_REVIEW',
                updatedById: req.user.id,
                // Clear rejection info on resubmit
                rejectionReason: null,
                rejectedAt: null,
                rejectedById: null
            },
            include: { department: true }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'UPDATE',
            description: `Submitted ROPA record ID ${id} for review`,
            ipAddress: getClientIp(req),
            sensitivity: 'LOW'
        })

        res.json({ record: updated, message: 'Submitted for review' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Workflow: Approve ----------
exports.approveRopa = async (req, res) => {
    try {
        const { id } = req.params

        const record = await prisma.ropaRecord.findUnique({ where: { id: Number(id) } })

        if (!record) {
            return res.status(404).json({ message: 'ROPA record not found' })
        }

        if (record.status !== 'PENDING_REVIEW') {
            return res.status(400).json({ message: 'Only PENDING_REVIEW records can be approved' })
        }

        await trackChanges(record, { status: 'APPROVED' }, req.user.id)

        const updated = await prisma.ropaRecord.update({
            where: { id: Number(id) },
            data: { status: 'APPROVED', updatedById: req.user.id },
            include: { department: true }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'UPDATE',
            description: `Approved ROPA record ID ${id}`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.json({ record: updated, message: 'ROPA record approved' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Workflow: Reject ----------
exports.rejectRopa = async (req, res) => {
    try {
        const { id } = req.params
        const { reason } = req.body || {}

        const record = await prisma.ropaRecord.findUnique({ where: { id: Number(id) } })

        if (!record) {
            return res.status(404).json({ message: 'ROPA record not found' })
        }

        if (record.status !== 'PENDING_REVIEW') {
            return res.status(400).json({ message: 'Only PENDING_REVIEW records can be rejected' })
        }

        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: 'Rejection reason is required' })
        }

        await trackChanges(record, { status: 'REJECTED' }, req.user.id)

        const updated = await prisma.ropaRecord.update({
            where: { id: Number(id) },
            data: {
                status: 'REJECTED',
                rejectionReason: reason.trim(),
                rejectedAt: new Date(),
                rejectedById: req.user.id,
                updatedById: req.user.id
            },
            include: {
                department: true,
                rejectedBy: { select: { id: true, name: true, username: true } }
            }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'UPDATE',
            description: `Rejected ROPA record ID ${id} | Reason: ${reason.trim()}`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.json({ record: updated, message: 'ROPA record rejected' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Workflow: Activate ----------
exports.activateRopa = async (req, res) => {
    try {
        const { id } = req.params

        const record = await prisma.ropaRecord.findUnique({ where: { id: Number(id) } })

        if (!record) {
            return res.status(404).json({ message: 'ROPA record not found' })
        }

        if (record.status !== 'APPROVED') {
            return res.status(400).json({ message: 'Only APPROVED records can be activated' })
        }

        await trackChanges(record, { status: 'ACTIVE' }, req.user.id)

        const updated = await prisma.ropaRecord.update({
            where: { id: Number(id) },
            data: { status: 'ACTIVE', updatedById: req.user.id },
            include: { department: true }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'UPDATE',
            description: `Activated ROPA record ID ${id}`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.json({ record: updated, message: 'ROPA record activated' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Get history for a ROPA record ----------
exports.getRopaHistory = async (req, res) => {
    try {
        const { id } = req.params

        const histories = await prisma.ropaHistory.findMany({
            where: { ropaRecordId: Number(id) },
            include: { changedBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' }
        })

        res.json(histories)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
