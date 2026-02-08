import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ProductTour } from '@/components/onboarding/ProductTour';
import { useTour, TourContext } from '@/hooks/useTour';

export function AppLayout() {
  const {
    tourActive,
    phase,
    nextPhase,
    skipTour,
    endTour,
    skipToPhase,
    getPhaseDisplay,
    restartTour,
    connectGcalAndResume,
  } = useTour();

  return (
    <TourContext.Provider value={{ restartTour }}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 h-14 flex items-center">
              <SidebarTrigger className="-ml-1" />
            </header>
            <div className="p-6 max-w-[1400px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
        <ProductTour
          tourActive={tourActive}
          phase={phase}
          onNext={nextPhase}
          onSkip={skipTour}
          onEnd={endTour}
          onSkipToPhase={skipToPhase}
          phaseDisplay={getPhaseDisplay()}
          onConnectGcal={connectGcalAndResume}
        />
      </SidebarProvider>
    </TourContext.Provider>
  );
}
