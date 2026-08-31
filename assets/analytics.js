const EVENT_TITLES = Object.freeze({
  calculator_used: 'Calculator used',
  calculator_reset: 'Calculator reset',
  calculator_share: 'Calculator shared',
  calculator_copy: 'Calculator result copied'
});

const USE_EVENT_COOLDOWN_MS = 5000;

function isAllowedEvent(eventName) {
  return Object.hasOwn(EVENT_TITLES, eventName);
}

function isValidGoatCounterEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && url.hostname.endsWith('.goatcounter.com') && url.pathname === '/count';
  } catch {
    return false;
  }
}

function sendGoatCounterEvent(endpoint, payload) {
  if (typeof Image === 'undefined') return;

  const url = new URL(endpoint);
  url.searchParams.set('p', payload.path);
  url.searchParams.set('t', payload.title);
  url.searchParams.set('e', '1');
  url.searchParams.set('rnd', String(Date.now()));

  const beacon = new Image();
  beacon.referrerPolicy = 'no-referrer';
  beacon.src = url.toString();
}

export function createEventTracker({ endpoint = '', now = () => Date.now(), send } = {}) {
  const lastEventTime = new Map();
  const canTrack = isValidGoatCounterEndpoint(endpoint);
  const eventSender = send ?? ((payload) => sendGoatCounterEvent(endpoint, payload));

  return {
    track(eventName) {
      if (!canTrack || !isAllowedEvent(eventName)) return false;

      const currentTime = now();
      const cooldown = eventName === 'calculator_used' ? USE_EVENT_COOLDOWN_MS : 0;
      const previousTime = lastEventTime.get(eventName);
      if (previousTime !== undefined && currentTime - previousTime < cooldown) return false;

      lastEventTime.set(eventName, currentTime);
      try {
        eventSender({ path: eventName, title: EVENT_TITLES[eventName], event: true });
        return true;
      } catch {
        return false;
      }
    }
  };
}

function loadCloudflareBeacon(token) {
  if (!token || typeof document === 'undefined') return;

  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token });
  script.onerror = () => script.remove();
  document.head.append(script);
}

export function initializeAnalytics(config = {}) {
  loadCloudflareBeacon(config.cloudflareWebAnalyticsToken?.trim());
  return createEventTracker({ endpoint: config.goatCounterEndpoint?.trim() });
}
