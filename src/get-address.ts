import { MidnightWalletProvider } from './wallet.js';
import { getConfig } from './config.js';
import pino from 'pino';
import crypto from 'node:crypto';

const logger = pino({ level: 'info' });
const config = getConfig();
const seed = crypto.randomBytes(32).toString('hex');

console.log('Generated seed (save this): ' + seed);

const wallet = await MidnightWalletProvider.build(logger, {
  walletNetworkId: config.networkId,
  networkId: config.networkId,
  indexer: config.indexer,
  indexerWS: config.indexerWS,
  node: config.node,
  nodeWS: config.nodeWS,
  faucet: config.faucet,
  proofServer: config.proofServer,
}, { kind: 'seed', value: seed });

const address = wallet.unshieldedKeystore.getBech32Address();
console.log('Wallet address to fund: ' + address);
process.exit(0);
