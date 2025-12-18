# Local Kubernetes Deployment

This directory contains the necessary Kubernetes manifests to run the `cica-review-case-documents` application locally in a production-like containerized environment.

This setup provides a high-fidelity testing environment that closely mirrors how the application is deployed in production.

## Why Use This Over `npm run start:dev`?

While `npm run start:dev` is excellent for rapid, iterative development of application features, it runs the Node.js process directly on your host machine with `NODE_ENV=development`.

This local Kubernetes deployment should be used when you need to test changes that affect the container itself or its environment. It runs the application from a Docker image with `NODE_ENV=production`.

**Use this setup for:**

*   **Testing `Dockerfile` changes:** Ensure the container builds and runs as expected.
*   **Validating Node.js version upgrades:** Test the application with a new Node.js version specified in the `Dockerfile`.
*   **Verifying base image updates:** Confirm the application is compatible with OS-level package updates in the base Docker image.
*   **Testing environment variable interactions:** See how the application behaves with production-like environment variables.
*   **Debugging production-specific issues:** Replicate and diagnose problems that only appear when `NODE_ENV` is set to `production`.

**Note:** This setup uses `APP_ALLOW_INSECURE_COOKIE=true` because it runs with `NODE_ENV=production` but without HTTPS. When using `npm run start:dev`, this variable is not needed as the app automatically uses insecure cookies in development mode.

## Prerequisites

1.  **Docker Desktop:** Ensure Docker Desktop is installed and running.
2.  **Kubernetes Enabled:** In Docker Desktop settings, go to the `Kubernetes` section and check `Enable Kubernetes`.
3.  **Kubeadm Provider:** It is highly recommended to use the `Kubeadm` default cluster provider for a smoother experience, as it shares the image store with the Docker engine. If you use the `kind` provider, you will need to load your local image into the cluster's image store manually.
4.  **kubectl:** Ensure `kubectl` is installed and configured to point to the `docker-desktop` context.

### Managing Kubernetes Context

Before running any `kubectl` commands for this local setup, ensure you are targeting your local Docker Desktop cluster.

**1. Save your current context (important!):**
Before switching contexts, capture your current context so you can easily switch back when finished.
```shell
# Save current context to a variable (for use later)
$PREVIOUS_CONTEXT = kubectl config current-context
echo "Current context: $PREVIOUS_CONTEXT"
```

**2. List available contexts:**
This command shows all configured clusters. The one with the `*` is currently active.
```shell
kubectl config get-contexts
```
*Example Output:*
```
CURRENT   NAME                                         CLUSTER                                      AUTHINFO              NAMESPACE
          docker-desktop                               docker-desktop                               docker-desktop
*         live.cloud-platform.service.justice.gov.uk   live.cloud-platform.service.justice.gov.uk   someone@live   cica-namespace
```

**3. Switch to the local context:**
Use this command to target your local Kubernetes cluster for this setup.
```shell
kubectl config use-context docker-desktop
```

**4. When you are finished:**
Switch back to your previous context to avoid accidentally running commands against the wrong environment.
```shell
# Switch back to the context you saved earlier
kubectl config use-context $PREVIOUS_CONTEXT
```

## First-Time Setup: Creating Secrets

The deployment requires Kubernetes secrets that are not checked into source control. You only need to create these once, or whenever the values in your root `.env` file change.

These commands read values from the file in the project root to create the secrets.

1.  **Create the main application secret:**
    ```shell
    kubectl create secret generic cica-case-review-documents-secrets \
      --from-literal=app_cookie_name=$(grep -E '^APP_COOKIE_NAME=' .env | cut -d '=' -f2) \
      --from-literal=app_cookie_secret=$(grep -E '^APP_COOKIE_SECRET=' .env | cut -d '=' -f2) \
      --from-literal=auth_secret_password=$(grep -E '^AUTH_SECRET_PASSWORD=' .env | cut -d '=' -f2) \
      --from-literal=auth_usernames=$(grep -E '^AUTH_USERNAMES=' .env | cut -d '=' -f2) \
      --from-literal=app_jwt_secret=$(grep -E '^APP_JWT_SECRET=' .env | cut -d '=' -f2)
    ```

2.  **Create the OpenSearch proxy URL secret:**
    ```shell
    kubectl create secret generic cica-review-case-documents-opensearch-proxy-url \
      --from-literal=proxy_url=$(grep -E '^APP_DATABASE_URL=' .env | cut -d '=' -f2)
    ```

## How to Run

1.  **Build the Docker Image:**
    From the root of the repository, build the image and tag it as `latest`. The `imagePullPolicy: Never` in the deployment manifest requires the image to exist locally.
    ```shell
    docker build -t cica-review-case-documents:latest .
    ```

2.  **Apply the Kubernetes Manifests:**
    Apply the deployment, service, and ingress manifests from this directory.
    ```shell
    kubectl apply -f deployments/local/
    ```

3.  **Access the Application:**
    The pod will start, and the application will be running inside the cluster on port 5000. To access it from your browser:

    *   **Method 1: Port-Forwarding (Reliable)**
        This is the most reliable way to connect. It forwards a local port on your machine directly to the service running in the cluster.
        ```shell
        kubectl port-forward service/cica-case-review-documents-service 8080:80
        ```
        You can now access the application at **http://localhost:8080**.

    *   **Method 2: Ingress (May require restart)**
        The `ingress.yml` manifest is configured to expose the service at `http://localhost`. Sometimes, the Docker Desktop Ingress controller can be slow to assign an address. If `http://localhost` does not work after a few minutes, a restart of Docker Desktop usually resolves the issue.

## Troubleshooting

*   **Pod is in `ErrImagePull` or `ImagePullBackOff` state:**
    *   Ensure you have built the image locally with the correct tag: `cica-review-case-documents:latest`.
    *   If using the `kind` provider in Docker Desktop, the image needs to be loaded into the kind cluster: `kind load docker-image cica-review-case-documents:latest`.

*   **Pod is in `CreateContainerConfigError` state:**
    *   This almost always means the secrets are missing. Run the `kubectl create secret` commands in the setup section.

*   **Check Pod Status:**
    ```shell
    kubectl get pods
    ```

*   **View Application Logs:**
    ```shell
    # Get the name of your running pod first
    POD_NAME=$(kubectl get pods -l app=cica-case-review-documents -o jsonpath='{.items[0].metadata.name}')
    # Then view its logs
    kubectl logs $POD_NAME
    ```

## Cleaning Up

To stop the application and remove all the created Kubernetes resources, run:
```shell
kubectl delete -f deployments/local/
```

---

## Keeping In Sync

**This local configuration is a simplified copy of the production configuration.** To ensure it remains a useful testing environment, it is crucial to keep it in sync with the remote deployment manifests.

**Developer Responsibility:**

If you make a change to the production Kubernetes manifests that involves:
*   Adding or removing an environment variable.
*   Adding or removing a secret.
*   Changing config map references.

You **must** update the files in this  directory as part of the **same pull request**.

1.  Update `deployment.yml` with the new environment variable.
2.  Update the `kubectl create secret` commands in this  if a new secret is required.

This process ensures that any developer pulling the latest code will have a local environment that accurately reflects the state of production.
