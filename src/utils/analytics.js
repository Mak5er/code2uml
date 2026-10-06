/**
 * Google Analytics (GA4) integration utilities.
 * Safely sends custom event telemetry to Google Analytics without throwing errors.
 */

export const GA_MEASUREMENT_ID = 'G-7F0YX0V8LT';

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
