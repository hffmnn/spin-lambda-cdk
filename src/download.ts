import * as fs from "fs";
import { aws_lambda } from "aws-cdk-lib";
import Downloader from "nodejs-file-downloader";
import ora from "ora";
import { exec } from "./util";

/**
 * Downloads the spin binary for the given version and architecture. If the
 * given version is already downloaded, the cached version is returned.
 *
 * @param version The semver version of spin to download
 * @param architecture The lambda architecture to download the spin binary for
 * @returns The path to the downloaded and unpacked spin binary
 */
export async function getSpin(
  version: string,
  architecture: aws_lambda.Architecture,
): Promise<string> {
  const architectureString =
    architecture === aws_lambda.Architecture.ARM_64 ? "aarch64" : "amd64";
  const versionString = version.startsWith("v") ? version : `v${version}`;

  const tmpDownloadDir = `/tmp/spin-lambda-cdk/spin_${versionString}`;
  const spinVersion = `spin-${versionString}-linux-${architectureString}`;
  const spinTarFileName = `${spinVersion}.tar.gz`;
  const spinTarPath = `${tmpDownloadDir}/${spinTarFileName}`;
  const extractedSpinFilePath = `${tmpDownloadDir}/spin`;

  if (fs.existsSync(extractedSpinFilePath)) {
    return extractedSpinFilePath;
  }

  const url = `https://github.com/fermyon/spin/releases/download/${versionString}/${spinTarFileName}`;
  const downloader = new Downloader({
    url,
    directory: tmpDownloadDir,
  });

  const spinner = ora(`Getting ${spinVersion}`).start();
  await downloader.download();
  exec("tar", [`-xf`, `${spinTarPath}`, `-C`, `${tmpDownloadDir}`]);
  spinner.succeed();

  return extractedSpinFilePath;
}
