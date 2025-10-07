"use client";

import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import TileWMS from "ol/source/TileWMS";
import { fromLonLat } from "ol/proj";
import "ol/ol.css";

type GeoMapProps = {
    center?: [number, number]; // lon, lat
    zoom?: number;
    wmsOpacity?: number;
};

export default function GeoMap({
    center = [-43.2096, -22.9035], // Rio como exemplo
    zoom = 10,
    wmsOpacity = 0.9,
}: GeoMapProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<Map | null>(null);

    const [visibleWms, setVisibleWms] = useState(true);

    // Lê envs
    const geoserverBase = process.env.NEXT_PUBLIC_GEOSERVER_URL || "http://localhost:8080/geoserver";
    const wmsUrl =
        // usa o proxy (rewrite) no dev para evitar CORS
        typeof window !== "undefined" && location.hostname === "localhost"
            ? "/geoserver/wms"
            : `${geoserverBase}/wms`;
    const layerName = process.env.NEXT_PUBLIC_WMS_LAYER || "topp:states";

    useEffect(() => {
        if (!ref.current) return;

        const osm = new TileLayer({
            source: new OSM(),
            visible: true,
        });

        const wms = new TileLayer({
            visible: visibleWms,
            opacity: wmsOpacity,
            properties: { id: "wmsLayer" },
            source: new TileWMS({
                url: wmsUrl,
                params: {
                    LAYERS: layerName,
                    TILED: true,
                    FORMAT: "image/png",
                    TRANSPARENT: true,
                },
                serverType: "geoserver",
                transition: 200,
            }),
        });

        const map = new Map({
            target: ref.current,
            layers: [osm, wms],
            view: new View({
                center: fromLonLat(center),
                zoom,
            }),
            controls: [],
        });

        mapRef.current = map;

        // Exemplo: click para GetFeatureInfo (se layer suportar)
        map.on("singleclick", async (evt) => {
            const view = map.getView();
            const source = (wms.getSource() as TileWMS);
            const url = source.getFeatureInfoUrl(
                evt.coordinate,
                view.getResolution()!,
                view.getProjection(),
                { INFO_FORMAT: "application/json", QUERY_LAYERS: layerName }
            );
            if (!url) return;

            try {
                // Se estiver usando proxy, funciona direto; senão, precisa CORS liberado no GeoServer
                const resp = await fetch(url);
                if (!resp.ok) return;
                const json = await resp.json();
                const total = Array.isArray(json.features) ? json.features.length : 0;
                if (total > 0) {
                    alert(`GetFeatureInfo: ${total} feição(ões) encontrada(s).`);
                }
            } catch { }
        });

        return () => {
            map.setTarget(undefined);
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // alterna visibilidade WMS
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const wms = map
            .getLayers()
            .getArray()
            .find((l) => l.get("id") === "wmsLayer") as TileLayer<TileWMS> | undefined;
        if (wms) wms.setVisible(visibleWms);
    }, [visibleWms]);

    const zoomBy = (delta: number) => {
        const map = mapRef.current;
        if (!map) return;
        const v = map.getView();
        v.setZoom((v.getZoom() || 10) + delta);
    };

    return (
        <div className="relative h-[calc(100vh-4rem)] w-full">
            {/* Controles Tailwind (100% custom) */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                <button
                    onClick={() => setVisibleWms(v => !v)}
                    className="rounded-2xl px-3 py-1.5 bg-white/90 shadow hover:bg-white text-sm"
                    title="Alternar camada WMS"
                >
                    {visibleWms ? "Ocultar cadastro" : "Mostrar cadastro"}
                </button>
                <button
                    onClick={() => zoomBy(+1)}
                    className="rounded-2xl px-3 py-1.5 bg-white/90 shadow hover:bg-white text-sm"
                    title="Zoom +"
                >
                    + Zoom
                </button>
                <button
                    onClick={() => zoomBy(-1)}
                    className="rounded-2xl px-3 py-1.5 bg-white/90 shadow hover:bg-white text-sm"
                    title="Zoom -"
                >
                    − Zoom
                </button>
            </div>

            <div ref={ref} className="h-full w-full rounded-2xl shadow-inner" />
        </div>
    );
}
