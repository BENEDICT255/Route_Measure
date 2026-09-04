import { useState, useEffect } from 'react';

interface AssistantButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnreadOrPrepared?: boolean;
}

export function AssistantButton({ isOpen, onToggle, hasUnreadOrPrepared }: AssistantButtonProps) {
  const [showCallout, setShowCallout] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(() => {
    try {
      return sessionStorage.getItem('rm_assistant_opened') === 'true';
    } catch {
      return false;
    }
  });

  // Callout timing: 0 to 10 seconds on initial entry if never opened
  useEffect(() => {
    if (hasBeenOpened || isOpen) return;

    setShowCallout(true);
    const calloutTimer = setTimeout(() => {
      setShowCallout(false);
    }, 10000); // 10 seconds

    return () => clearTimeout(calloutTimer);
  }, [hasBeenOpened, isOpen]);

  // Periodic attention motion every 20s if unopened
  useEffect(() => {
    if (hasBeenOpened || isOpen) return;

    const interval = setInterval(() => {
      // Check prefers-reduced-motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
      setIsPulsing(true);
      setTimeout(() => {
        setIsPulsing(false);
      }, 950); // Under 1 second
    }, 20000); // Every 20s

    return () => clearInterval(interval);
  }, [hasBeenOpened, isOpen]);

  const handleClick = () => {
    if (!hasBeenOpened) {
      setHasBeenOpened(true);
      setShowCallout(false);
      try {
        sessionStorage.setItem('rm_assistant_opened', 'true');
      } catch {
        // Ignore storage errors
      }
    }
    onToggle();
  };

  return (
    <div className="rm-assistant-launcher-container" role="region" aria-label="RouteMeasure Assistant Quick Access">
      {/* 10-Second Introductory Callout with Curved Hint */}
      {showCallout && !isOpen && (
        <div
          className={`rm-assistant-callout ${!showCallout ? 'rm-assistant-callout-fadeout' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="rm-assistant-callout-bubble">
            <span className="rm-assistant-callout-sparkle">✦</span>
            <span className="rm-assistant-callout-text">Ask RouteMeasure</span>
          </div>
          <svg className="rm-assistant-callout-pointer" width="22" height="16" viewBox="0 0 22 16" fill="none">
            <path
              d="M2 2C8 2 16 6 18 14"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="2 3"
            />
            <path d="M14 11L18 15L20 9" fill="#2563eb" />
          </svg>
        </div>
      )}

      {/* Floating Circular Assistant Button */}
      <button
        type="button"
        className={`rm-assistant-btn ${isOpen ? 'active' : ''} ${isPulsing ? 'attention-pulse' : ''}`}
        onClick={handleClick}
        aria-label={isOpen ? 'Close RouteMeasure Assistant' : 'Open RouteMeasure Assistant'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M12 7v4" strokeWidth="2" />
              <path d="M10 9h4" strokeWidth="2" />
            </svg>
            {hasUnreadOrPrepared && <span className="rm-assistant-badge-dot" />}
          </>
        )}
      </button>
    </div>
  );
}
