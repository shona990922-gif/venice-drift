import { MathUtils } from "three";
/** Shared mouse/touch model. No reference to the route, boat or throttle. */
export class LookState {
  yaw = 0;
  pitch = 0.06;
  targetYaw = 0;
  targetPitch = 0.06;
  drag(dx: number, dy: number, sensitivity: number) {
    this.targetYaw -= dx * sensitivity;
    this.targetPitch = MathUtils.clamp(
      this.targetPitch - dy * sensitivity,
      -1.22,
      1.32,
    );
  }
  update(dt: number) {
    this.yaw = MathUtils.damp(this.yaw, this.targetYaw, 11, dt);
    this.pitch = MathUtils.damp(this.pitch, this.targetPitch, 11, dt);
  }
}
export class PointerLook extends LookState {
  enabled = false;
  lastPointerType = "none";
  private pointer: number | null = null;
  private x = 0;
  private y = 0;
  constructor(private element: HTMLElement) {
    super();
    element.addEventListener("pointerdown", this.down);
    element.addEventListener("pointermove", this.move);
    element.addEventListener("pointerup", this.end);
    element.addEventListener("pointercancel", this.end);
    element.addEventListener("lostpointercapture", this.end);
    element.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", this.cancel);
  }
  private down = (e: PointerEvent) => {
    if (
      !this.enabled ||
      this.pointer !== null ||
      !e.isPrimary ||
      e.button !== 0
    )
      return;
    this.pointer = e.pointerId;
    this.x = e.clientX;
    this.y = e.clientY;
    this.lastPointerType = e.pointerType;
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch {
      /* Synthetic QA events / released native contact have no active capture. */
    }
    this.element.classList.add("dragging");
    e.preventDefault();
  };
  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    const sensitivity =
      Math.PI /
      Math.max(
        460,
        Math.min(this.element.clientWidth, this.element.clientHeight) * 1.15,
      );
    this.drag(e.clientX - this.x, e.clientY - this.y, sensitivity);
    this.x = e.clientX;
    this.y = e.clientY;
    e.preventDefault();
  };
  private end = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    this.cancel();
  };
  private cancel = () => {
    this.pointer = null;
    this.element.classList.remove("dragging");
  };
  dispose() {
    this.element.removeEventListener("pointerdown", this.down);
    this.element.removeEventListener("pointermove", this.move);
    this.element.removeEventListener("pointerup", this.end);
    this.element.removeEventListener("pointercancel", this.end);
    this.element.removeEventListener("lostpointercapture", this.end);
    window.removeEventListener("blur", this.cancel);
  }
}
