interface EmptyStateProps {
  title: string;
  detail?: string;
}

export function EmptyState({ title, detail }: EmptyStateProps) {
  return (
    <div className="text-center text-body-secondary py-4">
      <div className="fw-semibold">{title}</div>
      {detail ? <div className="small mt-1">{detail}</div> : null}
    </div>
  );
}
