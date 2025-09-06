import app from './app.js';
import { config } from './config/env.js';

const { port } = config;

app.listen(port, () => {
  console.log(`Herbario API escuchando en http://localhost:${port}`);
});