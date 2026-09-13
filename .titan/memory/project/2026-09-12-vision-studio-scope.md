# Vision Studio product scope

Date: 2026-09-12

Source: product workflow and explicit decisions supplied by the user.

Vision Studio is a multi-tenant SaaS for optical stores in Cuba. Organizations
start with one branch and may add more. Orders and sellers belong to branches;
the owner sees all branches with filters. Initial currencies are CUP and USD.

The MVP covers customers, optical prescriptions, guided lens selection,
configurable pricing, quotation acceptance, orders, cash payments, daily closing,
lens production, frame selection, mounting, audit history and manually triggered
WhatsApp notifications. Sellers and assigned external workers may update states.
An external worker uses one account across all participating optical organizations
and can only see explicitly assigned jobs.

Accepted quotations become orders without re-entry. Changes are audited, total
changes require renewed confirmation, and normal editing locks after sending the
lens job to its provider.

Each seller has a separate daily cash drawer. Each sale stores the exchange rate
entered by the seller when the sale is commercially confirmed, so later rate
changes do not alter historical orders. The product supplies a base pricing and
graduation-rule catalog that each organization can customize.

Customer records use phone numbers for search and WhatsApp but phone numbers are
not unique. A national ID or other identifier is optional, and possible duplicate
customers should trigger a warning.

Corrections after provider dispatch use linked incidents/rework records rather
than overwriting the original work. Cost responsibility is recorded, and customer
reconfirmation is required only when their total changes.

WhatsApp will later integrate through the owner's OpenWA service hosted on a VPS;
the application should isolate that integration behind a provider interface.

Deferred: full per-branch frame inventory and reservations; warranties and
after-sales; refunds and formal cancellations; receipts and fiscal invoices;
customer accounts; signatures; non-cash payment methods.

Each seller sees only their own orders, collections and cashbox. Sellers in the
same branch may find and reuse basic customer and necessary prescription data,
without seeing another seller's prices or payments. The MVP has no separate
general-admin or branch-manager roles. Every
catalog item retains its configured currency; a catalog may mix CUP and USD.
USD-only combinations may be paid in CUP when the seller allows it and applies the
sale-specific rate. A sale fixes its exchange rate when accepted, and payments may
mix CUP and USD while preserving each payment's original amount and conversion.

An order uses no more than one active lens provider and one active mounting
provider. Delivery always requires a zero balance in the MVP, without overrides.
Closing a seller's daily cashbox does not block later collections.

Visible order numbers use `ORG-YEAR-SEQUENCE`, with ORG derived from the first
three normalized letters of the organization name and a per-organization,
per-year sequence. Orders also retain a non-visible global identifier.

The owner may change the organization prefix before its first order; afterward it
remains fixed even if the organization name changes. Sellers may collect cash
after closing: those payments are marked as post-close and included through an
additional immutable closing, while the daily summary consolidates all closings.

The MVP owner dashboard includes orders by state and incident, sales and
collections by seller/branch, outstanding balances, provider workloads, average
acceptance-to-delivery time, cash differences and top product/lens/treatment data.
Promised dates, production estimates, urgency and lateness tracking are explicitly
outside the MVP.

MVP onboarding is operator-managed: the platform superadmin creates each
organization and first owner, then the owner adds sellers and links providers.
The platform owner is the sole superadmin and needs an internal panel for tenant
status, base catalog maintenance, usage, support and audited assisted access.

Subscriptions are recorded manually without online payments and have trial,
active, expired/read-only and suspended states. Operational records are never
physically deleted through normal product flows; they are archived, voided or
deactivated while historical references remain intact.

All users authenticate with email and password. There is one configurable
contract model rather than fixed public tiers. Each organization records its
negotiated subscription amount/currency, period, dates, status, notes and enabled
modules. Trial defaults to 15 days, expiry is read-only, suspension is manual and
renewal restores access.

The application must be modular. The superadmin enables the modules negotiated
with each organization and may change them over time together with the subscription
amount. Module entitlements are server-enforced, audited, dependency-aware and do
not delete historical data when disabled. Future inventory and warranty features
must fit this entitlement model.

Confirmed modules are mandatory Core; Optical Sales; Cashbox; Production and
Providers; WhatsApp; Analytics; Multi-branch; and future Inventory, Warranty,
Invoicing and Payment modules. Cashbox and Production depend on Optical Sales;
WhatsApp depends on Optical Sales; Multi-branch extends Core. Disabling a module
blocks new operations, hides seller actions and leaves prior data read-only for
the owner. Reactivation restores normal access. Disabling Multi-branch leaves one
active branch and preserves the others read-only.
