const client = require('prom-client');
const ise = require('./ise-setup.js');
const express = require('express')
const app = express()
const port = 3000

const Gauge = client.Gauge;
const collectDefaultMetrics = client.collectDefaultMetrics;
const register = client.register;

function getMetrics() {
  const [ cpu, memory, latency ] = resetMetrics();
  
  return ise
    .login()
    .then(() => ise.getSystemSummary())
    .then((summary) => {
      const cpuData = summary['60MIN'][0].CPU[0];
      const memoryData = summary['60MIN'][0].Memory[0];
      const latencyData = summary['60MIN'][0].Latency[0];

      collectDefaultMetrics({ prefix: 'ise_exporter_' });

      cpu.set(parseInt(cpuData.value));
      memory.set(parseInt(memoryData.value));
      latency.set(parseInt(latencyData.value));

      return register.metrics();
    }).catch((err) => {
      console.trace(err);
      // Exiting so that container will restart to ensure metrics are collected.
      process.exit(1);
    });
}

function resetMetrics() {
  register.clear();

  // export prometheus metrics for cpu, memory, and latency
  const cpu = new Gauge({
    name: 'ise_cpu',
    help: 'ise cpu usage',
    labelNames: ['name', 'type'],
  });

  const memory = new Gauge({
    name: 'ise_memory',
    help: 'ise memory usage',
    labelNames: ['name', 'type'],
  });

  const latency = new Gauge({
    name: 'ise_auth_latency',
    help: 'ise authentication latency',
    labelNames: ['name', 'type'],
  });

  return [cpu, memory, latency];
}


app.get('/metrics', (req, res) => {
  const time = new Date(Date.now());
  console.log(`${time.toLocaleString()}: GET /metrics`)
  res.set('Content-Type', 'text/plain');
  getMetrics().then((metrics) => {
    res.send(metrics);
  })
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})