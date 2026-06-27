const { Pool } = require('pg');

const pool = new Pool({
  host: '://supabase.com',
  port: 6543,
  user: 'postgres.yqufltzfrgchkzikbbmp',
  password: '5422000mv54mv',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()')
  .then(() => console.log('✅ Conexión exitosa a Supabase'))
  .catch(err => console.error('❌ Conexión fallida:', err.message));

module.exports = pool;
