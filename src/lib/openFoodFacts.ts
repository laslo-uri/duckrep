const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

export type FoodHit = {
  code: string;
  name: string;
  brand: string | null;
  image: string | null;
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
};

export function parseFoodSearch(payload: unknown): FoodHit[] {
  if (!payload || typeof payload !== 'object') return [];
  const products = (payload as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];
  const hits: FoodHit[] = [];
  for (const item of products) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = text(row.product_name) || text(row.product_name_en);
    const code = text(row.code);
    if (!name || !code) continue;
    const nutriments = row.nutriments && typeof row.nutriments === 'object'
      ? (row.nutriments as Record<string, unknown>)
      : {};
    const image = text(row.image_front_small_url);
    hits.push({
      code,
      name,
      brand: text(row.brands) || null,
      image: image.startsWith('https://') ? image : null,
      kcal100: nutrient(nutriments, 'energy-kcal_100g'),
      protein100: nutrient(nutriments, 'proteins_100g'),
      carbs100: nutrient(nutriments, 'carbohydrates_100g'),
      fat100: nutrient(nutriments, 'fat_100g'),
    });
  }
  return hits;
}

export function formatScaled(per100: number | null, grams: number, decimals: number): string {
  if (per100 == null || !Number.isFinite(grams) || grams <= 0) return '';
  const value = (per100 * grams) / 100;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded);
}

export async function searchFoods(term: string, signal?: AbortSignal): Promise<FoodHit[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('search_terms', term);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '12');
  url.searchParams.set('fields', 'code,product_name,product_name_en,brands,image_front_small_url,nutriments');
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('food search failed');
  return parseFoodSearch(await response.json());
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nutrient(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
