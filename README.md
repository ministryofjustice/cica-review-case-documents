# cloud-platform-example-application
A minimal example application for the Cloud Platform user guide. 
This is deployed in a namespace [cloud-platform-example-application](https://github.com/ministryofjustice/cloud-platform-environments/tree/main/namespaces/live.cloud-platform.service.justice.gov.uk/cloud-platform-example-application)

---

### Local Development

This application can be run locally using `npm start:dev`.

#### Database Connection

The application connects to an OpenSearch database. The connection URL is configured via the `APP_DATABASE_URL` environment variable in the `.env` file.

-   **For standard local development**, the database is expected to be running on `localhost`:
    ```
    APP_DATABASE_URL=http://127.0.0.1:9200
    ```

-   **When running in a local Kubernetes cluster (e.g., via Docker Desktop)**, the application container needs to connect to a service running on the host machine. Use `host.docker.internal` to allow the container to resolve the host's IP address:
    ```
    APP_DATABASE_URL=http://host.docker.internal:9200
    ```
    see [local docker desktop kube deployments](/deployments/local/README.md)
