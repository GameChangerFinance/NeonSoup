import { useMemo } from 'react';
import type { AppState, IntentArgs } from '../../state/types';
import { prepareIntent } from '../../services/intents';
import { walletUrl } from '../../services/gcWallet';
import { safeError } from '../../domain/text';
import { CartAddButton } from '../common/CartAddButton';
import { FormAlert } from '../common/FormAlert';

interface GeneratedIntentPanelProps {
  state: AppState;
  onRun: () => void;
  onAddToCart: () => void;
}

export function GeneratedIntentPanel({ state, onRun, onAddToCart }: GeneratedIntentPanelProps) {
  const preview = useMemo(() => {
    try {
      const intent = prepareIntent(state);
      return {
        ok: true as const,
        args: (intent.args || {}) as IntentArgs,
        text: JSON.stringify({ title: intent.title, exportAs: intent.exportAs, args: intent.args }, null, 2),
      };
    } catch (error) {
      return { ok: false as const, args: {} as IntentArgs, text: safeError(error) };
    }
  }, [state]);

  async function copyUrl() {
    const url = await walletUrl(state);
    await navigator.clipboard?.writeText(url);
  }

  async function copyJson() {
    const intent = prepareIntent(state);
    await navigator.clipboard?.writeText(JSON.stringify(intent, null, 2));
  }

  return (
    <section className="app-card p-3 p-lg-4 mt-4">
      <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h5 mb-1">Generated Intent</h2>
          <p className="text-body-secondary mb-0">Advanced preview for the current selected action.</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={copyUrl}>
            Copy URL
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={copyJson}>
            Copy JSON
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onRun}>
            Run
          </button>
          <CartAddButton onClick={onAddToCart} size="sm" />
        </div>
      </div>
      {!preview.ok ? <FormAlert tone="danger">{preview.text}</FormAlert> : null}
      <div className="row g-3 mb-3">
        {Object.entries(preview.args)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => (
            <div key={key} className="col-12 col-md-6 col-xl-4">
              <label className="form-label" htmlFor={`arg-${key}`}>
                {key}
              </label>
              <input id={`arg-${key}`} className="form-control form-control-sm" readOnly value={value} />
            </div>
          ))}
      </div>
      <pre className="bg-body-tertiary border rounded p-3 small json-scroll mb-0">{preview.text}</pre>
    </section>
  );
}
