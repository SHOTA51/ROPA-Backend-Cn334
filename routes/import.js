const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const { importExcel, listImports, exportExcel } = require('../controllers/import/import')
const { auth, requireRole } = require('../middlewares/auth')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'))
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + '-' + file.originalname)
    }
})

const fileFilter = (req, file, cb) => {
    const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ]
    if (allowed.includes(file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false)
    }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })

// Import: Admin, DataOwner only (DPO is review-only; Auditor/Executive cannot)
router.post('/import', auth, requireRole('Admin', 'DataOwner'), upload.single('file'), importExcel)

// List import history: Admin, DPO, Auditor
router.get('/import', auth, requireRole('Admin', 'DPO', 'Auditor'), listImports)

// Export: Admin, DataOwner, DPO, Auditor (Executive cannot)
router.get('/export', auth, requireRole('Admin', 'DataOwner', 'DPO', 'Auditor'), exportExcel)

module.exports = router
