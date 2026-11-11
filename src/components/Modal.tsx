import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ children, onClose, label, wide = false }: { children: ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const cancel = (event: Event) => { event.preventDefault(); onClose(); };
    dialog.addEventListener('cancel', cancel);
    return () => { dialog.removeEventListener('cancel', cancel); dialog.close(); previous?.focus(); };
  }, [onClose]);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-label={label} onPointerDown={event => { backdropPress.current = event.target === event.currentTarget; }} onClick={event => { const dismiss = backdropPress.current && event.target === event.currentTarget; backdropPress.current = false; if (dismiss) onClose(); }}>
    <div className="modal-content"><button className="icon-button modal-close" onClick={onClose} aria-label="Close / Schließen"><X size={20} /></button>{children}</div>
  </dialog>;
}
