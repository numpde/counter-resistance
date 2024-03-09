# AMR Data Collection Ecosystem: Smart Contract Specification (Draft)

## Overview
This document briefly outlines the smart contract specifications for the Antimicrobial Resistance (AMR) Data Collection Ecosystem. The ecosystem leverages blockchain technology to incentivize the submission, validation, and funding of AMR-related datasets, ensuring transparency, security, and efficiency throughout the process.

### Table 1: Contributions

| Contract                 | Mint                     | Transfer                                | Update Metadata              | Burn                            | Approval                                                              | Set Approval For All | Freeze/Unfreeze              | Delegate | Revoke |
|--------------------------|--------------------------|-----------------------------------------|------------------------------|---------------------------------|-----------------------------------------------------------------------|----------------------|------------------------------|----------|--------|
| **ContributionRegistry** | Contribute               | Change contribution owner               | Edit contribution details    | Delete contribution             | Allow third-party transfer of ownership                               | ?                    | Pause contract interactions | ?        | ?      |
| **DatasetRegistry**      | Submit a dataset         | Change dataset owner                    | Edit dataset details         | Delete dataset contribution     | Allow third-party transfers of dataset contribution ownership        | ?                    | Pause contract interactions | ?        | ?      |
| **ProfileRegistry**      | Create a profile         | Transfer profile ownership              | Update profile details       | Delete profile                  | ?                                                                   | ?                    | Pause profile interactions  | ?        | ?      |

### Table 2: Contributions with references

| Contract                         | Mint                                                        | Transfer                                      | Update Metadata                             | Burn                            | Approval                                   | Set Approval For All | Freeze/Unfreeze                     | Delegate | Revoke |
|----------------------------------|-------------------------------------------------------------|-----------------------------------------------|---------------------------------------------|---------------------------------|--------------------------------------------|----------------------|------------------------------------|----------|--------|
| **ContributionRegistryWithRef**  | Contribute with reference to another contribution           | Change ownership of contribution with reference | Edit details without changing the reference | Delete contribution | Allow third-party transfer of ownership | ?                    | Pause interactions with references   | ?        | ?      |
| **ReviewRegistry**               | Submit a review                                             | Change review ownership                       | Update review details                       | Delete review                    | ?                                          | ?                    | Pause review interactions           | ?        | ?      |
| **BountyClaim**                  | Create a claim for a bounty                                 | Transfer bounty claim ownership               | Update bounty claim details                 | Withdraw bounty claim             | ?                                          | ?                    | Pause bounty claim interactions      | ?        | ?      |

### Table 3: Reputation management
| Contract            | Mint                                                         | Transfer  | Update Metadata  | Burn                | Approval  | Set Approval For All  | Freeze/Unfreeze          | Delegate  | Revoke  |
|---------------------|--------------------------------------------------------------|-----------|------------------|---------------------|-----------|----------------------|--------------------------|-----------|---------|
| **Reputation Contract** | Automatically minted for activities (contributions, reviews) | ?         | ?                | Diminish reputation | ?         | ?                    | Pause reputation updates | ?         | ?       |

### Table 4: Funding and specialized channels
| Contract                                 | Mint  | Transfer          | Update Metadata | Burn | Approval | Set Approval For All | Freeze/Unfreeze                 | Delegate | Revoke |
|------------------------------------------|-------|-------------------|-----------------|------|----------|---------------------|---------------------------------|----------|--------|
| **FundingBase**                          | ?     | Re-allocate funds | ?               | ?    | ?        | ?                   | Pause financial transactions   | ?        | ?      |
| **Specialized Funding Channel Contracts**| ?     | ?                 | ?               | ?    | ?        | ?                   | Pause channel-specific actions | ?        | ?      |


## Core Contracts

### DatasetRegistry Contract
- **Objective:** Manages AMR dataset registrations as ERC-721 non-fungible tokens (NFTs), including tracking and versioning.
- **Key Features:**
  - Minting NFTs for each dataset submission.
  - Implementing version control via metadata.
  - Ensuring ERC-721 compliance.

## Funding Infrastructure

### FundingBase
- **Objective:** Offers foundational fund management functionalities.
- **Key Features:**
  - Supports fund depositing and withdrawing.
  - Handles transactions using ERC-20 tokens.

### Specialized Funding Channel Contracts
- **Variants:** General, Data Collection & Submission, Data Validation & Quality Assurance, R&D, Education & Outreach, Emergency Response, and Developer Support.
- **Objective:** Tailors funding mechanisms to specific ecosystem needs.
- **Key Features:**
  - Provides incentives for dataset submission and validation.
  - Supports R&D, education, emergency responses, and development.

## Reputation System

### Reputation Contract
- **Objective:** Manages reputation tokens to reflect ecosystem contributions.
- **Key Features:**
  - Utilizes ERC-1155 for a flexible, multi-token standard.
  - Tracks and issues reputation tokens based on activities.


## Permissions

### ContributionRegistry

Contribution requires a regular `CONTRIBUTOR_ROLE` or an `EXPERT_CONTRIBUTOR_ROLE`. 
Regular contributors can contribute in their own name only.
Expert contributors can contribute on other's behalf
(see `_requireCanContribute`).

Per the OpenZeppelin implementation, transferring ownership of or burning an ERC-721 token
requires that the (non-zero) operator
be the current owner (`_ownerOf`),
is approved by the owner for all their tokens (`isApprovedForAll`),
or is the approved operator for the specific token (`_getApproved`),
although
the function to `_burn` is internal;
the function to `_setTokenURI` is internal.
This contract overrides that logic:
By default,
transferring ownership of a contribution is allowed
only 
for the current owner who is also the original contributor and an expert contributor,
regardless of approvals
(see `_isAuthorized`);
deleting a contribution is not implemented;
the contribution's URI can be set using
`setContributionURI`
if the caller is the current owner and has either contributor role
(see `_requireCanSetURI`).
