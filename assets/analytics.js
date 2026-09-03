const EVENT_TITLES = Object.freeze({
  calculator_visitor: 'Calculator visitor',
  calculator_used: 'Calculator used',
  calculator_reset: 'Calculator reset',
  calculator_share: 'Calculator shared',
  calculator_copy: 'Calculator result copied'
});

const USE_EVENT_COOLDOWN_MS = 5000;
const VISITOR_ID_STORAGE_KEY = 'hourly_calculator_visitor_id';
const VISITOR_EVENT_RECORDED_KEY = 'hourly_calculator_visitor_recorded';
const VISITOR_EVENT_CLAIM_KEY = 'hourly_calculator_visitor_claim';

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function generateVisitorId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateVisitor(storage = getBrowserStorage(), createId = generateVisitorId) {
  if (!storage) return { visitorId: null, isNew: false };

  try {
    const existingVisitorId = storage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existingVisitorId) return { visitorId: existingVisitorId, isNew: false };

    const visitorId = createId();
    storage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
    return { visitorId, isNew: true };
  } catch {
    return { visitorId: null, isNew: false };
  }
}

export function createVisitorEventClaim(storage = getBrowserStorage(), visitorId, createId = generateVisitorId) {
  if (!storage || !visitorId) return { shouldTrack: false, confirmDelivered() {} };

  try {
    if (storage.getItem(VISITOR_EVENT_RECORDED_KEY) === visitorId) {
      return { shouldTrack: false, confirmDelivered() {} };
    }

    const claim = `${visitorId}:${createId()}`;
    storage.setItem(VISITOR_EVENT_CLAIM_KEY, claim);
    if (storage.getItem(VISITOR_EVENT_CLAIM_KEY) !== claim) {
      return { shouldTrack: false, confirmDelivered() {} };
    }

    return {
      shouldTrack: true,
      confirmDelivered() {
        try {
          if (storage.getItem(VISITOR_EVENT_CLAIM_KEY) !== claim) return;
          storage.setItem(VISITOR_EVENT_RECORDED_KEY, visitorId);
          storage.removeItem(VISITOR_EVENT_CLAIM_KEY);
        } catch {
          // Analytics delivery must never affect the calculator.
        }
      }
    };
  } catch {
    return { shouldTrack: false, confirmDelivered() {} };
  }
}

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

function sendGoatCounterEvent(endpoint, payload, onDelivered) {
  if (typeof Image === 'undefined') return;

  const url = new URL(endpoint);
  url.searchParams.set('p', payload.path);
  url.searchParams.set('t', payload.title);
  url.searchParams.set('e', '1');
  url.searchParams.set('rnd', String(Date.now()));

  const beacon = new Image();
  beacon.referrerPolicy = 'no-referrer';
  beacon.onload = () => onDelivered?.();
  beacon.src = url.toString();
}

export function createEventTracker({ endpoint = '', now = () => Date.now(), send } = {}) {
  const lastEventTime = new Map();
  const canTrack = isValidGoatCounterEndpoint(endpoint);
  const eventSender = send ?? ((payload) => sendGoatCounterEvent(endpoint, payload));

  return {
    track(eventName, options = {}) {
      if (!canTrack || !isAllowedEvent(eventName)) return false;

      const currentTime = now();
      const cooldown = eventName === 'calculator_used' ? USE_EVENT_COOLDOWN_MS : 0;
      const previousTime = lastEventTime.get(eventName);
      if (previousTime !== undefined && currentTime - previousTime < cooldown) return false;

      lastEventTime.set(eventName, currentTime);
      try {
        eventSender({ path: eventName, title: EVENT_TITLES[eventName], event: true }, options?.onDelivered);
        return true;
      } catch {
        return false;
      }
    }
  };
}

export async function loadAnalyticsConfig(configLoader = () => import('./analytics-config.js')) {
  try {
    const configModule = await configLoader();
    return configModule.analyticsConfig && typeof configModule.analyticsConfig === 'object'
      ? configModule.analyticsConfig
      : {};
  } catch {
    return {};
  }
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
