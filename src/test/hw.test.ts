import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { waitForFundsSafe } from '../wallet.js';
import pino from 'pino';
import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { buildProviders } from '../providers.js';
import { CompiledHelloWorldContract, Contract, ledger, zkConfigPath } from '../../contracts/index.js';

globalThis.WebSocket = WebSocket;

const ALICE_LOCAL_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const PRIVATE_STATE_ID = 'AliceCreditScoreState';
const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info', transport: { target: 'pino-pretty' } });
const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';

function resolveSecret(net) {
  if (net === 'local') return { kind: 'seed', value: ALICE_LOCAL_SEED };
  const upper = net.toUpperCase();
  const mnemonicEnv = 'MIDNIGHT_' + upper + '_MNEMONIC';
  const seedEnv = 'MIDNIGHT_' + upper + '_SEED';
  const mnemonic = process.env[mnemonicEnv];
  const seedHex = process.env[seedEnv];
  if (mnemonic) return { kind: 'mnemonic', value: mnemonic };
  if (seedHex) return { kind: 'seed', value: seedHex };
  throw new Error('Set ' + mnemonicEnv + ' or ' + seedEnv + ' for network ' + net);
}

describe('Private Credit Score Contract (' + network + ')', () => {
  let wallet;
  let providers;
  let contractAddress;

  const config = getConfig();
  const secret = resolveSecret(network);
  const isRemote = network !== 'local';
  const syncTimeoutMs = isRemote ? 3600000 : 600000;

  async function queryLedger(p) {
    const state = await p.publicDataProvider.queryContractState(contractAddress);
    expect(state).not.toBeNull();
    return ledger(state.data);
  }

  beforeAll(async () => {
    setNetworkId(config.networkId);
    const envConfig = {
      walletNetworkId: config.networkId,
      networkId: config.networkId,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      faucet: config.faucet,
      proofServer: config.proofServer,
    };
    wallet = await MidnightWalletProvider.build(logger, envConfig, secret);
    await wallet.start();
    await syncWallet(logger, wallet.wallet, syncTimeoutMs);
    if (isRemote) {
      const nightBalance = await waitForFundsSafe(logger, wallet.wallet, envConfig, wallet.unshieldedKeystore, syncTimeoutMs);
      logger.info("Wallet NIGHT balance: " + nightBalance);
    }
    providers = buildProviders(wallet, zkConfigPath, config);
    logger.info('Providers initialized. Ready to test!');
  });

  afterAll(async () => {
    if (wallet) {
      logger.info('Stopping wallet...');
      await wallet.stop();
    }
  });

  it('Deploys the contract', async () => {
    logger.info('Creating private state...');
    const deployed = await deployContract(providers, {
      compiledContract: CompiledHelloWorldContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: {},
    });
    logger.info('Setting the contract address...');
    contractAddress = deployed.deployTxData.public.contractAddress;
    logger.info('Contract deployed at: ' + contractAddress);
    expect(contractAddress).toBeDefined();
    expect(contractAddress.length).toBeGreaterThan(0);
  });

  it('Proves creditworthiness without revealing the score', async () => {
    const threshold = 500n;
    await submitCallTx(providers, {
      compiledContract: CompiledHelloWorldContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'checkCreditworthiness',
      args: [threshold],
    });
    const state = await queryLedger(providers);
    expect(state.creditworthy).toEqual(true);
  });
});
