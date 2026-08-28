import { useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HowItWorksModal,
  AccuracyModal,
  PrivacyModal,
  FeaturesModal,
  UseCasesModal,
  PricingModal,
  FaqModal,
  DemoModal,
} from '../components/LandingModals';

// Lazy-load the 3D globe to ensure zero render-blocking on initial paint
const Globe3D = lazy(() =>
  import('../components/Globe3D').then((m) => ({ default: m.Globe3D }))
);

type ModalType =
  | 'how-it-works'
  | 'features'
  | 'accuracy'
  | 'use-cases'
  | 'pricing'
  | 'faq'
  | 'privacy'
  | 'demo'
  | null;

export function LandingPage() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const goToMeasure = useCallback(() => {
    const mainElem = document.querySelector('.landing-viewport');
    if (mainElem) mainElem.classList.add('page-exit');
    setTimeout(() => navigate('/measure'), 250);
  }, [navigate]);

  const handleNavClick = useCallback((modal: ModalType) => {
    setMobileMenuOpen(false);
    setActiveModal(modal);
  }, []);

  return (
    <div className="landing-viewport">
      {/* ─── HEADER NAVBAR ────────────────────────────────────────── */}
      <header className="geo-header">
        <div className="geo-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="geo-logo-icon">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <path
                d="M4 22L9 6L14 16L19 10L24 22"
                stroke="#60a5fa"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="6" r="3" fill="#38bdf8" />
              <circle cx="14" cy="16" r="2.5" fill="#60a5fa" />
              <circle cx="19" cy="10" r="3" fill="#38bdf8" />
            </svg>
          </div>
          <div className="geo-logo-text-group">
            <span className="geo-brand-name">RouteMeasure</span>
            <span className="geo-brand-tagline">Measure Today. Plan a Better Tomorrow.</span>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="geo-nav geo-nav-desktop">
          <button type="button" onClick={() => handleNavClick('how-it-works')}>
            How It Works
          </button>
          <button type="button" onClick={() => handleNavClick('features')}>
            Features
          </button>
          <button type="button" onClick={() => handleNavClick('accuracy')}>
            Accuracy
          </button>
          <button type="button" onClick={() => handleNavClick('use-cases')}>
            Use Cases
          </button>
          <button type="button" onClick={() => handleNavClick('pricing')}>
            Pricing
          </button>
          <button type="button" onClick={() => handleNavClick('faq')}>
            FAQ
          </button>
        </nav>

        {/* Right Header Controls (Theme switch + CTA) */}
        <div className="geo-header-right">
          <button
            type="button"
            className="geo-theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Theme Toggle"
            aria-label="Toggle dark/light theme"
          >
            <span className={`geo-toggle-icon ${!isDarkMode ? 'active' : ''}`}>☀️</span>
            <span className={`geo-toggle-icon ${isDarkMode ? 'active' : ''}`}>🌙</span>
          </button>

          <button type="button" className="geo-cta-btn" onClick={goToMeasure}>
            <span>Start Measuring</span>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Mobile Hamburger */}
          <button
            type="button"
            className="geo-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ─── MOBILE MENU DRAWER ───────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="geo-mobile-menu">
          <button type="button" onClick={() => handleNavClick('how-it-works')}>How It Works</button>
          <button type="button" onClick={() => handleNavClick('features')}>Features</button>
          <button type="button" onClick={() => handleNavClick('accuracy')}>Accuracy</button>
          <button type="button" onClick={() => handleNavClick('use-cases')}>Use Cases</button>
          <button type="button" onClick={() => handleNavClick('pricing')}>Pricing</button>
          <button type="button" onClick={() => handleNavClick('faq')}>FAQ</button>
          <button type="button" onClick={() => handleNavClick('privacy')}>Privacy</button>
          <button type="button" className="geo-cta-btn geo-mobile-cta" onClick={() => { setMobileMenuOpen(false); goToMeasure(); }}>
            Start Measuring →
          </button>
        </div>
      )}

      {/* ─── MAIN LANDING HERO (HERO LEFT + 3D GLOBE RIGHT) ────────── */}
      <main className="geo-main">
        {/* LEFT COLUMN: HERO CONTENT */}
        <div className="geo-hero-col">
          {/* Top Pill Badge */}
          <div className="geo-hero-badge">
            <span>PRECISE</span>
            <span className="geo-badge-bullet">•</span>
            <span>RELIABLE</span>
            <span className="geo-badge-bullet">•</span>
            <span>GLOBAL</span>
          </div>

          <h1 className="geo-title">
            Accurate Route<br />
            Distance From<br />
            <span className="geo-title-accent">Your Coordinates</span>
          </h1>

          <p className="geo-subtitle">
            Upload your Excel coordinates. Measure the route accurately
            using WGS84 geodesic calculation. Visualize it on satellite
            imagery and export detailed reports.
          </p>

          <div className="geo-hero-actions">
            <button type="button" className="geo-btn-primary" onClick={goToMeasure}>
              <span>Start Measuring</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              className="geo-btn-secondary"
              onClick={() => handleNavClick('demo')}
            >
              <div className="geo-play-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3.5 2.5L9.5 6L3.5 9.5V2.5Z" fill="white" />
                </svg>
              </div>
              <span>Watch Demo</span>
            </button>
          </div>

          {/* Trust Social Proof Strip */}
          <div className="geo-trust-strip">
            <div className="geo-trust-avatars">
              {/* Avatar 1 */}
              <div className="geo-avatar-wrap">
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                  <circle cx="17" cy="17" r="16" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" />
                  <circle cx="17" cy="12" r="5" fill="#f87171" />
                  <path d="M7 27C7 22 11.5 19 17 19C22.5 19 27 22 27 27" fill="#f87171" />
                </svg>
              </div>
              {/* Avatar 2 */}
              <div className="geo-avatar-wrap" style={{ marginLeft: '-10px' }}>
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                  <circle cx="17" cy="17" r="16" fill="#1e293b" stroke="#60a5fa" strokeWidth="1.5" />
                  <circle cx="17" cy="12" r="5" fill="#60a5fa" />
                  <path d="M7 27C7 22 11.5 19 17 19C22.5 19 27 22 27 27" fill="#60a5fa" />
                </svg>
              </div>
              {/* Avatar 3 */}
              <div className="geo-avatar-wrap" style={{ marginLeft: '-10px' }}>
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                  <circle cx="17" cy="17" r="16" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle cx="17" cy="12" r="5" fill="#fbbf24" />
                  <path d="M7 27C7 22 11.5 19 17 19C22.5 19 27 22 27 27" fill="#fbbf24" />
                </svg>
              </div>
            </div>
            <div className="geo-trust-text">
              Trusted by professionals, researchers<br />
              and organizations worldwide.
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 3D PHOTOREALISTIC EARTH & FLOATING CARDS */}
        <div className="geo-globe-col">
          <div className="geo-globe-wrapper">
            <Suspense fallback={null}>
              <Globe3D />
            </Suspense>

            {/* Floating Info Card 1: WGS84 (Equator / Left) */}
            <div className="geo-floating-badge geo-badge-wgs84">
              <div className="geo-badge-icon">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle cx="10" cy="10" r="2.5" fill="#38bdf8" />
                  <path d="M10 1V4M10 16V19M1 10H4M16 10H19" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="geo-badge-content">
                <div className="geo-badge-title">WGS84</div>
                <div className="geo-badge-desc">Geodesic Accuracy</div>
              </div>
            </div>

            {/* Floating Info Card 2: Any Location (Top Right) */}
            <div className="geo-floating-badge geo-badge-location">
              <div className="geo-badge-icon">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 2C6.7 2 4 4.7 4 8C4 12.8 10 18 10 18C10 18 16 12.8 16 8C16 4.7 13.3 2 10 2Z"
                    fill="#38bdf8"
                  />
                  <circle cx="10" cy="8" r="2.5" fill="#0f172a" />
                </svg>
              </div>
              <div className="geo-badge-content">
                <div className="geo-badge-title">Any Location</div>
                <div className="geo-badge-desc">Worldwide</div>
              </div>
            </div>

            {/* Floating Info Card 3: Visualize (Bottom Right) */}
            <div className="geo-floating-badge geo-badge-visualize">
              <div className="geo-badge-icon">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="11" width="3" height="6" rx="1" fill="#38bdf8" />
                  <rect x="8.5" y="7" width="3" height="10" rx="1" fill="#38bdf8" />
                  <rect x="14" y="3" width="3" height="14" rx="1" fill="#38bdf8" />
                </svg>
              </div>
              <div className="geo-badge-content">
                <div className="geo-badge-title">Visualize</div>
                <div className="geo-badge-desc">on Satellite Imagery</div>
              </div>
            </div>

            {/* Bottom Right Live Earth View Status */}
            <div className="geo-live-earth-indicator">
              <div className="geo-live-status-row">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle cx="8" cy="8" r="2" fill="#38bdf8" />
                </svg>
                <span className="geo-live-text">Live Earth View</span>
                <span className="geo-live-dot" />
              </div>
              <div className="geo-live-sub">
                Drag to rotate <span className="geo-sub-pipe">|</span> Powered by satellite imagery
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── MODAL OVERLAYS ────────────────────────────────────────── */}
      <HowItWorksModal
        isOpen={activeModal === 'how-it-works'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
      <FeaturesModal
        isOpen={activeModal === 'features'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
      <AccuracyModal
        isOpen={activeModal === 'accuracy'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
      <UseCasesModal
        isOpen={activeModal === 'use-cases'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
      <PricingModal
        isOpen={activeModal === 'pricing'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
      <FaqModal
        isOpen={activeModal === 'faq'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
      <PrivacyModal
        isOpen={activeModal === 'privacy'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
      <DemoModal
        isOpen={activeModal === 'demo'}
        onClose={() => setActiveModal(null)}
        onStartMeasuring={goToMeasure}
      />
    </div>
  );
}
