import type { NoticeTone } from '../../state/types';

interface FormAlertProps {
  tone?: NoticeTone;
  children: React.ReactNode;
}

export function FormAlert({ tone = 'info', children }: FormAlertProps) {
  if (!children) return null;
  const safeTone = ['info', 'success', 'warning', 'danger'].includes(tone) ? tone : 'info';
  return (
    <div className={`alert alert-${safeTone} py-2 mb-3`} role="alert">
      {children}
    </div>
  );
}
