
import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import { InMemoryFile } from "@atomist/automation-client/project/mem/InMemoryFile";
import { slocReport } from "../../src/misc/slocReport";
import * as assert from "power-assert";

describe("slocReport", () => {

    it("should work on TypeScript", async () => {
        const p = InMemoryProject.of(new InMemoryFile("thing.ts", "// Comment\n\nconst x = 10;\n"))
        const r = await slocReport(p, "ts");
        assert.equal(r.fileReports.length, 1);
        const f0 = r.fileReports[0];
        assert.equal(r.stats.total, 3);
        assert.equal(r.stats.source, 1);
        assert.equal(f0.stats.total, 3);
        assert.equal(f0.stats.source, 1);
    });

    it("should work on Java", async () => {
        const p = InMemoryProject.of(new InMemoryFile("src/Thing.java", "// Comment\n\nclass Foo{}\n"))
        const r = await slocReport(p, "java");
        assert.equal(r.fileReports.length, 1);
        const f0 = r.fileReports[0];
        assert.equal(r.stats.total, 3);
        assert.equal(r.stats.source, 1);
        assert.equal(f0.stats.total, 3);
        assert.equal(f0.stats.source, 1);
    });

});