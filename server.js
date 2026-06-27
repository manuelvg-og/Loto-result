require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const lotoRoutes = require('./src/routes/lotoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', lotoRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

app.listen(PORT, () => {
  console.log(`💻 Servidor de Loterías corriendo en http://localhost:${PORT}`);
});

module.exports = app;
