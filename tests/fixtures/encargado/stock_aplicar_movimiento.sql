CREATE OR REPLACE FUNCTION public.stock_aplicar_movimiento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform set_config('stock.en_movimiento', '1', true);
  if new.tipo in ('INICIAL','ENTRADA') then
    update public.stock_motores set cantidad = cantidad + new.cantidad where id = new.motor_id;
  else
    update public.stock_motores set cantidad = cantidad - new.cantidad
      where id = new.motor_id and cantidad >= new.cantidad;
    if not found then
      raise exception 'No hay suficiente stock de ese motor para registrar la salida.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $function$
