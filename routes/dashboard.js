const express = require('express')
const router = express.Router()
const { getDashboard } = require('../controllers/dashboard/dashboard')
const { auth } = require('../middlewares/auth')

// All authenticated users can see dashboard (filtered by role in controller)
router.get('/dashboard', auth, getDashboard)

module.exports = router
