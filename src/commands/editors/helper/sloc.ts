/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { HandleCommand, HandlerContext, Parameter } from "@atomist/automation-client";
import { Parameters } from "@atomist/automation-client/decorators";
import { Project } from "@atomist/automation-client/project/Project";
import { editorCommand } from "@atomist/sdm";
import { slocReport } from "../../../misc/slocReport";

@Parameters()
export class SlocParams {

    @Parameter({required: false})
    public extension: string = "ts";
}

export const slocCommand: HandleCommand = editorCommand<SlocParams>(
    () => computeSloc,
    "sloc",
    SlocParams, {
        intent: ["compute sloc", "sloc"],
    });

async function computeSloc(p: Project, ctx: HandlerContext, params: SlocParams) {
    const report = await slocReport(p, params.extension);
    await ctx.messageClient.respond(
        `${report.stats.total} loc, ${report.stats.comment} in comments, ${report.fileReports.length} ${params.extension} files`);
    return p;
}
