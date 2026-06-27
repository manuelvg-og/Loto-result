let cargandoSorteosActivo = false;

document.addEventListener("DOMContentLoaded", () => {
  cargarSorteos();
});

async function cargarSorteos() {
  if (cargandoSorteosActivo) return;
  cargandoSorteosActivo = true;

  const gridContainer = document.getElementById("sorteos-grid");

  try {
    const respuesta = await fetch("/api/resultados");
    
    if (!respuesta.ok) {
      throw new Error("Error en la respuesta de la red");
    }

    const data = await respuesta.json();
    gridContainer.innerHTML = ""; 

    if (data.origen === "base_datos") {
      const alertaHtml = document.createElement("div");
      alertaHtml.style.cssText = "background-color: #fffae6; border: 1px solid #ffe58f; color: #d46b08; padding: 1rem; border-radius: 6px; text-align: center; margin-bottom: 1rem; font-weight: 500; font-size: 0.9rem;";
      alertaHtml.innerHTML = "⚠️ Los servidores oficiales de lotería están experimentando retrasos de red. Mostrando historial de sorteos guardados.";
      gridContainer.appendChild(alertaHtml);
    }

    data.sorteos.forEach(sorteo => {
      const tarjeta = document.createElement("div");
      tarjeta.className = "lottery-card";

      // Mapeamos las esferas inyectando subtítulos para indicar cuál es 1ra, 2da y 3ra
      let esferasHTML = "";
      const etiquetasPremios = ["1ra", "2da", "3ra"];
      
      sorteo.numeros.forEach((numero, index) => {
        const etiqueta = etiquetasPremios[index] || `${index + 1}°`;
        esferasHTML += `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div class="lottery-ball">${numero}</div>
            <span style="font-size: 11px; color: #666; font-weight: 600;">${etiqueta}</span>
          </div>
        `;
      });

      tarjeta.innerHTML = `
        <div class="card-header" style="flex-direction: column; align-items: flex-start; gap: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: #e02424; text-transform: uppercase; letter-spacing: 0.5px;">${sorteo.tipo}</span>
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
              <h2 style="font-size: 1.3rem;">${sorteo.nombre}</h2>
              <span class="date-badge">${sorteo.fecha}</span>
            </div>
        </div>
        <div class="balls-container" style="gap: 1.5rem; padding-top: 0.5rem;">
            ${esferasHTML}
        </div>
      `;

      gridContainer.appendChild(tarjeta);
    });

  } catch (error) {
    console.error("Fallo al consumir API:", error);
    gridContainer.innerHTML = `
      <p style="color: red; text-align: center; font-weight: bold; padding: 2rem;">
        ❌ No se pudieron sincronizar los resultados. Por favor, refresca la página en unos minutos.
      </p>
    `;
  } finally {
    cargandoSorteosActivo = false;
  }
}
