import GeoMap from "@/components/GeoMap";

export default function Page() {
  const wms = process.env.NEXT_PUBLIC_WMS_LAYER;
  const srv = process.env.NEXT_PUBLIC_GEOSERVER_URL;
  const wfs = process.env.NEXT_PUBLIC_WFS_LAYER;
  const attr = process.env.NEXT_PUBLIC_WFS_FILTER_ATTR;

  return (
    <main className="p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">GeoWeb — Next.js + OpenLayers</h1>
        <p className="text-sm text-slate-600">
          WMS: {wms} — {srv} | WFS: {wfs} (filtro: {attr})
        </p>
      </header>
      <section className="rounded-xl border bg-white p-2">
        <GeoMap />
      </section>
    </main>
  );
}
