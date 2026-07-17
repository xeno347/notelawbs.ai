/**
 * Crash / error reporting facade.
 * Optionally loads @sentry/react-native when a DSN is configured and the
 * package is installed. Always keeps an in-memory ring + logs in __DEV__.
 */
import type { ErrorInfo } from 'react';

type Severity = 'fatal' | 'error' | 'warning' | 'info';

type ReportedError = {
  message: string;
  severity: Severity;
  at: number;
  context?: Record<string, unknown>;
};

const RING_MAX = 40;
const ring: ReportedError[] = [];
let sentryReady = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentryMod: any = null;

export function recentErrors(): ReportedError[] {
  return [...ring];
}

function pushRing(entry: ReportedError) {
  ring.push(entry);
  if (ring.length > RING_MAX) ring.shift();
}

/** Call once at app boot after optional DSN is known. */
export async function initErrorReporting(dsn?: string | null): Promise<void> {
  const key = (dsn || '').trim();
  if (!key || key.includes('YOUR_')) return;
  try {
    // Lazy require so the app runs without the native Sentry package linked.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    sentryMod = require('@sentry/react-native');
    sentryMod.init({
      dsn: key,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    sentryReady = true;
  } catch (e) {
    if (__DEV__) console.warn('[errorReporting] Sentry init skipped', e);
    sentryReady = false;
  }
}

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
  severity: Severity = 'error',
): void {
  const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
  pushRing({ message: err.message, severity, at: Date.now(), context });
  if (__DEV__) {
    console.error(`[${severity}]`, err.message, context || '', err);
  }
  if (sentryReady && sentryMod) {
    try {
      if (context) {
        sentryMod.withScope((scope: { setExtra: (k: string, v: unknown) => void; setLevel: (l: string) => void }) => {
          Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
          scope.setLevel(severity === 'fatal' ? 'fatal' : severity === 'warning' ? 'warning' : 'error');
          sentryMod.captureException(err);
        });
      } else {
        sentryMod.captureException(err);
      }
    } catch {
      /* never throw from reporter */
    }
  }
}

export function reportMessage(
  message: string,
  context?: Record<string, unknown>,
  severity: Severity = 'info',
): void {
  pushRing({ message, severity, at: Date.now(), context });
  if (__DEV__) console.log(`[${severity}]`, message, context || '');
  if (sentryReady && sentryMod) {
    try {
      sentryMod.captureMessage(message, severity === 'fatal' ? 'fatal' : severity);
    } catch {
      /* noop */
    }
  }
}

export function reportReactError(error: Error, info: ErrorInfo): void {
  reportError(error, { componentStack: info.componentStack }, 'fatal');
}
