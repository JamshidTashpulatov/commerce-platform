BEGIN;
CREATE TABLE investor_monthly_allocations (
  store_id uuid NOT NULL, order_id uuid NOT NULL, receipt_id uuid NOT NULL, investor_account_id uuid NOT NULL,
  principal_uzs bigint NOT NULL CHECK(principal_uzs >= 0),
  profit_uzs bigint NOT NULL CHECK(profit_uzs >= 0),
  PRIMARY KEY(store_id,receipt_id,investor_account_id),
  FOREIGN KEY(store_id,receipt_id,investor_account_id)
    REFERENCES installment_receipt_funding_weights(store_id,receipt_id,investor_account_id),
  FOREIGN KEY(store_id,order_id,investor_account_id)
    REFERENCES order_funding_allocations(store_id,order_id,investor_account_id)
);
CREATE INDEX monthly_allocations_account_idx ON investor_monthly_allocations(store_id,investor_account_id,order_id);
CREATE VIEW active_monthly_allocations AS
  SELECT a.* FROM investor_monthly_allocations a
  WHERE NOT EXISTS (SELECT 1 FROM installment_receipt_reversals v WHERE v.store_id=a.store_id AND v.receipt_id=a.receipt_id);
CREATE OR REPLACE VIEW investor_funding_balances AS
 SELECT a.store_id,a.order_id,a.investor_account_id,a.amount_uzs,
   (i.returned + m.returned)::bigint AS returned_uzs,
   (a.amount_uzs-i.returned-m.returned)::bigint AS outstanding_uzs
 FROM order_funding_allocations a
 CROSS JOIN LATERAL (
   SELECT COALESCE(SUM(r.amount_uzs),0) AS returned FROM investor_initial_returns r
   WHERE r.store_id=a.store_id AND r.order_id=a.order_id AND r.investor_account_id=a.investor_account_id
   AND NOT EXISTS (SELECT 1 FROM order_receipt_reversals v WHERE v.store_id=r.store_id AND v.receipt_id=r.receipt_id)
 ) i
 CROSS JOIN LATERAL (
   SELECT COALESCE(SUM(r.principal_uzs),0) AS returned FROM active_monthly_allocations r
   WHERE r.store_id=a.store_id AND r.order_id=a.order_id AND r.investor_account_id=a.investor_account_id
 ) m;
CREATE VIEW investor_report_movements AS
 SELECT store_id,investor_account_id,id,event_type,amount_uzs,created_at FROM investor_capital_events
 UNION ALL
 SELECT i.store_id,i.investor_account_id,i.receipt_id,'principal_return',i.amount_uzs,i.created_at
 FROM investor_initial_returns i WHERE NOT EXISTS (
   SELECT 1 FROM order_receipt_reversals v WHERE v.store_id=i.store_id AND v.receipt_id=i.receipt_id)
 UNION ALL
 SELECT a.store_id,a.investor_account_id,a.receipt_id,entry.kind,entry.amount,r.received_at
 FROM active_monthly_allocations a JOIN installment_receipts r ON r.store_id=a.store_id AND r.id=a.receipt_id
 CROSS JOIN LATERAL (VALUES ('principal_return',a.principal_uzs),('received_profit',a.profit_uzs)) entry(kind,amount)
 WHERE entry.amount>0;
COMMIT;
