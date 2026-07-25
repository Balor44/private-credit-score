import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
} from './managed/hello-world/contract/index.js';
import { Contract } from './managed/hello-world/contract/index.js';

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
export const zkConfigPath = path.resolve(currentDir, 'managed', 'hello-world');

const witnesses = {
  getRepaymentScore: (context: any) => {
    const score = 750n;
    return [context.privateState, score];
  },
};

export const CompiledHelloWorldContract = CompiledContract.make(
  'HelloWorldContract',
  Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
