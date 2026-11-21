import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the service worker (offline support) and offers updates.
 * A new version is only activated when you tap "Update", so the app never
 * swaps underneath you mid-workout.
 */
export function PwaUpdater() {
  const registration = useRef<ServiceWorkerRegistration | undefined>();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      registration.current = reg;
    },
  });

  // Look for updates hourly and whenever the app comes back to the foreground.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') registration.current?.update().catch(() => {});
    };
    const id = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  useEffect(() => {
    if (!needRefresh) return;
    toast('A new version of TELOS is ready', {
      id: 'pwa-update',
      description: 'Update now — it takes a second and keeps all your data.',
      duration: Infinity,
      action: { label: 'Update', onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady) return;
    toast.success('TELOS now works offline', { id: 'pwa-offline' });
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  return null;
}
