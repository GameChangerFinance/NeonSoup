import { useEffect, useMemo, useState } from 'react';
import type { AppState, AssetMetadata, NoticeTone } from '../../state/types';
import { useAppDispatch } from '../../state/appState';
import { APP_CONFIG } from '../../config/appConfig';
import { FormAlert } from '../common/FormAlert';

interface OptionsPanelProps {
  state: AppState;
  onRefreshOffers: () => void;
  onRefreshPortfolio: () => void;
}

const toggleOptions = [
  ['popupMode', 'Open wallet in popup mode'],
  ['hideUnknownOffers', 'Hide unknown open-offer assets'],
  ['hideUnknownPortfolio', 'Hide unknown portfolio assets'],
  ['ownerOnly', 'Show only my offers'],
] as const;

function editableAssets(state: AppState): Record<string, AssetMetadata> {
  return {
    ...APP_CONFIG.networks[state.options.network].assets,
    ...(state.customAssets[state.options.network] || {}),
  };
}

function validateAssetJson(value: unknown): Record<string, AssetMetadata> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Asset JSON must be an object keyed by asset name.');
  }
  const assets = value as Record<string, AssetMetadata>;
  for (const [key, asset] of Object.entries(assets)) {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
      throw new Error(`${key} must be an asset definition object.`);
    }
    if (typeof asset.policyId !== 'string' || !asset.policyId) {
      throw new Error(`${key}.policyId is required.`);
    }
    if (typeof asset.assetNameHex !== 'string' || !asset.assetNameHex) {
      throw new Error(`${key}.assetNameHex is required.`);
    }
    if (typeof asset.label !== 'string' || typeof asset.ticker !== 'string') {
      throw new Error(`${key}.label and ${key}.ticker are required.`);
    }
    if (!Number.isFinite(asset.decimals) || asset.decimals < 0) {
      throw new Error(`${key}.decimals must be a non-negative number.`);
    }
  }
  return assets;
}

export function OptionsPanel({ state, onRefreshOffers, onRefreshPortfolio }: OptionsPanelProps) {
  const dispatch = useAppDispatch();
  const [assetJson, setAssetJson] = useState(() => JSON.stringify(editableAssets(state), null, 2));
  const [assetNotice, setAssetNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  useEffect(() => {
    setAssetJson(JSON.stringify(editableAssets(state), null, 2));
    setAssetNotice(null);
  }, [state.options.network]);

  const providerHelp = useMemo(
    () =>
      state.options.provider === 'graphqlMk2'
        ? 'GraphQL MKII is scaffolded for the next migration and may not serve all devtool queries yet.'
        : 'Blockfrost-compatible provider. Leave URL empty to use the GameChanger-hosted endpoint.',
    [state.options.provider],
  );

  function saveAssets() {
    try {
      const parsed = validateAssetJson(JSON.parse(assetJson || '{}'));
      dispatch({ type: 'set-custom-assets', network: state.options.network, assets: parsed });
      setAssetNotice({ tone: 'success', message: 'Custom asset definitions saved for this network.' });
    } catch (error) {
      setAssetNotice({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Invalid custom asset JSON.',
      });
    }
  }

  return (
    <div className="row g-4">
      <section className="col-12 col-xl-6">
        <div className="app-card p-3 p-lg-4 h-100">
          <h2 className="h5 mb-3">Network</h2>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="network">
                Network
              </label>
              <select
                id="network"
                className="form-select"
                value={state.options.network}
                onChange={(event) =>
                  dispatch({
                    type: 'set-options',
                    options: { network: event.target.value as AppState['options']['network'] },
                  })
                }
              >
                <option value="preprod">Preprod</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="provider">
                Network provider
              </label>
              <select
                id="provider"
                className="form-select"
                value={state.options.provider}
                onChange={(event) =>
                  dispatch({
                    type: 'set-options',
                    options: { provider: event.target.value as AppState['options']['provider'] },
                  })
                }
              >
                <option value="blockfrost">Blockfrost</option>
                <option value="graphqlMk2">Cardano GraphQL MKII</option>
              </select>
              <div className="form-text">{providerHelp}</div>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="blockfrostUrl">
                Blockfrost URL override
              </label>
              <input
                id="blockfrostUrl"
                className="form-control"
                value={state.options.blockfrostUrl}
                placeholder="Use GameChanger-hosted endpoint"
                onChange={(event) =>
                  dispatch({ type: 'set-options', options: { blockfrostUrl: event.target.value } })
                }
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="blockfrostKey">
                Optional API key
              </label>
              <input
                id="blockfrostKey"
                className="form-control"
                type="password"
                value={state.options.blockfrostKey}
                onChange={(event) =>
                  dispatch({ type: 'set-options', options: { blockfrostKey: event.target.value } })
                }
              />
              <div className="form-text">Stored only in browser localStorage. Do not commit keys into files.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="col-12 col-xl-6">
        <div className="app-card p-3 p-lg-4 h-100">
          <h2 className="h5 mb-3">UI and DevEx</h2>
          <div className="vstack gap-3">
            {toggleOptions.map(([key, label]) => (
              <div className="form-check form-switch" key={key}>
                <input
                  id={key}
                  type="checkbox"
                  className="form-check-input"
                  checked={Boolean(state.options[key as keyof AppState['options']])}
                  onChange={(event) =>
                    dispatch({ type: 'set-options', options: { [key]: event.target.checked } })
                  }
                />
                <label className="form-check-label" htmlFor={key}>
                  {label}
                </label>
              </div>
            ))}
            <div>
              <label className="form-label" htmlFor="theme">
                Theme
              </label>
              <select
                id="theme"
                className="form-select"
                value={state.options.theme}
                onChange={(event) =>
                  dispatch({ type: 'set-options', options: { theme: event.target.value as 'dark' | 'light' } })
                }
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline-primary" onClick={onRefreshOffers}>
                Refresh offers
              </button>
              <button type="button" className="btn btn-outline-primary" onClick={onRefreshPortfolio}>
                Refresh portfolio
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="col-12">
        <div className="app-card p-3 p-lg-4">
          <h2 className="h5 mb-2">Custom Assets and Overrides</h2>
          <p className="text-body-secondary">
            User definitions override app defaults and fetched metadata. Use this to add missing decimals or replace
            untrusted registry fields.
          </p>
          {assetNotice ? <FormAlert tone={assetNotice.tone}>{assetNotice.message}</FormAlert> : null}
          <label className="form-label" htmlFor="customAssets">
            Custom assets JSON for {state.options.network}
          </label>
          <textarea
            id="customAssets"
            className="form-control font-monospace"
            rows={10}
            value={assetJson}
            onChange={(event) => setAssetJson(event.target.value)}
          />
          <div className="d-flex justify-content-end mt-3">
            <button type="button" className="btn btn-primary" onClick={saveAssets}>
              Save asset overrides
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
