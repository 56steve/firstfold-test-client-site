/**
 * The one uuid check shared by the availability route (which forwards only a uuid `practitioner`) and the doctor
 * picker (which offers only doctors the route would forward). Kept in its own module, with no imports, so client
 * components can use it without pulling in any server-side forwarding code.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` is a uuid (any version, either case). */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
