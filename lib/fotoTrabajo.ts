// Se elimina metadata al redibujar. El servidor limita JPEG a 5 MB.
export async function prepararFotoTrabajo(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Elegí una foto JPG, PNG o WebP. Si tu celular usa HEIC, elegí el formato JPG.');
  }
  if (file.size > 25 * 1024 * 1024) throw new Error('La foto supera 25 MB. Elegí una más chica.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * factor));
    canvas.height = Math.max(1, Math.round(bitmap.height * factor));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la foto.');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('No se pudo reducir la foto. Elegí otra imagen.');
    return blob;
  } finally { bitmap.close(); }
}
