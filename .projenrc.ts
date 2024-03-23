import { awscdk } from "projen";
import { TrailingComma } from "projen/lib/javascript";
const project = new awscdk.AwsCdkConstructLibrary({
  author: "Christian Hoffmann",
  authorAddress: "ch.does.things@gmail.com",
  cdkVersion: "2.1.0",
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

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();
