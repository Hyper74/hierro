// Guardar y leer archivos en el iPhone.
// En una web app instalada, la hoja "Compartir" de iOS es la forma más fiable
// de guardar un archivo (→ "Guardar en Archivos"); si no existe, descarga normal.

export async function saveFile(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return true;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return false; // el usuario canceló
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}

/** Abre el selector de archivos del sistema y devuelve {name, text} o null. */
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.append(input);
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) return resolve(null);
      resolve({ name: f.name, text: await f.text() });
    });
    input.addEventListener('cancel', () => { input.remove(); resolve(null); });
    input.click();
  });
}
