"use client";

type LayerInfo = {
    id: string;
    title: string;
    visible: boolean;
    opacity: number; // 0..1
    onToggle: (id: string) => void;
    onOpacity: (id: string, value: number) => void;
};

export default function LayerPanel({ layers }: { layers: LayerInfo[] }) {
    return (
        <div className="absolute top-4 right-4 z-20 w-64 rounded-xl border bg-white/95 shadow-lg">
            <div className="px-3 py-2 border-b">
                <strong className="text-sm">Camadas</strong>
            </div>
            <div className="p-3 space-y-3">
                {layers.map((l) => (
                    <div key={l.id} className="space-y-1">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={l.visible}
                                onChange={() => l.onToggle(l.id)}
                            />
                            {l.title}
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={l.opacity}
                            onChange={(e) => l.onOpacity(l.id, parseFloat(e.target.value))}
                            className="w-full"
                            title={`Opacidade: ${Math.round(l.opacity * 100)}%`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
