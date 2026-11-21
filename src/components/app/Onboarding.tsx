import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Dumbbell, Share, SquarePlus, Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { seedSampleData } from '@/lib/sample-data';

const ONBOARDED_KEY = 'telos_onboarded'; // device-only

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useShowOnboarding(isNew: boolean) {
  const [seen] = useState(() => { try { return localStorage.getItem(ONBOARDED_KEY) === '1'; } catch { return true; } });
  return isNew && !seen;
}

function markDone() {
  try { localStorage.setItem(ONBOARDED_KEY, '1'); } catch { /* ignore */ }
}

/** A 3-step welcome for first launch: what TELOS does, install on iPhone, start fresh or explore. */
export function Onboarding() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const installed = isStandalone();
  const steps = installed ? [0, 2] : [0, 1, 2];
  const current = steps[step];

  if (!open) return null;
  const close = () => { markDone(); setOpen(false); };
  const next = () => (step < steps.length - 1 ? setStep(step + 1) : close());

  // Portal to <body> so page animations (transforms) can't trap this full-screen layer.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Welcome to TELOS" className="fixed inset-0 z-[60] flex flex-col bg-background px-6 safe-area-top pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-end pt-2">
        <button type="button" onClick={close} className="h-10 px-2 text-sm text-muted-foreground">Skip</button>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        {current === 0 && (
          <>
            <img src="/icons/icon.svg" alt="" className="mb-6 h-16 w-16 rounded-2xl shadow-sm" />
            <h1 className="text-3xl font-bold tracking-tight">Big goals, one daily plan.</h1>
            <p className="mt-2 text-muted-foreground">TELOS turns what you want into what to do today.</p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Target, title: 'Goals', text: 'Break a goal into phases, to-dos and daily habits.' },
                { icon: CalendarDays, title: 'Today & Plan', text: 'Check things off and plan your day in time blocks.' },
                { icon: Dumbbell, title: 'Gym', text: 'Log lifts — it plans your next session for you.' },
                { icon: Users, title: 'People', text: 'Stay in touch with the people who matter.' },
              ].map(i => (
                <li key={i.title} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><i.icon className="h-5 w-5" /></span>
                  <span><span className="block font-semibold">{i.title}</span><span className="text-sm text-muted-foreground">{i.text}</span></span>
                </li>
              ))}
            </ul>
          </>
        )}

        {current === 1 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Put TELOS on your Home Screen</h1>
            <p className="mt-2 text-muted-foreground">It opens like an app, works offline, and keeps your data safer.</p>
            <ol className="mt-8 space-y-4 text-[15px]">
              <li className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Share className="h-5 w-5" /></span>Tap the <b>Share</b> button in Safari</li>
              <li className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><SquarePlus className="h-5 w-5" /></span>Choose <b>Add to Home Screen</b></li>
              <li className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><img src="/icons/icon.svg" alt="" className="h-6 w-6 rounded-md" /></span>Open TELOS from your Home Screen</li>
            </ol>
          </>
        )}

        {current === 2 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">How do you want to start?</h1>
            <p className="mt-2 text-muted-foreground">You can remove sample data any time with one tap.</p>
            <div className="mt-8 space-y-3">
              <Button className="h-14 w-full text-base font-semibold" onClick={() => { close(); navigate('/goals?new=1'); }}>
                Create my first goal
              </Button>
              <Button variant="outline" className="h-14 w-full text-base" onClick={() => { seedSampleData(); close(); }}>
                Explore with sample data
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-sm items-center justify-between">
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`} />)}
        </div>
        {current !== 2 && <Button className="h-11 px-6 font-semibold" onClick={next}>Next</Button>}
      </div>
    </div>,
    document.body,
  );
}
