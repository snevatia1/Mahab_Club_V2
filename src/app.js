// src/app.js  — shim that starts the modular app
import { boot } from './main.js';

boot().catch(err => {
  console.error(err);
  const s = document.getElementById('summary');
  if (s) s.textContent = 'Error: ' + err.message;
});
