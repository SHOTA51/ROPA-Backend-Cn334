const express = require('express')
const router = express.Router()
const { login, logout, currentUser, changePassword } = require('../controllers/user/auth')
const { auth } = require('../middlewares/auth')

router.post('/login', login)
router.post('/logout', auth, logout)
router.get('/me', auth, currentUser)
router.put('/change-password', auth, changePassword)

module.exports = router
