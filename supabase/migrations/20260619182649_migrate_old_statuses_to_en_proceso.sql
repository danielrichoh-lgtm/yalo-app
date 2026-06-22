UPDATE orders SET status = 'En proceso' WHERE status IN ('Preparando', 'Listo', 'En camino');
