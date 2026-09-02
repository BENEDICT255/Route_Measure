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
          <button className="editorial-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="editorial-btn-primary" onClick={onStartMeasuring}>
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
            <p style={{ marginTop: '8px', fontSize: '13px', opacity: 0.85 }}>
              Google Maps is used strictly for satellite visualization and does not determine the canonical distance.
            </p>
          </div>

          <h4 className="modal-section-title">
            Real-World Considerations
          </h4>
          <p>
            The calculated distance represents the precise geographical route defined by the supplied coordinate points. Real-world physical accuracy depends on the accuracy of those coordinates and does not automatically model:
          </p>
          <ul className="modal-list">
            <li>Conductor sag or vertical catenary geometry</li>
            <li>Elevation profile or terrain topography</li>
            <li>Attachment point positions or structural clearances</li>
            <li>Unrecorded physical deviations not captured in the spreadsheet</li>
          </ul>
        </div>

        <div className="modal-footer">
          <button className="editorial-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="editorial-btn-primary" onClick={onStartMeasuring}>
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

          <h4 className="modal-section-title">
            Map Visualization Notice
          </h4>
          <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
            When satellite visualization is displayed, the Google Maps JavaScript API communicates directly with Google's servers to fetch map imagery tiles and map services. Refer to Google's privacy policy for details on their map tile request data handling.
          </p>
        </div>

        <div className="modal-footer">
          <button className="editorial-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="editorial-btn-primary" onClick={onStartMeasuring}>
            Start Measuring →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Features Modal Overlay */
export function FeaturesModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
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
          <div className="modal-badge">Platform Capabilities</div>
          <h2 className="modal-title">Powerful Geospatial Toolset</h2>
          <p className="modal-subtitle">Engineered for utility engineers, surveyors, and infrastructure planners.</p>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">⚡</div>
            <h3>Dual Measurement Modes</h3>
            <p>Continuous LV/MV transmission line polyline route measurement &amp; Multi-site Point-to-Point radial distance calculation.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">🌐</div>
            <h3>High-Precision Karney Geodesics</h3>
            <p>Micron-accurate ellipsoidal mathematics via GeographicLib. Eliminates spherical distortion found in Haversine formulas.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">🛰️</div>
            <h3>Hybrid Satellite Visualization</h3>
            <p>Interactive satellite overlays with custom pole markers, segment vectors, and automatic camera fitting.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">📊</div>
            <h3>Professional Multi-Format Exports</h3>
            <p>Generate styled Excel reports with formulas and KML files ready for Google Earth Pro and GIS applications.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="editorial-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="editorial-btn-primary" onClick={onStartMeasuring}>
            Start Measuring →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Use Cases Modal Overlay */
export function UseCasesModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
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
          <div className="modal-badge">Industry Applications</div>
          <h2 className="modal-title">Built for Precision Infrastructure</h2>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">01</div>
            <h3>Power Transmission &amp; Distribution</h3>
            <p>Calculate exact line lengths for Low Voltage (LV) and Medium Voltage (MV) overhead &amp; underground feeder lines.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">02</div>
            <h3>Telecommunications &amp; Fiber</h3>
            <p>Measure fiber optic backbone routes, mast-to-tower point-to-point links, and right-of-way spans.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">03</div>
            <h3>Logistics &amp; Warehouse Hubs</h3>
            <p>Determine exact geodesic distance from central distribution warehouses to regional distribution sites.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">04</div>
            <h3>Surveying &amp; Environmental Assessment</h3>
            <p>Audit site coordinates, verify boundary distances, and export GIS-ready KML geometries.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="editorial-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="editorial-btn-primary" onClick={onStartMeasuring}>
            Start Measuring →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pricing Modal Overlay */
export function PricingModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
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
          <div className="modal-badge">Transparent Access</div>
          <h2 className="modal-title">Open &amp; Enterprise-Ready</h2>
          <p className="modal-subtitle">RouteMeasure is built with a client-side architecture that respects your privacy.</p>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">COMMUNITY / PRO</div>
            <h3>Free &amp; Client-Side</h3>
            <p style={{ marginBottom: '8px' }}>Full access to WGS84 geodesic calculations, Excel parsing, satellite visualization, and multi-sheet exports.</p>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--editorial-accent)', marginTop: '12px' }}>$0 / forever</div>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">ENTERPRISE</div>
            <h3>Custom Deployments</h3>
            <p>Self-hosted offline intranet deployments, custom GIS integrations, and corporate single sign-on.</p>
            <div style={{ fontSize: '14px', color: 'var(--rm-text-muted)', marginTop: '12px' }}>Contact Engineering Team</div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="editorial-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="editorial-btn-primary" onClick={onStartMeasuring}>
            Start Measuring →
          </button>
        </div>
      </div>
    </div>
  );
}

/** FAQ Modal Overlay */
export function FaqModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
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
          <div className="modal-badge">Frequently Asked Questions</div>
          <h2 className="modal-title">Help &amp; Documentation</h2>
        </div>

        <div className="modal-body-text">
          <h4 className="modal-section-title">What coordinate formats are accepted?</h4>
          <p>Standard decimal degrees (e.g. -6.792311, 39.208153). Degrees-minutes-seconds (DMS) can be pre-converted or auto-detected in standard columns.</p>

          <h4 className="modal-section-title" style={{ marginTop: '16px' }}>How large can the spreadsheet be?</h4>
          <p>Up to 10,000 coordinates are processed in milliseconds directly on your device without server limits.</p>

          <h4 className="modal-section-title" style={{ marginTop: '16px' }}>Can I export directly to AutoCAD or ArcGIS?</h4>
          <p>Yes. The exported KML files can be opened in Google Earth Pro or imported directly into Civil3D, QGIS, and ArcGIS Pro.</p>
        </div>

        <div className="modal-footer">
          <button className="editorial-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="editorial-btn-primary" onClick={onStartMeasuring}>
            Start Measuring →
          </button>
        </div>
      </div>
    </div>
  );
}
