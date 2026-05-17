# NownCard — Strategic Network & Affiliate Marketing Plan

> **Version:** 1.0  
> **Date:** 2026-05-15  
> **Status:** Draft for implementation

---

## 1. Program Overview

NownCard will launch a **two-tier affiliate program** — not MLM, no multi-level commissions — with two distinct paths:

| Tier | Name | Who It's For | Reward |
|------|------|-------------|--------|
| **Tier 1** | **NownCard Advocate** | Every user (auto-enrolled) | 1 free year of service per referred signup (stackable) |
| **Tier 2** | **NownCard Partner** | Influencers, agencies, power referrers | Commission % on paid signups + tax paperwork + PayPal payouts |

No confusing levels, no downline tracking, no "rank advancement" mechanics. Clean and simple.

---

## 2. Tier 1 — NownCard Advocate (Every User)

### How It Works
1. Every user gets a unique referral code on signup (e.g., `AMOS42`)
2. Their personal referral link: `https://nowncard.com/?ref=AMOS42`
3. When someone signs up using their code, the **referrer** gets **1 free year** added to their subscription
4. The **referred person** gets **25% off** their first year (Pro or Business)
5. Rewards **stack** — refer 3 people, get 3 free years

### Economics & Guardrails
- Free users referred with a code get their free card as normal (no discount applicable)
- Pro/Business referrals: the 25% discount is applied at checkout (Square payment link with discount)
- Years are "Pro-equivalent" — if on Business, 1 referral = 1 year of Business free
- Cap: Maximum 5 free years stacked at any time (prevents abuse, still generous)
- Churned referrals: if referred user cancels within 60 days, the free year is revoked

### User Experience
- **Dashboard tab "Referrals":** Shows referral code, copy button, share buttons (Twitter, LinkedIn, email), count of successful referrals, free years earned
- **Landing page badge:** "Sign up with a friend's code and save 25%"
- **Auth modal:** Optional "Referral code" field during signup, auto-populated from `?ref=` URL param

### Why This Works
- **Viral loop effect:** Every user is incentivized to share — not just affiliates
- **Zero cash outlay:** Rewarding with service time costs NownCard nothing in hard dollars
- **Sticky users:** Someone with 3 free years banked won't churn
- **Dropbox proved this model:** Double-sided rewards create exponential growth

---

## 3. Tier 2 — NownCard Partner (Influencers & Power Referrers)

### How It Works
1. Users apply (or are invited) to become a NownCard Partner
2. Partners get a **unique tracked link + code** with higher visibility in the system
3. On every paid signup (Pro $19 or Business $39), partner earns a **commission %**
4. Payouts are monthly via **PayPal Business** (minimum $50 threshold)
5. Partners who earn over **$600/year** must provide tax info (W-9 for US, equivalent for international)

### Commission Structure

| Monthly Referred Revenue | Commission Rate |
|--------------------------|-----------------|
| $0 – $500/mo | 25% |
| $500 – $2,000/mo | 30% |
| $2,000+/mo | 35% |

Example: A partner refers 20 Pro users in a month = $380 revenue @ 25% = **$95 payout**.  
Example: A partner refers 100 Pro + 20 Business users = $2,680 revenue @ 35% = **$938 payout**.

### Cookie Window
- **60 days** (standard, matches Uniqode benchmark)
- First-touch attribution (first referrer gets credit, not last-click)

### Partner Onboarding Flow
1. Partner signs up as a normal user first (must have a NownCard account)
2. In Dashboard → Affiliate tab, clicks "Apply to be a Partner"
3. Submits: name, email, PayPal address, social/website (optional), agrees to terms
4. Admin reviews and approves/rejects from Admin panel
5. On approval: partner gets dashboard with real-time clicks, signups, conversions, earnings, payout history
6. Tax interview triggered at $500 lifetime earnings (before first payout over $600 threshold)

### Tax Compliance
- **US Partners:** Collect W-9 via embedded form (name, TIN/SSN, address). 1099-NEC issued for $600+/year.
- **Non-US Partners:** Collect W-8BEN (or local equivalent). No 1099 issued; partner responsible for their own tax jurisdiction.
- **Automated via** a simple form in the partner dashboard (store encrypted in Firestore subcollection `partners/{uid}/taxInfo`)
- Payouts held until tax info is submitted if earnings exceed $500

### Payouts
- **Method:** PayPal Business API (Payouts or MassPay)
- **Frequency:** Monthly (paid ~15th of following month for prior month's settled referrals)
- **Minimum:** $50 (rolls over if below threshold)
- **Hold period:** 30 days after referred payment settles (Square's refund window)
- **Refund clawback:** If a referred user refunds, commission is deducted from next payout

### Partner Dashboard Features
- Real-time stats: clicks, signups, conversion rate, earnings, next payout date
- Referral link + QR code for sharing
- Performance chart (last 30/90 days)
- Payout history with downloadable statements
- Marketing assets: banners, email templates, social copy (hosted in Firebase Storage)
- Leaderboard (opt-in, shows top 10 partners by revenue)

### Anti-Fraud Measures
- No self-referrals (cannot use your own code)
- No incentivized signups (cannot pay people to sign up)
- No branded keyword bidding on paid search
- IP monitoring for suspicious signup patterns
- Manual review of partner applications
- Terms of service with clear penalties for fraud

---

## 4. Market Context & Competitive Positioning

### Competitor Affiliate Programs

| Competitor | Affiliate Program | Commission | Cookie Window | Platform |
|-----------|-------------------|------------|---------------|----------|
| **Uniqode** | Yes (Global) | 30% flat | 60 days | PartnerStack |
| **Popl** | Yes (Solutions Partner) | Undisclosed % | Not disclosed | Direct |
| **Blinq** | Yes (Channel Partner) | Undisclosed | Not disclosed | Proprietary |
| **HiHello** | **None** | — | — | — |
| **Linq** | **None** | — | — | — |

### Key Differentiators for NownCard
1. **Only platform with a free-tier affiliate program** (Advocate level) — this is unique
2. **No app required for recipients** — PWA works everywhere, unlike Popl/Blinq
3. **Double-sided rewards** (referrer gets free year + referred gets 25% off) — proven viral model
4. **Transparent affiliate terms** — unlike Blinq and Popl who hide commission details

### Customer Sentiment — What to Get Right
- **Don't limit the free tier too aggressively** (Blinq's 2-card limit gets complaints)
- **Offer monthly billing option** (Uniqode is annual-only — a friction point)
- **Keep the product focused on digital cards** (Popl pivoted to event lead capture and alienated core users)
- **No app download requirement for recipients** (NownCard already wins here)
- **Be transparent about data privacy** (Popl's "Our Data" product raises concerns)

---

## 5. Technical Architecture

### Data Model Additions

```typescript
// Extended UserData (new fields)
interface UserData {
  // ...existing...
  affiliateCode?: string;       // unique, e.g. "AMOS42"
  referredBy?: string;          // affiliateCode of referrer
  freeYearsRemaining?: number;  // stacked free years from referrals
  partnerTier?: 'advocate' | 'partner';  // affiliate tier
  paypalEmail?: string;         // for partner payouts
}

// New collections

// referrals/{referralId} — tracks every referral event
interface Referral {
  id: string;
  affiliateUid: string;         // referrer's UID
  affiliateCode: string;        // code used
  referredUid: string;          // new user's UID
  converted: boolean;           // true when referred user upgrades
  convertedPlan?: 'pro' | 'business';
  convertedAt?: Timestamp;
  rewardApplied: boolean;       // free year credited
  createdAt: Timestamp;
}

// commissions/{commissionId} — partner earnings
interface Commission {
  id: string;
  partnerUid: string;
  referralId: string;
  referredUid: string;
  plan: 'pro' | 'business';
  amountCents: number;          // commission amount
  ratePct: number;              // rate at time of conversion
  sourceAmountCents: number;    // plan price
  status: 'pending' | 'cleared' | 'paid' | 'clawed_back';
  upgradeId: string;            // ref to upgrades/{id}
  createdAt: Timestamp;
  clearedAt?: Timestamp;
  paidAt?: Timestamp;
}

// payouts/{payoutId} — actual payments sent
interface Payout {
  id: string;
  partnerUid: string;
  amountCents: number;
  commissionIds: string[];      // covered commissions
  paypalBatchId?: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Timestamp;
  sentAt?: Timestamp;
}

// config/affiliate — global settings
interface AffiliateConfig {
  commissionRates: { tier1: 25; tier2: 30; tier3: 35 };
  thresholds: { tier2: 50000; tier3: 200000 }; // in cents
  cookieDays: 60;
  minPayoutCents: 5000;
  referredDiscountPct: 25;
  holdPeriodDays: 30;
  taxFormThresholdCents: 50000;  // $500 lifetime -> require tax info
  enabled: boolean;
}
```

### File Changes Required

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `Referral`, `Commission`, `Payout`, `AffiliateConfig`, extend `UserData` |
| `src/hooks/useAuth.ts` | Accept `referralCode` param in signUpEmail; generate `affiliateCode` on user create; write `referredBy` |
| `src/components/AuthModal.tsx` | Add referral code input field (signup mode only); read from `?ref=` URL param |
| `src/components/Navbar.tsx` | Add "Affiliate" link for authenticated users |
| `src/pages/LandingPage.tsx` | Read `?ref=` from URL, pass to AuthModal, show "signed up with code" badge |
| `src/lib/affiliate.ts` | **NEW** — client-side: fetch stats, copy referral link, apply for partner status |
| `src/pages/DashboardPage.tsx` | Add "Referrals" tab with stats, share tools, free years counter |
| `src/pages/AffiliatePage.tsx` | **NEW** — partner dashboard: stats, earnings, payout history, tax form upload |
| `src/pages/AdminPage.tsx` | Add partner approval UI, commission overview, payout management |
| `src/App.tsx` | Add `/affiliate` route |
| `functions/src/index.ts` | Add triggers: `onUserCreated` (generate codes, process referrals), `onUpgradeCreated` (apply commissions, free years); Add callables: `validateReferralCode`, `getAffiliateStats`, `requestPayout`, `applyForPartner` |
| `firestore.rules` | Add rules for `referrals`, `commissions`, `payouts`, `partners` collections |
| `scripts/migrate-affiliate.ts` | **NEW** — backfill affiliate codes for existing users |

### Trigger Architecture

```
1. onDocumentCreated('users/{uid}') — FIRES ON SIGNUP
   → Generate unique affiliateCode for new user
   → If referredBy is set:
      → Validate code exists and is not self-referral
      → Write referral doc: { affiliateUid, referredUid, converted: false }
      → Return (reward happens on conversion, not signup)

2. onDocumentCreated('upgrades/{docId}') — FIRES ON PAYMENT
   → Read upgrade: { uid, plan, price }
   → Query referrals where referredUid == uid AND converted == false
   → For each referral found:
      → ADVOCATE REWARD (Tier 1):
         → Increment referrer's freeYearsRemaining
         → Mark referral: converted: true, rewardApplied: true
         → Apply 25% discount logic (verify it was applied at checkout)
      → PARTNER COMMISSION (Tier 2, if referrer is a partner):
         → Calculate commission based on current rate tier
         → Write commission doc with status: 'pending'
         → Schedule clearance after 30-day hold (or use scheduled function)

3. cleanupCommissions (scheduled, daily) — CLEARS PENDING COMMISSIONS
   → Query commissions where status == 'pending' AND createdAt < now - 30 days
   → Update status to 'cleared' (eligible for next payout)

4. processPayouts (scheduled, monthly on 15th) — SENDS PAYPAL PAYOUTS
   → Query commissions where status == 'cleared' AND paidAt == null
   → Group by partnerUid
   → For partners meeting $50 minimum AND with tax info (if needed):
      → Create payout doc
      → Call PayPal Payouts API
      → Update commissions: status = 'paid', paidAt
```

---

## 6. Implementation Roadmap

### Phase 1 — Advocate Tier (Week 1-2)
**Ship the viral referral loop first — this drives user growth immediately.**

- [ ] Add `affiliateCode` and `referredBy` to UserData type
- [ ] Generate unique codes on user creation (Cloud Function trigger)
- [ ] Add referral code field to AuthModal signup flow
- [ ] Support `?ref=CODE` URL param on LandingPage
- [ ] Add "Referrals" tab to Dashboard (stats, share tools, copy link)
- [ ] Implement free year logic (increment `freeYearsRemaining` on upgrade trigger)
- [ ] Backfill codes for existing users (migration script)
- [ ] Add Firestore rules for referrals collection
- [ ] Deploy and test end-to-end

### Phase 2 — Partner Tier (Week 3-4)
**Layer in the influencer/commission model.**

- [ ] Add partner application flow (Dashboard → apply → admin review)
- [ ] Build partner dashboard (`/affiliate` page): stats, earnings, payouts, tax form
- [ ] Implement commission calculation logic (Cloud Function trigger on upgrades)
- [ ] Build admin partner management (approve, view stats, manage payouts)
- [ ] Add PayPal integration for payouts (Cloud Function)
- [ ] Build tax info collection form (embedded W-9/W-8BEN)
- [ ] Implement 30-day hold period and monthly payout schedule
- [ ] Add payout history and downloadable statements
- [ ] Deploy and test end-to-end

### Phase 3 — Partner Marketing Toolkit (Week 5-6)
**Give partners assets to drive more referrals.**

- [ ] Create marketing asset library (banners, email templates, social copy)
- [ ] Host assets in Firebase Storage, serve via Partner dashboard
- [ ] Build referral QR code generator for in-person sharing
- [ ] Add opt-in partner leaderboard
- [ ] Implement affiliate attribution analytics (clicks by source, conversion funnels)
- [ ] Write partner terms of service and program guidelines

### Phase 4 — Optimization & Scale (Ongoing)
- [ ] A/B test referral code placement (landing page hero vs. footer vs. auth modal)
- [ ] A/B test discount percentage (25% vs. 50% for referred users)
- [ ] Monitor fraud patterns, tune anti-fraud rules
- [ ] Build referral email reminders ("You have 3 people who started signing up but didn't finish")
- [ ] Integrate with CRM/email marketing for partner nurture sequences
- [ ] Consider PartnerStack integration for Phase 2+ scale (marketplace listing)

---

## 7. Success Metrics

| Metric | Baseline | 3-Month Target | 12-Month Target |
|--------|----------|---------------|-----------------|
| Users enrolled in Advocate tier | 100% (auto) | 100% | 100% |
| Share rate (% who share their code) | 0% | 5-10% | 15-20% |
| Referral signup conversion rate | 0% | 8-12% | 12-18% |
| Active Partners (Tier 2) | 0 | 10-20 | 50-100 |
| Referral-driven signups as % of total | 0% | 15-25% | 30-40% |
| Partner-driven paid conversions/mo | 0 | $500-2,000 | $5,000-15,000 |
| CAC reduction from referrals | — | 20-30% | 40-60% |

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Referral fraud** (fake signups for free years) | Require payment for free year to apply (free year credited only when referred user upgrades); IP monitoring; rate limiting on signups |
| **Partner commission fraud** (self-referrals, paid signups) | No self-referral enforcement; manual review for partners; minimum 30-day hold on commissions |
| **Tax compliance burden** | Automate W-9/W-8BEN collection; 1099-NEC generation via third-party API (e.g., Track1099); only partners over $600 |
| **PayPal payout failures** | Retry logic with exponential backoff; admin notification on failure; manual override capability |
| **Free year stacking abuse** | Cap at 5 stacked years; free years only apply at renewal time not mid-cycle |
| **Branded keyword cannibalization** | Prohibit partners from bidding on "NownCard" keywords in paid search; enforce in partner terms |

---

## 9. Projected Economics

### Per-User Economics (Conservative)

| Metric | Value |
|--------|-------|
| Avg. Pro plan annual revenue | $14.25 (25% discount at $19) |
| Avg. Business plan annual revenue | $29.25 (25% discount at $39) |
| Advocate cost per referral | $0 cash, ~$14-29 in foregone revenue (free year) |
| Partner commission per Pro referral | $4.75 at 25% rate |
| Partner commission per Business referral | $9.75 at 25% rate |
| Blended partner commission | ~$6.50/referral |

### Break-Even on Partner Program

- At 25% rate: NownCard keeps 75% of referred revenue = profitable from day 1
- At 35% rate (top tier): NownCard keeps 65% = still profitable on incremental users
- Advocate free years: cost is deferred revenue, not cash — cash flow impact is low
- **Bottom line:** Both programs are profitable on a marginal basis; they reduce overall CAC

---

*End of plan. Ready for implementation discussion.*
