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
      ise.getAuthenticatedGuests(),
      ise.getRadiusLiveLogCounters(),
      ise.getTopCompromisedEndpoints(),
      ise.getTopThreats(),
      ise.getCompromisedEndpointsOverTime(),
      ise.getTotalVulnerableEndpoints()
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
        authenticatedGuests,
        radiusLiveLogCounters,
        topCompromisedEndpoints,
        topThreats,
        compromisedEndpointsOverTime,
        totalVulnerableEndpoints
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

      // RADIUS LIVE LOG METRICS
      gauges.misconfiguredCount.set({ type: 'misconfigured_nas' }, parseInt(radiusLiveLogCounters.misConfiguredNasCount));
      gauges.misconfiguredCount.set({ type: 'misconfigured_supplicant' }, parseInt(radiusLiveLogCounters.misConfiguredSuppCount));
      gauges.misconfiguredPercent.set({ type: 'misconfigured_nas' }, parseFloat(radiusLiveLogCounters.percentMisConfiguredNasCount));
      gauges.misconfiguredPercent.set({ type: 'misconfigured_supplicant' }, parseFloat(radiusLiveLogCounters.percentMisConfiguredSuppCount));
      gauges.radiusDropCount.set(parseInt(radiusLiveLogCounters.radiusDropCount));
      gauges.radiusDropPercent.set(parseFloat(radiusLiveLogCounters.percentRadiusDropCount));
      gauges.radiusRepeatCount.set(parseInt(radiusLiveLogCounters.retryCount));
      gauges.radiusRepeatPercent.set(parseFloat(radiusLiveLogCounters.percentRetryCount));
      gauges.eapTimeoutCount.set(parseInt(radiusLiveLogCounters.eapTimeoutCount));
      gauges.eapTimeoutPercent.set(parseFloat(radiusLiveLogCounters.percentEapTimeoutCount));
      gauges.reauthCount.set(parseInt(radiusLiveLogCounters.totalRAuthCount));
      gauges.reauthPercent.set(parseFloat(radiusLiveLogCounters.percentTotalRAuthCount));

      // THREAT METRICS
      gauges.topCompromisedEndpoints.set({ status: 'connected' }, parseInt(topCompromisedEndpoints.connected));
      gauges.topCompromisedEndpoints.set({ status: 'disconnected' }, parseInt(topCompromisedEndpoints.disconnected));
      gauges.topVulnerableEndpoints.set({ status: 'connected' }, parseInt(totalVulnerableEndpoints.connected));
      gauges.topVulnerableEndpoints.set({ status: 'disconnected' }, parseInt(totalVulnerableEndpoints.disconnected));

      // Threat metrics by threat name
      Object.entries(topThreats.dataset).forEach((threat) => {
        const threatName = threat[0];
        const threatData = threat[1];
        gauges.topThreatsByThreat.set({ threat_name: threatName, severity: threatData.severity, status: 'connected' }, parseInt(threatData.endpoints.connected));
        gauges.topThreatsByThreat.set({ threat_name: threatName, severity: threatData.severity, status: 'disconnected' }, parseInt(threatData.endpoints.disconnected));
        gauges.topThreatsByThreat.set({ threat_name: threatName, severity: threatData.severity, status: 'all' }, parseInt(threatData.endpoints.disconnected + threatData.endpoints.connected));
      });

      // Threat metrics aggregated by threat severity
      const threatsBySeverity = [];
      topThreats.labels.forEach((severity) => {
        // Find all threats with the given severity.
        const filteredThreats = Object.entries(topThreats.dataset).filter(
          (threat) => threat[1].severity === severity
        );
        const connected = filteredThreats.reduce(
          (previousValue, currentValue) =>
            previousValue + currentValue[1].endpoints.connected,
          0
        );
        const disconnected = filteredThreats.reduce(
          (previousValue, currentValue) =>
            previousValue + currentValue[1].endpoints.disconnected,
          0
        );
        threatsBySeverity.push({
          severity,
          metrics: { connected, disconnected }
        });
      });
      threatsBySeverity.forEach((threat) => {
        gauges.topThreatsBySeverity.set({ severity: threat.severity, status: 'connected' }, threat.metrics.connected);
        gauges.topThreatsBySeverity.set({ severity: threat.severity, status: 'disconnected' }, threat.metrics.disconnected);
        gauges.topThreatsBySeverity.set({ severity: threat.severity, status: 'all' }, threat.metrics.connected + threat.metrics.disconnected);
      });
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
    }),
    misconfiguredCount: new Gauge({
      name: 'ise_misconfigured_count',
      help: 'ise misconfigured count',
      labelNames: ['type']
    }),
    misconfiguredPercent: new Gauge({
      name: 'ise_misconfigured_percent',
      help: 'ise misconfigured percent',
      labelNames: ['type']
    }),
    radiusRepeatCount: new Gauge({
      name: 'ise_radius_repeat_count',
      help: 'Authentication requests repeated in the last 24 hours with no change in identity context, network device, and authorization.',
    }),
    radiusRepeatPercent: new Gauge({
      name: 'ise_radius_repeat_percent',
      help: 'Percentage of authentication requests repeated in the last 24 hours with no change in identity context, network device, and authorization.',
    }),
    radiusDropCount: new Gauge({
      name: 'ise_radius_drop_count',
      help: 'Supplicants that stopped responding in the middle of the conversation in the last 24 hours.',
    }),
    radiusDropPercent: new Gauge({
      name: 'ise_radius_drop_percent',
      help: 'Percentage of supplicants that stopped responding in the middle of the conversation in the last 24 hours.',
    }),
    eapTimeoutCount: new Gauge({
      name: 'ise_eap_timeout_count',
      help: 'ise eap timeout count',
    }),
    eapTimeoutPercent: new Gauge({
      name: 'ise_eap_timeout_percent',
      help: 'ise eap timeout percent',
    }),
    reauthCount: new Gauge({
      name: 'ise_reauth_count',
      help: 'ise reauth count',
    }),
    reauthPercent: new Gauge({
      name: 'ise_reauth_percent',
      help: 'ise reauth percent',
    }),
    topCompromisedEndpoints: new Gauge({
      name: 'ise_top_compromised_endpoints_count',
      help: 'ise top compromised endpoints count',
      labelNames: ['status']
    }),
    topVulnerableEndpoints: new Gauge({
      name: 'ise_top_vulnerable_endpoints_count',
      help: 'ise top vulnerable endpoints count',
      labelNames: ['status']
    }),
    topThreatsByThreat: new Gauge({
      name: 'ise_top_threats_by_threat_count',
      help: 'ise top threats by threat count',
      labelNames: ['threat_name', 'severity', 'status']
    }),
    topThreatsBySeverity: new Gauge({
      name: 'ise_top_threats_by_severity_count',
      help: 'ise top threats by severity count',
      labelNames: ['severity', 'status']
    }),
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