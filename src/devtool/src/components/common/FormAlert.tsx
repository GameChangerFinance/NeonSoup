import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { NoticeTone } from '../../state/types';

interface FormAlertProps {
  tone?: NoticeTone;
  children: ReactNode;
}

const GOGGLES_CLEANING_ASSET = '/assets/cybernekos/goggles-cleaning_Y.webp';

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  return '';
}

function AlertTextModal({ text, onClose }: { text: string; onClose: () => void }) {
  return createPortal(
    <div className="alert-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="alert-modal-card" aria-modal="true" role="dialog" aria-labelledby="alert-modal-title">
        <img className="alert-modal-art" src={GOGGLES_CLEANING_ASSET} alt="" aria-hidden="true" />
        <div className="alert-modal-head">
          <h2 id="alert-modal-title"></h2>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="alert-modal-text">{text}</div>
      </section>
    </div>,
    document.body,
  );
}

export function FormAlert({ tone = 'info', children }: FormAlertProps) {
  const [modalOpen, setModalOpen] = useState(false);
  if (!children) return null;
  const safeTone = ['info', 'success', 'warning', 'danger'].includes(tone) ? tone : 'info';
  const text = nodeText(children).trim();
  const canExpand = text.length > 96;
  return (
    <div className={`alert alert-${safeTone} py-2 mb-3`} role="alert">
      <span className="form-alert-text">{children}</span>
      {canExpand ? (
        <button type="button" className="form-alert-more" onClick={() => setModalOpen(true)}>
          more
        </button>
      ) : null}
      {modalOpen ? <AlertTextModal text={text} onClose={() => setModalOpen(false)} /> : null}
    </div>
  );
}
