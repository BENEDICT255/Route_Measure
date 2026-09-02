import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeospatialHeroVisual } from '../components/GeospatialHeroVisual';
import { HowItWorksModal, AccuracyModal, PrivacyModal } from '../components/LandingModals';

type ThemeMode = 'light' | 'dark' | 'system';

export function LandingPage() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<'how-it-works' | 'accuracy' | 'privacy' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('routemeasure_theme_mode') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    const legacy = localStorage.getItem('routemeasure_theme');
    if (legacy === 'dark') return 'dark';
    if (legacy === 'light') return 'light';
    return 'light'; // Default cream light mode
  });

  // Apply theme to document
  useEffect(() => {
    const applyTheme = () => {
      let resolvedTheme: 'light' | 'dark' = 'light';
      if (themeMode === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolvedTheme = systemPrefersDark ? 'dark' : 'light';
      } else {
        resolvedTheme = themeMode;
      }

      document.documentElement.setAttribute('data-theme', resolvedTheme);
      localStorage.setItem('routemeasure_theme_mode', themeMode);
      localStorage.setItem('routemeasure_theme', resolvedTheme);
    };

    applyTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const goToMeasure = useCallback(() => {
    const mainElem = document.querySelector('.editorial-single-page');
    if (mainElem) {
      mainElem.classList.add('page-exit');
    }
    setTimeout(() => {
      navigate('/measure');
    }, 200);
  }, [navigate]);

  return (
    <div className="editorial-single-page">
      {/* ─── 1. TOP EDITORIAL NAVIGATION ────────────────────────── */}
      <header className="editorial-header">
        <div className="editorial-header-inner">
          {/* Brand / Logo */}
          <div className="editorial-brand" onClick={() => window.location.reload()}>
            <div className="editorial-logo-icon">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#2563eb" fillOpacity="0.16" />
                <path d="M8 24L12 8L16 18L20 12L24 24" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="8" r="2.2" fill="#2563eb" />
                <circle cx="16" cy="18" r="2.2" fill="#2563eb" />
                <circle cx="20" cy="12" r="2.2" fill="#2563eb" />
              </svg>
            </div>
            <span className="editorial-brand-name">RouteMeasure</span>
          </div>

          {/* Desktop Navigation Links (Open informative modals) */}
          <nav className="editorial-nav-links">
            <button type="button" onClick={() => setActiveModal('accuracy')}>Features</button>
            <button type="button" onClick={() => setActiveModal('how-it-works')}>Modes</button>
            <button type="button" onClick={() => setActiveModal('how-it-works')}>How It Works</button>
            <button type="button" onClick={() => setActiveModal('accuracy')}>Reports</button>
            <button type="button" onClick={() => setActiveModal('privacy')}>About</button>
          </nav>

          {/* Right Header Actions: Theme Switcher & Get Started CTA */}
          <div className="editorial-header-actions">
            {/* Theme Selector (Light / Dark / Auto) */}
            <div className="editorial-theme-selector" role="radiogroup" aria-label="Theme selector">
              <button
                type="button"
                className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`}
                onClick={() => setThemeMode('light')}
                title="Light Cream Theme"
                aria-label="Light mode"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="8" r="3.5" />
                  <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="theme-label">Light</span>
              </button>
              <button
                type="button"
                className={`theme-btn ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => setThemeMode('dark')}
                title="Dark Theme"
                aria-label="Dark mode"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 2a6 6 0 0 0 8 8 7 7 0 1 1-8-8z" />
                </svg>
                <span className="theme-label">Dark</span>
              </button>
              <button
                type="button"
                className={`theme-btn ${themeMode === 'system' ? 'active' : ''}`}
                onClick={() => setThemeMode('system')}
                title="Follow Operating System Theme"
                aria-label="System mode"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="12" height="9" rx="1.5" />
                  <path d="M6 14h4M8 12v2" strokeLinecap="round" />
                </svg>
                <span className="theme-label">Auto</span>
              </button>
            </div>

            {/* Primary Navigation CTA */}
            <button type="button" className="editorial-nav-cta" onClick={goToMeasure}>
              Get Started
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Mobile Hamburger */}
            <button
              type="button"
              className="editorial-hamburger-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                {mobileMenuOpen ? (
                  <path d="M4 4L16 16M4 16L16 4" strokeLinecap="round" />
                ) : (
                  <path d="M3 6H17M3 10H17M3 14H17" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="editorial-mobile-drawer">
            <button type="button" onClick={() => { setMobileMenuOpen(false); setActiveModal('how-it-works'); }}>How It Works</button>
            <button type="button" onClick={() => { setMobileMenuOpen(false); setActiveModal('accuracy'); }}>Accuracy &amp; Methodology</button>
            <button type="button" onClick={() => { setMobileMenuOpen(false); setActiveModal('privacy'); }}>Security &amp; Privacy</button>
            <div className="editorial-mobile-drawer-footer">
              <button type="button" className="editorial-btn-primary" onClick={goToMeasure}>
                Continue to site →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─── 2. MAIN SINGLE-PAGE HERO COMPOSITION ───────────────── */}
      <main className="editorial-main-hero">
        <div className="editorial-hero-grid">
          {/* Left Column: Large Editorial Typography & Action Buttons */}
          <div className="editorial-hero-content">
            <h1 className="editorial-hero-title">
              Measure.<br />
              Visualize.<br />
              <span className="editorial-title-accent">Deliver.</span>
            </h1>

            <p className="editorial-hero-subtitle">
              High-precision WGS84 geodesic route calculation and network polyline mapping for power transmission lines,
              utility infrastructure, and survey engineering — 100% in-browser from your coordinate spreadsheets.
            </p>

            {/* Action Buttons */}
            <div className="editorial-hero-actions">
              <button
                type="button"
                className="editorial-btn-primary"
                onClick={goToMeasure}
                aria-label="Continue to RouteMeasure workspace"
              >
                Continue to site
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button
                type="button"
                className="editorial-btn-secondary"
                onClick={() => setActiveModal('how-it-works')}
                aria-label="Open how it works modal"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
                  <polygon points="7,6 13,9 7,12" fill="currentColor" />
                </svg>
                See how it works
              </button>
            </div>

            {/* Subtle Privacy Trust Microcopy */}
            <div className="editorial-hero-trust">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="6" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 6V4a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>Client-side processing · Your coordinate data stays on your device</span>
            </div>
          </div>

          {/* Right Column: Attached Isometric Topographic Route Map */}
          <div className="editorial-hero-visual-col">
            <GeospatialHeroVisual theme={themeMode} />
          </div>
        </div>
      </main>

      {/* ─── 3. BOTTOM COMPACT CAPABILITY STRIP (INTEGRATED) ────── */}
      <footer className="editorial-single-page-footer">
        <div className="editorial-strip-container">
          {/* Capability 1 */}
          <div className="editorial-strip-item">
            <div className="strip-icon-box">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="10" r="7" />
                <path d="M10 3V6M10 14V17M3 10H6M14 10H17" strokeLinecap="round" />
                <circle cx="10" cy="10" r="2" fill="currentColor" />
              </svg>
            </div>
            <div className="strip-text-box">
              <div className="strip-title">WGS84 GEODESIC</div>
              <div className="strip-desc">Karney algorithm millimeter precision</div>
            </div>
          </div>

          {/* Divider */}
          <div className="editorial-strip-divider" />

          {/* Capability 2 */}
          <div className="editorial-strip-item">
            <div className="strip-icon-box">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M10 2L3 5.5V10C3 14.5 6 17.5 10 18.5C14 17.5 17 14.5 17 10V5.5L10 2Z" />
                <path d="M8 10L9.5 11.5L12.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="strip-text-box">
              <div className="strip-title">100% PRIVATE</div>
              <div className="strip-desc">Client-side processing on your device</div>
            </div>
          </div>

          {/* Divider */}
          <div className="editorial-strip-divider" />

          {/* Capability 3 */}
          <div className="editorial-strip-item">
            <div className="strip-icon-box">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 3H13L17 7V17H4V3Z" />
                <path d="M13 3V7H17" />
                <path d="M7 11H13M7 14H11" strokeLinecap="round" />
              </svg>
            </div>
            <div className="strip-text-box">
              <div className="strip-title">EXPORT &amp; SHARE</div>
              <div className="strip-desc">Engineering-ready Excel reports</div>
            </div>
          </div>

          {/* Divider */}
          <div className="editorial-strip-divider" />

          {/* Capability 4 */}
          <div className="editorial-strip-item">
            <div className="strip-icon-box">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="10" r="7.5" />
                <path d="M2.5 10H17.5M10 2.5C12 5 13 7.5 13 10C13 12.5 12 15 10 17.5C8 15 7 12.5 7 10C7 7.5 8 5 10 2.5Z" />
              </svg>
            </div>
            <div className="strip-text-box">
              <div className="strip-title">GIS READY</div>
              <div className="strip-desc">KML and GIS-compatible outputs</div>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── MODAL OVERLAYS (Triggered by 'See how it works' and Nav) ── */}
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
