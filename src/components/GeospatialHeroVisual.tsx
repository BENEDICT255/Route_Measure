import { useState, useId } from 'react';

interface GeospatialHeroVisualProps {
  theme?: 'light' | 'dark' | 'system';
}

interface Waypoint {
  id: string;
  name: string;
  lat: string;
  lng: string;
  x: number;
  y: number;
  groundY: number;
  elevation: string;
  cumulativeDist: string;
  highlighted?: boolean;
}

export function GeospatialHeroVisual({ theme = 'light' }: GeospatialHeroVisualProps) {
  const [activePoint, setActivePoint] = useState<string | null>(null);
  const maskId = useId();
  const gradId = useId();

  // Infrastructure route waypoints (Perspective Topographic coordinates)
  const waypoints: Waypoint[] = [
    {
      id: 'pt-01',
      name: 'POINT 01',
      lat: '-6.792311',
      lng: '39.208153',
      x: 140,
      y: 430,
      groundY: 458,
      elevation: '42m',
      cumulativeDist: '0.000 km',
      highlighted: true,
    },
    {
      id: 'pt-02',
      name: 'POINT 02',
      lat: '-6.802671',
      lng: '39.245194',
      x: 295,
      y: 345,
      groundY: 378,
      elevation: '88m',
      cumulativeDist: '3.120 km',
    },
    {
      id: 'pt-03',
      name: 'POINT 03',
      lat: '-6.814093',
      lng: '39.278532',
      x: 470,
      y: 285,
      groundY: 320,
      elevation: '145m',
      cumulativeDist: '6.840 km',
      highlighted: true,
    },
    {
      id: 'pt-04',
      name: 'POINT 04',
      lat: '-6.829144',
      lng: '39.314201',
      x: 620,
      y: 205,
      groundY: 242,
      elevation: '192m',
      cumulativeDist: '9.915 km',
    },
    {
      id: 'pt-05',
      name: 'POINT 05',
      lat: '-6.841029',
      lng: '39.352187',
      x: 775,
      y: 135,
      groundY: 175,
      elevation: '230m',
      cumulativeDist: '12.458 km',
      highlighted: true,
    },
  ];

  // Route path strings
  const aerialRoutePath = `M ${waypoints[0].x} ${waypoints[0].y} ` +
    `L 215 385 ` +
    `L ${waypoints[1].x} ${waypoints[1].y} ` +
    `L 380 315 ` +
    `L ${waypoints[2].x} ${waypoints[2].y} ` +
    `L 545 245 ` +
    `L ${waypoints[3].x} ${waypoints[3].y} ` +
    `L 700 168 ` +
    `L ${waypoints[4].x} ${waypoints[4].y}`;

  const groundShadowPath = `M ${waypoints[0].x} ${waypoints[0].groundY} ` +
    `L 215 415 ` +
    `L ${waypoints[1].x} ${waypoints[1].groundY} ` +
    `L 380 348 ` +
    `L ${waypoints[2].x} ${waypoints[2].groundY} ` +
    `L 545 280 ` +
    `L ${waypoints[3].x} ${waypoints[3].groundY} ` +
    `L 700 205 ` +
    `L ${waypoints[4].x} ${waypoints[4].groundY}`;

  return (
    <div className="geo-hero-visual-container" role="img" aria-label="Geospatial route measurement isometric visualization">
      <svg
        viewBox="0 0 920 580"
        className="geo-hero-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Radial edge mask for seamless blending into landing page */}
          <radialGradient id={maskId} cx="55%" cy="50%" r="52%" fx="55%" fy="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="65%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="85%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={`${gradId}-route`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--geo-route-start, #2563eb)" />
            <stop offset="50%" stopColor="var(--geo-route-mid, #3b82f6)" />
            <stop offset="100%" stopColor="var(--geo-route-end, #60a5fa)" />
          </linearGradient>

          <linearGradient id={`${gradId}-ground`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--geo-contour-line, rgba(37, 99, 235, 0.15))" />
            <stop offset="100%" stopColor="var(--geo-contour-line, rgba(37, 99, 235, 0.05))" />
          </linearGradient>

          {/* Marker Drop Shadow */}
          <filter id="geo-pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.18)" />
          </filter>
        </defs>

        <g mask={`url(#${maskId})`}>
          {/* ─── 1. ISOMETRIC PERSPECTIVE GRID ─────────────────────── */}
          <g className="geo-iso-grid" stroke="var(--geo-grid-stroke, rgba(148, 163, 184, 0.12))" strokeWidth="0.8">
            {/* Horizontal-diagonal grid lines */}
            <line x1="60" y1="480" x2="680" y2="170" strokeDasharray="3 4" />
            <line x1="120" y1="520" x2="740" y2="210" strokeDasharray="3 4" />
            <line x1="180" y1="560" x2="800" y2="250" strokeDasharray="3 4" />
            <line x1="0" y1="440" x2="620" y2="130" strokeDasharray="3 4" />
            <line x1="240" y1="580" x2="860" y2="270" strokeDasharray="3 4" />

            {/* Cross-diagonal grid lines */}
            <line x1="100" y1="200" x2="400" y2="550" strokeDasharray="3 4" />
            <line x1="250" y1="130" x2="550" y2="480" strokeDasharray="3 4" />
            <line x1="400" y1="70" x2="700" y2="420" strokeDasharray="3 4" />
            <line x1="550" y1="30" x2="850" y2="380" strokeDasharray="3 4" />
          </g>

          {/* ─── 2. TOPOGRAPHIC CONTOUR LINES ──────────────────────── */}
          <g className="geo-topography" fill="none" stroke="var(--geo-contour-stroke, rgba(148, 163, 184, 0.22))">
            {/* Base elevation contours */}
            <path
              d="M 50 490 C 140 470, 220 510, 310 490 C 400 470, 480 430, 560 440 C 650 450, 730 400, 840 370"
              strokeWidth="1"
            />
            <path
              d="M 70 460 C 160 435, 240 480, 340 455 C 440 430, 510 390, 590 405 C 670 420, 750 360, 860 330"
              strokeWidth="1.2"
            />
            <path
              d="M 90 430 C 180 400, 270 445, 370 415 C 470 385, 540 350, 620 365 C 700 380, 780 320, 880 290"
              strokeWidth="0.9"
            />
            <path
              d="M 120 395 C 210 365, 300 410, 400 380 C 500 350, 570 310, 650 325 C 730 340, 810 275, 900 250"
              strokeWidth="1.4"
            />
            <path
              d="M 150 360 C 240 330, 330 370, 430 340 C 530 310, 600 270, 680 285 C 760 300, 830 230, 910 210"
              strokeWidth="1"
            />
            <path
              d="M 190 320 C 280 290, 370 330, 470 295 C 560 260, 640 225, 720 240 C 790 250, 860 185, 920 165"
              strokeWidth="1.3"
            />
            <path
              d="M 230 275 C 320 245, 410 285, 510 250 C 600 215, 680 175, 760 190 C 830 200, 890 140, 930 120"
              strokeWidth="0.9"
            />
            <path
              d="M 280 230 C 370 200, 460 235, 560 200 C 650 165, 730 125, 810 140 C 870 150, 920 95, 940 80"
              strokeWidth="1.1"
            />

            {/* Subtle River / Drainage Valley Feature */}
            <path
              d="M 280 520 Q 360 480 430 420 T 520 320 T 640 220 T 780 90"
              stroke="var(--geo-water-stroke, rgba(59, 130, 246, 0.35))"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
          </g>

          {/* ─── 3. TOPOGRAPHIC ELEVATION SHADING PATCHES ────────── */}
          <g className="geo-terrain-shading" fill="var(--geo-terrain-fill, rgba(37, 99, 235, 0.03))">
            <path d="M 120 460 Q 240 420 340 455 Q 440 430 510 390 Q 590 405 670 420 L 750 360 L 780 410 L 400 520 Z" />
            <path d="M 370 330 Q 470 295 560 260 Q 640 225 720 240 L 790 250 L 730 340 L 430 380 Z" />
          </g>

          {/* ─── 4. GROUND SHADOW PROJECTION ───────────────────────── */}
          <g className="geo-ground-projection">
            <path
              d={groundShadowPath}
              fill="none"
              stroke="var(--geo-shadow-stroke, rgba(15, 23, 42, 0.18))"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Vertical drop lines from aerial wire to ground */}
            {waypoints.map((wp) => (
              <line
                key={`dropline-${wp.id}`}
                x1={wp.x}
                y1={wp.y}
                x2={wp.x}
                y2={wp.groundY}
                stroke="var(--geo-dropline-stroke, rgba(37, 99, 235, 0.35))"
                strokeWidth="1.2"
                strokeDasharray="2 3"
              />
            ))}

            {/* Ground footprint circles */}
            {waypoints.map((wp) => (
              <ellipse
                key={`groundpt-${wp.id}`}
                cx={wp.x}
                cy={wp.groundY}
                rx="7"
                ry="3"
                fill="none"
                stroke="var(--geo-footprint-stroke, rgba(37, 99, 235, 0.45))"
                strokeWidth="1"
              />
            ))}
          </g>

          {/* ─── 5. AERIAL TRANSMISSION ROUTE ──────────────────────── */}
          <g className="geo-aerial-route">
            {/* Outer Glow Halo for Route */}
            <path
              d={aerialRoutePath}
              fill="none"
              stroke="var(--geo-route-glow, rgba(37, 99, 235, 0.25))"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Primary Sharp Route Line */}
            <path
              d={aerialRoutePath}
              fill="none"
              stroke={`url(#${gradId}-route)`}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Route segment measurement markers (intermediate vertex nodes) */}
            <circle cx="215" cy="385" r="2.5" fill="var(--geo-vertex-fill, #2563eb)" />
            <circle cx="380" cy="315" r="2.5" fill="var(--geo-vertex-fill, #2563eb)" />
            <circle cx="545" cy="245" r="2.5" fill="var(--geo-vertex-fill, #2563eb)" />
            <circle cx="700" cy="168" r="2.5" fill="var(--geo-vertex-fill, #2563eb)" />
          </g>

          {/* ─── 6. DISTANCE MEASUREMENT CALLOUT (12.458 km) ───────── */}
          <g className="geo-measurement-callout" transform="translate(485, 395)">
            {/* Measurement Baseline Line with End Ticks */}
            <line x1="0" y1="20" x2="155" y2="20" stroke="var(--geo-measure-line, #2563eb)" strokeWidth="1.2" />
            <line x1="0" y1="14" x2="0" y2="26" stroke="var(--geo-measure-line, #2563eb)" strokeWidth="1.5" />
            <line x1="155" y1="14" x2="155" y2="26" stroke="var(--geo-measure-line, #2563eb)" strokeWidth="1.5" />

            {/* Intermediate tick markers */}
            <line x1="38" y1="17" x2="38" y2="23" stroke="var(--geo-measure-line, #2563eb)" strokeWidth="0.8" opacity="0.6" />
            <line x1="77" y1="16" x2="77" y2="24" stroke="var(--geo-measure-line, #2563eb)" strokeWidth="1" opacity="0.8" />
            <line x1="116" y1="17" x2="116" y2="23" stroke="var(--geo-measure-line, #2563eb)" strokeWidth="0.8" opacity="0.6" />

            {/* Prominent Value */}
            <text
              x="77.5"
              y="10"
              textAnchor="middle"
              className="geo-measure-val-text"
              fill="var(--geo-text-primary, #0f172a)"
              fontSize="19"
              fontWeight="700"
              letterSpacing="-0.02em"
              fontFamily="var(--font-family, system-ui, -apple-system, sans-serif)"
            >
              12.458 <tspan fontSize="13" fontWeight="500" fill="var(--geo-text-muted, #64748b)">km</tspan>
            </text>

            <text
              x="77.5"
              y="37"
              textAnchor="middle"
              fill="var(--geo-text-muted, #64748b)"
              fontSize="9.5"
              fontWeight="600"
              letterSpacing="0.08em"
              fontFamily="var(--font-family, system-ui, -apple-system, sans-serif)"
            >
              WGS84 GEODESIC DISTANCE
            </text>
          </g>

          {/* ─── 7. WAYPOINT PINS & TOWER ANNOTATIONS ──────────────── */}
          {waypoints.map((wp) => {
            const isHovered = activePoint === wp.id;
            const showDetails = wp.highlighted || isHovered;

            return (
              <g
                key={wp.id}
                className="geo-waypoint-group"
                onMouseEnter={() => setActivePoint(wp.id)}
                onMouseLeave={() => setActivePoint(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer Pulse Ring */}
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r="14"
                  fill="none"
                  stroke="var(--geo-pin-ring, rgba(37, 99, 235, 0.25))"
                  strokeWidth="1.2"
                />

                {/* Main Pin Disc */}
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r="8.5"
                  fill="var(--geo-pin-bg, #ffffff)"
                  stroke="var(--geo-pin-border, #2563eb)"
                  strokeWidth="2.2"
                  filter="url(#geo-pin-shadow)"
                />

                {/* Pin Center Dot */}
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r="3.5"
                  fill="var(--geo-pin-center, #2563eb)"
                />

                {/* Infrastructure Tower Icon / Top Antenna */}
                <path
                  d={`M ${wp.x} ${wp.y - 8.5} L ${wp.x} ${wp.y - 14} M ${wp.x - 3} ${wp.y - 11} L ${wp.x + 3} ${wp.y - 11}`}
                  stroke="var(--geo-pin-border, #2563eb)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />

                {/* Waypoint Technical Metadata Callout */}
                {showDetails && (
                  <g
                    className="geo-waypoint-label"
                    transform={`translate(${wp.x + (wp.x > 650 ? -110 : 16)}, ${wp.y - 28})`}
                  >
                    {/* Small Glass / Solid Badge */}
                    <rect
                      x="-6"
                      y="-12"
                      width="98"
                      height="46"
                      rx="6"
                      fill="var(--geo-badge-bg, rgba(255, 255, 255, 0.92))"
                      stroke="var(--geo-badge-border, rgba(226, 232, 240, 0.9))"
                      strokeWidth="1"
                      filter="url(#geo-pin-shadow)"
                    />

                    {/* Point Name */}
                    <text
                      x="0"
                      y="2"
                      fill="var(--geo-badge-title, #2563eb)"
                      fontSize="9.5"
                      fontWeight="700"
                      letterSpacing="0.06em"
                      fontFamily="var(--font-family, system-ui, -apple-system, sans-serif)"
                    >
                      {wp.name}
                    </text>

                    {/* Lat / Lng Coordinates */}
                    <text
                      x="0"
                      y="16"
                      fill="var(--geo-badge-coords, #334155)"
                      fontSize="8.5"
                      fontWeight="500"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    >
                      {wp.lat}
                    </text>
                    <text
                      x="0"
                      y="27"
                      fill="var(--geo-badge-coords, #334155)"
                      fontSize="8.5"
                      fontWeight="500"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    >
                      {wp.lng}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
