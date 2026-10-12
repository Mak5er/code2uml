/**
 * Google Analytics (GA4) integration utilities.
 * Safely sends custom event telemetry to Google Analytics without throwing errors.
 */

export const GA_MEASUREMENT_ID = 'G-7F0YX0V8LT';

const sessionStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
const trackedActions = new Set();

/**
 * Safely send an event to Google Analytics (gtag).
 *
 * @param {string} eventName - Standard or custom event name (e.g. 'generate_diagrams')
 * @param {Record<string, any>} [eventParams={}] - Optional metadata parameters
 */
export function trackEvent(eventName, eventParams = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, eventParams);
    }
  } catch {
    // Fail silently so tracking never breaks user experience
  }
}

/**
 * Track how long after page load a user performs a key milestone action for the first time.
 * (e.g. 'time_to_first_generation', 'time_to_first_export')
 *
 * @param {string} actionName
 * @param {Record<string, any>} [extraParams={}]
 */
export function trackTimeToFirstAction(actionName, extraParams = {}) {
  if (trackedActions.has(actionName)) return;
  trackedActions.add(actionName);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const seconds = Math.round((now - sessionStartTime) / 1000);
  trackEvent(actionName, {
    seconds_since_load: seconds,
    ...extraParams,
  });
}

/**
 * Initialize automatic engagement milestones (30s, 1m, 3m, 5m, 10m).
 * Helps measure real retention and active time spent on site.
 */
let engagementInitialized = false;
export function initEngagementTracking() {
  if (engagementInitialized || typeof window === 'undefined') return;
  engagementInitialized = true;

  // Track initial device/screen environment
  try {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const deviceType = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop';
    trackEvent('session_environment', {
      device_type: deviceType,
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
      color_scheme_preference: isDark ? 'dark' : 'light',
    });
  } catch {}

  const milestones = [
    { sec: 30, label: '30s' },
    { sec: 60, label: '1m' },
    { sec: 180, label: '3m' },
    { sec: 300, label: '5m' },
    { sec: 600, label: '10m' },
  ];

  milestones.forEach(({ sec, label }) => {
    setTimeout(() => {
      trackEvent('user_engagement_milestone', { milestone: label, seconds: sec });
    }, sec * 1000);
  });
}
