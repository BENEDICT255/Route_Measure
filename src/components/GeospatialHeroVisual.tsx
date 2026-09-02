import { useState } from 'react';

interface GeospatialHeroVisualProps {
  theme?: 'light' | 'dark' | 'system';
}

export function GeospatialHeroVisual({ theme = 'light' }: GeospatialHeroVisualProps) {
  const [activePoint, setActivePoint] = useState<number | null>(null);

  return (
    <div className="geo-hero-visual-wrapper" role="img" aria-label="RouteMeasure isometric geospatial topographic transmission route visualization">
      <div className="geo-map-image-container">
        <img
          src="/images/geospatial-route-hero.png"
          alt="RouteMeasure Topographic Infrastructure Route Map"
          className="geo-map-img"
          loading="eager"
        />

        {/* Ambient gradient edge blend overlay */}
        <div className="geo-map-edge-blend" aria-hidden="true" />

        {/* Interactive Waypoint Pulse Overlays */}
        <div className="geo-interactive-overlay" aria-hidden="true">
          {/* Point 01 */}
          <div
            className={`geo-pin-hotspot pin-1 ${activePoint === 1 ? 'active' : ''}`}
            onMouseEnter={() => setActivePoint(1)}
            onMouseLeave={() => setActivePoint(null)}
          >
            <div className="geo-hotspot-pulse" />
          </div>

          {/* Point 02 */}
          <div
            className={`geo-pin-hotspot pin-2 ${activePoint === 2 ? 'active' : ''}`}
            onMouseEnter={() => setActivePoint(2)}
            onMouseLeave={() => setActivePoint(null)}
          >
            <div className="geo-hotspot-pulse" />
          </div>

          {/* Point 03 */}
          <div
            className={`geo-pin-hotspot pin-3 ${activePoint === 3 ? 'active' : ''}`}
            onMouseEnter={() => setActivePoint(3)}
            onMouseLeave={() => setActivePoint(null)}
          >
            <div className="geo-hotspot-pulse" />
          </div>

          {/* Final Destination Pin */}
          <div
            className={`geo-pin-hotspot pin-4 ${activePoint === 4 ? 'active' : ''}`}
            onMouseEnter={() => setActivePoint(4)}
            onMouseLeave={() => setActivePoint(null)}
          >
            <div className="geo-hotspot-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
