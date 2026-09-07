# Product Requirements

## 1. Problem

Strata / facilities managers such as **T&M Management Services** control access to
mixed-use buildings (e.g. 101–121 Castlereagh St, Sydney). Before any contractor
works on site they must be inducted on the building's **Site Induction, House
Rules, and Traffic Management Plan**, provide SWMS / WHS plans and valid
insurances, and be signed in at the loading dock.

Today this runs on PDFs, email (48-hour access requests), and a sign-in tablet.
Problems:

- No proof a contractor actually **read and understood** the documents.
- Documents are "live" (the House Rules are already at v04) — when they change,
  there is no way to know who was inducted on the **old** version.
- No fast way for security/concierge to verify a contractor is currently compliant.
- Insurance / licence expiry tracking is manual.
- No auditable evidence chain if something goes wrong.

## 2. Product principle

The strongest version of this product is **not** "watch a video and sign". It is
a property-level compliance system with a clear evidence chain:

> source document → approved induction version → contractor attempt →
> knowledge result → declaration → signature → certificate →
> current compliance status → audit history

## 3. Primary actors (roles)

| Role | Summary |
|------|---------|
| Platform Admin | All organisations, plans, system settings, support/audit |
| Organisation Admin | Properties, contractors, inductions, users, reports (their org) |
| Building Manager | Assigned properties, contractors, compliance, reports |
| Security / Concierge | QR verification, view current compliance only |
| Contractor Company Admin | Company profile, workers, induction status, certificates |
| Contractor Worker | Own profile, assigned inductions, attempts, certificates |

## 4. Core use cases (V1)

1. Org admin creates an organisation and one or more properties.
2. Manager uploads source documents (Site Induction, House Rules, Traffic Plan).
3. Manager builds an induction (optionally AI-assisted) and **publishes** an
   immutable version.
4. Contractor receives a property-specific secure link or scans a QR code.
5. Contractor enters identity / company / vehicle details, completes required
   modules, passes knowledge checks, accepts the declaration, and signs.
6. System creates an **immutable completion record** and a signed PDF certificate.
7. Managers see compliant / pending / expiring / expired contractors.
8. Security scans a contractor QR to verify **current** compliance.
9. When a new mandatory version is published, affected contractors become
   **re-induction required** and are notified.

## 5. Definition of Done (V1)

- [ ] Admin can create organisation + property.
- [ ] Admin can create contractor company + worker.
- [ ] Admin can upload source documents.
- [ ] Admin can create / review / publish immutable induction versions.
- [ ] Admin can add slides, media and questions.
- [ ] Contractor can complete an induction from a QR / secure link.
- [ ] Knowledge check is enforced (not "video opened").
- [ ] Declaration + digital signature are captured.
- [ ] Signed PDF certificate is generated and stored (never overwritten).
- [ ] Compliance status + expiry calculated correctly.
- [ ] Admin can search / filter / export compliance.
- [ ] Security can verify a contractor by QR.
- [ ] Version changes trigger re-induction.
- [ ] Audit logs exist for material actions.
- [ ] Automated unit / integration / E2E / security tests pass.
- [ ] Production config contains no hard-coded secrets.

## 6. Explicitly out of scope for V1 (future modules)

SWMS/JSA authoring, permits to work, delivery/loading-dock bookings, incident
reporting, toolbox meetings, site attendance, work orders, building-access-system
integrations. **Insurance / licence expiry tracking** is pulled *forward* (near
Stage 5) because T&M's own House Rules make it mandatory before works.

## 7. Subscription model (product packaging)

Billing is per-organisation, tiered by properties + active contractors. The DB
carries `plans` and `subscriptions` so packaging can evolve without a schema
change. Indicative tiers:

| Tier | Properties | Highlights |
|------|-----------|------------|
| Starter | 1 | Manual induction builder, QR verify, certificates |
| Pro | up to 10 | AI-assisted builder, insurance/licence expiry, reminders |
| Enterprise | unlimited | White-label, API, SSO, priority support |

Add-ons: extra properties, SMS notifications.
