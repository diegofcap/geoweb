"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import TileWMS from "ol/source/TileWMS";
import VectorSource from "ol/source/Vector";
import { fromLonLat, transformExtent } from "ol/proj";
import { getTopLeft, getBottomRight, extend as extendExtent, createEmpty } from "ol/extent";
import "ol/ol.css";
import Draw from "ol/interaction/Draw";
import Modify from "ol/interaction/Modify";
import { LineString, Polygon } from "ol/geom";
import { Style, Stroke, Fill } from "ol/style";
import GeoJSON from "ol/format/GeoJSON";
import MapPopup from "./MapPopup";
import LayerPanel from "./LayerPanel";

import { GEO, LAYERS, FALLBACK_BBOX_LATLON } from "./layers.config";

type PopupState = { open: boolean; x: number; y: number; html: string };

export default function GeoMap() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<Map | null>(null);

    // URLs WMS/WFS (usando rewrite no dev)
    const wmsUrl =
        typeof window !== "undefined" && location.hostname === "localhost"
            ? GEO.wmsPath
            : `${GEO.baseUrl}/wms`;
    const wfsUrl =
        typeof window !== "undefined" && location.hostname === "localhost"
            ? GEO.wfsPath
            : `${GEO.baseUrl}/wfs`;

    // UI states
    const [popup, setPopup] = useState<PopupState>({ open: false, x: 0, y: 0, html: "" });
    const [measureMode, setMeasureMode] = useState<"none" | "line" | "area">("none");

    // vector highlight + vector draw source
    const highlightSource = useMemo(() => new VectorSource(), []);
    const drawSource = useMemo(() => new VectorSource(), []);

    // styles
    const highlightStyle = useMemo(
        () =>
            new Style({
                stroke: new Stroke({ color: "#eab308", width: 3 }),
                fill: new Fill({ color: "rgba(234,179,8,0.2)" }),
            }),
        []
    );
    const drawStyle = useMemo(
        () =>
            new Style({
                stroke: new Stroke({ color: "#0ea5e9", width: 2, lineDash: [4, 4] }),
                fill: new Fill({ color: "rgba(14,165,233,0.1)" }),
            }),
        []
    );

    const drawInteractionRef = useRef<Draw | null>(null);
    const modifyInteractionRef = useRef<Modify | null>(null);

    // Monta as camadas WMS a partir da config
    const [wmsLayers, setWmsLayers] = useState<TileLayer<TileWMS>[]>([]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Base OSM (opcional)
        const osm = new TileLayer({
            source: new OSM(),
            visible: false, // desliga se sua base raster já cobre tudo
            properties: { id: "osm" },
        });

        // Cria cada WMS a partir de LAYERS
        const createdWms = LAYERS.map((cfg, idx) => {
            const isBase = idx === 0 && cfg.transparent === false;
            return new TileLayer({
                visible: cfg.visible !== false,
                opacity: cfg.opacity ?? 1,
                properties: { id: cfg.name, title: cfg.title || cfg.name },
                source: new TileWMS({
                    url: wmsUrl,
                    params: {
                        LAYERS: cfg.name,
                        VERSION: "1.1.1", // 1.1.1 evita axis-order chato do 1.3.0
                        FORMAT: "image/png",
                        TRANSPARENT: isBase ? false : true,
                        TILED: true,
                    },
                    serverType: "geoserver",
                    transition: 200,
                }),
            });
        });

        const highlightLayer = new VectorLayer({
            source: highlightSource,
            style: highlightStyle,
            properties: { id: "highlight" },
        });

        const drawLayer = new VectorLayer({
            source: drawSource,
            style: drawStyle,
            properties: { id: "measure" },
        });

        const map = new Map({
            target: containerRef.current,
            layers: [osm, ...createdWms, highlightLayer, drawLayer],
            view: new View({
                center: fromLonLat([-47.9, -15.8]),
                zoom: 5,
                // extent será definido após lermos o BBOX
            }),
            controls: [],
        });

        mapRef.current = map;
        setWmsLayers(createdWms);

        // GETFEATUREINFO com a primeira layer visível (prioridade)
        map.on("singleclick", async (evt) => {
            setPopup((p) => ({ ...p, open: false }));

            const firstVisible = createdWms.find((l) => l.getVisible());
            if (!firstVisible) return;

            const layerName = firstVisible.get("id") as string;
            const source = firstVisible.getSource() as TileWMS;
            const view = map.getView();
            const url = source.getFeatureInfoUrl(
                evt.coordinate,
                view.getResolution()!,
                view.getProjection(),
                { INFO_FORMAT: "text/html", QUERY_LAYERS: layerName }
            );
            if (!url) return;

            try {
                const resp = await fetch(url);
                if (!resp.ok) return;
                const html = await resp.text();
                const pixel = evt.pixel;
                setPopup({ open: true, x: pixel[0] + 12, y: pixel[1] + 12, html });
            } catch { }
        });

        return () => {
            map.setTarget(undefined);
            mapRef.current = null;
            setWmsLayers([]);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ======= FIT & TRAVA NO BBOX DOS DADOS =======
    useEffect(() => {
        const map = mapRef.current;
        if (!map || wmsLayers.length === 0) return;

        (async () => {
            const bbox3857 = await getUnionBboxFromCapabilities(LAYERS.map(l => l.name), `${GEO.baseUrl}/wms`)
                .catch(() => null);

            let targetExtent: [number, number, number, number] | null = null;

            if (bbox3857) {
                targetExtent = bbox3857;
            } else if (FALLBACK_BBOX_LATLON) {
                // lat/lon → 3857
                targetExtent = transformExtent(FALLBACK_BBOX_LATLON, "EPSG:4326", "EPSG:3857") as [number, number, number, number];
            }

            if (targetExtent) {
                const pad = padExtent(targetExtent, 0.05); // 5% de folga
                const view = map.getView();
                view.fit(pad, { padding: [24, 24, 24, 24], duration: 250 });

                // trava o mapa dentro do pad — impede o centro de sair
                view.setProperties({
                    extent: pad,
                    constrainOnlyCenter: true,
                });

                // garante que não “pule” o limite em zoom/pan
                map.on("moveend", () => {
                    const v = map.getView();
                    const c = v.getCenter();
                    if (!c) return;
                    const [minX, minY, maxX, maxY] = pad;
                    const x = Math.min(Math.max(c[0], minX), maxX);
                    const y = Math.min(Math.max(c[1], minY), maxY);
                    if (x !== c[0] || y !== c[1]) v.setCenter([x, y]);
                });
            }
        })();
    }, [wmsLayers]);

    // ======= MEDIÇÃO =======
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (drawInteractionRef.current) {
            map.removeInteraction(drawInteractionRef.current);
            drawInteractionRef.current = null;
        }
        if (modifyInteractionRef.current) {
            map.removeInteraction(modifyInteractionRef.current);
            modifyInteractionRef.current = null;
        }

        if (measureMode === "none") return;

        const type = measureMode === "line" ? "LineString" : "Polygon";
        const draw = new Draw({ source: drawSource, type: type as "LineString" | "Polygon" });
        const modify = new Modify({ source: drawSource });
        map.addInteraction(draw);
        map.addInteraction(modify);
        drawInteractionRef.current = draw;
        modifyInteractionRef.current = modify;

        draw.on("drawend", (ev) => {
            const geom = ev.feature.getGeometry();
            if (!geom) return;
            if (geom instanceof LineString) {
                const len = Math.round(geom.getLength());
                alert(`Comprimento: ${len.toLocaleString()} m (aprox.)`);
            } else if (geom instanceof Polygon) {
                const area = Math.round(geom.getArea());
                alert(`Área: ${area.toLocaleString()} m² (aprox.)`);
            }
        });

        return () => {
            if (drawInteractionRef.current) map.removeInteraction(drawInteractionRef.current);
            if (modifyInteractionRef.current) map.removeInteraction(modifyInteractionRef.current);
            drawInteractionRef.current = null;
            modifyInteractionRef.current = null;
        };
    }, [measureMode, drawSource]);

    // ======= Painel de camadas (ligar/desligar/opacity) =======
    const layerPanelData = wmsLayers.map((l) => ({
        id: l.get("id") as string,
        title: (l.get("title") as string) || (l.get("id") as string),
        visible: l.getVisible(),
        opacity: l.getOpacity(),
        onToggle: (id: string) => {
            const layer = wmsLayers.find((x) => x.get("id") === id);
            if (layer) layer.setVisible(!layer.getVisible());
        },
        onOpacity: (id: string, value: number) => {
            const layer = wmsLayers.find((x) => x.get("id") === id);
            if (layer) layer.setOpacity(value);
        },
    }));

    return (
        <div className="relative h-[calc(100vh-4rem)] w-full">
            {/* Controles principais */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
                <button
                    onClick={() => setMeasureMode("line")}
                    className={`text-xs rounded-md px-2 py-1 bg-white/90 shadow ${measureMode === "line" ? "ring-1 ring-sky-300" : "hover:bg-slate-100"}`}
                    title="Medir distância"
                >
                    Medir linha
                </button>
                <button
                    onClick={() => setMeasureMode("area")}
                    className={`text-xs rounded-md px-2 py-1 bg-white/90 shadow ${measureMode === "area" ? "ring-1 ring-sky-300" : "hover:bg-slate-100"}`}
                    title="Medir área"
                >
                    Medir área
                </button>
                <button
                    onClick={() => setMeasureMode("none")}
                    className={`text-xs rounded-md px-2 py-1 bg-white/90 shadow ${measureMode === "none" ? "ring-1 ring-sky-300" : "hover:bg-slate-100"}`}
                    title="Desligar medição"
                >
                    Medição off
                </button>
                <button
                    onClick={() => drawSource.clear()}
                    className="text-xs rounded-md px-2 py-1 bg-white/90 shadow hover:bg-slate-100"
                    title="Limpar medições"
                >
                    Limpar
                </button>
            </div>

            {/* Painel de camadas */}
            <LayerPanel layers={layerPanelData} />

            {/* Mapa */}
            <div ref={containerRef} className="h-full w-full rounded-2xl shadow-inner" />

            {/* Popup de GetFeatureInfo */}
            <MapPopup
                open={popup.open}
                x={popup.x}
                y={popup.y}
                header="GetFeatureInfo"
                html={popup.html}
                onClose={() => setPopup((p) => ({ ...p, open: false }))}
            />
        </div>
    );
}

/* ===================== helpers ===================== */

// Busca o BBOX (lat/lon) via WMS GetCapabilities para cada layer pedida,
// transforma para EPSG:3857 e devolve a **união** de todos os extents.
async function getUnionBboxFromCapabilities(layerNames: string[], wmsBase: string) {
    const url = `${wmsBase}?service=WMS&version=1.3.0&request=GetCapabilities`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("GetCapabilities failed");
    const text = await resp.text();

    const xml = new DOMParser().parseFromString(text, "text/xml");
    const layersXml = Array.from(xml.getElementsByTagName("Layer"));

    let union: [number, number, number, number] | null = null;

    for (const targetName of layerNames) {
        const node = layersXml.find((n) => {
            const nm = n.getElementsByTagName("Name")[0]?.textContent?.trim();
            return nm === targetName;
        });
        if (!node) continue;

        // 1) WMS 1.3.0: EX_GeographicBoundingBox (lat/lon)
        let west, east, south, north;
        const ex = node.getElementsByTagName("EX_GeographicBoundingBox")[0];
        if (ex) {
            west = parseFloat(ex.getElementsByTagName("westBoundLongitude")[0]?.textContent || "");
            east = parseFloat(ex.getElementsByTagName("eastBoundLongitude")[0]?.textContent || "");
            south = parseFloat(ex.getElementsByTagName("southBoundLatitude")[0]?.textContent || "");
            north = parseFloat(ex.getElementsByTagName("northBoundLatitude")[0]?.textContent || "");
        } else {
            // 2) WMS 1.1.1: LatLonBoundingBox
            const ll = node.getElementsByTagName("LatLonBoundingBox")[0];
            if (ll) {
                west = parseFloat(ll.getAttribute("minx") || "");
                south = parseFloat(ll.getAttribute("miny") || "");
                east = parseFloat(ll.getAttribute("maxx") || "");
                north = parseFloat(ll.getAttribute("maxy") || "");
            }
        }

        if (
            [west, south, east, north].some((v) => typeof v !== "number" || Number.isNaN(v as number))
        ) {
            continue;
        }

        // lat/lon → 3857
        const extent3857 = transformExtent([west!, south!, east!, north!], "EPSG:4326", "EPSG:3857") as [
            number,
            number,
            number,
            number
        ];

        union = union ? (extendExtent(union, extent3857) as [number, number, number, number]) : extent3857;
    }

    return union;
}

// Aplica um padding proporcional num extent (como setMaxBounds do Leaflet com folga)
function padExtent(ext: [number, number, number, number], ratio = 0.05) {
    const width = ext[2] - ext[0];
    const height = ext[3] - ext[1];
    const dx = width * ratio;
    const dy = height * ratio;
    return [ext[0] - dx, ext[1] - dy, ext[2] + dx, ext[3] + dy] as [number, number, number, number];
}