import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "@fontsource-variable/inter";
import "./index.css";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { configureStores, setWritesBlocked } from "@/lib/store";
import { META_KEYS } from "@/lib/storage";
import { CURRENT_SCHEMA_VERSION, runStartupMigrations, type StartupResult } from "@/lib/migrations";
import { maybeDailySnapshot, requestPersistentStorage, saveSnapshot } from "@/lib/snapshots";
import { shareOrDownloadBackup } from "@/lib/backup";

configureStores({
  onWriteError(key, err) {
    console.error(`[TELOS] Couldn't save ${key}`, err);
    const blocked = String((err as Error)?.message ?? "").startsWith("Saving is paused");
    toast.error(blocked ? "Saving is paused" : "Couldn't save your change", {
      id: "storage-write",
      description: blocked
        ? "A newer version of TELOS is open. Reload to keep going."
        : "Storage may be full. Save a backup so nothing is lost.",
      action: blocked
        ? { label: "Reload", onClick: () => window.location.reload() }
        : { label: "Back up", onClick: () => void shareOrDownloadBackup() },
      duration: 10000,
    });
  },
  onReadError(key) {
    console.warn(`[TELOS] ${key} was unreadable; a copy was kept and defaults were used.`);
  },
});

// Another tab/window running a newer build upgraded the data: stop writing.
window.addEventListener("storage", (e) => {
  if (e.key === META_KEYS.SCHEMA_VERSION && e.newValue && Number(e.newValue) > CURRENT_SCHEMA_VERSION) {
    setWritesBlocked("a newer version of TELOS is open");
  }
});

const idle = (fn: () => void) =>
  ("requestIdleCallback" in window ? window.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500));

(async () => {
  let result: StartupResult;
  try {
    result = await runStartupMigrations({ snapshot: (raw) => saveSnapshot("pre-migration", raw) });
  } catch (error) {
    result = { status: "failed", from: 0, error };
  }

  createRoot(document.getElementById("root")!).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );

  if (result.status === "newer") setWritesBlocked("your data was saved by a newer version of TELOS");
  // Give the <Toaster/> a moment to mount before showing startup notices.
  setTimeout(() => announce(result), 600);

  idle(() => {
    void requestPersistentStorage();
    void maybeDailySnapshot();
  });
})();

function announce(result: StartupResult) {
  if (result.status === "newer") {
    toast.error("This copy of TELOS is out of date", {
      description: "Reload to get the latest version. Saving is paused until then.",
      action: { label: "Reload", onClick: () => window.location.reload() },
      duration: Infinity,
    });
  } else if (result.status === "failed") {
    console.error("[TELOS] Data upgrade failed", result.error);
    toast.error("Couldn't upgrade your saved data", {
      description: "Everything should still work. Save a backup to be safe.",
      action: { label: "Back up", onClick: () => void shareOrDownloadBackup() },
      duration: 15000,
    });
  } else if (result.status === "migrated") {
    console.info("[TELOS] Data upgraded", result.applied);
  }
}
