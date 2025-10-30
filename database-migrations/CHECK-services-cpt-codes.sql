-- Check if services have default_cpt populated
SELECT
  id,
  name,
  default_cpt,
  price as price_cents
FROM services
ORDER BY name;
