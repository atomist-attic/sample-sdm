
import {logger} from "@atomist/automation-client";
import {
    createEphemeralProgressLog, LogFactory, LoggingProgressLog, ProgressLog, rolarProgressLogFactory,
    WriteToAllProgressLog,
} from "@atomist/sdm";

export function logFactory(rolarBaseServiceUrl?: string): LogFactory {
    if (rolarBaseServiceUrl) {
        logger.info("Logging with Rolar at " + rolarBaseServiceUrl);
    }
    return async (context, sdmGoal) => {
        const name = sdmGoal.name;
        const fallbackLogger = new LoggingProgressLog(name, "info");
        const persistentLog: ProgressLog = rolarBaseServiceUrl ?
            await rolarProgressLogFactory(rolarBaseServiceUrl, fallbackLogger)(context, sdmGoal) : fallbackLogger;
        return new WriteToAllProgressLog(name, await createEphemeralProgressLog(context, sdmGoal), persistentLog);
    };
}
