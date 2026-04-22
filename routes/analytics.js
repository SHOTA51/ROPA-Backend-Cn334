const express = require('express')
const router = express.Router()
const { getAnalytics } = require('../controllers/analytics/analytics')
const { auth, requireRole } = require('../middlewares/auth')

// Analytics: Admin, DPO (read-only), Auditor (read-only), Executive (read-only), DataOwner
router.get('/analytics', auth, requireRole('Admin', 'DPO', 'Auditor', 'Executive', 'DataOwner'), getAnalytics)

module.exports = router
