import { aws_lambda } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Bundling } from "./bundling";

type OmittedFunctionProps = Omit<
  aws_lambda.FunctionProps,
  "runtime" | "code" | "handler"
>;

interface SpinLambdaFunctionProps extends OmittedFunctionProps {
  /**
   * Path to a directory containing the spin.toml file.
   *
   * This will be used as the source of the volume mounted in the Docker
   * container and will be the directory where it will run `cargo lambda build` from.
   *
   */
  readonly spinManifestPath: string;
  /**
   * Path to the spins runtime config file.
   *
   * Note: The runtime config file gets copied to the root of the assests
   * directory. To use it you have to set the `runShCommand` and set it
   * correctly via the `--runtime-config-file` flag of the `spin` CLI.
   *
   * Example: `--runtime-config-file <name of your runtime config>.toml`
   *
   */
  readonly spinRuntimeConfigPath: string;
  /**
   * Path to the spin binary that gets deployed with the lambda.
   *
   * Note: The architecture of the binary must match the architecture of the lambda.
   *
   */
  readonly spinBinaryPath: string;
  /**
   * The command that gets run when `aws-lambda-web-adapter` starts spin.
   *
   * The default value is: `./spin up --listen 127.0.0.1:8080 --log-dir "" --state-dir /tmp --disable-pooling`
   *
   */
  readonly runShCommand?: string;
  // the AWS region to deploy the function to
  readonly region: string;
}

export class SpinLambdaFunction extends aws_lambda.Function {
  constructor(scope: Construct, id: string, props: SpinLambdaFunctionProps) {
    const {
      spinManifestPath,
      spinRuntimeConfigPath,
      spinBinaryPath,
      region,
      runShCommand,
    } = props;
    const architecture = props.architecture || aws_lambda.Architecture.ARM_64;
    super(scope, id, {
      ...props,
      runtime: aws_lambda.Runtime.PROVIDED_AL2023,
      architecture,
      code: Bundling.bundle({
        spinManifestPath,
        spinBinaryPath,
        runShCommand,
        spinRuntimeConfigPath,
      }),
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(
          scope,
          "aws-lambda-web-adapter",
          `arn:aws:lambda:${region}:753240598075:layer:${
            architecture === aws_lambda.Architecture.ARM_64
              ? "LambdaAdapterLayerArm64"
              : "LambdaAdapterLayerX86"
          }:20`,
        ),
      ],
      handler: "run.sh",
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        RUST_LOG: "info",
        XDG_CACHE_HOME: "/tmp",
        ...props.environment,
      },
    });
  }
}
