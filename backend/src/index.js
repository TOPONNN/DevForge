const http = require('http');

const app = require('./app');
const { pool, initDatabase } = require('./database');
const { connectRabbitMQ, startConsumer } = require('./rabbitmq');
const { setupGameServer } = require('./ws/gameServer');

const port = Number(process.env.PORT || 8080);

async function start() {
  await initDatabase();
  const rabbit = await connectRabbitMQ();
  await startConsumer(pool);

  const server = http.createServer(app);
  setupGameServer(server);

  server.listen(port, () => {
    console.log(`pokemon-prophunt-backend listening on port ${port}`);
  });

  return rabbit;
}

start().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});
