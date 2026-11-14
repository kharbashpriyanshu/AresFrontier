import React, { useState, useEffect } from "react";
import { Camera, Sparkles, ZoomIn, X } from "lucide-react";

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
          <div className="relative rounded-lg overflow-hidden border border-atlas-border bg-black/60 aspect-video group">
            <img
              src={selectedPhoto.thumbnailUrl}
              alt={selectedPhoto.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                // Fallback if external image is blocked
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 backdrop-blur text-[11px] font-mono text-white flex items-center space-x-1.5 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{selectedPhoto.mission} {selectedPhoto.sol !== undefined ? `• Sol ${selectedPhoto.sol}` : ""}</span>
            </div>
            <a
              href={selectedPhoto.pdsProductUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-2 right-2 px-2.5 py-1 rounded bg-black/70 hover:bg-black/90 text-[11px] text-white flex items-center space-x-1 border border-white/20 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Inspect PDS Record</span>
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
