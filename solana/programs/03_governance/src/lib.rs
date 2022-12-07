use anchor_lang::prelude::*;

pub use context::*;
pub use error::*;
pub use message::*;
pub use state::*;

pub mod constants;
pub mod context;
pub mod error;
pub mod message;
pub mod state;

declare_id!("6CunRn1u11RPrJAexedhXKsuek3gFJcEdSjavfLTBZp1");

#[program]
pub mod governance {
    use super::*;
    use anchor_lang::solana_program;
    use wormhole_anchor_sdk::{token_bridge, wormhole};

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // Initialize program config
        let config = &mut ctx.accounts.config;

        // Set the owner of the config (effectively the owner of the program)
        config.owner = ctx.accounts.owner.key();

        // Set Token Bridge related addresses
        let token_bridge = &mut config.token_bridge;
        token_bridge.config = ctx.accounts.token_bridge_config.key();
        token_bridge.authority_signer = ctx.accounts.token_bridge_authority_signer.key();
        token_bridge.custody_signer = ctx.accounts.token_bridge_custody_signer.key();
        token_bridge.mint_authority = ctx.accounts.token_bridge_mint_authority.key();
        token_bridge.sender = ctx.accounts.token_bridge_sender.key();
        token_bridge.redeemer = ctx.accounts.token_bridge_redeemer.key();

        token_bridge.sender_bump = *ctx
            .bumps
            .get("token_bridge_sender")
            .ok_or(HelloTokenError::BumpNotFound)?;
        token_bridge.redeemer_bump = *ctx
            .bumps
            .get("token_bridge_redeemer")
            .ok_or(HelloTokenError::BumpNotFound)?;

        // Set Wormhole related addresses
        {
            let wormhole = &mut config.wormhole;
            wormhole.config = ctx.accounts.wormhole_bridge.key();
            wormhole.fee_collector = ctx.accounts.wormhole_fee_collector.key();
        }

        Ok(())
    }

    pub fn cast_eth_vote(ctx: Context<CastEthVote>) -> Result<()> {
        //TODO: 
        Ok(())
    }

    /*
    pub fn send_eth_gov_tokens(ctx: Context<SendEthGovTokens>) -> Result<()> {
        //TODO:
        token_bridge::transfer_native_with_payload(
            CpiContext::new_with_signer(
                ctx.accounts.token_bridge_program.to_account_info(),
                token_bridge::TransferNativeWithPayload {
                    payer: ctx.accounts.payer.to_account_info(),
                    config: ctx.accounts.token_bridge_config.to_account_info(),
                    //from: ,
                    //mint: ,
                    //custody: ,
                    //authority_signer: ,
                    //custody_signer: ,
                    //wormhole_bridge: ,
                    //wormhole_message: ,
                    //wormhole_emitter: ,
                    //wormhole_sequence: ,
                    //wormhole_fee_collector: ,
                    //clock: ,
                    //sender: ,
                    //rent: ,
                    //system_program: ,
                    //token_program: ,
                    //wormhole_program: ,
                },
                &[
                    &[
                        //
                    ],
                    //
                ],
            ),
            //
        )?;
        Ok(())
    }*/
}

//NOTE: use ReceiveMessage from hello_world as reference
#[derive(Accounts)]
pub struct CastEthVote {}

/*
async fn cast_vote() {
    // get daa about realm
    let mut governance_test = GovernanceProgramTest::start_new().await;

    let realm_cookie = governance_test.with_realm().await;
    let governed_account_cookie = governance_test.with_governed_account().await;

    let token_owner_record_cookie = governance_test
        .with_community_token_deposit(&realm_cookie)
        .await
        .unwrap();

    let mut governance_cookie = governance_test
        .with_governance(
            &realm_cookie,
            &governed_account_cookie,
            &token_owner_record_cookie,
        )
        .await
        .unwrap();

    let proposal_cookie = governance_test
        .with_signed_off_proposal(&token_owner_record_cookie, &mut governance_cookie)
        .await
        .unwrap();

    let clock = governance_test.bench.get_clock().await;

    // cast vote
    let vote_record_cookie = governance_test
        .with_cast_yes_no_vote(&proposal_cookie, &token_owner_record_cookie, YesNoVote::Yes)
        .await
        .unwrap();
}*/
