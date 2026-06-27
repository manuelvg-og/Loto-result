const axios = require('axios');
const cheerio = require('cheerio');
const pool = require('../config/db');

let memoriaCache = null;
let ultimaActualizacion = 0;
const TIEMPO_CACHE = 15 * 60 * 1000; // 15 minutos de protección

const AXIOS_CONFIG = {
  headers: {
    'User-Agent': 'LottoStatisticsBot/1.0; Canal-Informativo-Legal-Estricto',
    'Accept': 'application/xml,text/xml,text/html'
  },
  timeout: 5000
};

// Función auxiliar para deducir el tipo de lotería basándose en el título o texto del sorteo
function determinarTipoLoteria(texto) {
  const t = texto.toLowerCase();
  if (t.includes('nacional') || t.includes('gana mas') || t.includes('gana más')) {
    return 'Lotería Nacional (Quiniela, Palé, Tripleta)';
  } else if (t.includes('leidsa') || t.includes('loto')) {
    return 'LEIDSA (Sorteo Electrónico)';
  } else if (t.includes('new york') || t.includes('nueva york') || t.includes('ny')) {
    return 'Sorteo Internacional: New York';
  } else if (t.includes('florida')) {
    return 'Sorteo Internacional: Florida';
  } else if (t.includes('loteka')) {
    return 'Loteka (Quiniela Loteka)';
  } else if (t.includes('real')) {
    return 'Loto Real';
  } else if (t.includes('primera')) {
    return 'La Primera';
  } else if (t.includes('lotedom')) {
    return 'LoteDom';
  }
  return 'Sorteo Oficial Autorizado';
}

const obtenerResultados = async (req, res) => {
  const ahora = Date.now();

  if (memoriaCache && (ahora - ultimaActualizacion < TIEMPO_CACHE)) {
    return res.status(200).json(memoriaCache);
  }

  let resultadosEncontrados = [];
  let origenDatos = "en_vivo";

  try {
    console.log("Sincronizando feed oficial con ordenamiento secuencial (1ra, 2da, 3ra)...");
    
    const { data } = await axios.get('https://rss.app', AXIOS_CONFIG);
    const $ = cheerio.load(data, { xmlMode: true });

    $('item').each((index, element) => {
      const textoPublicacion = $(element).find('title').text().trim();
      const fechaSorteo = new Date($(element).find('pubDate').text()).toLocaleDateString('es-DO');

      // Buscamos de forma secuencial grupos de números de dos dígitos separados por guiones, espacios o comas
      // Esto respeta exactamente el orden de impresión del boletín oficial (1ra - 2da - 3ra)
      const regexNumeros = /(\d{2})[-\s,]+(\d{2})[-\s,]+(\d{2})/;
      const coincidencia = textoPublicacion.match(regexNumeros);

      if (coincidencia) {
        // coincidencia[1] = Primera, coincidencia[2] = Segunda, coincidencia[3] = Tercera
        const numerosOrdenados = [coincidencia[1], coincidencia[2], coincidencia[3]];
        
        // Limpiamos el texto original para extraer el nombre limpio de la lotería
        let nombreLimpio = textoPublicacion.replace(regexNumeros, '').replace(/Resultados|Ganadores|Sorteo|:|/gi, '').trim();
        if (!nombreLimpio) nombreLimpio = "Sorteo Tradicional";

        // Clasificamos la lotería según las reglas oficiales dominicanas
        const tipoLoteria = determinarTipoLoteria(textoPublicacion);

        resultadosEncontrados.push({
          nombre: nombreLimpio,
          tipo: tipoLoteria,
          fecha: fechaSorteo,
          numeros: numerosOrdenados
        });
      }
    });

    if (resultadosEncontrados.length === 0) throw new Error("Boletines en proceso de actualización");

  } catch (errorFeed) {
    console.warn("⚠️ Esperando actualización en la red de emisión. Leyendo base de datos Supabase...");
    origenDatos = "base_datos";
  }

  // Operación y guardado persistente en PostgreSQL / Supabase
  try {
    if (origenDatos === "en_vivo" && resultadosEncontrados.length > 0) {
      for (let sorteo of resultadosEncontrados) {
        const numerosString = sorteo.numeros.join(',');
        
        // Modificamos el INSERT para guardar también el Tipo de Lotería en la columna nombre_loteria
        const identificadorUnico = `${sorteo.tipo} - ${sorteo.nombre}`;
        
        await pool.query(
          `INSERT INTO resultados_loteria (nombre_loteria, fecha_sorteo, numeros) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (nombre_loteria, fecha_sorteo) DO NOTHING`,
          [identificadorUnico, sorteo.fecha, numerosString]
        );
      }
    }

    // Solicitamos los últimos 15 sorteos ordenados por ID descendente
    const dbResult = await pool.query(
      'SELECT nombre_loteria as nombre, fecha_sorteo as fecha, numeros FROM resultados_loteria ORDER BY id DESC LIMIT 15'
    );

    const respuestaFinal = {
      origen: origenDatos,
      sorteos: dbResult.rows.map((row, index) => {
        // Separamos el Tipo y el Nombre que guardamos juntos en la base de datos
        const partes = row.nombre.split(' - ');
        return {
          id: index + 1,
          tipo: partes[0] || "Lotería",
          nombre: partes[1] || row.nombre,
          fecha: row.fecha,
          numeros: row.numeros.split(',') // [0]=1ra, [1]=2da, [2]=3ra
        };
      })
    };

    memoriaCache = respuestaFinal;
    ultimaActualizacion = ahora;

    return res.status(200).json(respuestaFinal);

  } catch (dbError) {
    console.error("Error en base de datos Supabase:", dbError.message);
    if (memoriaCache) return res.status(200).json(memoriaCache);
    return res.status(500).json({ error: "Fallo general en la infraestructura" });
  }
};

module.exports = {
  obtenerResultados
};
