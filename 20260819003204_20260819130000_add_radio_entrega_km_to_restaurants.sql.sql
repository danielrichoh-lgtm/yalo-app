/*
# Add radio_entrega_km to Restaurants

## Summary
Agrega una columna `radio_entrega_km` a Restaurants para almacenar el
radio de cobertura de entrega a domicilio. Actualmente el checkout de
Mi Tierra usa un radio hardcodeado de 1 km (aviso visual en Checkout.tsx).
Esta columna permite que cada restaurante configure su propio radio.

## Modified Tables
- `Restaurants`: agregada columna `radio_entrega_km numeric` con
  default 1.0 (km). Nullable para no romper restaurantes existentes
  que no lo configuren.

## Security
- No se modifican políticas RLS.

## Important Notes
1. Mi Tierra se marca con radio_entrega_km=1.0 para preservar el
   comportamiento actual del checkout.
2. El campo es opcional (nullable) para compatibilidad con restaurantes
   existentes.
*/

ALTER TABLE "Restaurants" ADD COLUMN IF NOT EXISTS radio_entrega_km numeric DEFAULT 1.0;

-- Preservar comportamiento de Mi Tierra
UPDATE "Restaurants" SET radio_entrega_km = 1.0 WHERE slug = 'mi-tierra' AND radio_entrega_km IS NULL;
