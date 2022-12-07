import { expect } from "chai";
import { 
  MintLayout,
  //ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  //TOKEN_PROGRAM_ID,
  u64,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token'
import { BN } from 'bn.js';
import { 
  getRealms,
  getRealm,
  withCreateRealm,
  getGovernanceProgramVersion,
  MintMaxVoteWeightSource,
  withDepositGoverningTokens,
  GovernanceConfig,
  withCreateMintGovernance,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  VoteType,
  withSetRealmAuthority,
  withCreateProposal,
  SetRealmAuthorityAction,
  withInsertTransaction,
  createInstructionData,
} from "@solana/spl-governance";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
  Transaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  deriveAddress,
  getPostMessageCpiAccounts,
  NodeWallet,
  postVaaSolana,
} from "@certusone/wormhole-sdk/lib/cjs/solana";
import {
  createGovernanceProgramInterface,
  createInitializeInstruction,
  deriveConfigKey,
  deriveForeignEmitterKey,
  getConfigData,
} from "../sdk/03_governance";
import {
  getPostedMessage,
  getProgramSequenceTracker,
  getWormholeDerivedAccounts,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import {
  getTokenBridgeDerivedAccounts,
} from "@certusone/wormhole-sdk/lib/cjs/solana";
import {
  MockEmitter,
  MockGuardians,
} from "@certusone/wormhole-sdk/lib/cjs/mock";
import { parseVaa } from "@certusone/wormhole-sdk"
import {
  LOCALHOST,
  PAYER_PRIVATE_KEY,
  GOVERNANCE_ADDRESS,
  WORMHOLE_ADDRESS,
  TOKEN_BRIDGE_ADDRESS,
  REALMS_ADDRESS,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "./helpers/consts";

const withMintTo = async (
  instructions: TransactionInstruction[],
  mintPk: PublicKey,
  destinationPk: PublicKey,
  mintAuthorityPk: PublicKey,
  amount: number | u64
) => {
  instructions.push(
    createMintToInstruction(
      mintPk,
      destinationPk,
      mintAuthorityPk,
      amount,
      [],
      TOKEN_PROGRAM_ID
    )
  )
}

const withCreateAssociatedTokenAccount = async (
  instructions: TransactionInstruction[],
  mintPk: PublicKey,
  ownerPk: PublicKey,
  payerPk: PublicKey
) => {
  const ataPk = await getAssociatedTokenAddress(
    mintPk,
    ownerPk,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )

  instructions.push(
    createAssociatedTokenAccountInstruction(
      payerPk,
      ataPk,
      ownerPk,
      mintPk,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  )
  //TODO: sign last ix 
  return ataPk
}

const withCreateMint = async (
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  ownerPk: PublicKey,
  freezeAuthorityPk: PublicKey | null,
  decimals: number,
  payerPk: PublicKey
) => {
  const mintRentExempt = await connection.getMinimumBalanceForRentExemption(
    MintLayout.span
  )

  const mintAccount = new Keypair()

  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payerPk,
      newAccountPubkey: mintAccount.publicKey,
      lamports: mintRentExempt,
      space: MintLayout.span,
      programId: TOKEN_PROGRAM_ID,
    })
  )
  signers.push(mintAccount)

  instructions.push(
    createInitializeMintInstruction(
      //TOKEN_PROGRAM_ID,
      mintAccount.publicKey,
      decimals,
      ownerPk,
      freezeAuthorityPk,
      TOKEN_PROGRAM_ID
    )
  )
  return mintAccount.publicKey
}

async function requestAirdrop(connection: Connection, walletPk: PublicKey) {
  const airdropSignature = await connection.requestAirdrop(
    walletPk,
    5 * LAMPORTS_PER_SOL,
  );

  await connection.confirmTransaction(airdropSignature);
}

async function sendTransaction(connection: Connection, instructions: TransactionInstruction[], signers: Keypair[], feePayer: Keypair) {
  let blockhash = await connection
  .getLatestBlockhash()
  .then((res) => res.blockhash);

  let blockHeight = await connection
  .getLatestBlockhash()
  .then((res) => res.lastValidBlockHeight);

  let transaction = new Transaction()
  transaction.add(...instructions)
  signers.push(feePayer);
  transaction.feePayer = feePayer.publicKey;
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = blockHeight;
  //transaction.sign(...signers);
  const signature = await sendAndConfirmTransaction(connection, transaction, signers)
}

const SECONDS_PER_DAY = 86400

function getTimestampFromDays(days: number) {
  return days * SECONDS_PER_DAY
}

async function registerTestRealm(connection: Connection) {
  const wallet = Keypair.generate();
  const walletPk = wallet.publicKey;

  console.log('wallet:',walletPk);

  await requestAirdrop(connection, walletPk);

  const programVersion = await getGovernanceProgramVersion(
    connection,
    REALMS_ADDRESS,
  );

  let instructions: TransactionInstruction[] = [];
  let signers: Keypair[] = [];

  //TODO: log created publicKeys and instruction each step of the way
  // Create and mint governance token
  let mintPk = await withCreateMint(
    connection,
    instructions,
    signers,
    walletPk,
    walletPk,
    0,
    walletPk,
  );
  console.log("ix 0:", instructions[0]);
  console.log("mintPk:", mintPk);
  console.log("signers:", signers);

  let ataPk = await withCreateAssociatedTokenAccount(
    instructions,
    mintPk,
    walletPk,
    walletPk,
  );
  console.log('ix 1:', instructions[1]);
  console.log('ataPk:', ataPk);

  await withMintTo(instructions, mintPk, ataPk, walletPk, 1);
  console.log('ix 2:', instructions[2]);

  // Create Realm
  const name = `Realm-${new Keypair().publicKey.toBase58().slice(0, 6)}`;
  const realmAuthorityPk = walletPk;

  const realmPk = await withCreateRealm(
    instructions,
    REALMS_ADDRESS,
    programVersion,
    name,
    realmAuthorityPk,
    mintPk,
    walletPk,
    undefined,
    MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION,
    new BN(1),
    undefined,
  );
  console.log('ix 3:', instructions[3]);
  console.log('realmPk:', realmPk);

  // Deposit governance tokens
  const tokenOwnerRecordPk = await withDepositGoverningTokens(
    instructions,
    REALMS_ADDRESS,
    programVersion,
    realmPk,
    ataPk,
    mintPk,
    walletPk,
    walletPk,
    walletPk,
    new BN(1),
  );
  console.log('ix 4', instructions[4]);
  console.log('tokenOwnerRecordPk', tokenOwnerRecordPk);

  // Create governance over the the governance token mint
  const config = new GovernanceConfig({
    communityVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.YesVotePercentage,
      value: 60,
    }),
    minCommunityTokensToCreateProposal: new BN(1),
    minInstructionHoldUpTime: 0,
    maxVotingTime: getTimestampFromDays(3),
    voteTipping: VoteTipping.Strict,
    councilVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.Disabled,
    }),
    minCouncilTokensToCreateProposal: new BN(1),
  });

  const governancePk = await withCreateMintGovernance(
    instructions,
    REALMS_ADDRESS,
    programVersion,
    realmPk,
    mintPk,
    config,
    true,
    walletPk,
    tokenOwnerRecordPk,
    walletPk,
    walletPk,
    undefined,
  );

  // Set realm authority to the created governance
  withSetRealmAuthority(
    instructions,
    REALMS_ADDRESS,
    programVersion,
    realmPk,
    walletPk,
    governancePk,
    SetRealmAuthorityAction.SetChecked,
  );

  // Create single choice Approve/Deny proposal with instruction to mint more governance tokens
  const voteType = VoteType.SINGLE_CHOICE;
  const options = ['Approve'];
  const useDenyOption = true;

  const proposalPk = await withCreateProposal(
    instructions,
    REALMS_ADDRESS,
    programVersion,
    realmPk,
    governancePk,
    tokenOwnerRecordPk,
    'proposal 1',
    '',
    mintPk,
    walletPk,
    0,
    voteType,
    options,
    useDenyOption,
    walletPk,
  );

  await sendTransaction(connection, instructions, signers, wallet);

  instructions = [];
  signers = [];

  const instruction = createMintToInstruction(
    //TOKEN_PROGRAM_ID,
    mintPk,
    ataPk,
    governancePk,
    [],
    1,
  );

  const instructionData = createInstructionData(instruction);

  await withInsertTransaction(
    instructions,
    REALMS_ADDRESS,
    programVersion,
    governancePk,
    proposalPk,
    tokenOwnerRecordPk,
    walletPk,
    0,
    0,
    0,
    [instructionData, instructionData],
    walletPk,
  );

  // Act
  await sendTransaction(connection, instructions, signers, wallet);

  return (realmPk);
}

describe(" 3: Governance", () => {
  const connection = new Connection(LOCALHOST, "recent");
  const payer = Keypair.fromSecretKey(PAYER_PRIVATE_KEY);

  //const testRealm = await registerTestRealm(connection);

  // foreign emitter info
  const foreignEmitterChain = 2;
  const foreignEmitterAddress = Buffer.alloc(32, "deadbeef", "hex");

  const tokenBridgeCpi = getTokenBridgeDerivedAccounts(
    GOVERNANCE_ADDRESS,
    TOKEN_BRIDGE_ADDRESS,
    WORMHOLE_ADDRESS
  );

  const realConfig = deriveConfigKey(GOVERNANCE_ADDRESS);
  const realForeignEmitter = deriveForeignEmitterKey(
    GOVERNANCE_ADDRESS,
    foreignEmitterChain
  );

  describe("Initialize Program", () => {
    it("Instruction: Initialize", async () => {
        const initializeTx = await createInitializeInstruction(
          connection,
          GOVERNANCE_ADDRESS,
          payer.publicKey,
	  TOKEN_BRIDGE_ADDRESS,
          WORMHOLE_ADDRESS
        )
          .then((ix) =>
            sendAndConfirmTransaction(
              connection,
              new Transaction().add(ix),
              [payer]
            )
          )
          .catch((reason) => {
            // should not happen
	    console.log('h');
            console.log(reason);
            return null;
          });
        expect(initializeTx).is.not.null;

        // verify account data
        const configData = await getConfigData(connection, GOVERNANCE_ADDRESS);
        expect(configData.owner.equals(payer.publicKey)).is.true;

        const tokenBridgeCpi = getTokenBridgeDerivedAccounts(
          GOVERNANCE_ADDRESS,
	  TOKEN_BRIDGE_ADDRESS,
          WORMHOLE_ADDRESS
        );
	const testRealm = await registerTestRealm(connection);
	//console.log(await getRealm(connection, testRealm));
        console.log(await getRealms(connection, REALMS_ADDRESS));
    }); 
  });

  describe("Send Eth Governance Tokens", () => {
    it("Instruction: SendEthGovTokens", async () => {
      //
    });
  });
});
