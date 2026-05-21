"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Tv } from "lucide-react";

const NATIVE_W = 1920;
const NATIVE_H = 1080;

const DISPLAYS = [
  { id: 1, label: "TV Display 1", path: "/tv-display-1" },
  { id: 2, label: "TV Display 2", path: "/tv-display-2" },
  { id: 3, label: "TV Display 3", path: "/tv-display-3" },
  { id: 4, label: "TV Display 4", path: "/tv-display-4" },
];

function DisplayPreview({ label, path }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / NATIVE_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0">
          <Tv size={14} className="text-emerald-400 shrink-0 md:w-4 md:h-4" />
          <h3 className="text-xs md:text-sm font-semibold text-white truncate">{label}</h3>
          <span className="hidden md:inline text-[10px] text-neutral-500 font-medium tracking-wider uppercase">
            1920×1080
          </span>
        </div>
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors shrink-0"
        >
          <span>Open</span>
          <ExternalLink size={11} className="md:w-3 md:h-3" />
        </a>
      </div>

      <div
        ref={containerRef}
        className="relative w-full bg-black overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-xs">
            Loading preview…
          </div>
        )}
        <iframe
          src={path}
          title={label}
          onLoad={() => setLoaded(true)}
          tabIndex={-1}
          className="absolute top-0 left-0 border-0 origin-top-left"
          style={{
            width: NATIVE_W,
            height: NATIVE_H,
            transform: `scale(${scale})`,
            pointerEvents: "none",
            opacity: loaded && scale > 0 ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function TvDisplaysPage() {
  return (
    <div>
      <header className="mb-6 md:mb-8">
        <div className="flex items-start md:items-center gap-3">
          <div className="p-2 md:p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0">
            <Tv size={18} className="text-emerald-400 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">TV Displays</h1>
            <p className="text-xs md:text-sm text-neutral-400 mt-0.5">
              Live previews of in-store displays at native 1920×1080 resolution.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {DISPLAYS.map((d) => (
          <DisplayPreview key={d.id} label={d.label} path={d.path} />
        ))}
      </div>
    </div>
  );
}
