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

    function initialize(address companion) public virtual override initializer {
        ContributionRegistry.initialize(companion);

        // Reinitialize with specific name and symbol
        __ERC721_init("Dataset registry", "DATA");
    }

    /**
     * @dev Allows authorized users to submit a dataset.
     * @param to The address for whom the contribution is being made.
     * @param uri The URI for the dataset metadata.
     * @return datasetId The ID of the contribution.
     */
    function submit(address to, string memory uri) public returns (uint256 datasetId)
    {
        datasetId = contribute(to, uri);
    }

    /**
     * @dev Shortcut for `submitFor` to submit a dataset for the caller.
     * @param uri The URI for the dataset metadata.
     * @return datasetId The ID of the contribution.
     */
    function submit(string memory uri) public returns (uint256 datasetId)
    {
        datasetId = contribute(_msgSender(), uri);
    }
}
