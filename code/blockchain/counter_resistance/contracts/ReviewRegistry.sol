// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RegistryBase.sol";

/**
 * @title ReviewRegistry
 * @dev Extends RegistryBase to manage reviews. A "contribution" and a "review" are synonymous here.
 */
contract ReviewRegistry is RegistryBase {
    struct ReviewTarget {
        // The network/contract/token under review:
        uint256 chainId;
        address contractAddress;
        uint256 targetId;
    }

    mapping(uint256 => ReviewTarget) private _reviewTargets;

    event ReviewTargetSet(uint256 indexed contributionId);

    constructor() {
        _disableInitializers();
    }

    function initialize() public override initializer {
        RegistryBase.initialize();
        __ERC721_init("Review registry", "REVU");
    }

    /**
     * @dev Allows an expert contributor to post a review on behalf of another address.
     * @param to The address for whom the contribution is being made.
     * @param uri The URI for the contribution metadata.
     * @param target The review target details.
     * @return contributionId The ID of the newly minted review.
     */
    function contributeFor(address to, string memory uri, ReviewTarget memory target) public returns (uint256 contributionId) {
        contributionId = super.contributeFor(to, uri);
        _setReviewTarget(contributionId, target);
    }

    /**
     * @dev Allows a contributor to post a review.
     * @param uri The URI for the contribution metadata.
     * @param target The review target details.
     * @return contributionId The ID of the newly minted review.
     */
    function contribute(string memory uri, ReviewTarget memory target) public returns (uint256 contributionId) {
        contributionId = super.contribute(uri);
        _setReviewTarget(contributionId, target);
    }

    /**
     * @dev Associates a review target with a review ID.
     * @param contributionId The ID of the review.
     * @param target The review target details.
     */
    function _setReviewTarget(uint256 contributionId, ReviewTarget memory target) private {
        _reviewTargets[contributionId] = target;
        emit ReviewTargetSet(contributionId);
    }

    //
    // Overrides.
    //

    /**
     * @dev Checks if `spender` is authorized to manage the contribution identified by `contributionId`.
     * Authorization is granted only if the `spender` is both the original contributor of the contribution
     * and has been assigned the EXPERT_CONTRIBUTOR_ROLE.
     * Note: The `owner` parameter is included for compatibility with the override mechanism and is not used.
     *
     * @param owner The address of the contribution's owner, unused in this implementation.
     * @param spender The address attempting to manage the contribution.
     * @param contributionId The unique identifier of the contribution.
     * @return bool True if the `spender` is authorized to manage the contribution, false otherwise.
     */
    function _isAuthorized(address owner, address spender, uint256 contributionId) internal view override returns (bool) {
        bool isOriginalContributor = (getOriginalContributor(contributionId) == spender);
        bool isExpertContributor = hasRole(EXPERT_CONTRIBUTOR_ROLE, spender);

        return isOriginalContributor && isExpertContributor;
    }
}
