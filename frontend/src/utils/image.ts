// Las fotos de celular suelen pesar varios MB: se reducen antes de subirlas (la API acepta hasta 5 MB).
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.85;

export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
}
