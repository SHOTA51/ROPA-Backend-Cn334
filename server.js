require('dotenv').config()
const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')

const { readdirSync } = require('fs')

app.use(morgan('dev'))
app.use(express.json())
app.use(cors())

// Auto-load all route files from ./routes
readdirSync('./routes')
    .filter((item) => item.endsWith('.js'))
    .map((item) => app.use('/api', require('./routes/' + item)))

app.listen(5000, () =>
    console.log('Server Running on port 5000'))
