/**
 * Drop-in replacement for the shadcn Dialog: a centered dialog on larger
 * screens, a bottom sheet (swipe down to close) on phones. Same component
 * names, so screens just change the import path.
 */
import * as React from 'react';
import {
  Dialog as BaseDialog,
  DialogClose as BaseDialogClose,
  DialogContent as BaseDialogContent,
  DialogDescription as BaseDialogDescription,
  DialogFooter as BaseDialogFooter,
  DialogHeader as BaseDialogHeader,
  DialogTitle as BaseDialogTitle,
  DialogTrigger as BaseDialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const SheetMode = React.createContext(false);
const useSheet = () => React.useContext(SheetMode);

type RootProps = React.ComponentProps<typeof BaseDialog>;

export function Dialog(props: RootProps) {
  const sheet = useIsMobile();
  return (
    <SheetMode.Provider value={sheet}>
      {sheet ? <Drawer shouldScaleBackground={false} {...props} /> : <BaseDialog {...props} />}
    </SheetMode.Provider>
  );
}

export const DialogTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof BaseDialogTrigger>>(
  (props, ref) => (useSheet() ? <DrawerTrigger ref={ref} {...props} /> : <BaseDialogTrigger ref={ref} {...props} />),
);
DialogTrigger.displayName = 'DialogTrigger';

export const DialogClose = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof BaseDialogClose>>(
  (props, ref) => (useSheet() ? <DrawerClose ref={ref} {...props} /> : <BaseDialogClose ref={ref} {...props} />),
);
DialogClose.displayName = 'DialogClose';

export const DialogContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof BaseDialogContent>>(
  ({ className, children, ...props }, ref) => {
    if (!useSheet()) {
      return <BaseDialogContent ref={ref} className={className} {...props}>{children}</BaseDialogContent>;
    }
    // Strip desktop sizing classes; the sheet is full width and scrolls on its own.
    const sheetClasses = (className ?? '')
      .split(/\s+/)
      .filter(c => c && !/^(max-w-|sm:max-w-|max-h-|overflow-)/.test(c))
      .join(' ');
    return (
      <DrawerContent ref={ref} className="max-h-[92dvh] bg-card" {...props}>
        <div className={cn('overflow-y-auto overscroll-contain px-4 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]', sheetClasses)}>
          {children}
        </div>
      </DrawerContent>
    );
  },
);
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return useSheet()
    ? <DrawerHeader className={cn('px-0 pb-3 pt-1 text-left', className)} {...props} />
    : <BaseDialogHeader className={className} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return useSheet()
    ? <DrawerFooter className={cn('px-0', className)} {...props} />
    : <BaseDialogFooter className={className} {...props} />;
}

export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<typeof BaseDialogTitle>>(
  ({ className, ...props }, ref) => (useSheet()
    ? <DrawerTitle ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
    : <BaseDialogTitle ref={ref} className={className} {...props} />),
);
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<typeof BaseDialogDescription>>(
  (props, ref) => (useSheet() ? <DrawerDescription ref={ref} {...props} /> : <BaseDialogDescription ref={ref} {...props} />),
);
DialogDescription.displayName = 'DialogDescription';
