import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionsUrl } from '../src/lib/directions.ts';

test('directionsUrl construye el enlace de itinerario de Google Maps con latitud y longitud', () => {
  assert.equal(
    directionsUrl(48.061, -2.69),
    'https://www.google.com/maps/dir/?api=1&destination=48.061,-2.69'
  );
});
