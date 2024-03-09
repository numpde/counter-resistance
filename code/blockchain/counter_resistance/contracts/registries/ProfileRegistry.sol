// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "../ContributionRegistry.sol";

/// @custom:security-contact hello@counter-resistance.org
contract ProfileRegistry is ContributionRegistry {
    event ContributorRoleSelfGranted(address indexed contributor);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() override initializer public {
        ContributionRegistry.initialize();

        // Reinitialize with specific name and symbol
        __ERC721_init("Whois registry", "WHOIS");
    }

    /**
     * @dev Private function to self-grant the CONTRIBUTOR_ROLE to the caller if they don't already have it.
     */
    function _selfGrantContributorRole() private {
        if (!hasRole(CONTRIBUTOR_ROLE, _msgSender())) {
            _grantRole(CONTRIBUTOR_ROLE, _msgSender());
            emit ContributorRoleSelfGranted(_msgSender());
        }
    }

    /**
     * @dev Automatically grants the CONTRIBUTOR_ROLE to the caller
     * before proceeding with the contribution. Contributions are to self.
     * @param uri The URI for the contribution metadata.
     * @return contributionId The ID of the newly created contribution.
     */
    function addProfile(string memory uri) public returns (uint256 profileId) {
        _selfGrantContributorRole();  // emits if role is newly granted
        profileId = super._contribute(_msgSender(), uri);  // emits
    }
}
