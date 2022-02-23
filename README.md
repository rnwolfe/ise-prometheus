# ISE Prometheus
This repository is an experiment in leveraging [Prometheus](https://prometheus.io/) to monitor metrics from Cisco ISE and display them in a meaninful way in [Grafana](https://grafana.com/).

## Custom ISE Exporter
As Cisco ISE does not expose Prometheus metrics on its own, a custom exporter was created. This exporter leverages a non-documented API on Cisco ISE referred to as the UI API. It has powered the newer interface components beginning with an early version of ISE 2.x.

This UI API allows us access to a lot of data that is otherwise not available.

The data from the UI API is exposes via `/metrics` in the `ise-exporter` container for Prometheus to scrape. Grafana than uses Prometheus as a data source to display in a custom dashboard.

## Usage
This repository uses docker and docker-compose to keep demonstrations simple. It is pre-packaged and setup to provision all data sources and dashboards upon startup within Grafana as well as all scrape targets for Prometheus.

By default, it will point to a [always-on Cisco ISE demo](https://dcloud-ise-sim-inst-rtp.cisco.com/) accessible to the internet that is hosted by Cisco. This always-on demo does go down sometimes and is subject to change. Also note that this demo instance is not very "dynamic" and typically yields incredibly consistent values over time which may make you think there's an error in data collection. There's not.

You can update the configuration in the `.env` file in `./ise-exporter` to point to your own environment.

Ensure you have docker and docker-compose installed on your machine, clone this repository, enter the directory, and run:
```
docker-compose up
```
You should then be able to access items using the following information:

| Resource     | Access                        |
| ------------ | ----------------------------- |
| Grafana      | http://localhost:3001         |
| Prometheus   | http://localhost:9090/        |
| ise-exporter | http://localhost:3000/metrics |

To jump right to the pre-built ISE Dashboard, [try this link](http://localhost:3001/d/5tkqvEf7z/cisco-ise-dashboard?orgId=1&refresh=30s). Otherwise, jump through the Dashboard directory in the interface.

## Example Dashboard
![Example ISE Dashboard](/assets/images/ise-grafana-example.png "San Juan Mountains")
