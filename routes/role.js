const express = require('express')
const router = express.Router()
const { listRole, createRole, updateRole, deleteRole } = require('../controllers/admin/role')
const { auth, adminOnly, requireRole } = require('../middlewares/auth')

// Read: Admin, DPO, Auditor (needed for user page dropdowns)
router.get('/role', auth, requireRole('Admin', 'DPO', 'Auditor'), listRole)

// Write: Admin only
router.post('/role', auth, adminOnly, createRole)
router.put('/role/:id', auth, adminOnly, updateRole)
router.delete('/role/:id', auth, adminOnly, deleteRole)

module.exports = router
