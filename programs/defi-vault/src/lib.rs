use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod defi_vault {
    use super::*;

    /// Initialize a new vault for a specific SPL token
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        interest_rate: u64, // Interest rate in basis points (e.g., 500 = 5%)
        min_deposit: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.token_mint = ctx.accounts.token_mint.key();
        vault.token_vault = ctx.accounts.token_vault.key();
        vault.interest_rate = interest_rate;
        vault.min_deposit = min_deposit;
        vault.total_deposited = 0;
        vault.bump = ctx.bumps.vault;
        vault.created_at = Clock::get()?.unix_timestamp;
        
        msg!("Vault initialized with interest rate: {}bps", interest_rate);
        Ok(())
    }

    /// Deposit tokens into the vault
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        require!(amount >= vault.min_deposit, VaultError::InsufficientDepositAmount);
        
        // Transfer tokens from user to vault using standard SPL token
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update or create user position
        let user_position = &mut ctx.accounts.user_position;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Calculate accrued interest on existing deposit before adding new deposit
        if user_position.deposited_amount > 0 {
            let accrued_interest = calculate_interest(
                user_position.deposited_amount,
                vault.interest_rate,
                current_time - user_position.last_update_time,
            );
            user_position.accrued_interest += accrued_interest;
        }
        
        user_position.owner = ctx.accounts.user.key();
        user_position.vault = vault.key();
        user_position.deposited_amount += amount;
        user_position.last_update_time = current_time;
        user_position.deposit_count += 1;
        
        vault.total_deposited += amount;
        
        emit!(DepositEvent {
            user: ctx.accounts.user.key(),
            vault: vault.key(),
            amount,
            timestamp: current_time,
        });
        
        msg!("Deposited {} tokens. Total deposited: {}", amount, user_position.deposited_amount);
        Ok(())
    }

    /// Withdraw tokens from the vault including accrued interest
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let user_position = &mut ctx.accounts.user_position;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Calculate total available balance (principal + accrued interest)
        let accrued_interest = calculate_interest(
            user_position.deposited_amount,
            vault.interest_rate,
            current_time - user_position.last_update_time,
        );
        
        let total_available = user_position.deposited_amount + user_position.accrued_interest + accrued_interest;
        
        require!(amount <= total_available, VaultError::InsufficientBalance);
        
        // Transfer tokens from vault to user using standard SPL token
        let seeds = &[
            b"vault",
            vault.token_mint.as_ref(),
            &[vault.bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        // Update user position
        let mut remaining_withdrawal = amount;
        
        // First, withdraw from accrued interest
        let total_accrued = user_position.accrued_interest + accrued_interest;
        if remaining_withdrawal <= total_accrued {
            user_position.accrued_interest = total_accrued - remaining_withdrawal;
            remaining_withdrawal = 0;
        } else {
            remaining_withdrawal -= total_accrued;
            user_position.accrued_interest = 0;
            // Withdraw from principal
            user_position.deposited_amount -= remaining_withdrawal;
            vault.total_deposited -= remaining_withdrawal;
        }
        
        user_position.last_update_time = current_time;
        user_position.withdraw_count += 1;
        
        emit!(WithdrawEvent {
            user: ctx.accounts.user.key(),
            vault: vault.key(),
            amount,
            timestamp: current_time,
        });
        
        msg!("Withdrew {} tokens. Remaining deposited: {}", amount, user_position.deposited_amount);
        Ok(())
    }

    /// Get user's current balance including accrued interest
    pub fn get_user_balance(ctx: Context<GetUserBalance>) -> Result<UserBalanceInfo> {
        let user_position = &ctx.accounts.user_position;
        let vault = &ctx.accounts.vault;
        let current_time = Clock::get()?.unix_timestamp;
        
        let accrued_interest = calculate_interest(
            user_position.deposited_amount,
            vault.interest_rate,
            current_time - user_position.last_update_time,
        );
        
        let total_balance = user_position.deposited_amount + user_position.accrued_interest + accrued_interest;
        
        Ok(UserBalanceInfo {
            deposited_amount: user_position.deposited_amount,
            accrued_interest: user_position.accrued_interest + accrued_interest,
            total_balance,
            last_update_time: user_position.last_update_time,
        })
    }
}

// Helper function to calculate interest
fn calculate_interest(principal: u64, interest_rate_bps: u64, time_elapsed: i64) -> u64 {
    if principal == 0 || time_elapsed <= 0 {
        return 0;
    }
    
    // Simple interest calculation: (principal * rate * time) / (10000 * seconds_per_year)
    // Rate is in basis points (1 basis point = 0.01%)
    let seconds_per_year = 365 * 24 * 60 * 60;
    let interest = (principal as u128)
        .checked_mul(interest_rate_bps as u128)
        .unwrap()
        .checked_mul(time_elapsed as u128)
        .unwrap()
        .checked_div(10000u128)
        .unwrap()
        .checked_div(seconds_per_year as u128)
        .unwrap();
    
    interest as u64
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 8,
        seeds = [b"vault", token_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = vault,
        token::token_program = token_program,
        seeds = [b"vault-token", token_mint.key().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.token_mint.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8,
        seeds = [b"user-position", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == vault.token_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault-token", vault.token_mint.as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.token_mint.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(
        mut,
        seeds = [b"user-position", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == vault.token_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault-token", vault.token_mint.as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetUserBalance<'info> {
    pub vault: Account<'info, Vault>,
    pub user_position: Account<'info, UserPosition>,
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_vault: Pubkey,
    pub interest_rate: u64, // in basis points
    pub min_deposit: u64,
    pub total_deposited: u64,
    pub bump: u8,
    pub created_at: i64,
}

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub deposited_amount: u64,
    pub accrued_interest: u64,
    pub last_update_time: i64,
    pub deposit_count: u64,
    pub withdraw_count: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UserBalanceInfo {
    pub deposited_amount: u64,
    pub accrued_interest: u64,
    pub total_balance: u64,
    pub last_update_time: i64,
}

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum VaultError {
    #[msg("Insufficient deposit amount")]
    InsufficientDepositAmount,
    #[msg("Insufficient balance for withdrawal")]
    InsufficientBalance,
}