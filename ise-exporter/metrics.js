const client = require('prom-client');
const express = require('express')
const app = express()
const port = process.env.PORT || 3000;

const ise = require('./ise-setup.js');

const Gauge = client.Gauge;
const collectDefaultMetrics = client.collectDefaultMetrics;
const register = client.register;

function getMetrics() {
  const gauges = resetMetrics();
  collectDefaultMetrics({ prefix: 'ise_exporter_' });

  return ise
    .login()
    .then(() => Promise.all([
      ise.getSystemSummary(),
      ise.getEndpointGroupChartData(),
      ise.getEndpointPolicyChartData(),
      ise.getIdentityGroupChartData(),
      ise.getNetworkDevices(),
      ise.getTotalEndpoints(),
      ise.getActiveEndpoints(),
      ise.getRejectedEndpoints(),
      ise.getAnomalousEndpoints(),
      ise.getByodEndpoints(),
      ise.getAuthenticatedGuests()
    ]))
    .then(results => {
      const [
        systemSummary,
        logicalProfiles,
        endpointProfiles,
        endpointIdentityGroups,
        networkDevices,
        totalEndpoints,
        activeEndpoints,
        rejectedEndpoints,
        anomalousEndpoints,
        byodEndpoints,
        authenticatedGuests
      ] = results;
      if (systemSummary !== 'not found') {
        // SYSTEM METRICS
        // Iterate through each node and add to the metrics with the appropriate label.
        systemSummary['60MIN'].forEach((system) => {
          const nodeName = system.title;
          // Rename archaic acronyms to their real names.
          const nodeType = system.nodeType.replace('PAP', 'PAN').replace('PDP', 'PSN');
          // Only getting the first entry as it is the most recent.
          gauges.cpu.set({
            node: nodeName,
            personas: nodeType
          }, parseInt(system.CPU[0].value));
          gauges.memory.set({
            node: nodeName,
            personas: nodeType
          }, parseInt(system.Memory[0].value));
          gauges.latency.set({
            node: nodeName,
            personas: nodeType
          }, parseInt(system.Latency[0].value));
        });
      }

      // LOGICAL PROFILE DATA
      // Iterate through each endpoint group and add to the metrics with the appropriate label.
      const logicalProfileArray = Object.entries(logicalProfiles);
      logicalProfileArray.forEach((profile) => {
        gauges.logicalProfiles.set({
          logical_profile: profile[0]
        }, parseInt(profile[1]));
      });

      // ENDPOINT PROFILE DATA
      // Iterate through each endpoint profile and add to the metrics with the appropriate label.
      const endpointProfileArray = Object.entries(endpointProfiles);
      endpointProfileArray.forEach((profile) => {
        gauges.endpointProfiles.set({
          endpoint_profile: profile[0]
        }, parseInt(profile[1]));
      });

      // ENDPOINT IDENTITY GROUP DATA
      // Iterate through each endpoint identity group and add to the metrics with the appropriate label.
      const endpointIdentityGroupArray = Object.entries(endpointIdentityGroups);
      endpointIdentityGroupArray.forEach((group) => {
        gauges.endpointIdentityGroups.set({
          identity_group: group[0]
        }, parseInt(group[1]));
      });

      // NETWORK DEVICE DATA
      // Iterate through each network device and add to the metrics with the appropriate label.
      networkDevices.forEach((device) => {
        gauges.networkDevices.set({
          network_device: device.NetworkDeviceName,
          device_location: device.Location,
          device_type: device['Device Type']
        }, parseInt(device.NoOfDevicesPerNad));
      });

      // ENDPOINT METRICS
      gauges.totalEndpoints.set({ type: 'total' }, parseInt(totalEndpoints));
      gauges.totalEndpoints.set({ type: 'active' }, parseInt(activeEndpoints));
      gauges.totalEndpoints.set({ type: 'rejected' }, parseInt(rejectedEndpoints));
      gauges.totalEndpoints.set({ type: 'anomalous' }, parseInt(anomalousEndpoints));
      gauges.totalEndpoints.set({ type: 'byod' }, parseInt(byodEndpoints));

      // GUEST METRICS
      gauges.authenticatedGuests.set(parseInt(authenticatedGuests));

      return register.metrics();
    }).catch((err) => {
      console.trace(err);
      // Exiting so that container will restart to ensure metrics are collected.
      process.exit(1);
    });
}

function resetMetrics() {
  register.clear();

  const gauges = {
    cpu: new Gauge({
      name: 'ise_cpu',
      help: 'ise cpu usage',
      labelNames: ['node', 'personas'],
    }),
    memory: new Gauge({
      name: 'ise_memory',
      help: 'ise memory usage',
      labelNames: ['node', 'personas'],
    }),
    latency: new Gauge({
      name: 'ise_auth_latency',
      help: 'ise authentication latency',
      labelNames: ['node', 'personas'],
    }),
    logicalProfiles: new Gauge({
      name: 'ise_logical_profiles',
      help: 'ise logical profiles',
      labelNames: ['logical_profile'],
    }),
    endpointProfiles: new Gauge({
      name: 'ise_endpoint_profiles',
      help: 'ise endpoint profiles',
      labelNames: ['endpoint_profile'],
    }),
    endpointIdentityGroups: new Gauge({
      name: 'ise_endpoint_identity_groups',
      help: 'ise endpoint identity groups',
      labelNames: ['identity_group'],
    }),
    networkDevices: new Gauge({
      name: 'ise_endpoints_by_network_device',
      help: 'ise endpoints by network device',
      labelNames: ['network_device', 'device_location', 'device_type'],
    }),
    totalEndpoints: new Gauge({
      name: 'ise_total_endpoints',
      help: 'ise total endpoints',
      labelNames: ['type']
    }),
    authenticatedGuests: new Gauge({
      name: 'ise_authenticated_guests',
      help: 'ise authenticated guests',
    })
  }

  return gauges;
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