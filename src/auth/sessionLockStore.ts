import { create } from 'zustand';
import { getSetting, setSetting } from '../storage';

const LOCK_ENABLED_KEY = 'session.lockEnabled';
const LOCK_GRACE_MS = 1500;

type SessionLockStore = {
  /** Whether background lock is enabled (default true). */
  enabled: boolean;
  /** True when the workspace is covered by the lock overlay. */
  locked: boolean;
  hydrated: boolean;
  init: () => Promise<void>;
  setEnabled: (v: boolean) => Promise<void>;
  lock: () => void;
  unlock: () => void;
  /** Called from AppState — schedules lock after a short grace so brief interruptions don't flash. */
  onAppBackground: () => void;
  onAppActive: () => void;
};

let graceTimer: ReturnType<typeof setTimeout> | null = null;

function clearGrace() {
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
}

export const useSessionLock = create<SessionLockStore>((set, get) => ({
  enabled: true,
  locked: false,
  hydrated: false,

  init: async () => {
    const raw = await getSetting(LOCK_ENABLED_KEY);
    // Default ON when unset so chambers notes stay private in the app switcher.
    const enabled = raw === null ? true : raw === '1';
    set({ enabled, hydrated: true });
  },

  setEnabled: async (v) => {
    set({ enabled: v, locked: v ? get().locked : false });
    await setSetting(LOCK_ENABLED_KEY, v ? '1' : '0');
  },

  lock: () => {
    if (!get().enabled) return;
    set({ locked: true });
  },

  unlock: () => {
    clearGrace();
    set({ locked: false });
  },

  onAppBackground: () => {
    if (!get().enabled) return;
    clearGrace();
    graceTimer = setTimeout(() => {
      graceTimer = null;
      if (get().enabled) set({ locked: true });
    }, LOCK_GRACE_MS);
  },

  onAppActive: () => {
    // Cancel a pending lock if we returned before the grace ended (e.g. Control Centre flash).
    // If already locked, stay locked until the user explicitly unlocks.
    clearGrace();
  },
}));
