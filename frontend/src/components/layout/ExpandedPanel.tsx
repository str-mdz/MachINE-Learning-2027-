import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";

export function ExpandedPanel({
  title,
  open,
  onOpenChange,
  triggerLabel = "Ampliar análisis",
  fallbackId,
  launcher,
  children,
  ownHeader = false,
}: {
  title: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  triggerLabel?: string;
  fallbackId: string;
  launcher: ReactNode;
  children: ReactNode;
  ownHeader?: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <article className="insight-card lab-launcher">
        {launcher}
        <Dialog.Trigger asChild>
          <button ref={trigger} className="menu-chip">
            {triggerLabel}
          </button>
        </Dialog.Trigger>
      </article>
      <Dialog.Portal>
        <Dialog.Content
          className="lab-panel"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trigger.current && !trigger.current.closest("[hidden]")) trigger.current.focus();
            else document.getElementById(fallbackId)?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            La entidad, el año y el escenario se conservan al cerrar. Escape cierra el panel.
          </Dialog.Description>
          {!ownHeader && (
            <header className="lab-topbar">
              <div>
                <h2>{title}</h2>
              </div>
              <Dialog.Close asChild>
                <button className="menu-chip" aria-label={`Cerrar ${title}`}>
                  Cerrar ×
                </button>
              </Dialog.Close>
            </header>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
