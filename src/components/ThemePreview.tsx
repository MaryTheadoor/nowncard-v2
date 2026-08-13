function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-ink-faint">{children}</div>
  );
}

/**
 * Simulated site-chrome preview that mirrors the CSS-variable-driven surfaces
 * (like LivePagePreview does for the card editor). Rendered with token classes
 * (bg-space, text-accent, btn-primary, …) so it updates live as the admin edits
 * variables in the theme panel.
 */
export default function ThemePreview() {
  return (
    <div className="bg-space border border-line rounded-2xl p-4 space-y-4 text-left overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink">Surface preview</span>
        <span className="text-[9px] font-semibold text-success">● live</span>
      </div>

      {/* Headings / text on page background */}
      <div className="space-y-1.5">
        <Caption>space · ink · accent · ink-muted</Caption>
        <div className="rounded-lg px-3 py-2 bg-space">
          <div className="text-sm font-extrabold text-ink leading-snug">
            Build your card <span className="text-accent">in seconds</span>
          </div>
          <div className="text-[11px] text-ink-muted">Share via link, QR code, or NFC tap.</div>
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-1.5">
        <Caption>btn-primary · btn-secondary · btn-danger</Caption>
        <div className="flex flex-wrap gap-2">
          <span className="btn btn-primary btn-sm pointer-events-none">Save</span>
          <span className="btn btn-secondary btn-sm pointer-events-none">Share</span>
          <span className="btn btn-danger btn-sm pointer-events-none">Delete</span>
        </div>
      </div>

      {/* Tiles */}
      <div className="space-y-1.5">
        <Caption>tile · line · ink-muted · ink-faint</Caption>
        <div className="bg-tile border border-line rounded-lg p-3">
          <div className="text-xs font-bold text-ink">Card title</div>
          <div className="text-[11px] text-ink-muted">Muted description line</div>
          <div className="text-[10px] text-ink-faint">Faint meta text</div>
        </div>
        <div className="bg-tile-soft border border-line-soft rounded-lg px-3 py-2">
          <div className="text-[10px] text-ink-muted">tile-soft</div>
        </div>
      </div>

      {/* Semantic status */}
      <div className="space-y-1.5">
        <Caption>success · warning · danger · violet · secondary</Caption>
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-success/10 text-success border border-success/25">success</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-warning/10 text-warning border border-warning/25">warning</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger/10 text-danger border border-danger/25">danger</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet/10 text-violet border border-violet/25">violet</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-secondary/10 text-secondary border border-secondary/25">secondary</span>
        </div>
      </div>

      {/* Homepage tiles */}
      <div className="space-y-1.5">
        <Caption>tile-gold · tile-blue</Caption>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-tile-gold text-tile-gold-text rounded-lg p-2.5">
            <div className="text-xs font-bold">Gold tile</div>
            <div className="text-[10px] opacity-80">accent surface</div>
          </div>
          <div className="bg-tile-blue text-tile-blue-text rounded-lg p-2.5">
            <div className="text-xs font-bold">Blue tile</div>
            <div className="text-[10px] opacity-80">secondary surface</div>
          </div>
        </div>
      </div>
    </div>
  );
}
