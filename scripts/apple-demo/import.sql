-- Only upgrade untouched Apple demo rows. Keep existing IDs for historical references.
WITH source AS (
  SELECT * FROM jsonb_to_recordset($2::jsonb)
    AS x(id uuid,name text,legacy uuid,groups jsonb,variants jsonb)
), eligible AS MATERIALIZED (
  SELECT s.*,v.price_uzs
  FROM source s JOIN products p ON p.id=s.id AND p.store_id=$1::uuid AND p.name=s.name
  JOIN variants v ON v.id=s.legacy AND v.store_id=p.store_id AND v.product_id=p.id
  WHERE p.revision=0 AND p.option_groups='[]' AND p.description='Demo mahsulot · narx va mavjudlik namuna uchun.'
    AND v.revision=0 AND v.active AND v.quantity=0 AND v.option_values='{}' AND v.color='Standart'
    AND v.sku='APPLE-DEMO-'||left(s.id::text,8)
    AND NOT EXISTS (SELECT 1 FROM variants other WHERE other.product_id=p.id AND other.id<>v.id)
  ORDER BY p.id FOR UPDATE OF p,v
), updated AS (
  UPDATE products p SET option_groups=e.groups, revision=p.revision+1
  FROM eligible e WHERE p.id=e.id RETURNING p.id
), retired AS (
  UPDATE variants v SET active=(e.groups='[]'),
    image_url=CASE WHEN e.groups='[]' THEN e.variants->0->>'image' ELSE v.image_url END,
    revision=v.revision+1
  FROM eligible e WHERE v.id=e.legacy RETURNING v.id
), added AS (
  INSERT INTO variants(id,store_id,product_id,sku,color,storage_label,price_uzs,quantity,option_values,image_url,active)
  SELECT x.id,$1::uuid,e.id,'APPLE-DEMO-'||x.id::text,
    COALESCE(x.options->>'Rang', 'Standart'),x.options->>'Xotira',e.price_uzs+x.delta,0,x.options,x.image,true
  FROM eligible e CROSS JOIN LATERAL jsonb_to_recordset(e.variants) AS x(id uuid,options jsonb,image text,delta bigint)
  WHERE e.groups<>'[]' RETURNING id
)
SELECT (SELECT count(*) FROM updated) AS products,(SELECT count(*) FROM added) AS new_variants,
       (SELECT count(*) FROM retired) AS processed_defaults
