# Pinocchio Vault

A Solana program that provides a secure vault system for storing and managing SOL (lamports) using Program Derived Addresses (PDAs). Users can deposit SOL into their personal vault and withdraw it back, with automatic vault creation and rent-exempt account management.

## Features

- **Deposit SOL**: Deposit any amount of SOL into your personal vault
- **Withdraw SOL**: Withdraw all available SOL from your vault (maintaining rent-exempt status)
- **Automatic Vault Creation**: Vaults are automatically created on first deposit
- **PDA-based Security**: Each user has a unique vault derived from their public key
- **Rent-Exempt Management**: Vaults are automatically funded to be rent-exempt
- **Access Control**: Only the vault owner can withdraw from their vault

## Architecture

### Program Structure

The program consists of two main instructions:

1. **Deposit** (`discriminator: 0`)
   - Allows users to deposit SOL into their vault
   - Automatically creates the vault if it doesn't exist
   - Transfers lamports from the owner to the vault PDA

2. **Withdraw** (`discriminator: 1`)
   - Allows the vault owner to withdraw all available SOL
   - Validates ownership and PDA derivation
   - Maintains minimum rent-exempt balance in the vault

### Vault PDA Derivation

Each vault is a Program Derived Address (PDA) derived using:
- Seed: `"vault"`
- Owner's public key
- Program ID

This ensures each user has a unique, deterministic vault address.

### Account Structure

The vault account stores:
- **Account Discriminator** (8 bytes)
- **Balance tracking** (8 bytes for u64)

Total account size: 16 bytes

## Prerequisites

- **Rust**: Latest stable version
- **Solana CLI**: Version 2.0.0 or later
- **Node.js**: Version 18+ (for client testing)
- **Yarn**: Version 4.9.1+ (for client dependencies)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pinocchio-vault
```

### 2. Install Solana CLI

Follow the [official Solana installation guide](https://docs.solana.com/cli/install-solana-cli-tools).

### 3. Install Rust Dependencies

The Rust dependencies are managed via `Cargo.toml` and will be installed automatically when building.

### 4. Install Client Dependencies

```bash
cd client
yarn install
```

## Building the Program

### Build for Solana

```bash
cargo build-sbf
```

The compiled program will be located at:
```
target/deploy/pinocchio_vault.so
```

### Generate IDL

The IDL (Interface Definition Language) file is used for client generation:

```bash
# Install shank CLI if not already installed
cargo install shank-cli

# Generate IDL
shank idl --out-dir idl
```

The IDL will be generated at `idl/pinocchio_vault.json`.

### Generate Client Code

After generating the IDL, use Codama to generate client code:

```bash
cd client
codama generate
```

This generates TypeScript client code in `client/clients/js/src/generated/`.

## Deploying

### 1. Set Solana Cluster

```bash
# For devnet
solana config set --url devnet

# For mainnet (use with caution)
solana config set --url mainnet
```

### 2. Generate Program Keypair (if needed)

```bash
solana-keygen new -o target/deploy/pinocchio_vault-keypair.json
```

### 3. Update Program ID

Update the program ID in `src/lib.rs`:

```rust
declare_id!("YOUR_PROGRAM_PUBKEY");
```

### 4. Deploy

```bash
solana program deploy target/deploy/pinocchio_vault.so
```

## Usage

### Program Instructions

#### Deposit

Deposits SOL into the user's vault. The vault is automatically created if it doesn't exist.

**Accounts:**
- `owner` (signer, writable): The vault owner and payer
- `vault` (writable): The vault PDA for storing lamports
- `program` (readonly): The program address
- `systemProgram` (readonly): The System Program address

**Arguments:**
- `amount` (u64): The amount of lamports to deposit (must be > 0)

**Example (TypeScript):**

```typescript
import * as vault from "./clients/js/src/generated/index";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { lamports } from "@solana/kit";

const depositIx = vault.getDepositInstruction(
    {
        owner: signer,
        vault: vaultPDA,
        program: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
        amount: lamports(100000000), // 0.1 SOL
    },
    {
        programAddress: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
    }
);
```

#### Withdraw

Withdraws all available SOL from the vault back to the owner, maintaining the rent-exempt minimum balance.

**Accounts:**
- `owner` (signer, writable): The vault owner and authority
- `vault` (writable): The vault PDA containing lamports
- `program` (readonly): The program address

**Arguments:**
- None

**Example (TypeScript):**

```typescript
const withdrawIx = vault.getWithdrawInstruction(
    {
        owner: signer,
        vault: vaultPDA,
        program: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
    }
);
```

### Deriving the Vault PDA

The vault PDA can be derived using:

```typescript
import { getProgramDerivedAddress, getAddressEncoder, getUtf8Encoder } from "@solana/kit";

const seedSigner = getAddressEncoder().encode(ownerAddress);
const seedTag = getUtf8Encoder().encode("vault");
const [vaultPDA, bump] = await getProgramDerivedAddress({
    programAddress: vault.PINOCCHIO_VAULT_PROGRAM_ADDRESS,
    seeds: [seedTag, seedSigner],
});
```

## Testing

### Run Tests

The test suite includes:
1. Deposit functionality test
2. Withdraw functionality test
3. Access control test (prevents unauthorized withdrawals)

```bash
cd client
yarn test
```

### Test Coverage

The tests verify:
- ✅ Successful deposits to vault
- ✅ Successful withdrawals from vault
- ✅ Automatic vault creation on first deposit
- ✅ Rent-exempt balance maintenance
- ✅ Access control (only owner can withdraw)
- ✅ PDA derivation correctness

## Project Structure

```
pinocchio-vault/
├── src/
│   ├── lib.rs              # Program entrypoint and instruction routing
│   └── instructions.rs    # Deposit and Withdraw instruction implementations
├── client/
│   ├── tests.ts           # Integration tests
│   ├── clients/           # Generated client code (from Codama)
│   └── package.json       # Client dependencies
├── idl/
│   └── pinocchio_vault.json  # Program IDL (generated by Shank)
├── target/
│   └── deploy/
│       ├── pinocchio_vault.so          # Compiled program
│       └── pinocchio_vault-keypair.json # Program keypair
├── Cargo.toml             # Rust dependencies
└── README.md              # This file
```

## Security Considerations

### Access Control
- Only the vault owner (signer) can withdraw from their vault
- The program validates PDA derivation to ensure the correct vault is being accessed
- Vault ownership is verified before any withdrawal operation

### Rent-Exempt Protection
- The withdraw operation maintains the minimum rent-exempt balance
- Attempts to withdraw when balance is at or below rent-exempt minimum will fail
- This prevents accidental account closure

### Input Validation
- Deposit amounts must be greater than 0
- Account counts are validated before processing
- PDA derivation is verified for withdrawals

## Dependencies

### Rust Dependencies
- `pinocchio` (0.9.2): Core Solana program framework
- `pinocchio-log` (0.5.1): Logging utilities
- `pinocchio-pubkey` (0.3.0): Public key utilities
- `pinocchio-system` (0.4.0): System program instructions
- `shank` (0.4.6): IDL generation

### TypeScript Dependencies
- `@solana/kit` (^5.1.0): Solana web3.js kit
- `@solana-program/system` (^0.10.0): System program types
- `codama` (^1.5.0): IDL to client code generator

## Program ID

Current Program ID: `DhRLm6zjPRDmd22iw7vtvXBoASg1jKz7pfY7Bd1zTK1B`

**Note**: Update this in `src/lib.rs` if deploying with a different keypair.

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

## Support

[Add support information here]

