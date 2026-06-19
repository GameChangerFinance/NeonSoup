import { useEffect, useMemo, useRef, useState } from 'react';
import { assetTitle } from '../../domain/assets';
import { fromBase, ratioDecimal } from '../../domain/quantities';
import type { MakerRemainderStatus, SwapPrice, SwapQuote, SwapRouteSegment } from '../../domain/swapQuote';
import type { ResolvedAsset } from '../../state/types';
import { CopyIcon } from '../common/CopyIcon';

type RouteSegmentCategory = 'fill' | 'remainder-roundup' | 'unrouted-input' | 'unavailable' | 'maker-remainder';

interface SwapRouteBarProps {
  quote: SwapQuote;
  offerAsset: ResolvedAsset;
  receiveAsset: ResolvedAsset;
}

interface RouteDisplaySegment {
  key: string;
  category: RouteSegmentCategory;
  title: string;
  description: string;
  quantity: bigint;
  inputEquivalentQuantity?: bigint;
  shareBps: number;
  className: string;
  routeSegment?: SwapRouteSegment;
  makerSegment?: SwapRouteSegment;
}

function bpsPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

function boundedShare(value: bigint, total: bigint): number {
  if (value <= 0n || total <= 0n) return 0;
  const bps = (value * 10_000n) / total;
  return Number(bps > 10_000n ? 10_000n : bps) / 100;
}

function priceText(price: SwapPrice | null, offerAsset: ResolvedAsset, receiveAsset: ResolvedAsset): string {
  if (!price || price.denominator <= 0n) return '-';
  const numerator = price.numerator * 10n ** BigInt(receiveAsset.decimals);
  const denominator = price.denominator * 10n ** BigInt(offerAsset.decimals);
  return ratioDecimal(numerator, denominator, 8);
}

function segmentAriaLabel(
  segment: SwapRouteSegment,
  offerAsset: ResolvedAsset,
  receiveAsset: ResolvedAsset,
  inputQuantity = segment.askQuantity,
  outputQuantity = segment.offerQuantity,
): string {
  return [
    `${fromBase(inputQuantity, offerAsset.decimals)} ${assetTitle(offerAsset)} offered`,
    `${fromBase(outputQuantity, receiveAsset.decimals)} ${assetTitle(receiveAsset)} received`,
    `${bpsPercent(segment.segmentSlippageBps)} slippage`,
    `UTxO ${segment.utxoRef}`,
    `Order type ${segment.orderKind}`,
  ].join(', ');
}

function segmentClass(segment: SwapRouteSegment): string {
  return `swap-route-${segment.severity}`;
}

function categoryDescription(category: RouteSegmentCategory, blocked: boolean): string {
  if (category === 'fill') return 'This part of the offered amount is routed through an executable order UTxO.';
  if (category === 'remainder-roundup') return 'This extra input is included to consume the order fully and avoid a below-minimum maker remainder.';
  if (category === 'unrouted-input') return 'This part of your offered input is not routed because the next boundary cannot satisfy the maker-remainder policy.';
  if (category === 'maker-remainder') return 'This is offered liquidity left in the maker order after your fill. It is not part of your offered input.';
  return blocked
    ? 'The remaining typed amount is unavailable because the next order-book boundary is not safe to consume.'
    : 'The remaining typed amount is unavailable because there is no more executable order-book depth.';
}

function makerRemainderLabel(status: MakerRemainderStatus): string {
  if (status === 'none') return 'Fully consumed';
  if (status === 'below-min-remainder') return 'Below minimum remainder';
  return 'Valid order remainder';
}

function makerRemainderDescription(status: MakerRemainderStatus): string {
  if (status === 'none') return 'This order is fully consumed by the route.';
  if (status === 'below-min-remainder') return 'This order would leave maker-side liquidity below the configured minimum; the quote should round up or block this boundary.';
  return 'This receive-asset liquidity stays in the maker order after your fill. It is not part of your offered input.';
}

export function SwapRouteBar({ quote, offerAsset, receiveAsset }: SwapRouteBarProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipId = 'swap-route-popover';
  const displaySegments = useMemo<RouteDisplaySegment[]>(() => {
    const segments: RouteDisplaySegment[] = quote.segments
      .flatMap((segment) => {
        const routeSegments: RouteDisplaySegment[] = segment.baseAskQuantity > 0n ? [{
          key: `fill:${segment.utxoRef}`,
          category: 'fill' as const,
          title: `Fill order ${segment.utxoRef}`,
          description: categoryDescription('fill', false),
          quantity: segment.baseAskQuantity,
          shareBps: boundedShare(segment.baseAskQuantity, quote.routeDisplayQuantity) * 100,
          className: segmentClass(segment),
          routeSegment: segment,
        }] : [];
        if (segment.roundUpAskQuantity > 0n) {
          routeSegments.push({
            key: `remainder-roundup:${segment.utxoRef}`,
            category: 'remainder-roundup',
            title: 'Minimum-remainder round-up included as offer',
            description: categoryDescription('remainder-roundup', false),
            quantity: segment.roundUpAskQuantity,
            shareBps: boundedShare(segment.roundUpAskQuantity, quote.routeDisplayQuantity) * 100,
            className: `swap-route-remainder-roundup swap-route-remainder-roundup-${segment.severity}`,
            routeSegment: segment,
          });
        }
        if (segment.makerRemainderQuantity > 0n) {
          routeSegments.push({
            key: `maker-remainder:${segment.utxoRef}`,
            category: 'maker-remainder',
            title: 'Offered liquidity left after fill',
            description: categoryDescription('maker-remainder', false),
            quantity: segment.makerRemainderQuantity,
            inputEquivalentQuantity: segment.makerRemainderAskEquivalentQuantity,
            shareBps: boundedShare(segment.makerRemainderAskEquivalentQuantity, quote.routeDisplayQuantity) * 100,
            className: 'swap-route-maker-remainder',
            makerSegment: segment,
          });
        }
        return routeSegments;
      })
      .filter((segment) => segment.quantity > 0n);
    if (quote.unfilledRequestedQuantity > 0n) {
      const category = quote.remainderBlockedCount ? 'unrouted-input' : 'unavailable';
      segments.push({
        key: category,
        category,
        title: category === 'unrouted-input' ? 'Unrouted input' : 'Unavailable in order book',
        description: categoryDescription(category, quote.remainderBlockedCount > 0),
        quantity: quote.unfilledRequestedQuantity,
        shareBps: boundedShare(quote.unfilledRequestedQuantity, quote.routeDisplayQuantity) * 100,
        className: category === 'unrouted-input' ? 'swap-route-unrouted-input' : 'swap-route-unavailable',
      });
    }
    return segments;
  }, [quote.remainderBlockedCount, quote.routeDisplayQuantity, quote.segments, quote.unfilledRequestedQuantity]);
  const activeDisplaySegment = useMemo(
    () => displaySegments.find((segment) => segment.key === activeKey) ?? null,
    [activeKey, displaySegments],
  );
  const activeRouteSegment = activeDisplaySegment?.routeSegment ?? null;
  const activeFillSegment = activeDisplaySegment?.category === 'fill' ? activeRouteSegment : null;
  const activeRoundUpSegment = activeDisplaySegment?.category === 'remainder-roundup' ? activeRouteSegment : null;
  const activeMakerSegment = activeDisplaySegment?.makerSegment ?? null;
  const activeIndex = activeFillSegment
    ? quote.segments.findIndex((segment) => segment.utxoRef === activeFillSegment.utxoRef) + 1
    : 0;

  useEffect(() => {
    if (!activeKey) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveKey(null);
        setPinned(false);
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setActiveKey(null);
        setPinned(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [activeKey]);

  if (!quote.requestedInputQuantity) {
    return (
      <div className="swap-route-empty text-body-secondary">
        Enter an offered amount to inspect the route.
      </div>
    );
  }

  if (!quote.segments.length) {
    return (
      <div className="swap-route-empty text-body-secondary">
        No executable one-way orders match this swap direction.
      </div>
    );
  }

  return (
    <div ref={rootRef} className="swap-route" aria-label="Swap route order fill plan">
      <div className="swap-route-track" role="list" aria-label="Orders selected for this swap">
        {displaySegments.map((segment) => {
          const routeSegment = segment.routeSegment;
          const makerSegment = segment.makerSegment;
          const label = routeSegment
            ? segment.category === 'fill'
              ? segmentAriaLabel(routeSegment, offerAsset, receiveAsset, segment.quantity, routeSegment.baseOfferQuantity)
              : `${segment.title}, ${fromBase(segment.quantity, offerAsset.decimals)} ${assetTitle(offerAsset)}, ${fromBase(routeSegment.roundUpOfferQuantity, receiveAsset.decimals)} ${assetTitle(receiveAsset)} extra received, ${segment.description}, UTxO ${routeSegment.utxoRef}`
            : makerSegment
              ? `${segment.title}, ${fromBase(segment.quantity, receiveAsset.decimals)} ${assetTitle(receiveAsset)}, input equivalent ${fromBase(segment.inputEquivalentQuantity ?? 0n, offerAsset.decimals)} ${assetTitle(offerAsset)}, ${segment.description}, UTxO ${makerSegment.utxoRef}`
              : `${segment.title}, ${fromBase(segment.quantity, offerAsset.decimals)} ${assetTitle(offerAsset)}, ${segment.description}`;
          return (
            <button
              key={segment.key}
              type="button"
              className={`swap-route-segment ${segment.className}`}
              style={{ flexBasis: `${Math.max(0.01, segment.shareBps / 100)}%` }}
              aria-describedby={activeKey === segment.key ? tooltipId : undefined}
              aria-label={label}
              role="listitem"
              onFocus={() => setActiveKey(segment.key)}
              onMouseEnter={() => setActiveKey(segment.key)}
              onMouseLeave={() => {
                if (!pinned) setActiveKey(null);
              }}
              onClick={() => {
                const nextPinned = !(pinned && activeKey === segment.key);
                setActiveKey(nextPinned ? segment.key : null);
                setPinned(nextPinned);
              }}
            >
              <span className="visually-hidden">{label}</span>
            </button>
          );
        })}
      </div>

      {activeDisplaySegment ? (
        <div
          id={tooltipId}
          className={`swap-route-popover ${activeFillSegment ? `swap-route-popover-${activeFillSegment.severity}` : 'swap-route-popover-muted'}`}
          role="tooltip"
          aria-live="polite"
        >
          <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
            <div>
              <div className="swap-route-popover-title">
                {activeFillSegment ? `Route segment ${activeIndex}/${quote.segments.length}` : activeDisplaySegment.title}
              </div>
              <div className="small text-body-secondary">{activeDisplaySegment.description}</div>
            </div>
            <span className={`badge rounded-pill swap-severity-badge ${activeFillSegment ? `swap-severity-${activeFillSegment.severity}` : 'swap-severity-muted'}`}>
              {activeFillSegment ? bpsPercent(activeFillSegment.cumulativeSlippageBps) : activeDisplaySegment.category}
            </span>
          </div>
          {activeFillSegment ? (
            <dl className="swap-route-popover-grid">
            <div>
              <dt>Order filled/offered</dt>
              <dd>
                {fromBase(activeFillSegment.offerQuantity, receiveAsset.decimals)} /{' '}
                {fromBase(activeFillSegment.availableOfferQuantity, receiveAsset.decimals)} {assetTitle(receiveAsset)}
              </dd>
            </div>
            <div>
              <dt>Order fill</dt>
              <dd>{bpsPercent(activeFillSegment.fillBps)}</dd>
            </div>
            <div>
              <dt>Order remainder</dt>
              <dd>
                {fromBase(activeFillSegment.makerRemainderQuantity, receiveAsset.decimals)} {assetTitle(receiveAsset)}
              </dd>
            </div>
            <div>
              <dt>Remainder status</dt>
              <dd>{makerRemainderLabel(activeFillSegment.makerRemainderStatus)}</dd>
            </div>
            <div className="swap-route-popover-wide">
              <dt>Order liquidity split</dt>
              <dd>
                <div
                  className="swap-route-remainder-track"
                  aria-label={`${bpsPercent(activeFillSegment.fillBps)} consumed, ${bpsPercent(activeFillSegment.makerRemainderBps)} maker-side remainder`}
                >
                  <span
                    className={`swap-route-remainder-fill ${segmentClass(activeFillSegment)}`}
                    style={{ flexBasis: `${Math.max(0.01, activeFillSegment.fillBps / 100)}%` }}
                  />
                  {activeFillSegment.makerRemainderQuantity > 0n ? (
                    <span
                      className={`swap-route-remainder-maker swap-route-remainder-${activeFillSegment.makerRemainderStatus}`}
                      style={{ flexBasis: `${Math.max(0.01, activeFillSegment.makerRemainderBps / 100)}%` }}
                    />
                  ) : null}
                </div>
                <span className="small text-body-secondary">
                  {makerRemainderDescription(activeFillSegment.makerRemainderStatus)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Total routed</dt>
              <dd>{bpsPercent(activeFillSegment.filledShareBps)} of filled input</dd>
            </div>
            <div>
              <dt>Input share</dt>
              <dd>{bpsPercent(activeDisplaySegment.shareBps)} of route display</dd>
            </div>
            <div>
              <dt>Base fill</dt>
              <dd>
                {fromBase(activeFillSegment.baseAskQuantity, offerAsset.decimals)} {assetTitle(offerAsset)} into{' '}
                {fromBase(activeFillSegment.baseOfferQuantity, receiveAsset.decimals)} {assetTitle(receiveAsset)}
              </dd>
            </div>
            {activeFillSegment.roundUpAskQuantity > 0n ? (
              <div>
                <dt>Round-up fill</dt>
                <dd>
                  {fromBase(activeFillSegment.roundUpAskQuantity, offerAsset.decimals)} {assetTitle(offerAsset)} into{' '}
                  {fromBase(activeFillSegment.roundUpOfferQuantity, receiveAsset.decimals)} {assetTitle(receiveAsset)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Fill price</dt>
              <dd>{priceText(activeFillSegment.price, offerAsset, receiveAsset)} {assetTitle(offerAsset)} / {assetTitle(receiveAsset)}</dd>
            </div>
            <div>
              <dt>Lowest price</dt>
              <dd>{priceText(quote.lowestPrice, offerAsset, receiveAsset)} {assetTitle(offerAsset)} / {assetTitle(receiveAsset)}</dd>
            </div>
            <div>
              <dt>Order slippage</dt>
              <dd>{bpsPercent(activeFillSegment.segmentSlippageBps)}</dd>
            </div>
            <div>
              <dt>Route slippage</dt>
              <dd>{bpsPercent(activeFillSegment.cumulativeSlippageBps)}</dd>
            </div>
            <div>
              <dt>Order type</dt>
              <dd>{activeFillSegment.orderKind}</dd>
            </div>
            <div>
              <dt>Segment category</dt>
              <dd>{activeDisplaySegment.category}</dd>
            </div>
          </dl>
          ) : activeMakerSegment ? (
            <dl className="swap-route-popover-grid">
              <div>
                <dt>Segment category</dt>
                <dd>maker-remainder</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{fromBase(activeMakerSegment.makerRemainderQuantity, receiveAsset.decimals)} {assetTitle(receiveAsset)}</dd>
              </div>
              <div>
                <dt>Input equivalent</dt>
                <dd>{fromBase(activeMakerSegment.makerRemainderAskEquivalentQuantity, offerAsset.decimals)} {assetTitle(offerAsset)}</dd>
              </div>
              <div>
                <dt>Order remainder</dt>
                <dd>{bpsPercent(activeMakerSegment.makerRemainderBps)} of maker offered liquidity</dd>
              </div>
              <div>
                <dt>Remainder status</dt>
                <dd>{makerRemainderLabel(activeMakerSegment.makerRemainderStatus)}</dd>
              </div>
              <div>
                <dt>Filled/offered</dt>
                <dd>
                  {fromBase(activeMakerSegment.offerQuantity, receiveAsset.decimals)} /{' '}
                  {fromBase(activeMakerSegment.availableOfferQuantity, receiveAsset.decimals)} {assetTitle(receiveAsset)}
                </dd>
              </div>
              <div>
                <dt>Route role</dt>
                <dd>Offered liquidity left after fill</dd>
              </div>
              <div className="swap-route-popover-wide">
                <dt>Explanation</dt>
                <dd>{makerRemainderDescription(activeMakerSegment.makerRemainderStatus)}</dd>
              </div>
            </dl>
          ) : (
            <dl className="swap-route-popover-grid">
              <div>
                <dt>Segment category</dt>
                <dd>{activeDisplaySegment.category}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{fromBase(activeDisplaySegment.quantity, offerAsset.decimals)} {assetTitle(offerAsset)}</dd>
              </div>
              {activeRoundUpSegment ? (
                <div>
                  <dt>Extra received</dt>
                  <dd>{fromBase(activeRoundUpSegment.roundUpOfferQuantity, receiveAsset.decimals)} {assetTitle(receiveAsset)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Input share</dt>
                <dd>{bpsPercent(activeDisplaySegment.shareBps)} of route display</dd>
              </div>
              <div>
                <dt>Route role</dt>
                <dd>{activeDisplaySegment.title}</dd>
              </div>
            </dl>
          )}
          {activeFillSegment || activeMakerSegment || activeRoundUpSegment ? (
            <div className="swap-route-utxo">
              <span>UTxO {(activeFillSegment ?? activeMakerSegment ?? activeRoundUpSegment)?.utxoRef}</span>
              <CopyIcon value={(activeFillSegment ?? activeMakerSegment ?? activeRoundUpSegment)?.utxoRef ?? ''} label="Copy route UTxO reference" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
