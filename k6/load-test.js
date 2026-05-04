import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL;

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export default function () {
  const suffix = uniqueSuffix();
  const res = http.post(
    `${baseUrl}/webhooks/orders`,
    JSON.stringify({
      order_id: `ext-${suffix}`,
      customer: {
        email: `user+${suffix}@example.com`,
        name: 'Ana',
      },
      items: [
        {
          sku: 'ABC123',
          qty: 2,
          unit_price: 59.9,
        },
      ],
      currency: 'USD',
      idempotency_key: `idem-${suffix}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  let body = null;

  try {
    body = res.json();
  } catch {
    body = null;
  }

  check(res, {
    'status is 201': (response) => response.status === 201,
    'returns order id': () => typeof body?.id === 'string',
    'returns RECEIVED status': () => body?.status === 'RECEIVED',
  });

  sleep(1);
}
