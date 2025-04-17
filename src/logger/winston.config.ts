import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig: winston.LoggerOptions = {
  transports: [
    // Keep console output in pretty Nest format
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        nestWinstonModuleUtilities.format.nestLike('Hashland', {
          prettyPrint: true,
        }),
      ),
    }),

    // Update file output to be structured JSON
    new winston.transports.File({
      filename: 'logs/perf.log',
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(), // <- key change here
      ),
    }),
  ],
};
