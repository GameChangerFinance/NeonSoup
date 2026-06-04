interface ReloadButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ReloadButton({ label, onClick, disabled = false }: ReloadButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
        <path
          fill="currentColor"
          d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.76-4.24L13 11h8V3l-3.3 3.3Z"
        />
      </svg>
      <span className="d-none d-sm-inline">Refresh</span>
    </button>
  );
}
