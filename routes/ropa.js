const express = require('express')
const router = express.Router()
const {
    listRopa, readRopa, createRopa, updateRopa, deleteRopa,
    submitForReview, approveRopa, rejectRopa, activateRopa, getRopaHistory
} = require('../controllers/ropa/ropa')
const { auth, requireRole } = require('../middlewares/auth')

// All authenticated users can list and read (filtered by role in controller)
router.get('/ropa', auth, listRopa)
router.get('/ropa/:id', auth, readRopa)
router.get('/ropa/:id/history', auth, getRopaHistory)

// Create/Update/Delete: Admin, DataOwner (DPO review-only, no edit)
router.post('/ropa', auth, requireRole('Admin', 'DataOwner'), createRopa)
router.put('/ropa/:id', auth, requireRole('Admin', 'DataOwner'), updateRopa)
router.delete('/ropa/:id', auth, requireRole('Admin'), deleteRopa)

// Workflow
router.put('/ropa/:id/submit', auth, requireRole('Admin', 'DataOwner'), submitForReview)
router.put('/ropa/:id/approve', auth, requireRole('Admin', 'DPO'), approveRopa)
router.put('/ropa/:id/reject', auth, requireRole('Admin', 'DPO'), rejectRopa)
router.put('/ropa/:id/activate', auth, requireRole('Admin', 'DPO'), activateRopa)

module.exports = router
