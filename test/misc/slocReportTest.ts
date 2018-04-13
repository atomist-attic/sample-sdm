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

import { InMemoryFile } from "@atomist/automation-client/project/mem/InMemoryFile";
import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import * as assert from "power-assert";
import { slocReport } from "../../src/misc/slocReport";

describe("slocReport", () => {

    it("should work on TypeScript", async () => {
        const p = InMemoryProject.of(new InMemoryFile("thing.ts", "// Comment\n\nconst x = 10;\n"));
        const r = await slocReport(p, "ts");
        assert.equal(r.fileReports.length, 1);
        const f0 = r.fileReports[0];
        assert.equal(r.stats.total, 3);
        assert.equal(r.stats.source, 1);
        assert.equal(f0.stats.total, 3);
        assert.equal(f0.stats.source, 1);
    });

    it("should work on Java", async () => {
        const p = InMemoryProject.of(new InMemoryFile("src/Thing.java", "// Comment\n\nclass Foo{}\n"));
        const r = await slocReport(p, "java");
        assert.equal(r.fileReports.length, 1);
        const f0 = r.fileReports[0];
        assert.equal(r.stats.total, 3);
        assert.equal(r.stats.source, 1);
        assert.equal(f0.stats.total, 3);
        assert.equal(f0.stats.source, 1);
    });

});
