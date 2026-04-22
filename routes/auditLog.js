const express = require('express')
const router = express.Router()
const { listAuditLog } = require('../controllers/audit/auditLog')
const { auth, requireRole } = require('../middlewares/auth')

// Admin, DPO, Auditor can view audit logs (Auditor gets full read access)
router.get('/audit-log', auth, requireRole('Admin', 'DPO', 'Auditor'), listAuditLog)

module.exports = router
