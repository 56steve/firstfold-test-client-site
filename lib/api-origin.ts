/** The Firstfold platform origin, shared by every module that calls it (blog, site info, booking). */
const DEFAULT_API_ORIGIN = "https://app.firstfold.io";

/** `FIRSTFOLD_API_ORIGIN` with trailing slashes stripped, or the production default when it isn't set. */
export function apiOrigin(): string {
  const configured = process.env.FIRSTFOLD_API_ORIGIN?.trim();
  return configured === undefined || configured === "" ? DEFAULT_API_ORIGIN : configured.replace(/\/+$/, "");
}
