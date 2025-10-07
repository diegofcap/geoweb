"use client";

import { useEffect, useRef } from "react";

type MapPopupProps = {
    open: boolean;
    x: number;
    y: number;
    header?: string;
    html?: string;
    onClose?: () => void;
};

export default function MapPopup({ open, x, y, header = "Detalhes", html = "", onClose }: MapPopupProps) {
    const boxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function esc(ev: KeyboardEvent) {
            if (ev.key === "Escape") onClose?.();
        }
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [onClose]);

    if (!open) return null;

    return (
        <div
            ref={boxRef}
            className="absolute z-20 max-w-sm rounded-xl border bg-white/95 shadow-lg"
            style={{ left: x, top: y }}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b">
                <strong className="text-sm">{header}</strong>
                <button
                    onClick={onClose}
                    className="px-2 py-1 text-xs rounded-md hover:bg-slate-100"
                    title="Fechar"
                >
                    ✕
                </button>
            </div>
            <div className="p-3 text-xs leading-relaxed overflow-auto max-h-64">
                {/* renderização simples do HTML retornado, sanitize se precisar */}
                <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        </div>
    );
}
