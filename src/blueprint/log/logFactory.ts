
import {logger} from "@atomist/automation-client";
import {
    constructLogPath,
    createEphemeralProgressLog, firstAvailableProgressLog, LogFactory, LoggingProgressLog,
    RolarProgressLog,
    WriteToAllProgressLog,
} from "@atomist/sdm";

export function logFactory(rolarBaseServiceUrl?: string): LogFactory {
    let persistentLogFactory = (context, sdmGoal, fallback) => firstAvailableProgressLog(fallback);
    if (rolarBaseServiceUrl) {
        logger.info("Logging with Rolar at " + rolarBaseServiceUrl);
        persistentLogFactory = (context, sdmGoal, fallback) => {
            return firstAvailableProgressLog(
                new RolarProgressLog(rolarBaseServiceUrl, constructLogPath(context, sdmGoal)),
                fallback,
            );
        };
    }
    return async (context, sdmGoal) => {
        const name = sdmGoal.name;
        const persistentLog = await persistentLogFactory(context, sdmGoal, new LoggingProgressLog(name, "info"));
        return new WriteToAllProgressLog(name, await createEphemeralProgressLog(context, sdmGoal), persistentLog);
    };
}
