import { describe, expect, it } from 'vitest';
import { formatScaled, parseFoodSearch } from './openFoodFacts';

describe('open food facts', () => {
  it('keeps named products and https photos', () => {
    const hits = parseFoodSearch({
      products: [
        {
          code: '1',
          product_name: 'Oats',
          brands: 'Plain',
          image_front_small_url: 'https://images.openfoodfacts.org/oats.jpg',
          nutriments: { 'energy-kcal_100g': 370, proteins_100g: 13.5, carbohydrates_100g: 60, fat_100g: 7 },
        },
        { code: '2', product_name: '', nutriments: {} },
        { code: '3', product_name: 'Yogurt', image_front_small_url: 'http://insecure.example/y.jpg', nutriments: {} },
      ],
    });
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ name: 'Oats', kcal100: 370, image: 'https://images.openfoodfacts.org/oats.jpg' });
    expect(hits[1].image).toBeNull();
  });

  it('scales per-100 g values by the grams entered', () => {
    expect(formatScaled(370, 50, 0)).toBe('185');
    expect(formatScaled(13.5, 40, 1)).toBe('5.4');
    expect(formatScaled(null, 100, 0)).toBe('');
    expect(formatScaled(100, 0, 0)).toBe('');
  });
});