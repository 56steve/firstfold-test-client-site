/**
 * The initials shown in a doctor's circle on the /book page's doctor picker when the platform has no photo for
 * them. Pure, so it is unit-tested directly.
 */

/** A leading honorific that says nothing about who the doctor is: "Dr Rahul Menon" reads as "RM", not "DM". */
const TITLE_PATTERN = /^dr\.?$/i;

/** The first character of a word, whole — `Array.from` splits by code point, so a letter outside the Basic
 * Multilingual Plane isn't cut in half the way `word[0]` would. */
function firstCharacter(word: string): string {
  return Array.from(word)[0] ?? "";
}

/**
 * Up to two uppercase initials: the first letters of the first and last words of `name`, after skipping a leading
 * "Dr"/"Dr." (unless that is the only word, so a name is never reduced to nothing). One word gives one initial;
 * a blank name gives an empty string.
 */
export function practitionerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word !== "");
  const [first, ...rest] = words;
  if (first === undefined) return "";
  const meaningful = TITLE_PATTERN.test(first) && rest.length > 0 ? rest : words;

  const head = meaningful[0] ?? "";
  const tail = meaningful.length > 1 ? (meaningful[meaningful.length - 1] ?? "") : "";
  return `${firstCharacter(head)}${firstCharacter(tail)}`.toUpperCase();
}
