// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "../ContributionRegistry.sol";

/// @custom:security-contact hello@counter-resistance.org
contract DatasetRegistry is ContributionRegistry {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() override initializer public {
        ContributionRegistry.initialize();

        // Reinitialize with specific name and symbol
        __ERC721_init("Dataset registry", "DATA");
    }
}
