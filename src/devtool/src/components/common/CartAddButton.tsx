interface CartAddButtonProps {
  onClick: () => void;
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

function AddCartIcon() {
  return (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="cart-add-plus">
        <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
      </svg>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M7 18a2 2 0 1 0 .01 0H7Zm10 0a2 2 0 1 0 .01 0H17ZM6.2 6l.55 3h10.9l-.9 4H8.1L6.55 4.5A1 1 0 0 0 5.57 4H3v2h2.2Zm2.23 9h8.32a2 2 0 0 0 1.95-1.56l1.18-5.25A1 1 0 0 0 18.9 7H7.12l-.18-1H5.2l1.45 7.96A1.25 1.25 0 0 0 7.88 15h.55Z"
        />
      </svg>
    </>
  );
}

export function CartAddButton({ onClick, label = 'Add to Cart', size = 'md', disabled = false }: CartAddButtonProps) {
  const iconOnly = label === 'Add to Cart';
  const classes = [
    'btn',
    'btn-primary',
    'cart-add-button',
    size === 'sm' ? 'btn-sm' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} onClick={onClick} title={label} aria-label={label} disabled={disabled}>
      {iconOnly ? <span className="visually-hidden">{label}</span> : <span>{label}</span>}
      <AddCartIcon />
    </button>
  );
}
