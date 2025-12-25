// client/tests.ts
import { describe, it, before } from "node:test"; 
import assert from "node:assert";
import {
    airdropFactory,
    createSolanaRpc,
    createSolanaRpcSubscriptions,
    generateKeyPairSigner,
    lamports,
    sendAndConfirmTransactionFactory,
    pipe,
    createTransactionMessage,
    setTransactionMessageFeePayer,
    setTransactionMessageLifetimeUsingBlockhash,
    appendTransactionMessageInstruction,
    signTransactionMessageWithSigners,
    getSignatureFromTransaction,
    getProgramDerivedAddress,
    getAddressEncoder,
    getUtf8Encoder,
} from "@solana/kit";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import * as vault from "./clients/js/src/generated/index";

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);

describe('Vault Program', () => {
    let rpc: any;
    let rpcSubscriptions: any;
    let signer: any;
    let vaultRent: BigInt;
    let vaultPDA: any;
    
    const ACCOUNT_DISCRIMINATOR_SIZE = 8; // same as Anchor/Rust
    const U64_SIZE = 8; // u64 is 8 bytes
    const VAULT_SIZE = ACCOUNT_DISCRIMINATOR_SIZE + U64_SIZE; // 16
    const DEPOSIT_AMOUNT = BigInt(100000000);


    before(async () => {
        // Establish connection to Solana cluster
        const httpProvider = 'https://api.devnet.solana.com';
        const wssProvider = 'wss://api.devnet.solana.com';
        rpc = createSolanaRpc(httpProvider);
        rpcSubscriptions = createSolanaRpcSubscriptions(wssProvider);

        // Generate signers
        signer = await generateKeyPairSigner();
        const signerAddress = await signer.address;

        // Airdrop SOL to signer
        const airdrop = airdropFactory({ rpc, rpcSubscriptions });
        await airdrop({
            commitment: 'confirmed',
            lamports: lamports(LAMPORTS_PER_SOL),
            recipientAddress: signerAddress,
        });

        console.log(`Airdropped SOL to Signer: ${signerAddress}`);

        // get vault rent
        vaultRent = await rpc
            .getMinimumBalanceForRentExemption(VAULT_SIZE)
            .send();

        // Get vault PDA
        const seedSigner = getAddressEncoder().encode(await signer.address);
        const seedTag = getUtf8Encoder().encode("vault");
        vaultPDA = await getProgramDerivedAddress({
            programAddress: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
            seeds: [seedTag, seedSigner],
        });

        console.log(`Vault PDA: ${vaultPDA[0]}`);
    });

    it("can deposit to vault", async () => {
    
        // Create Deposit transaction using generated client
        const depositIx = vault.getDepositInstruction(
            {
                owner: signer,
                vault: vaultPDA[0],
                program: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
                systemProgram: SYSTEM_PROGRAM_ADDRESS,
                amount: lamports(DEPOSIT_AMOUNT),
            },
            {
                programAddress: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
            }
        );

        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
        const tx = await pipe(
            createTransactionMessage({ version: 0 }),
            tx => setTransactionMessageFeePayer(signer.address, tx),
            tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            tx => appendTransactionMessageInstruction(depositIx, tx)
        );

        // Sign and send transaction
        const signedTransaction = await signTransactionMessageWithSigners(tx);
        const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

        await sendAndConfirmTransaction(signedTransaction as any, {
            commitment: 'confirmed',
        });

        const signature = getSignatureFromTransaction(signedTransaction);
        console.log('Transaction signature:', signature);

        const { value } = await rpc.getBalance(vaultPDA[0].toString()).send();
        assert.equal(DEPOSIT_AMOUNT, Number(value) - Number(vaultRent));

    });

    it("can withdraw from vault", async () => {       

        const withdrawIx = vault.getWithdrawInstruction(
            {
                owner: signer,
                vault: vaultPDA[0],
                program: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
            },
        );

        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
        const tx = await pipe(
            createTransactionMessage({ version: 0 }),
            tx => setTransactionMessageFeePayer(signer.address, tx),
            tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            tx => appendTransactionMessageInstruction(withdrawIx, tx)
        );

        const signedTransaction = await signTransactionMessageWithSigners(tx);
        const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

        await sendAndConfirmTransaction(signedTransaction as any, {
            commitment: 'confirmed',
        });

        const signature = getSignatureFromTransaction(signedTransaction);
        console.log('Transaction signature:', signature);

        const { value } = await rpc.getBalance(vaultPDA[0].toString()).send();
        assert.equal(Number(vaultRent), value);
    });

    it("doesn't allow other users to withdraw from the vault", async () => {

        // signer that DOES NOT own the vault
        const otherSigner = await generateKeyPairSigner();
        
        const withdrawIx = vault.getWithdrawInstruction(
            {
                owner: otherSigner,
                vault: vaultPDA[0],
                program: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
            },
        );

        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
        const tx = await pipe(
            createTransactionMessage({ version: 0 }),
            tx => setTransactionMessageFeePayer(otherSigner.address, tx),
            tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            tx => appendTransactionMessageInstruction(withdrawIx, tx)
        );

        const signedTransaction = await signTransactionMessageWithSigners(tx);
        const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

        await assert.rejects(
            sendAndConfirmTransaction(signedTransaction as any, {
                commitment: 'confirmed'
            }),
            {
                message: "Transaction simulation failed",
            }
        );
    });
});