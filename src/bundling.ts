import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { platform } from "node:os";
import { basename } from "node:path";
import * as cdk from "aws-cdk-lib";
import { AssetCode, Code } from "aws-cdk-lib/aws-lambda";
import { parse } from "toml";
import { BundlingOptions } from "./types";
import { exec } from "./util";

/**
 * Options for bundling
 */
export interface BundlingProps extends BundlingOptions {
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
}

interface CommandOptions {
  readonly inputDir: string;
  readonly outputDir: string;
  readonly spinBinaryPath: string;
  readonly spinRuntimeConfigPath: string;
  readonly runShCommand?: string;
  readonly osPlatform: NodeJS.Platform;
  readonly wasmPath: string[];
}

/**
 * Bundling
 */
export class Bundling implements cdk.BundlingOptions {
  public static bundle(options: BundlingProps): AssetCode {
    const bundling = new Bundling(options);

    return Code.fromAsset(options.spinManifestPath, {
      assetHashType: options.assetHashType ?? cdk.AssetHashType.OUTPUT,
      assetHash: options.assetHash,
      bundling: {
        image: bundling.image,
        command: bundling.command,
        // environment: bundling.environment,
        local: bundling.local,
        // Overwrite properties which are defined from the docker options.
        ...Object.fromEntries(
          Object.entries(options.dockerOptions ?? {}).filter(
            ([_, value]) => value !== undefined,
          ),
        ),
      },
    });
  }
  private static runsLocally?: boolean;

  // Core bundling options
  public readonly image: cdk.DockerImage;
  public readonly local?: cdk.ILocalBundling;
  public readonly command: string[];

  constructor(private readonly props: BundlingProps) {
    const wasmPath = getWasmPathFromSpinToml(props.spinManifestPath);
    Bundling.runsLocally = Bundling.runsLocally ?? spinVersion() ?? false;

    // Docker bundling
    const shouldBuildImage =
      props.forcedDockerBundling || !Bundling.runsLocally;

    this.image = shouldBuildImage
      ? props.dockerImage ?? cdk.DockerImage.fromRegistry("dummy") // there is no official spin image at the moment
      : cdk.DockerImage.fromRegistry("dummy"); // Do not build if we don't need to

    const osPlatform = platform();
    const bundlingCommand = this.createBundlingCommand({
      osPlatform,
      outputDir: cdk.AssetStaging.BUNDLING_OUTPUT_DIR,
      inputDir: cdk.AssetStaging.BUNDLING_INPUT_DIR,
      spinBinaryPath: props.spinBinaryPath,
      runShCommand: props.runShCommand,
      spinRuntimeConfigPath: props.spinRuntimeConfigPath,
      wasmPath,
    });

    this.command = ["bash", "-c", bundlingCommand];

    //Local bundling
    if (!props.forcedDockerBundling) {
      // only if Docker is not forced
      const createLocalCommand = (outputDir: string) => {
        return this.createBundlingCommand({
          osPlatform,
          outputDir,
          inputDir: props.spinManifestPath,
          spinBinaryPath: props.spinBinaryPath,
          runShCommand: props.runShCommand,
          spinRuntimeConfigPath: props.spinRuntimeConfigPath,
          wasmPath,
        });
      };

      this.local = {
        tryBundle(outputDir: string) {
          if (Bundling.runsLocally == false) {
            process.stderr.write(
              "Rust build cannot run locally. Switching to Docker bundling.\n",
            );
            return false;
          }

          const localCommand = createLocalCommand(outputDir);
          exec(
            osPlatform === "win32" ? "cmd" : "bash",
            [osPlatform === "win32" ? "/c" : "-c", localCommand],
            {
              env: { ...process.env, ...(props.environment ?? {}) },
              stdio: [
                // show output
                "ignore", // ignore stdio
                process.stderr, // redirect stdout to stderr
                "inherit", // inherit stderr
              ],
              cwd: props.spinManifestPath,
              windowsVerbatimArguments: osPlatform === "win32",
            },
          );
          return true;
        },
      };
    }
  }

  public createBundlingCommand(props: CommandOptions): string {
    const buildBinaryCommand: string = ["spin", "build"].join(" ");
    const copyWasmsCommand: string = props.wasmPath
      .map((wasmPath) =>
        [
          "echo",
          `${wasmPath}`,
          "|",
          "cpio",
          "-pdm",
          "--quiet",
          props.outputDir,
        ].join(" "),
      )
      .join(" && ");
    const copySpinTomlCommand: string = [
      "cp",
      "spin.toml",
      props.outputDir,
    ].join(" ");
    const copySpinRuntimeConfigCommand: string = props.spinRuntimeConfigPath
      ? ["cp", basename(props.spinRuntimeConfigPath), props.outputDir].join(" ")
      : "";
    const copySpinBinaryCommand: string = [
      "cp",
      props.spinBinaryPath,
      `${props.outputDir}/spin`,
    ].join(" ");
    const runShCommand =
      props.runShCommand ??
      './spin up --listen 127.0.0.1:8080 --log-dir "" --state-dir /tmp --disable-pooling';
    const runSh = `#!/bin/bash

${runShCommand}
`;

    const createRunShCommand: string = [
      "echo",
      `'${runSh}'`,
      ">",
      `${props.outputDir}/run.sh`,
      "&&",
      "chmod",
      "+x",
      `${props.outputDir}/run.sh`,
    ].join(" ");

    return chain([
      ...(this.props.commandHooks?.beforeBundling(
        props.inputDir,
        props.outputDir,
      ) ?? []),
      buildBinaryCommand,
      copyWasmsCommand,
      copySpinTomlCommand,
      copySpinRuntimeConfigCommand,
      copySpinBinaryCommand,
      createRunShCommand,
      ...(this.props.commandHooks?.afterBundling(
        props.inputDir,
        props.outputDir,
      ) ?? []),
    ]);
  }
}

function chain(commands: string[]): string {
  return commands.filter((c) => !!c).join(" && ");
}

export function spinVersion(): boolean | undefined {
  try {
    const cargo = spawnSync("spin", ["--version"]);
    return cargo.status !== 0 || cargo.error ? undefined : true;
  } catch (err) {
    return undefined;
  }
}

function getWasmPathFromSpinToml(spinManifestPath: string): string[] {
  const spinTomlString = readFileSync(`${spinManifestPath}/spin.toml`, "utf-8");
  const spinToml = parse(spinTomlString);
  return Object.keys(spinToml.component)
    .map((key) => {
      const source = spinToml.component[key].source;
      if (typeof source === "string") {
        return source;
      }
      return undefined;
    })
    .filter((path) => path !== undefined) as string[];
}
