const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()')
    .then(() => console.log('✅ Conexión exitosa a Supabase'))
    .catch(err => console.error('❌ Conexión fallida:', err.message));

module.exports = pool;
