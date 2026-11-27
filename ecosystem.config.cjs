const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno desde .env local si existe
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Resolución del binario de Bun:
// 1. Variable de entorno BUN_PATH definida en .env
// 2. Ruta predeterminada en Windows para esta máquina local como fallback
// 3. 'bun' global en caso de ejecutarse en servidor Linux / PATH estándar
const defaultWindowsBunPath = 'C:\\Users\\MBCPROEW10028\\.bun\\bin\\bun.exe';
const bunExecutable = process.env.BUN_PATH || (process.platform === 'win32' ? defaultWindowsBunPath : 'bun');

module.exports = {
  apps: [
    {
      name: 'almacen-pieles-backend',
      // Ejecutable de Bun resuelto dinámicamente o por BUN_PATH en .env
      script: bunExecutable,
      // Argumentos para que Bun ejecute directamente el punto de entrada TypeScript
      args: 'run src/index.ts',
      // Indicamos a PM2 que no use intérprete externo ya que script es el ejecutable de Bun
      interpreter: 'none',
      exec_mode: 'fork',
      shutdown_with_message: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        TZ: 'America/Mexico_City',
      },
      env_production: {
        NODE_ENV: 'production',
        TZ: 'America/Mexico_City',
      },
      // Gestión de resiliencia y recuperación automática
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 8000,
      // Registro y rotación de logs del sistema
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
