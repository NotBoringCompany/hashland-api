import TonWeb from 'tonweb';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Initialize a new TonWeb instance with the TON API endpoint and key.
 */
export const TON_WEB = new TonWeb(
  new TonWeb.HttpProvider(process.env.TON_API_ENDPOINT, {
    apiKey: process.env.TON_API_KEY,
  }),
);
