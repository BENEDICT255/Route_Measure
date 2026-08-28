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
            <h3>Power Transmission & Distribution</h3>
            <p>Calculate exact line lengths for Low Voltage (LV) and Medium Voltage (MV) overhead &amp; underground feeder lines.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">02</div>
            <h3>Telecommunications & Fiber</h3>
            <p>Measure fiber optic backbone routes, mast-to-tower point-to-point links, and right-of-way spans.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">03</div>
            <h3>Logistics & Warehouse Hubs</h3>
            <p>Determine exact geodesic distance from central distribution warehouses to regional distribution sites.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">04</div>
            <h3>Surveying & Environmental Assessment</h3>
            <p>Audit site coordinates, verify boundary distances, and export GIS-ready KML geometries.</p>
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
          <div className="modal-step-card" style={{ borderColor: 'rgba(59, 130, 246, 0.4)', background: 'rgba(30, 58, 110, 0.25)' }}>
            <div className="modal-step-num" style={{ color: '#60a5fa' }}>COMMUNITY / PRO</div>
            <h3>Free &amp; Client-Side</h3>
            <p style={{ marginBottom: '8px' }}>Full access to WGS84 geodesic calculations, Excel parsing, satellite visualization, and multi-sheet exports.</p>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginTop: '12px' }}>$0 / forever</div>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">ENTERPRISE</div>
            <h3>Custom Deployments</h3>
            <p>Self-hosted offline intranet deployments, custom GIS integrations, and corporate single sign-on.</p>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '12px' }}>Contact Engineering Team</div>
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
          <h2 className="modal-title">Questions &amp; Answers</h2>
        </div>

        <div className="modal-body-text">
          <div className="modal-info-box" style={{ marginBottom: '12px' }}>
            <h4 style={{ color: '#60a5fa', marginBottom: '4px' }}>What file formats are supported?</h4>
            <p>Standard Microsoft Excel workbooks (.xlsx, .xls) and CSV files containing latitude and longitude columns.</p>
          </div>

          <div className="modal-info-box" style={{ marginBottom: '12px' }}>
            <h4 style={{ color: '#60a5fa', marginBottom: '4px' }}>How is this different from Google Maps measuring tool?</h4>
            <p>RouteMeasure computes ellipsoidal geodesics using GeographicLib (Karney WGS84 algorithm) directly between every sequential coordinate point, supporting batch files with hundreds of points, multi-sheet splitting, and automated report exports.</p>
          </div>

          <div className="modal-info-box">
            <h4 style={{ color: '#60a5fa', marginBottom: '4px' }}>Is my coordinate data private?</h4>
            <p>Yes. All workbook reading, coordinate parsing, geodesic math, and export generation happen directly inside your browser.</p>
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

/** Interactive Demo Modal Overlay */
export function DemoModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
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
          <div className="modal-badge">Interactive Preview</div>
          <h2 className="modal-title">RouteMeasure Workflow</h2>
          <p className="modal-subtitle">Experience how seamless transmission line and distance measurement is.</p>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">Step 1</div>
            <h3>Drop Your Excel Sheet</h3>
            <p>Upload files like <code>transmission_line.xlsx</code> or <code>site_locations.xlsx</code>.</p>
          </div>
          <div className="modal-step-card">
            <div className="modal-step-num">Step 2</div>
            <h3>Auto-Detect Columns</h3>
            <p>Coordinates, tower IDs, and voltage levels (LV/MV) are parsed instantly.</p>
          </div>
          <div className="modal-step-card">
            <div className="modal-step-num">Step 3</div>
            <h3>Instant Calculation</h3>
            <p>Full route length computed in meters and kilometers with sub-millimeter precision.</p>
          </div>
          <div className="modal-step-card">
            <div className="modal-step-num">Step 4</div>
            <h3>Satellite &amp; Export</h3>
            <p>Visualize polylines on Google Maps satellite imagery and download Excel/KML reports.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" style={{ color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.2)' }} onClick={onClose}>
            Close
          </button>
          <button className="btn btn-accent" onClick={onStartMeasuring}>
            Start Measuring Now →
          </button>
        </div>
      </div>
    </div>
  );
}
