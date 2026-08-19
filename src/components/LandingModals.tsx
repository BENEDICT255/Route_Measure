import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMeasuring: () => void;
}

/** How It Works Modal Overlay */
export function HowItWorksModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        <div className="modal-header">
          <div className="modal-badge">Process Overview</div>
          <h2 className="modal-title">How RouteMeasure Works</h2>
          <p className="modal-subtitle">
            Four simple steps from your Excel coordinates to a measured route distance.
          </p>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">01</div>
            <h3>Upload Excel</h3>
            <p>Upload the Excel workbook you already have. Latitude and Longitude are the only required fields.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">02</div>
            <h3>We Detect & Confirm</h3>
            <p>RouteMeasure automatically identifies coordinate columns and asks for confirmation only when ambiguous.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">03</div>
            <h3>Geodesic Measurement</h3>
            <p>The route is calculated independently using WGS84 ellipsoidal geodesics with the Karney algorithm.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">04</div>
            <h3>View & Export</h3>
            <p>Inspect individual coordinates on satellite imagery and export detailed Excel/KML measurement reports.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" style={{ color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.2)' }} onClick={onClose}>
            Close
          </button>
          <button className="btn btn-accent" onClick={onStartMeasuring}>
            Start Measuring →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Accuracy Modal Overlay */
export function AccuracyModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        <div className="modal-header">
          <div className="modal-badge">Methodology & Accuracy</div>
          <h2 className="modal-title">What Does RouteMeasure Measure?</h2>
        </div>

        <div className="modal-body-text">
          <p>
            <strong>RouteMeasure calculates the coordinate-derived route distance</strong> represented by the supplied sequence of latitude and longitude coordinates.
          </p>

          <div className="modal-info-box">
            <h4>Canonical Calculation Method</h4>
            <p>
              Each consecutive segment is calculated independently using WGS84 ellipsoidal geodesics with Charles Karney's inverse algorithm via GeographicLib.
            </p>
            <p style={{ marginTop: '8px', fontSize: '13px', opacity: 0.8 }}>
              Google Maps is used strictly for satellite visualization and does not determine the canonical distance.
            </p>
          </div>

          <h4 style={{ color: 'white', marginTop: '20px', marginBottom: '8px', fontSize: '15px' }}>
            Real-World Considerations
          </h4>
          <p>
            The calculated distance represents the precise geographical route defined by the supplied coordinate points. Real-world physical accuracy depends on the accuracy of those coordinates and does not automatically model:
          </p>
          <ul style={{ paddingLeft: '20px', color: '#94a3b8', fontSize: '14px', lineHeight: '1.7' }}>
            <li>Conductor sag or vertical catenary geometry</li>
            <li>Elevation profile or terrain topography</li>
            <li>Attachment point positions or structural clearances</li>
            <li>Unrecorded physical deviations not captured in the spreadsheet</li>
          </ul>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" style={{ color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.2)' }} onClick={onClose}>
            Close
          </button>
          <button className="btn btn-accent" onClick={onStartMeasuring}>
            Start Measuring →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Privacy Modal Overlay */
export function PrivacyModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        <div className="modal-header">
          <div className="modal-badge">Privacy & Security</div>
          <h2 className="modal-title">Your Workbook Stays on Your Device</h2>
        </div>

        <div className="modal-body-text">
          <p>
            RouteMeasure processes supported Excel coordinate files <strong>entirely locally inside your web browser</strong>.
          </p>

          <div className="modal-info-box">
            <h4>No Server File Upload</h4>
            <p>
              The application does not upload or retain your workbook files on a RouteMeasure application server. All coordinate detection, geodesic calculation, and report generation occur on your device.
            </p>
          </div>

          <h4 style={{ color: 'white', marginTop: '20px', marginBottom: '8px', fontSize: '15px' }}>
            Map Visualization Notice
          </h4>
          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
            When satellite visualization is displayed, the Google Maps JavaScript API communicates directly with Google's servers to fetch map imagery tiles and map services. Refer to Google's privacy policy for details on their map tile request data handling.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-accent" onClick={onStartMeasuring}>
            Start Measuring →
          </button>
        </div>
      </div>
    </div>
  );
}
