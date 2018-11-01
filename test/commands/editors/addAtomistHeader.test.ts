/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    executeAutofixes,
    fakeGoalInvocation,
    GoalInvocation,
} from "@atomist/sdm";

import * as assert from "power-assert";

import {
    GitCommandGitProject,
    GitHubRepoRef,
    InMemoryProjectFile,
    RemoteRepoRef,
} from "@atomist/automation-client";
import { AddAtomistTypeScriptHeader } from "../../../src/autofix/addAtomistHeader";
import { ApacheHeader } from "../../../src/commands/editors/license/addHeader";

/**
 * Test an autofix end to end
 */
describe("addHeaderFix", () => {

    it.skip("should lint and make fixes", async () => {
        const p = await GitCommandGitProject.cloned({ token: null }, new GitHubRepoRef("atomist", "github-sdm"));
        // Make commit and push harmless
        let pushCount = 0;
        let commitCount = 0;
        p.commit = async (message: string) => {
            ++commitCount;
            return p;
        };
        p.push = async () => {
            ++pushCount;
            return p;
        };
        const f = new InMemoryProjectFile("src/bad.ts", "const foo;\n");
        // Now mess it up with a lint error that tslint can fix
        await p.addFile(f.path, f.content);
        assert(!!p.findFileSync(f.path));

        const gi: GoalInvocation = fakeGoalInvocation(p.id as RemoteRepoRef);
        const r = await executeAutofixes([AddAtomistTypeScriptHeader])(gi);
        assert.equal(pushCount, 1);
        assert.equal(commitCount, 1);

        const fileNow = p.findFileSync(f.path);
        assert(!!fileNow);
        assert(fileNow.getContentSync().startsWith(ApacheHeader));
    }) ; // .timeout(40000);

});
