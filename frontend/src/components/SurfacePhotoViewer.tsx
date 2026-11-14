import React, { useState, useEffect } from "react";
import { Camera, Sparkles, ZoomIn, X, ExternalLink, Mountain } from "lucide-react";

interface OpticalProduct {
  id: string;
  name: string;
  type: string;
  center: { latitude: number; longitude: number };
  resolutionMPerPix: number;
  pdsProductUrl: string;
  thumbnailUrl: string;
  mission: string;
  instrument: string;
  sol?: number;
  description: string;
  geologicalFeatures: string[];
}

interface SurfacePhotoViewerProps {
  latitude: number;
  longitude: number;
  className?: string;
  onClose?: () => void;
}

export const SurfacePhotoViewer: React.FC<SurfacePhotoViewerProps> = ({
  latitude,
  longitude,
  className = "",
  onClose,
}) => {
  const [photos, setPhotos] = useState<OpticalProduct[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<OpticalProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/data/authentic/surface-photos?lat=${latitude}&lon=${longitude}&radius=35`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success && Array.isArray(json.data)) {
          setPhotos(json.data);
          if (json.data.length > 0) {
            setSelectedPhoto(json.data[0]);
          }
        }
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  if (isLoading) {
    return (
      <div className={`p-4 rounded-xl border border-atlas-border bg-atlas-card text-center text-xs text-atlas-muted ${className}`}>
        Loading ground perspective surface photographs...
      </div>
    );
  }

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-xl border border-atlas-border bg-atlas-card p-4 space-y-4 shadow-lg ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Camera className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-semibold text-atlas-text">
            Point-of-View Surface Rover Photography (NASA In-Situ)
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {photos.length} Ground Views Available
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors rounded"
              title="Close surface photo viewer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {selectedPhoto && (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border border-atlas-border bg-atlas-elevated aspect-video group flex items-center justify-center">
            {!failedImages[selectedPhoto.id] ? (
              <img
                src={selectedPhoto.thumbnailUrl}
                alt={selectedPhoto.name}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => {
                  setFailedImages((prev) => ({ ...prev, [selectedPhoto.id]: true }));
                }}
              />
            ) : (
              <div className="w-full h-full p-6 bg-gradient-to-br from-[#1c120c] via-[#2a170e] to-[#0c0d12] flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                {/* Stratigraphic Layer Pattern Background */}
                <div className="absolute inset-0 opacity-15 pointer-events-none flex flex-col justify-between py-4">
                  <div className="border-b border-amber-500/40 w-full" />
                  <div className="border-b border-amber-500/30 w-full border-dashed" />
                  <div className="border-b border-amber-500/50 w-full" />
                  <div className="border-b border-amber-500/20 w-full border-dotted" />
                </div>

                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Mountain className="w-6 h-6" />
                </div>

                <div className="space-y-1 max-w-md z-10">
                  <h4 className="text-sm font-bold text-atlas-text font-mono">
                    {selectedPhoto.name}
                  </h4>
                  <p className="text-[11px] text-atlas-muted">
                    NASA In-Situ Ground Camera Perspective ({selectedPhoto.instrument})
                  </p>
                  <p className="text-[10px] text-amber-400/90 font-mono">
                    Calibrated PDS Product · Sol {selectedPhoto.sol ?? "Ground"}
                  </p>
                </div>

                <a
                  href={selectedPhoto.pdsProductUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="z-10 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono transition-colors"
                >
                  <span>Open NASA Planetary Data System Record</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur text-[11px] font-mono text-white flex items-center space-x-1.5 border border-white/10 pointer-events-none">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{selectedPhoto.mission} {selectedPhoto.sol !== undefined ? `• Sol ${selectedPhoto.sol}` : ""}</span>
            </div>
            <a
              href={selectedPhoto.pdsProductUrl}
              target="_blank"
              rel="noreferrer"
              title="Open official NASA JPL Photojournal catalog entry & high-res downloads"
              className="absolute bottom-2 right-2 px-2.5 py-1 rounded bg-black/70 hover:bg-black/90 text-[11px] text-white flex items-center space-x-1 border border-white/20 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Inspect NASA Archive</span>
            </a>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-atlas-text">{selectedPhoto.name}</span>
              <span className="text-atlas-muted font-mono">{selectedPhoto.instrument}</span>
            </div>
            <p className="text-xs text-atlas-muted leading-relaxed">
              {selectedPhoto.description}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedPhoto.geologicalFeatures.map((feat, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-atlas-bg border border-atlas-border text-atlas-text font-mono"
                >
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {photos.length > 1 && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-atlas-border/50">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPhoto(p)}
              className={`p-1.5 rounded-lg border text-left transition-all ${
                selectedPhoto?.id === p.id
                  ? "border-amber-500 bg-amber-500/10 text-atlas-text"
                  : "border-atlas-border hover:border-atlas-muted text-atlas-muted"
              }`}
            >
              <div className="text-[11px] font-semibold truncate">{p.name}</div>
              <div className="text-[10px] opacity-75 font-mono">{p.instrument.split(" ")[0]}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
