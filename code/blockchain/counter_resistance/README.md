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


### Table 3: Reputation Management
| Contract            | Mint                                                         | Transfer  | Update Metadata  | Burn                | Approval  | Set Approval For All  | Freeze/Unfreeze          | Delegate  | Revoke  |
|---------------------|--------------------------------------------------------------|-----------|------------------|---------------------|-----------|----------------------|--------------------------|-----------|---------|
| **Reputation Contract** | Automatically minted for activities (contributions, reviews) | ?         | ?                | Diminish reputation | ?         | ?                    | Pause reputation updates | ?         | ?       |

### Table 4: Funding and Specialized Channels
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

This draft summarizes the core components of the AMR Data Collection Ecosystem's smart contract architecture, foundational to enhancing global health security against antimicrobial resistance.
