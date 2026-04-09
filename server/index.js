require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const swaggerDocument = require('./swagger.json');

const projectsRouter = require('./routes/projects');
const authRouter = require('./routes/auth');
const integrationsRouter = require('./routes/integrations');

const app = express();
const PORT = process.env.PORT || 3001;
const clientDistDir = path.resolve(__dirname, '..', 'client', 'dist');
const clientIndexPath = path.join(clientDistDir, 'index.html');

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'server',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

app.get('/api/swagger.json', (_req, res) => {
  res.json(swaggerDocument);
});

app.use('/api/projects', projectsRouter);
app.use('/api/auth', authRouter);
app.use('/api/integrations', integrationsRouter);

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistDir));

  app.get('/', (_req, res) => {
    res.sendFile(clientIndexPath);
  });

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      return next();
    }

    res.sendFile(clientIndexPath);
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
