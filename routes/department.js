const express = require('express')
const router = express.Router()
const { listDepartment, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/admin/department')
const { auth, adminOnly, requireRole } = require('../middlewares/auth')

// Read: Admin, DPO, Auditor (needed for filters)
router.get('/department', auth, requireRole('Admin', 'DPO', 'Auditor'), listDepartment)

// Write: Admin only
router.post('/department', auth, adminOnly, createDepartment)
router.put('/department/:id', auth, adminOnly, updateDepartment)
router.delete('/department/:id', auth, adminOnly, deleteDepartment)

module.exports = router
