import { stores, type AppSettings } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';

type Patch = Partial<AppSettings> | ((s: AppSettings) => Partial<AppSettings>);

export function updateSettings(patch: Patch) {
  stores.SETTINGS.update(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
}

export function useSettings() {
  const settings = useStore(stores.SETTINGS);
  return { settings, updateSettings };
}
