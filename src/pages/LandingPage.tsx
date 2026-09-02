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
    // Fallback to legacy theme key if present
    const legacy = localStorage.getItem('routemeasure_theme');
    if (legacy === 'dark') return 'dark';
    if (legacy === 'light') return 'light';
    return 'light'; // Default clean light mode inspired by editorial reference
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
    const mainElem = document.querySelector('.editorial-landing-page');
    if (mainElem) {
      mainElem.classList.add('page-exit');
    }
    setTimeout(() => {
      navigate('/measure');
    }, 200);
  }, [navigate]);

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="editorial-landing-page">
      {/* ─── 1. TOP EDITORIAL NAVIGATION ────────────────────────── */}
      <header className="editorial-header">
        <div className="editorial-header-inner">
          {/* Brand / Logo */}
          <div className="editorial-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
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

          {/* Desktop Navigation Links */}
          <nav className="editorial-nav-links">
            <button type="button" onClick={() => scrollToSection('features')}>Features</button>
            <button type="button" onClick={() => scrollToSection('modes')}>Modes</button>
            <button type="button" onClick={() => scrollToSection('how-it-works')}>How It Works</button>
            <button type="button" onClick={() => scrollToSection('reports')}>Reports</button>
            <button type="button" onClick={() => scrollToSection('about')}>About</button>
          </nav>

          {/* Right Header Actions: Theme Switcher & Get Started CTA */}
          <div className="editorial-header-actions">
            {/* Theme Selector (Light / Dark / System) */}
            <div className="editorial-theme-selector" role="radiogroup" aria-label="Theme selector">
              <button
                type="button"
                className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`}
                onClick={() => setThemeMode('light')}
                title="Light Theme"
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

            {/* Mobile Hamburger Toggle */}
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

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="editorial-mobile-drawer">
            <button type="button" onClick={() => scrollToSection('features')}>Features</button>
            <button type="button" onClick={() => scrollToSection('modes')}>Modes</button>
            <button type="button" onClick={() => scrollToSection('how-it-works')}>How It Works</button>
            <button type="button" onClick={() => scrollToSection('reports')}>Reports</button>
            <button type="button" onClick={() => scrollToSection('about')}>About</button>
            <div className="editorial-mobile-drawer-footer">
              <button type="button" className="editorial-btn-primary" onClick={goToMeasure}>
                Continue to site →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ─── 2. HERO SECTION ────────────────────────────────────── */}
      <section className="editorial-hero-section">
        <div className="editorial-hero-grid">
          {/* Left Column: Large Editorial Typography & Action Buttons */}
          <div className="editorial-hero-content">
            <h1 className="editorial-hero-title">
              Measure.<br />
              Visualize.<br />
              <span className="editorial-title-accent">Deliver.</span>
            </h1>

            <p className="editorial-hero-subtitle">
              RouteMeasure helps utility engineers, surveyors, GIS teams and infrastructure professionals
              calculate, visualize, and report precise geospatial measurements — directly from coordinate data.
            </p>

            {/* Restrained, Functional CTAs */}
            <div className="editorial-hero-actions">
              <button
                type="button"
                className="editorial-btn-primary"
                onClick={goToMeasure}
                aria-label="Continue to RouteMeasure site"
              >
                Continue to site
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button
                type="button"
                className="editorial-btn-secondary"
                onClick={() => scrollToSection('how-it-works')}
                aria-label="See how RouteMeasure works"
              >
                See how it works
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M8 13L13 8M8 13L3 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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

          {/* Right Column: Isometric Topographic Geospatial Visualization */}
          <div className="editorial-hero-visual-col">
            <GeospatialHeroVisual theme={themeMode} />
          </div>
        </div>
      </section>

      {/* ─── 3. HORIZONTAL CAPABILITY STRIP ─────────────────────── */}
      <section className="editorial-strip-section" id="features">
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
      </section>

      {/* ─── 4. SECONDARY SECTION: CORE EDITORIAL PILLARS ───────── */}
      <section className="editorial-pillars-section">
        <div className="editorial-section-header">
          <div className="editorial-section-tag">ENGINEERING CAPABILITIES</div>
          <h2 className="editorial-section-heading">
            Everything you need to turn coordinates into decisions.
          </h2>
          <p className="editorial-section-lead">
            Purpose-built for power utility routing, surveying pipelines, substation interconnections,
            and regional infrastructure logistics.
          </p>
        </div>

        <div className="editorial-pillars-grid">
          {/* Pillar 01 */}
          <div className="editorial-pillar-card">
            <div className="pillar-num">01</div>
            <div className="pillar-title">Measure</div>
            <p className="pillar-desc">
              Accurately calculate distances between coordinate points using WGS84 ellipsoidal geodesic
              calculations via the Charles Karney algorithm.
            </p>
            <div className="pillar-tag-list">
              <span>WGS84 Ellipsoid</span>
              <span>GeodesicLib</span>
              <span>3D Elevation</span>
            </div>
          </div>

          {/* Pillar 02 */}
          <div className="editorial-pillar-card">
            <div className="pillar-num">02</div>
            <div className="pillar-title">Visualize</div>
            <p className="pillar-desc">
              Transform coordinate tables into high-definition route polylines and satellite overlays with
              interactive pole, tower, and site markers.
            </p>
            <div className="pillar-tag-list">
              <span>Satellite Mapping</span>
              <span>Interactive Nodes</span>
              <span>Vector Polylines</span>
            </div>
          </div>

          {/* Pillar 03 */}
          <div className="editorial-pillar-card">
            <div className="pillar-num">03</div>
            <div className="pillar-title">Analyze</div>
            <p className="pillar-desc">
              Understand route segments, cumulative chainage, voltage classifications (LV vs. MV),
              and proximity rankings with automated statistics.
            </p>
            <div className="pillar-tag-list">
              <span>LV/MV Separation</span>
              <span>Proximity Sorting</span>
              <span>Point Matrix</span>
            </div>
          </div>

          {/* Pillar 04 */}
          <div className="editorial-pillar-card">
            <div className="pillar-num">04</div>
            <div className="pillar-title">Deliver</div>
            <p className="pillar-desc">
              Generate formatted multi-sheet Excel calculation audits and spatial KML files for immediate
              use in AutoCAD, ArcGIS, and Google Earth Pro.
            </p>
            <div className="pillar-tag-list">
              <span>Excel .xlsx</span>
              <span>Google Earth .kml</span>
              <span>Client Audits</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. DUAL MEASUREMENT MODES SECTION ───────────────────── */}
      <section className="editorial-modes-section" id="modes">
        <div className="editorial-section-header">
          <div className="editorial-section-tag">CALCULATION WORKFLOWS</div>
          <h2 className="editorial-section-heading">Two specialized measurement engines.</h2>
          <p className="editorial-section-lead">
            Select the exact workflow designed for your infrastructure project.
          </p>
        </div>

        <div className="editorial-modes-grid">
          {/* Mode 1 Card */}
          <div className="editorial-mode-card">
            <div className="mode-card-badge mode-badge-blue">MODE 01</div>
            <h3 className="mode-card-title">LV &amp; MV Network Polyline</h3>
            <p className="mode-card-desc">
              Designed for transmission lines, distribution grids, and pipeline corridors. Measures sequential
              poles/towers along ordered coordinate tracks.
            </p>
            <ul className="mode-feature-list">
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Ordered coordinate path tracing with span-by-span chainage
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Automatic Low Voltage (LV) and Medium Voltage (MV) classification
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Interactive segment inspection &amp; satellite elevation profiles
              </li>
            </ul>
            <div className="mode-card-footer">
              <button type="button" className="editorial-link-btn" onClick={goToMeasure}>
                Open Polyline Mode →
              </button>
            </div>
          </div>

          {/* Mode 2 Card */}
          <div className="editorial-mode-card">
            <div className="mode-card-badge mode-badge-emerald">MODE 02</div>
            <h3 className="mode-card-title">Point-to-Point Distance Matrix</h3>
            <p className="mode-card-desc">
              Designed for regional logistics, hub-and-spoke networks, and warehouse-to-site distance auditing.
              Calculates direct geodesic lines from an origin.
            </p>
            <ul className="mode-feature-list">
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Origin-to-destination direct geodesic distance calculations
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Interactive destination assignment spreadsheet (Assigned / Excluded)
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Automated nearest-to-farthest proximity ranking &amp; summaries
              </li>
            </ul>
            <div className="mode-card-footer">
              <button type="button" className="editorial-link-btn emerald" onClick={goToMeasure}>
                Open Distance Mode →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. HOW IT WORKS SECTION ────────────────────────────── */}
      <section className="editorial-workflow-section" id="how-it-works">
        <div className="editorial-section-header">
          <div className="editorial-section-tag">STREAMLINED PROCESS</div>
          <h2 className="editorial-section-heading">From raw workbook to measured route in seconds.</h2>
          <p className="editorial-section-lead">
            No complex GIS setup or desktop license required.
          </p>
        </div>

        <div className="editorial-steps-grid">
          <div className="editorial-step-card">
            <div className="step-badge">STEP 1</div>
            <div className="step-title">Upload Excel Workbook</div>
            <p className="step-desc">
              Drag and drop any spreadsheet containing latitude, longitude, and optional pole or site identifiers.
            </p>
          </div>

          <div className="editorial-step-card">
            <div className="step-badge">STEP 2</div>
            <div className="step-title">Automated Detection</div>
            <p className="step-desc">
              RouteMeasure automatically identifies headers, validates coordinate formats, and detects sheets.
            </p>
          </div>

          <div className="editorial-step-card">
            <div className="step-badge">STEP 3</div>
            <div className="step-title">Geodesic Math Engine</div>
            <p className="step-desc">
              Calculates exact surface distances over the WGS84 rotational ellipsoid using Karney's algorithms.
            </p>
          </div>

          <div className="editorial-step-card">
            <div className="step-badge">STEP 4</div>
            <div className="step-title">Inspect &amp; Export</div>
            <p className="step-desc">
              Review interactive maps and download audit-ready Excel reports and Google Earth KML files.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 7. REPORTS & GIS EXPORT SECTION ─────────────────────── */}
      <section className="editorial-reports-section" id="reports">
        <div className="editorial-reports-card">
          <div className="reports-card-content">
            <div className="editorial-section-tag">OUTPUTS &amp; INTEROPERABILITY</div>
            <h2 className="editorial-reports-heading">
              Export professional deliverables in formats your team already uses.
            </h2>
            <p className="editorial-reports-desc">
              Every calculation generates structured, reproducible outputs formatted according to international
              engineering standards.
            </p>
            <div className="reports-actions">
              <button type="button" className="editorial-btn-primary" onClick={goToMeasure}>
                Continue to site →
              </button>
            </div>
          </div>

          <div className="reports-card-specs">
            <div className="spec-box">
              <div className="spec-label">EXCEL SUMMARY &amp; AUDIT</div>
              <div className="spec-val">.xlsx with multi-tab breakdown, chainage, and segment statistics</div>
            </div>
            <div className="spec-box">
              <div className="spec-label">GIS / GOOGLE EARTH</div>
              <div className="spec-val">.kml spatial layers with styled path coordinates and pole pins</div>
            </div>
            <div className="spec-box">
              <div className="spec-label">SECURITY &amp; AUDITABILITY</div>
              <div className="spec-val">100% in-browser processing with zero telemetry or remote storage</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. ABOUT & ACCURACY TRUST SECTION ──────────────────── */}
      <section className="editorial-about-section" id="about">
        <div className="editorial-about-grid">
          <div>
            <div className="editorial-section-tag">MATHEMATICAL RIGOR</div>
            <h2 className="editorial-about-heading">
              Built on the gold standard of geodesic algorithms.
            </h2>
          </div>
          <div>
            <p className="editorial-about-body">
              Unlike spherical approximations (Haversine) which introduce errors up to 0.5% over long transmission
              spans, RouteMeasure implements Charles Karney's algorithms on the WGS84 rotational ellipsoid.
              This guarantees millimeter accuracy for power lines, subsea cables, and regional infrastructure.
            </p>
            <div className="about-metrics-row">
              <div className="about-metric">
                <div className="metric-number">WGS84</div>
                <div className="metric-label">Ellipsoid Model</div>
              </div>
              <div className="about-metric">
                <div className="metric-number">0.5 nm</div>
                <div className="metric-label">Algorithm Tolerance</div>
              </div>
              <div className="about-metric">
                <div className="metric-number">0 sec</div>
                <div className="metric-label">Server Latency</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. EDITORIAL FOOTER ─────────────────────────────────── */}
      <footer className="editorial-footer">
        <div className="editorial-footer-inner">
          <div className="footer-brand-col">
            <div className="editorial-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="editorial-logo-icon">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="#2563eb" fillOpacity="0.16" />
                  <path d="M8 24L12 8L16 18L20 12L24 24" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="8" r="2.2" fill="#2563eb" />
                  <circle cx="16" cy="18" r="2.2" fill="#2563eb" />
                  <circle cx="20" cy="12" r="2.2" fill="#2563eb" />
                </svg>
              </div>
              <span className="editorial-brand-name">RouteMeasure</span>
            </div>
            <p className="footer-tagline">
              Precision geospatial measurement for infrastructure professionals.
            </p>
          </div>

          <nav className="footer-nav-col">
            <button type="button" onClick={() => scrollToSection('features')}>Features</button>
            <button type="button" onClick={() => scrollToSection('modes')}>Modes</button>
            <button type="button" onClick={() => scrollToSection('how-it-works')}>How It Works</button>
            <button type="button" onClick={() => scrollToSection('reports')}>Reports</button>
            <button type="button" onClick={() => scrollToSection('about')}>About</button>
          </nav>
        </div>

        <div className="editorial-footer-bottom">
          <div className="footer-copyright">
            © {new Date().getFullYear()} RouteMeasure. All calculations performed client-side.
          </div>
          <div className="footer-privacy-note">
            WGS84 Geodesic Engine via GeographicLib
          </div>
        </div>
      </footer>

      {/* Modals */}
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
