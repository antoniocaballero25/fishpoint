import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class ImageCompressorService {
  async compressImage(
    file: File,
    maxDimension = 1280,
    quality = 0.78,
  ): Promise<File> {
    if (!file.type.startsWith("image/")) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          // Mantiene transparencia si es PNG (logos), si no usa WebP/JPEG ligero
          const isPng = file.type === "image/png";
          const outputMime = isPng ? "image/webp" : "image/jpeg";
          const extension = isPng ? "webp" : "jpg";

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const cleanName = file.name.replace(/\.[^/.]+$/, "");
              const compressedFile = new File(
                [blob],
                `${cleanName}.${extension}`,
                {
                  type: outputMime,
                  lastModified: Date.now(),
                },
              );
              resolve(compressedFile);
            },
            outputMime,
            quality,
          );
        };
        img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
        img.src = event.target?.result as string;
      };
      reader.onerror = () =>
        reject(new Error("Error leyendo el archivo de imagen."));
      reader.readAsDataURL(file);
    });
  }
}
