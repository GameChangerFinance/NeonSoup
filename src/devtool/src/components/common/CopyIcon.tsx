import { useState } from 'react';

export interface CopyMessage {
  subject?: string;
  extra?: string;
}

interface CopyIconProps {
  value: string | (() => string | Promise<string>);
  label?: string;
  className?: string;
  disabled?: boolean;
  copyMessage?: CopyMessage;
}

function copySubject(label: string, copyMessage: CopyMessage | undefined): string {
  return copyMessage?.subject || label.replace(/^Copy\s+/i, '').trim().toLowerCase() || 'value';
}

function copiedMessage(label: string, copyMessage: CopyMessage | undefined): string {
  const base = `${copySubject(label, copyMessage)} copied to clipboard.`;
  return copyMessage?.extra ? `${base} ${copyMessage.extra}` : base;
}

export function CopyIcon({ value, label = 'Copy value', className = '', disabled = false, copyMessage }: CopyIconProps) {
  const [copied, setCopied] = useState(false);
  const staticValue = typeof value === 'string' ? value : null;

  async function copy() {
    try {
      const text = typeof value === 'function' ? await value() : value;
      if (!text) return;
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is not available in this browser context.');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.dispatchEvent(
        new CustomEvent('neonsoup-copy', {
          detail: { tone: 'info', message: copiedMessage(label, copyMessage) },
        }),
      );
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent('neonsoup-copy', {
          detail: { tone: 'danger', message: error instanceof Error ? error.message : 'Clipboard copy failed.' },
        }),
      );
    }
  }

  if (staticValue === '') return null;

  return (
    <button
      type="button"
      className={`copy-icon${className ? ` ${className}` : ''}`}
      onClick={copy}
      disabled={disabled}
      title={copied ? 'Copied' : label}
      aria-label={copied ? 'Copied' : label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2Zm2 0h4a2 2 0 0 1 2 2v6h2V5h-8v2Zm-4 2v10h8V9H6Z"
        />
      </svg>
    </button>
  );
}
