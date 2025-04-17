import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        nestWinstonModuleUtilities.format.nestLike('Hashland', {
          prettyPrint: true,
        }),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/perf.log',
      level: 'debug', // 👈 enables everything from debug and above
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(), // or nestLike if preferred
      ),
    }),
  ],
};
