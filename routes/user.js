const express = require('express')
const router = express.Router()
const { createUser, listUser, readUser, updateUser, deleteUser } = require('../controllers/admin/user')
const { auth, adminOnly, requireRole } = require('../middlewares/auth')

// Read access: Admin (full), DPO + Auditor (read-only)
router.get('/user', auth, requireRole('Admin', 'DPO', 'Auditor'), listUser)
router.get('/user/:id', auth, requireRole('Admin', 'DPO', 'Auditor'), readUser)

// Write access: Admin only
router.post('/user', auth, adminOnly, createUser)
router.put('/user/:id', auth, adminOnly, updateUser)
router.delete('/user/:id', auth, adminOnly, deleteUser)

module.exports = router
