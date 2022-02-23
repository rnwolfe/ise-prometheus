const client = require('prom-client');
const ise = require('./ise-setup.js');
const express = require('express')
const app = express()
const port = process.env.PORT || 3000;

const Gauge = client.Gauge;
const collectDefaultMetrics = client.collectDefaultMetrics;
const register = client.register;

function getMetrics() {
  const [cpu, memory, latency] = resetMetrics();
  collectDefaultMetrics({ prefix: 'ise_exporter_' });

  return ise
    .login()
    .then(() => Promise.all([
      ise.getSystemSummary(),
      ise.getEndpointGroupChartData()
    ]))
    .then((systemSummary, endpointGroups) => {
      console.log(systemSummary);
      if (systemSummary !== 'not found') {
        // SYSTEM METRICS
        // Iterate through each node and add to the metrics with the appropriate label.
        systemSummary['60MIN'].forEach((system) => {
          const nodeName = system.title;
          const nodeType = system.nodeType.replace('PAP', 'PAN').replace('PDP', 'PSN');
          // Only getting the first entry as it is the most recent.
          cpu.set({
            node: nodeName,
            personas: nodeType
          }, parseInt(system.CPU[0]));
          memory.set({
            node: nodeName,
            personas: nodeType
          }, parseInt(system.Memory[0]));
          latency.set({
            node: nodeName,
            personas: nodeType
          }, parseInt(system.Latency[0]));
        });
      }

      // ENDPOINT GROUP DATA
      /*
          workstations: '853',
          cameras: '100',
          'entertaintment devices': '6',
          'ip-phones': '700',
          'home network devices': '10',
          'medical devices': '2',
          'mobile devices': '2312',
          'infrastructure network devices': '19',
          misc: '1345'
      */
      const groups = new Gauge({
        name: 'ise_endpoint_groups',
        help: 'ise endpoint groups',
        labelNames: ['endpoint_group'],
      });
      const groupArray = Object.entries(endpointGroups);
      groupArray.forEach((group) => {
        groups.set({
          endpoint_group: group[0]
        }, parseInt(group[1]));
      });
      return register.metrics();
    }).catch((err) => {
      console.trace(err);
      // Exiting so that container will restart to ensure metrics are collected.
      // process.exit(1);
    });
}

function resetMetrics() {
  register.clear();

  // export prometheus metrics for cpu, memory, and latency
  const cpu = new Gauge({
    name: 'ise_cpu',
    help: 'ise cpu usage',
    labelNames: ['node', 'personas'],
  });

  const memory = new Gauge({
    name: 'ise_memory',
    help: 'ise memory usage',
    labelNames: ['node', 'personas'],
  });

  const latency = new Gauge({
    name: 'ise_auth_latency',
    help: 'ise authentication latency',
    labelNames: ['node', 'personas'],
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