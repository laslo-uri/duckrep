const FREE_DB_IMAGES = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

/** Start and end photo of a free-exercise-db exercise (its folder has 0.jpg and 1.jpg); other images stay single. */
export function exercisePhotos(imageUrl: string | null | undefined): string[] {
  const url = imageUrl?.trim() ?? '';
  if (!/^https:\/\//i.test(url)) return [];
  if (url.startsWith(FREE_DB_IMAGES) && url.endsWith('/0.jpg')) return [url, `${url.slice(0, -'0.jpg'.length)}1.jpg`];
  return [url];
}

/** A YouTube search for the movement: always there, nothing to store or license. */
export function videoSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercise form`)}`;
}

/** MuscleWiki's site is free to read; its own search is not linkable, so a site search finds the page. */
export function muscleWikiSearchUrl(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:musclewiki.com ${name}`)}`;
}
