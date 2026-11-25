BEGIN;
CREATE TABLE receipt_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL, order_id uuid NOT NULL,
 monthly_id uuid, manual_id uuid,
 opened_by uuid NOT NULL, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 240),
 opened_at timestamptz NOT NULL DEFAULT now(),
 resolved_by uuid, resolution text, resolved_at timestamptz,
 CHECK(num_nonnulls(monthly_id,manual_id)=1),
 CHECK(num_nonnulls(resolved_by,resolution,resolved_at) IN (0,3)),
 UNIQUE(store_id,monthly_id), UNIQUE(store_id,manual_id),
 FOREIGN KEY(store_id,order_id) REFERENCES orders(store_id,id),
 FOREIGN KEY(store_id,monthly_id) REFERENCES installment_receipts(store_id,id),
 FOREIGN KEY(store_id,order_id,manual_id) REFERENCES order_manual_receipts(store_id,order_id,id),
 FOREIGN KEY(store_id,opened_by) REFERENCES memberships(store_id,account_id),
 FOREIGN KEY(store_id,resolved_by) REFERENCES memberships(store_id,account_id)
);
-- Preserve previously reported months and book corrections on their actual posting date.
CREATE OR REPLACE VIEW investor_report_movements AS
 SELECT store_id,investor_account_id,id,event_type,amount_uzs,created_at FROM investor_capital_events
 UNION ALL
 SELECT i.store_id,i.investor_account_id,i.receipt_id,'principal_return',i.amount_uzs,i.created_at FROM investor_initial_returns i
 UNION ALL
 SELECT i.store_id,i.investor_account_id,i.receipt_id,'principal_correction',-i.amount_uzs,v.created_at
 FROM investor_initial_returns i JOIN order_receipt_reversals v ON v.store_id=i.store_id AND v.receipt_id=i.receipt_id
 UNION ALL
 SELECT a.store_id,a.investor_account_id,a.receipt_id,e.kind,e.amount,e.at FROM investor_monthly_allocations a
 JOIN installment_receipts r ON r.store_id=a.store_id AND r.id=a.receipt_id
 LEFT JOIN installment_receipt_reversals v ON v.store_id=a.store_id AND v.receipt_id=a.receipt_id
 CROSS JOIN LATERAL (VALUES ('principal_return',a.principal_uzs,r.received_at),('received_profit',a.profit_uzs,r.received_at),
 ('principal_correction',-a.principal_uzs,v.created_at),('profit_correction',-a.profit_uzs,v.created_at)) e(kind,amount,at)
 WHERE e.amount<>0 AND e.at IS NOT NULL;
COMMIT;
