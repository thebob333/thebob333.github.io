import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTransition } from "@/components/PageTransition";
import { PwaUpdater } from "@/components/app/PwaUpdater";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import Index from "./pages/Index";

// Today loads instantly; other pages load on first visit (and are cached offline).
const Goals = lazy(() => import("./pages/Goals"));
const GoalDetail = lazy(() => import("./pages/GoalDetail"));
const Workouts = lazy(() => import("./pages/Workouts"));
const Program = lazy(() => import("./pages/Program"));
const People = lazy(() => import("./pages/People"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <PageTransition routeKey={location.pathname}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/goals/:goalId" element={<GoalDetail />} />
          <Route path="/gym" element={<Workouts />} />
          <Route path="/plan" element={<Program />} />
          {/* Old addresses keep working (bookmarks, home-screen shortcuts). */}
          <Route path="/workouts" element={<Navigate to="/gym" replace />} />
          <Route path="/program" element={<Navigate to="/plan" replace />} />
          <Route path="/people" element={<People />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
}

const App = () => (
  <TooltipProvider>
    <Toaster
      position="bottom-center"
      // Keep toasts above the tab bar and the iPhone home indicator.
      mobileOffset={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      closeButton
    />
    <PwaUpdater />
    <BrowserRouter>
      <AppLayout>
        <AnimatedRoutes />
      </AppLayout>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
