// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "../ContributionRegistryWithTarget.sol";

/**
 * @title BountyClaimRegistry
 * @dev Inherits from ContributionRegistryWithRef to specifically handle the registration and management of bounty claims. It introduces functionalities to manage funding claims associated with various contributions within the ecosystem. Each claim is registered as an NFT to facilitate ownership and transferability.
 */
contract BountyClaimRegistry is ContributionRegistryWithTarget {
    /**
     * @dev Initializes the contract by setting up its name and symbol and invoking initialization of the base ContributionRegistryWithRef contract. This setup is crucial for the ERC721 part of the contract that handles the NFT representation of bounty claims.
     */
    function initialize() public override initializer {
        ContributionRegistryWithTarget.initialize();
        __ERC721_init("Bounty claim registry", "CLAIM");
    }

    // TODO: add `claim` and `claimFor`

    // Overrides.

    /**
     * @dev Determines if a given `spender` can manage a claim identified by its `contributionId`.
     * A `spender` is deemed authorized if they are the current owner.
     * @notice Ownership is determined by comparing the `spender` address with the current owner's address. This function does not perform an explicit ownership check.
     * @param owner The address presumed to be the current owner of the NFT representing the claim. Note: Ownership is assumed and not verified within this function.
     * @param spender The address seeking authorization to manage the NFT.
     * @param claimId The identifier of the claim for which management authorization is being checked. This parameter is included for future use and compatibility but is not utilized in the current logic.
     * @return bool True if `spender` is authorized to manage the specified claim, false otherwise.
     */
    function _isAuthorized(address owner, address spender, uint256 claimId) internal view override returns (bool) {
        bool isOwner = (owner == spender);
        bool isOriginalContributor = (getOriginalContributor(claimId) == spender);

        isOriginalContributor;  // unused variable

        return isOwner;
    }
}
