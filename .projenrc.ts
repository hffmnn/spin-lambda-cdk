import { awscdk } from "projen";
import { TrailingComma } from "projen/lib/javascript";
const project = new awscdk.AwsCdkConstructLibrary({
  author: "Christian Hoffmann",
  authorAddress: "ch.does.things@gmail.com",
  cdkVersion: "2.133.0",
  defaultReleaseBranch: "main",
  jsiiVersion: "~5.0.0",
  name: "spin-lambda-cdk",
  projenrcTs: true,
  repositoryUrl: "https://github.com/hffmnn/spin-lambda-cdk.git",
  githubOptions: {
    mergify: false,
  },
  prettier: true,
  prettierOptions: {
    settings: {
      trailingComma: TrailingComma.ALL,
    },
  },
  gitignore: ["cdk.out", "cdk.context.json"],

  deps: ["nodejs-file-downloader", "ora@5", "toml"],
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: ["aws-cdk", "ts-node"],
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();
