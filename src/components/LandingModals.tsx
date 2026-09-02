import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMeasuring: () => void;
}

/** 1. HOW IT WORKS MODAL */
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
          <div className="modal-badge">PROCESS OVERVIEW</div>
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
            <h3>We Detect &amp; Confirm</h3>
            <p>RouteMeasure automatically identifies coordinate columns and asks for confirmation only when ambiguous.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">03</div>
            <h3>Geodesic Measurement</h3>
            <p>The route is calculated independently using WGS84 ellipsoidal geodesics with the Karney algorithm.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">04</div>
            <h3>View &amp; Export</h3>
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

/** 2. FEATURES MODAL */
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
          <div className="modal-badge">PLATFORM CAPABILITIES</div>
          <h2 className="modal-title">Core Engineering Features</h2>
          <p className="modal-subtitle">
            Purpose-built geospatial precision for power utilities, surveying, and infrastructure teams.
          </p>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">01</div>
            <h3>WGS84 Geodesic Precision</h3>
            <p>Charles Karney ellipsoidal inverse calculation via GeographicLib with sub-millimeter mathematical accuracy.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">02</div>
            <h3>Dual Calculation Engines</h3>
            <p>Support for sequential LV/MV power line polylines and central hub-to-site distance matrix calculations.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">03</div>
            <h3>Interactive Satellite Mapping</h3>
            <p>Vector line rendering, individual pole/tower coordinate pins, and automatic viewport fitting over Google satellite tiles.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">04</div>
            <h3>Audit-Ready Deliverables</h3>
            <p>Multi-tab formatted Excel workbooks with chainage formulas and styled KML files for Google Earth and GIS software.</p>
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

/** 3. MODES MODAL */
export function ModesModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
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
          <div className="modal-badge">MEASUREMENT MODES</div>
          <h2 className="modal-title">Two Specialized Workflows</h2>
          <p className="modal-subtitle">
            Choose the exact calculation workflow designed for your infrastructure project.
          </p>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">MODE 01</div>
            <h3>LV &amp; MV Network Polyline</h3>
            <p>Measures sequential transmission lines, distribution routes, and feeder corridors. Automatically classifies LV vs. MV voltage spans.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">MODE 02</div>
            <h3>Point-to-Point Distance Matrix</h3>
            <p>Calculates radial distances from central warehouse hubs to destination sites with interactive assignment (Assigned, Excluded) and proximity ranking.</p>
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

/** 4. REPORTS & EXPORT MODAL */
export function ReportsModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
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
          <div className="modal-badge">DELIVERABLES &amp; GIS</div>
          <h2 className="modal-title">Engineering-Ready Reports</h2>
          <p className="modal-subtitle">
            Export standardized calculation audits and spatial layers your team can immediately use.
          </p>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">01</div>
            <h3>Excel Calculation Audit (.xlsx)</h3>
            <p>Multi-tab workbook containing project summary, point-by-point coordinate ledger, segment chainage, and route statistics.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">02</div>
            <h3>Google Earth / GIS Layer (.kml)</h3>
            <p>Spatial geometry files with styled line paths, voltage color-coding, and clickable waypoint placemarks for AutoCAD &amp; QGIS.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">03</div>
            <h3>Point-to-Point Logistics Matrix</h3>
            <p>Structured distance matrix sheets with nearest-to-farthest rankings, assigned sites breakdown, and origin coordinates.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">04</div>
            <h3>Zero Telemetry Guarantee</h3>
            <p>100% in-browser generation. No calculation data or exported spreadsheets ever touch external servers.</p>
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

/** 5. ABOUT & ACCURACY MODAL */
export function AboutModal({ isOpen, onClose, onStartMeasuring }: ModalProps) {
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
          <div className="modal-badge">ABOUT ROUTEMEASURE</div>
          <h2 className="modal-title">Precision Geodesic Standard</h2>
          <p className="modal-subtitle">
            Engineered to eliminate spherical distortion in utility line distance measurement.
          </p>
        </div>

        <div className="modal-steps-grid">
          <div className="modal-step-card">
            <div className="modal-step-num">01</div>
            <h3>WGS84 Ellipsoid Standard</h3>
            <p>Calculates exact surface distances over the rotational ellipsoid (a = 6378137.0m, f = 1/298.257223563).</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">02</div>
            <h3>Karney Inverse Algorithm</h3>
            <p>Charles Karney's gold-standard geodesic algorithm implemented via GeographicLib, accurate to within nanometers.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">03</div>
            <h3>100% Client-Side Privacy</h3>
            <p>All Excel parsing, coordinate detection, and math processing run inside your browser engine with complete confidentiality.</p>
          </div>

          <div className="modal-step-card">
            <div className="modal-step-num">04</div>
            <h3>Infrastructure Rigor</h3>
            <p>Built specifically for power transmission, telecommunication corridors, pipelines, and regional surveyor workflows.</p>
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

/** Legacy aliases for compatibility */
export const AccuracyModal = AboutModal;
export const PrivacyModal = AboutModal;
export const UseCasesModal = FeaturesModal;
export const PricingModal = FeaturesModal;
export const FaqModal = HowItWorksModal;
