/*
# Add estado + onboarding_completed to Restaurants

## Summary
Agrega dos columnas a la tabla Restaurants para soportar el flujo de
onboarding público de nuevos restaurantes:

1. `estado` — ciclo de vida del restaurante (draft, pending_approval,
   trial, active, free, suspended). Reemplaza el uso de `activo` boolean
   para control de acceso al dashboard operativo.
2. `onboarding_completed` — boolean que indica si el dueño completó el
   wizard inicial. Un restaurante puede estar en `draft` pero ya tener
   `onboarding_completed=true` (armó su menú pero no ha "publicado").

## Orden exacto de la migración (segura, no destructiva)
1. Agregar columna `estado` sin default ni NOT NULL.
2. Marcar todos los restaurantes existentes (incluido Mi Tierra) como
   `active`.
3. Establecer DEFAULT 'draft' para nuevos restaurantes.
4. Establecer NOT NULL.
5. Agregar CHECK constraint con los valores permitidos.
6. Agregar `onboarding_completed` boolean NOT NULL DEFAULT false.

## Modified Tables
- `Restaurants`:
  - `estado text NOT NULL DEFAULT 'draft'` con CHECK constraint
  - `onboarding_completed boolean NOT NULL DEFAULT false`

## Security
- No se modifican políticas RLS existentes.
- No se cambia `activo` (se mantiene por compatibilidad con Mi Tierra).

## Important Notes
1. Mi Tierra queda explícitamente en `active` tras la migración.
2. `onboarding_completed` se establece en true solo al completar el wizard.
3. El CHECK constraint permite: draft, pending_approval, trial, active,
   free, suspended.
*/

-- Paso 1: agregar columna estado sin default ni NOT NULL
ALTER TABLE "Restaurants" ADD COLUMN IF NOT EXISTS estado text;

-- Paso 2: marcar todos los restaurantes existentes como active
UPDATE "Restaurants" SET estado = 'active' WHERE estado IS NULL;

-- Paso 3: establecer DEFAULT 'draft'
ALTER TABLE "Restaurants" ALTER COLUMN estado SET DEFAULT 'draft';

-- Paso 4: establecer NOT NULL
ALTER TABLE "Restaurants" ALTER COLUMN estado SET NOT NULL;

-- Paso 5: CHECK constraint con valores permitidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_estado_check'
  ) THEN
    ALTER TABLE "Restaurants"
    ADD CONSTRAINT restaurants_estado_check
    CHECK (estado IN ('draft', 'pending_approval', 'trial', 'active', 'free', 'suspended'));
  END IF;
END $$;

-- Paso 6: agregar onboarding_completed
ALTER TABLE "Restaurants" ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Confirmar Mi Tierra en active
UPDATE "Restaurants" SET estado = 'active' WHERE slug = 'mi-tierra';
