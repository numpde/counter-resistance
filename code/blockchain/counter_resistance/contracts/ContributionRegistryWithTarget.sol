// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ContributionRegistry.sol";

/**
 * @title ContributionRegistryWithTarget
 * @dev Extends ContributionRegistry to manage contributions with references to specific targets.
 * This contract allows contributions to be made with additional context, linking them to identifiable targets,
 * such as items represented by a combination of chain ID, contract address, and token ID. It can be used
 * for a variety of purposes including reviews, feedback, or any other forms of contributions.
 */
contract ContributionRegistryWithTarget is ContributionRegistry {
    /**
     * @dev Struct to represent a target for contributions.
     * @param chainId The blockchain network ID where the target resides.
     * @param contractAddress The smart contract address of the target.
     * @param targetId The unique identifier of the target within the contract.
     */
    struct Target {
        uint256 chainId;
        address contractAddress;
        uint256 targetId;
    }

    /// @dev Maps a contribution ID to its corresponding target.
    mapping(uint256 => Target) private _targets;

    /// @notice Emitted when a target is associated with a contribution.
    /// @param contributionId The ID of the contribution being linked to a target.
    event TargetSet(uint256 indexed contributionId);

    /// @dev Error indicating that a target is required but not provided.
    error TargetRequired();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public virtual override initializer {
        ContributionRegistry.initialize();
    }

    /**
     * @notice Contributes on behalf of another address with a specified target.
     * @dev Posts a contribution linked to a target on behalf of a user.
     * @param to The address for whom the contribution is being made.
     * @param uri The URI for the contribution metadata.
     * @param target The details of the target.
     * @return contributionId The unique identifier of the newly minted contribution.
     */
    function contribute(address to, string memory uri, Target memory target)
    public
    virtual
    whenNotPaused
    returns (uint256 contributionId)
    {
        contributionId = super.contribute(to, uri);
        _setTarget(contributionId, target);
    }

    /**
     * @dev Disables `_contribute` without a target and reverts with `TargetRequired`.
     */
    function contribute(address /*to*/, string memory /*uri*/) public pure override returns (uint256) {
        revert TargetRequired();
    }

    /**
     * @dev Associates a target with a contribution.
     * @param contributionId The ID of the contribution.
     * @param target The target details.
     */
    function _setTarget(uint256 contributionId, Target memory target) private {
        _targets[contributionId] = target;
        emit TargetSet(contributionId);
    }

    /**
     * @dev Associates a target with a contribution, callable by DEFAULT_ADMIN_ROLE only.
     * @param contributionId The ID of the contribution.
     * @param target The target details.
     */
    function setTarget(uint256 contributionId, Target calldata target)
    external
    whenNotPaused
    onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setTarget(contributionId, target);
    }

    /**
     * @dev Retrieves the target associated with a contribution ID.
     * @param contributionId The ID of the contribution.
     * @return The target details.
     */
    function getTarget(uint256 contributionId) public view returns (Target memory) {
        return _targets[contributionId];
    }
}
