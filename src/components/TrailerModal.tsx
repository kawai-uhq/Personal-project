import ConsentGate from './ConsentGate';
import { useEffect } from 'react';

export default function TrailerModal({ videoKey, title, onClose }: { videoKey: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="trailer-modal" role="dialog" aria-modal="true" aria-label={`${title} trailer`}>
        <button className="modal-close" onClick={onClose}>Close</button>
        <div className="trailer-frame">
          <ConsentGate label="Load the trailer" className="trailer-gate">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0&modestbranding=1`}
              title={`${title} trailer`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </ConsentGate>
        </div>
      </div>
    </div>
  );
}
