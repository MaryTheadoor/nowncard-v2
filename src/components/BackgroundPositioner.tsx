import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

interface BackgroundPositionerProps {
  imageUrl: string;
  opacity: number;
  position: string;
  zoom: number;
  rotation: number;
  onPositionChange: (position: string) => void;
  onZoomChange: (zoom: number) => void;
  onRotationChange: (rotation: number) => void;
  accentColor?: string;
}

export default function BackgroundPositioner({
  imageUrl,
  opacity,
  position,
  zoom,
  rotation,
  onPositionChange,
  onZoomChange,
  onRotationChange,
  accentColor,
}: BackgroundPositionerProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [localZoom, setLocalZoom] = useState(zoom);
  const [localRotation, setLocalRotation] = useState(rotation);
  const [showCropper, setShowCropper] = useState(false);

  const onCropComplete = useCallback(
    (croppedArea: Area) => {
      onPositionChange(`${Math.round(croppedArea.x)}% ${Math.round(croppedArea.y)}%`);
    },
    [onPositionChange],
  );

  const handleZoomChange = useCallback(
    (z: number) => {
      setLocalZoom(z);
      onZoomChange(Math.round(z * 100));
    },
    [onZoomChange],
  );

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setShowCropper(!showCropper)} className="btn btn-secondary btn-sm w-full">
        {showCropper ? 'Close Positioner' : 'Visual Positioner'}
      </button>
      {showCropper && (
        <div className="space-y-3 border border-line rounded-xl p-3 bg-tile-soft">
          <div className="relative w-full rounded-lg overflow-hidden border border-line" style={{ height: '300px', background: accentColor || '#d4a34a' }}>
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={localZoom}
              rotation={localRotation}
              aspect={2 / 3.5}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={handleZoomChange}
              onRotationChange={setLocalRotation}
              style={{
                containerStyle: { background: '#0a0e1a' },
                cropAreaStyle: {
                  border: `2px solid ${accentColor || '#d4a34a'}`,
                  borderRadius: '12px',
                  boxShadow: `0 0 0 9999px rgba(0,0,0,${opacity.toFixed(2)})`,
                },
              }}
            />
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-muted">Zoom</span>
                <span className="text-xs font-bold text-ink">{Math.round(localZoom * 100)}%</span>
              </div>
              <input type="range" min={0.5} max={3} step={0.05} value={localZoom} onChange={(e) => handleZoomChange(parseFloat(e.target.value))} className="w-full accent-accent" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-muted">Rotation</span>
                <span className="text-xs font-bold text-ink">{Math.round(localRotation)}°</span>
              </div>
              <input type="range" min={0} max={360} step={1} value={localRotation} onChange={(e) => { setLocalRotation(parseFloat(e.target.value)); onRotationChange(parseFloat(e.target.value)); }} className="w-full accent-accent" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-muted w-16">Position</span>
              <input type="text" value={position} readOnly className="flex-1 px-2.5 py-1.5 bg-space border border-line rounded-lg text-ink text-xs font-mono text-center focus:outline-none" />
              <button type="button" onClick={() => { onPositionChange('center'); setCrop({ x: 0, y: 0 }); }} className="text-xs text-ink-muted hover:text-accent-text transition">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
