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

## CI/CD Pipeline

### Automated Tests (`tests.yml`)
- **Triggers**: Runs on every push and pull request
- **Actions**: Linting, JSDoc validation, and unit tests
- **Node.js version**: 22.8.0

### Deployment Workflow (`deploy.yml`)
The deployment process consists of two stages:

#### 1. Build and Scan
- Builds Docker image with the commit SHA as the tag
- Runs Trivy security scanning:
  - **Breaking scan**: Fails on CRITICAL/HIGH vulnerabilities
  - **Informative scan**: Reports all vulnerabilities without failing
- Pushes image to Amazon ECR

#### 2. Deploy
- Templates Kubernetes manifests with the built image
- Deploys to the specified environment (dev/prod)

#### Manual Deployment
Deployments can be triggered manually via workflow dispatch:
- Select environment (dev/prod)
- Specify branch/ref to deploy
- Optional: Skip security scan for emergency deployments (not recommended)

#### Security Scanning
Uses Trivy to scan for vulnerabilities. See `.trivyignore` for suppressed CVEs.
