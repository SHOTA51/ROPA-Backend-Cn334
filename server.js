require('dotenv').config()
const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')

const { readdirSync } = require('fs')

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL
].filter(Boolean)

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true)
        return callback(new Error('Not allowed by CORS: ' + origin))
    },
    credentials: true,
    optionsSuccessStatus: 200
}

app.use(morgan('dev'))
app.use(express.json())
app.use(cors(corsOptions))


// Auto-load all route files from ./routes
readdirSync('./routes')
    .filter((item) => item.endsWith('.js'))
    .map((item) => app.use('/api', require('./routes/' + item)))

const PORT = process.env.PORT || 5000

app.listen(PORT,'0.0.0.0', () =>
    console.log(`Server Running on port ${PORT}`))
