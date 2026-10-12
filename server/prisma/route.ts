// Recorrido real por la ciudad de Ypacaraí, EN ORDEN geográfico (tal como se
// recorre). Los equipos reciben un subconjunto aleatorio de estas postas, pero
// SIEMPRE ordenadas según esta lista para no ir y volver por el mismo tramo.
export type RoutePoint = { name: string; latitude: number; longitude: number };

export const ROUTE: RoutePoint[] = [
  { name: "Ruta PY02 1", latitude: -25.42019689658079, longitude: -57.293242316652325 },
  { name: "Ruta PY02 2", latitude: -25.417155759670393, longitude: -57.294598890604206 },
  { name: "Ruta PY02 3", latitude: -25.41339252405913, longitude: -57.29226291189915 },
  { name: "Ruta PY02 4", latitude: -25.411967483931193, longitude: -57.29137946095978 },
  { name: "Ruta PY02 5", latitude: -25.410773144435932, longitude: -57.290027706503984 },
  { name: "Copetrol 1", latitude: -25.409472377445898, longitude: -57.29035251636475 },
  { name: "Copetrol 2", latitude: -25.409197713903186, longitude: -57.29041122457035 },
  { name: "Supermercado 1", latitude: -25.40763829632697, longitude: -57.290223068510926 },
  { name: "Centro 1", latitude: -25.4061769610061, longitude: -57.28825761326209 },
  { name: "Cooperativa 1", latitude: -25.405990335827017, longitude: -57.28644980991472 },
  { name: "Ferrocarril 1", latitude: -25.404783930431293, longitude: -57.28695156756665 },
  { name: "Ferrocarril 2", latitude: -25.404419562518143, longitude: -57.28661460286067 },
  { name: "Ferrocarril 3", latitude: -25.403517525031322, longitude: -57.28700075950143 },
  { name: "Ferrocarril 4", latitude: -25.403428653971307, longitude: -57.28739921411802 },
  { name: "Ferrocarril 5", latitude: -25.40323758098864, longitude: -57.28736969896229 },
  { name: "Ferrocarril 6", latitude: -25.40306428197522, longitude: -57.286973703956214 },
  { name: "Ferrocarril 7", latitude: -25.402682134547938, longitude: -57.28689991605747 },
  { name: "Ferrocarril 8", latitude: -25.402608815423196, longitude: -57.286530976603935 },
  { name: "Ferrocarril 9", latitude: -25.403219806732892, longitude: -57.286407996788384 },
  { name: "Ferrocarril 10", latitude: -25.402459955253534, longitude: -57.28689991605058 },
];

/** Position of a coordinate in the canonical route order, or -1 if unknown. */
export function routeIndex(latitude: number | null, longitude: number | null): number {
  if (latitude === null || longitude === null) return -1;
  return ROUTE.findIndex(
    (p) =>
      Math.abs(p.latitude - latitude) < 1e-9 && Math.abs(p.longitude - longitude) < 1e-9
  );
}
