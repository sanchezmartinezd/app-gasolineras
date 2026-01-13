import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";

// Opciones de carburante
const FUEL_OPTIONS = [
  { id: "G95", label: "Gasolina 95 E5", apiKey: "Precio Gasolina 95 E5" },
  { id: "DIESEL", label: "Gasóleo A", apiKey: "Precio Gasoleo A" },
];

// --- HORARIOS: "¿abierta al llegar?"

const DAY_ORDER = ["L", "M", "X", "J", "V", "S", "D"]; 

function dayLetterFromDate(date) {
  // JS: 0=Domingo,1=Lunes,...6=Sábado
  const map = ["D", "L", "M", "X", "J", "V", "S"];
  return map[date.getDay()];
}

function timeToMinutes(hhmm) {
  // Acepta "06:30" o "24:00"
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  if (h === 24 && m === 0) return 1440;
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

function daySpecMatches(daySpec, dayLetter) {
  const spec = daySpec.replace(/\s/g, "").toUpperCase();

  if (spec.length === 1) return spec === dayLetter;

  const parts = spec.split("-");
  if (parts.length !== 2) return false;

  const start = parts[0];
  const end = parts[1];

  const iStart = DAY_ORDER.indexOf(start);
  const iEnd = DAY_ORDER.indexOf(end);
  const iDay = DAY_ORDER.indexOf(dayLetter);

  if (iStart === -1 || iEnd === -1 || iDay === -1) return false;

  
  if (iStart <= iEnd) return iDay >= iStart && iDay <= iEnd;

  
  return iDay >= iStart || iDay <= iEnd;
}

function isOpenAt(scheduleStr, date) {
  if (!scheduleStr) return null;

  const s = String(scheduleStr).toUpperCase().trim();

  
  if (s.includes("24H") || s.includes("24 H")) return true;
  if (s.includes("CERR")) return false; 

  const day = dayLetterFromDate(date);
  const t = date.getHours() * 60 + date.getMinutes();

  
  const parts = s.split(";").map((p) => p.trim()).filter(Boolean);

  
  const segments = parts.length > 0 ? parts : [s];

  let foundForDay = false;
  let openForDay = false;

  for (const seg of segments) {
    
    const m = seg.match(/^([LMXJVSD](?:\s*-\s*[LMXJVSD])?)\s*:\s*(.*)$/);
    if (!m) continue;

    const daySpec = m[1];
    const rest = m[2];

    if (!daySpecMatches(daySpec, day)) continue;

    foundForDay = true;

    if (rest.includes("24H") || rest.includes("24 H")) return true;
    if (rest.includes("CERR")) continue; // cerrado ese día

    // Extraer uno o varios rangos HH:MM-HH:MM
    const ranges = [...rest.matchAll(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g)];
    for (const r of ranges) {
      const start = timeToMinutes(r[1]);
      const end = timeToMinutes(r[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

      // Caso normal: 07:00-23:00
      if (start <= end) {
        if (t >= start && t < end) openForDay = true;
      } else {
        // Caso nocturno: 22:00-06:00 (o 06:00-00:00 donde end=0)
        if (t >= start || t < end) openForDay = true;
      }
    }
  }

  if (!foundForDay) return null; // no sabemos interpretarlo
  return openForDay;
}


function toNumber(value) {
  // Convierte "39,211417" -> 39.211417
  if (value === null || value === undefined) return NaN;
  const s = String(value).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function SearchForm({
  coords,
  setCoords,
  onSearch,
  onDetectLocation,
  loading,
  radiusKm,
  setRadiusKm,
  fuelId,
  setFuelId,
  brandMode,
  setBrandMode,
  brandsText,
  setBrandsText,
  orderBy,
  setOrderBy,
  speedKmH,
  setSpeedKmH,
  onClearFilters,
}) {
  return (
    <section className="card">
      <h2>Entrada</h2>

      <div className="row">
        <button className="btn" onClick={onDetectLocation} disabled={loading}>
          Usar mi ubicación
        </button>

        <button className="btn" onClick={onSearch} disabled={loading}>
          Buscar gasolineras cercanas a mí
        </button>

        <button className="btn" onClick={onClearFilters} disabled={loading}>
          Limpiar filtros
        </button>

      </div>

      <div className="grid">
        <label>
          Latitud
          <input
            placeholder="Ej: 40.4168"
            value={coords.lat}
            onChange={(e) => setCoords({ ...coords, lat: e.target.value })}
          />
        </label>

        <label>
          Longitud
          <input
            placeholder="Ej: -3.7038"
            value={coords.lon}
            onChange={(e) => setCoords({ ...coords, lon: e.target.value })}
          />
        </label>
      </div>

      <div className="grid">
        <label>
          Radio (km)
          <input
            placeholder="Ej: 10"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
          />
        </label>

        <label>
          Carburante
          <select value={fuelId} onChange={(e) => setFuelId(e.target.value)}>
            {FUEL_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      
            <div className="grid">
        <label>
          Velocidad media (km/h)
          <input
            placeholder="Ej: 50"
            value={speedKmH}
            onChange={(e) => setSpeedKmH(e.target.value)}
          />
        </label>
      </div>


      <div className="grid">
        <label>
          Filtro de marcas
          <select
            value={brandMode}
            onChange={(e) => setBrandMode(e.target.value)}
          >
            <option value="none">No filtrar</option>
            <option value="include">Incluir solo estas</option>
            <option value="exclude">Excluir estas</option>
          </select>
        </label>

        <label>
          Marcas (separadas por comas)
          <input
            placeholder="Ej: REPSOL, SHELL, PLENERGY"
            value={brandsText}
            onChange={(e) => setBrandsText(e.target.value)}
          />
        </label>
      </div>

            <div className="grid">
        <label>
          Ordenar resultados por
          <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)}>
            <option value="distance">Distancia</option>
            <option value="price">Precio</option>
          </select>
        </label>

      </div>


    </section>
  );
}

function StatusMessage({ loading, loadingText, error, info }) {
  if (loading) return <div className="status">⏳ {loadingText}</div>;
  if (error) return <div className="status error">❌ Error: {error}</div>;
  if (info) return <div className="status">ℹ️ {info}</div>;
  return null;
}

function Highlights({ nearest, cheapest }) {
  if (!nearest && !cheapest) return null;

  return (
    <section className="card">
      <h2>Destacados</h2>
      <div className="highlights">
        <div className="highlight">
          <div className="highlight-title">Más cercana</div>
          {nearest ? (
            <>
              <div>{nearest.name}</div>
              <div className="hint">
                {nearest.distanceKm} km — {nearest.price} €/L
              </div>
            </>
          ) : (
            <div className="hint">No disponible</div>
          )}
        </div>

        <div className="highlight">
          <div className="highlight-title">Más barata (en el radio)</div>
          {cheapest ? (
            <>
              <div>{cheapest.name}</div>
              <div className="hint">
                {cheapest.price} €/L — {cheapest.distanceKm} km
              </div>
            </>
          ) : (
            <div className="hint">No disponible</div>
          )}
        </div>
      </div>
    </section>
  );
}

function StationCard({ station }) {
  return (
    <div className="station">
      <div className="station-title">{station.name}</div>
      <div className="station-row">Dirección: {station.address}</div>
      <div className="station-row">Precio: {station.price} €/L</div>
      <div className="station-row">Distancia: {station.distanceKm} km</div>
      <div className="station-row">Horario: {station.schedule}</div>
            <div className="station-row">
        Llegada estimada: {station.arrivalTime} (+{station.etaMinutes} min)
      </div>

      <div className="station-row">
        Abierta al llegar:{" "}
        {station.openAtArrival === true
          ? "Sí"
          : station.openAtArrival === false
          ? "No"
          : "Desconocido"}
      </div>

    </div>
  );
}

function ResultsList({ stations }) {
  return (
    <section className="card">
      <h2>Resultados</h2>

      {stations.length === 0 ? (
        <p className="hint">Aún no hay resultados. Pulsa “Buscar”.</p>
      ) : (
        <div className="list">
          {stations.map((s) => (
            <StationCard key={s.id} station={s} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [coords, setCoords] = useState({ lat: "", lon: "" });

  const [radiusKm, setRadiusKm] = useState("10");
  const [fuelId, setFuelId] = useState("G95");

  const [speedKmH, setSpeedKmH] = useState("50"); // velocidad media (km/h)


  const [brandMode, setBrandMode] = useState("none"); // none | include | exclude
  const [brandsText, setBrandsText] = useState("");   // texto tipo "REPSOL, SHELL"

  const [orderBy, setOrderBy] = useState("distance"); // distance | price


  const [stations, setStations] = useState([]);
  const [nearest, setNearest] = useState(null);
  const [cheapest, setCheapest] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(
    "Permite ubicación automática o escribe lat/lon. Luego pulsa Buscar."
  );

  const detectLocation = useCallback(() => {
    setError(null);

    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización.");
      return;
    }

    setLoading(true);
    setLoadingText("Obteniendo tu ubicación… (mira el aviso del navegador)");
    setInfo(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);

        setCoords({ lat, lon });
        setLoading(false);
        setLoadingText("");
        setInfo("Ubicación detectada. Ya puedes buscar.");
      },
      (err) => {
        let msg = "No se pudo obtener la ubicación.";
        if (err.code === 1) msg = "Has denegado el permiso de ubicación.";
        if (err.code === 2) msg = "No se puede determinar tu ubicación ahora.";
        if (err.code === 3) msg = "Tiempo agotado intentando obtener ubicación.";

        setLoading(false);
        setLoadingText("");
        setError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  async function onSearch() {
    setError(null);
    setInfo(null);
    setStations([]);
    setNearest(null);
    setCheapest(null);

    const userLat = toNumber(coords.lat);
    const userLon = toNumber(coords.lon);
    const rKm = Number(radiusKm);

    const speed = Number(speedKmH);
    if (!Number.isFinite(speed) || speed <= 0) {
      setError("Velocidad inválida. Pon un número mayor que 0.");
      return;
    }

    if (!Number.isFinite(userLat) || !Number.isFinite(userLon)) {
      setError("Latitud/Longitud inválidas. Usa números (punto o coma).");
      return;
    }
    if (!Number.isFinite(rKm) || rKm <= 0) {
      setError("Radio inválido. Pon un número mayor que 0.");
      return;
    }

    const fuel = FUEL_OPTIONS.find((f) => f.id === fuelId) ?? FUEL_OPTIONS[0];

    setLoading(true);
    setLoadingText("Descargando datos…");

    try {
      const url =
        "/api-carburantes/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";

      const res = await fetch(url, { headers: { Accept: "application/json" } });

      if (!res.ok) {
        throw new Error(`La API respondió con error (HTTP ${res.status}).`);
      }

      // Leemos como texto y luego intentamos convertir a JSON
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "La respuesta no parece JSON (quizá te llegó XML). Prueba a reiniciar npm run dev y vuelve a intentar."
        );
      }

      const list = Array.isArray(data?.ListaEESSPrecio) ? data.ListaEESSPrecio : [];

      setLoadingText("Calculando distancias y filtrando…");

      const results = [];

      for (const item of list) {
        const lat = toNumber(item?.Latitud);
        const lon = toNumber(item?.["Longitud (WGS84)"]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const priceNum = toNumber(item?.[fuel.apiKey]);
        if (!Number.isFinite(priceNum)) continue;

        const dist = haversineKm(userLat, userLon, lat, lon);
        if (!Number.isFinite(dist) || dist > rKm) continue;

        const etaMinutes = Math.round((dist / speed) * 60);
        const arrivalDate = new Date(Date.now() + etaMinutes * 60 * 1000);
        const openAtArrival = isOpenAt(item?.Horario, arrivalDate);


        results.push({
          id: item?.IDEESS ?? `${lat},${lon}`,
          name: item?.["Rótulo"] || "Sin rótulo",
          address: `${item?.["Dirección"] || ""}, ${item?.Municipio || ""} (${item?.Provincia || ""})`,
          schedule: item?.Horario || "No disponible",
          priceValue: priceNum,
          price: priceNum.toFixed(3),
          distanceKmValue: dist,
          distanceKm: dist.toFixed(2),

          etaMinutes,
          arrivalTime: arrivalDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          openAtArrival, // true / false / null

        });
      }

      //  FILTRO POR MARCAS (include / exclude)
      const brands = brandsText
        .split(",")
        .map((b) => b.trim().toUpperCase())
        .filter((b) => b.length > 0);

      let filtered = results;

      if (brandMode !== "none" && brands.length > 0) {
        if (brandMode === "include") {
          filtered = results.filter((s) => brands.includes(s.name.toUpperCase()));
        }
        if (brandMode === "exclude") {
          filtered = results.filter((s) => !brands.includes(s.name.toUpperCase()));
        }
      }



      // Ordenar por cercanía
      filtered.sort((a, b) => a.distanceKmValue - b.distanceKmValue);
      const toShow = filtered.slice(0, 30);

      setStations(toShow);
      setNearest(toShow[0] ?? null);

      const cheapestStation = filtered.reduce((best, cur) => {
        if (!best) return cur;
        return cur.priceValue < best.priceValue ? cur : best;
      }, null);
      setCheapest(cheapestStation);

      setInfo(
       `Encontradas ${filtered.length} gasolineras en ${rKm} km con ${fuel.label}. Mostrando ${toShow.length}.`
      );
    } catch (e) {
      setError(e?.message || "Error desconocido.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  }

    function clearFilters() {
    // 1) Quitamos errores/mensajes de carga
    setError(null);
    setLoading(false);
    setLoadingText("");

    // 2) Reseteamos filtros a valores por defecto
    setRadiusKm("10");
    setFuelId("G95");

    setBrandMode("none");
    setBrandsText("");

    setOrderBy("distance");
    setSpeedKmH("50");

    // 3) Vaciamos resultados y destacados
    setStations([]);
    setNearest(null);
    setCheapest(null);

    // 4) Mensaje para el usuario
    setInfo("Filtros limpiados. Ya puedes buscar de nuevo.");
  }


  // Auto-ubicación al abrir
  const didAutoLocate = useRef(false);
  useEffect(() => {
    if (didAutoLocate.current) return;
    didAutoLocate.current = true;

    const id = setTimeout(() => detectLocation(), 0);
    return () => clearTimeout(id);
  }, [detectLocation]);

  return (
    <div className="page">
      <h1>Buscador de gasolineras</h1>

      <SearchForm
        coords={coords}
        setCoords={setCoords}
        onSearch={onSearch}
        onDetectLocation={detectLocation}
        loading={loading}
        radiusKm={radiusKm}
        setRadiusKm={setRadiusKm}
        fuelId={fuelId}
        setFuelId={setFuelId}
        brandMode={brandMode}
        setBrandMode={setBrandMode}
        brandsText={brandsText}
        setBrandsText={setBrandsText}
        orderBy={orderBy}
        setOrderBy={setOrderBy}
        speedKmH={speedKmH}
        setSpeedKmH={setSpeedKmH}
        onClearFilters={clearFilters}

      />

      <StatusMessage
        loading={loading}
        loadingText={loadingText}
        error={error}
        info={info}
      />

      <Highlights nearest={nearest} cheapest={cheapest} />

      <ResultsList stations={stations} />
    </div>
  );
}
