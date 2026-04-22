const prisma = require('../../config/prisma')
const XLSX = require('xlsx')
const { createAuditLog, getClientIp } = require('../../helpers/auditLog')

// =====================
// Value mappers
// =====================

const LEGAL_BASIS_MAP = {
    'consent': 'CONSENT', 'ความยินยอม': 'CONSENT',
    'contract': 'CONTRACT', 'สัญญา': 'CONTRACT', 'ปฏิบัติตามสัญญา': 'CONTRACT',
    'legal obligation': 'LEGAL_OBLIGATION', 'legal_obligation': 'LEGAL_OBLIGATION',
    'หน้าที่ตามกฎหมาย': 'LEGAL_OBLIGATION', 'ปฏิบัติตามกฎหมาย': 'LEGAL_OBLIGATION',
    'vital interest': 'VITAL_INTEREST', 'vital_interest': 'VITAL_INTEREST',
    'ประโยชน์สำคัญต่อชีวิต': 'VITAL_INTEREST', 'ป้องกันอันตรายต่อชีวิต': 'VITAL_INTEREST',
    'public task': 'PUBLIC_TASK', 'public_task': 'PUBLIC_TASK',
    'ภารกิจสาธารณะ': 'PUBLIC_TASK', 'ประโยชน์สาธารณะ': 'PUBLIC_TASK',
    'legitimate interest': 'LEGITIMATE_INTEREST', 'legitimate_interest': 'LEGITIMATE_INTEREST',
    'ประโยชน์โดยชอบด้วยกฎหมาย': 'LEGITIMATE_INTEREST'
}

const RISK_MAP = {
    'low': 'LOW', 'ต่ำ': 'LOW',
    'medium': 'MEDIUM', 'กลาง': 'MEDIUM', 'ปานกลาง': 'MEDIUM',
    'high': 'HIGH', 'สูง': 'HIGH'
}

const DATA_TYPE_MAP = {
    'general': 'GENERAL', 'ทั่วไป': 'GENERAL', 'ข้อมูลทั่วไป': 'GENERAL',
    'sensitive': 'SENSITIVE', 'อ่อนไหว': 'SENSITIVE', 'ข้อมูลอ่อนไหว': 'SENSITIVE'
}

const COLLECTION_MAP = {
    'soft': 'SOFT_FILE', 'soft file': 'SOFT_FILE', 'soft_file': 'SOFT_FILE', 'ดิจิทัล': 'SOFT_FILE',
    'hard': 'HARD_COPY', 'hard copy': 'HARD_COPY', 'hard_copy': 'HARD_COPY', 'กระดาษ': 'HARD_COPY',
    'both': 'BOTH', 'ทั้งสอง': 'BOTH'
}

const RECORD_TYPE_MAP = {
    'controller': 'CONTROLLER', 'ผู้ควบคุม': 'CONTROLLER',
    'processor': 'PROCESSOR', 'ผู้ประมวลผล': 'PROCESSOR'
}

const MINOR_CONSENT_MAP = {
    'none': 'NONE', '': 'NONE',
    'under 10': 'AGE_UNDER_10', 'under_10': 'AGE_UNDER_10', 'อายุไม่เกิน 10': 'AGE_UNDER_10', 'อายุไม่เกิน 10 ปี': 'AGE_UNDER_10',
    '10 - 20': 'AGE_10_20', '10-20': 'AGE_10_20', 'อายุ 10 - 20 ปี': 'AGE_10_20', 'อายุ 10-20': 'AGE_10_20'
}

const mapEnum = (map, value, fallback) => {
    if (value === null || value === undefined) return fallback
    const key = String(value).toLowerCase().trim()
    return map[key] || fallback
}

const parseBool = (value) => {
    if (value === true || value === 1) return true
    if (!value) return false
    const s = String(value).toLowerCase().trim()
    return ['true', 'yes', 'y', 'มี', 'ใช่', 'ü', '✓', '1'].includes(s)
}

// Pick first non-empty field across candidate keys
const pick = (row, ...keys) => {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return row[k]
        }
    }
    return ''
}

// =====================
// Import
// =====================

exports.importExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' })
        }

        const filePath = req.file.path
        const fileName = req.file.originalname
        const fileSize = req.file.size

        const importFile = await prisma.importFile.create({
            data: { fileName, filePath, fileSize, status: 'PROCESSING' }
        })

        const workbook = XLSX.readFile(filePath)
        let totalCreated = 0
        const errors = []
        const allRecords = []

        // Process each sheet - use sheet name to detect Controller vs Processor
        for (const sheetName of workbook.SheetNames) {
            const lower = sheetName.toLowerCase()
            if (lower.includes('example') || lower.includes('ตัวอย่าง')) continue

            const sheet = workbook.Sheets[sheetName]
            // Try header row 8 (Controller) then 12 (Processor), else auto
            let headerRow = 1
            if (lower.includes('controller') || lower.includes('ควบคุม')) headerRow = 8
            else if (lower.includes('processor') || lower.includes('ประมวลผล')) headerRow = 12

            const defaultRecordType = lower.includes('processor') || lower.includes('ประมวลผล')
                ? 'PROCESSOR'
                : 'CONTROLLER'

            // Extract rows as array of arrays, then build flexible row objects
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
            if (aoa.length === 0) continue

            // If auto mode: use row 1 as header
            let headers = aoa[headerRow - 1] || aoa[0]
            const dataStart = aoa.findIndex((row, i) => i > headerRow && row.some(cell => String(cell).trim() !== ''))

            const rows = []
            const startIdx = dataStart > 0 ? dataStart : headerRow
            for (let i = startIdx; i < aoa.length; i++) {
                const r = aoa[i]
                if (!r || r.every(c => String(c).trim() === '')) continue
                const obj = {}
                for (let c = 0; c < headers.length; c++) {
                    const h = String(headers[c] || '').trim()
                    if (h) obj[h] = r[c]
                }
                rows.push(obj)
            }

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i]
                const rowNum = startIdx + i + 1

                const purpose = pick(row,
                    'Purpose', 'purpose', 'วัตถุประสงค์', 'Purpose of Processing',
                    '3. วัตถุประสงค์ของการประมวลผล', '4. วัตถุประสงค์ของการประมวลผล'
                )
                const dataSubject = pick(row,
                    'Data Subject', 'dataSubject', 'Subject', 'เจ้าของข้อมูล',
                    '1. ชื่อเจ้าของข้อมูลส่วนบุคคล', '1. ชื่อผู้้ประมวลผลข้อมูลส่วนบุคคล'
                )
                const dataCategory = pick(row,
                    'Data Category', 'dataCategory', 'Category', 'ประเภทข้อมูล', 'หมวดหมู่ข้อมูล',
                    '5. หมวดหมู่ของข้อมูล (ข้อมูลลูกค้า/คู่ค้า/ผู้ติดต่อ/พนักงาน)',
                    '6. หมวดหมู่ของข้อมูล (ข้อมูลลูกค้า/คู่ค้า/ผู้ติดต่อ/พนักงาน)'
                )
                const legalBasis = pick(row,
                    'Legal Basis', 'legalBasis', 'ฐานทางกฎหมาย', 'ฐานในการประมวลผล',
                    '9. ฐานในการประมวลผล', '10. ฐานในการประมวลผล'
                )
                const retentionPeriod = pick(row,
                    'Retention Period', 'retentionPeriod', 'ระยะเวลาจัดเก็บ',
                    'ระยะเวลาการเก็บรักษาข้อมูลส่วนบุคคล', ' ระยะเวลาการเก็บรักษาข้อมูลส่วนบุคคล'
                )

                if (!purpose || !dataSubject || !dataCategory || !retentionPeriod) {
                    errors.push(`Sheet "${sheetName}" row ${rowNum}: Missing required field`)
                    continue
                }

                const processingActivity = pick(row,
                    '2. กิจกรรมประมวลผล', '3. กิจกรรมประมวลผล', 'Processing Activity', 'processingActivity'
                )
                const personalDataItems = pick(row,
                    '4. ข้อมูลส่วนบุคคลที่จัดเก็บ', '5. ข้อมูลส่วนบุคคลที่จัดเก็บ',
                    'Personal Data', 'personalDataItems'
                )
                const dataTypeVal = pick(row,
                    '6. ประเภทของข้อมูล (ข้อมูลทั่วไป/ข้อมูลอ่อนไหว)',
                    '7. ประเภทของข้อมูล (ข้อมูลทั่วไป/ข้อมูลอ่อนไหว)',
                    'Data Type', 'dataType'
                )
                const collectionMethodVal = pick(row,
                    '7. วิธีการได้มาซึ่งข้อมูล (soft file/hard copy)',
                    '8. วิธีการได้มาซึ่งข้อมูล (soft file/hard copy)',
                    'Collection Method', 'collectionMethod'
                )
                const sourceDirect = parseBool(pick(row,
                    'จากเจ้าของข้อมูลส่วนบุคคลโดยตรง', 'จากเจ้าของผู้ควบคุมข้อมูลส่วนบุคคลโดยตรง',
                    'sourceDirect'
                ))
                const sourceIndirect = pick(row, 'จากแหล่งอื่น', 'sourceIndirect')

                const minorConsentVal = pick(row,
                    'อายุไม่เกิน 10 ปี', 'อายุ 10 - 20 ปี',
                    '10. การขอความยินยอมของผู้เยาว์', 'minorConsent'
                )

                const transferExists = parseBool(pick(row,
                    'มีการส่งหรือโอนข้อมูลไปต่างประเทศหรือไม่ (ถ้ามีโปรดระบุประเทศปลายทาง)',
                    'transferExists'
                ))
                const transferDestination = pick(row, 'Transfer Destination', 'transferDestination', 'ประเทศปลายทาง')
                const intraGroupTransfer = pick(row,
                    'เป็นการส่งข้อมูลไปยังต่างประเทศของกลุ่มบริษัทในเครือหรือไม่ (ถ้าใช้โปรดระบุชื่อบริษัท) ',
                    'เป็นการส่งข้อมูลไปยังต่างประเทศของกลุ่มบริษัทในเครือหรือไม่ (ถ้าใช้โปรดระบุชื่อบริษัท)',
                    'intraGroupTransfer'
                )
                const transferMethod = pick(row, 'วิธีการโอนข้อมูล', 'transferMethod')
                const destinationStandard = pick(row, 'มาตรฐานการคุ้มครองข้อมูลส่วนบุคคลของประเทศปลายทาง', 'destinationStandard')
                const article28Exception = pick(row,
                    'ข้อยกเว้นตามมาตรา 28  ( เช่น ปฏิบัติตามกฎหมาย ความยินยอม ปฏิบัติตามสัญญา ป้องกันอันตรายต่อชีวิต ประโยชน์สาธารณะที่สำคัญ)',
                    'article28Exception'
                )

                const storageType = pick(row, 'ประเภทของข้อมูลที่จัดเก็บ (soft file / hard copy)', 'storageType')
                const storageMethod = pick(row, 'วิธีการเก็บรักษาข้อมูล', 'storageMethod')
                const exerciseOfRights = pick(row,
                    'สิทธิและวิธีการเข้าถึงข้อมูลส่วนบุคคล (ระบุเงื่อนไขการใช้สิทธิและวิธีการ) ',
                    'สิทธิและวิธีการเข้าถึงข้อมูลส่วนบุคคล (ระบุเงื่อนไขการใช้สิทธิและวิธีการ)',
                    'Exercise of Rights', 'exerciseOfRights'
                )
                const deletionMethod = pick(row, 'วิธีการลบหรือทำลายข้อมูลส่วนบุคคลเมื่อสิ้นสุดระยะเวลาจัดเก็บ', 'deletionMethod')

                const disclosureExempt = pick(row,
                    '13. การใช้หรือเปิดเผยข้อมูลส่วนบุคคลที่ได้รับยกเว้นไม่ต้องขอความยินยอม (ระบุให้สอดคล้องฐานในการประมวลผล)',
                    'disclosureExempt'
                )
                const rightsRejection = pick(row,
                    '14. การปฎิเสธคำขอหรือคำคัดค้านการใช้สิทธิของเจ้าของข้อมูลส่วนบุคคล (*ลงข้อมูลเมื่อมีการปฏิเสธการใช้สิทธิ)',
                    'rightsRejection'
                )

                const organizationalMeasures = pick(row, 'มาตรการเชิงองค์กร', 'organizationalMeasures')
                const technicalMeasures = pick(row, 'มาตรการเชิงเทคนิค', 'technicalMeasures')
                const physicalMeasures = pick(row, 'มาตรการทางกายภาพ', 'physicalMeasures')
                const accessControl = pick(row, 'การควบคุมการเข้าถึงข้อมูล', 'accessControl')
                const userResponsibility = pick(row, 'การกำหนดหน้าที่ความรับผิดชอบของผู้ใช้งาน', 'userResponsibility')
                const auditMeasure = pick(row, 'มาตรการตรวจสอบย้อนหลัง', 'auditMeasure')

                const processorAddress = defaultRecordType === 'PROCESSOR'
                    ? pick(row, '2. ที่อยู่ผู้้ควบคุมข้อมูลส่วนบุคคล  ', '2. ที่อยู่ผู้้ควบคุมข้อมูลส่วนบุคคล', 'processorAddress')
                    : null

                allRecords.push({
                    recordType: defaultRecordType,
                    purpose: String(purpose),
                    dataSubject: String(dataSubject),
                    dataCategory: String(dataCategory),
                    processingActivity: processingActivity ? String(processingActivity) : null,
                    personalDataItems: personalDataItems ? String(personalDataItems) : null,
                    dataType: mapEnum(DATA_TYPE_MAP, dataTypeVal, 'GENERAL'),
                    collectionMethod: mapEnum(COLLECTION_MAP, collectionMethodVal, null),
                    sourceDirect,
                    sourceIndirect: sourceIndirect ? String(sourceIndirect) : null,
                    dataSource: pick(row, 'Data Source', 'dataSource', 'วิธีการได้มา') || null,
                    legalBasis: mapEnum(LEGAL_BASIS_MAP, legalBasis, 'CONSENT'),
                    minorConsent: mapEnum(MINOR_CONSENT_MAP, minorConsentVal, 'NONE'),
                    processorAddress: processorAddress ? String(processorAddress) : null,
                    recipient: pick(row, 'Recipient', 'recipient', 'ผู้รับข้อมูล') || null,
                    dataProcessor: pick(row, 'Data Processor', 'dataProcessor', 'ผู้ประมวลผล') || null,
                    transferExists,
                    transferDestination: transferDestination ? String(transferDestination) : null,
                    intraGroupTransfer: intraGroupTransfer ? String(intraGroupTransfer) : null,
                    transferMethod: transferMethod ? String(transferMethod) : null,
                    destinationStandard: destinationStandard ? String(destinationStandard) : null,
                    article28Exception: article28Exception ? String(article28Exception) : null,
                    storageType: storageType ? String(storageType) : null,
                    storageMethod: storageMethod ? String(storageMethod) : null,
                    retentionPeriod: String(retentionPeriod),
                    exerciseOfRights: exerciseOfRights ? String(exerciseOfRights) : null,
                    deletionMethod: deletionMethod ? String(deletionMethod) : null,
                    disclosureExempt: disclosureExempt ? String(disclosureExempt) : null,
                    rightsRejection: rightsRejection ? String(rightsRejection) : null,
                    securityMeasures: pick(row, 'Security Measures', 'securityMeasures', 'มาตรการรักษาความปลอดภัย') || null,
                    organizationalMeasures: organizationalMeasures ? String(organizationalMeasures) : null,
                    technicalMeasures: technicalMeasures ? String(technicalMeasures) : null,
                    physicalMeasures: physicalMeasures ? String(physicalMeasures) : null,
                    accessControl: accessControl ? String(accessControl) : null,
                    userResponsibility: userResponsibility ? String(userResponsibility) : null,
                    auditMeasure: auditMeasure ? String(auditMeasure) : null,
                    riskLevel: mapEnum(RISK_MAP, pick(row, 'Risk Level', 'riskLevel', 'ระดับความเสี่ยง'), 'LOW'),
                    status: 'PENDING_REVIEW',
                    departmentId: req.user.departmentId || null,
                    createdById: req.user.id,
                    importFileId: importFile.id
                })
            }
        }

        if (allRecords.length > 0) {
            const result = await prisma.ropaRecord.createMany({ data: allRecords })
            totalCreated = result.count
        }

        await prisma.importFile.update({
            where: { id: importFile.id },
            data: {
                status: totalCreated > 0 ? 'COMPLETED' : 'FAILED',
                recordCount: totalCreated
            }
        })

        await createAuditLog({
            userId: req.user.id,
            activity: 'CREATE',
            description: `Imported ${totalCreated} ROPA records from "${fileName}"`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.json({
            message: `Import completed: ${totalCreated} records created`,
            importFileId: importFile.id,
            created: totalCreated,
            errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
            skipped: errors.length
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- List import history ----------
exports.listImports = async (req, res) => {
    try {
        const imports = await prisma.importFile.findMany({
            include: { _count: { select: { ropaRecords: true } } },
            orderBy: { createdAt: 'desc' }
        })
        res.json(imports)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// ---------- Export ROPA to Excel ----------
exports.exportExcel = async (req, res) => {
    try {
        const { status, riskLevel, departmentId, recordType } = req.query

        const where = {}
        if (status) where.status = status
        if (riskLevel) where.riskLevel = riskLevel
        if (departmentId) where.departmentId = Number(departmentId)
        if (recordType) where.recordType = recordType

        if (req.user.role.name === 'DataOwner' && req.user.departmentId) {
            where.departmentId = req.user.departmentId
        }

        const records = await prisma.ropaRecord.findMany({
            where,
            include: {
                department: true,
                createdBy: { select: { name: true } },
                updatedBy: { select: { name: true } }
            },
            orderBy: { id: 'asc' }
        })

        const data = records.map(r => ({
            'ID': r.id,
            'Record Type': r.recordType,
            'Purpose': r.purpose,
            'Processing Activity': r.processingActivity || '',
            'Data Subject': r.dataSubject,
            'Personal Data Items': r.personalDataItems || '',
            'Data Category': r.dataCategory,
            'Data Type': r.dataType,
            'Collection Method': r.collectionMethod || '',
            'Source Direct': r.sourceDirect ? 'Yes' : 'No',
            'Source Indirect': r.sourceIndirect || '',
            'Data Source': r.dataSource || '',
            'Legal Basis': r.legalBasis,
            'Minor Consent': r.minorConsent,
            'Processor Address': r.processorAddress || '',
            'Recipient': r.recipient || '',
            'Data Processor': r.dataProcessor || '',
            'Transfer Exists': r.transferExists ? 'Yes' : 'No',
            'Transfer Destination': r.transferDestination || '',
            'Intra-Group Transfer': r.intraGroupTransfer || '',
            'Transfer Method': r.transferMethod || '',
            'Destination Standard': r.destinationStandard || '',
            'Article 28 Exception': r.article28Exception || '',
            'Storage Type': r.storageType || '',
            'Storage Method': r.storageMethod || '',
            'Retention Period': r.retentionPeriod,
            'Exercise of Rights': r.exerciseOfRights || '',
            'Deletion Method': r.deletionMethod || '',
            'Disclosure Exempt': r.disclosureExempt || '',
            'Rights Rejection': r.rightsRejection || '',
            'Security Measures': r.securityMeasures || '',
            'Organizational Measures': r.organizationalMeasures || '',
            'Technical Measures': r.technicalMeasures || '',
            'Physical Measures': r.physicalMeasures || '',
            'Access Control': r.accessControl || '',
            'User Responsibility': r.userResponsibility || '',
            'Audit Measure': r.auditMeasure || '',
            'Risk Level': r.riskLevel,
            'Status': r.status,
            'Department': r.department?.name || '',
            'Created By': r.createdBy?.name || '',
            'Updated By': r.updatedBy?.name || '',
            'Created At': r.createdAt.toISOString(),
            'Updated At': r.updatedAt.toISOString()
        }))

        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'ROPA Records')

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

        await createAuditLog({
            userId: req.user.id,
            activity: 'CREATE',
            description: `Exported ${records.length} ROPA records to Excel`,
            ipAddress: getClientIp(req),
            sensitivity: 'MEDIUM'
        })

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=ROPA_Export_${Date.now()}.xlsx`)
        res.send(buffer)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
