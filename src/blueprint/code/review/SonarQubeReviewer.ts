import { logger } from "@atomist/automation-client";
import { ReviewerRegistration } from "@atomist/sdm/common/delivery/code/review/ReviewerRegistration";
import { ToDefaultBranch } from "@atomist/sdm/common/listener/support/pushtest/commonPushTests";
import { StringCapturingProgressLog } from "@atomist/sdm/common/log/StringCapturingProgressLog";
import { asSpawnCommand, spawnAndWatch } from "@atomist/sdm/util/misc/spawned";

const OrgKey = "johnsonr-github";

export const SonarQubeReviewer: ReviewerRegistration = {
    name: "SonarQube review",
    pushTest: ToDefaultBranch,
    action: async pli => {
        const command = `mvn clean org.jacoco:jacoco-maven-plugin:prepare-agent package sonar:sonar \
    -Dsonar.host.url=https://sonarcloud.io \
    -Dsonar.organization=${OrgKey} \
    -Dsonar.login=${process.env.SONAR_TOKEN}`;
        const log = new StringCapturingProgressLog();
        const childProcess = await spawnAndWatch(
            asSpawnCommand(command),
            {
                cwd: pli.project.baseDir,
            },
            log,
        );
        await pli.addressChannels(`Code review success`);
        logger.info(log.log);
        const parsed = Pattern.exec(log.log);
        await pli.addressChannels(`Analysis at ${parsed[0]}`);

        return {
            repoId: pli.id,
            comments: [],
        };
    },
};

// ANALYSIS SUCCESSFUL, you can browse https://sonarcloud.io/dashboard/index/com.atomist.springteam:spring-rest-seed
const Pattern = /ANALYSIS SUCCESSFUL, you can browse ([^\s^[]*)/;
