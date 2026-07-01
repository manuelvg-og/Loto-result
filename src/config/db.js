require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está definida en .env');
  process.exit(1);
}

console.log('🔍 Conectando a Supabase...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  family: 4,
  max: 10,
  connectionTimeoutMillis: 10000
});

pool.query('SELECT NOW()')
  .then((result) => {
    console.log('✅ Conexión exitosa a Supabase');
    console.log(' Hora del servidor:', result.rows[0].now);
  })
  .catch(err => {
    console.error('❌ Conexión fallida:', err.message);
    console.error('🔍 Código de error:', err.code);
  });

module.exports = pool;