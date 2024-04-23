# Spin Lambda CDK

**Note: This is a proof of concept and not ready for production use. Especially the spin `Store` isn't persisted between runs and only usable as a temporary storage.**

CDK Construct to deploy a lambda function that uses spin under the hood. This is done by using [Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter). It works like this:

- The lambda is configured to have the `aws-lambda-web-adapter` as a layer
- In the `aws-lambda-web-adapter` layer is a binary that gets called as initial handler (configured via `AWS_LAMBDA_EXEC_WRAPPER`) when lambda gets called with an event
- On the first request it
  1. starts the `spin` binary (configured in `run.sh`)
  1. transforms the lambda event to a HTTP request
  1. forwards the request to the running spin process
- On subsequent requests it only step 2 and 3 are needed

**Note:** Because this constructs uses `Lambda Web Adapter` under the hood the lambda only supports requests from

- Amazon API Gateway Rest API (✅ tested)
- Http API endpoints (✅ tested)
- Lambda Function URLs (✅ tested)
- Application Load Balancer (❓ not tested)

## Usage

### Deployment

Running `make deploy` will deploy the spin application in [`examples/rust/spin-rust-lambda-cdk`](./examples/rust/spin-rust-lambda-cdk/) to AWS. The functino is available behind a REST API Gateway, a HTTP API Gateway and a Lambda Function URL. For details about the deployed infrastructure see [`./src/integ.default.ts`](./src/integ.default.ts).

At the end of the deployment the individual urls are printed to the console. Edit the `baseUrl` in [`api.rest`](./examples/rust/spin-rust-lambda-cdk/api.rest) and run the requests. **Note:** This needs the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension for VSCode installed.

### Plugins

- Tested with [spin-kv-explorer](https://github.com/fermyon/spin-kv-explorer). To make it work I had to

  - rewrite the `content-type` header to `text/html` in the response because some component adds a `application/json` value
  - set the basic auth header because I never got asked for credentials

The runtime request changes were done with the [Request Interceptor](https://addons.mozilla.org/en-US/firefox/addon/request-interceptor/) Firefox Plugin:

## TODO

- [ ] Add tests
- [ ] Test with docker container
- [ ] Test with windows
