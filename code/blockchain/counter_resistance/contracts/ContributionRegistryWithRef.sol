// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ContributionRegistry.sol";

/**
 * @title ContributionRegistryWithRef
 * @dev Extends ContributionRegistry to manage contributions with references to specific targets.
 * This contract allows contributions to be made with additional context, linking them to identifiable targets,
 * such as items represented by a combination of chain ID, contract address, and token ID. It can be used
 * for a variety of purposes including reviews, feedback, or any other forms of contributions.
 */
contract ContributionRegistryWithRef is ContributionRegistry {
    /**
     * @dev Struct to represent a target for contributions.
     * @param chainId The blockchain network ID where the target resides.
     * @param contractAddress The smart contract address of the target.
     * @param targetId The unique identifier of the target within the contract.
     */
    struct TargetRef {
        uint256 chainId;
        address contractAddress;
        uint256 targetId;
    }

    /// @dev Maps a contribution ID to its corresponding target reference.
    mapping(uint256 => TargetRef) private _targetRefs;

    /// @notice Emitted when a target reference is associated with a contribution.
    /// @param contributionId The ID of the contribution being linked to a target.
    event TargetRefSet(uint256 indexed contributionId);

    /// @dev Error indicating that a target reference is required but not provided.
    error TargetRefRequired();

    constructor() {
        _disableInitializers();
    }

    function initialize() public virtual override initializer {
        ContributionRegistry.initialize();
    }

    /**
     * @notice Contributes on behalf of another address with a specified target reference.
     * @dev Posts a contribution linked to a target reference on behalf of a user.
     * @param to The address for whom the contribution is being made.
     * @param uri The URI for the contribution metadata.
     * @param targetRef The details of the target reference.
     * @return contributionId The unique identifier of the newly minted contribution.
     */
    function _contribute(address to, string memory uri, TargetRef memory targetRef)
    internal
    whenNotPaused
    returns (uint256 contributionId)
    {
        contributionId = super._contribute(to, uri);
        _setTargetRef(contributionId, targetRef);
    }

    /**
     * @dev Disables `_contribute` without a targetRef and reverts with `TargetRefRequired`.
     */
    function _contribute(address /*to*/, string memory /*uri*/) internal pure override returns (uint256) {
        revert TargetRefRequired();
    }

    /**
     * @dev Associates a target reference with a contribution ID.
     * @param contributionId The ID of the contribution.
     * @param targetRef The target reference details.
     */
    function _setTargetRef(uint256 contributionId, TargetRef memory targetRef) private {
        _targetRefs[contributionId] = targetRef;
        emit TargetRefSet(contributionId);
    }
}
