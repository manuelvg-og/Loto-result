let cargandoActivo = false;

document.addEventListener("DOMContentLoaded", () => {
  cargarSorteos();
  setInterval(cargarSorteos, 5 * 60 * 1000);
});

async function cargarSorteos() {
  if (cargandoActivo) return;
  cargandoActivo = true;
  const grid = document.getElementById("sorteos-grid");

  try {
    const res = await fetch("/api/resultados");
    if (!res.ok) throw new Error("Error de red");
    
    const data = await res.json();
    grid.innerHTML = "";

    // Info bar - ocupa todo el ancho
    const infoBar = document.createElement("div");
    infoBar.className = "badge";
    infoBar.style.cssText = "background:#f1f5f9; padding:0.75rem 1rem; width:100%; text-align:center; font-size:0.85rem; border:1px solid #e2e8f0; border-radius:8px;";
    infoBar.innerHTML = `🕐 Actualizado: ${data.horaActual} | <strong>${data.totalLoterias}</strong> sorteos disponibles`;
    grid.appendChild(infoBar);

    const sorteosFiltrados = filtrarSorteos(data.sorteos);

    sorteosFiltrados.forEach((sorteo, index) => {
      const card = crearTarjeta(sorteo, index);
      grid.appendChild(card);
    });

    if (sorteosFiltrados.length === 0) {
      grid.innerHTML = `<p class="loading-text">No hay resultados disponibles por el momento.</p>`;
    }
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="loading-text" style="color:#ef4444;">Error al cargar resultados. Reintenta en unos minutos.</p>`;
  } finally {
    cargandoActivo = false;
  }
}

function filtrarSorteos(sorteos) {
  const vistos = new Set();
  return sorteos.filter(s => {
    const nombreLower = s.nombre.toLowerCase();
    
    if (nombreLower.includes('palé') || nombreLower.includes('pale')) {
      return false;
    }
    
    const key = `${s.nombre}-${s.fecha}`;
    if (vistos.has(key)) return false;
    
    vistos.add(key);
    return true;
  });
}

function crearTarjeta(sorteo, index) {
  const card = document.createElement("div");
  card.className = "lottery-card";
  card.style.animationDelay = `${index * 0.05}s`;

  const esHoy = sorteo.esHoy;
  const hora = sorteo.hora || '8:00 PM';
  const colores = obtenerColoresLoteria(sorteo.nombre);
  
  const cantidadNumeros = sorteo.cantidadNumeros || 3;
  const numeros = sorteo.numeros.slice(0, cantidadNumeros);

  card.innerHTML = `
    <div class="card-top">
      <h2 class="lottery-name">${sorteo.nombre}</h2>
      <div class="meta-badges">
        <span class="badge time">🕒 ${hora}</span>
        ${esHoy ? '<span class="badge today">HOY</span>' : ''}
        <span class="badge">${sorteo.fecha}</span>
      </div>
    </div>
    <div class="numbers-row">
      ${numeros.map((num, i) => `
        <div class="number-wrapper">
          <div class="number-ball" style="background:${colores.ball}">${num.padStart(2, '0')}</div>
          <span class="number-label">${obtenerLabelNumero(i, cantidadNumeros)}</span>
        </div>
      `).join('')}
    </div>
  `;
  return card;
}

function obtenerLabelNumero(index, total) {
  const labels = {
    1: ['1ro'],
    2: ['1ro', '2do'],
    3: ['1ro', '2do', '3ro'],
    4: ['1ro', '2do', '3ro', '4to'],
    5: ['1ro', '2do', '3ro', '4to', '5to']
  };
  return labels[total]?.[index] || `${index + 1}°`;
}

function obtenerColoresLoteria(nombre) {
  const n = nombre.toLowerCase();
  if (n.includes('nacional') || n.includes('gana')) return { ball: 'linear-gradient(145deg, #3b82f6, #1d4ed8)' };
  if (n.includes('leidsa')) return { ball: 'linear-gradient(145deg, #8b5cf6, #6d28d9)' };
  if (n.includes('loteka')) return { ball: 'linear-gradient(145deg, #10b981, #047857)' };
  if (n.includes('real')) return { ball: 'linear-gradient(145deg, #f59e0b, #b45309)' };
  if (n.includes('lotedom')) return { ball: 'linear-gradient(145deg, #06b6d4, #0e7490)' };
  return { ball: 'linear-gradient(145deg, #ef4444, #b91c1c)' };
}