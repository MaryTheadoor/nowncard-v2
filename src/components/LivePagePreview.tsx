import LiveCardPreview from '@/components/LiveCardPreview';
import type { Card } from '@/types';

interface LivePagePreviewProps {
  card: Partial<Card>;
  className?: string;
  layout?: 'stack' | 'row';
}

/**
 * Full card-page preview: the flip card plus the page background and the
 * UI elements a visitor would see (action buttons, link list, inquiry box).
 * All auxiliary elements are non-interactive mocks for layout/preview only.
 *
 * `layout="row"` renders compact and side-by-side on large screens (card on
 * the left, links/actions on the right) so the whole page fits one screen.
 */
export default function LivePagePreview({ card, className = '', layout = 'stack' }: LivePagePreviewProps) {
  const featuredLinks = card.featuredLinksEnabled && Array.isArray(card.featuredLinks)
    ? card.featuredLinks.filter((l) => l?.url?.trim() && l?.label?.trim())
    : [];

  const isRow = layout === 'row';

  return (
    <div
      className={`rounded-xl transition-colors ${isRow ? 'p-3' : 'p-4'} ${className}`}
      style={{ backgroundColor: card.pageBgColor || undefined }}
    >
      <div className={isRow ? 'flex flex-col lg:flex-row lg:gap-4' : ''}>
        {/* Card */}
        <div className={isRow ? 'w-full lg:w-[180px] lg:shrink-0 mx-auto' : ''}>
          <LiveCardPreview card={card} />
        </div>

        {/* Auxiliary page elements */}
        <div className={`pointer-events-none select-none ${isRow ? 'flex-1 min-w-0 flex flex-col gap-2.5 lg:mt-0' : ''}`} aria-hidden="true">
          {/* Action buttons */}
          <div className={`flex flex-wrap gap-2 justify-center ${isRow ? '' : 'mt-4'}`}>
            <span className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-space">Save to Contacts</span>
            {card.appointmentsEnabled && (
              <span className="px-4 py-2 rounded-xl text-xs font-bold bg-space text-ink border border-line">Book</span>
            )}
            <span className="px-4 py-2 rounded-xl text-xs font-bold bg-space text-ink border border-line">Share</span>
          </div>

          {/* Link list */}
          {featuredLinks.length > 0 && (
            <div className={`flex flex-col gap-2 ${isRow ? '' : 'mt-4'}`}>
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider text-center">Links</div>
              {featuredLinks.map((l, i) => (
                <span
                  key={`fl-${i}`}
                  className="w-full text-center px-4 py-2.5 rounded-xl text-xs font-bold bg-space text-ink border border-line"
                >
                  {l.label}
                </span>
              ))}
            </div>
          )}

          {/* Inquiry box */}
          <div className={`bg-space border border-line rounded-xl p-3 ${isRow ? '' : 'mt-4'}`}>
            <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">Send an Inquiry</div>
            <div className="px-3 py-2 bg-tile border border-line rounded-lg text-ink-faint text-xs">
              Hi! I'd love to connect…
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
