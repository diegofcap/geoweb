import GeoMap from "@/components/GeoMap";

export default function Home() {
  return (
    <main className="p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">GeoWeb — Next.js + OpenLayers</h1>
        <p className="text-sm text-slate-600">
          WMS: {process.env.NEXT_PUBLIC_WMS_LAYER} — {process.env.NEXT_PUBLIC_GEOSERVER_URL}
        </p>
      </header>
      <section className="rounded-xl border bg-white p-2">
        <GeoMap />
      </section>
    </main>
  );
}
