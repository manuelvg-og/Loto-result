const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('../config/db');

let memoriaCache = null;
let ultimaActualizacion = 0;
const TIEMPO_CACHE = 5 * 60 * 1000;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ============================================
// HORARIOS REALES DE EMISIÓN
// ============================================
const HORARIOS_EMISION = {
  'Lotería Nacional': '14:30',
  'Gana Más': '14:30',
  'Quiniela Nacional': '21:00',
  'Leidsa': '21:00',
  'Pega 3 Más': '20:55',
  'Super Kino TV': '20:55',
  'Quiniela Pale': '20:55',
  'Loto Mas': '20:55',
  'Super Más': '20:55',
  'Quiniela Real': '12:55',
  'Loto Real': '12:55',
  'Quiniela Loteka': '19:55',
  'Mega Chances': '19:55',
  'Lotedom': '12:00',
  'Quiniela Lotedom': '12:00',
  'Agarra 4': '12:00',
  'La Primera Mediodia': '12:00',
  'La Primera Noche': '20:00',
  'Loto 5': '20:00',
  'La Suerte Dominicana Dia': '12:30',
  'La Suerte Dominicana Noche': '18:00'
};

// ============================================
// CONFIGURACIÓN DE NÚMEROS POR TIPO DE LOTERÍA
// ============================================
const CONFIG_LOTERIAS = {
  'Lotería Nacional': { numeros: 3 },
  'Gana Más': { numeros: 3 },
  'Quiniela Nacional': { numeros: 3 },
  'Leidsa': { numeros: 3 },
  'Pega 3 Más': { numeros: 3 },
  'Super Kino TV': { numeros: 20 },
  'Quiniela Pale': { numeros: 3 },
  'Loto Mas': { numeros: 7 },
  'Super Más': { numeros: 1 },
  'Quiniela Real': { numeros: 3 },
  'Loto Real': { numeros: 6 },
  'Quiniela Loteka': { numeros: 3 },
  'Mega Chances': { numeros: 5 },
  'Lotedom': { numeros: 3 },
  'Quiniela Lotedom': { numeros: 3 },
  'Agarra 4': { numeros: 4 },
  'La Primera Mediodia': { numeros: 3 },
  'La Primera Noche': { numeros: 3 },
  'Loto 5': { numeros: 6 },
  'La Suerte Dominicana Dia': { numeros: 3 },
  'La Suerte Dominicana Noche': { numeros: 3 }
};

function obtenerConfigLoteria(nombre) {
  return CONFIG_LOTERIAS[nombre] || { numeros: 3 };
}

// ============================================
// MAPEO DE NOMBRES ENCONTRADOS → OFICIALES
// ============================================
const MAPEO_NOMBRES = {
  'gana mas': 'Gana Más',
  'gana más': 'Gana Más',
  'nacional': 'Lotería Nacional',
  'loteria nacional': 'Loteria Nacional',
  'leidsa': 'Leidsa',
  'pega 3 mas': 'Pega 3 Más',
  'pega 3 más': 'Pega 3 Más',
  'super kino tv': 'Super Kino TV',
  'quiniela pale': 'Quiniela Pale',
  'loto mas': 'Loto Mas',
  'loto más': 'Loto Mas',
  'super más': 'Super Más',
  'super mas': 'Super Más',
  'quiniela real': 'Quiniela Real',
  'loto real': 'Loto Real',
  'quiniela loteka': 'Quiniela Loteka',
  'mega chances': 'Mega Chances',
  'lotedom': 'Lotedom',
  'quiniela lotedom': 'Quiniela Lotedom',
  'agarra 4': 'Agarra 4',
  'la primera mediodia': 'La Primera Mediodia',
  'la primera noche': 'La Primera Noche',
  'loto 5': 'Loto 5',
  'la suerte dominicana dia': 'La Suerte Dominicana Dia',
  'la suerte dominicana noche': 'La Suerte Dominicana Noche'
};

function normalizarNombre(nombre) {
  if (!nombre) return null;
  const limpio = nombre.toLowerCase().trim();
  
  if (MAPEO_NOMBRES[limpio]) {
    return MAPEO_NOMBRES[limpio];
  }
  
  for (const [alias, oficial] of Object.entries(MAPEO_NOMBRES)) {
    if (limpio.includes(alias) || alias.includes(limpio)) {
      return oficial;
    }
  }
  
  return null;
}

// ============================================
// FUNCIONES DE FECHA Y HORA (CORREGIDAS)
// ============================================

// Obtiene la fecha actual en zona horaria de Santo Domingo
function obtenerFechaActualSD() {
  const ahora = new Date();
  const fechaStr = ahora.toLocaleString("en-US", { timeZone: "America/Santo_Domingo" });
  return new Date(fechaStr);
}

function obtenerFechaISO() {
  const fechaSD = obtenerFechaActualSD();
  const año = fechaSD.getFullYear();
  const mes = String(fechaSD.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaSD.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function obtenerFechaFormateada(fechaISO) {
  if (!fechaISO) {
    const fechaSD = obtenerFechaActualSD();
    return fechaSD.toLocaleDateString('es-DO', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  // Crear fecha con hora 12:00 para evitar problemas de zona horaria
  const [año, mes, dia] = fechaISO.split('-');
  const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia), 12, 0, 0);
  
  return fecha.toLocaleDateString('es-DO', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function obtenerHoraActual() {
  const fechaSD = obtenerFechaActualSD();
  const horas = String(fechaSD.getHours()).padStart(2, '0');
  const minutos = String(fechaSD.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

// ✅ FUNCIÓN AGREGADA - Convierte hora 24h a 12h
function formatearHora12(hora24) {
  if (!hora24) return '8:00 PM';
  
  const partes = hora24.split(':');
  const horas = parseInt(partes[0]);
  const minutos = partes[1] || '00';
  
  const ampm = horas >= 12 ? 'PM' : 'AM';
  const horas12 = horas % 12 || 12;
  
  return `${horas12}:${minutos} ${ampm}`;
}

// ============================================
// EXTRACCIÓN ESPECÍFICA PARA LOTERIASDOMINICANAS.COM.DO
// ============================================
function extraerDeLoteriasDominicanas($) {
  const loterias = new Map();
  
  const elementos = $('*').filter(function() {
    const texto = $(this).text();
    return texto.match(/\d{2}\s*1ro/) || texto.match(/\d{2}\s*2do/);
  });
  
  elementos.each((i, el) => {
    const $el = $(el);
    const textoCompleto = $el.text();
    
    const match = textoCompleto.match(/([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)\s+(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/i);
    
    if (match) {
      const nombreOriginal = match[1].trim();
      const numeros = [match[2], match[3], match[4]];
      const nombreOficial = normalizarNombre(nombreOriginal);
      
      if (nombreOficial && !loterias.has(nombreOficial)) {
        const config = obtenerConfigLoteria(nombreOficial);
        loterias.set(nombreOficial, {
          nombre: nombreOficial,
          fecha: obtenerFechaISO(),
          numeros: numeros.slice(0, config.numeros),
          cantidadNumeros: config.numeros,
          hora: HORARIOS_EMISION[nombreOficial] || '20:00'
        });
        
        console.log(`✅ Extraído: ${nombreOficial} → ${numeros.join('-')}`);
      }
    }
  });
  
  if (loterias.size < 5) {
    const bodyText = $('body').text();
    
    const patrones = [
      { nombre: 'Gana Más', regex: /Gana\s+Mas\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'Loteria Nacional', regex: /Loteria\s+Nacional\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'Pega 3 Más', regex: /Pega\s+3\s+Mas\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'Quiniela Pale', regex: /Quiniela\s+Pale\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'Quiniela Real', regex: /Quiniela\s+Real\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'Quiniela Loteka', regex: /Quiniela\s+Loteka\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'Quiniela Lotedom', regex: /Quiniela\s+Lotedom\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'La Primera Mediodia', regex: /La\s+Primera\s+Mediodia\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'La Primera Noche', regex: /La\s+Primera\s+Noche\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'La Suerte Dominicana Dia', regex: /La\s+Suerte\s+Dominicana\s+Dia\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is },
      { nombre: 'La Suerte Dominicana Noche', regex: /La\s+Suerte\s+Dominicana\s+Noche\s+.*?(\d{2})\s*1ro\s+(\d{2})\s*2do\s+(\d{2})\s*3ro/is }
    ];
    
    for (const patron of patrones) {
      if (!loterias.has(patron.nombre)) {
        const match = bodyText.match(patron.regex);
        if (match) {
          const numeros = [match[1], match[2], match[3]];
          const config = obtenerConfigLoteria(patron.nombre);
          
          loterias.set(patron.nombre, {
            nombre: patron.nombre,
            fecha: obtenerFechaISO(),
            numeros: numeros.slice(0, config.numeros),
            cantidadNumeros: config.numeros,
            hora: HORARIOS_EMISION[patron.nombre] || '20:00'
          });
          
          console.log(`✅ Patrón: ${patron.nombre} → ${numeros.join('-')}`);
        }
      }
    }
  }
  
  return Array.from(loterias.values());
}

// ============================================
// CONSULTAR FUENTE
// ============================================
async function consultarFuente() {
  try {
    console.log('\n🔍 Consultando Loterías Dominicanas...');
    console.log('   URL: https://loteriasdominicanas.com.do/');
    
    const { data } = await axios.get('https://loteriasdominicanas.com.do/', {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-DO,es;q=0.9'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(data);
    const loterias = extraerDeLoteriasDominicanas($);
    
    if (loterias.length > 0) {
      console.log(`✅ Total: ${loterias.length} loterías encontradas`);
      return loterias;
    }
    
    console.log('⚠️ No se encontraron números válidos');
    return [];
  } catch (err) {
    console.warn(`⚠️ Error: ${err.message}`);
    return [];
  }
}

// ============================================
// CONTROLADOR PRINCIPAL
// ============================================
const obtenerResultados = async (req, res) => {
  const ahora = Date.now();
  const horaActual = obtenerHoraActual();
  const hoy = obtenerFechaISO();

  if (memoriaCache && (ahora - ultimaActualizacion < TIEMPO_CACHE)) {
    return res.status(200).json(memoriaCache);
  }

  let origenDatos = "en_vivo";
  let resultadosEncontrados = [];

  console.log(`\n🕐 Hora actual: ${horaActual}`);
  console.log('🔄 Buscando loterías oficiales...\n');

  try {
    resultadosEncontrados = await consultarFuente();

    if (resultadosEncontrados.length === 0) {
      throw new Error("No se pudieron obtener resultados");
    }

  } catch (error) {
    console.warn('\n⚠️ Fuentes no disponibles. Usando base de datos...');
    origenDatos = "base_datos";
  }

  try {
    if (origenDatos === "en_vivo" && resultadosEncontrados.length > 0) {
      for (const loteria of resultadosEncontrados) {
        const numerosString = loteria.numeros.join(',');
        
        await pool.query(
          `INSERT INTO resultados_loteria (nombre_loteria, fecha_sorteo, numeros, cantidad_numeros) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (nombre_loteria, fecha_sorteo) DO UPDATE SET numeros = $3, cantidad_numeros = $4`,
          [loteria.nombre, loteria.fecha, numerosString, loteria.cantidadNumeros || 3]
        );
      }
    }

    const dbResult = await pool.query(
      `SELECT nombre_loteria as nombre, fecha_sorteo as fecha, numeros, cantidad_numeros 
       FROM resultados_loteria 
       ORDER BY 
         CASE WHEN fecha_sorteo = $1 THEN 0 ELSE 1 END,
         fecha_sorteo DESC,
         id DESC 
       LIMIT 30`,
      [hoy]
    );

    const sorteos = dbResult.rows.map((row, index) => {
      const fechaISO = row.fecha instanceof Date 
        ? row.fecha.toISOString().split('T')[0] 
        : row.fecha;
      
      const horaEmision24 = HORARIOS_EMISION[row.nombre] || '20:00';
      const horaEmision = formatearHora12(horaEmision24);
      const cantidadNumeros = row.cantidad_numeros || 3;
      
      return {
        id: index + 1,
        tipo: row.nombre,
        nombre: row.nombre,
        fecha: fechaISO,
        fechaISO: fechaISO,
        hora: horaEmision,
        hora24: horaEmision24,
        numeros: row.numeros.split(','),
        cantidadNumeros: cantidadNumeros,
        esHoy: fechaISO === hoy
      };
    });

    const respuestaFinal = {
      origen: origenDatos,
      horaActual: horaActual,
      totalLoterias: resultadosEncontrados.length,
      sorteos: sorteos
    };

    memoriaCache = respuestaFinal;
    ultimaActualizacion = ahora;

    return res.status(200).json(respuestaFinal);

  } catch (dbError) {
    console.error('Error en base de datos:', dbError.message);
    if (memoriaCache) return res.status(200).json(memoriaCache);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { obtenerResultados };