// Se elimina metadata al redibujar. El servidor limita JPEG a 5 MB.
export interface FotosPreparadas {
  foto: Blob;
  miniatura: Blob;
}

async function dibujarReducida(bitmap: ImageBitmap, maximo: number, calidad: number, maxBytes: number, errorGrande: string): Promise<Blob> {
  const factor = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * factor));
  canvas.height = Math.max(1, Math.round(bitmap.height * factor));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la foto.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad));
  if (!blob || blob.size > maxBytes) throw new Error(errorGrande);
  return blob;
}

// Genera la foto completa (1600px) y una miniatura (480px) para portadas de cards.
export async function prepararFotosTrabajo(file: File): Promise<FotosPreparadas> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Elegí una foto JPG, PNG o WebP. Si tu celular usa HEIC, elegí el formato JPG.');
  }
  if (file.size > 25 * 1024 * 1024) throw new Error('La foto supera 25 MB. Elegí una más chica.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const foto = await dibujarReducida(bitmap, 1600, 0.8, 2 * 1024 * 1024, 'No se pudo reducir la foto. Elegí otra imagen.');
    const miniatura = await dibujarReducida(bitmap, 480, 0.75, 300 * 1024, 'No se pudo generar la miniatura. Elegí otra imagen.');
    return { foto, miniatura };
  } finally { bitmap.close(); }
}

export async function prepararFotoTrabajo(file: File): Promise<Blob> {
  const preparadas = await prepararFotosTrabajo(file);
  return preparadas.foto;
}

// Ruta de la miniatura derivada de la ruta de la foto completa.
export function rutaMiniatura(storagePath: string): string {
  return storagePath.replace(/\.jpg$/i, '-thumb.jpg');
}
