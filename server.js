require('dotenv').config()
const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')

const { readdirSync } = require('fs')

app.use(morgan('dev'))
app.use(express.json())
app.use(cors({
  origin: 'https://vercel.app'
}))

// Auto-load all route files from ./routes
readdirSync('./routes')
    .filter((item) => item.endsWith('.js'))
    .map((item) => app.use('/api', require('./routes/' + item)))

const PORT = process.env.PORT || 5000

app.listen(PORT,'0.0.0.0', () =>
    console.log(`Server Running on port ${PORT}`))
