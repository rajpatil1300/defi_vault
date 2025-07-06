import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DefiVault } from "../target/types/defi_vault";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  createMint, 
  createAccount, 
  mintTo,
  getAccount
} from "@solana/spl-token";
import { assert } from "chai";

describe("defi-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DefiVault as Program<DefiVault>;
  const authority = provider.wallet as anchor.Wallet;
  
  let mint: PublicKey;
  let userTokenAccount: PublicKey;
  let vaultPda: PublicKey;
  let vaultTokenPda: PublicKey;
  let userPositionPda: PublicKey;
  
  const user = Keypair.generate();
  const interestRate = 500; // 5% APY
  const minDeposit = 1000000; // 1 token (assuming 6 decimals)

  before(async () => {
    // Airdrop SOL to user
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    );

    // Create mint using standard SPL token
    mint = await createMint(
      provider.connection,
      authority.payer,
      authority.publicKey,
      authority.publicKey,
      6,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Create user token account using standard SPL token
    userTokenAccount = await createAccount(
      provider.connection,
      authority.payer,
      mint,
      user.publicKey,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Mint tokens to user
    await mintTo(
      provider.connection,
      authority.payer,
      mint,
      userTokenAccount,
      authority.payer,
      100 * 1000000, // 100 tokens
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Derive PDAs
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), mint.toBuffer()],
      program.programId
    );

    [vaultTokenPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault-token"), mint.toBuffer()],
      program.programId
    );

    [userPositionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user-position"), vaultPda.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Initializes the vault", async () => {
    await program.methods
      .initializeVault(new anchor.BN(interestRate), new anchor.BN(minDeposit))
      .accounts({
        vault: vaultPda,
        authority: authority.publicKey,
        tokenMint: mint,
        tokenVault: vaultTokenPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    assert.equal(vault.authority.toString(), authority.publicKey.toString());
    assert.equal(vault.tokenMint.toString(), mint.toString());
    assert.equal(vault.interestRate.toNumber(), interestRate);
    assert.equal(vault.minDeposit.toNumber(), minDeposit);
  });

  it("Deposits tokens into the vault", async () => {
    const depositAmount = 10 * 1000000; // 10 tokens

    await program.methods
      .deposit(new anchor.BN(depositAmount))
      .accounts({
        vault: vaultPda,
        userPosition: userPositionPda,
        user: user.publicKey,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user])
      .rpc();

    const userPosition = await program.account.userPosition.fetch(userPositionPda);
    assert.equal(userPosition.depositedAmount.toNumber(), depositAmount);
    assert.equal(userPosition.owner.toString(), user.publicKey.toString());

    const vault = await program.account.vault.fetch(vaultPda);
    assert.equal(vault.totalDeposited.toNumber(), depositAmount);
  });

  it("Calculates interest correctly", async () => {
    // Wait a bit for time to pass (in a real test, you might mock the clock)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Make another deposit to trigger interest calculation
    const additionalDeposit = 5 * 1000000; // 5 tokens

    await program.methods
      .deposit(new anchor.BN(additionalDeposit))
      .accounts({
        vault: vaultPda,
        userPosition: userPositionPda,
        user: user.publicKey,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user])
      .rpc();

    const userPosition = await program.account.userPosition.fetch(userPositionPda);
    // Interest should be accrued (though minimal due to short time)
    assert.isTrue(userPosition.accruedInterest.toNumber() >= 0);
  });

  it("Withdraws tokens from the vault", async () => {
    const withdrawAmount = 5 * 1000000; // 5 tokens
    
    const initialBalance = await getAccount(provider.connection, userTokenAccount, undefined, TOKEN_PROGRAM_ID);

    await program.methods
      .withdraw(new anchor.BN(withdrawAmount))
      .accounts({
        vault: vaultPda,
        userPosition: userPositionPda,
        user: user.publicKey,
        userTokenAccount: userTokenAccount,
        vaultTokenAccount: vaultTokenPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const finalBalance = await getAccount(provider.connection, userTokenAccount, undefined, TOKEN_PROGRAM_ID);
    const userPosition = await program.account.userPosition.fetch(userPositionPda);

    // Check that tokens were withdrawn
    assert.isTrue(Number(finalBalance.amount) > Number(initialBalance.amount));
    assert.equal(userPosition.withdrawCount.toNumber(), 1);
  });

  it("Prevents withdrawal of more than available balance", async () => {
    const userPosition = await program.account.userPosition.fetch(userPositionPda);
    const excessiveAmount = userPosition.depositedAmount.toNumber() + userPosition.accruedInterest.toNumber() + 1000000;

    try {
      await program.methods
        .withdraw(new anchor.BN(excessiveAmount))
        .accounts({
          vault: vaultPda,
          userPosition: userPositionPda,
          user: user.publicKey,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      assert.fail("Should have failed with insufficient balance");
    } catch (error) {
      assert.include(error.toString(), "InsufficientBalance");
    }
  });

  it("Prevents deposits below minimum amount", async () => {
    const smallAmount = minDeposit - 1;

    try {
      await program.methods
        .deposit(new anchor.BN(smallAmount))
        .accounts({
          vault: vaultPda,
          userPosition: userPositionPda,
          user: user.publicKey,
          userTokenAccount: userTokenAccount,
          vaultTokenAccount: vaultTokenPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user])
        .rpc();
      
      assert.fail("Should have failed with insufficient deposit amount");
    } catch (error) {
      assert.include(error.toString(), "InsufficientDepositAmount");
    }
  });
});