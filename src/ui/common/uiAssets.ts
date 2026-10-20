const BASE = import.meta.env.BASE_URL

/** Gráfico ripeado de la interfaz: public/ui/battle/<path> (origen y créditos en data/ui-assets.json). */
export const uiAsset = (path: string): string => `${BASE}ui/battle/${path}`
