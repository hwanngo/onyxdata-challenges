# Assumptions - 2025/11

Every entry here is a judgement call the data did not make for me. Each one is footnoted in the UI
at the point of use. Where I had a choice I took the one that makes the dashboard's claims *weaker*,
not stronger.

---

**A-1 · "Revenue" means ex-tax.**
The file's `net_revenue_usd` is defined by its own arithmetic as `qty × price - discount + tax`, so
it is gross of sales tax. I treat recognisable revenue as excluding tax, which is standard revenue
recognition - tax collected is remitted, not earned. Both figures are shown side by side throughout;
the reported figure is never hidden, only labelled. *Alternative rejected:* keeping the file's
definition, which would make the country comparison a VAT ranking (see C3).

**A-2 · "North America" is the label for the blank region.**
`region` is `""` for 19,579 events and 1,628 customers, and that set is exactly {United States,
Canada} with no country appearing under two labels. I substitute the label `North America`. This is
a rename, not an imputation - no row changes group. *Recorded because* a reader comparing my region
chart to the raw file will find a category that isn't there.

**A-3 · A refunded event contributes zero revenue, not negative and not partial.**
`is_refunded` is boolean and the file carries no refund *amount*. Zeroing the event is the only
available treatment. If refunds were partial in reality this understates recognisable revenue by
the unrefunded remainder. Affected: 1,005 events, $567,634 ex-tax, 2.0% of the total.

**A-4 · Product identity is `base_key + billing_cycle`, and only where price agrees.**
The 101-SKU catalogue collapses to 70 (base_key × billing_cycle) groups, of which 6 have multiple
`product_id`s at an *identical* price with events distributed uniformly across them - those are
duplicates and are merged. Where SKUs under one `base_key` carry genuinely different prices (e.g.
Notion AI Monthly at $9.88 / $10.00 / $12.40 / $14.96) they are real tiers and are **kept separate**.
The merge is therefore conservative: it never combines two things the file prices differently.

**A-5 · The customer clock is the customer's first *event*, never `signup_date`.**
37.9% of events precede their own customer's signup date, and the affected fraction correlates with
the signup timestamp at r = 0.925 - signup dates were drawn independently of the transactions. Every
tenure, cohort and time-to-second-purchase measure uses first event. *Consequence to state plainly:*
this project cannot report acquisition-cohort retention, because the file does not record when
anyone was acquired.

**A-6 · A "basket" is one customer on one calendar day.**
The file has no order or basket identifier; each row is a single product line. Customer × day is the
most generous grouping available. It yields 47,476 baskets of which 1.09% are multi-line, so this
assumption is stated mainly to justify *declining* the attach-rate metric rather than to support it.

**A-7 · "Repeat buyer" means ≥2 `order` events, excluding `invoice`.**
The dictionary glosses `order` as a new sale and `invoice` as a renewal, so counting invoices would
make every customer a repeat buyer by definition. Under the stricter reading it is still 3,995 of
4,000. Both counts are published. *Complication recorded:* 1,164 customers' first-ever event is an
`invoice` - a renewal with nothing to renew - so `event_type` does not reliably encode a lifecycle,
and neither definition should be treated as a true new-vs-returning split.

**A-8 · The first and last months are partial and are marked, not dropped.**
Coverage runs 2024-04-22 → 2025-10-21, so 2024-04 (763 events) and 2025-10 (1,798) are incomplete.
They are drawn with an explicit partial marker. *Rejected:* silently trimming them, which would hide
the file's actual extent.

**A-9 · `latitude`/`longitude` are country centroids and are not used for mapping.**
Both the Events and Customers coordinate columns take exactly 10 distinct values - one per country.
A point map would plot ten dots and imply a precision the file does not have. Geography is shown as
a ranked comparison instead.

**A-10 · Categories are used as supplied, including the overlapping ones.**
`category` contains both "Productivity" and "Productivity Suite", and both "AI Tools" and "AI
Productivity"; `vendor` contains the value "AI Tools" alongside real vendors. I do not merge them -
I have no basis for deciding which SKU belongs where, and inventing a taxonomy would be a business
judgement the file does not support. The overlap is footnoted wherever category is charted.
