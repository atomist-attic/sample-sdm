
import { runOnGitHook } from "@atomist/slalom/build/src/invocation/git/runOnGitHook";
import { newLocalSdm } from "@atomist/slalom/build/src/machine/newLocalSdm";
import { Config } from "../local";

runOnGitHook(process.argv, newLocalSdm(Config));