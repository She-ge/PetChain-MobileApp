import http from 'http';

import { createApp } from '../app';

function getJson(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET', headers: { Accept: 'application/json' } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('REST API smoke', () => {
  let server: http.Server;
  let port: number;

  beforeAll((done) => {
    const app = createApp();
    server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) port = addr.port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('GET /api/health returns 200', async () => {
    const { status, body } = await getJson(port, '/api/health');
    expect(status).toBe(200);
    expect(JSON.parse(body).ok).toBe(true);
  });

  it('GET /api/pets returns success wrapper', async () => {
    const { status, body } = await getJson(port, '/api/pets');
    expect(status).toBe(200);
    const j = JSON.parse(body);
    expect(j.success).toBe(true);
    expect(Array.isArray(j.data)).toBe(true);
  });

  it('GET /api/medications returns array', async () => {
    const { status, body } = await getJson(port, '/api/medications?petId=p-demo-1');
    expect(status).toBe(200);
    expect(Array.isArray(JSON.parse(body))).toBe(true);
  });
});
