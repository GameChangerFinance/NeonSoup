interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, eyebrow, children }: PageHeaderProps) {
  return (
    <header className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
      <div>
        {eyebrow ? <div className="text-info small fw-semibold text-uppercase">{eyebrow}</div> : null}
        <h1 className="h3 mb-1">{title}</h1>
        <p className="text-body-secondary mb-0">Developer tool dapp for P2P DeFi Kernel order book management</p>
      </div>
      {children ? <div className="d-flex align-items-start gap-2">{children}</div> : null}
    </header>
  );
}
