import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe3D } from '../components/Globe3D';
import { HowItWorksModal, AccuracyModal, PrivacyModal } from '../components/LandingModals';

export function LandingPage() {
  const navigate = useNavigate();

  // Active modal state
  const [activeModal, setActiveModal] = useState<'how-it-works' | 'accuracy' | 'privacy' | null>(null);

  const goToMeasure = () => {
    // Smooth transition
    const mainElem = document.querySelector('.landing-viewport');
    if (mainElem) {
      mainElem.classList.add('page-exit');
    }
    setTimeout(() => {
      navigate('/measure');
    }, 300);
  };

  return (
    <div className="landing-viewport">
      {/* ─── TRANSPARENT HEADER ────────────────────────────────────── */}
      <header className="geo-header">
        <div className="geo-logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#2563eb" fillOpacity="0.2"/>
            <path d="M8 24L12 8L16 18L20 12L24 24" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="8" r="2.2" fill="#60a5fa"/>
            <circle cx="16" cy="18" r="2.2" fill="#60a5fa"/>
            <circle cx="20" cy="12" r="2.2" fill="#60a5fa"/>
          </svg>
          RouteMeasure
        </div>

        <nav className="geo-nav">
          <button onClick={() => setActiveModal('how-it-works')}>How It Works</button>
          <button onClick={() => setActiveModal('accuracy')}>Accuracy</button>
          <button onClick={() => setActiveModal('privacy')}>Privacy</button>
          <button className="geo-cta-btn" onClick={goToMeasure}>
            Start Measuring
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </nav>
      </header>

      {/* ─── MAIN LANDING COMPOSITION (HERO LEFT + 3D GLOBE RIGHT) ─── */}
      <main className="geo-main">
        {/* LEFT COLUMN: HERO & CAPABILITIES */}
        <div className="geo-hero-col">
          <h1 className="geo-title">
            Accurate Route<br />
            Distance From<br />
            <span className="geo-title-accent">Your Coordinates</span>
          </h1>

          <p className="geo-subtitle">
            Upload your Excel coordinates. Measure the route accurately using WGS84 geodesic calculation. See it on satellite imagery.
          </p>

          <div className="geo-hero-actions">
            <button className="geo-btn-primary" onClick={goToMeasure}>
              Start Measuring
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button className="geo-btn-secondary" onClick={() => setActiveModal('how-it-works')}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5"/>
                <polygon points="7,6 13,9 7,12" fill="currentColor"/>
              </svg>
              How It Works
            </button>
          </div>

          {/* CAPABILITY STRIP (COMPACT 4 ITEMS) */}
          <div className="geo-capability-strip">
            <div className="geo-capability-card">
              <div className="geo-capability-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 2V4M8 12V14M2 8H4M12 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="geo-capability-title">WGS84 Accurate</div>
              <div className="geo-capability-desc">Karney algorithm via GeographicLib</div>
            </div>

            <div className="geo-capability-card">
              <div className="geo-capability-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 10L6 7L10 10L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="geo-capability-title">Satellite View</div>
              <div className="geo-capability-desc">Visualize on Google Maps satellite</div>
            </div>

            <div className="geo-capability-card">
              <div className="geo-capability-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3H13V13H3V3Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 6H10M6 9H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="geo-capability-title">Detailed Report</div>
              <div className="geo-capability-desc">Export points, segments and summary</div>
            </div>

            <div className="geo-capability-card">
              <div className="geo-capability-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L3 4.5V8C3 11 5.5 13.5 8 14C10.5 13.5 13 11 13 8V4.5L8 2Z" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="geo-capability-title">Private & Secure</div>
              <div className="geo-capability-desc">Your data stays in your browser</div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 3D INTERACTIVE GLOBE */}
        <div className="geo-globe-col">
          <div className="geo-globe-wrapper">
            <Globe3D />

            {/* Drag Instruction */}
            <div className="geo-drag-hint">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8H12M4 8L6 6M4 8L6 10M12 8L10 6M12 8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Drag to rotate the globe →
            </div>

            {/* Bottom Right Privacy Badge */}
            <div className="geo-privacy-badge">
              <div className="geo-privacy-check">✓</div>
              <div>
                <div className="geo-privacy-title">No data uploaded</div>
                <div className="geo-privacy-sub">Get started in seconds.</div>
              </div>
            </div>

            {/* Need Help? Button */}
            <button className="geo-help-btn" onClick={() => setActiveModal('how-it-works')}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="600">?</text>
              </svg>
              Need help?
            </button>
          </div>
        </div>
      </main>

      {/* ─── MODAL OVERLAYS ────────────────────────────────────────── */}
      <HowItWorksModal
        isOpen={activeModal === 'how-it-works'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />

      <AccuracyModal
        isOpen={activeModal === 'accuracy'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />

      <PrivacyModal
        isOpen={activeModal === 'privacy'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
    </div>
  );
}
