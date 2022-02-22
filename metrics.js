const { Gauge, register } = require('prom-client');
const ise = require('./ise-setup.js');
const express = require('express')
const app = express()
const port = 3000


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

function getMetrics() {
  return ise
    .login()
    .then(() => Promise.all([ise.getSystemAlarms(), ise.getSystemSummary()]))
    .then((values) => {
      const [alarms, summary] = values;
      const cpuData = summary['60MIN'][0].CPU[0];
      const memoryData = summary['60MIN'][0].Memory[0];
      const latencyData = summary['60MIN'][0].Latency[0];

      cpu.labels('cpuData.Name', 'cpuData.Type').set(parseInt(cpuData.value));
      memory.labels('memoryData.Name', 'memoryData.Type').set(parseInt(memoryData.value));
      latency.labels('latencyData.Name', 'latencyData.Type').set(parseInt(latencyData.value));

      return register.metrics();
    });
}


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  getMetrics().then((metrics) => {
    res.send(metrics);
  })
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})