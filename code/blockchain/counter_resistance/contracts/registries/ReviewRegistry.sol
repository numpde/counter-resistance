// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "../ContributionRegistryWithTarget.sol";

/**
 * @title ReviewRegistry
 * @dev Extends ContributionRegistryWithRef to manage reviews. A "contribution" and a "review" are synonymous here.
 */
contract ReviewRegistry is ContributionRegistryWithTarget {
    function initialize(address companion) public virtual override initializer {
        ContributionRegistryWithTarget.initialize(companion);
        __ERC721_init("Review registry", "REVU");
    }

    //
    // Overrides.
    //

    /**
     * @dev Checks if `spender` is authorized to manage the contribution identified by `contributionId`.
     * Authorization is granted if the `spender` is the original contributor and is an expert contributor.
     * The `spender` need not be the current `owner`.
     * @notice The `owner` parameter is included for compatibility with the override mechanism and is not used.
     * @param owner The address of the contribution's owner, unused in this implementation.
     * @param spender The address attempting to manage the contribution.
     * @param contributionId The unique identifier of the contribution.
     * @return bool True if the `spender` is authorized to manage the contribution, false otherwise.
     */
    function _isAuthorized(address owner, address spender, uint256 contributionId) internal view override returns (bool) {
        bool isOwner = (owner == spender);
        bool isOriginalContributor = (getOriginalContributor(contributionId) == spender);
        bool isExpertContributor = hasRole(EXPERT_CONTRIBUTOR_ROLE, spender);

        return (isOwner || !isOwner) && isOriginalContributor && isExpertContributor;
    }
}
