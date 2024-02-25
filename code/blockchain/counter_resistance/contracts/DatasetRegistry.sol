// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "./RegistryBase.sol";

/// @custom:security-contact hello@counter-resistance.org
contract DatasetRegistry is RegistryBase {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() override initializer public {
        RegistryBase.initialize();

        // Reinitialize with specific name and symbol
        __ERC721_init("Dataset Registry", "DATA");
    }
}
