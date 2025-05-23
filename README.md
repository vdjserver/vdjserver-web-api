# VDJServer API V2

This project is a node.js middleware API for VDJServer V2 clients using express-openapi and the Tapis V3 API. The
primary client of the API is the VDJServer [Web Portal](https://vdjserver.org/). Another
client is `vdjserver-tools` for doing command-line automation. It provides some public
endpoints and some endpoints for admin accounts but most of the endpoints are for user accounts.

VDJServer Web API is a submodule in [vdjserver-web](https://github.com/vdjserver/vdjserver-web),
which has a set of docker compose configurations for building and running the VDJServer Web Portal.

## Configuration

Edit the environment configuration file. Refer to the VDJServer administration guide for
information about the environment configuration variables.

```
cp .env.defaults .env
nano .env
```

#### Documentation:

OpenAPI 3 spec is available in the source code at vdjserver-web-api/swagger/vdjserver-api.yaml

With a local running API, there is a [swagger UI](http://localhost:8080/api/v2/api-ui/) available.

The [staging server](https://vdj-staging.tacc.utexas.edu/api/v2/api-ui/) currently has a beta release of the swagger UI.

#### Tests

There is a test suite, but it needs to be documented and automated.

