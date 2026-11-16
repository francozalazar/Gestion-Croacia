// Carteles breves: verde si salió bien, rojo si falló. Se muestran arriba a la derecha.
export type TipoToast = "ok" | "error";
export const EVENTO_TOAST = "croacia-toast";
function emitir(tipo: TipoToast, mensaje: string) {
  if (typeof window === "undefined" || !mensaje) return;
  window.dispatchEvent(new CustomEvent(EVENTO_TOAST, { detail: { tipo, mensaje } }));
}
export const toast = {
  ok: (mensaje: string) => emitir("ok", mensaje),
  error: (mensaje: string) => emitir("error", mensaje),
};
