const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2')

const prisma = new PrismaClient();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = { prisma, connection };