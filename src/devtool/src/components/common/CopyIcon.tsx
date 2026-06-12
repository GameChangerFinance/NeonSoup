import { useState } from 'react';

interface CopyIconProps {
  value: string;
  label?: string;
}

export function CopyIcon({ value, label = 'Copy value' }: CopyIconProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (!value) return null;

  return (
    <button
      type="button"
      className="copy-icon"
      onClick={copy}
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
