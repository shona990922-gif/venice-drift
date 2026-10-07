import type { PerspectiveCamera, WebGLRenderer } from "three";
/** Explicit desktop regression, only invoked from the debug button. */
export async function auditLook(
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  draw: (yaw: number, pitch: number) => void,
) {
  const gl = renderer.getContext();
  const pixels = new Uint8Array(
    gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
  );
  const poses: [number, number][] = [];
  for (const pitch of [-1.22, -0.65, -0.15, 0, 0.45, 1, 1.32])
    for (let i = 0; i < 24; i++) poses.push([(i / 24) * Math.PI * 2, pitch]);
  // Include continuous motion across the horizon as well as exact extreme poses.
  for (let i = 0; i < 120; i++)
    poses.push([i * 0.075, Math.sin(i * 0.12) * 1.2]);
  const rows = [];
  for (const [yaw, pitch] of poses) {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    draw(yaw, pitch);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    let white = 0,
      count = 0,
      total = 0;
    for (let i = 0; i < pixels.length; i += 64) {
      if (pixels[i] > 230 && pixels[i + 1] > 230 && pixels[i + 2] > 230)
        white++;
      total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 765;
      count++;
    }
    rows.push({
      yaw,
      pitch,
      whiteFraction: white / count,
      luminance: total / count,
      finiteCamera: camera.projectionMatrix.elements.every(Number.isFinite),
    });
  }
  return {
    samples: rows.length,
    maxWhiteFraction: Math.max(...rows.map((r) => r.whiteFraction)),
    pass: rows.every((r) => r.whiteFraction < 0.8 && r.finiteCamera),
    rows,
  };
}
