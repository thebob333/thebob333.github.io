import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileTabBar } from "./MobileTabBar";
import { useIsMobile } from "@/hooks/use-mobile";
import { AmbientSound } from "@/components/AmbientSound";
import { useSettings } from "@/hooks/useSettings";
import { RouteErrorBoundary } from "@/components/AppErrorBoundary";
import { useLocation } from "react-router-dom";

export function AppLayout({ children: page }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { settings } = useSettings();
  const ambientEnabled = settings.ambientSoundEnabled;
  const { pathname } = useLocation();
  // One broken page shouldn't take down navigation.
  const children = <RouteErrorBoundary key={pathname}>{page}</RouteErrorBoundary>;

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col w-full">
        <main className="flex-1 overflow-auto px-3 pt-3 pb-20">
          {children}
        </main>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-bold text-primary tracking-tight">TELOS</h1>
            <div className="ml-auto">
              <AmbientSound enabled={ambientEnabled} />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
