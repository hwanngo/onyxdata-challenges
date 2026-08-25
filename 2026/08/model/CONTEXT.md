# August Risk Evidence Glossary

## Transaction

One delivered row keyed by `transaction_id`. The fact table is mechanically transaction-grain even
though worker attributes repeat.

## Risk control

A source field presented as a prospective indicator of fraud, dispute or reversal: worker
`risk_score`, transaction `velocity_score`, channel `avg_fraud_rate`, market
`market_fraud_index`, processing time or transaction amount. A control is not considered validated
until it predicts a confirmed outcome on held-out data.

## Event flag

One of the three delivered Booleans: `is_fraud_flagged`, `is_disputed`, `is_reversed`. These are
synthetic indicators, not confirmed operational outcomes.

## Outcome label

The categorical `transaction_outcome`. A label does not supersede an event flag because the two
systems show no measurable association and the archive supplies no event chronology.

## Recorded exposure

The delivered `amount_usd`, retained only as `source_amount_usd_unreconciled`. It is not a converted
amount because it does not reconcile with local amount and FX.

## Recorded loss

The delivered `fraud_loss_usd`, retained only as `source_fraud_loss_usd_unbounded`. Its presence is
a valid fraud-flag switch; its magnitude is not confirmed loss because it is unrelated to and can
exceed recorded exposure.

## Connector

An expected evidence relationship in the risk system: controls → event flags, flags → outcomes,
exposure → loss, or validator → delivered files.

## Broken connector

A connector for which the delivered archive provides no robust predictive, semantic, arithmetic or
contractual linkage. “Broken” diagnoses the synthetic archive, not a real operating platform.

## Positive control

A designed relationship the analysis must recover. Here, positive loss presence matches the fraud
flag on every delivered row.

## Open lead

A materially sized result whose uncertainty still includes no effect. It is retained for
preregistered holdout confirmation and must not be presented as either confirmed or disproved.
Month-end Cash-Out reversal is the only current open lead.

## Confirmed claim

A prespecified claim whose effect, direction and uncertainty meet the declared decision rule. None of
the six supplied findings is confirmed in this archive.

## Validation contract

A declared field, relationship, range or arithmetic identity that must be checked against the exact
files being released. A missing contract fails closed rather than becoming a warning.
