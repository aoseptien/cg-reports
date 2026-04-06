/**
 * Instala el backend como Windows Service usando node-windows
 * El servicio arranca automáticamente con Windows y corre en background
 */

const path = require('path');

try {
  const Service = require('node-windows').Service;

  const svc = new Service({
    name: 'CG Reports',
    description: 'CG Reports Automation Service — Daily & Hourly Reports',
    script: path.join(__dirname, '../backend/src/api/server.js'),
    nodeOptions: ['--harmony'],
    workingDirectory: path.join(__dirname, '../backend'),
    env: [
      { name: 'NODE_ENV', value: 'production' },
    ],
  });

  svc.on('install', () => {
    svc.start();
    console.log('✅ Servicio instalado e iniciado correctamente.');
  });

  svc.on('alreadyinstalled', () => {
    console.log('ℹ️  El servicio ya estaba instalado. Reiniciando...');
    svc.stop();
    setTimeout(() => svc.start(), 2000);
  });

  svc.on('error', (err) => {
    console.error('❌ Error:', err);
  });

  svc.install();

} catch (err) {
  console.error('Error instalando el servicio:', err.message);
  console.log('Intentando instalar node-windows...');
  console.log('Ejecuta: npm install -g node-windows');
}
