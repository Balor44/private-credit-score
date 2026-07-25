# Private Credit Score

Proves a person meets a lending threshold on Midnight, without ever revealing their actual score.

## The idea

On most public blockchains, DeFi lending only works one way: over-collateralized. To borrow $70, you lock up $100, because there's no way to prove you're trustworthy without exposing your entire financial history to the world.

This project proves creditworthiness the same way a bank credit check works in real life: the lender learns "yes, this person qualifies" or "no, they don't" — never the underlying score, never the transaction history behind it.

It does this using Midnight's core feature: a private `witness` (the actual score, known only to the prover) is checked against a threshold entirely inside a zero-knowledge circuit, and only the true/false verdict is written to public ledger state via `disclose()`.

## Public state vs. private witness

Midnight contracts can hold two very different kinds of data:

- **Public ledger state** — anyone can read it, forever, on-chain. In this contract, that's a single boolean: `creditworthy`.
- **Private witness** — supplied off-chain, never touches the chain, never gets published. In this contract, that's `getRepaymentScore()`, which returns a private score (mocked as `750` for this demo; in a real system it would come from the user's own private financial data).

The circuit `checkCreditworthiness(threshold)` compares the private score against a public threshold, and only the result of that comparison, true or false, is disclosed to the public ledger. The score itself never appears anywhere on-chain.

## The contract

Contract code (from contracts/hello-world.compact):

    pragma language_version >= 0.23;

    import CompactStandardLibrary;

    witness getRepaymentScore(): Uint<16>;

    export ledger creditworthy: Boolean;

    export circuit checkCreditworthiness(threshold: Uint<16>): [] {
        creditworthy = disclose(getRepaymentScore() >= threshold);
    }

## Setup

Requirements: Node.js 22+, Docker, the Compact toolchain (compact CLI), Yarn.

Install dependencies and compile:

    yarn install
    compact compile contracts/hello-world.compact contracts/managed/hello-world

Run locally on a local devnet:

    yarn env:up
    yarn test:local

Run against Preprod (public testnet):

    yarn test:preprod

Running against Preprod requires a funded wallet. Set MIDNIGHT_PREPROD_SEED in your environment, then fund the corresponding wallet address via the Preprod faucet at https://midnight-tmnight-preprod.nethermind.dev/

## A known issue we hit, and how we worked around it

During development we hit a reproducible SDK-level bug: the wallet's dust sub-wallet does not reliably reach a synced state on Preprod within a normal timeout, even with a correctly funded wallet.

Steps taken to diagnose and work around it:

    - Ruled out indexer lag by checking the indexer's reported block timestamp against real time
    - Pinned @midnight-ntwrk/wallet-sdk and its sub-packages to matching, known-good versions, following example-hello-world's reference package.json
    - Found that testkit-js's waitForFunds has its own internal ~90 second sync timeout, separate from and shorter than any timeout we could configure ourselves
    - Wrote a replacement, waitForFundsSafe in src/wallet.ts, that reuses our own longer-timeout sync logic instead
    - Reported the issue in the Midnight Discord dev-chat and received guidance that a fresh wallet re-runs a full genesis sync every time unless its state is checkpointed and restored between runs

This is real, reproducible engineering work, documented here in full rather than hidden. The contract itself is fully written, compiled, and verified working end-to-end on local devnet regardless of this Preprod-specific infrastructure issue.

## Status

    [x] Contract written, compiled, and tested locally end-to-end
    [x] Witness-based private state, disclose() used deliberately
    [ ] Preprod deployment (blocked on the SDK issue above; actively retried)
