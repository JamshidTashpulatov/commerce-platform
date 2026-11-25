BEGIN;
-- Each source is an actual recorded movement; reservations and internal principal credits are not cash flows.
CREATE VIEW recorded_fund_movements AS
 SELECT store_id,id AS source_id,'capital_contribution'::text AS kind,amount_uzs AS amount_uzs,(created_at AT TIME ZONE 'Asia/Tashkent')::date AS movement_date,created_at AS recorded_at FROM investor_capital_events WHERE event_type='contribution'
 UNION ALL
 SELECT store_id,id,'capital_withdrawal',-amount_uzs,(created_at AT TIME ZONE 'Asia/Tashkent')::date,created_at FROM investor_capital_events WHERE event_type='withdrawal'
 UNION ALL
 SELECT store_id,id,'profit_distribution',-amount_uzs,(created_at AT TIME ZONE 'Asia/Tashkent')::date,created_at FROM investor_capital_events WHERE event_type='distribution'
 UNION ALL
 SELECT r.store_id,r.id,CASE WHEN r.kind='initial' THEN 'initial_receipt' ELSE 'cash_sale_receipt' END,r.amount_uzs,r.received_on,r.created_at
 FROM order_manual_receipts r
 UNION ALL
 SELECT r.store_id,r.id,'manual_receipt_reversal',-r.amount_uzs,(v.created_at AT TIME ZONE 'Asia/Tashkent')::date,v.created_at
 FROM order_manual_receipts r JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id
 UNION ALL
 SELECT r.store_id,r.id,'monthly_receipt',r.amount_uzs,COALESCE(r.received_on,(r.received_at AT TIME ZONE 'Asia/Tashkent')::date),r.received_at
 FROM installment_receipts r
 UNION ALL
 SELECT r.store_id,r.id,'monthly_receipt_reversal',-r.amount_uzs,(v.created_at AT TIME ZONE 'Asia/Tashkent')::date,v.created_at
 FROM installment_receipts r JOIN installment_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id
 UNION ALL
 SELECT store_id,id,'supplier_payment',-amount_uzs,(paid_at AT TIME ZONE 'Asia/Tashkent')::date,paid_at FROM supplier_payments;
COMMIT;
