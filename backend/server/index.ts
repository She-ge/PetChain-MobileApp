import { createApp } from './app';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`PetChain REST API listening on http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
