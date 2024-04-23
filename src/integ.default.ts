import { join } from "path";
import * as cdk from "aws-cdk-lib";
import {
  aws_apigateway,
  aws_apigatewayv2,
  aws_apigatewayv2_integrations,
} from "aws-cdk-lib";
import { FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { SpinLambdaFunction, getSpin } from ".";

async function main() {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "SpinLambdaStack");
  const architecture = cdk.aws_lambda.Architecture.ARM_64;
  const fn = new SpinLambdaFunction(stack, "SpinLambda", {
    architecture,
    spinManifestPath: join(__dirname, "../examples/rust/spin-rust-lambda-cdk"),
    // download spin binary from github release...
    spinBinaryPath: await getSpin("v2.4.2", architecture),
    // ... or bring your own binary.
    // spinBinaryPath: join(
    //   __dirname,
    //   "../examples/rust/spin-rust-lambda-cdk/spin_arm64",
    // ),
    spinRuntimeConfigPath: join(
      __dirname,
      "../examples/rust/spin-rust-lambda-cdk/runtime-config.toml",
    ),
    region: "eu-west-1",
    runShCommand:
      './spin up --listen 127.0.0.1:8080 --log-dir "" --state-dir /tmp --disable-pooling --runtime-config-file runtime-config.toml',
    environment: {
      SPIN_VARIABLE_KV_EXPLORER_USER: "user",
      SPIN_VARIABLE_KV_EXPLORER_PASSWORD: "pw",
    },
  });

  const api = new aws_apigateway.LambdaRestApi(stack, "SpinLambdaApi", {
    handler: fn,
    proxy: true,
    // Note: Cors settings are needed for the kv-explorer compoent
    defaultCorsPreflightOptions: {
      // TODO: Update this to a more secure setting
      allowHeaders: [
        "Content-Type",
        "X-Amz-Date",
        "Authorization",
        "X-Api-Key",
      ],
      allowMethods: aws_apigateway.Cors.ALL_METHODS,
      allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
      allowCredentials: true,
    },
  });
  new cdk.CfnOutput(stack, "ApiUrl", { value: api.url });

  const httpApi = new aws_apigatewayv2.HttpApi(stack, "HttpApi", {
    description: "sample http api",
    corsPreflight: {
      allowHeaders: [
        "Content-Type",
        "X-Amz-Date",
        "Authorization",
        "X-Api-Key",
      ],
      allowMethods: [aws_apigatewayv2.CorsHttpMethod.ANY],
      // allowCredentials: true,
      allowOrigins: ["*"],
    },
  });
  // add route with lambda integration
  httpApi.addRoutes({
    path: "/{proxy+}",
    methods: [aws_apigatewayv2.HttpMethod.ANY],
    integration: new aws_apigatewayv2_integrations.HttpLambdaIntegration(
      "fn-integration",
      fn,
      {},
    ),
  });
  new cdk.CfnOutput(stack, "HttpApiUrl", { value: httpApi.url! });

  const fnUrl = fn.addFunctionUrl({
    authType: FunctionUrlAuthType.NONE,
    // Note: Cors settings are needed for the kv-explorer compoent
    cors: {
      allowCredentials: true,
      allowedHeaders: [
        "Content-Type",
        "X-Amz-Date",
        "Authorization",
        "X-Api-Key",
      ],
      // TODO: Update this to a more secure setting
      allowedOrigins: ["*"],
    },
  });

  new cdk.CfnOutput(stack, "FunctionUrl", { value: fnUrl.url });
}
main().catch(console.error);
