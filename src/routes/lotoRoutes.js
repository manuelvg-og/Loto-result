const express = require('express');
const router = express.Router();
const lotoController = require('../controllers/lotoController');

router.get('/api/resultados', lotoController.obtenerResultados);

module.exports = router;