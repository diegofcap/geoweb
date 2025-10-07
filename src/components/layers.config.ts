// Ajuste TUDO aqui conforme seu GeoServer
export const GEO = {
    baseUrl: process.env.NEXT_PUBLIC_GEOSERVER_URL || "http://192.168.0.12:8080/geoserver",
    workspace: process.env.NEXT_PUBLIC_WORKSPACE || "webgis",
    // Se estiver usando o rewrite do next.config.js, mantenha os caminhos abaixo:
    wmsPath: "/geoserver/wms",
    wfsPath: "/geoserver/wfs",
    // Caso não use rewrite, troque para `${baseUrl}/wms` e `${baseUrl}/wfs`.
};

// Liste suas camadas **na ordem**.
// A camada 0 é a base (transparent=false por padrão).
export const LAYERS: Array<{
    name: string;       // "workspace:layer"
    title?: string;     // rótulo no painel
    visible?: boolean;  // default true
    opacity?: number;   // 0..1
    transparent?: boolean; // default true, mas na base costumo usar false
}> = [
        { name: "webgis:Imagem24bits", title: "Ortofoto", visible: true, opacity: 1, transparent: false },
        { name: "webgis:areas_tudojunto", title: "Áreas", visible: true, opacity: 0.9 },
        { name: "webgis:linhas_tudojunto", title: "Eixos", visible: true, opacity: 1 },
        { name: "webgis:pontos_tudojunto", title: "Pontos", visible: true, opacity: 1 }
    ];

// Se GetCapabilities não puder ser lido (CORS/bloqueio), usamos este BBOX manual.
// Copie da página da layer (Publishing → Lat/Lon BBOX ou Native BBOX).
export const FALLBACK_BBOX_LATLON: [number, number, number, number] | null = null;
// Exemplo: [-25.8000, -48.6500, -25.3000, -48.2500]
