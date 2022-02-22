```bash
docker run --name prometheus \ 
      -v /c/Users/rnwol/dev/prometheus-ise/prometheus/prometheus.yaml:/opt/bitnami/prometheus/conf/prometheus.yml \
      --network host \
      bitnami/prometheus:latest
```