import { CopyIcon } from './CopyIcon';

interface JsonViewerProps {
  value: unknown;
  label?: string;
}

export function JsonViewer({ value, label = 'Copy JSON' }: JsonViewerProps) {
  const json = JSON.stringify(value, null, 2) ?? 'null';

  return (
    <div className="json-viewer">
      <div className="json-viewer-copy">
        <CopyIcon value={json} label={label} />
      </div>
      <pre className="json-scroll border rounded p-3 mb-0">{json}</pre>
    </div>
  );
}
