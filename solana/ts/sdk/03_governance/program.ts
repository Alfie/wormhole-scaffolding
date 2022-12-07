import { Connection, PublicKeyInitData, PublicKey } from "@solana/web3.js";
import { Program, Provider } from "@project-serum/anchor";

import { HelloToken } from "../../../target/types/governance";

import IDL from "../../../target/idl/governance.json";

export function createGovernanceProgramInterface(
  connection: Connection,
  programId: PublicKeyInitData,
  payer?: PublicKeyInitData
): Program<Governance> {
  const provider: Provider = {
    connection,
    publicKey: payer == undefined ? undefined : new PublicKey(payer),
  };
  return new Program<Governance>(
    IDL as any,
    new PublicKey(programId),
    provider
  );
}
