/*
# Create RPC function: create_restaurant_with_owner

## Summary
Crea una función Postgres SECURITY DEFINER que en una sola transacción
atómica:
1. Genera un slug único a partir del nombre del restaurante (lowercase,
   sin acentos, espacios → guiones, caracteres inválidos eliminados).
   Maneja colisiones con sufijo incremental (-2, -3, ...).
2. Inserta la fila en Restaurants con estado='draft' y
   onboarding_completed=false.
3. Vincula al auth user recién creado como OWNER (rol='admin') de ese
   restaurante en restaurant_users.
4. Retorna el restaurant_id y slug creados.

## Por qué es necesaria
- restaurant_users NO tiene política INSERT para clientes — solo SELECT.
  Un usuario recién registrado no puede insertar directo en
  restaurant_users desde el cliente.
- Aunque Restaurants tiene policies USING(true), la creación atómica
  de restaurante + vinculación de owner debe ser una sola operación
  segura que no se puede hacer desde el cliente.
- SECURITY DEFINER permite que la función se ejecute con los privilegios
  del propietario (postgres), bypassing RLS para INSERT en
  restaurant_users.

## Security
- SECURITY DEFINER con SET search_path = public (fijo, previene
  hijacking de search_path).
- Verifica que el caller esté autenticado vía auth.uid().
- Solo puede crear un restaurante para sí mismo (el user_id debe ser
  auth.uid()).
- EXECUTE granted to authenticated role.

## Important Notes
1. La función NO crea el auth user — eso se hace con supabase.auth.signUp()
   en el cliente. La función recibe el user_id ya creado.
2. El slug se genera con acentos eliminados, espacios reemplazados por
   guiones, y caracteres no alfanuméricos (excepto guiones) eliminados.
3. Si el slug ya existe, se intenta con sufijo -2, -3, etc.
4. El restaurante se crea con estado='draft' y onboarding_completed=false.
*/

CREATE OR REPLACE FUNCTION public.create_restaurant_with_owner(
  p_user_id uuid,
  p_nombre_restaurante text,
  p_email text,
  p_telefono text DEFAULT ''
)
RETURNS TABLE (restaurant_id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_slug text;
  v_slug text;
  v_suffix int := 0;
  v_restaurant_id uuid;
  v_nombre_responsable text;
BEGIN
  -- Verificar que el caller esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Verificar que el user_id coincida con el caller
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'No autorizado: user_id no coincide con la sesión';
  END IF;

  -- Generar slug base: lowercase, sin acentos, espacios → guiones
  v_base_slug := lower(
    regexp_replace(
      unaccent(p_nombre_restaurante),
      '[^a-z0-9]+', '-', 'g'
    )
  );
  -- Limpiar guiones al inicio/final
  v_base_slug := trim(both '-' from v_base_slug);
  -- Si quedó vacío, usar fallback
  IF v_base_slug = '' OR v_base_slug IS NULL THEN
    v_base_slug := 'restaurante';
  END IF;

  v_slug := v_base_slug;

  -- Manejar colisiones con sufijo incremental
  WHILE EXISTS (SELECT 1 FROM "Restaurants" WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  -- Insertar restaurante con estado='draft'
  INSERT INTO "Restaurants" (
    nombre,
    slug,
    email,
    password,
    servicio_activo,
    hora_apertura,
    hora_cierre,
    costo_envio,
    costo_envio_por_platillo,
    pickup_activo,
    repartidor_propio,
    repartidor_externo,
    logo,
    pedido_minimo,
    direccion,
    telefono,
    estado,
    onboarding_completed,
    activo
  ) VALUES (
    p_nombre_restaurante,
    v_slug,
    p_email,
    '',
    false,           -- servicio_activo: false hasta que complete onboarding
    '08:00',
    '22:00',
    0,
    0,
    true,            -- pickup_activo
    true,            -- repartidor_propio
    false,           -- repartidor_externo
    NULL,
    0,
    '',
    p_telefono,
    'draft',
    false,
    true             -- activo: true (compatibilidad con Mi Tierra)
  )
  RETURNING id INTO v_restaurant_id;

  -- Vincular al usuario como owner (rol='admin')
  INSERT INTO restaurant_users (
    user_id,
    restaurant_id,
    rol,
    email
  ) VALUES (
    p_user_id,
    v_restaurant_id,
    'admin',
    p_email
  );

  -- Retornar resultado
  RETURN QUERY SELECT v_restaurant_id, v_slug;
END;
$$;

-- Grant execute to authenticated
REVOKE ALL ON FUNCTION public.create_restaurant_with_owner(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_restaurant_with_owner(uuid, text, text, text) TO authenticated;

-- Asegurar que la extensión unaccent esté disponible
CREATE EXTENSION IF NOT EXISTS unaccent;
