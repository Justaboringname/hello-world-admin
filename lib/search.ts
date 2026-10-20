// Turning a search box into PostgREST filters without letting the text change
// the filter. postgrest-js passes .or() strings and ilike patterns through
// as-is, so the escaping is ours to do.

// For LIKE: \ % _ get a backslash so they match themselves. PostgREST turns
// every * into % and can't escape it, so * is dropped.
export function escapeLike(term: string) {
  return term.replace(/\*/g, "").replace(/[\\%_]/g, (c) => `\\${c}`);
}

// A value inside an .or() logic tree: commas, dots, colons and parentheses
// are syntax there, so the value goes in double quotes.
function quoteOrValue(value: string) {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

// "Any of these columns contains the term", for .or(). Column names must come
// from the code, never from the request. Returns null for an empty term.
export function searchOr(columns: readonly string[], term: string) {
  if (!term) return null;
  const pattern = quoteOrValue(`%${escapeLike(term)}%`);
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}

// For a single column: query.ilike(column, containsPattern(term)). No quotes
// here; .ilike() isn't a logic tree.
export function containsPattern(term: string) {
  return `%${escapeLike(term)}%`;
}
