#!/usr/bin/env node

import { runSlalom } from "@atomist/slalom/build/src/invocation/cli/runSlalom";
import { newLocalSdm } from "@atomist/slalom/build/src/machine/newLocalSdm";
import { Config } from "../local";

runSlalom(newLocalSdm(Config));