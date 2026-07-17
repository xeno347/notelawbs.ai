/** Apple Pencil / stylus helpers — Notes-like drawing feel. */

export type PointerKind = 'stylus' | 'finger' | 'unknown';

export function pointerKind(evt: any): PointerKind {
  const ne = evt?.nativeEvent || evt || {};
  const t0 = ne.touches?.[0] || ne.changedTouches?.[0] || ne;
  // iOS exposes touchType on UITouch (RN may pass it through).
  // IMPORTANT: do NOT use `force` to detect Pencil — on many iPads a finger
  // reports force=1.0 whenever it is down, which falsely marks every touch as
  // stylus and then Pencil double-tap heuristics cancel real draw strokes.
  const type = (t0?.touchType || ne.touchType || '').toString().toLowerCase();
  if (type.includes('stylus') || type.includes('pencil')) return 'stylus';
  if (type.includes('direct') || type.includes('finger')) return 'finger';
  const altitude = t0?.altitudeAngle ?? ne.altitudeAngle;
  if (typeof altitude === 'number' && altitude > 0 && altitude < Math.PI / 2) {
    return 'stylus';
  }
  return 'unknown';
}

export function readForce(evt: any): number {
  const ne = evt?.nativeEvent || evt || {};
  const t0 = ne.touches?.[0] || ne.changedTouches?.[0] || ne;
  const f = typeof t0?.force === 'number' ? t0.force : typeof ne.force === 'number' ? ne.force : 0;
  return Math.max(0, Math.min(1, f));
}

/** Map Apple Pencil pressure to stroke width (Notes-like). */
export function pencilStrokeWidth(tool: 'pen' | 'highlighter' | 'eraser', force: number): number {
  if (tool === 'highlighter') return 16;
  if (tool === 'eraser') return 22;
  const f = force > 0 ? force : 0.35;
  return Math.max(1.2, Math.min(7.5, 1.1 + f * 6.2));
}

/**
 * Whether this touch should draw.
 * Notes style: Apple Pencil always draws; finger only when fingerDraw is on.
 */
export function shouldAcceptDraw(evt: any, fingerDraw: boolean): boolean {
  const kind = pointerKind(evt);
  if (kind === 'stylus') return true;
  if (kind === 'finger') return fingerDraw;
  // Unknown (Android / simulator): respect fingerDraw toggle
  return fingerDraw;
}

/** Detect Pencil double-tap heuristic from two quick stylus taps. Returns true if fired. */
export function createPencilDoubleTap(onDoubleTap: () => void, windowMs = 380) {
  let last = 0;
  return (evt: any): boolean => {
    if (pointerKind(evt) !== 'stylus') return false;
    const now = Date.now();
    if (now - last < windowMs) {
      last = 0;
      onDoubleTap();
      return true;
    }
    last = now;
    return false;
  };
}
