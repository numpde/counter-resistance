// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "./RegistryBase.sol";

/// @custom:security-contact hello@counter-resistance.org
contract ProfileRegistry is RegistryBase {
    event ContributorRoleSelfGranted(address indexed contributor);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() override initializer public {
        RegistryBase.initialize();

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
     * @dev Overrides the contribute function to automatically grant CONTRIBUTOR_ROLE
     * to the caller before proceeding with the contribution. Contributions are to self.
     * @param uri The URI for the contribution metadata.
     * @return contributionId The ID of the newly created contribution.
     */
    function contribute(string memory uri) public override returns (uint256 contributionId) {
        _selfGrantContributorRole();  // emits
        contributionId = super.contribute(uri);  // emits
    }
}
